# Requirements Document

## Introduction

MusicVid Pro is a browser-based music video editor built on Next.js 14, React 18, TypeScript, Zustand/Immer, FFmpeg WASM, and Konva. The codebase currently works at prototype grade but carries significant architectural debt: a monolithic 1,859-line Zustand store, fragile filename-based audio/video linking, a shared FFmpeg singleton with no concurrency guard beyond a serialization promise, an export pipeline that ignores multi-track composition, dead code (stub FFT class, unreachable phase-vocoder path), and zero automated test coverage.

This document specifies the requirements for a phased refactor and production-grade upgrade roadmap. The goal is to raise correctness, maintainability, and reliability without breaking existing user-visible behavior unless a change is explicitly justified.

---

## Glossary

- **Editor**: The MusicVid Pro browser application as a whole.
- **Store**: The single Zustand store (`stores/editorStore.ts`) that holds all editor state and actions.
- **Track**: A unit of media on the timeline — one of VideoTrack, AudioTrack, or TextTrack.
- **Clip**: The visible, trimmed portion of a Track placed at a timeline offset.
- **Link**: The association between a VideoTrack and an AudioTrack established by `linkedAudioTrackId` / `linkedVideoTrackId`.
- **Timeline**: The scrollable, zoomable canvas that displays all Tracks and the Playhead.
- **Playhead**: The current-time cursor on the Timeline.
- **FFmpeg_Worker**: The FFmpeg WASM instance used for audio/video processing.
- **AudioProcessor**: The class in `lib/audio/audioProcessor.ts` responsible for time-stretching, pitch-shifting, BPM detection, and waveform generation.
- **VideoProcessor**: The class in `lib/video/videoProcessor.ts` responsible for video speed changes, thumbnail capture, and export.
- **Export_Pipeline**: The code path that renders the final output video file from the timeline composition.
- **BPM_Adjustor**: The UI and logic that time-stretches an audio track to match a target BPM.
- **Sync_Identity**: The stable, UUID-based relationship between a VideoTrack and its linked AudioTrack.
- **Object_URL**: A `blob:` URL created by `URL.createObjectURL` and revoked by `URL.revokeObjectURL`.
- **Speed_Ratio**: A positive floating-point multiplier where 1.0 = original speed, 2.0 = double speed, 0.5 = half speed.
- **Atempo_Chain**: A sequence of FFmpeg `atempo` filters chained to achieve speed ratios outside the 0.5–2.0 range.
- **Snapshot**: An immutable copy of editor state used for undo/redo.
- **Phase**: A numbered delivery milestone (Phase 0 through Phase 3) in the refactor roadmap.
- **Dexie**: The IndexedDB wrapper available in the project for client-side persistence.
- **Waveform**: A Float32Array of normalized peak amplitudes used to render audio visualization.
- **Thumbnail_Strip**: A row of canvas frames extracted from a video file for timeline display.

---

## Requirements

### Requirement 1: Sync Identity and Link Correctness

**User Story:** As a video editor, I want audio and video tracks that were linked together to stay correctly associated after any operation (split, duplicate, paste, undo, redo, speed change), so that sync relationships are never silently broken.

#### Acceptance Criteria

1. THE Store SHALL identify every audio-video link exclusively by UUID pair (`linkedAudioTrackId` on VideoTrack and `linkedVideoTrackId` on AudioTrack), never by filename or array index.
2. WHEN a VideoTrack is duplicated, THE Store SHALL create a new AudioTrack clone with a new UUID and establish a fresh link between the new VideoTrack clone and the new AudioTrack clone.
3. WHEN a linked VideoTrack is split at the playhead, THE Store SHALL either preserve the link on the primary segment or create a new extracted AudioTrack for the secondary segment, and SHALL NOT leave either segment with a dangling `linkedAudioTrackId`.
4. WHEN an undo or redo operation is applied, THE Store SHALL restore all link UUIDs to the values they held in the target snapshot.
5. IF a VideoTrack's `linkedAudioTrackId` references an AudioTrack UUID that does not exist in `audioTracks`, THEN THE Store SHALL clear the dangling reference and log a warning.
6. WHEN a speed change is applied to a VideoTrack that has a linked AudioTrack, THE Store SHALL apply the corresponding `atempo` transformation to the linked AudioTrack in the same atomic operation.

