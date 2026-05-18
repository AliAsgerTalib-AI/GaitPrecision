import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, Landmark, PoseLandmarker } from '@mediapipe/tasks-vision';
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
const VISIBILITY_WARN_FRAMES = 20; // consecutive dropped frames before showing the leg-visibility warning

export interface GaitConfig {
  sensitivity: number;    // 0–100 → EMA alpha 0.05–0.45
  kneeThreshold: number;  // °, heel-strike gate (HEEL_STRIKE_ANGLE)
  ankleThreshold: number; // °, min deviation from 90° neutral to log ankle reading
  autoScale: boolean;     // scale skeleton to fill 80% of canvas each frame
}

export const DEFAULT_CONFIG: GaitConfig = {
  sensitivity: 50,
  kneeThreshold: HEEL_STRIKE_ANGLE,
  ankleThreshold: 15,
  autoScale: true,
};

export interface MedialCollapseStatus {
  left: boolean;
  right: boolean;
  leftMessage: string;
  rightMessage: string;
}

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

// Scales normalized landmarks so the subject fills ~80% of the canvas each frame.
// Uses lower-body landmark positions (hips → feet) as the anchor bounding box,
// then applies the same transform to all landmarks so upper body stays coherent.
function scaleLandmarksToFit(lm: NormalizedLandmark[]): NormalizedLandmark[] {
  const LOWER_BODY = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const anchor = LOWER_BODY.map(i => lm[i]).filter(p => p && (p.visibility ?? 1) >= 0.3);
  if (anchor.length < 4) return lm;
  const minX = Math.min(...anchor.map(p => p.x));
  const maxX = Math.max(...anchor.map(p => p.x));
  const minY = Math.min(...anchor.map(p => p.y));
  const maxY = Math.max(...anchor.map(p => p.y));
  if (maxX - minX < 0.05 || maxY - minY < 0.05) return lm;
  const scale = 0.8 / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return lm.map(p => ({ ...p, x: 0.5 + (p.x - cx) * scale, y: 0.5 + (p.y - cy) * scale }));
}

