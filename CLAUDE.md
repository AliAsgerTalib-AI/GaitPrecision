# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build (output: dist/)
npm run lint       # Type-check only (tsc --noEmit) — no separate test suite
npm run preview    # Preview production build locally
npm run clean      # Remove dist/ and server.js
```

**Environment:** Create `.env.local` and set `GEMINI_API_KEY` to your Gemini API key. The Vite config bakes it into the bundle via `process.env.GEMINI_API_KEY`.

## Architecture

GaitPrecision is a client-side gait analysis tool. All pose estimation and biomechanical computation runs in the browser — no data leaves the device.

### View routing

`App.tsx` owns a single `View` state (`'home' | 'dashboard' | 'report' | 'recording' | 'profile'`) and switches between components via a `useMemo`-guarded switch. There is no React Router. The `Navigation` component calls `onNavigate` to change views.

### Core analysis pipeline (`src/hooks/useGaitAnalyzer.ts`)

The `useGaitAnalyzer` hook is the heart of the app:

1. On mount, it loads MediaPipe `PoseLandmarker` (GPU delegate, VIDEO mode) with WASM and model files fetched from CDN.
2. When `startAnalysis()` is called, a `requestAnimationFrame` loop runs `poseLandmarker.detectForVideo()` on each new video frame.
3. Landmarks 23–28 (left/right hip, knee, ankle) are used to compute knee flexion angles via `atan2`. The last 50 angle readings are kept in `kneeAngles` state.
4. Skeleton connectors and landmarks are drawn onto a `<canvas>` overlaid on the `<video>` element.

The `Dashboard` component uses this hook directly and sizes the canvas to match the video via a `ResizeObserver`.

### 3D visualization (`src/components/Gait3D.tsx`)

A React Three Fiber scene with a procedural box-geometry skeleton. Uses `useFrame` to animate limb rotations in a walking cycle. Post-processed with `@react-three/postprocessing` SSAO. Loaded lazily within the `Report` or `Dashboard` contexts.

### Recording (`src/components/Recorder.tsx`)

Uses the `MediaRecorder` API to capture from the device camera (rear-facing, 1080p/60fps preferred, webm/vp9). After stopping, a `Blob` is passed to `onComplete`. Camera errors are classified into `permission | device | hardware | unknown` with distinct UI messages.

### Design system

Tailwind CSS v4 with a custom `@theme` block in `src/index.css`. The palette is a Material Design 3–style dark theme:

- **Primary:** `#57f1db` (teal) — used for active states, glows, and highlights
- **Surface hierarchy:** `surface-container-lowest` → `surface-container-highest` (dark blue-grey scale)
- **Fonts:** Geist (`font-display`), Inter (`font-sans`), JetBrains Mono (`font-mono`)
- **Custom animations:** `scan` (vertical sweep), `shimmer` (loading shimmer), `dash` (stroke animation)
- Utility classes `.glass-panel`, `.dotted-pattern`, `.chart-grid` are defined in `index.css`

### Path alias

`@` resolves to the repo root (not `src/`). Import internal modules as `@/src/lib/utils`, `@/src/hooks/...`, etc.

### Key dependencies

| Package | Purpose |
|---|---|
| `@mediapipe/tasks-vision` | Pose landmark detection (WASM, GPU) |
| `@react-three/fiber` + `three` | 3D skeleton visualization |
| `@react-three/postprocessing` | SSAO post-processing effect |
| `motion/react` | Page transitions and micro-animations |
| `recharts` | Data charts in Report/Dashboard |
| `@google/genai` | Gemini API integration |
| `lucide-react` | Icon set |
| `clsx` + `tailwind-merge` | Conditional className utility (`cn()` in `src/lib/utils.ts`) |
