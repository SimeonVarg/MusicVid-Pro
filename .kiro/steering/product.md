# MusicVid Pro

A browser-based music video editor that lets users sync video clips to audio tracks with musical precision. Core capabilities include:

- Multi-track timeline editing (video, audio, text tracks)
- BPM detection and tempo-based sync between audio and video
- Time-stretching and pitch-shifting audio
- Multi-cam sync via audio cross-correlation
- Video playback speed adjustment via FFmpeg (WASM)
- Waveform visualization
- Metronome overlay for beat-aligned editing
- Export to video formats

The editor runs entirely client-side. Heavy processing (FFmpeg, audio decoding) happens in the browser using WebAssembly and the Web Audio API.
