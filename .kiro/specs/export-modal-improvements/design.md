# Design Document: Export Modal Improvements

## Overview

This feature addresses four gaps in the existing `ExportModal` component:

1. **Scrollable layout** — the modal content overflows the viewport, hiding the Export button and lower options.
2. **Always-visible footer** — the Export and Cancel buttons must remain on-screen regardless of scroll position.
3. **Export mode selection** — users need a top-level choice between `Video` (video + audio) and `Audio Only` (MP3/WAV).
4. **Video quality tier selector** — users need a named bitrate tier (Low / Medium / High / Ultra) that overrides the preset's default bitrate.

All changes are confined to `components/editor/ExportModal.tsx` and the pure preflight logic it contains. No new files, stores, or API routes are required.

---

## Architecture

The modal is a self-contained React component that reads timeline state from `useEditorStore` and drives the FFmpeg WASM pipeline via `MediaJobQueue`. The improvements follow the same pattern:

- New UI state lives in `useState` hooks local to `ExportModal`.
- The `runPreflight` function is extended to accept the current `exportMode` so it can conditionally suppress video-specific errors.
- The `handleExport` function branches on `exportMode` to either run the existing video pipeline or a new audio-only pipeline.
- The `TimelineCompositor` is used as-is for video exports; audio-only exports bypass it and use a simpler FFmpeg command.

```mermaid
flowchart TD
    A[ExportModal opens] --> B[runPreflight(exportMode)]
    B --> C{errors?}
    C -- yes --> D[Show blocking errors, disable Export]
    C -- no --> E[User clicks Export]
    E --> F{exportMode}
    F -- video --> G[Build filter_complex via TimelineCompositor]
    G --> H[MediaJobQueue: ffmpeg video pipeline]
    F -- audio-only --> I[Build audio-only ffmpeg args]
    I --> J[MediaJobQueue: ffmpeg audio pipeline]
    H --> K[Download .mp4]
    J --> L[Download .mp3 / .wav]
```

---

## Components and Interfaces

### ExportModal local state additions

```ts
type ExportMode = 'video' | 'audio-only';
type AudioFormat = 'mp3' | 'wav';
type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

// New useState hooks added to ExportModal
const [exportMode, setExportMode] = useState<ExportMode>('video');
const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3');
const [qualityTier, setQualityTier] = useState<QualityTier>('high');
```

### Quality tier bitrate map

```ts
const QUALITY_TIER_BITRATES: Record<QualityTier, { bitrate: string; label: string }> = {
  low:   { bitrate: '2M',  label: '~2 Mbps' },
  medium:{ bitrate: '5M',  label: '~5 Mbps' },
  high:  { bitrate: '8M',  label: '~8 Mbps' },
  ultra: { bitrate: '15M', label: '~15 Mbps' },
};
```

### Updated `runPreflight` signature

```ts
function runPreflight(mode: ExportMode): {
  errors: string[];
  warnings: string[];
  mainVideo: VideoTrack | undefined;
  mainAudio: AudioTrack | undefined;
}
```

When `mode === 'audio-only'`:
- Skip the "No video tracks" and "No exportable video file" blocking errors.
- Add a blocking error if there are no unmuted audio tracks with files.
- Retain the "Timeline is empty" blocking error.

### Layout structure

The `DialogContent` wrapper gains `flex flex-col max-h-[90vh]`. Inside it:

```
DialogContent (flex col, max-h-[90vh])
├── DialogHeader          (static)
├── <div class="flex-1 overflow-y-auto min-h-0 ...">   ← scrollable options area
│   ├── Preflight panel
│   ├── Export Mode selector   (new)
│   ├── Platform Preset        (hidden when audio-only)
│   ├── Quality Tier           (hidden when audio-only)
│   ├── Audio Format           (shown when audio-only)
│   ├── Video Template
│   └── Progress bar
└── <div class="border-t border-zinc-800 pt-4 ...">    ← sticky footer
    ├── Cancel button
    └── Export button
```

A `mask-image` CSS fade gradient is applied to the bottom of the scrollable area to signal overflow content.

---

## Data Models

No new persistent data models are introduced. All new state is ephemeral UI state local to `ExportModal` and is reset when the dialog closes.

The `ExportPreset` interface in `timelineCompositor.ts` is used as-is. The quality tier override is applied by shallow-copying the preset before passing it to `TimelineCompositor.build()`:

```ts
const outputPreset = {
  ...EXPORT_PRESETS[presetKey],
  bitrate: QUALITY_TIER_BITRATES[qualityTier].bitrate,
};
```

For audio-only exports, `TimelineCompositor` is not used. The FFmpeg command is built directly:

