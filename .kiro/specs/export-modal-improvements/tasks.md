# Implementation Plan: Export Modal Improvements

## Overview

All changes are confined to `components/editor/ExportModal.tsx`. The plan proceeds in four incremental steps: layout fix, export mode + audio-only pipeline, quality tier selector, and preflight consistency — finishing with property-based tests.

## Tasks

- [x] 1. Fix scrollable layout and always-visible footer
  - Wrap `DialogContent` with `flex flex-col max-h-[90vh]`
  - Move the options area into a `flex-1 overflow-y-auto min-h-0` div with a bottom fade gradient (`mask-image` CSS)
  - Move the Cancel and Export buttons into a separate sticky footer div with `border-t border-zinc-800 pt-4`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add Export Mode selector and audio-only pipeline
  - [x] 2.1 Add `exportMode` and `audioFormat` state and the Export Mode radio UI
    - Add `useState<'video' | 'audio-only'>('video')` and `useState<'mp3' | 'wav'>('mp3')` hooks
    - Render a two-option radio group (`Video` / `Audio Only`) at the top of the scrollable area
    - Show the audio format selector (`MP3` / `WAV`) only when `exportMode === 'audio-only'`
    - Hide the Platform Preset and Quality Tier sections when `exportMode === 'audio-only'`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Implement the audio-only FFmpeg pipeline in `handleExport`
    - Branch on `exportMode`: when `'audio-only'`, skip `TimelineCompositor`, build a direct `amix`/`acopy` filter, encode with `libmp3lame` (MP3) or `pcm_s16le` (WAV)
    - Set the download filename to `export-audio-${Date.now()}.${audioFormat}`
    - Guard against zero active audio tracks before enqueuing the job
    - _Requirements: 2.4, 2.6_

  - [ ]* 2.3 Write unit tests for audio-only pipeline logic (`__tests__/exportModal.test.ts`)
    - `runPreflight('audio-only')` with no video tracks → no video blocking error
    - `runPreflight('audio-only')` with no unmuted audio tracks → blocking error present
    - Download filename ends with `.mp3` when format is `mp3`; ends with `.wav` when format is `wav`
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 2.4 Write property test — Property 2: audio-only preflight suppresses video errors (`__tests__/exportModal.property.test.ts`)
    - **Property 2: Audio-only preflight suppresses video errors**
    - For any timeline state with no video tracks, `runPreflight('audio-only')` never returns a video-related blocking error
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.5 Write property test — Property 3: audio-only preflight blocks on no audio tracks
    - **Property 3: Audio-only preflight blocks on no audio tracks**
    - For any timeline state where all audio tracks are muted or absent, `runPreflight('audio-only')` always returns the no-audio blocking error
    - **Validates: Requirements 2.5**

  - [ ]* 2.6 Write property test — Property 5: download filename extension matches audio format
    - **Property 5: Download filename extension matches audio format**
    - For any audio format in `['mp3', 'wav']`, the generated download filename ends with `.${format}`
    - **Validates: Requirements 2.6**

- [x] 3. Add Quality Tier selector and bitrate override
  - [x] 3.1 Add `qualityTier` state and the Quality Tier radio/button UI
    - Add `useState<'low' | 'medium' | 'high' | 'ultra'>('high')` hook
    - Define `QUALITY_TIER_BITRATES` constant mapping tiers to `{ bitrate, label }` (Low 2M, Medium 5M, High 8M, Ultra 15M)
    - Render a four-option selector showing tier name and approximate bitrate label
    - Show only when `exportMode === 'video'`
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 3.2 Apply quality tier bitrate override in `handleExport`
    - Shallow-copy the active `EXPORT_PRESETS[presetKey]` and replace `bitrate` with `QUALITY_TIER_BITRATES[qualityTier].bitrate` before passing to `TimelineCompositor.build()`
    - _Requirements: 3.3_

  - [ ]* 3.3 Write unit test for quality tier override (`__tests__/exportModal.test.ts`)
    - Quality tier `high` produces bitrate `8M` in the preset passed to the compositor
    - _Requirements: 3.3_

  - [ ]* 3.4 Write property test — Property 1: quality tier bitrate override is applied (`__tests__/exportModal.property.test.ts`)
    - **Property 1: Quality tier bitrate override is applied**
    - For any preset key and quality tier, the bitrate in the composed preset equals `QUALITY_TIER_BITRATES[tier].bitrate`
    - **Validates: Requirements 3.3**

- [x] 4. Update `runPreflight` to accept `exportMode` and fix preflight consistency
  - [x] 4.1 Refactor `runPreflight` to accept `mode: 'video' | 'audio-only'`
    - When `mode === 'audio-only'`: skip "No video tracks" and "No exportable video file" errors; add blocking error if no unmuted audio tracks have files
    - When `mode === 'video'`: retain all existing blocking errors unchanged
    - Pass `exportMode` from state when calling `runPreflight` in the `useEffect` and in `handleExport`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 Write unit tests for preflight mode consistency (`__tests__/exportModal.test.ts`)
    - `runPreflight('video')` with no video tracks → blocking error present
    - `runPreflight('audio-only')` with zero timeline duration → "Timeline is empty" error present
    - _Requirements: 4.3, 4.4_

  - [ ]* 4.3 Write property test — Property 4: video preflight retains all existing video errors (`__tests__/exportModal.property.test.ts`)
    - **Property 4: Video preflight retains all existing video errors**
    - For any timeline state with no video tracks, `runPreflight('video')` always returns a video-related blocking error
    - **Validates: Requirements 4.3**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `runPreflight` must be extracted as a pure function (or accept injected state) to be unit-testable outside the component
- Property tests use `fast-check` with a minimum of 100 iterations per property
- All UI follows the existing Tailwind dark palette (`zinc-*`, `purple-*`) and Radix RadioGroup primitives
