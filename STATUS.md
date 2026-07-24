# MusicVid Pro — Status (July 24, 2026: cycle-region loop, mode layout split)

## Round 8 (July 24 pm): GarageBand-style loop + beats-mode layout

### Loop, rebuilt to match other DAWs (owner: "still literally cannot get loop to work")
The prior fix corrected the transport math but left the real problem: **there was
no visible, draggable loop region.** Every DAW (GarageBand cycle bar, Ableton loop
brace, FL playlist selection) shows a region you can see and drag; ours only
flipped an invisible flag, so clicking Loop + Play did something you couldn't see
or control. Fixed by adding a real **cycle region** to the timeline:
- A signal-green **cycle lane** at the bottom of the ruler (always faintly
  visible so it's discoverable). Drag in it to create a loop; drag the body to
  move it; drag either edge to resize. Snaps to the beat grid when snap is on.
- A **band** in the lane + a **full-height tint** over the tracks show exactly
  what repeats. (`CycleRegion` in `Timeline.tsx`; drag handled in the Stage
  mouse handlers via `loopDragRef`, mirroring the existing scrub path.)
- The transport already cycles this correctly (round 7 fix).

**Verified for real this time (not a synthetic poke):**
1. **Transport logic** — `__tests__/transportLoop.test.ts` drives the actual
   `play()` rAF loop with a deterministic fake clock. Proves: an 8s loop over a 2s
   clip cycles instead of freezing; a sub-region [2s,4s] stays inside itself; and
   with no loop, playback still stops at duration. 3/3 green.
2. **Cycle-region rendering** — sampled the real Konva canvas pixels at three loop
   positions (1-3s, 3-5s, 0.5-1.5s); the green band lands exactly on
   `[start*px, end*px]` and nowhere else, and the track tint only appears inside.
- ⚠️ **Not verifiable in this sandbox:** the physical mouse-drag gesture on the
  cycle lane, because the Browser pane runs `visibility:hidden` so rAF never fires
  — which kills both the transport's rAF *and* react-konva's rAF-batched redraw.
  The drag handlers reuse the working scrub-handler pattern and the verified
  coordinate math, but the gesture itself needs a real-browser click to confirm.

### Beats mode is now a DAW layout, not a video editor with a piano roll
Owner: "turning on beat mode should cause the video options to go away." The
biggest offender was the **video monitor** still dominating the screen in Beats
mode. Now (`app/editor/page.tsx`) `mode === 'daw'` hides the preview pane entirely
and the **timeline/arrangement fills the workspace**; Video and Hybrid keep the
monitor. DOM-verified across all three modes (preview present in video/hybrid,
absent in daw; timeline canvas mounts in all).

### KONVA VERIFICATION GOTCHA (new, cost real time — don't relearn)
react-konva batches its canvas draws through `requestAnimationFrame`. In the
hidden preview pane rAF is throttled to ~never, so **the Konva timeline paints
once on mount and then freezes** — changing store state updates the Konva node
tree but never repaints, so pixel reads go stale and look like nothing rendered
(chased a phantom "CycleRegion doesn't draw" for several probes). To pixel-verify
the timeline: change state → `await ~60ms` (React 18 commits via MessageChannel,
which *does* fire while hidden) → `window.Konva.stages.forEach(s => s.draw())` to
force a synchronous paint → then sample. Also: a hard reload is needed after
adding a new Konva child (HMR served a stale bundle → "0 green pixels").

---

# MusicVid Pro — Status (July 24, 2026: clip loop = repeat-to-fill)

## Round 9 (July 24): the REAL loop — repeat the content, not cycle the playhead

Owner correction (third time on "loop", so read carefully): **"loop" means repeat
the selected notes/audio to fill a length** — the GarageBand loop where you drag a
region's corner and the content tiles with notches. It does NOT mean cycling the
playhead over a region. That playhead-cycle feature still exists but is now named
**Cycle** (GarageBand's own term), freeing "Loop" for repeat-to-fill.

### What shipped (MIDI clips)
- **Pure tiling core** (`lib/midi/noteUtils.ts`): `tileLoopedNotes(notes, contentBeats,
  playedBeats)` repeats a pattern to fill a length, trimming the last repeat; unique
  ids per repeat. `midiPlayedLengthBeats()` picks content-vs-loop length. Fully unit
  tested (deterministic — the real verification, not a browser poke).
- **Model**: `MidiTrack.loopLengthBeats?` (optional, back-compat). `syncMidiTrackDuration`
  uses the played length; `toPlayableMidi` and `renderMidi` tile the notes so both
  playback AND export sound the repeats. Non-destructive: the stored `notes` stay the
  single pattern.
- **Drag to loop**: `resizeTrackEdge` gained a MIDI branch — dragging a MIDI clip's
  right edge past its content sets `loopLengthBeats` (GarageBand loop handle); dragging
  back inside clears it. The timeline note-preview tiles live during the drag, with
  dashed notch dividers at each repeat boundary.
- **Discoverable control**: Inspector MIDI section has a **Loop: Off/×2/×4/×8** row
  (`setMidiLoopLength`), for people who won't find the drag handle.
- Fixed a violet the earlier purge missed: MIDI clip hover was `#a78bfa` → signal.

### Verification (deterministic, browser-independent — the pane won't composite here)
- `tileLoopedNotes`: 4 unit tests (fill 16 from 4 = 4 repeats at the right beats,
  unique ids, final repeat trimmed, no-op when not looping).
- Store: `setMidiLoopLength` doubles/quadruples clip duration + only loops past content;
  looping is non-destructive; **`resizeTrackEdge('end')` drag path** sets/clears the loop.
- 265/265 suite, clean production build (`/editor` 173 kB).
- ⛔ NOT visually verified (pane won't composite): the on-clip notches and Inspector
  Loop row rendering — logic is proven, the *look* needs a real-browser eyeball.
- ⏭ Audio-clip looping not done yet — MIDI (beats) first. Audio repeat-to-fill is next.

---

# MusicVid Pro — Status (July 24, 2026: modes, loop fix, latency sync)

## Round 7 (July 24): three modes, loop fix, purple purge, Bluetooth sync

### Loop was genuinely broken — root cause + fix
The transport clamped `currentTime` to `timeline.duration` but compared the
**unclamped** `elapsed` against `loop.end`. The piano-roll Loop button set
`end` from the padded 8-bar grid (min 16s @120bpm) while an empty MIDI clip's
`duration` is 2s — so the playhead ran to 2s and **froze there for 14 seconds**
before jumping back. Reproduced in-browser before fixing (samples every 500ms:
`0.51, 1.03, 1.55, 2, 2, 2, 2, 2, 2, 2`).
- Transport now bounds by `loop.end` while looping, by `duration` otherwise.
  Verified after: `0.5 … 5.69` then wraps to `0.21` and keeps cycling.
- Piano-roll Loop now loops the **clip's musical extent** (`track.duration`,
  already bar-rounded by `contentLengthBeats`) instead of the padded grid.
- Main Loop button no longer silently no-ops on an empty project — falls back
  to a 2-bar cycle when there's no region and no content.
- Regression-checked: with no loop, playback still stops exactly at `duration`
  (5.32 → `isPlaying:false`).

### Modes: Video / Beats / Both (replaces the advanced-audio toggle)
`advancedAudio: boolean` → `mode: 'video' | 'daw' | 'hybrid'` with two derived
predicates, `showsAudioTools()` / `showsVideoTools()`, exported from the store.
The goal is the anti-DaVinci-Resolve: you never see tooling for the job you
aren't doing. Segmented control sits next to the brand as the primary
"what am I making?" control. Defaults to `video` (unchanged clean first run).
- **Video** — no instruments/mixer/metronome/loop; keeps guides, snapshot, text.
- **Beats** — instruments, piano roll, mixer, click, loop; hides composition
  guides, snapshot, and the Text rail (video-titling tools).
- **Both** — everything.
- Switching to Video closes the mixer/piano roll so a modal can't strand open.
- TrackList gains "Add Instrument"; "Add Video" hides in Beats mode.
- Verified per-mode visibility in-browser (offsetParent checks), all 3 modes.

### Purple purge
The violet (`#8b5cf6` and friends) was **not** part of the design system — it was
introduced here to distinguish MIDI and it bled across the piano roll, timeline,
mixer, inspector and track list. MIDI and audio are both *sound*, so MIDI now
lives in the `signal` family (clip `#84b31a` signal-600 vs audio's `#a3d924`),
keeping the palette to one accent + cyan video + pink text. Active piano keys use
dark text on signal per the design-system rule. Verified: no `violet` left in the
DOM; note fill computes to `rgb(132,179,26)`.

### Bluetooth / output-latency compensation
Audio we schedule is *heard* one output-latency later — Bluetooth adds ~150–300ms,
so an uncompensated playhead runs ahead of the sound. `AudioContextManager.
outputLatencySec()` reads `baseLatency + outputLatency` (0 on wired, so this is a
no-op there). Scheduling is left alone; the **visual** clock lags by the same
amount: the transport seeds `playbackStartMs` L ahead and subtracts L when
reporting, so `currentTime` tracks what you're hearing. Seeks seed the same offset
so they don't jump backwards. Toggle + live detected-ms readout in Settings.
- ⚠️ **Not verified against a real Bluetooth device** — this machine reports 0ms
  (wired), so only the wiring and the no-regression path are proven. Test with
  BT headphones before demoing it.

### Persisted-state gotcha (bit us here, will bite again)
zustand `persist` merges stored state **over** initial state, so any new field
added to a persisted slice is `undefined` for existing users —
`latencyCompensation` vanished until guarded with `?? true`. Same reason `pan` /
`isSoloed` are optional with `??` defaults. Add new persisted fields defensively.

### Verification-environment notes (don't misread these as bugs)
The Browser pane doesn't composite, which means: `requestAnimationFrame` never
fires (transport appears frozen — shim rAF with `setTimeout` to test playback),
screenshots time out, and **`getComputedStyle` returns stale values**. The mode
switcher looked like it had a stuck highlight until `className` inspection showed
React was updating correctly. Assert on `className`/DOM, not computed style.
Also: running `npm run build` mid-session overwrites `.next` and makes the dev
server serve production chunks (dev-only `window.__editorStore` disappears) —
delete `.next` and restart.

- Full suite 256/256; production build clean (`/editor` 173 kB).
- ⛔ Still unverified visually (pane won't composite): the actual *look* of the
  mode switcher and the new green MIDI colours. Worth a 30-second eyeball.

---

# MusicVid Pro — Status (July 7, 2026: MIDI / DAW instrument tracks)

## Round 5 (July 7): MIDI instrument tracks + piano roll (branch `feature/midi-daw`)

MusicVid Pro is now also a lightweight DAW: you can add **instrument (MIDI)
tracks**, write/edit notes in a piano roll, hear them with **real instrument
samples**, and they render into the video export.

- **Scope check (told the owner up front):** MIDI is cheap — notes are bytes,
  synthesis is faster-than-realtime. The only heavy part is the piano-roll UI.
  Fully in scope; no computational concern.
- **Real samples, not synths** (owner's explicit ask — Opus's MusicTools synths
  sounded fake). Vendored 108 real recordings in `public/samples` (~16.5 MB):
  Salamander grand piano (CC-BY), VSCO2 bass/guitar/violin/sax/xylophone,
  Tone.js drum kits (acoustic + CR-78). Three synths exist but are explicitly
  labelled "Synth" extras. Attribution in `public/samples/ATTRIBUTION.md`.
- **New `midi` track type** (a 4th clip kind) threaded through the whole store:
  add/import/notes/instrument/transpose/quantize/velocity actions, undo/redo,
  timeline-duration math (BPM-relative — clip length rescales with project BPM),
  copy/paste/duplicate, save/load (plain JSON, no blobs). `lib/midi/*`:
  noteUtils (pure, tested), instruments catalog, midiImport (@tonejs/midi),
  toneInstruments (sampler/drums/synth voices), playbackEngine (realtime),
  renderMidi (offline → WAV), wav encoder.
- **Piano roll** (`components/editor/PianoRollEditor.tsx`): click-to-add, drag to
  move, drag right edge to resize, Delete to remove, a **velocity lane**,
  instrument picker, snap grid (1/4…1/16 + triplets), quantize, transpose,
  zoom, real-sample audition on interaction. Opens via the timeline (double-click
  a MIDI clip), the toolbar Piano button, or the Inspector "Edit notes" button.
  UI (owner feedback, July 7): a **windowed panel** (not fullscreen, dimmed
  editor behind), a full **vertical piano keyboard** with **every** key labelled
  (white/black keys), note names shown inside each note block, and a green
  **playhead** with a numbered ruler you can click to seek. Velocity is a
  per-note **popover** anchored above the selected note (slider + Softer/Louder),
  not a persistent bottom lane. Verified in-browser: playhead tracks currentTime,
  ruler-click seeks to the right second, velocity slider writes 40/127 → 0.315.
- **Timeline**: MIDI clips render violet with a live note-preview; **Inspector**
  gains a full MIDI section. **Import**: drop a `.mid` file to get instrument
  tracks (tempo adopted from the file).
- **Export**: each MIDI track is offline-rendered to a WAV and fed to ffmpeg as
  an ordinary audio input (placed at its offset by the compositor's adelay).
  Audio-only export doesn't include MIDI yet (video export does) — flagged in the
  dialog.

### Piano-roll DAW polish (July 7, owner feedback)
- **Drag-to-select marquee**: dragging on empty grid draws a selection rectangle
  and selects the notes inside; a plain click still adds a single note. No more
  notes placed on every drag.
- **Loop**: `timeline.loop` is now honored by the transport (rAF tick wraps at
  `loop.end` → `loop.start` and reschedules MIDI) via a new `setLoop` action; a
  Loop toggle in the piano-roll header loops the clip.

### Round 6 (July 8, owner feedback round 2) — verified in-browser
- **Backspace *actually* fixed this time.** The real cause was NOT browser
  back-nav (Chrome removed that years ago) and NOT the piano-roll guard. It was a
  *competing* global `window` listener in `lib/hooks/useKeyboardShortcuts.ts`
  whose Backspace branch deletes the selected track — and the open MIDI track is
  the selected track, so deleting it made `track` null and unmounted the whole
  modal ("exited the menu"). The piano roll's `stopPropagation()` never helped,
  because that does not stop *sibling* listeners on the same target (window). Fix:
  the global shortcut handler now **bails while a modal is open**
  (`if (pianoRollTrackId || exportDialogOpen) return;`). This also killed a latent
  Space double-toggle. Verified: real Backspace keydown on window → note deleted,
  modal still open, header still "Piano Roll", track still exists.
- **Multi-select now operates on the whole selection.** Marquee-selecting several
  notes and then dragging one moved only the grabbed note (and right-click only
  affected one). `DragState` now carries the full id set + per-note original
  snapshot; move/resize apply an anchor-snapped delta to every selected note so
  relative timing/pitch stays locked. The note context menu (velocity, transpose,
  set-length, duplicate, delete) acts on the whole selection and no longer
  collapses it. Verified: 3 notes marquee-selected → dragging one shifted all 3 by
  +1 beat, all stayed selected; right-click showed "Duplicate 3" / "Delete 3
  notes" with the selection intact.
- **Loop in the main editor**: a Loop toggle in the Toolbar playback group loops
  the selected in/out region (I/O) if set, else the whole timeline; reuses the
  same `setLoop` + transport path. Verified toggling on/off in-browser.
- **Known dev-only issue (flagged, not fixed):** opening the piano roll logs a
  React "setState during render" warning (TimeDisplay/PianoRollEditor). It's
  dev-only (stripped from production builds), pre-existing, and does not affect
  behavior. Tracked as a follow-up.

### Round 6 — Deliverable 1: Advanced-audio gating + click track (July 8)
Scope correction from the owner: MusicVid Pro is **mainly a video editor**; a
first-time non-DAW user seeing every DAW control gets overwhelmed and leaves. So
the DAW depth now hides behind an **Advanced audio** toggle (progressive
disclosure) and the default view stays a clean video editor.
- **Advanced-audio toggle** (`advancedAudio` in uiSlice, off by default). A
  SlidersHorizontal button in the toolbar reveals/hides the DAW controls: the
  Add-instrument (MIDI) button, the metronome, and the main-editor Loop button.
  Verified: default view hides all three; toggling on reveals them.
- **Audible metronome / click track** (`lib/audio/metronome.ts`). Previously the
  metronome was visual-only. Now it plays a real woodblock-ish click on every beat
  during playback (accent on the downbeat), using the shared AudioContext and a
  lookahead scheduler (the Web Audio "two clocks" pattern) so clicks stay on-beat
  regardless of rAF jitter. A synthesized click is the one correct place for a
  tone — a metronome is a click, not an instrument — so this does NOT break the
  "real samples, not synths" doctrine. Verified in-browser: click oscillators are
  scheduled continuously while playing (0 → 37 over the play span) and stop on
  pause.
- **Count-in** (`musical.countInBars`, Off/1/2 bars). When the metronome is on,
  Play first plays N bars of clicks, then starts the transport at the playhead.
  Verified: with 1 bar set, Play holds `isPlaying=false` through the count-in,
  then flips true and playback + click continue.
- **Click volume** slider (`musical.metronomeVolume`). Both count-in and click
  live in the toolbar Settings → "Advanced audio" section (only shown when
  advanced audio is on). The metronome/loop restart correctly on loop-wrap.
- Full suite 256/256; production build clean (`/editor` 171 kB).

### Round 6 — Deliverable 2: Mixer (per-track volume / pan / mute / solo, July 9)
Volume + mute already existed on tracks; **pan** and **solo** are new fields
(`pan?: number`, `isSoloed?: boolean` — optional so old saved projects still load).
Behind the same Advanced-audio toggle, next to the metronome button.
- **MixerPanel** (`components/editor/MixerPanel.tsx`): a Radix `Dialog` with one
  channel strip per audio-bearing track (video/audio/MIDI — text tracks are silent
  and excluded), each with a volume slider, pan slider (L/C/R label), Mute, Solo.
  Solo is global: soloing any one track silences every other non-soloed track.
- **MIDI engine** (`lib/midi/playbackEngine.ts`): every track with notes now gets
  a `Tone.Gain → Tone.Panner → destination` chain keyed by track id (even
  muted/soloed-out ones, held at gain 0), so the mixer's `setTrackVolume`/
  `setTrackPan`/`setTrackMuted`/`toggleTrackSolo` push straight to the live Tone
  nodes — no playback restart needed. Previously gain nodes weren't keyed at all
  (couldn't be adjusted after scheduling).
- **Video/audio pan** (`lib/audio/mediaPan.ts`): HTMLMediaElements have no native
  pan, so a panned element is routed once through
  `MediaElementSource → StereoPanner → destination`; un-panned elements stay on
  the direct `<video>`/`<audio>` path (unchanged behavior, no perf cost for the
  common case).
- Same modal-shortcut-guard lesson as the piano roll applies here: `mixerOpen`
  was added to `useKeyboardShortcuts`'s bail condition. Verified in-browser:
  Backspace while the mixer is open does **not** delete the selected MIDI track
  (this was the exact failure mode fixed for the piano roll earlier — same root
  cause, same fix, applied proactively this time).
- Persistence needed no changes — `db.ts`/`projectStore.ts` serialize tracks via
  `{...t}` spreads, not field allowlists, so `pan`/`isSoloed` flow through for
  free.
- Verified in-browser end-to-end: opened mixer, moved a channel's volume slider
  to 60% and pan to L45 (both updated live via the store, confirmed by re-reading
  the rendered label text, not just assuming the event fired), toggled Mute →
  "Unmute" (dialog stayed open), toggled Solo → amber-highlighted (dialog stayed
  open), Backspace while open left the track intact, closed cleanly. No console
  errors. Full suite 256/256; production build clean (`/editor` 172 kB).

### Reusable right-click context menus (July 7, owner ask: "throughout the app")
Before this there was ONE ad-hoc menu (timeline clips, hand-positioned in
Timeline.tsx). Replaced with a reusable `components/ui/ContextMenu.tsx`
(`useContextMenu()` hook + controlled `<ContextMenu>`): portals to body, flips at
viewport edges, dismisses on outside-click/Escape/scroll/resize, supports
separators, section labels, disabled + danger items, submenus, keepOpen toggles,
and fully custom rows (the velocity slider). Wired per surface with relevant
options:
- **Piano-roll note**: velocity slider + pp/p/mf/f/ff presets, Transpose
  submenu (±oct, ±semi), Set-length submenu, Duplicate, Delete. This REPLACES the
  old click-triggered velocity popover — velocity is now right-click only, fixing
  "any click shows the velocity popup" (left-click on empty grid just adds a note,
  no popup). Right-click empty grid → Add note / Select all / Quantize all / Clear.
- **Timeline clip** (video/audio/text/midi): Copy/Paste(disabled w/o clipboard)/
  Duplicate/Split(disabled for midi + off-clip)/Split-audio(video)/Edit-notes
  (midi)/Mute/Lock/Delete. Timeline background (Konva stage): Add instrument|text
  track, Paste here, Add marker here.
- **TrackList row**: Copy/Paste/Duplicate/Split or Edit-notes/Mute/Lock/Delete —
  and MIDI tracks now appear in the TrackList (were timeline-only before).
- **Video preview**: Take snapshot / Toggle guides / Detach.
Verified in-browser: piano-roll note + empty menus and actions, TrackList row
menu, timeline clip menu (disable logic correct), video-preview menu — all render
and act correctly, no console errors. NOT browser-verified: the timeline
*background* (Konva-stage) menu — the Konva Stage won't mount in the 0×0 headless
preview viewport, so it needs a real-browser check; wiring is in place.

### ⚠️ Tone.js loading gotcha (cost real time — don't relearn)
Tone's npm **ESM build has extensionless internal imports** webpack can't resolve
for named exports — `Tone.start/now/Gain/Offline` silently come back `undefined`
(audio looks like it runs but is dead). Fix: **vendored Tone's UMD build in
`public/vendor/tone/Tone.js`** and load it at runtime via a `<script>` tag
(`lib/midi/tone.ts` → `ensureTone()`/`tone()`), same doctrine as the vendored
ffmpeg wasm. Types come from an erased `import type`, so there's no runtime `tone`
import anywhere (keeps SSR + vitest clean). Verified in-browser: offline render
produces real audio (peak ~0.40, not silence); realtime playback loads Tone and
schedules voices; 256/256 tests; clean production build.

Verify tip: `window.__renderMidi(trackId)` (dev-only) returns the rendered WAV
blob for a MIDI track — decode it and check peak amplitude > 0 to prove real audio.

---

# MusicVid Pro — Status (July 5, 2026: hardening + design + features)

## Round 4 (July 6): titles that actually export + project manager

- **CRITICAL FIX — text export was silently broken.** Adding ANY text track
  made export fail instantly ("No font filename provided") because WASM ffmpeg
  ships no system fonts, so `drawtext` aborted the whole filter graph. Now a
  bundled font (`public/fonts/NotoSans-Regular.ttf`, 27KB) is written into the
  ffmpeg FS before export and referenced via `fontfile=`. Verified: a text
  export that failed at 0% now completes in ~78s with the title baked in.
- **Titles system** (`lib/video/titleStyles.ts`, one source of truth for
  preview + export): 5 style presets — Clean, Bold Box, Outline, Lower Third,
  Karaoke — with box backgrounds, outlines, and drop shadows. Style picker in
  the Inspector's text section; renders live in the preview and bakes into the
  export. drawtext text is now properly escaped (colon/percent/backslash) and
  centered on its anchor to match the preview.
- **Project Manager** (`components/editor/ProjectManager.tsx`): the folder
  button in the toolbar opens saved projects with open/delete, "Open" badge on
  the current one, relative timestamps. (The persistence layer already
  supported this — it just had no UI.) Verified: lists projects, opens them.
- **Undo coalescing**: slider/scrubber drags now collapse into ONE undo step
  (was one-per-tick). Verified deterministically — 10 frame-spaced updates →
  1 history entry, 0 spurious pushes.
- **Design**: animated TimelineHero on the landing (CSS/SVG mini-editor with a
  scanning playhead, waveform, and beat grid — no client JS, respects
  reduced-motion); branded signal-green waveform favicon (`app/icon.svg`);
  OpenGraph/Twitter social-card metadata. Export button recolored to signal
  (last stray green).
- Fixed a pre-existing hydration warning (panel widths were read from
  localStorage during render; now applied post-mount).
- Tests: +9 (titleStyles + compositor); suite 233/233. Clean prod build.

---

## Round 3 (same day): flagship-editor features

- **Per-clip color grading** (`lib/video/colorAdjustments.ts` — single source
  of truth for preview *and* export): brightness/contrast/saturation/hue
  sliders + look presets (Noir, Warm, Cool, Vintage) in the Inspector's new
  Color section. Live CSS filter on the preview; baked into exports via
  ffmpeg `eq`/`hue` (deliberately restricted to those two universally-safe
  filters). Replaces the old fake "Color Correction" toggle. Verified: Noir
  applied via UI → grayscale preview → full TikTok export with the grade
  baked completed in 55s.
- **Autosave + session restore**: 5s-debounced save of the whole project
  (tracks, trims, grades, file blobs) to IndexedDB; on a cold editor load a
  "Restore your last session?" banner brings everything back — audio
  re-decoded, waveform regenerated, BPM and grades intact. Verified with a
  full reload cycle.
- **Still-frame snapshot**: camera button in the preview saves the current
  frame (with its color grade applied) as `frame-<time>s.png`. Verified: real
  83KB PNG produced.
- **Composition guides**: rule-of-thirds + center cross + action-safe overlay,
  toggle in the preview toolbar.
- 6 new unit tests (color math + compositor graph); suite now 226/226.

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