---

### Requirement 2: Speed-Ratio Semantics Consistency

**User Story:** As a video editor, I want speed ratio values to mean the same thing everywhere in the application, so that setting 2× speed always produces a clip that plays twice as fast regardless of which code path processed it.

#### Acceptance Criteria

1. THE Editor SHALL define Speed_Ratio as: `output_duration = source_duration / speed_ratio` throughout all code paths (Store, AudioProcessor, VideoProcessor, API route).
2. WHEN the VideoProcessor applies a speed change via FFmpeg WASM, THE VideoProcessor SHALL use `setpts=(1/speed_ratio)*PTS` for the video filter and the Atempo_Chain for the audio filter.
3. WHEN the API route `/api/video/speed` applies a speed change via server-side FFmpeg, THE API route SHALL use the same `setpts=(1/speed_ratio)*PTS` formula and the same Atempo_Chain construction as the client-side path.
4. WHEN the BPM_Adjustor computes a speed factor from current BPM and target BPM, THE BPM_Adjustor SHALL compute `speed_factor = target_bpm / current_bpm` and pass it as Speed_Ratio to the time-stretch operation.
5. IF a Speed_Ratio value is not a finite positive number, THEN THE Editor SHALL reject the operation and surface a user-visible error message before any FFmpeg execution begins.
6. THE Editor SHALL expose a single shared `buildAtempoChain(speedRatio: number): string` utility function and SHALL NOT duplicate this logic across AudioProcessor, VideoProcessor, and the API route.

---

### Requirement 3: Store Decomposition and Action Boundary Enforcement

**User Story:** As a developer, I want the Zustand store to be organized into clearly bounded slices so that I can reason about state ownership, prevent cross-slice mutations, and write focused unit tests.

#### Acceptance Criteria

1. THE Store SHALL be decomposed into at minimum five named slices: `tracksSlice`, `timelineSlice`, `musicalSlice`, `processingSlice`, and `uiSlice`.
2. WHEN a component reads state, THE component SHALL subscribe only to the slice fields it needs, using selector functions, to prevent unnecessary re-renders.
3. THE Store SHALL NOT allow a slice action to directly mutate fields owned by a different slice; cross-slice coordination SHALL occur through composed actions at the store root.
4. WHEN the keyboard shortcut handler modifies zoom or scroll, THE handler SHALL call a named store action rather than calling `useEditorStore.setState` directly with inline state shape.
5. THE Store SHALL expose a typed `EditorActions` interface that lists every action by name, so that components import actions by name rather than destructuring the entire store.
6. WHILE the store is being serialized for undo/redo snapshot, THE Store SHALL exclude non-serializable fields (`AudioBuffer`, `File`, `MediaStream`) from the snapshot and restore them from a separate in-memory registry.

---

### Requirement 4: Resource Lifecycle and Object URL Management

**User Story:** As a user, I want the editor to not leak memory when I add, remove, or replace media tracks, so that long editing sessions remain performant.

#### Acceptance Criteria

1. WHEN a Track is removed from the Store, THE Store SHALL call `URL.revokeObjectURL` on every Object_URL associated with that Track before removing it from state.
2. WHEN a speed-change operation produces a new Blob for a Track, THE Store SHALL revoke the previous Object_URL for that Track before assigning the new one.
3. WHEN a Track is duplicated, THE Store SHALL create a new Object_URL from the original `File` reference rather than reusing the source Object_URL.
4. WHEN the editor page is unmounted, THE Editor SHALL revoke all active Object_URLs held in the Store.
5. IF an Object_URL creation fails, THEN THE Store SHALL surface an error to the user and SHALL NOT add the Track to state.
6. THE Store SHALL maintain a registry of all active Object_URLs keyed by Track ID so that cleanup can be performed deterministically.

---

### Requirement 5: FFmpeg Job Isolation, Naming Collisions, and Concurrency

**User Story:** As a user, I want FFmpeg processing operations to not interfere with each other, so that running a speed change while a thumbnail is being generated does not corrupt either result.

#### Acceptance Criteria

