# MusicVid Pro — 60-second demo script

**Prep (before anyone is watching):** open music-vid-pro.vercel.app in a fresh
Chrome profile. Optionally have your own clip + song on the desktop (better
story) — otherwise the built-in **Load demo project** button covers you.
Run one full export that morning — wifi-proof, but battery/thermals matter.

| Time | Do | Say |
|------|----|-----|
| 0–8s | Landing page already open. Point at the badge. | "Everything you're about to see runs in the browser. No uploads, no server — your footage never leaves the machine." |
| 8–15s | Click **Launch Editor**, then **Skip for now** on the tour. | "This is a full video editor in a tab — React, FFmpeg compiled to WASM, audio analysis in workers." |
| 15–25s | **Drag both files** from the desktop into the window — or click **Load demo project** if you're traveling light. Point at the waveform appearing. | "Drop in a song and a clip. It decodes the audio, draws the waveform, and detects the BPM — all client-side, off the main thread." |
| 25–35s | Click the audio track — point at the BPM badge. Press **Space** to play a few seconds. | "It found the tempo. Now everything I cut snaps to the musical grid, not just the clock." |
| 35–45s | Press **S** to split the clip at the playhead. Then click the clip → in the Inspector hit **Noir** (or **Vintage**) and watch the preview change live. | "Frame-accurate cuts on the beat grid — and per-clip color grades that bake straight into the export." |
| 45–60s | Click **Export** → pick **TikTok** → **Export**. Let the progress bar run while you talk. (Want the flashy version? Press `M` first — the beat indicator gets baked into the export, at the cost of a second encode pass.) | "And it encodes real H.264 in the browser — FFmpeg WASM, fully offline. On stage wifi this still works, because there's nothing to download." |

**If asked "how long does export take?"** — "About real-time-and-a-half for
1080p, single-threaded WASM. Multithreaded FFmpeg with SharedArrayBuffer is the
obvious next step."

**Recovery moves**
- Play button does nothing → click anywhere in the page once first (browser
  autoplay policy), then Space.
- BPM looks wrong for your song → tap `T` on the beat four times ("and if the
  detector disagrees with the drummer, the drummer wins").
- Export mid-progress when time runs out → "I'll let this finish — the point
  is it finishes without a server."
