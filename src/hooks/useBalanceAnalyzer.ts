import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

const EMA_ALPHA = 0.25;
const VISIBILITY_THRESHOLD = 0.5;
const SYNC_EVERY = 4;
const SWAY_WINDOW = 90;   // rolling window for SD (~1.5 s worth of readings at ~60 fps / 4 sync)
const SERIES_CAP = 400;

export type BalanceLeg = 'left' | 'right';

export interface SwayPoint {
  t: number;   // video time (s)
  x: number;   // smoothed, normalized hip X position
}

export interface BalanceMetrics {
  swayAmplitude: number;   // SD of hip X in the rolling window (normalized 0–1)
  holdDuration: number;    // seconds since analysis started
  balanceScore: number;    // 0–100
  swaySeries: SwayPoint[]; // full trace for the chart
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

// Clinical mapping: SD ≤ 0 = 100, SD ≥ 0.055 = 0, linear between.
// At a typical 2 m recording distance an SD of 0.055 ≈ ~11 cm of sway — clearly impaired.
function scoreFromSway(sd: number): number {
  return Math.max(0, Math.min(100, Math.round((0.055 - sd) / 0.055 * 100)));
}

const EMPTY_METRICS: BalanceMetrics = {
  swayAmplitude: 0,
  holdDuration: 0,
  balanceScore: 100,
  swaySeries: [],
};

export function useBalanceAnalyzer() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady,      setIsReady]      = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeLeg,    setActiveLegState] = useState<BalanceLeg>('left');
  const [metrics,      setMetrics]      = useState<BalanceMetrics>(EMPTY_METRICS);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef           = useRef<((ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[]) => void) | null>(null);
  const rafRef            = useRef<number | null>(null);
  const lastVideoTimeRef  = useRef(-1);
  const isProcessingRef   = useRef(false);
  const activeLegRef      = useRef<BalanceLeg>('left');
  const frameCountRef     = useRef(0);
  const startTimeRef      = useRef(0);
  const hipXWindowRef     = useRef<number[]>([]);
  const emaXRef           = useRef(NaN);
  const swaySeriesRef     = useRef<SwayPoint[]>([]);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const setActiveLeg = useCallback((leg: BalanceLeg) => {
    activeLegRef.current = leg;
    setActiveLegState(leg);
    hipXWindowRef.current = [];
    emaXRef.current = NaN;
    swaySeriesRef.current = [];
    setMetrics(EMPTY_METRICS);
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
        console.error('BalanceAnalyzer init failed:', err);
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

      const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length) {
        const lm = results.landmarks[0];
        drawRef.current?.(ctx, lm);

        // 23 = left hip, 24 = right hip
        const hip = lm[activeLegRef.current === 'left' ? 23 : 24];

        if (hip && (hip.visibility ?? 1) >= VISIBILITY_THRESHOLD) {
          emaXRef.current = isNaN(emaXRef.current)
            ? hip.x
            : EMA_ALPHA * hip.x + (1 - EMA_ALPHA) * emaXRef.current;

          hipXWindowRef.current.push(emaXRef.current);
          if (hipXWindowRef.current.length > SWAY_WINDOW) hipXWindowRef.current.shift();

          swaySeriesRef.current.push({ t: video.currentTime, x: emaXRef.current });
          if (swaySeriesRef.current.length > SERIES_CAP) swaySeriesRef.current.shift();

          frameCountRef.current++;
          if (frameCountRef.current % SYNC_EVERY === 0) {
            const sd = stdDev(hipXWindowRef.current);
            setMetrics({
              swayAmplitude: sd,
              holdDuration: Math.max(0, video.currentTime - startTimeRef.current),
              balanceScore: scoreFromSway(sd),
              swaySeries: [...swaySeriesRef.current],
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

    hipXWindowRef.current = [];
    emaXRef.current = NaN;
    swaySeriesRef.current = [];
    frameCountRef.current = 0;
    lastVideoTimeRef.current = -1;
    startTimeRef.current = video.currentTime;
    setMetrics(EMPTY_METRICS);

    if (video.paused) video.play();
    isProcessingRef.current = true;
    setIsProcessing(true);
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  return { videoRef, canvasRef, isReady, isProcessing, activeLeg, setActiveLeg, metrics, startAnalysis };
}
