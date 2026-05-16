// Pin to the exact installed package version to avoid silent wasm/api drift.
// To self-host: copy node_modules/@mediapipe/tasks-vision/wasm into public/mediapipe/wasm
// and place the model file at public/mediapipe/models/pose_landmarker_lite.task,
// then update these constants to the corresponding absolute public paths.
export const MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

export const MEDIAPIPE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