1. THE FFmpeg_Worker SHALL use job-scoped filenames that include a unique job ID (e.g., `input-{jobId}.wav`, `output-{jobId}.wav`) to prevent filename collisions between concurrent operations.
2. WHEN two FFmpeg operations are requested simultaneously, THE VideoProcessor SHALL queue them and execute them serially, completing one before starting the next.
3. WHEN an FFmpeg operation is cancelled via an AbortSignal, THE FFmpeg_Worker SHALL delete any temporary files written for that job before the cancellation resolves.
4. IF an FFmpeg operation fails, THEN THE FFmpeg_Worker SHALL delete all temporary files for that job in the `finally` block, regardless of the failure mode.
5. THE Editor SHALL support at most one active video speed-change job and one active audio time-stretch job simultaneously; additional requests SHALL be queued, not dropped.
6. WHEN the FFmpeg WASM module is loading, THE Editor SHALL display a loading indicator and SHALL NOT allow processing operations to be initiated until loading is complete.

---

### Requirement 6: Export Pipeline Fidelity

**User Story:** As a user, I want the exported video to accurately reflect what I see in the timeline preview, including all track offsets, trims, volume levels, mutes, and text overlays, so that the export matches my edit.

#### Acceptance Criteria

1. WHEN the user initiates an export, THE Export_Pipeline SHALL render all non-muted VideoTracks in their timeline order, applying each track's `offset`, `trimStart`, `trimEnd`, `volume`, `fadeInDuration`, and `fadeOutDuration`.
2. WHEN the user initiates an export, THE Export_Pipeline SHALL mix all non-muted AudioTracks according to their `offset`, `trimStart`, `trimEnd`, and `volume` values.
3. WHEN the user initiates an export, THE Export_Pipeline SHALL render all non-muted TextTracks as burned-in overlays at their correct timeline positions, using each track's `x`, `y`, `fontSize`, `color`, `fontFamily`, `opacity`, `fadeInDuration`, and `fadeOutDuration`.
4. THE Export_Pipeline SHALL NOT silently fall back to exporting only the first video and first audio track when multiple tracks are present; it SHALL composite all visible tracks.
5. WHEN an export operation is in progress, THE Editor SHALL display a progress indicator with stage labels (Preparing, Encoding, Finalizing) and a percentage value derived from actual FFmpeg progress events.
6. IF the export fails at any stage, THEN THE Export_Pipeline SHALL surface a descriptive error message, clean up all temporary FFmpeg files, and leave the editor state unchanged.
7. WHEN the export completes, THE Export_Pipeline SHALL trigger a browser download of the output file and SHALL revoke the download Object_URL after the download is initiated.

---

### Requirement 7: Dead Code Removal and Module Correctness

**User Story:** As a developer, I want the codebase to contain only code that is actually executed, so that I can trust that what I read is what runs.

#### Acceptance Criteria

1. THE codebase SHALL NOT contain the stub `FFT` class in `audioProcessor.ts` that has empty `forward` and `inverse` methods; it SHALL be replaced with a real FFT implementation or removed along with the unreachable `timeStretchWithGrains` method.
2. THE codebase SHALL NOT contain the `timeStretchWithGrains` (phase-vocoder) method unless it is wired to a real FFT library and covered by tests.
3. THE `PlaybackEngine` class in `lib/playback/playbackEngine.ts` SHALL either be integrated into the playback loop used by the Store or be removed; it SHALL NOT exist as dead code alongside the RAF-based loop in the Store.
4. THE `syncVideoToAudio` method in VideoProcessor SHALL use job-scoped filenames and SHALL NOT write to the hardcoded filename `input.mp4`.
5. THE `getVideoMetadata` function SHALL detect whether a video file has an audio stream rather than always returning `hasAudio: true`.
6. WHEN the `audioBufferToWavBlob` function is needed, THE codebase SHALL use a single shared implementation rather than the two identical copies that currently exist in `audioProcessor.ts` and `editorStore.ts`.

---

### Requirement 8: Automated Test Coverage

**User Story:** As a developer, I want automated tests for the critical correctness paths so that refactoring does not silently break sync, speed, or export behavior.

#### Acceptance Criteria

