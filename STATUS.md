# MusicVid Pro — Status (July 5, 2026: hardening + design sessions)

## Round 2 (same day): design system + first-run polish

- **Full de-slop.** One deliberate direction: "the editor as instrument" —
  near-black zinc base, a single **signal chartreuse** accent (custom `signal`
  scale in tailwind.config; solid fills always pair with dark text), Syne for
  display headings, Archivo for UI, JetBrains Mono for timecode/badges. The
  landing hero is now "Cut video like you play music." in Syne with a mono
  status badge; the feature section is a ruled spec-sheet grid with mono index
  numbers, not pastel cards. All 56 purple references across 23 editor files
  swapped to signal (audio clips on the timeline are now lime, video cyan,
  text pink). Exported metronome overlay boxes are chartreuse/white to match.
- **"Load demo project" button** on the empty tracks panel: bundled 16s
  brand-gradient clip (`public/demo/demo-clip.mp4`, 700KB) + a synthesized
  120 BPM groove (`demo-track.mp3`, 87KB). Verified: loads in ~1s, BPM
  detects exactly 120. The conference demo no longer depends on local files.
- **Metronome overlay defaults OFF** (was on: doubled export time and put a
  surprise flashing box in first exports). Toggle with M — turning it ON is
  now a feature moment, not a trap.
- **First-run modal simplified**: strangers see "Take the tour (2 min)" only;
  the 52-step Dev Tour still lives behind the `?` button.
- Stale persisted timeline duration cleared on reload.
- Verified this round: landing + editor visuals in browser, demo-project
  import, playback, full TikTok export end-to-end (single-pass, no metronome),
  zero console errors, 220/220 tests, clean production build.

---

# Round 1 notes (hardening)

Session goal: survive a cold YC-partner demo on conference wifi. Everything below
was verified by driving the real app in a browser (import → edit → play → export),
not by code reading alone.

## Verified working (end to end, July 5)

- **Import**: video (MP4) + audio (MP3) via Upload rail *and* drag-and-drop
  (new). Waveform renders, thumbnails generate, no console errors.
- **Playback**: play/pause advances time, preview renders frames, no errors.
- **BPM detection**: 120 BPM click track now detects as 120 (was 20 — see fixes).
- **Export (the money path)**: YouTube 1080p preset, metronome overlay ON
  (default), full pipeline: main encode → metronome overlay pass → download.
  ~90s for the main encode of a 30s timeline, ~+80s more with metronome overlay.
- **Onboarding tour**: Quick Tour steps through and exits cleanly; adaptively
  skips steps when no tracks exist. Tour choice persists (no re-nag on reload).
- **Small windows**: editor now usable down to ~570px wide (see fixes).
- **Production build**: `npm run build` passes (types + lint).

## Fixed this session (commits `4ef305f`, `e67dbb5`, `c84d3be`)

1. **Crash on import at small window sizes** — Konva Stage rendered at 0×0
   while the timeline pane was collapsed by the fixed-width side panels; any
   shadowed shape then drew through a 0-size buffer canvas → unhandled
   `InvalidStateError` on the first imported clip. Stage now waits for real
   dimensions, and side panels are clamped (`28vw`/`32vw`) so the timeline
   never collapses. This also fixes 1024px-projector layouts.
2. **Every default export failed after minutes of encoding** — the metronome
   overlay pass (`showMetronome` defaults ON) used a drawbox alpha *expression*
   (`color=purple@if(...)`), which aborts the whole ffmpeg filter graph. Users
   saw "Export failed" *after* the full encode. Rewritten with constant alpha +
   `enable` timeline expressions (beat pulse + brighter bar-downbeat pulse).
3. **Export depended on conference wifi** — ffmpeg-core (31MB wasm) was fetched
   from unpkg at export time, contradicting the "nothing leaves your device"
   pitch. Now vendored in `public/ffmpeg` (loads locally, unpkg fallback), and
   a failed load no longer poisons the queue forever (retry works).
4. **Exports were ~5x slower than necessary** — x264 `medium` in single-threaded
   WASM runs ~0.1x realtime. All presets now use `superfast`; at 5–8 Mbps the
   quality difference is invisible.
5. **BPM detection could only ever return 6–60 BPM** — the peak-interval
   histogram bounds were off by ~10x, so every real song fell to the fallback
   bin (reported "20 BPM"). Bounds now derive from 40–220 BPM; fallback 120.
6. **No drag-and-drop** — added a full-window drop target with overlay; empty
   state copy now tells users they can drop files.
7. Cosmetics: mojibake in the preview overlay ("1280 ÃƒÆ'... 720" → "1280 × 720"),
   landing "View Source" pointed at bare `github.com` (now the real repo),
   AbortError console spam from the play/pause race silenced.

## Known remaining, ranked by demo impact (updated after round 2)

1. **Swap the demo clip for real footage of you playing.** The bundled
   gradient clip proves the flow, but 15 seconds of you at a drum kit makes
   the demo *land* ("I made a music video of myself in 60 seconds"). Drop a
   new file over `public/demo/demo-clip.mp4` (keep it ≤20s, H.264 720p) and
   optionally a real track over `demo-track.mp3`.
2. **BPM detector is a simple energy autocorrelation** — verify it on your
   actual demo song beforehand; octave errors (60 vs 120) are possible on
   sparse/legato music. Tap tempo (`T`) is the on-stage fallback.
3. **Metronome overlay still doubles export time when enabled** (second full
   encode). Proper fix: fold the drawbox into the main filter graph.
4. Push/merge decision: all work is on `feature/updates-apr14`; live site
   updates only when you merge to main.

## Deploy state

- Branch `feature/updates-apr14` has all fixes committed locally.
  **Not pushed/merged to production** — push the branch for a Vercel preview,
  click-test it, then merge to main to update music-vid-pro.vercel.app.
- The 31MB wasm in `public/ffmpeg` is intentional (wifi-proofing); well under
  GitHub/Vercel limits.

## Dev notes

- `.claude/launch.json` at `Projects/` level: `musicvid-pro` on :3000.
- Dev-only console handles: `window.__editorStore` (Zustand store),
  `window.__mediaJobQueue` (`.engine` exposes FFmpeg for log listeners).
- Local test media: `public/__test-video.mp4` (20s 720p), `public/__test-beat.mp3`
  (30s, 120 BPM clicks) — gitignored.
