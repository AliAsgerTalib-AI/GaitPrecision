import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, Landmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

const EMA_ALPHA = 0.2;
const VIS = 0.5;
const SYNC_EVERY = 5;
const HISTORY_CAP = 50;
const MAX_RECENT = 8;

// ── Deadlift thresholds ─────────────────────────────────────────────────────
// Hip-hinge angle = angle at hip between torso vector and femur vector.
// Full lockout: ~175°. Bottom of a conventional deadlift: ~70–90°.
const DL_ENTER    = 140; // hip drops below → descent / hinge phase begins
const DL_LOCKOUT  = 158; // hip rises above → lockout counted (rep)
const DL_PEAK_MAX = 130; // hip must reach ≤ this (≥50° hinge) for a valid rep

// ── Overhead press thresholds ───────────────────────────────────────────────
// pressHeight = shoulderY - wristY in normalised screen coords (positive = wrist above shoulder).
const OHP_ENTER   = 0.05; // wrist rises 5 % above shoulder → pressing
const OHP_LOCKOUT = 0.12; // wrist 12 % above shoulder → overhead / lockout zone
const OHP_EXIT    = 0.02; // wrist returns to within 2 % of shoulder → rep done
// Elbow must reach ≥ this to count as a locked-out rep (full extension)
const OHP_LOCK_ELBOW = 155; // °

export type LiftType = 'deadlift' | 'ohp';

export interface LiftRepRecord {
  repNum:      number;
  // Deadlift fields
  minHipAngle?: number;  // deepest hip-hinge interior angle (°) — lower = more hinge
  backAngle?:   number;  // torso lean from vertical at bottom (°)
  // OHP fields
  leftElbow?:   number;  // elbow angle at peak (°)
  rightElbow?:  number;
  asymmetry?:   number;  // |left - right| at lockout (°)
  locked?:      boolean; // both elbows reached OHP_LOCK_ELBOW
}

export interface LiftMetrics {
  liftType: LiftType;
  repCount: number;
  // Deadlift live
  liveHipAngle:  number;
  liveBackAngle: number;
  avgMinHipAngle: number;
  avgBackAngle:   number;
  // OHP live
  liveLeftElbow:  number;
  liveRightElbow: number;
  liveAsymmetry:  number;
  pressHeight:    number; // normalised wrist-above-shoulder (for press gauge)
  avgAsymmetry:   number;
  lockoutReached: boolean; // current rep has entered lockout zone
  // Shared
  repHistory: LiftRepRecord[];
  angleTrace: number[];   // rolling sparkline (hip or avg-elbow depending on mode)
}

