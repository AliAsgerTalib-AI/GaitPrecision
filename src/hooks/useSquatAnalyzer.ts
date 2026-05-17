import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, Landmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

const EMA_ALPHA = 0.2;
const VISIBILITY_THRESHOLD = 0.6;
const SYNC_EVERY = 5;
const HISTORY_CAP = 50;
const MAX_RECENT = 8;

// Interior knee angle thresholds for squat rep detection.
// Standing naturally: ~165–175°. Starting a squat: knee drops below SQUAT_ENTER.
// Rep is counted when the knee returns above SQUAT_EXIT and peak ≤ REP_DEPTH_MAX.
const SQUAT_ENTER     = 148; // ° — entering descent phase (≥32° of knee flexion)
const SQUAT_EXIT      = 155; // ° — returning to standing (≤25° flexion)
const REP_DEPTH_MAX   = 130; // ° — minimum depth to count a rep (≥50° flexion)

export type SquatDepth = 'partial' | 'parallel' | 'deep';

function classifyDepth(angle: number): SquatDepth {
  if (angle <= 82) return 'deep';      // ≥98° of knee flexion (past parallel)
  if (angle <= 98) return 'parallel';  // 82–98° of flexion ≈ thighs roughly horizontal
  return 'partial';                    // <82° of flexion — above parallel
}

export interface RepRecord {
  repNum: number;
  peakAngle: number;      // interior knee angle at deepest point (°)
  depth: SquatDepth;
  backAngle: number;      // torso lean from vertical at bottom (°)
  duration: number;       // total rep time (s)
}

