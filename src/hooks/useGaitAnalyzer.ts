import { useRef, useState, useEffect, useCallback } from 'react';
import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';

const SYNC_EVERY = 6;   // flush ref → state every 6th detected frame
const HISTORY_CAP = 50; // max readings kept per side

interface KneeAngles {
  left: number[];
  right: number[];
}

export function useGaitAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [kneeAngles, setKneeAngles] = useState<KneeAngles>({ left: [], right: [] });

  // Refs keep landmarker and drawing utilities out of React state so the rAF
  // loop never reads stale closures and init never triggers extra re-renders.
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawRef = useRef<((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[]) => void) | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Mutable accumulator — written every detected frame, never causes re-renders on its own.
  const kneeAnglesRef = useRef<KneeAngles>({ left: [], right: [] });
  // Mirrors isProcessing so the rAF closure stays stable (no closure capture of state).
  const isProcessingRef = useRef(false);
  // Counts detected frames; a state flush fires every SYNC_EVERY increments.
  const frameCountRef = useRef(0);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    let cancelled = false;

    async function initPose() {
      try {
        // Dynamic import defers WASM parsing until after first paint and keeps
        // this module safe to evaluate in SSR environments where browser globals
        // (navigator, Worker, WebAssembly) do not exist.
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
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
        const landmarks = results.landmarks[0];
        drawRef.current?.(ctx, landmarks);

        // Left Hip: 23, Left Knee: 25, Left Ankle: 27
        // Right Hip: 24, Right Knee: 26, Right Ankle: 28
        const lHip = landmarks[23];
        const lKnee = landmarks[25];
        const lAnkle = landmarks[27];
        const rHip = landmarks[24];
        const rKnee = landmarks[26];
        const rAnkle = landmarks[28];

        if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
          const lAngle = calculateAngle(lHip, lKnee, lAnkle);
          const rAngle = calculateAngle(rHip, rKnee, rAnkle);

          // Mutate the ref in-place every frame — no allocation, no re-render.
          const acc = kneeAnglesRef.current;
          if (acc.left.length >= HISTORY_CAP) acc.left.shift();
          if (acc.right.length >= HISTORY_CAP) acc.right.shift();
          acc.left.push(lAngle);
          acc.right.push(rAngle);

          // Flush a snapshot to React state every SYNC_EVERY detected frames
          // so the chart re-renders at ~10fps instead of 60fps.
          frameCountRef.current++;
          if (frameCountRef.current % SYNC_EVERY === 0) {
            setKneeAngles({ left: [...acc.left], right: [...acc.right] });
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

  const startAnalysis = () => {
    if (videoRef.current) {
      kneeAnglesRef.current = { left: [], right: [] };
      frameCountRef.current = 0;
      videoRef.current.play();
      setIsProcessing(true);
    }
  };

  return {
    videoRef,
    canvasRef,
    isReady,
    isProcessing,
    kneeAngles,
    startAnalysis,
  };
}