function midpoint3(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
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

function torsoLean(lm: NormalizedLandmark[]): number | null {
  const ok = (l: NormalizedLandmark) => (l.visibility ?? 1) >= VIS;
  if (!ok(lm[11]) || !ok(lm[12]) || !ok(lm[23]) || !ok(lm[24])) return null;
  const sx = (lm[11].x + lm[12].x) / 2, sy = (lm[11].y + lm[12].y) / 2;
  const hx = (lm[23].x + lm[24].x) / 2, hy = (lm[23].y + lm[24].y) / 2;
  return Math.atan2(Math.abs(sx - hx), Math.abs(hy - sy)) * 180 / Math.PI;
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

const EMPTY = (liftType: LiftType): LiftMetrics => ({
  liftType, repCount: 0,
  liveHipAngle: 175, liveBackAngle: 0, avgMinHipAngle: 0, avgBackAngle: 0,
  liveLeftElbow: 0, liveRightElbow: 0, liveAsymmetry: 0, pressHeight: 0, avgAsymmetry: 0,
  lockoutReached: false, repHistory: [], angleTrace: [],
});

export function useLiftAnalyzer() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady,      setIsReady]      = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liftType,     setLiftTypeState] = useState<LiftType>('deadlift');
  const [metrics,      setMetrics]      = useState<LiftMetrics>(EMPTY('deadlift'));

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef           = useRef<((ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[]) => void) | null>(null);
  const rafRef            = useRef<number | null>(null);
  const lastVideoTimeRef  = useRef(-1);
  const isProcessingRef   = useRef(false);
  const liftTypeRef       = useRef<LiftType>('deadlift');
  const frameCountRef     = useRef(0);

  // ── Deadlift state ────────────────────────────────────────────────────────
  const dlPhaseRef      = useRef<'top' | 'hinge'>('top');
  const dlMinHipRef     = useRef(180);
  const dlBackAtBotRef  = useRef<number[]>([]);
  const dlHipPeaksRef   = useRef<number[]>([]);
  const dlBackAvgsRef   = useRef<number[]>([]);

  // ── OHP state ────────────────────────────────────────────────────────────
  const ohpPhaseRef     = useRef<'rack' | 'pressing'>('rack');
  const ohpPeakPressRef = useRef(0);   // max pressHeight in current rep
  const ohpLeftAtPkRef  = useRef(0);   // left elbow at peak press
  const ohpRightAtPkRef = useRef(0);   // right elbow at peak press
  const ohpAsymmsRef    = useRef<number[]>([]);

  // ── Shared ────────────────────────────────────────────────────────────────
  const repHistoryRef   = useRef<LiftRepRecord[]>([]);
  const angleTraceRef   = useRef<number[]>([]);   // hip (DL) or avg-elbow (OHP)
  const emaHipRef       = useRef(NaN);
  const emaBackRef      = useRef(NaN);
  const emaLElbowRef    = useRef(NaN);
  const emaRElbowRef    = useRef(NaN);
  const emaPressRef     = useRef(NaN);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const setLiftType = useCallback((lt: LiftType) => {
    liftTypeRef.current = lt;
    setLiftTypeState(lt);
    // Reset all accumulators when switching lifts
    dlPhaseRef.current = 'top'; dlMinHipRef.current = 180; dlBackAtBotRef.current = []; dlHipPeaksRef.current = []; dlBackAvgsRef.current = [];
    ohpPhaseRef.current = 'rack'; ohpPeakPressRef.current = 0; ohpLeftAtPkRef.current = 0; ohpRightAtPkRef.current = 0; ohpAsymmsRef.current = [];
    repHistoryRef.current = []; angleTraceRef.current = [];
    emaHipRef.current = NaN; emaBackRef.current = NaN; emaLElbowRef.current = NaN; emaRElbowRef.current = NaN; emaPressRef.current = NaN;
    setMetrics(EMPTY(lt));
  }, []);

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
        console.error('LiftAnalyzer init failed:', err);
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
    const video = videoRef.current, canvas = canvasRef.current;
    if (!poseLandmarkerRef.current || !video || !canvas || !isProcessingRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length && results.worldLandmarks?.length) {
        const lm  = results.landmarks[0];
        const wlm = results.worldLandmarks[0];
        drawRef.current?.(ctx, lm);

        const ok = (l: NormalizedLandmark) => (l.visibility ?? 1) >= VIS;
        const lift = liftTypeRef.current;

        if (lift === 'deadlift') {
          // ── Hip hinge angle at midpoints ──────────────────────────────────
          const shoulderOk = ok(lm[11]) && ok(lm[12]) && ok(lm[23]) && ok(lm[24]) && ok(lm[25]) && ok(lm[26]);
          if (shoulderOk) {
            const sMid = midpoint3(wlm[11], wlm[12]);
            const hMid = midpoint3(wlm[23], wlm[24]);
            const kMid = midpoint3(wlm[25], wlm[26]);
            const rawHip = angle3D(sMid, hMid, kMid);
            emaHipRef.current = isNaN(emaHipRef.current) ? rawHip : EMA_ALPHA * rawHip + (1 - EMA_ALPHA) * emaHipRef.current;
            const hip = emaHipRef.current;

            const rawBack = torsoLean(lm);
            if (rawBack !== null) emaBackRef.current = isNaN(emaBackRef.current) ? rawBack : EMA_ALPHA * rawBack + (1 - EMA_ALPHA) * emaBackRef.current;
            const back = emaBackRef.current;

            // Sparkline
            if (angleTraceRef.current.length >= HISTORY_CAP) angleTraceRef.current.shift();
            angleTraceRef.current.push(hip);

            // Rep detection
            if (dlPhaseRef.current === 'top' && hip < DL_ENTER) {
              dlPhaseRef.current = 'hinge';
              dlMinHipRef.current = hip;
              dlBackAtBotRef.current = [];
            } else if (dlPhaseRef.current === 'hinge') {
              dlMinHipRef.current = Math.min(dlMinHipRef.current, hip);
              if (!isNaN(back) && hip < DL_ENTER) dlBackAtBotRef.current.push(back);
              if (hip > DL_LOCKOUT) {
                if (dlMinHipRef.current <= DL_PEAK_MAX) {
                  const repBack = avg(dlBackAtBotRef.current);
                  repHistoryRef.current.push({ repNum: repHistoryRef.current.length + 1, minHipAngle: dlMinHipRef.current, backAngle: repBack });
                  dlHipPeaksRef.current.push(dlMinHipRef.current); if (dlHipPeaksRef.current.length > MAX_RECENT) dlHipPeaksRef.current.shift();
                  if (!isNaN(repBack)) { dlBackAvgsRef.current.push(repBack); if (dlBackAvgsRef.current.length > MAX_RECENT) dlBackAvgsRef.current.shift(); }
                }
                dlPhaseRef.current = 'top'; dlMinHipRef.current = 180; dlBackAtBotRef.current = [];
              }
            }

            frameCountRef.current++;
            if (frameCountRef.current % SYNC_EVERY === 0) {
              const allPeaks = repHistoryRef.current.map(r => r.minHipAngle ?? 180);
              setMetrics(m => ({
                ...m, liftType: 'deadlift',
                repCount:       repHistoryRef.current.length,
                liveHipAngle:   hip,
                liveBackAngle:  isNaN(back) ? 0 : back,
                avgMinHipAngle: avg(allPeaks),
                avgBackAngle:   avg(dlBackAvgsRef.current),
                repHistory:     [...repHistoryRef.current],
                angleTrace:     [...angleTraceRef.current],
              }));
            }
          }

        } else {
          // ── Overhead press ─────────────────────────────────────────────
          const elbowOk = ok(lm[11]) && ok(lm[13]) && ok(lm[15]) && ok(lm[12]) && ok(lm[14]) && ok(lm[16]);
          const wristOk = ok(lm[15]) && ok(lm[16]) && ok(lm[11]) && ok(lm[12]);
          if (elbowOk && wristOk) {
            const rawL = angle3D(wlm[11], wlm[13], wlm[15]);
            const rawR = angle3D(wlm[12], wlm[14], wlm[16]);
            emaLElbowRef.current = isNaN(emaLElbowRef.current) ? rawL : EMA_ALPHA * rawL + (1 - EMA_ALPHA) * emaLElbowRef.current;
            emaRElbowRef.current = isNaN(emaRElbowRef.current) ? rawR : EMA_ALPHA * rawR + (1 - EMA_ALPHA) * emaRElbowRef.current;
            const lE = emaLElbowRef.current, rE = emaRElbowRef.current;

            // Press height: wrist above shoulder (normalized, positive = above)
            const shoulderY = (lm[11].y + lm[12].y) / 2;
            const wristY    = (lm[15].y + lm[16].y) / 2;
            const rawPress  = shoulderY - wristY;
            emaPressRef.current = isNaN(emaPressRef.current) ? rawPress : EMA_ALPHA * rawPress + (1 - EMA_ALPHA) * emaPressRef.current;
            const press = emaPressRef.current;

            // Sparkline (avg elbow)
            if (angleTraceRef.current.length >= HISTORY_CAP) angleTraceRef.current.shift();
            angleTraceRef.current.push((lE + rE) / 2);

            // Rep detection
            if (ohpPhaseRef.current === 'rack' && press > OHP_ENTER) {
              ohpPhaseRef.current = 'pressing';
              ohpPeakPressRef.current = press;
              ohpLeftAtPkRef.current  = lE;
              ohpRightAtPkRef.current = rE;
            } else if (ohpPhaseRef.current === 'pressing') {
              if (press > ohpPeakPressRef.current) {
                ohpPeakPressRef.current = press;
                ohpLeftAtPkRef.current  = lE;
                ohpRightAtPkRef.current = rE;
              }
              if (press < OHP_EXIT) {
                if (ohpPeakPressRef.current >= OHP_LOCKOUT) {
                  const lPk = ohpLeftAtPkRef.current, rPk = ohpRightAtPkRef.current;
                  const asym = Math.abs(lPk - rPk);
                  repHistoryRef.current.push({
                    repNum: repHistoryRef.current.length + 1,
                    leftElbow: lPk, rightElbow: rPk, asymmetry: asym,
                    locked: lPk >= OHP_LOCK_ELBOW && rPk >= OHP_LOCK_ELBOW,
                  });
                  ohpAsymmsRef.current.push(asym);
                  if (ohpAsymmsRef.current.length > MAX_RECENT) ohpAsymmsRef.current.shift();
                }
                ohpPhaseRef.current = 'rack'; ohpPeakPressRef.current = 0;
              }
            }

            const inLockout = ohpPhaseRef.current === 'pressing' && ohpPeakPressRef.current >= OHP_LOCKOUT;
            frameCountRef.current++;
            if (frameCountRef.current % SYNC_EVERY === 0) {
              setMetrics(m => ({
                ...m, liftType: 'ohp',
                repCount:       repHistoryRef.current.length,
                liveLeftElbow:  lE,
                liveRightElbow: rE,
                liveAsymmetry:  Math.abs(lE - rE),
                pressHeight:    Math.max(0, press),
                avgAsymmetry:   avg(ohpAsymmsRef.current),
                lockoutReached: inLockout,
                repHistory:     [...repHistoryRef.current],
                angleTrace:     [...angleTraceRef.current],
              }));
            }
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
    dlPhaseRef.current = 'top'; dlMinHipRef.current = 180; dlBackAtBotRef.current = []; dlHipPeaksRef.current = []; dlBackAvgsRef.current = [];
    ohpPhaseRef.current = 'rack'; ohpPeakPressRef.current = 0; ohpLeftAtPkRef.current = 0; ohpRightAtPkRef.current = 0; ohpAsymmsRef.current = [];
    repHistoryRef.current = []; angleTraceRef.current = [];
    emaHipRef.current = NaN; emaBackRef.current = NaN; emaLElbowRef.current = NaN; emaRElbowRef.current = NaN; emaPressRef.current = NaN;
    frameCountRef.current = 0; lastVideoTimeRef.current = -1;
    setMetrics(EMPTY(liftTypeRef.current));
    if (video.paused) video.play();
    isProcessingRef.current = true;
    setIsProcessing(true);
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  return { videoRef, canvasRef, isReady, isProcessing, liftType, setLiftType, metrics, startAnalysis };
}
