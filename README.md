# MusicVid Pro

A browser-based music video editor built for musicians. Sync video clips to audio tracks with musical precision — no installs, no uploads, everything runs in your browser.

![MusicVid Pro](public/next.svg)

## Features

- **Multi-track timeline** — video, audio, and text tracks on a single canvas
- **BPM detection** — auto-detects tempo from audio; snap clips to the beat grid
- **Time-stretching & pitch-shifting** — change tempo or key independently, powered by FFmpeg WASM and Rubberband
- **Multi-cam sync** — align multiple camera angles automatically via audio cross-correlation
- **Video speed control** — slow-mo and fast-forward via FFmpeg (server-side or WASM fallback)
- **Waveform visualization** — see your audio's transients for frame-accurate cuts
- **Metronome overlay** — visual beat indicator synced to project BPM
- **In-browser recording** — capture audio directly into a new track
- **Export** — render to MP4/WebM with YouTube, Instagram, and TikTok presets
- **Local persistence** — projects saved to IndexedDB; nothing leaves your device
- **Interactive tutorial** — Quick Tour (10 steps) or Dev Tour (52 steps)

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Zustand** + Immer for state management
- **FFmpeg WASM** (`@ffmpeg/ffmpeg`) for video/audio processing
- **Web Audio API** + **Tone.js** for BPM detection, waveform generation, metronome
- **Konva / react-konva** for the timeline canvas
- **Dexie** (IndexedDB) for project persistence
- **Radix UI** + **Tailwind CSS** for the UI
- **Vitest** + **fast-check** for unit and property-based tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Coverage report
```

## Project Structure

```
app/                  # Next.js App Router pages and API routes
components/
  editor/             # Editor UI components (Timeline, Toolbar, Inspector, etc.)
  ui/                 # Generic UI primitives (Radix + CVA wrappers)
stores/               # Zustand store (editorStore + 6 domain slices)
lib/
  audio/              # AudioProcessor, AudioContextManager
  video/              # VideoProcessor
  media/              # MediaRegistry (Object URL lifecycle), MediaJobQueue (FFmpeg serialization)
  export/             # TimelineCompositor (FFmpeg filter_complex builder)
  persistence/        # Dexie schema, projectStore save/load
  tutorial/           # Tutorial step definitions, persistence helpers, tooltip positioning
  hooks/              # useKeyboardShortcuts, useAudioRecorder, useTutorialController
  workers/            # Web Workers for BPM detection and waveform generation
__tests__/            # Vitest test suite (unit + property-based)
```

## Architecture Notes

- All FFmpeg WASM operations go through `MediaJobQueue` (singleton) to prevent WASM deadlocks
- `VideoProcessor` tries the server-side `/api/video/speed` route first, falls back to WASM
- CPU-intensive audio analysis (BPM, waveform) runs in a Web Worker via `audioAnalysisClient`
- Object URLs are managed by `MediaRegistry` with reference counting — never call `URL.createObjectURL` directly
- Tutorial state is excluded from the undo/redo snapshot system

## License

MIT