function detectStrideEvent(state: LegGaitState, kneeAngle: number, t: number, heelStrikeAngle: number, toeOffAngle: number): void {
  if (state.phase === 'stance' && kneeAngle < toeOffAngle) {
    state.lastToeOff = t;
    state.phase = 'swing';
  } else if (state.phase === 'swing' && kneeAngle > heelStrikeAngle) {
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
  const measured  = state.stanceTimes.length > 0;
  const stancePct = measured
    ? Math.round((state.stanceTimes.reduce((a, b) => a + b, 0) / state.stanceTimes.length / avgStride) * 100)
    : 62;
  return {
    stancePercent:    Math.min(100, stancePct),
    swingPercent:     Math.min(100, 100 - stancePct),
    strideTime:       avgStride,
    stanceEstimated:  !measured,
  };
}

function freshGaitState(): { left: LegGaitState; right: LegGaitState } {
  const leg = (): LegGaitState => ({ phase: 'stance', lastHeelStrike: -1, lastToeOff: -1, stanceTimes: [], strideTimes: [] });
  return { left: leg(), right: leg() };
}

function detectMedialCollapse(lm: NormalizedLandmark[], side: 'left' | 'right'): { collapsed: boolean; message: string } {
  const knee  = side === 'left' ? lm[25] : lm[26];
  const ankle = side === 'left' ? lm[27] : lm[28];
  if (!knee || !ankle) return { collapsed: false, message: '' };
  if (Math.abs(knee.x - ankle.x) > 0.05) {
    return { collapsed: true, message: 'Knee Tracking Inside Ankle Detected: Dynamic Valgus Risk.' };
  }
  return { collapsed: false, message: '' };
}

function drawCollapseSegment(ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], kneeIdx: number, ankleIdx: number) {
  const knee  = lm[kneeIdx];
  const ankle = lm[ankleIdx];
  if (!knee || !ankle) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.strokeStyle = '#FF3366';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#FF3366';
  ctx.shadowBlur = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(knee.x * w, knee.y * h);
  ctx.lineTo(ankle.x * w, ankle.y * h);
  ctx.stroke();
  ctx.fillStyle = '#FF3366';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(knee.x * w, knee.y * h, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function useGaitAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visibilityWarning, setVisibilityWarning] = useState(false);
  const [kneeAngles,   setKneeAngles]   = useState<JointAngles>({ left: [], right: [] });
  const [hipAngles,    setHipAngles]    = useState<JointAngles>({ left: [], right: [] });
  const [ankleAngles,  setAnkleAngles]  = useState<JointAngles>({ left: [], right: [] });
  const [strideMetrics, setStrideMetrics] = useState<StrideMetrics>({
    cadence: 0,
    left:  { stancePercent: 0, swingPercent: 0, strideTime: 0 },
    right: { stancePercent: 0, swingPercent: 0, strideTime: 0 },
  });
  const [medialCollapse, setMedialCollapse] = useState<MedialCollapseStatus>({ left: false, right: false, leftMessage: '', rightMessage: '' });
  const medialCollapseRef = useRef<MedialCollapseStatus>({ left: false, right: false, leftMessage: '', rightMessage: '' });

  // Live-configurable parameters — written by applyConfig, read inside the rAF loop.
  const emaAlphaRef        = useRef(EMA_ALPHA);
  const heelStrikeRef      = useRef(HEEL_STRIKE_ANGLE);
  const toeOffRef          = useRef(TOE_OFF_ANGLE);
  const ankleDeviationRef  = useRef(DEFAULT_CONFIG.ankleThreshold);
  const autoScaleRef       = useRef(DEFAULT_CONFIG.autoScale);

  // Refs keep landmarker and drawing utilities out of React state so the rAF
  // loop never reads stale closures and init never triggers extra re-renders.
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef = useRef<((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[]) => void) | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Display buffers — capped at HISTORY_CAP for live UI rendering.
  const kneeAnglesRef  = useRef<JointAngles>({ left: [], right: [] });
  const hipAnglesRef   = useRef<JointAngles>({ left: [], right: [] });
  const ankleAnglesRef = useRef<JointAngles>({ left: [], right: [] });
  // Full-session accumulators — never truncated, used for saving and scoring.
  const kneeFullRef  = useRef<JointAngles>({ left: [], right: [] });
  const hipFullRef   = useRef<JointAngles>({ left: [], right: [] });
  const ankleFullRef = useRef<JointAngles>({ left: [], right: [] });
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
  // Consecutive frames where key landmarks failed the visibility gate.
  // Only triggers a setState on transitions to keep the rAF loop cheap.
  const consecutiveDropRef  = useRef(0);
  const visibilityWarnRef   = useRef(false);

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

  // 3D dot-product angle — view-independent because worldLandmarks are in
  // real-space metres relative to the pelvis, not screen pixels.
  const calculateAngle = (p1: Landmark, p2: Landmark, p3: Landmark): number => {
    const v1x = p1.x - p2.x, v1y = p1.y - p2.y, v1z = p1.z - p2.z;
    const v2x = p3.x - p2.x, v2y = p3.y - p2.y, v2z = p3.z - p2.z;
    const dot  = v1x*v2x + v1y*v2y + v1z*v2z;
    const mag1 = Math.sqrt(v1x**2 + v1y**2 + v1z**2);
    const mag2 = Math.sqrt(v2x**2 + v2y**2 + v2z**2);
    if (mag1 === 0 || mag2 === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
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

      if (results.landmarks?.length && results.worldLandmarks?.length) {
        const lm  = results.landmarks[0];      // 2D normalised — used for drawing + visibility
        const wlm = results.worldLandmarks[0]; // 3D world-space — used for angle maths

        const drawLm = autoScaleRef.current ? scaleLandmarksToFit(lm) : lm;
        drawRef.current?.(ctx, drawLm);
        poseStore.write(lm); // feed Gait3D — before visibility gate so skeleton is always smooth

        // Visibility is carried on the 2D landmarks; use those to gate bad frames.
        const vis = (l: NormalizedLandmark) => (l.visibility ?? 1) >= VISIBILITY_THRESHOLD;
        const lHip2 = lm[23], lKnee2 = lm[25], lAnkle2 = lm[27];
        const rHip2 = lm[24], rKnee2 = lm[26], rAnkle2 = lm[28];

        const landmarksOk = lHip2 && lKnee2 && lAnkle2 && rHip2 && rKnee2 && rAnkle2 &&
            vis(lHip2) && vis(lKnee2) && vis(lAnkle2) && vis(rHip2) && vis(rKnee2) && vis(rAnkle2);

        if (landmarksOk) {
          consecutiveDropRef.current = 0;
          if (visibilityWarnRef.current) { visibilityWarnRef.current = false; setVisibilityWarning(false); }

          // ── Knee angles from 3D world landmarks (hip → knee → ankle) ─────
          const lKneeRaw = calculateAngle(wlm[23], wlm[25], wlm[27]);
          const rKneeRaw = calculateAngle(wlm[24], wlm[26], wlm[28]);
          const alpha = emaAlphaRef.current;
          emaLeftRef.current  = isNaN(emaLeftRef.current)  ? lKneeRaw : alpha * lKneeRaw + (1 - alpha) * emaLeftRef.current;
          emaRightRef.current = isNaN(emaRightRef.current) ? rKneeRaw : alpha * rKneeRaw + (1 - alpha) * emaRightRef.current;
          const kneeAcc = kneeAnglesRef.current;
          if (kneeAcc.left.length  >= HISTORY_CAP) kneeAcc.left.shift();
          if (kneeAcc.right.length >= HISTORY_CAP) kneeAcc.right.shift();
          kneeAcc.left.push(emaLeftRef.current);
          kneeAcc.right.push(emaRightRef.current);
          kneeFullRef.current.left.push(emaLeftRef.current);
          kneeFullRef.current.right.push(emaRightRef.current);

          // ── Hip angles (opposite-hip → this-hip → this-knee) ─────────────
          const lHipRaw = calculateAngle(wlm[24], wlm[23], wlm[25]);
          const rHipRaw = calculateAngle(wlm[23], wlm[24], wlm[26]);
          emaHipLeftRef.current  = isNaN(emaHipLeftRef.current)  ? lHipRaw : alpha * lHipRaw + (1 - alpha) * emaHipLeftRef.current;
          emaHipRightRef.current = isNaN(emaHipRightRef.current) ? rHipRaw : alpha * rHipRaw + (1 - alpha) * emaHipRightRef.current;
          const hipAcc = hipAnglesRef.current;
          if (hipAcc.left.length  >= HISTORY_CAP) hipAcc.left.shift();
          if (hipAcc.right.length >= HISTORY_CAP) hipAcc.right.shift();
          hipAcc.left.push(emaHipLeftRef.current);
          hipAcc.right.push(emaHipRightRef.current);
          hipFullRef.current.left.push(emaHipLeftRef.current);
          hipFullRef.current.right.push(emaHipRightRef.current);

          // ── Ankle angles (knee → ankle → foot-index) ─────────────────────
          const lFoot2 = lm[31], rFoot2 = lm[32];
          if (lFoot2 && rFoot2 && vis(lFoot2) && vis(rFoot2)) {
            const lAnkleRaw = calculateAngle(wlm[25], wlm[27], wlm[31]);
            const rAnkleRaw = calculateAngle(wlm[26], wlm[28], wlm[32]);
            emaAnkleLeftRef.current  = isNaN(emaAnkleLeftRef.current)  ? lAnkleRaw : alpha * lAnkleRaw + (1 - alpha) * emaAnkleLeftRef.current;
            emaAnkleRightRef.current = isNaN(emaAnkleRightRef.current) ? rAnkleRaw : alpha * rAnkleRaw + (1 - alpha) * emaAnkleRightRef.current;
            const ankleAcc = ankleAnglesRef.current;
            if (ankleAcc.left.length  >= HISTORY_CAP) ankleAcc.left.shift();
            if (ankleAcc.right.length >= HISTORY_CAP) ankleAcc.right.shift();
            ankleAcc.left.push(emaAnkleLeftRef.current);
            ankleAcc.right.push(emaAnkleRightRef.current);
            // Only log to full session data when deviation from neutral (90°) exceeds
            // the ankle threshold — suppresses flat-foot noise during stance.
            const ankleGate = ankleDeviationRef.current;
            if (Math.abs(emaAnkleLeftRef.current  - 90) >= ankleGate) ankleFullRef.current.left.push(emaAnkleLeftRef.current);
            if (Math.abs(emaAnkleRightRef.current - 90) >= ankleGate) ankleFullRef.current.right.push(emaAnkleRightRef.current);
          }

          // ── Medial collapse detection ─────────────────────────────────────
          const leftCollapse  = detectMedialCollapse(lm, 'left');
          const rightCollapse = detectMedialCollapse(lm, 'right');
          medialCollapseRef.current = {
            left:         leftCollapse.collapsed,
            right:        rightCollapse.collapsed,
            leftMessage:  leftCollapse.message,
            rightMessage: rightCollapse.message,
          };
          if (leftCollapse.collapsed)  drawCollapseSegment(ctx, drawLm, 25, 27);
          if (rightCollapse.collapsed) drawCollapseSegment(ctx, drawLm, 26, 28);

          // ── Stride event detection from knee threshold crossings ──────────
          const t = video.currentTime;
          detectStrideEvent(gaitStateRef.current.left,  emaLeftRef.current,  t, heelStrikeRef.current, toeOffRef.current);
          detectStrideEvent(gaitStateRef.current.right, emaRightRef.current, t, heelStrikeRef.current, toeOffRef.current);

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
            setMedialCollapse({ ...medialCollapseRef.current });
          }
        } else {
          consecutiveDropRef.current++;
          if (consecutiveDropRef.current >= VISIBILITY_WARN_FRAMES && !visibilityWarnRef.current) {
            visibilityWarnRef.current = true;
            setVisibilityWarning(true);
          }
          if (medialCollapseRef.current.left || medialCollapseRef.current.right) {
            medialCollapseRef.current = { left: false, right: false, leftMessage: '', rightMessage: '' };
            setMedialCollapse({ left: false, right: false, leftMessage: '', rightMessage: '' });
          }
        }
      } else {
        // No person detected in this frame at all.
        consecutiveDropRef.current++;
        if (consecutiveDropRef.current >= VISIBILITY_WARN_FRAMES && !visibilityWarnRef.current) {
          visibilityWarnRef.current = true;
          setVisibilityWarning(true);
        }
        if (medialCollapseRef.current.left || medialCollapseRef.current.right) {
          medialCollapseRef.current = { left: false, right: false, leftMessage: '', rightMessage: '' };
          setMedialCollapse({ left: false, right: false, leftMessage: '', rightMessage: '' });
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

  const getSessionData = useCallback(() => ({
    kneeAngles:  { left: [...kneeFullRef.current.left],  right: [...kneeFullRef.current.right]  },
    hipAngles:   { left: [...hipFullRef.current.left],   right: [...hipFullRef.current.right]   },
    ankleAngles: { left: [...ankleFullRef.current.left], right: [...ankleFullRef.current.right] },
  }), []);

  const applyConfig = useCallback((cfg: GaitConfig) => {
    emaAlphaRef.current       = 0.05 + (cfg.sensitivity / 100) * 0.40;
    heelStrikeRef.current     = cfg.kneeThreshold;
    toeOffRef.current         = Math.max(0, cfg.kneeThreshold - 15);
    ankleDeviationRef.current = cfg.ankleThreshold;
    autoScaleRef.current      = cfg.autoScale;
  }, []);

  const resetConfig = useCallback(() => {
    emaAlphaRef.current       = EMA_ALPHA;
    heelStrikeRef.current     = HEEL_STRIKE_ANGLE;
    toeOffRef.current         = TOE_OFF_ANGLE;
    ankleDeviationRef.current = DEFAULT_CONFIG.ankleThreshold;
    autoScaleRef.current      = DEFAULT_CONFIG.autoScale;
  }, []);

  const startAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    poseStore.write(null); // clear stale frame before new analysis
    kneeAnglesRef.current  = { left: [], right: [] };
    hipAnglesRef.current   = { left: [], right: [] };
    ankleAnglesRef.current = { left: [], right: [] };
    kneeFullRef.current    = { left: [], right: [] };
    hipFullRef.current     = { left: [], right: [] };
    ankleFullRef.current   = { left: [], right: [] };
    frameCountRef.current  = 0;
    lastVideoTimeRef.current = -1;
    emaLeftRef.current        = NaN;
    emaRightRef.current       = NaN;
    emaHipLeftRef.current     = NaN;
    emaHipRightRef.current    = NaN;
    emaAnkleLeftRef.current   = NaN;
    emaAnkleRightRef.current  = NaN;
    gaitStateRef.current = freshGaitState();
    consecutiveDropRef.current = 0;
    visibilityWarnRef.current  = false;
    setVisibilityWarning(false);
    medialCollapseRef.current = { left: false, right: false, leftMessage: '', rightMessage: '' };
    setMedialCollapse({ left: false, right: false, leftMessage: '', rightMessage: '' });
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
    medialCollapse,
    getSessionData,
    visibilityWarning,
    startAnalysis,
    applyConfig,
    resetConfig,
  };
}
