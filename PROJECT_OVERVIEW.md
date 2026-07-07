# MusicVid Pro — Project Overview

> Running log of changes lives in `STATUS.md`; demo walkthrough in `DEMO_SCRIPT.md`.
> This file is the stable "what it is / why it's built this way" reference.

## What it is
A **serverless, browser-based music video editor**. Import video + audio, arrange
a multi-track timeline, trim, color-grade, add titles and a metronome overlay,
then export a finished MP4 — and **every byte of encoding happens client-side**.
Nothing is uploaded; there is no server. It's the flagship YC Startup School demo:
"I make a music video of myself in 60 seconds, and it never leaves my laptop."

**Stack:** React 18 + TypeScript (Next.js), **Zustand** for the editor store,
**FFmpeg WebAssembly** for all encoding/pitch-shifting, **Web Workers** for
off-thread audio analysis + BPM detection, **IndexedDB via Dexie** for project
persistence, **Konva** for the timeline canvas.

## Why the big decisions
- **Client-side everything (the whole thesis).** Cloud video editors are
  expensive and slow and see your footage. Forcing FFmpeg into WASM in the browser
  makes it zero-cost, private, and infinitely scalable (the user's device is the
  render farm). This is also the single most impressive engineering claim — it was
  Simeon's headline answer on the YC application.
- **Vendored FFmpeg core, not CDN-loaded** (`public/ffmpeg`). The 31MB wasm used
  to fetch from unpkg at export time — which meant "nothing leaves your device"
  was a lie *and* the demo died on conference wifi. Now bundled locally. This was a
  demo-saving fix.
- **Web Workers + Transferable Objects (zero-copy).** Audio analysis and BPM
  detection run off the UI thread; 50MB+ audio buffers are moved with Transferable
  ArrayBuffers instead of structured-clone copies, killing a transfer bottleneck.
  A `MediaJobQueue` with an explicit `cleanup()` revokes object URLs / terminates
  workers to prevent browser memory leaks (manual memory lifecycle).
- **One source of truth for preview *and* export.** Color grades
  (`lib/video/colorAdjustments.ts`) and titles (`lib/video/titleStyles.ts`) each
  compute once and feed both the live CSS-filter preview and the baked ffmpeg
  filter graph — so what you see is what you export. FFmpeg filters are
  deliberately restricted to universally-safe ones (`eq`/`hue`) to avoid
  export-time graph failures.
- **Bundled fonts for titles.** WASM ffmpeg ships no system fonts, so `drawtext`
  silently aborted the whole export the moment you added text. Now a Noto font is
  written into the ffmpeg FS before export. (A class of bug worth remembering:
  WASM ffmpeg has *no* ambient OS resources — fonts, codecs must be provided.)
- **"Signal chartreuse" design system** — near-black zinc base, one lime accent,
  Syne/Archivo/JetBrains-Mono. A deliberate "editor as instrument" identity so the
  app reads as a designed product, not a bootcamp project.
- **Bundled demo project** (`public/demo`) so the conference demo depends on zero
  local files — click "Load demo project" and it's populated.

## State
Feature-complete and browser-verified end-to-end (import → edit → play → export →
download), 233/233 tests, clean production build. All work is on branch
`feature/updates-apr14` — **live site (music-vid-pro.vercel.app) updates only when
merged to main.** Top remaining item: swap the bundled gradient demo clip for real
footage of Simeon playing.

## Where to look
- `STATUS.md` — full change log + known-remaining, ranked by demo impact.
- `stores/` — the Zustand editor store (`window.__editorStore` in dev).
- `lib/video/` — the preview/export single-source-of-truth modules.
