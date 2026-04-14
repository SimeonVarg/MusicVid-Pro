# MusicVid Pro — Comprehensive Overview

## What It Is

MusicVid Pro is a browser-based music video editor designed for musicians. It runs entirely client-side — no server uploads, no subscriptions, no installs. Users import video and audio files, arrange them on a multi-track timeline, sync everything to the beat, and export a finished music video directly from the browser. Custom pitch transposition and BPM/speed adjustments are completely free, a capability that competing tools either don't offer or lock behind paid tiers.

---

## Core Editing Capabilities

The editor provides a full multi-track timeline supporting three track types: video, audio, and text. Clips can be dragged to reposition, trimmed non-destructively by dragging edges, split at the playhead with a scissors tool, duplicated, copied, and pasted via a right-click context menu. Video tracks support z-order reordering through drag-and-drop in the track list, controlling which layer appears on top in the preview. Text tracks support custom fonts, colors, sizes, positioning, opacity, and fade-in/fade-out transitions. The timeline supports both horizontal and vertical zoom, horizontal and vertical scrolling, and a snap-to-grid system that locks clips to beat boundaries when enabled.

The video preview renders a real-time composite of all active video and text layers at the current playhead position, with support for per-clip fade opacity, color correction, stabilization effects, and drag-to-reposition/resize directly on the preview canvas. Audio tracks play back in sync with video using HTML5 audio elements managed by the playback loop.

---

## Musical Intelligence

BPM detection runs automatically when an audio track is imported, using a Web Worker to analyze the audio signal without blocking the UI. The detected tempo populates the BPM control in the toolbar and drives the entire beat grid — the timeline ruler, snap points, and metronome overlay all derive from this value. Users can override the BPM manually or use tap tempo.

The snap-to-grid system aligns clip edges and positions to beat boundaries based on the project BPM and time signature. Grid division can be set to bars, beats, or frames. The time display supports multiple modes: seconds, musical position (bars.beats.ticks), milliseconds, beat count, and frame count.

A metronome overlay provides a visual beat indicator that pulses in sync with the project tempo during playback, with configurable volume and time signature support (4/4, 3/4, 7/8, etc.).

---

## Audio Processing

Time-stretching changes the duration of an audio clip without affecting its pitch. Pitch-shifting changes the key without affecting duration. Both operations are independent and can be combined. The BPM Adjustor in the Inspector panel lets users enter a target BPM and automatically calculates the stretch ratio, with a "Preserve Pitch" toggle for maintaining key during tempo changes.

Two pitch-shifting engines are available: a standard FFmpeg-based engine (fast, good for most content) and a Rubberband WASM engine (higher quality for vocals, guitars, and melodic content). The pitch field accepts semitone values — positive to raise, negative to lower, with +12 being one octave up.

A direct speed factor field provides a simple multiplier for non-musical content (0.5 = half speed, 2.0 = double speed). All audio processing runs through FFmpeg WebAssembly, serialized by a MediaJobQueue singleton that prevents WASM deadlocks by ensuring only one FFmpeg operation runs at a time.

Waveform visualization is generated for every audio clip using a Web Worker, displaying amplitude over time directly on the timeline. Users can zoom in to see individual transients (kick drums, snare hits) for frame-accurate cut placement.

---

## Video Processing

Video speed changes (slow-motion, fast-forward) are processed via FFmpeg. The system first attempts server-side processing through a Node.js API route (`/api/video/speed`) using native FFmpeg binaries for faster performance, with automatic fallback to FFmpeg WASM in the browser if the server route is unavailable. A progress indicator shows encoding stage and percentage during processing.

Thumbnail generation extracts frames from video files for display on the timeline, using a two-pass approach: a quick low-resolution preview followed by a refined high-detail pass, with abort controller support for cancellation when the user scrolls or zooms.

Video metadata extraction (duration, dimensions) uses HTML5 video element introspection.

---

## Multi-Camera Sync

Multi-cam sync aligns video clips shot from different camera angles by comparing their embedded audio using cross-correlation. Users designate a master audio track (typically the best-quality recording), select the video tracks to sync, and hit Auto Sync. The algorithm computes the time offset between each clip's audio and the master, then repositions the clips on the timeline automatically.

Audio can be detached from video via "Split Audio from Video" in the context menu, creating an independent audio track linked to the original video. The Sync Master selector in the Inspector allows syncing additional audio tracks to a reference after the initial alignment.

---

## Recording

