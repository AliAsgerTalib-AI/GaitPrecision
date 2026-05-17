import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, Landmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

const EMA_ALPHA = 0.2;
const VISIBILITY_THRESHOLD = 0.6;
const SYNC_EVERY = 6;
const HISTORY_CAP = 50;    // sparkline rolling window
const MAX_RECENT_STEPS = 8; // rolling window for cadence / consistency

// Interior knee angle thresholds for stair-step detection.
// Standard stair rise (~18 cm) requires ~85–105° knee flexion → interior angle ~75–95°.
// STEP_ENTER: knee drops below this → stepping phase begins (≥45° of flexion)
// STEP_EXIT:  knee rises above this → step has landed
// STEP_PEAK_MAX: peak interior angle must be ≤ this to count (≥60° of true flexion)
const STEP_ENTER    = 135; // °
const STEP_EXIT     = 148; // °
const STEP_PEAK_MAX = 120; // °

interface LegState {
  phase: 'extended' | 'stepping';
  minAngle: number;       // minimum interior angle seen during current step
  stepStartTime: number;  // video time when step-up phase began
  lastStepTime: number;   // video time of last completed step
  intervals: number[];    // same-leg inter-step times (rolling)
  peaks: number[];        // peak interior angles per step (rolling)
}

export interface StepRecord {
  leg: 'left' | 'right';
  stepNum: number;   // 1-based global step index
  peak: number;      // interior knee angle at peak flexion (°) — lower = more bend
  t: number;         // video time of step completion (s)
}

export interface StairMetrics {
  stepCount: number;
  cadence: number;             // steps/min (both legs combined)
  leftPeakAvg: number;        // mean peak interior angle for left steps (°)
  rightPeakAvg: number;
  leftConsistency: number;    // SD of left peak angles (°) — lower = more consistent
  rightConsistency: number;
  asymmetry: number;          // |leftFlexionAvg − rightFlexionAvg| in flexion degrees
  stepHistory: StepRecord[];  // full session history (for chart)
  kneeAngles: { left: number[]; right: number[] }; // rolling window for sparklines
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function freshLeg(): LegState {
  return { phase: 'extended', minAngle: 180, stepStartTime: -1, lastStepTime: -1, intervals: [], peaks: [] };
}

function angle3D(p1: Landmark, p2: Landmark, p3: Landmark): number {
  const v1x = p1.x - p2.x, v1y = p1.y - p2.y, v1z = p1.z - p2.z;
  const v2x = p3.x - p2.x, v2y = p3.y - p2.y, v2z = p3.z - p2.z;
  const dot  = v1x*v2x + v1y*v2y + v1z*v2z;
  const mag1 = Math.sqrt(v1x**2 + v1y**2 + v1z**2);
  const mag2 = Math.sqrt(v2x**2 + v2y**2 + v2z**2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
}

const EMPTY: StairMetrics = {
  stepCount: 0, cadence: 0,
  leftPeakAvg: 0, rightPeakAvg: 0,
  leftConsistency: 0, rightConsistency: 0,
  asymmetry: 0, stepHistory: [],
  kneeAngles: { left: [], right: [] },
};

export function useStairAnalyzer() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady,      setIsReady]      = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [metrics,      setMetrics]      = useState<StairMetrics>(EMPTY);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef           = useRef<((ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[]) => void) | null>(null);
  const rafRef            = useRef<number | null>(null);
  const lastVideoTimeRef  = useRef(-1);
  const isProcessingRef   = useRef(false);
  const frameCountRef     = useRef(0);

