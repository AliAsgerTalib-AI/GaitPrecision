// Module-level singleton — written by useGaitAnalyzer on every detected frame,
// read by Gait3D's useFrame loop. Pure mutation: no React state, no subscriptions,
// no re-render overhead on the hot rAF path.
export interface StoredLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

let _lm: readonly StoredLandmark[] | null = null;

export const poseStore = {
  write: (lm: readonly StoredLandmark[] | null) => { _lm = lm; },
  read:  (): readonly StoredLandmark[] | null   => _lm,
};
