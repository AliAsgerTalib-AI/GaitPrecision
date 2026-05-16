import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';
import type { StrideMetrics, LegStrideMetrics } from '@/src/lib/sessionDb';
import { poseStore } from '@/src/lib/poseStore';

const SYNC_EVERY = 6;           // flush ref → state every 6th detected frame
const HISTORY_CAP = 50;         // max readings kept per side
const EMA_ALPHA = 0.2;          // exponential moving-average weight (lower = smoother)
const HEEL_STRIKE_ANGLE = 155;  // (°) knee above this while in swing → heel-strike
const TOE_OFF_ANGLE = 140;      // (°) knee below this while in stance → toe-off
const MAX_RECENT_STRIDES = 4;   // rolling window for cadence / phase % computation
const VISIBILITY_THRESHOLD = 0.6; // min per-landmark confidence to include a reading

interface JointAngles {
  left: number[];
  right: number[];
}

// Internal gait-phase tracker — lives entirely in a ref, never triggers renders.
interface LegGaitState {
  phase: 'stance' | 'swing';
  lastHeelStrike: number;  // video currentTime (s), −1 = not yet detected
  lastToeOff: number;      // video currentTime (s), −1 = not yet detected
  stanceTimes: number[];   // rolling window of recent stance durations
  strideTimes: number[];   // rolling window of recent stride durations
}

function detectStrideEvent(state: LegGaitState, kneeAngle: number, t: number): void {
  if (state.phase === 'stance' && kneeAngle < TOE_OFF_ANGLE) {
    state.lastToeOff = t;
    state.phase = 'swing';
  } else if (state.phase === 'swing' && kneeAngle > HEEL_STRIKE_ANGLE) {
    if (state.lastHeelStrike >= 0) {
      const strideTime = t - state.lastHeelStrike;
      if (strideTime > 0.4 && strideTime < 3.0) { // physiological plausibility guard
        state.strideTimes.push(strideTime);
        if (state.strideTimes.length > MAX_RECENT_STRIDES) state.strideTimes.shift();
        if (state.lastToeOff > state.lastHeelStrike) {
          const stanceTime = state.lastToeOff - state.lastHeelStrike;
          state.stanceTimes.push(stanceTime);
          if (state.stanceTimes.length > MAX_RECENT_STRIDES) state.stanceTimes.shift();
        }
      }
    }
    state.lastHeelStrike = t;
    state.phase = 'stance';
  }
}

function computeLegMetrics(state: LegGaitState): LegStrideMetrics {
  if (state.strideTimes.length === 0) return { stancePercent: 0, swingPercent: 0, strideTime: 0 };
  const avgStride = state.strideTimes.reduce((a, b) => a + b, 0) / state.strideTimes.length;
  const stancePct = state.stanceTimes.length > 0
    ? Math.round((state.stanceTimes.reduce((a, b) => a + b, 0) / state.stanceTimes.length / avgStride) * 100)
    : 62; // typical gait ratio until enough toe-off events accumulate
  return {
    stancePercent: Math.min(100, stancePct),
    swingPercent:  Math.min(100, 100 - stancePct),
    strideTime: avgStride,
  };
}

function freshGaitState(): { left: LegGaitState; right: LegGaitState } {
  const leg = (): LegGaitState => ({ phase: 'stance', lastHeelStrike: -1, lastToeOff: -1, stanceTimes: [], strideTimes: [] });
  return { left: leg(), right: leg() };
}