export interface SquatMetrics {
  repCount: number;
  avgDepth: number;          // mean peak interior angle across all reps (°)
  depthConsistency: number;  // SD of peak angles (°) — lower = more consistent
  avgBackAngle: number;      // mean torso lean across reps (°)
  liveBackAngle: number;     // current frame torso lean (°)
  liveKneeAngle: number;     // current smoothed bilateral average (°)
  repHistory: RepRecord[];
  kneeAngles: number[];      // rolling sparkline buffer (bilateral average)
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
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

// Torso lean from vertical using 2D normalized landmarks (screen-space).
// Uses shoulder midpoint → hip midpoint. Returns 0° = vertical, 90° = horizontal.
function torsoLean(lm: NormalizedLandmark[]): number | null {
  const s11 = lm[11], s12 = lm[12], h23 = lm[23], h24 = lm[24];
  const vis = (l: NormalizedLandmark) => (l.visibility ?? 1) >= VISIBILITY_THRESHOLD;
  if (!vis(s11) || !vis(s12) || !vis(h23) || !vis(h24)) return null;
  const sx = (s11.x + s12.x) / 2;
  const sy = (s11.y + s12.y) / 2;
  const hx = (h23.x + h24.x) / 2;
  const hy = (h23.y + h24.y) / 2;
  // dy is negative when shoulder is above hip in screen coords (Y grows down).
  // We want the angle from vertical: atan2(|horizontal offset|, |vertical offset|).
  const dx = Math.abs(sx - hx);
  const dy = Math.abs(hy - sy); // positive: hip is lower than shoulder
  return (dy === 0) ? 90 : Math.atan2(dx, dy) * 180 / Math.PI;
}

const EMPTY: SquatMetrics = {
  repCount: 0, avgDepth: 0, depthConsistency: 0,
  avgBackAngle: 0, liveBackAngle: 0, liveKneeAngle: 170,
  repHistory: [], kneeAngles: [],
};

export function useSquatAnalyzer() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady,      setIsReady]      = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [metrics,      setMetrics]      = useState<SquatMetrics>(EMPTY);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef           = useRef<((ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[]) => void) | null>(null);
  const rafRef            = useRef<number | null>(null);
  const lastVideoTimeRef  = useRef(-1);
  const isProcessingRef   = useRef(false);
  const frameCountRef     = useRef(0);

  // Rep detection state
  const phaseRef       = useRef<'up' | 'down'>('up');
  const minAngleRef    = useRef(180);
  const downStartRef   = useRef(-1);
  const backAtBottomRef = useRef<number[]>([]); // back angles sampled during descent

  // Accumulators
  const repHistoryRef  = useRef<RepRecord[]>([]);
  const peakAnglesRef  = useRef<number[]>([]); // for SD computation
  const backAnglesRef  = useRef<number[]>([]);  // for avg back angle across reps

  // Smoothing
  const emaKneeRef    = useRef(NaN);
  const emaBackRef    = useRef(NaN);
  const kneeAnglesRef = useRef<number[]>([]); // rolling sparkline

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
        console.error('SquatAnalyzer init failed:', err);
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

        // Bilateral knee: average left (23-25-27) and right (24-26-28) for a single squat signal.
        const lOk = vis(lm[23]) && vis(lm[25]) && vis(lm[27]);
        const rOk = vis(lm[24]) && vis(lm[26]) && vis(lm[28]);

        if (lOk || rOk) {
          const lAngle = lOk ? angle3D(wlm[23], wlm[25], wlm[27]) : 0;
          const rAngle = rOk ? angle3D(wlm[24], wlm[26], wlm[28]) : 0;
          const raw = lOk && rOk ? (lAngle + rAngle) / 2 : lOk ? lAngle : rAngle;

          emaKneeRef.current = isNaN(emaKneeRef.current) ? raw : EMA_ALPHA * raw + (1 - EMA_ALPHA) * emaKneeRef.current;
          const knee = emaKneeRef.current;

          if (kneeAnglesRef.current.length >= HISTORY_CAP) kneeAnglesRef.current.shift();
          kneeAnglesRef.current.push(knee);

          // Back angle
          const rawBack = torsoLean(lm);
          if (rawBack !== null) {
            emaBackRef.current = isNaN(emaBackRef.current) ? rawBack : EMA_ALPHA * rawBack + (1 - EMA_ALPHA) * emaBackRef.current;
          }
          const back = emaBackRef.current;

          // ── Rep detection state machine ────────────────────────────────
          if (phaseRef.current === 'up' && knee < SQUAT_ENTER) {
            phaseRef.current  = 'down';
            minAngleRef.current = knee;
            downStartRef.current = t;
            backAtBottomRef.current = [];
          } else if (phaseRef.current === 'down') {
            if (knee < minAngleRef.current) minAngleRef.current = knee;

            // Sample back angle near the bottom half of the rep
            if (knee < SQUAT_ENTER - 10 && !isNaN(back)) {
              backAtBottomRef.current.push(back);
            }

            if (knee > SQUAT_EXIT) {
              const duration = t - downStartRef.current;
              const peak = minAngleRef.current;

              if (peak <= REP_DEPTH_MAX && duration >= 0.5 && duration <= 15) {
                const repBack = avg(backAtBottomRef.current);
                const rep: RepRecord = {
                  repNum:    repHistoryRef.current.length + 1,
                  peakAngle: peak,
                  depth:     classifyDepth(peak),
                  backAngle: repBack,
                  duration,
                };
                repHistoryRef.current.push(rep);
                peakAnglesRef.current.push(peak);
                if (peakAnglesRef.current.length > MAX_RECENT) peakAnglesRef.current.shift();
                if (!isNaN(repBack)) {
                  backAnglesRef.current.push(repBack);
                  if (backAnglesRef.current.length > MAX_RECENT) backAnglesRef.current.shift();
                }
              }
              phaseRef.current = 'up';
            }
          }

          frameCountRef.current++;
          if (frameCountRef.current % SYNC_EVERY === 0) {
            const allPeaks = repHistoryRef.current.map(r => r.peakAngle);
            setMetrics({
              repCount:           repHistoryRef.current.length,
              avgDepth:           avg(allPeaks),
              depthConsistency:   stdDev(allPeaks),
              avgBackAngle:       avg(backAnglesRef.current),
              liveBackAngle:      isNaN(back) ? 0 : back,
              liveKneeAngle:      knee,
              repHistory:         [...repHistoryRef.current],
              kneeAngles:         [...kneeAnglesRef.current],
            });
          }
        }
      }
    }

    if (video.ended || video.paused) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  const startAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!poseLandmarkerRef.current || !video) return;

    phaseRef.current         = 'up';
    minAngleRef.current      = 180;
    downStartRef.current     = -1;
    backAtBottomRef.current  = [];
    repHistoryRef.current    = [];
    peakAnglesRef.current    = [];
    backAnglesRef.current    = [];
    emaKneeRef.current       = NaN;
    emaBackRef.current       = NaN;
    kneeAnglesRef.current    = [];
    frameCountRef.current    = 0;
    lastVideoTimeRef.current = -1;
    setMetrics(EMPTY);

    if (video.paused) video.play();
    isProcessingRef.current = true;
    setIsProcessing(true);
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  return { videoRef, canvasRef, isReady, isProcessing, metrics, startAnalysis };
}
