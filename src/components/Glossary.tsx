import { useState, useMemo } from "react";
import { Search, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface Term {
  term: string;
  category: string;
  definition: string;
  why: string;
  related?: string[];
}

const TERMS: Term[] = [
  // ── GAIT ANALYSIS & BIOMECHANICS ──────────────────────────────────────────
  {
    term: "Gait",
    category: "Biomechanics",
    definition:
      "The pattern and style of a person's walking or running. It encompasses the coordinated sequence of limb movements that propel the body forward while maintaining balance.",
    why: "GaitPrecision's core purpose is to quantify and assess gait quality, making this the foundational concept the entire application is built around.",
  },
  {
    term: "Gait Cycle",
    category: "Biomechanics",
    definition:
      "One complete sequence of locomotion — from the moment one foot contacts the ground (heel strike) to the next time that same foot contacts the ground. It is divided into two phases: Stance and Swing.",
    why: "All temporal gait metrics (cadence, stride time, stance %) are computed per gait cycle. Segmenting video into cycles allows the app to track changes across repetitions.",
    related: ["Stance Phase", "Swing Phase", "Heel Strike", "Toe-Off", "Stride"],
  },
  {
    term: "Stance Phase",
    category: "Biomechanics",
    definition:
      "The portion of the gait cycle during which the foot is in contact with the ground. In normal walking this accounts for roughly 60–62% of the cycle, beginning at heel strike and ending at toe-off.",
    why: "Stance percentage is a key indicator of gait health. Deviations from the expected 62% can signal pain-avoidance patterns, weakness, or neurological conditions.",
    related: ["Swing Phase", "Heel Strike", "Toe-Off"],
  },
  {
    term: "Swing Phase",
    category: "Biomechanics",
    definition:
      "The portion of the gait cycle during which the foot is off the ground and swinging forward, accounting for approximately 38–40% of the cycle.",
    why: "Swing phase data complements stance data. Together they reveal gait asymmetry between the left and right limbs.",
    related: ["Stance Phase", "Toe-Off"],
  },
  {
    term: "Heel Strike",
    category: "Biomechanics",
    definition:
      "The moment the heel contacts the ground, marking the beginning of the stance phase. GaitPrecision detects heel strikes by watching for the knee angle to rise above 155°.",
    why: "Heel strike detection is the primary event used to segment video into discrete gait cycles, enabling all per-stride metrics to be calculated.",
    related: ["Gait Cycle", "Stance Phase", "Knee Flexion"],
  },
  {
    term: "Toe-Off",
    category: "Biomechanics",
    definition:
      "The moment the toes leave the ground, marking the end of stance and start of swing. Detected when the knee angle drops below 140°.",
    why: "Toe-off events complete the gait cycle boundary detection. When toe-off cannot be reliably detected, stance % falls back to the population default of 62%.",
    related: ["Gait Cycle", "Swing Phase", "Knee Flexion"],
  },
  {
    term: "Stride",
    category: "Biomechanics",
    definition:
      "A complete gait cycle — from heel strike of one foot to the next heel strike of the same foot. A stride contains two steps (left + right).",
    why: "Stride-level metrics (time, length, symmetry) provide a normalized basis for comparison between sessions and individuals.",
    related: ["Gait Cycle", "Cadence", "Stride Time"],
  },
  {
    term: "Cadence",
    category: "Biomechanics",
    definition:
      "The number of steps taken per minute (spm). Normal adult walking cadence is approximately 100–120 spm. It is computed from the interval between consecutive heel strikes.",
    why: "Cadence is one of the most sensitive and clinically relevant gait parameters. Changes in cadence can indicate fatigue, pain, or neurological impairment.",
    related: ["Heel Strike", "Stride"],
  },
  {
    term: "Stride Time",
    category: "Biomechanics",
    definition:
      "The elapsed time (in seconds) for one complete gait cycle, from one heel strike to the next heel strike of the same foot.",
    why: "Stride time variability is strongly correlated with fall risk in older adults. Tracking it over multiple strides reveals consistency of movement.",
    related: ["Stride", "Cadence"],
  },
  {
    term: "Knee Flexion",
    category: "Biomechanics",
    definition:
      "The bending of the knee joint, measured as the angle (in degrees) between the thigh and the lower leg. 0° is fully extended; higher values indicate more bend.",
    why: "Knee flexion is the primary biomechanical signal GaitPrecision measures. It drives gait cycle detection, symmetry analysis, and clinical scoring.",
    related: ["Range of Motion", "Symmetry Index", "Heel Strike"],
  },
  {
    term: "Hip Angle",
    category: "Biomechanics",
    definition:
      "The angle at the hip joint, computed from three landmarks: the opposite hip, this hip, and this knee. It reflects hip flexion and extension throughout the gait cycle.",
    why: "Hip angle data complements knee data. Abnormal hip-knee coordination can indicate conditions like hip arthritis or compensatory gait patterns.",
    related: ["Knee Flexion", "Landmarks"],
  },
  {
    term: "Ankle Angle",
    category: "Biomechanics",
    definition:
      "The angle at the ankle joint, computed from three landmarks: the knee, ankle, and foot index. A neutral ankle is approximately 90° (plantar-flexed or dorsi-flexed angles deviate from this).",
    why: "Ankle mechanics are critical for push-off power and shock absorption. Ankle stiffness or instability affects the entire kinematic chain upward.",
    related: ["Knee Flexion", "Landmarks"],
  },
  {
    term: "Range of Motion (ROM)",
    category: "Biomechanics",
    definition:
      "The full arc of movement through which a joint can move, measured in degrees. For the knee during normal walking, ROM is roughly 0–60°.",
    why: "Reduced ROM indicates stiffness or pain-avoidance. GaitPrecision tracks each joint's angular excursion across the session to quantify ROM.",
    related: ["Knee Flexion", "Hip Angle", "Ankle Angle"],
  },
  {
    term: "Symmetry Index",
    category: "Biomechanics",
    definition:
      "A metric (0–100%) expressing how similar the left and right sides of the body move. Computed from the absolute difference in knee flexion angles between left and right legs. Perfect symmetry = 100%; values below 85% suggest clinically significant asymmetry.",
    why: "Gait asymmetry is a hallmark of injury, neurological conditions, and compensatory loading. Tracking symmetry over time is a key rehabilitation metric.",
    related: ["Knee Flexion", "Asymmetry Violation"],
  },
  {
    term: "Asymmetry Violation",
    category: "Biomechanics",
    definition:
      "An alert triggered when the bilateral knee flexion difference exceeds 15°, indicating that one side of the body is bearing load or moving significantly differently from the other.",
    why: "A 15° threshold is used because it is the minimum clinically detectable asymmetry associated with compensatory gait. Violations surface as live warnings during analysis.",
    related: ["Symmetry Index", "Knee Flexion"],
  },
  {
    term: "Knee Valgus",
    category: "Biomechanics",
    definition:
      "An inward collapse of the knee joint (also called 'knock-knee'), where the knee caves medially during weight-bearing. It is a risk factor for ACL injury and patellofemoral pain.",
    why: "During squats and exercise analysis, detecting valgus moments is important for injury-prevention feedback.",
  },
  {
    term: "Sway Analysis",
    category: "Biomechanics",
    definition:
      "Measurement of postural oscillations — the lateral and anterior-posterior movements of the body's center of mass while standing. Larger sway indicates poorer balance control.",
    why: "In Balance mode, sway quantification replaces stride cycle analysis. It provides a window into neuromuscular stability and fall risk.",
    related: ["Stability Score"],
  },
  {
    term: "Stability Score",
    category: "Biomechanics",
    definition:
      "A 0–100 composite score derived from sway magnitude, velocity, and frequency during the Balance activity mode. Higher scores indicate greater postural stability.",
    why: "A single actionable number makes balance feedback accessible to non-specialists and allows quick session-to-session comparison.",
    related: ["Sway Analysis"],
  },

  // ── POSE ESTIMATION ───────────────────────────────────────────────────────
  {
    term: "Pose Estimation",
    category: "Pose Estimation",
    definition:
      "A computer vision technique that detects and localizes a person's body joints (keypoints) in an image or video frame. GaitPrecision uses MediaPipe Pose, which detects 33 landmarks.",
    why: "Pose estimation replaces wearable sensors and force plates, enabling markerless, in-the-wild gait analysis from a standard camera.",
    related: ["MediaPipe", "Landmarks", "Keypoints"],
  },
  {
    term: "MediaPipe",
    category: "Pose Estimation",
    definition:
      "Google's open-source, cross-platform framework for real-time perception pipelines. GaitPrecision uses the `@mediapipe/tasks-vision` package and its PoseLandmarker model, which runs in VIDEO mode on the GPU.",
    why: "MediaPipe delivers state-of-the-art pose quality while running entirely in the browser via WebAssembly, requiring no server-side processing.",
    related: ["Pose Estimation", "Landmarks", "WebAssembly"],
  },
  {
    term: "PoseLandmarker",
    category: "Pose Estimation",
    definition:
      "The specific MediaPipe task used by GaitPrecision. It accepts a video frame and returns 33 normalized and 3D world landmark positions for each detected person.",
    why: "PoseLandmarker is optimized for VIDEO mode, enabling the app to process every frame of a recorded or live video feed with temporal consistency.",
    related: ["MediaPipe", "Landmarks", "World Landmarks"],
  },
  {
    term: "Landmarks",
    category: "Pose Estimation",
    definition:
      "The 33 anatomical keypoints detected by MediaPipe on a human body, each identified by a numeric index (0 = nose, 11–12 = shoulders, 23–24 = hips, 25–26 = knees, 27–28 = ankles, 31–32 = foot indices, etc.). Each landmark has x, y, z coordinates and a visibility score.",
    why: "Landmarks are the raw data from which all biomechanical angles and gait events are derived. The app uses landmarks 23–28 for the lower-limb analysis pipeline.",
    related: ["Normalized Landmarks", "World Landmarks", "Visibility"],
  },
  {
    term: "Keypoints",
    category: "Pose Estimation",
    definition:
      "A synonym for landmarks — the specific joint positions detected by a pose estimation model. Often used interchangeably in the ML/computer vision literature.",
    why: "The term 'keypoints' appears in MediaPipe documentation and academic literature. Understanding it as equivalent to 'landmarks' helps users cross-reference external resources.",
    related: ["Landmarks"],
  },
  {
    term: "Normalized Landmarks",
    category: "Pose Estimation",
    definition:
      "Landmark coordinates expressed as fractions of the image width and height (range 0–1). For example, a point at the center of a 1920×1080 frame would have x=0.5, y=0.5.",
    why: "Normalized coordinates are used to project landmarks onto the canvas overlay, regardless of the actual pixel dimensions of the video.",
    related: ["Landmarks", "World Landmarks"],
  },
  {
    term: "World Landmarks",
    category: "Pose Estimation",
    definition:
      "Landmark coordinates expressed in metric 3D space (meters), with the pelvis as the origin. Unlike normalized landmarks, world landmarks preserve real-world scale and depth.",
    why: "World landmarks enable the 3D skeleton visualization in Gait3D.tsx and allow depth-aware biomechanical calculations that normalized 2D coordinates cannot support.",
    related: ["Landmarks", "Normalized Landmarks"],
  },
  {
    term: "Visibility",
    category: "Pose Estimation",
    definition:
      "A per-landmark confidence score (0–1) indicating how likely MediaPipe believes the landmark is present and correctly detected in the frame. GaitPrecision filters out landmarks with visibility below 0.6.",
    why: "Low-visibility landmarks can be occluded or outside the camera frame. Using a 0.6 threshold prevents noisy or guessed landmark positions from corrupting angle calculations.",
    related: ["Landmarks", "Confidence"],
  },
  {
    term: "Skeletal Overlay",
    category: "Pose Estimation",
    definition:
      "The real-time visualization drawn on a `<canvas>` element layered over the video — consisting of colored dots (landmarks) connected by lines (pose connections) forming a stick figure.",
    why: "The overlay gives immediate visual feedback that the pose model is tracking correctly, helping users reposition themselves if limbs are out of frame.",
    related: ["Landmarks", "Pose Connections"],
  },
  {
    term: "Pose Connections",
    category: "Pose Estimation",
    definition:
      "The predefined set of pairs of landmark indices that, when connected by lines, form a recognizable human skeleton. MediaPipe provides `POSE_CONNECTIONS` as a standard set.",
    why: "Drawing connections rather than just dots makes the skeletal overlay immediately interpretable and lets users see which body parts the model has localized.",
    related: ["Skeletal Overlay", "Landmarks"],
  },

  // ── SIGNAL PROCESSING & ALGORITHMS ───────────────────────────────────────
  {
    term: "EMA (Exponential Moving Average)",
    category: "Signal Processing",
    definition:
      "A smoothing technique that gives more weight to recent values in a time series. The smoothed value S_t = α × x_t + (1−α) × S_{t−1}, where α (alpha) controls how quickly the average responds to new data.",
    why: "Raw pose landmark coordinates contain jitter from frame to frame. EMA removes this noise before angles are computed, preventing false gait events from being triggered by sensor noise rather than real movement.",
    related: ["Sensitivity", "Knee Flexion"],
  },
  {
    term: "Alpha (α)",
    category: "Signal Processing",
    definition:
      "The smoothing factor in EMA, ranging from 0 (maximum smoothing, very slow response) to 1 (no smoothing, raw signal). GaitPrecision maps the user-facing Sensitivity slider (0–100) to α values of 0.05–0.45.",
    why: "Exposing alpha as a 'Sensitivity' control lets users balance responsiveness vs. noise reduction based on their camera quality and recording distance.",
    related: ["EMA", "Sensitivity"],
  },
  {
    term: "Sensitivity",
    category: "Signal Processing",
    definition:
      "A user-adjustable parameter (0–100) that controls the EMA smoothing factor applied to landmark positions. Lower sensitivity = more smoothing = less jitter but slower event detection. Higher sensitivity = less smoothing = faster but noisier signals.",
    why: "Different recording environments have different noise levels. A sensitivity knob lets clinicians and researchers tune the pipeline to their specific setup.",
    related: ["EMA", "Alpha"],
  },
  {
    term: "LERP (Linear Interpolation)",
    category: "Signal Processing",
    definition:
      "A mathematical operation that finds a point a fraction `t` of the way between two values: `result = a + t × (b − a)`. GaitPrecision uses LERP with t=0.15 to smoothly animate the 3D skeleton toward target pose positions.",
    why: "LERP prevents the 3D skeleton from snapping between frames. It creates visually fluid motion even when pose updates arrive at irregular intervals.",
    related: ["World Landmarks"],
  },
  {
    term: "Threshold",
    category: "Signal Processing",
    definition:
      "A fixed boundary value used to classify a continuous signal into discrete events. GaitPrecision uses a 155° threshold for heel strikes and a 140° threshold for toe-off events.",
    why: "Gait event detection requires translating smooth angle curves into discrete timing events. Thresholds are tuned to match the typical knee angles at clinically defined gait events.",
    related: ["Heel Strike", "Toe-Off", "Knee Flexion"],
  },
  {
    term: "Confidence Score",
    category: "Signal Processing",
    definition:
      "A 0–100 numeric value representing how reliable the analysis result is, based on landmark visibility, frame count, and event detection consistency during the session.",
    why: "Analysis quality varies with camera angle, lighting, and clothing. Surfacing confidence prevents users from drawing conclusions from poor-quality data.",
    related: ["Visibility", "Engine Confidence"],
  },
  {
    term: "Engine Confidence",
    category: "Signal Processing",
    definition:
      "The specific confidence metric displayed in the Report view, aggregating pose visibility quality and analysis completeness for the entire recorded session.",
    why: "It provides a single-number summary of analysis reliability, helping clinicians decide whether a session needs to be re-recorded before drawing conclusions.",
    related: ["Confidence Score"],
  },

  // ── COMPUTER VISION & GRAPHICS ─────────────────────────────────────────────
  {
    term: "WebAssembly (WASM)",
    category: "Computer Vision",
    definition:
      "A binary instruction format that runs near-native speed in web browsers. MediaPipe's pose model is compiled to WASM so it can execute in the browser without a server.",
    why: "WASM is what makes on-device AI possible in a web app. It allows the computationally intensive pose model to run at real-time speeds locally, ensuring no video data is sent to a server.",
    related: ["MediaPipe", "GPU Delegate"],
  },
  {
    term: "GPU Delegate",
    category: "Computer Vision",
    definition:
      "A MediaPipe configuration option that offloads neural network inference to the device's Graphics Processing Unit instead of the CPU. GaitPrecision enables the GPU delegate by default.",
    why: "GPU-accelerated inference is 5–10× faster than CPU inference for neural networks, enabling real-time pose detection on typical consumer hardware.",
    related: ["MediaPipe", "WebAssembly"],
  },
  {
    term: "requestAnimationFrame",
    category: "Computer Vision",
    definition:
      "A browser API that schedules a callback to run immediately before the browser paints the next frame, typically at 60fps. GaitPrecision's analysis loop uses it to process one video frame per render tick.",
    why: "Synchronizing pose detection to the browser's render cycle ensures the analysis keeps up with the video playback rate without over- or under-processing frames.",
    related: ["Frame Rate"],
  },
  {
    term: "Frame Rate",
    category: "Computer Vision",
    definition:
      "The number of video frames captured or processed per second (fps). GaitPrecision requests 60fps during recording for best temporal resolution in gait event detection.",
    why: "Higher frame rates improve the precision of gait event timing (heel strike, toe-off). At 30fps, events can only be located within a ±33ms window; at 60fps, that halves to ±16ms.",
    related: ["requestAnimationFrame", "Frames Analyzed"],
  },
  {
    term: "ResizeObserver",
    category: "Computer Vision",
    definition:
      "A browser API that notifies the app when an element's size changes. The Dashboard uses it to keep the canvas overlay perfectly sized to match the `<video>` element.",
    why: "Without ResizeObserver, the skeletal overlay would misalign whenever the user resizes the window, rendering landmarks at incorrect pixel positions.",
    related: ["Skeletal Overlay"],
  },

  // ── 3D VISUALIZATION ─────────────────────────────────────────────────────
  {
    term: "React Three Fiber (R3F)",
    category: "3D Visualization",
    definition:
      "A React renderer for Three.js, allowing 3D scenes to be composed declaratively using JSX components. GaitPrecision's `Gait3D.tsx` is built with R3F.",
    why: "R3F integrates naturally with React's component model, making it straightforward to wire real-time pose data into a 3D skeleton without manual Three.js imperative API calls.",
    related: ["Three.js", "SSAO"],
  },
  {
    term: "Three.js",
    category: "3D Visualization",
    definition:
      "A JavaScript library and API for creating and displaying animated 3D computer graphics in the browser using WebGL. It is the underlying rendering engine behind React Three Fiber.",
    why: "Three.js provides production-quality 3D rendering including lighting, materials, shadows, and post-processing effects that would be prohibitively complex to build from raw WebGL.",
    related: ["React Three Fiber"],
  },
  {
    term: "SSAO (Screen Space Ambient Occlusion)",
    category: "3D Visualization",
    definition:
      "A real-time rendering technique that approximates how much ambient light reaches each surface point, darkening areas where geometry blocks light (creases, corners, joints). Applied as a post-processing effect in `@react-three/postprocessing`.",
    why: "SSAO adds subtle depth cues to the 3D skeleton, making it appear grounded in 3D space rather than flat and unconvincing.",
    related: ["React Three Fiber"],
  },
  {
    term: "Orbit Controls",
    category: "3D Visualization",
    definition:
      "An interactive camera controller that lets users rotate, pan, and zoom the 3D skeleton view by clicking and dragging. It orbits the camera around a fixed target point.",
    why: "Orbit controls let clinicians inspect the 3D skeleton from any angle — such as a top-down view to assess hip rotation or a lateral view to inspect knee flexion depth.",
  },
  {
    term: "Box Geometry",
    category: "3D Visualization",
    definition:
      "A Three.js primitive that creates a rectangular cuboid mesh. The Gait3D skeleton uses scaled box geometries as limb segments (e.g., a tall thin box for the tibia, a shorter one for the femur).",
    why: "Box geometries are the simplest, most performant representation of limb segments for real-time animation and pose replay.",
    related: ["React Three Fiber"],
  },

  // ── RECORDING & MEDIA ────────────────────────────────────────────────────
  {
    term: "MediaRecorder",
    category: "Recording & Media",
    definition:
      "A browser Web API for recording audio and video streams. GaitPrecision uses it to capture from the device camera in WebM/VP9 format and write the data to a Blob.",
    why: "MediaRecorder is the standard, permission-model-compliant way to record camera output in the browser without requiring native app plugins.",
    related: ["Blob", "WebM/VP9"],
  },
  {
    term: "Blob",
    category: "Recording & Media",
    definition:
      "Binary Large Object — a raw data container in the browser. After recording finishes, the video chunks are concatenated into a Blob, which is then turned into an Object URL for playback.",
    why: "Storing the recording as a Blob keeps it in memory without touching the file system, allowing immediate playback and analysis without a download step.",
    related: ["MediaRecorder", "Object URL"],
  },
  {
    term: "Object URL",
    category: "Recording & Media",
    definition:
      "A temporary URL created by `URL.createObjectURL()` that points to in-memory data (like a Blob). Used as the `src` attribute of the `<video>` element to play back the recording.",
    why: "Object URLs allow the browser to stream a locally recorded Blob directly into a video element with the same API as a remote URL. They must be revoked when no longer needed to free memory.",
    related: ["Blob"],
  },
  {
    term: "WebM / VP9",
    category: "Recording & Media",
    definition:
      "WebM is an open video container format; VP9 is a high-efficiency video codec developed by Google. GaitPrecision requests `video/webm;codecs=vp9` for recording when the browser supports it.",
    why: "VP9 delivers smaller file sizes than H.264 at the same quality, reducing memory footprint. WebM is the most widely supported format for `MediaRecorder` in modern browsers.",
    related: ["MediaRecorder"],
  },

  // ── DATA & SESSION MANAGEMENT ─────────────────────────────────────────────
  {
    term: "Session",
    category: "Data & Sessions",
    definition:
      "A single recording and analysis run, stored with all its computed metrics (cadence, symmetry, angles, gait score, etc.) along with a timestamp and activity type.",
    why: "Sessions are the unit of comparison in the Report view. Tracking multiple sessions allows users to see progress or regression over time.",
    related: ["Session Comparison", "Historical Timeline"],
  },
  {
    term: "Session Comparison",
    category: "Data & Sessions",
    definition:
      "A side-by-side analysis of two sessions (Session A vs. Session B) showing the delta (Δ) in each metric, helping users quantify change between visits or training periods.",
    why: "Single-session snapshots are less meaningful than trend data. Session comparison transforms raw metrics into actionable rehabilitation or training feedback.",
    related: ["Session", "Metrics Δ"],
  },
  {
    term: "Metrics Δ (Delta)",
    category: "Data & Sessions",
    definition:
      "The difference between the same metric measured in two different sessions (Session A − Session B). A positive Δ cadence means the user walked faster in Session A.",
    why: "Displaying deltas directly removes the cognitive work of mentally subtracting numbers, making progress immediately legible.",
    related: ["Session Comparison"],
  },
  {
    term: "Frames Analyzed",
    category: "Data & Sessions",
    definition:
      "The total number of video frames that were successfully processed by the pose estimation pipeline during a session.",
    why: "Frames analyzed is a proxy for data completeness. A session where the pose model dropped many frames (due to occlusion or poor lighting) will have lower frames analyzed and lower confidence.",
    related: ["Frame Rate", "Confidence Score"],
  },
  {
    term: "Gait Score",
    category: "Data & Sessions",
    definition:
      "A composite 0–100 score summarizing overall gait quality for a session, derived from symmetry, cadence regularity, ROM, and event detection consistency.",
    why: "A single headline number makes session quality immediately communicable — useful for quick progress tracking and for sharing results with non-technical stakeholders.",
    related: ["Symmetry Index", "Cadence", "Engine Confidence"],
  },

  // ── ENGINE CONFIGURATION ──────────────────────────────────────────────────
  {
    term: "Stride Sensitivity",
    category: "Engine Configuration",
    definition:
      "A slider (0–100%) that controls the EMA alpha (α) applied to raw landmark positions before angle computation. At 0% (Coarse) α = 0.05 — heavy smoothing removes jitter but may blur fast events. At 100% (Ultra-Fine) α = 0.45 — minimal smoothing follows the signal closely but lets noise through.",
    why: "Camera quality, recording distance, and subject clothing all affect how noisy the pose signal is. Stride Sensitivity lets you trade off noise suppression against detection speed: lower values for distant or shaky cameras, higher values for close, stable setups.",
    related: ["EMA (Exponential Moving Average)", "Alpha (α)", "Sensitivity"],
  },
  {
    term: "Ankle Trigger",
    category: "Engine Configuration",
    definition:
      "A threshold angle (5°–45°, default 25°) for ankle-related biomechanical events. When the computed ankle angle deviates from neutral by more than this value, an ankle event is flagged. A lower value makes the system more sensitive to small ankle deviations; a higher value only fires on pronounced plantarflexion or dorsiflexion.",
    why: "Subjects with limited ankle mobility (post-surgery, orthotics, older adults) rarely reach the default threshold. Lowering Ankle Trigger to 10–15° allows the engine to still capture these events. Conversely, raising it suppresses false positives in subjects with naturally high ankle excursion.",
    related: ["Ankle Angle", "Threshold", "Toe-Off"],
  },
  {
    term: "Knee Lockout",
    category: "Engine Configuration",
    definition:
      "A threshold angle (0°–180°, default 155°) that defines the 'extended' position of the knee used to detect heel strikes. When the knee angle rises above this value it is treated as the beginning of the stance phase. Lower values fire earlier (less extension required); higher values require a more fully extended knee.",
    why: "Some populations — amputees, individuals with knee contracture, or children — never achieve full knee extension during stance. Reducing Knee Lockout to 130–140° allows stride detection to work for these subjects. Increasing it toward 170° makes heel-strike detection stricter, reducing false positives in highly dynamic movements.",
    related: ["Knee Flexion", "Heel Strike", "Threshold", "Stride Sensitivity"],
  },
  {
    term: "Auto-Scale Skeleton",
    category: "Engine Configuration",
    definition:
      "A toggle that enables dynamic, per-frame normalization of the skeleton overlay. When ON, the engine rescales the detected pose to fill the canvas based on the bounding box of the visible landmarks each frame. When OFF, the skeleton is drawn at the raw normalized coordinates returned by MediaPipe.",
    why: "Auto-scaling is useful when the subject moves closer or further from the camera across the clip, keeping the skeleton visible. It should be turned OFF for accurate metric comparisons across sessions or when the subject's distance from the camera must remain constant (e.g., clinical setups with fixed camera placement), as scaling changes the apparent joint positions.",
    related: ["Normalized Landmarks", "Skeletal Overlay", "Landmarks"],
  },
];

const CATEGORIES = [
  "All",
  "Biomechanics",
  "Pose Estimation",
  "Signal Processing",
  "Computer Vision",
  "3D Visualization",
  "Recording & Media",
  "Data & Sessions",
  "Engine Configuration",
];

const CATEGORY_COLORS: Record<string, string> = {
  Biomechanics: "text-primary border-primary/40 bg-primary/10",
  "Pose Estimation": "text-blue-400 border-blue-400/40 bg-blue-400/10",
  "Signal Processing": "text-purple-400 border-purple-400/40 bg-purple-400/10",
  "Computer Vision": "text-amber-400 border-amber-400/40 bg-amber-400/10",
  "3D Visualization": "text-pink-400 border-pink-400/40 bg-pink-400/10",
  "Recording & Media": "text-green-400 border-green-400/40 bg-green-400/10",
  "Data & Sessions": "text-orange-400 border-orange-400/40 bg-orange-400/10",
  "Engine Configuration": "text-teal-400 border-teal-400/40 bg-teal-400/10",
};

function TermCard({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  const badgeClass = CATEGORY_COLORS[term.category] ?? "text-on-surface-variant border-outline-variant bg-surface-container";

  return (
    <motion.div
      layout
      className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low hover:border-outline transition-colors"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="font-mono text-sm font-bold text-on-surface tracking-wide">
            {term.term}
          </span>
          <span className={cn("font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border w-fit", badgeClass)}>
            {term.category}
          </span>
        </div>
        <div className="shrink-0 mt-1 text-on-surface-variant">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-outline-variant pt-4">
              <p className="font-sans text-sm text-on-surface leading-relaxed">
                {term.definition}
              </p>
              <div className="rounded-lg bg-surface-container px-4 py-3 border border-outline-variant/50">
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
                  Why it's used
                </p>
                <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
                  {term.why}
                </p>
              </div>
              {term.related && term.related.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60 self-center">
                    See also:
                  </span>
                  {term.related.map((r) => (
                    <span
                      key={r}
                      className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Glossary() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TERMS.filter((t) => {
      const matchesCategory = activeCategory === "All" || t.category === activeCategory;
      const matchesQuery =
        !q ||
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.why.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            Reference
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-on-surface mb-3">
          Glossary
        </h1>
        <p className="font-sans text-sm text-on-surface-variant max-w-2xl leading-relaxed">
          A complete reference for the technical and clinical terminology used throughout GaitPrecision —
          from biomechanics and pose estimation to signal processing and 3D visualization.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
        <input
          type="text"
          placeholder="Search terms, definitions, or concepts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container text-sm font-sans text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all",
              activeCategory === cat
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant/50 mb-4">
        {filtered.length} term{filtered.length !== 1 ? "s" : ""}
        {activeCategory !== "All" && ` in ${activeCategory}`}
        {query && ` matching "${query}"`}
      </p>

      {/* Term cards */}
      <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full py-20 flex flex-col items-center gap-3 text-center"
            >
              <Search className="w-8 h-8 text-on-surface-variant/20" />
              <p className="font-sans text-sm text-on-surface-variant/50">
                No terms match your search.
              </p>
            </motion.div>
          ) : (
            filtered.map((t) => (
              <motion.div
                key={t.term}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <TermCard term={t} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
