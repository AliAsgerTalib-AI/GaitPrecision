import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, Landmark } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

const EMA_ALPHA        = 0.2;
const VISIBILITY_THR   = 0.55;
const SYNC_EVERY       = 5;
const HISTORY_CAP      = 50;
const TRACE_CAP        = 200;

// Squat thresholds (bilateral avg interior knee angle °)
const SQ_ENTER = 148;
const SQ_EXIT  = 158;
const SQ_DEPTH = 130;

// Lunge thresholds (min of left/right interior knee angle °)
const LU_ENTER = 115;
const LU_EXIT  = 145;
const LU_DEPTH = 110;

// Hip hinge thresholds (shoulder–hip–knee interior angle °)
const HH_ENTER = 138;
const HH_EXIT  = 155;
const HH_DEPTH = 130;

// Valgus severity thresholds (fraction of hip width)
export const VALGUS_WARN = 0.08;
export const VALGUS_BAD  = 0.18;

export type ExerciseType  = 'squat' | 'lunge' | 'hiphinge';
export type ExerciseDepth = 'partial' | 'parallel' | 'deep';

function classifySqDepth(angle: number): ExerciseDepth {
  if (angle <= 82) return 'deep';
  if (angle <= 98) return 'parallel';
  return 'partial';
}

function classifyLuDepth(angle: number): ExerciseDepth {
  if (angle <= 80) return 'deep';
  if (angle <= 95) return 'parallel';
  return 'partial';
}

function classifyHhDepth(angle: number): ExerciseDepth {
  if (angle <= 80) return 'deep';
  if (angle <= 100) return 'parallel';
  return 'partial';
}

function angle3D(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag  = Math.sqrt((v1.x**2 + v1.y**2 + v1.z**2) * (v2.x**2 + v2.y**2 + v2.z**2));
  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function mid3(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: 1 };
}

function ema(prev: number, next: number, a = EMA_ALPHA) {
  return a * next + (1 - a) * prev;
}

function vis(lm: NormalizedLandmark[], i: number) {
  return (lm[i].visibility ?? 1) >= VISIBILITY_THR;
}

export interface ExerciseRep {
  repNum:      number;
  peakAngle:   number;
  depth:       ExerciseDepth;
  leftValgus:  number;
  rightValgus: number;
  duration:    number;
}

export interface ExerciseMetrics {
  exerciseType:    ExerciseType;
  repCount:        number;
  liveAngle:       number;
  liveLeftValgus:  number;
  liveRightValgus: number;
  avgDepth:        number;
  depthConsistency: number;
  avgLeftValgus:   number;
  avgRightValgus:  number;
  repHistory:      ExerciseRep[];
  angleTrace:      { t: number; angle: number }[];
}

const EMPTY: ExerciseMetrics = {
  exerciseType: 'squat', repCount: 0, liveAngle: 180,
  liveLeftValgus: 0, liveRightValgus: 0, avgDepth: 180,
  depthConsistency: 0, avgLeftValgus: 0, avgRightValgus: 0,
  repHistory: [], angleTrace: [],
};

interface AnalysisState {
  phase:        'up' | 'down';
  minAngle:     number;
  maxValgusL:   number;
  maxValgusR:   number;
  repStartTime: number;
  repCount:     number;
  repHistory:   ExerciseRep[];
  angleTrace:   { t: number; angle: number }[];
  smoothAngle:  number;
  smoothVL:     number;
  smoothVR:     number;
  exType:       ExerciseType;
}

function freshState(type: ExerciseType): AnalysisState {
  return {
    phase: 'up', minAngle: 180, maxValgusL: 0, maxValgusR: 0,
    repStartTime: 0, repCount: 0, repHistory: [], angleTrace: [],
    smoothAngle: 180, smoothVL: 0, smoothVR: 0, exType: type,
  };
}

// ── Skeleton drawing helpers ──────────────────────────────────────────────────

const CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16], // arms
  [11, 12], [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], [24, 26], [26, 28], // legs
];
const KEY_POINTS = [11, 12, 23, 24, 25, 26, 27, 28];

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: NormalizedLandmark[],
  w: number, h: number,
  leftValgus: number, rightValgus: number,
) {
  ctx.lineWidth = 2;
  for (const [a, b] of CONNECTIONS) {
    const A = lm[a], B = lm[b];
    ctx.strokeStyle = 'rgba(87,241,219,0.45)';
    ctx.beginPath();
    ctx.moveTo(A.x * w, A.y * h);
    ctx.lineTo(B.x * w, B.y * h);
    ctx.stroke();
  }

  // Colour knee dots by valgus severity
  const leftKneeColor  = leftValgus  >= VALGUS_BAD  ? '#f87171'
                        : leftValgus  >= VALGUS_WARN ? '#f59e0b' : '#57f1db';
  const rightKneeColor = rightValgus >= VALGUS_BAD  ? '#f87171'
                        : rightValgus >= VALGUS_WARN ? '#f59e0b' : '#57f1db';

  for (const i of KEY_POINTS) {
    ctx.fillStyle = i === 25 ? leftKneeColor : i === 26 ? rightKneeColor : '#57f1db';
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, i === 25 || i === 26 ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExerciseAnalyzer() {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const lmRef      = useRef<any>(null);
  const rafRef     = useRef<number | null>(null);
  const frameRef   = useRef(0);
  const stateRef   = useRef<AnalysisState>(freshState('squat'));

  const [metrics,      setMetrics]      = useState<ExerciseMetrics>(EMPTY);
  const [exerciseType, setExType]       = useState<ExerciseType>('squat');
  const [isReady,      setIsReady]      = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load MediaPipe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
      const pl = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      if (!cancelled) { lmRef.current = pl; setIsReady(true); }
      else pl.close();
    })();
    return () => { cancelled = true; lmRef.current?.close(); };
  }, []);

  const setExerciseType = useCallback((type: ExerciseType) => {
    stateRef.current = freshState(type);
    setExType(type);
    setMetrics({ ...EMPTY, exerciseType: type });
  }, []);

  const startAnalysis = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = lmRef.current;
    if (!video || !canvas || !lm) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameRef.current = 0;
    setIsProcessing(true);

    const loop = (ts: number) => {
      if (video.paused || video.ended) { setIsProcessing(false); return; }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const res = lm.detectForVideo(video, ts);

      if (res.worldLandmarks?.[0] && res.landmarks?.[0]) {
        const wl: Landmark[]             = res.worldLandmarks[0];
        const nl: NormalizedLandmark[]   = res.landmarks[0];
        const s                          = stateRef.current;
        const exType                     = s.exType;

        // ── Primary angle ────────────────────────────────────────────
        let rawAngle = 180;
        if (exType === 'squat') {
          if (vis(nl,23)&&vis(nl,25)&&vis(nl,27)&&vis(nl,24)&&vis(nl,26)&&vis(nl,28)) {
            rawAngle = (angle3D(wl[23],wl[25],wl[27]) + angle3D(wl[24],wl[26],wl[28])) / 2;
          }
        } else if (exType === 'lunge') {
          if (vis(nl,23)&&vis(nl,25)&&vis(nl,27)&&vis(nl,24)&&vis(nl,26)&&vis(nl,28)) {
            rawAngle = Math.min(angle3D(wl[23],wl[25],wl[27]), angle3D(wl[24],wl[26],wl[28]));
          }
        } else { // hiphinge
          if (vis(nl,11)&&vis(nl,12)&&vis(nl,23)&&vis(nl,24)&&vis(nl,25)&&vis(nl,26)) {
            rawAngle = angle3D(mid3(wl[11],wl[12]), mid3(wl[23],wl[24]), mid3(wl[25],wl[26]));
          }
        }
        s.smoothAngle = ema(s.smoothAngle, rawAngle);
        const angle = s.smoothAngle;

        // ── Valgus (frontal view 2-D landmarks) ─────────────────────
        // leftValgus > 0  → left knee collapsed medially (valgus)
        // rightValgus > 0 → right knee collapsed medially (valgus)
        let rawVL = 0, rawVR = 0;
        if (exType !== 'hiphinge') {
          const hipW = nl[23].x - nl[24].x; // left hip x – right hip x (positive when frontal)
          if (Math.abs(hipW) > 0.05) {
            rawVL = (nl[27].x - nl[25].x) / hipW; // left ankle – left knee / hip width
            rawVR = (nl[26].x - nl[28].x) / hipW; // right knee – right ankle / hip width
          }
        }
        s.smoothVL = ema(s.smoothVL, rawVL);
        s.smoothVR = ema(s.smoothVR, rawVR);

        // ── Thresholds ───────────────────────────────────────────────
        const ENTER = exType === 'squat' ? SQ_ENTER : exType === 'lunge' ? LU_ENTER : HH_ENTER;
        const EXIT  = exType === 'squat' ? SQ_EXIT  : exType === 'lunge' ? LU_EXIT  : HH_EXIT;
        const DEPTH = exType === 'squat' ? SQ_DEPTH : exType === 'lunge' ? LU_DEPTH : HH_DEPTH;

        // ── State machine ────────────────────────────────────────────
        if (s.phase === 'up' && angle < ENTER) {
          s.phase        = 'down';
          s.minAngle     = angle;
          s.maxValgusL   = s.smoothVL;
          s.maxValgusR   = s.smoothVR;
          s.repStartTime = ts;
        } else if (s.phase === 'down') {
          if (angle < s.minAngle)       s.minAngle   = angle;
          if (s.smoothVL > s.maxValgusL) s.maxValgusL = s.smoothVL;
          if (s.smoothVR > s.maxValgusR) s.maxValgusR = s.smoothVR;

          if (angle > EXIT && s.minAngle <= DEPTH) {
            s.phase = 'up';
            s.repCount++;
            const depth =
              exType === 'squat'    ? classifySqDepth(s.minAngle)
            : exType === 'lunge'   ? classifyLuDepth(s.minAngle)
            :                        classifyHhDepth(s.minAngle);

            s.repHistory = [...s.repHistory.slice(-(HISTORY_CAP - 1)), {
              repNum:      s.repCount,
              peakAngle:   Math.round(s.minAngle),
              depth,
              leftValgus:  parseFloat(s.maxValgusL.toFixed(2)),
              rightValgus: parseFloat(s.maxValgusR.toFixed(2)),
              duration:    parseFloat(((ts - s.repStartTime) / 1000).toFixed(1)),
            }];
          }
        }

        // ── Angle trace ──────────────────────────────────────────────
        s.angleTrace = [...s.angleTrace.slice(-(TRACE_CAP - 1)), { t: ts / 1000, angle: Math.round(angle) }];

        // ── React sync ───────────────────────────────────────────────
        frameRef.current++;
        if (frameRef.current % SYNC_EVERY === 0) {
          const reps   = s.repHistory;
          const angles = reps.map(r => r.peakAngle);
          const avg    = angles.length ? angles.reduce((a, b) => a + b, 0) / angles.length : 180;
          const sd     = angles.length < 2 ? 0 : Math.sqrt(angles.reduce((a, v) => a + (v - avg) ** 2, 0) / angles.length);
          setMetrics({
            exerciseType: exType,
            repCount:        s.repCount,
            liveAngle:       Math.round(angle),
            liveLeftValgus:  parseFloat(s.smoothVL.toFixed(2)),
            liveRightValgus: parseFloat(s.smoothVR.toFixed(2)),
            avgDepth:        Math.round(avg),
            depthConsistency: parseFloat(sd.toFixed(1)),
            avgLeftValgus:   reps.length ? parseFloat((reps.reduce((a, r) => a + r.leftValgus, 0) / reps.length).toFixed(2)) : 0,
            avgRightValgus:  reps.length ? parseFloat((reps.reduce((a, r) => a + r.rightValgus, 0) / reps.length).toFixed(2)) : 0,
            repHistory:      reps,
            angleTrace:      s.angleTrace.slice(-100),
          });
        }

        // ── Draw skeleton ────────────────────────────────────────────
        drawSkeleton(ctx, nl, canvas.width, canvas.height, s.smoothVL, s.smoothVR);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopAnalysis = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setIsProcessing(false);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return { videoRef, canvasRef, metrics, isReady, isProcessing, exerciseType, setExerciseType, startAnalysis, stopAnalysis };
}
