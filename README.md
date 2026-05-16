# GaitPrecision

**Advanced biomechanical gait analysis — 100% on-device, no data ever leaves your browser.**

GaitPrecision uses [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) pose detection (WebAssembly + GPU) to track 33 body landmarks in real time and compute clinical-grade joint angle and stride metrics directly in the browser.

---

## Features

- **Real-time pose tracking** — MediaPipe PoseLandmarker running at up to 60 fps via GPU delegate and WASM
- **Joint angle analysis** — knee, hip, and ankle flexion angles for both legs, smoothed with an exponential moving average
- **Stride metrics** — cadence (steps/min), stance %, swing %, and stride time derived from heel-strike / toe-off event detection
- **3D skeleton visualization** — animated React Three Fiber scene with SSAO post-processing
- **Symmetry comparison** — side-by-side left vs. right leg analysis
- **AI recommendations** — Gemini-powered coaching suggestions based on your recorded session
- **PDF report export** — download a full analysis report via jsPDF + html2canvas
- **Recording & upload** — record directly from your rear camera (1080p / 60 fps preferred) or upload an existing video
- **Fully private** — all processing happens client-side; no video or biometric data is transmitted anywhere

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite 6 |
| Pose detection | `@mediapipe/tasks-vision` (WASM, GPU delegate) |
| 3D rendering | `@react-three/fiber` + `three.js` + `@react-three/postprocessing` |
| Charts | Recharts |
| Animations | Motion (Framer Motion v12) |
| Styling | Tailwind CSS v4 (custom dark theme) |
| AI | `@google/genai` (Gemini API) |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Gemini API key (for AI recommendations — optional for core analysis)

### Installation

```bash
git clone https://github.com/your-username/gaitprecision.git
cd gaitprecision
npm install
```

### Environment

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Development

```bash
npm run dev
# App runs at http://localhost:3000
```

### Production Build

```bash
npm run build      # Outputs to dist/
npm run preview    # Preview the production build locally
```

---

## Recording Guide

For accurate results, follow these guidelines when recording:

- **Camera angle** — film from the **side** (sagittal plane). Front/rear views degrade angle accuracy.
- **Framing** — keep **hips to feet** fully in frame for both legs at all times.
- **Environment** — good lighting, plain background, no backlighting.
- **Duration** — record **15–30 seconds** of continuous walking minimum (the stride detector needs ~4 complete cycles to stabilize).
- **Walk naturally** — normal pace, straight line parallel to the camera.
- **Device** — use a stable mount or have someone else film; rear camera preferred.

The in-app **How to Record** page covers each step in detail.

---

## Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx          # Main analysis view (video + live overlay)
│   ├── Recorder.tsx           # Camera capture interface
│   ├── Report.tsx             # Session report with charts
│   ├── Gait3D.tsx             # 3D skeleton visualization
│   ├── SymmetryComparison.tsx # Left/right symmetry breakdown
│   ├── GeminiRecommendations.tsx # AI coaching panel
│   ├── HowToRecord.tsx        # Recording instruction guide
│   ├── Navigation.tsx         # Top bar + mobile tab bar
│   ├── Hero.tsx               # Landing / upload page
│   └── Profile.tsx            # User profile view
├── hooks/
│   └── useGaitAnalyzer.ts     # Core analysis pipeline (MediaPipe + stride detection)
├── lib/
│   ├── utils.ts               # cn() utility
│   ├── mediapipe-config.ts    # WASM / model CDN paths
│   ├── sessionDb.ts           # In-memory session data types
│   └── poseStore.ts           # Shared pose landmark store for 3D sync
└── index.css                  # Tailwind v4 @theme + custom utilities
```

---

## How It Works

1. **Load** — `useGaitAnalyzer` initializes MediaPipe `PoseLandmarker` on mount (GPU delegate, VIDEO mode). WASM and model files are fetched from CDN.
2. **Detect** — A `requestAnimationFrame` loop calls `poseLandmarker.detectForVideo()` on every new video frame.
3. **Compute** — Landmarks 23–28 (hips, knees, ankles) and 31–32 (foot indices) are used to compute joint angles via `atan2`. An EMA (α = 0.2) smooths raw readings.
4. **Stride events** — Knee angle threshold crossings detect heel-strike (>155°) and toe-off (<140°), producing cadence and stance/swing percentages.
5. **Render** — Skeleton connectors and landmarks are drawn onto a `<canvas>` overlaid on the `<video>`. Pose data is shared with the 3D scene via `poseStore`.

---

## Privacy

All video processing and biomechanical computation runs entirely in the browser using WebAssembly. No video frames, pose landmarks, or personal data are sent to any server. The only optional network call is to the Gemini API for AI coaching text, which can be disabled by omitting the API key.

---

## License

MIT
