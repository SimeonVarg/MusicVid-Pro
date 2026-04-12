# Tech Stack

## Framework & Runtime
- **Next.js 14** (App Router) with React 18
- **TypeScript** (strict mode, `ES2017` target)
- Path alias: `@/` maps to the workspace root

## Styling
- **Tailwind CSS v3** with `tailwindcss-animate`
- Dark-mode via `class` strategy
- CSS custom properties for theme tokens (colors, radius) defined in `globals.css`
- Component variants built with `class-variance-authority` (CVA) + `clsx` / `tailwind-merge`

## State Management
- **Zustand** with `immer` middleware for immutable updates, `devtools`, and `persist`
- Single store: `stores/editorStore.ts` — composes 5 domain slices (`uiSlice`, `timelineSlice`, `playbackSlice`, `tracksSlice`, `processingSlice`)
- Slice types and initial states live in `stores/slices/`; implementations are in `editorStore.ts`
- Undo/redo via manual snapshot history (max 50 entries) stored in module-level arrays

## Audio / Video Processing
- **@ffmpeg/ffmpeg** (WASM) — time-stretching, pitch-shifting, video speed changes, audio extraction
- **Web Audio API** — decoding, BPM detection, waveform generation, cross-correlation sync
- **Tone.js** — metronome and musical timing utilities
- **standardized-audio-context** — cross-browser AudioContext wrapper
- FFmpeg WASM is a shared singleton managed by `MediaJobQueue` — loaded lazily from CDN on first use
- `VideoProcessor` attempts server-side processing (`/api/video/speed`) first, falls back to WASM
- Server-side route uses `ffmpeg-static` + `ffprobe-static` (Node.js runtime, max 2 concurrent jobs, 500 MB limit)
- CPU-intensive audio work (BPM detection, waveform generation) runs in a Web Worker via `audioAnalysisClient`

## Media Management
- **MediaRegistry** (`lib/media/mediaRegistry.ts`) — centralized Object URL lifecycle with reference counting
- **MediaJobQueue** (`lib/media/mediaJobQueue.ts`) — serializes all FFmpeg WASM calls to prevent WASM deadlocks

## Persistence
- **Dexie** (IndexedDB wrapper) — 3 tables: `projects` (metadata), `tracks` (serialized state), `files` (raw blobs)
- `projectStore.ts` handles save/load/list/delete; strips `File`/`AudioBuffer` on save, restores via `mediaRegistry` on load

## Export
- **TimelineCompositor** (`lib/export/timelineCompositor.ts`) — builds FFmpeg `filter_complex` from timeline state
- Supports multi-track video overlays, audio mixing, text overlays, fades, and social media presets (YouTube, Instagram, TikTok)

## Error Handling
- Structured `AppError` type (`lib/errors/appError.ts`) with typed error codes, user-facing messages, and recoverable flag
- All async operations convert thrown values via `toAppError()` before surfacing to the UI

## Telemetry
- Lightweight typed event bus (`lib/telemetry/events.ts`) — console logging in dev, pluggable handler in prod

## Canvas / Animation
- **Konva / react-konva** — canvas-based timeline rendering
- **Framer Motion** — UI animations

## UI Components
- **Radix UI** primitives (Dialog, Label, Progress, RadioGroup, Separator, Slider)
- Custom wrappers in `components/ui/` following the CVA variant pattern

## Testing
- **Vitest** — unit and integration tests in `__tests__/`
- `vitest.setup.ts` for global test setup

## Common Commands
```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint via next lint
npx vitest --run # Run tests once (no watch mode)
```

## Webpack Notes
- `.wasm` and `.worklet` files are treated as `asset/resource`
- Client bundle stubs out `fs`, `path`, `crypto` (Node-only modules)
- `canvas` is aliased to `false` to prevent Konva from pulling in `node-canvas`
