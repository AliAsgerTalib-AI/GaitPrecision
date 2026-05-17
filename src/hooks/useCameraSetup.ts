import { useRef, useState, useEffect } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_MODEL_PATH } from '@/src/lib/mediapipe-config';

export interface SetupChecks {
  legsVisible: boolean;   // all 6 key leg landmarks ≥ 0.6 visibility
  cameraLevel: boolean;   // shoulders within 6% of frame height of each other (lateral tilt)
  cameraHeight: boolean;  // hip midpoint between 35–70% of frame height
  distance: boolean;      // shoulder-to-ankle span is 40–85% of frame height
}

const INITIAL: SetupChecks = { legsVisible: false, cameraLevel: false, cameraHeight: false, distance: false };
const VIS = 0.6;

function evaluate(lm: NormalizedLandmark[]): SetupChecks {
  const ok = (l: NormalizedLandmark | undefined) => !!l && (l.visibility ?? 1) >= VIS;

  const legsVisible =
    ok(lm[23]) && ok(lm[25]) && ok(lm[27]) &&
    ok(lm[24]) && ok(lm[26]) && ok(lm[28]);

  const cameraLevel =
    ok(lm[11]) && ok(lm[12]) &&
    Math.abs(lm[11].y - lm[12].y) < 0.06;

  const hipY = ok(lm[23]) && ok(lm[24]) ? (lm[23].y + lm[24].y) / 2 : -1;
  const cameraHeight = hipY >= 0.35 && hipY <= 0.70;

  const shoulderY = ok(lm[11]) && ok(lm[12]) ? (lm[11].y + lm[12].y) / 2 : -1;
  const ankleY    = ok(lm[27]) && ok(lm[28]) ? (lm[27].y + lm[28].y) / 2 : -1;
  const bodyH     = shoulderY >= 0 && ankleY >= 0 ? ankleY - shoulderY : 0;
  const distance  = bodyH >= 0.40 && bodyH <= 0.85;

  return { legsVisible, cameraLevel, cameraHeight, distance };
}

export function useCameraSetup(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [isReady, setIsReady] = useState(false);
  const [checks, setChecks]   = useState<SetupChecks>(INITIAL);
  const lmRef  = useRef<import('@mediapipe/tasks-vision').PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastT  = useRef(-1);

  // Load MediaPipe once on mount; clean up on unmount.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (typeof window === 'undefined') return;
      try {
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) { lm.close(); return; }
        lmRef.current = lm;
        setIsReady(true);
      } catch (e) {
        console.error('useCameraSetup init failed:', e);
      }
    }
    init();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lmRef.current?.close();
      lmRef.current = null;
    };
  }, []);

  // Start / stop the detection loop whenever enabled changes.
  useEffect(() => {
    if (!isReady) return;
    if (!enabled) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setChecks(INITIAL);
      return;
    }

    function tick() {
      const video = videoRef.current;
      if (video && lmRef.current && video.readyState >= 2 && video.currentTime !== lastT.current) {
        lastT.current = video.currentTime;
        const result = lmRef.current.detectForVideo(video, performance.now());
        setChecks(result.landmarks?.length ? evaluate(result.landmarks[0]) : INITIAL);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    lastT.current = -1;
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [isReady, enabled, videoRef]);

  return { isReady, checks, allPassed: Object.values(checks).every(Boolean) };
}