1. THE codebase SHALL have unit tests for `buildAtempoChain` covering: speed ratio = 1.0, ratio = 2.0, ratio = 4.0, ratio = 0.5, ratio = 0.25, and an invalid ratio.
2. THE codebase SHALL have unit tests for `calculateBpmMultiplier` covering: equal BPMs, doubling BPM, halving BPM, and zero/negative inputs.
3. THE codebase SHALL have unit tests for `getTimelineGridConfig` covering: seconds mode, musical mode at various zoom levels, and frames mode.
4. THE codebase SHALL have unit tests for the Store's `removeTrack` action verifying that linked track references are cleaned up.
5. THE codebase SHALL have unit tests for the Store's `splitTrack` action verifying that the resulting segments have correct `trimStart`, `trimEnd`, and `offset` values.
6. THE codebase SHALL have property-based tests for the `MusicalTimeConverter` round-trip: FOR ALL valid `(bpm, timeSignature, seconds)` inputs, `musicalToSeconds(secondsToMusical(seconds))` SHALL equal `seconds` within a tolerance of 1ms.
7. THE codebase SHALL have integration tests for the export preflight check verifying that missing video, missing audio, and zero-duration timelines each produce the correct blocking error.
8. WHERE the `buildAtempoChain` function is used, THE codebase SHALL have a property-based test verifying that for any speed ratio in [0.1, 10.0], the chain evaluates to the correct cumulative speed ratio within floating-point tolerance.

---

### Requirement 9: API Memory and Performance Constraints

**User Story:** As a user, I want the video speed API route to handle large files without crashing the server, so that I can process high-resolution footage.

#### Acceptance Criteria

1. THE API route SHALL enforce a maximum upload size of 1 GB and SHALL return HTTP 413 with a descriptive message for files that exceed this limit.
2. WHEN the API route processes a file, THE API route SHALL stream the file to a temporary directory on disk rather than holding the entire file in memory as a `Buffer` beyond what is necessary for the initial write.
3. WHEN the API route completes or fails, THE API route SHALL delete all temporary files in the `finally` block.
4. THE API route SHALL set `maxDuration = 300` seconds and SHALL document this constraint in a comment.
5. IF the `ffmpeg` binary is not executable, THEN THE API route SHALL return HTTP 500 with a message identifying the binary path and the failure reason, rather than crashing the process.
6. THE API route SHALL validate that `speedRatio` is a finite positive number before writing any files to disk.

---

### Requirement 10: Playback Engine Correctness

**User Story:** As a user, I want playback to stay in sync across all active video and audio tracks, so that the preview accurately represents the final edit.

#### Acceptance Criteria

1. WHEN playback is started, THE Editor SHALL synchronize all active video elements and audio elements to `timeline.currentTime` within 250ms of the play command.
2. WHILE playback is running, THE Editor SHALL use a single RAF loop as the source of truth for `timeline.currentTime` and SHALL NOT allow individual media elements to drift more than 250ms from the RAF clock.
3. WHEN the user seeks to a new time while playing, THE Editor SHALL pause all media elements, seek them to the new time, and resume playback atomically.
4. WHEN a VideoTrack has `freezeFrameOnExtend = true` and the playhead is past the source video's end, THE Editor SHALL display the last frame of the video without attempting to play beyond the source duration.
5. IF a video element's `play()` call is rejected, THEN THE Editor SHALL log the error and SHALL NOT crash or enter an inconsistent playback state.
6. WHEN playback reaches `timeline.duration`, THE Editor SHALL stop playback and set `isPlaying = false`.

---

### Requirement 11: New Feature — Project Persistence via IndexedDB

**User Story:** As a user, I want my project to be automatically saved to the browser's local storage so that I do not lose my work if I accidentally close the tab.

#### Acceptance Criteria

1. WHEN the editor state changes, THE Editor SHALL debounce and persist the project to IndexedDB via Dexie within 2 seconds of the last change.
2. WHEN the editor page loads, THE Editor SHALL check IndexedDB for a saved project and, if found, offer the user the option to restore it.
3. WHEN restoring a project, THE Editor SHALL reconstruct Object_URLs from stored `File` objects (via the File System Access API or re-import prompt) and SHALL NOT attempt to restore `AudioBuffer` objects directly.
4. THE Editor SHALL store at most 5 project autosave slots and SHALL evict the oldest slot when the limit is reached.
5. IF IndexedDB is unavailable, THEN THE Editor SHALL fall back to the existing Zustand `persist` middleware behavior and SHALL display a warning to the user.