export function useGaitAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [kneeAngles,   setKneeAngles]   = useState<JointAngles>({ left: [], right: [] });
  const [hipAngles,    setHipAngles]    = useState<JointAngles>({ left: [], right: [] });
  const [ankleAngles,  setAnkleAngles]  = useState<JointAngles>({ left: [], right: [] });
  const [strideMetrics, setStrideMetrics] = useState<StrideMetrics>({
    cadence: 0,
    left:  { stancePercent: 0, swingPercent: 0, strideTime: 0 },
    right: { stancePercent: 0, swingPercent: 0, strideTime: 0 },
  });

  // Refs keep landmarker and drawing utilities out of React state so the rAF
  // loop never reads stale closures and init never triggers extra re-renders.
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef = useRef<((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[]) => void) | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Mutable angle accumulators — written every detected frame, no re-renders on their own.
  const kneeAnglesRef  = useRef<JointAngles>({ left: [], right: [] });
  const hipAnglesRef   = useRef<JointAngles>({ left: [], right: [] });
  const ankleAnglesRef = useRef<JointAngles>({ left: [], right: [] });
  // Mirrors isProcessing so the rAF closure stays stable (no closure capture of state).
  const isProcessingRef = useRef(false);
  // Counts detected frames; a state flush fires every SYNC_EVERY increments.
  const frameCountRef = useRef(0);
  // EMA accumulators — NaN until the first frame seeds them.
  const emaLeftRef        = useRef(NaN);
  const emaRightRef       = useRef(NaN);
  const emaHipLeftRef     = useRef(NaN);
  const emaHipRightRef    = useRef(NaN);
  const emaAnkleLeftRef   = useRef(NaN);
  const emaAnkleRightRef  = useRef(NaN);
  // Per-leg gait-phase state for stride event detection.
  const gaitStateRef = useRef(freshGaitState());

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    let cancelled = false;

    async function initPose() {
      // Hard SSR guard: window is undefined in Node/Next.js server runtime.
      // The enclosing useEffect already prevents execution on the server, but
      // this keeps the function safe if it is ever called outside that context.
      if (typeof window === 'undefined') return;

      try {
        // Dynamic import defers WASM parsing until after first paint and keeps
        // this module safe to evaluate in SSR environments where browser globals
        // (navigator, Worker, WebAssembly) do not exist.
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        poseLandmarkerRef.current = landmarker;

        // Capture DrawingUtils and POSE_CONNECTIONS in a stable closure so
        // processFrame never calls import() on the hot rAF path.
        drawRef.current = (ctx, landmarks) => {
          const du = new DrawingUtils(ctx);
          du.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: '#57f1db33',
            lineWidth: 2,
          });
          du.drawLandmarks(landmarks, {
            color: '#57f1db',
            lineWidth: 1,
            radius: 2,
          });
        };

        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize PoseLandmarker:', err);
      }
    }

    initPose();

    return () => {
      cancelled = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      drawRef.current = null;
    };
  }, []);

  const calculateAngle = (p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark) => {
    const radians =
      Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  // Stable callback — reads only refs, never captures state, so it is safe to
  // keep in the rAF loop without re-subscribing on every isProcessing change.
  const processFrame = useCallback(() => {
    if (!poseLandmarkerRef.current || !videoRef.current || !canvasRef.current || !isProcessingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length) {
        const lm = results.landmarks[0];
        drawRef.current?.(ctx, lm);
        poseStore.write(lm); // feed Gait3D — before visibility gate so skeleton is always smooth

        // Landmark indices: hip 23/24, knee 25/26, ankle 27/28, foot-index 31/32
        const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
        const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];

        const vis = (lm: NormalizedLandmark) => (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD;
        if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle &&
            vis(lHip) && vis(lKnee) && vis(lAnkle) && vis(rHip) && vis(rKnee) && vis(rAnkle)) {
          // ── Knee angles (hip → knee → ankle) ─────────────────────────────
          const lKneeRaw = calculateAngle(lHip, lKnee, lAnkle);
          const rKneeRaw = calculateAngle(rHip, rKnee, rAnkle);
          emaLeftRef.current  = isNaN(emaLeftRef.current)  ? lKneeRaw : EMA_ALPHA * lKneeRaw + (1 - EMA_ALPHA) * emaLeftRef.current;
          emaRightRef.current = isNaN(emaRightRef.current) ? rKneeRaw : EMA_ALPHA * rKneeRaw + (1 - EMA_ALPHA) * emaRightRef.current;
          const kneeAcc = kneeAnglesRef.current;
          if (kneeAcc.left.length  >= HISTORY_CAP) kneeAcc.left.shift();
          if (kneeAcc.right.length >= HISTORY_CAP) kneeAcc.right.shift();
          kneeAcc.left.push(emaLeftRef.current);
          kneeAcc.right.push(emaRightRef.current);

          // ── Hip angles (opposite-hip → this-hip → this-knee) ─────────────
          const lHipRaw = calculateAngle(lm[24], lm[23], lm[25]);
          const rHipRaw = calculateAngle(lm[23], lm[24], lm[26]);
          emaHipLeftRef.current  = isNaN(emaHipLeftRef.current)  ? lHipRaw : EMA_ALPHA * lHipRaw + (1 - EMA_ALPHA) * emaHipLeftRef.current;
          emaHipRightRef.current = isNaN(emaHipRightRef.current) ? rHipRaw : EMA_ALPHA * rHipRaw + (1 - EMA_ALPHA) * emaHipRightRef.current;
          const hipAcc = hipAnglesRef.current;
          if (hipAcc.left.length  >= HISTORY_CAP) hipAcc.left.shift();
          if (hipAcc.right.length >= HISTORY_CAP) hipAcc.right.shift();
          hipAcc.left.push(emaHipLeftRef.current);
          hipAcc.right.push(emaHipRightRef.current);

          // ── Ankle angles (knee → ankle → foot-index) ─────────────────────
          const lFoot = lm[31], rFoot = lm[32];
          if (lFoot && rFoot && vis(lFoot) && vis(rFoot)) {
            const lAnkleRaw = calculateAngle(lm[25], lm[27], lFoot);
            const rAnkleRaw = calculateAngle(lm[26], lm[28], rFoot);
            emaAnkleLeftRef.current  = isNaN(emaAnkleLeftRef.current)  ? lAnkleRaw : EMA_ALPHA * lAnkleRaw + (1 - EMA_ALPHA) * emaAnkleLeftRef.current;
            emaAnkleRightRef.current = isNaN(emaAnkleRightRef.current) ? rAnkleRaw : EMA_ALPHA * rAnkleRaw + (1 - EMA_ALPHA) * emaAnkleRightRef.current;
            const ankleAcc = ankleAnglesRef.current;
            if (ankleAcc.left.length  >= HISTORY_CAP) ankleAcc.left.shift();
            if (ankleAcc.right.length >= HISTORY_CAP) ankleAcc.right.shift();
            ankleAcc.left.push(emaAnkleLeftRef.current);
            ankleAcc.right.push(emaAnkleRightRef.current);
          }

          // ── Stride event detection from knee threshold crossings ──────────
          const t = video.currentTime;
          detectStrideEvent(gaitStateRef.current.left,  emaLeftRef.current,  t);
          detectStrideEvent(gaitStateRef.current.right, emaRightRef.current, t);

          // ── Flush a snapshot to React state every SYNC_EVERY frames ───────
          frameCountRef.current++;
          if (frameCountRef.current % SYNC_EVERY === 0) {
            setKneeAngles({ left: [...kneeAcc.left], right: [...kneeAcc.right] });
            setHipAngles({ left: [...hipAnglesRef.current.left], right: [...hipAnglesRef.current.right] });
            setAnkleAngles({ left: [...ankleAnglesRef.current.left], right: [...ankleAnglesRef.current.right] });

            const leftLeg  = computeLegMetrics(gaitStateRef.current.left);
            const rightLeg = computeLegMetrics(gaitStateRef.current.right);
            const bothValid = leftLeg.strideTime > 0 && rightLeg.strideTime > 0;
            const avgStride = bothValid
              ? (leftLeg.strideTime + rightLeg.strideTime) / 2
              : leftLeg.strideTime || rightLeg.strideTime;
            setStrideMetrics({
              cadence: avgStride > 0 ? Math.round(120 / avgStride) : 0,
              left: leftLeg,
              right: rightLeg,
            });
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isProcessing) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isProcessing, processFrame]);

  const startAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    poseStore.write(null); // clear stale frame before new analysis
    kneeAnglesRef.current  = { left: [], right: [] };
    hipAnglesRef.current   = { left: [], right: [] };
    ankleAnglesRef.current = { left: [], right: [] };
    frameCountRef.current  = 0;
    lastVideoTimeRef.current = -1;
    emaLeftRef.current        = NaN;
    emaRightRef.current       = NaN;
    emaHipLeftRef.current     = NaN;
    emaHipRightRef.current    = NaN;
    emaAnkleLeftRef.current   = NaN;
    emaAnkleRightRef.current  = NaN;
    gaitStateRef.current = freshGaitState();
    // Stop processing cleanly when the clip finishes.
    video.addEventListener('ended', () => setIsProcessing(false), { once: true });
    video.play().catch(console.error);
    setIsProcessing(true);
  }, []); // reads only stable refs — safe with empty deps

  return {
    videoRef,
    canvasRef,
    isReady,
    isProcessing,
    kneeAngles,
    hipAngles,
    ankleAngles,
    strideMetrics,
    startAnalysis,
  };
}