```ts
// Audio-only pipeline (simplified)
const inputArgs = activeAudioTracks.flatMap((t, i) => ['-i', `export-audio-${i}.${ext}`]);
const filterParts = activeAudioTracks.map((_, i) => `[${i}:a]`).join('');
const mixFilter = activeAudioTracks.length > 1
  ? `${filterParts}amix=inputs=${activeAudioTracks.length}:duration=longest[aout]`
  : `${filterParts}acopy[aout]`;
const outputArgs = audioFormat === 'mp3'
  ? ['-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '320k']
  : ['-map', '[aout]', '-c:a', 'pcm_s16le'];
const outputFile = `export-output.${audioFormat}`;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Quality tier bitrate override is applied

*For any* valid platform preset and any quality tier, the `bitrate` field of the `ExportPreset` passed to `TimelineCompositor.build()` SHALL equal the bitrate value defined for that quality tier, regardless of the preset's default bitrate.

**Validates: Requirements 3.3**

### Property 2: Audio-only preflight suppresses video errors

*For any* timeline state where video tracks are absent or have no exportable file, running `runPreflight('audio-only')` SHALL NOT include a blocking error about missing video tracks or missing exportable video files.

**Validates: Requirements 4.1, 4.2**

### Property 3: Audio-only preflight blocks on no audio tracks

*For any* timeline state where all audio tracks are muted or absent, running `runPreflight('audio-only')` SHALL include a blocking error: "No audio tracks available for audio-only export."

**Validates: Requirements 2.5**

### Property 4: Video preflight retains all existing video errors

*For any* timeline state where video tracks are absent, running `runPreflight('video')` SHALL include a blocking error for missing video tracks.

**Validates: Requirements 4.3**

### Property 5: Download filename extension matches audio format

*For any* audio format selection (`mp3` or `wav`), the filename used for the download anchor SHALL end with `.${audioFormat}`.

**Validates: Requirements 2.6**

---

## Error Handling

All errors follow the existing `AppError` pattern in `lib/errors/appError.ts`.

| Scenario | Handling |
|---|---|
| Preflight blocking errors | Displayed in the existing red panel; Export button remains disabled |
| FFmpeg audio-only job failure | Caught in `handleExport` catch block; sets `exportError` state; `EXPORT_FAILED` code |
| No active audio tracks at export time (race condition) | Guard in `handleExport` throws before enqueuing the job |
| Unsupported audio codec (WAV on some browsers) | FFmpeg WASM handles `pcm_s16le` natively; no special handling needed |
| Dialog closed mid-export | `isExporting` flag prevents `onOpenChange` from closing; existing behavior retained |

---

## Testing Strategy

This feature is primarily UI state logic and a pure preflight function. PBT applies to the preflight logic and the quality tier override — both are pure functions with meaningful input variation.

**Property-based testing library**: `fast-check` (already available in the JS ecosystem; integrates with Vitest).

### Unit tests (`__tests__/exportModal.test.ts`)

- `runPreflight('video')` with no video tracks → blocking error present
- `runPreflight('video')` with no audio tracks → blocking error present
- `runPreflight('audio-only')` with no video tracks → no video blocking error
- `runPreflight('audio-only')` with no unmuted audio tracks → blocking error present
- `runPreflight('audio-only')` with zero timeline duration → "Timeline is empty" error present
- Quality tier `high` produces bitrate `8M` in the preset passed to compositor
- Download filename ends with `.mp3` when audio format is `mp3`
- Download filename ends with `.wav` when audio format is `wav`

### Property-based tests (`__tests__/exportModal.property.test.ts`)

Each test runs a minimum of 100 iterations via `fast-check`.

**Feature: export-modal-improvements, Property 1**: For any preset key and quality tier, the bitrate in the composed preset equals `QUALITY_TIER_BITRATES[tier].bitrate`.

**Feature: export-modal-improvements, Property 2**: For any timeline state with no video tracks, `runPreflight('audio-only')` never returns a video-related blocking error.

**Feature: export-modal-improvements, Property 3**: For any timeline state where all audio tracks are muted, `runPreflight('audio-only')` always returns the no-audio blocking error.

**Feature: export-modal-improvements, Property 4**: For any timeline state with no video tracks, `runPreflight('video')` always returns a video-related blocking error.

**Feature: export-modal-improvements, Property 5**: For any audio format value in `['mp3', 'wav']`, the generated download filename ends with `.${format}`.

### Integration / manual tests

- Open the modal on a short viewport (e.g. 600 px height) and verify the footer stays visible while the options area scrolls.
- Verify the fade gradient appears at the bottom of the scrollable area when content overflows.
- Export a project in audio-only MP3 mode and confirm the downloaded file plays correctly.
- Export a project in audio-only WAV mode and confirm the downloaded file plays correctly.
- Switch quality tiers and confirm the FFmpeg `-b:v` argument changes in the console log.