  const legStateRef   = useRef<{ left: LegState; right: LegState }>({ left: freshLeg(), right: freshLeg() });
  const emaLeftRef    = useRef(NaN);
  const emaRightRef   = useRef(NaN);
  const kneeAnglesRef = useRef<{ left: number[]; right: number[] }>({ left: [], right: [] });
  const stepHistoryRef = useRef<StepRecord[]>([]);
  const allStepTimesRef = useRef<number[]>([]); // all step completion times across both legs

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (typeof window === 'undefined') return;
      try {
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) { landmarker.close(); return; }
        poseLandmarkerRef.current = landmarker;
        drawRef.current = (ctx, lm) => {
          const du = new DrawingUtils(ctx);
          du.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: '#57f1db33', lineWidth: 2 });
          du.drawLandmarks(lm, { color: '#57f1db', lineWidth: 1, radius: 2 });
        };
        setIsReady(true);
      } catch (err) {
        console.error('StairAnalyzer init failed:', err);
      }
    }
    init();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      drawRef.current = null;
    };
  }, []);

  const detectStep = useCallback((state: LegState, kneeAngle: number, t: number, leg: 'left' | 'right') => {
    if (state.phase === 'extended' && kneeAngle < STEP_ENTER) {
      state.phase = 'stepping';
      state.minAngle = kneeAngle;
      state.stepStartTime = t;
    } else if (state.phase === 'stepping') {
      state.minAngle = Math.min(state.minAngle, kneeAngle);

      if (kneeAngle > STEP_EXIT) {
        const duration = t - state.stepStartTime;
        if (state.minAngle <= STEP_PEAK_MAX && duration >= 0.3 && duration <= 4.0) {
          // Valid step detected
          const stepNum = stepHistoryRef.current.length + 1;
          stepHistoryRef.current.push({ leg, stepNum, peak: state.minAngle, t });

          allStepTimesRef.current.push(t);
          if (allStepTimesRef.current.length > MAX_RECENT_STEPS * 2) allStepTimesRef.current.shift();

          if (state.lastStepTime >= 0) {
            const interval = t - state.lastStepTime;
            if (interval < 6.0) { // plausibility guard (one step per leg)
              state.intervals.push(interval);
              if (state.intervals.length > MAX_RECENT_STEPS) state.intervals.shift();
            }
          }

          state.peaks.push(state.minAngle);
          if (state.peaks.length > MAX_RECENT_STEPS) state.peaks.shift();
          state.lastStepTime = t;
        }
        state.phase = 'extended';
        state.minAngle = 180;
        state.stepStartTime = -1;
      }
    }
  }, []);

  const processFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!poseLandmarkerRef.current || !video || !canvas || !isProcessingRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const t = video.currentTime;

      const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length && results.worldLandmarks?.length) {
        const lm  = results.landmarks[0];
        const wlm = results.worldLandmarks[0];

        drawRef.current?.(ctx, lm);

        const vis = (l: NormalizedLandmark) => (l.visibility ?? 1) >= VISIBILITY_THRESHOLD;

        if (vis(lm[23]) && vis(lm[25]) && vis(lm[27])) {
          const lRaw = angle3D(wlm[23], wlm[25], wlm[27]);
          emaLeftRef.current = isNaN(emaLeftRef.current) ? lRaw : EMA_ALPHA * lRaw + (1 - EMA_ALPHA) * emaLeftRef.current;
          const ka = kneeAnglesRef.current;
          if (ka.left.length >= HISTORY_CAP) ka.left.shift();
          ka.left.push(emaLeftRef.current);
          detectStep(legStateRef.current.left, emaLeftRef.current, t, 'left');
        }

        if (vis(lm[24]) && vis(lm[26]) && vis(lm[28])) {
          const rRaw = angle3D(wlm[24], wlm[26], wlm[28]);
          emaRightRef.current = isNaN(emaRightRef.current) ? rRaw : EMA_ALPHA * rRaw + (1 - EMA_ALPHA) * emaRightRef.current;
          const ka = kneeAnglesRef.current;
          if (ka.right.length >= HISTORY_CAP) ka.right.shift();
          ka.right.push(emaRightRef.current);
          detectStep(legStateRef.current.right, emaRightRef.current, t, 'right');
        }

        frameCountRef.current++;
        if (frameCountRef.current % SYNC_EVERY === 0) {
          const lState = legStateRef.current.left;
          const rState = legStateRef.current.right;
          const history = stepHistoryRef.current;

          // Combined cadence: from all step times
          const times = allStepTimesRef.current;
          let cadence = 0;
          if (times.length >= 2) {
            const span = times[times.length - 1] - times[0];
            cadence = span > 0 ? Math.round((times.length - 1) / span * 60) : 0;
          }

          const lPeaks = lState.peaks;
          const rPeaks = rState.peaks;
          const lAvg = avg(lPeaks);
          const rAvg = avg(rPeaks);
          // Asymmetry in flexion degrees: (180 - interior) for each leg
          const asymmetry = lPeaks.length > 0 && rPeaks.length > 0
            ? Math.abs((180 - lAvg) - (180 - rAvg))
            : 0;

          setMetrics({
            stepCount: history.length,
            cadence,
            leftPeakAvg:  lAvg,
            rightPeakAvg: rAvg,
            leftConsistency:  stdDev(lPeaks),
            rightConsistency: stdDev(rPeaks),
            asymmetry,
            stepHistory: [...history],
            kneeAngles: {
              left:  [...kneeAnglesRef.current.left],
              right: [...kneeAnglesRef.current.right],
            },
          });
        }
      }
    }

    if (video.ended || video.paused) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [detectStep]);

  const startAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!poseLandmarkerRef.current || !video) return;

    legStateRef.current  = { left: freshLeg(), right: freshLeg() };
    emaLeftRef.current   = NaN;
    emaRightRef.current  = NaN;
    kneeAnglesRef.current = { left: [], right: [] };
    stepHistoryRef.current = [];
    allStepTimesRef.current = [];
    frameCountRef.current  = 0;
    lastVideoTimeRef.current = -1;
    setMetrics(EMPTY);

    if (video.paused) video.play();
    isProcessingRef.current = true;
    setIsProcessing(true);
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  return { videoRef, canvasRef, isReady, isProcessing, metrics, startAnalysis };
}
