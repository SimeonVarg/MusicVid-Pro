# Project Structure

```
/
├── app/                        # Next.js App Router
│   ├── api/video/speed/        # Server-side video speed processing (native FFmpeg, Node.js runtime)
│   ├── editor/page.tsx         # Main editor page (client component)
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── page.tsx                # Landing / home page
│   └── globals.css             # Tailwind base + CSS custom properties (theme tokens)
│
├── components/
│   ├── editor/                 # Feature components (all 'use client')
│   │   ├── Toolbar.tsx         # Top bar: playback controls, BPM, export
│   │   ├── Timeline.tsx        # Main timeline canvas (Konva, SSR-disabled)
│   │   ├── TimelineTrack.tsx   # Individual track row rendering
│   │   ├── TimelineRuler.tsx   # Time ruler with zoom/scroll
│   │   ├── TrackList.tsx       # Left-side track list panel
│   │   ├── VideoPreview.tsx    # Video preview canvas
│   │   ├── InspectorPanel.tsx  # Right-side properties panel
│   │   ├── ExportModal.tsx     # Export dialog
│   │   ├── BPMControl.tsx      # BPM input widget
│   │   ├── TimeDisplay.tsx     # Current time display (multiple modes)
│   │   ├── WaveformVisualization.tsx
│   │   ├── MetronomeOverlay.tsx
│   │   ├── MultiCamSync.tsx
│   │   ├── RecordingPanel.tsx
│   │   ├── LevelMeter.tsx
│   │   ├── Playhead.tsx
│   │   └── EditorErrorBoundary.tsx
│   └── ui/                     # Generic UI primitives (Radix + CVA wrappers)
│       └── Button, Dialog, Input, Label, Progress, RadioGroup, Separator, Slider, ErrorToast
│
├── stores/
│   ├── editorStore.ts          # Single Zustand store — composes all slices, re-exports types
│   └── slices/
│       ├── index.ts            # Barrel: exports all slice types and initial states
│       ├── uiSlice.ts          # Inspector, export dialog, context menu, clipboard, selection
│       ├── timelineSlice.ts    # currentTime, zoom, scroll, markers, musical context
│       ├── playbackSlice.ts    # play/pause/stop, playback rate
│       ├── tracksSlice.ts      # videoTracks, audioTracks, textTracks CRUD
│       └── processingSlice.ts  # BPM, video speed, sync, recording, export settings
│
├── lib/
│   ├── audio/
│   │   ├── audioProcessor.ts       # Time-stretching, pitch-shifting, BPM detection, waveform, sync
│   │   └── audioContextManager.ts  # Singleton AudioContext (prevents browser 6-context limit)
│   ├── video/
│   │   └── videoProcessor.ts       # Speed changes, thumbnail extraction (LRU cache), multi-cam sync, export
│   ├── media/
│   │   ├── mediaRegistry.ts        # Centralized Object URL manager with reference counting
│   │   └── mediaJobQueue.ts        # Serialized FFmpeg WASM job queue (prevents WASM deadlocks)
│   ├── export/
│   │   └── timelineCompositor.ts   # Builds FFmpeg filter_complex from timeline state; social media presets
│   ├── persistence/
│   │   ├── db.ts                   # Dexie IndexedDB schema (projects, tracks, files tables)
│   │   └── projectStore.ts         # Save/load/list/delete projects; strips non-serializable fields
│   ├── errors/
│   │   └── appError.ts             # Typed AppError model, toAppError() converter, error codes
│   ├── telemetry/
│   │   └── events.ts               # Lightweight typed event bus; console in dev, pluggable in prod
│   ├── workers/
│   │   ├── audioAnalysis.worker.ts # Web Worker: BPM detection and waveform generation
│   │   └── audioAnalysisClient.ts  # Promise-based client wrapper for the audio analysis worker
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts # Global keyboard bindings
│   │   └── useAudioRecorder.ts     # MediaRecorder-based audio recording hook
│   └── utils/
│       ├── bpm.ts                  # BPM math helpers (clamping, multiplier, tap tempo)
│       ├── musicalTime.ts          # Beat/bar/tick conversion, snap-to-grid, timeline grid config
│       └── videoMetadata.ts        # Extract duration/metadata from video files
│
├── types/
│   └── ffprobe-static.d.ts     # Type declaration for ffprobe-static
│
├── pages/
│   └── _document.tsx           # Custom Next.js Document (legacy pages dir)
│
├── __tests__/                  # Vitest test suite
│   └── audioProcessor, bpm, mediaJobQueue, mediaRegistry, musicalTime,
│       processingIntegration, speedRatio, syncTrackIds, timelineCompositor, tracksSlice
│
└── public/                     # Static assets
```

## Key Conventions

- All editor UI components are `'use client'` — no server components inside `components/editor/`
- The `Timeline` component is dynamically imported with `ssr: false` (Konva requires browser APIs)
- State mutations always go through `useEditorStore` actions; never mutate state directly outside the store
- Immer is used inside store actions — mutate the draft directly, no need to return new objects
- Store is split into 5 domain slices; `editorStore.ts` composes them and re-exports all types
- Track IDs are `crypto.randomUUID()`
- Never call `URL.createObjectURL` directly — always use `mediaRegistry.register()` / `mediaRegistry.release()`
- `mediaRegistry` tracks refCounts; URLs are revoked automatically when refCount reaches 0
- All FFmpeg WASM operations go through `MediaJobQueue.getInstance().enqueue()` — never call FFmpeg directly
- `VideoProcessor` tries the server-side `/api/video/speed` route first, falls back to WASM if unavailable
- FFmpeg WASM is loaded lazily from CDN (`unpkg @ffmpeg/core@0.12.4`) on first job
- `AudioProcessor` and `VideoProcessor` are instantiated per-operation; FFmpeg is a shared singleton via `MediaJobQueue`
- CPU-intensive audio analysis (BPM, waveform) is offloaded to a Web Worker via `audioAnalysisClient`
- Errors are always converted to `AppError` via `toAppError()` before surfacing to the UI
- UI components in `components/ui/` follow the CVA pattern: define variants with `cva()`, accept `className` for overrides, forward refs
- Tailwind color tokens (`bg-zinc-*`, `border-zinc-800`, `text-purple-500`, etc.) define the dark UI palette — avoid hardcoded hex colors
- `lib/playback/` is intentionally empty — RAF-based playback loop is managed inside the store's playback actions