The recording panel captures audio directly from the user's microphone using the MediaRecorder API. A real-time level meter shows input levels before and during recording. When recording stops, the captured audio is automatically decoded, analyzed for BPM and waveform data, and placed on the timeline as a new audio track at the current playhead position. Browser compatibility is checked at runtime, with graceful fallback messaging when MediaRecorder is unavailable.

---

## Export

The export system builds an FFmpeg `filter_complex` command from the entire timeline state — all video layers with overlay compositing, audio tracks with mixing, text overlays with drawtext filters, fades, trims, and time offsets. Platform presets for YouTube (16:9, 1080p), Instagram (9:16, 1080×1920), and TikTok (9:16, 1080×1920) automatically configure resolution, aspect ratio, and encoding settings. Format options include MP4 (H.264) and WebM. Export runs entirely in the browser via FFmpeg WASM with a progress indicator. The rendered file downloads automatically when complete.

---

## Persistence and State Management

Projects are saved to IndexedDB via Dexie, storing track metadata, clip positions, BPM settings, effects, and raw file blobs across three tables (projects, tracks, files). Non-serializable fields (File objects, AudioBuffers) are stripped on save and restored on load via the MediaRegistry. The save/load system supports multiple named projects with list and delete operations.

Application state is managed by a single Zustand store composed from six domain slices: UI (inspector, dialogs, selection, clipboard), Timeline (current time, zoom, scroll, markers, musical context), Playback (play/pause/stop, rate), Tracks (video, audio, text CRUD), Processing (BPM adjustor, video speed, sync, recording, export settings), and Tutorial (active state, step index, mode, progress). All mutations use Immer for immutable updates. An undo/redo system maintains up to 50 history snapshots per session using manual snapshot arrays, with careful exclusion of tutorial state from the history stack.

Object URLs are managed by a centralized MediaRegistry with reference counting — URLs are created via `register()`, shared via `addRef()`, and automatically revoked when the reference count reaches zero via `release()`. This prevents memory leaks from orphaned blob URLs.

---

## Interactive Tutorial System

An overlay-driven tutorial guides new users through the editor with a spotlight that highlights real UI elements and a floating tooltip with step-by-step explanations in musician-friendly language. Two modes are available: a Quick Tour (10 steps covering the essentials) and a Dev Tour (52 steps covering every feature in depth). Users choose their mode from a welcome dialog on first load or from the persistent help button in the toolbar.

The tutorial system uses `data-tutorial` attributes on target elements for decoupled DOM targeting, a `useTutorialController` hook for step sequencing and spotlight geometry (with ResizeObserver and scroll-into-view support), SVG mask-based spotlight rendering, viewport-clamped tooltip positioning, ARIA live regions for screen reader announcements, full keyboard navigation, and an Escape-key pause prompt. Progress is persisted independently per mode in localStorage under a versioned key with automatic migration from older schema versions.

---

## Technology Stack

- **Framework**: Next.js 14 (App Router) with React 18
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3 with `tailwindcss-animate`, class-variance-authority (CVA), clsx, tailwind-merge
- **State**: Zustand with Immer middleware, devtools, and persist
- **Audio/Video Processing**: FFmpeg WASM (`@ffmpeg/ffmpeg`), Web Audio API, Tone.js, Rubberband WASM, standardized-audio-context
- **Canvas Rendering**: Konva / react-konva
- **UI Components**: Radix UI primitives (Dialog, Label, Progress, RadioGroup, Separator, Slider), Lucide React icons
- **Animation**: Framer Motion
- **Persistence**: Dexie (IndexedDB wrapper)
- **Testing**: Vitest, @testing-library/react, fast-check (property-based testing), jsdom
- **Server-side**: Node.js runtime for `/api/video/speed` route using ffmpeg-static and ffprobe-static
- **Build**: Webpack (via Next.js) with WASM asset handling, client-side Node module stubs, canvas alias

---

## Architecture Highlights

- All editor UI components are client components (`'use client'`); the Timeline is dynamically imported with `ssr: false` since Konva requires browser APIs
- CPU-intensive audio analysis (BPM detection, waveform generation) runs in a dedicated Web Worker via a promise-based client wrapper
- FFmpeg WASM is loaded lazily from CDN on first use and shared as a singleton through MediaJobQueue
- The store is split into six domain slices with types and initial state defined in separate files, composed into a single store in `editorStore.ts`
- Structured error handling uses a typed `AppError` model with error codes, user-facing messages, and a recoverable flag; all async operations convert errors via `toAppError()` before surfacing to the UI
- A lightweight typed telemetry event bus supports console logging in development and pluggable handlers in production
- 220 tests cover unit logic, component rendering, and correctness properties verified across arbitrary inputs using fast-check