---

### Requirement 12: New Feature — Waveform-Aligned Snap

**User Story:** As a video editor, I want to snap clip edges to detected transient peaks in the audio waveform so that I can make beat-accurate cuts without manually scrubbing.

#### Acceptance Criteria

1. WHEN snap-to-grid is enabled and the user drags a clip edge, THE Timeline SHALL snap the edge to the nearest transient peak within a 100ms window if one exists.
2. WHEN a transient peak is within snap range, THE Timeline SHALL display a visual snap indicator on the ruler.
3. THE AudioProcessor SHALL expose a `getTransientTimes(trackId: string): number[]` method that returns cached transient positions for a given track.
4. WHEN an AudioTrack is added, THE Editor SHALL asynchronously compute transient positions and cache them on the track.
5. IF no transient is within the snap window, THEN THE Timeline SHALL fall back to the existing beat/bar grid snap behavior.

---

### Requirement 13: New Feature — Multi-Track Composite Export

**User Story:** As a video editor, I want the export to composite all my video layers, audio tracks, and text overlays into a single output file, so that the exported video matches what I see in the preview.

#### Acceptance Criteria

1. WHEN the user exports, THE Export_Pipeline SHALL build an FFmpeg `filter_complex` graph that composites all non-muted VideoTracks using the `overlay` filter at their respective `previewX`, `previewY`, `previewWidth`, `previewHeight` positions.
2. WHEN the user exports, THE Export_Pipeline SHALL mix all non-muted AudioTracks using the `amix` filter with their respective volume levels.
3. WHEN the user exports, THE Export_Pipeline SHALL burn in all non-muted TextTracks using the `drawtext` filter with the correct font, size, color, position, and fade timing.
4. THE Export_Pipeline SHALL apply track offsets by padding or trimming each track's input stream before compositing.
5. WHEN the export filter graph is constructed, THE Export_Pipeline SHALL validate that all referenced input files are available before executing FFmpeg.

---

### Requirement 14: New Feature — Keyboard-Driven Clip Editing

**User Story:** As a power user, I want to trim, nudge, and split clips using keyboard shortcuts so that I can edit without switching between mouse and keyboard.

#### Acceptance Criteria

1. WHEN a clip is selected and the user presses `[` or `]`, THE Editor SHALL trim the clip's in-point or out-point by one grid unit (beat or frame depending on grid mode).
2. WHEN a clip is selected and the user presses `Shift+[` or `Shift+]`, THE Editor SHALL trim the clip's in-point or out-point by one bar.
3. WHEN a clip is selected and the user presses `Alt+Left` or `Alt+Right`, THE Editor SHALL nudge the clip's offset by one grid unit.
4. WHEN the user presses `Ctrl+B` (or `Cmd+B` on macOS), THE Editor SHALL split all selected clips at the playhead simultaneously.
5. WHEN a keyboard shortcut is triggered, THE Editor SHALL push a history snapshot before applying the change so that the operation is undoable.

---

### Requirement 15: New Feature — Real-Time Collaboration Readiness (Architecture Only)

**User Story:** As a product owner, I want the data model to be designed so that real-time collaboration can be added in a future phase without a full rewrite, so that the architecture does not foreclose this option.

#### Acceptance Criteria

1. THE Track data model SHALL use stable UUIDs for all entity references and SHALL NOT use array indices or filenames as foreign keys.
2. THE Store actions SHALL be expressible as discrete, serializable command objects (Command Pattern) so that they can be transmitted over a network in a future phase.
3. THE Editor SHALL separate read-only derived state (computed values) from mutable state so that optimistic updates can be applied without full state replacement.
4. THE codebase SHALL document which state fields are "local-only" (e.g., `isPlaying`, `selectedTrackIds`) versus "project state" (tracks, markers, musical context) to guide future sync scope decisions.
