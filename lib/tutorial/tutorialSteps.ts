// lib/tutorial/tutorialSteps.ts

export type TutorialModule =
  | 'Getting Started'
  | 'Timeline Editing'
  | 'BPM & Tempo Sync'
  | 'Time-Stretch & Pitch'
  | 'Multi-Cam Sync'
  | 'Video Speed'
  | 'Waveform Visualization'
  | 'Metronome Overlay'
  | 'Recording'
  | 'Export'
  | 'Project Saving';

export type TutorialStep = {
  id: string;
  module: TutorialModule;
  targetSelector: string;
  title: string;
  body: string;
  tooltipPlacement?: 'below' | 'above' | 'left' | 'right';
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ─── Getting Started ────────────────────────────────────────────────────────

  {
    id: 'gs-toolbar',
    module: 'Getting Started',
    targetSelector: 'toolbar',
    title: 'Your Command Center',
    body: 'The toolbar is where you control playback — hit play, pause, or jump to the start or end of your session. You\'ll also find the BPM display, the Save button, and the Export button up here.',
    tooltipPlacement: 'below',
  },
  {
    id: 'gs-tracklist',
    module: 'Getting Started',
    targetSelector: 'tracklist',
    title: 'Add Your Tracks',
    body: 'The track list on the left is where you build your lineup. Click the upload button to bring in video or audio files, or hit the record button to capture a live take straight into the project.',
    tooltipPlacement: 'right',
  },
  {
    id: 'gs-video-preview',
    module: 'Getting Started',
    targetSelector: 'video-preview',
    title: 'The Stage',
    body: 'This preview window shows your composition exactly as it will look at the current playhead position. Scrub the timeline and the preview updates in real time — what you see is what you\'ll export.',
    tooltipPlacement: 'below',
  },
  {
    id: 'gs-timeline',
    module: 'Getting Started',
    targetSelector: 'timeline',
    title: 'Your Arrangement Canvas',
    body: 'The timeline is where everything comes together. Each track gets its own horizontal lane — video on top, audio below. The vertical line moving across is the playhead; it marks where you are in the song.',
    tooltipPlacement: 'above',
  },
  {
    id: 'gs-inspector',
    module: 'Getting Started',
    targetSelector: 'inspector',
    title: 'Track Properties',
    body: 'Click any track to select it, and this panel on the right fills in with its settings — volume, pitch, speed, and more. Think of it as the channel strip for whichever track you\'re focused on.',
    tooltipPlacement: 'left',
  },

  // ─── Timeline Editing ────────────────────────────────────────────────────────

  {
    id: 'te-timeline',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Lanes for Every Track',
    body: 'Video, audio, and text tracks each live on their own lane. You can stack as many as you need — layer B-roll over your main performance, drop in a backing track, or add lyrics as a text overlay.',
    tooltipPlacement: 'above',
  },
  {
    id: 'te-drag',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Move Clips Like Blocks',
    body: 'Drag any clip left or right to reposition it in time. Want the chorus drop to hit exactly on beat 33? Drag it there. Snap-to-grid makes it lock to the nearest beat automatically.',
    tooltipPlacement: 'above',
  },
  {
    id: 'te-trim',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Trim the Fat',
    body: 'Grab the left or right edge of a clip and drag inward to trim it. Trimming is non-destructive — you\'re just hiding the parts you don\'t want, not deleting them. Drag back out to restore.',
    tooltipPlacement: 'above',
  },
  {
    id: 'te-split',
    module: 'Timeline Editing',
    targetSelector: 'toolbar-split',
    title: 'Cut at the Playhead',
    body: 'Position the playhead where you want to make a cut, then click the scissors button (or right-click a clip and choose Split). The clip splits into two independent pieces you can move or delete separately.',
    tooltipPlacement: 'below',
  },
  {
    id: 'te-zoom',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Zoom In for Precision',
    body: 'Hold Ctrl and scroll the mouse wheel to zoom the timeline in or out. Zooming in reveals finer detail — great for aligning a cut to a snare hit. Zoom out to see the full arrangement at a glance.',
    tooltipPlacement: 'above',
  },
  {
    id: 'te-context-menu',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Right-Click for More',
    body: 'Right-click any clip to open the context menu. From here you can Copy, Paste, Duplicate, or Split Audio from Video — handy when you want to work with a clip\'s embedded audio as its own track.',
    tooltipPlacement: 'above',
  },

  // ─── BPM & Tempo Sync ────────────────────────────────────────────────────────

  {
    id: 'bpm-control',
    module: 'BPM & Tempo Sync',
    targetSelector: 'toolbar-bpm',
    title: 'Your Project Tempo',
    body: 'MusicVid Pro automatically detects the BPM of any audio track you import and displays it here. The whole timeline grid — every beat marker and snap point — is built around this number.',
    tooltipPlacement: 'below',
  },
  {
    id: 'bpm-override',
    module: 'BPM & Tempo Sync',
    targetSelector: 'toolbar-bpm',
    title: 'Override the BPM',
    body: 'If the auto-detected tempo isn\'t right — maybe you\'re working with a live recording that drifts — just click the BPM field and type in the correct value. The grid snaps to your new tempo instantly.',
    tooltipPlacement: 'below',
  },
  {
    id: 'bpm-snap',
    module: 'BPM & Tempo Sync',
    targetSelector: 'timeline',
    title: 'Snap Cuts to the Beat',
    body: 'When snap-to-grid is on, every clip you drag or trim locks to the nearest beat boundary. It\'s like having a metronome guide your edits — your cuts will always land on the groove.',
    tooltipPlacement: 'above',
  },
  {
    id: 'bpm-adjustor',
    module: 'BPM & Tempo Sync',
    targetSelector: 'inspector-adjust',
    title: 'Stretch Audio to a New Tempo',
    body: 'Select an audio track and open the Adjust tab to find the BPM Adjustor. Enter a Target BPM and MusicVid Pro time-stretches the clip to fit — like nudging the tempo of a loop without touching its pitch.',
    tooltipPlacement: 'left',
  },
  {
    id: 'bpm-fields',
    module: 'BPM & Tempo Sync',
    targetSelector: 'inspector-adjust',
    title: 'Current, Target, and Speed Factor',
    body: 'The Current BPM shows what was detected, the Target BPM is where you want it, and the Speed Factor tells you how much the clip will be stretched. A factor of 0.5 doubles the length; 2.0 halves it.',
    tooltipPlacement: 'left',
  },
  {
    id: 'bpm-sync-offset',
    module: 'BPM & Tempo Sync',
    targetSelector: 'inspector-adjust',
    title: 'Compensate for a Pickup Beat',
    body: 'If your track starts with a pickup note or a few bars of silence before the groove kicks in, use the Sync Offset field to shift the beat grid so bar 1 lines up with the actual downbeat.',
    tooltipPlacement: 'left',
  },

  // ─── Time-Stretch & Pitch ────────────────────────────────────────────────────

  {
    id: 'ts-intro',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Speed and Pitch — Independently',
    body: 'Select an audio track and open the Adjust tab. Here you can change how long a clip is (time-stretching) and what key it\'s in (pitch-shifting) completely independently of each other.',
    tooltipPlacement: 'left',
  },
  {
    id: 'ts-timestretch',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Time-Stretching',
    body: 'Time-stretching makes a clip longer or shorter without changing its pitch. Stretch a four-bar loop to fill eight bars and it still plays in the same key — just at half the tempo.',
    tooltipPlacement: 'left',
  },
  {
    id: 'ts-pitchshift',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Pitch-Shifting',
    body: 'Pitch-shifting moves a clip up or down in key without changing its length. Use the Pitch (semitones) field — positive numbers raise the pitch, negative numbers lower it. +12 is one octave up.',
    tooltipPlacement: 'left',
  },
  {
    id: 'ts-preserve-pitch',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Preserve Pitch While Stretching',
    body: 'The "Preserve Pitch" toggle keeps the key locked when you change the tempo. Leave it on for vocals and melodic content — turn it off only if you want that classic tape-speed effect.',
    tooltipPlacement: 'left',
  },
  {
    id: 'ts-engine',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Choose Your Pitch Engine',
    body: 'The engine selector lets you choose between Standard (fast, good for most uses) and Rubberband (slower, but noticeably better quality on vocals, guitars, and other musical content).',
    tooltipPlacement: 'left',
  },
  {
    id: 'ts-direct-speed',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Direct Speed Factor',
    body: 'For non-musical content — dialogue, sound effects, ambient audio — the Direct Speed Factor gives you a simple multiplier. 0.5 plays at half speed, 2.0 plays at double speed.',
    tooltipPlacement: 'left',
  },

  // ─── Multi-Cam Sync ──────────────────────────────────────────────────────────

  {
    id: 'mc-intro',
    module: 'Multi-Cam Sync',
    targetSelector: 'multicam-sync',
    title: 'Sync Multiple Camera Angles',
    body: 'If you shot your performance from several angles, Multi-Cam Sync lines them all up automatically. It uses audio cross-correlation — comparing the sound in each clip — to find the exact offset between cameras.',
    tooltipPlacement: 'right',
  },
  {
    id: 'mc-master',
    module: 'Multi-Cam Sync',
    targetSelector: 'multicam-sync',
    title: 'Pick a Master Track',
    body: 'Designate one audio track as the master reference — usually your best-quality room mic or the direct feed. All other clips will be aligned to match it.',
    tooltipPlacement: 'right',
  },
  {
    id: 'mc-auto-sync',
    module: 'Multi-Cam Sync',
    targetSelector: 'multicam-sync',
    title: 'Auto Sync',
    body: 'Hit "Auto Sync" and MusicVid Pro repositions each selected video clip so its embedded audio lines up with the master track. No manual nudging required — just pick your angles and cut.',
    tooltipPlacement: 'right',
  },
  {
    id: 'mc-split-audio',
    module: 'Multi-Cam Sync',
    targetSelector: 'timeline',
    title: 'Split Audio from Video',
    body: 'Right-click any video clip and choose "Split Audio from Video" to detach the embedded audio as its own track. Useful when you want to keep the camera audio for sync but mute it in the final mix.',
    tooltipPlacement: 'above',
  },
  {
    id: 'mc-sync-master',
    module: 'Multi-Cam Sync',
    targetSelector: 'inspector',
    title: 'Sync Master in the Inspector',
    body: 'The Sync Master selector in the Inspector lets you sync multiple audio tracks to a single reference after the fact — handy if you add a new track later and need to align it to the rest of the session.',
    tooltipPlacement: 'left',
  },

  // ─── Video Speed ─────────────────────────────────────────────────────────────

  {
    id: 'vs-intro',
    module: 'Video Speed',
    targetSelector: 'inspector-adjust',
    title: 'Slow Motion and Fast Forward',
    body: 'Select a video track and open the Adjust tab to control its playback speed. Slow a clip down for a dramatic moment, or speed it up to match the energy of a fast section.',
    tooltipPlacement: 'left',
  },
  {
    id: 'vs-speed-factor',
    module: 'Video Speed',
    targetSelector: 'inspector-adjust',
    title: 'Direct Speed Factor',
    body: 'The Direct Speed Factor is a simple multiplier. Values below 1.0 slow the clip down (0.5 = half speed, slow-mo), values above 1.0 speed it up (2.0 = double speed, time-lapse).',
    tooltipPlacement: 'left',
  },
  {
    id: 'vs-processing',
    module: 'Video Speed',
    targetSelector: 'inspector-adjust',
    title: 'Processing Takes a Moment',
    body: 'Video speed changes are processed by FFmpeg, so there\'s a short render step. The editor stays fully usable while it works — you\'ll see a progress indicator, and the clip updates when it\'s done.',
    tooltipPlacement: 'left',
  },
  {
    id: 'vs-progress',
    module: 'Video Speed',
    targetSelector: 'inspector-adjust',
    title: 'Watch the Progress Bar',
    body: 'A progress bar appears in the Inspector while the speed change renders. Once it reaches 100%, the processed clip replaces the original on the timeline automatically.',
    tooltipPlacement: 'left',
  },
  {
    id: 'vs-bpm-adjustor',
    module: 'Video Speed',
    targetSelector: 'inspector-adjust',
    title: 'Match Video Duration to a Tempo',
    body: 'You can also use the BPM Adjustor on a video track to stretch or compress it so its duration fits a specific number of bars. Great for making a clip fill exactly one verse or chorus.',
    tooltipPlacement: 'left',
  },

  // ─── Waveform Visualization ──────────────────────────────────────────────────

  {
    id: 'wv-waveform',
    module: 'Waveform Visualization',
    targetSelector: 'waveform',
    title: 'See Your Audio',
    body: 'Every audio clip displays a waveform — a visual map of the sound\'s amplitude over time. Tall peaks are loud moments (kick drums, snare hits), flat sections are silence or quiet passages.',
    tooltipPlacement: 'above',
  },
  {
    id: 'wv-reading',
    module: 'Waveform Visualization',
    targetSelector: 'waveform',
    title: 'Read the Groove',
    body: 'Use the waveform to spot transients — those sharp spikes at the start of each beat. Aligning your video cuts to those spikes is the fastest way to make edits feel locked to the music.',
    tooltipPlacement: 'above',
  },
  {
    id: 'wv-zoom',
    module: 'Waveform Visualization',
    targetSelector: 'timeline',
    title: 'Zoom In for Detail',
    body: 'Ctrl+scroll to zoom in on the timeline and the waveform gets more detailed. At high zoom levels you can see individual transients clearly — perfect for frame-accurate cuts on a snare or hi-hat.',
    tooltipPlacement: 'above',
  },
  {
    id: 'wv-level-meter',
    module: 'Waveform Visualization',
    targetSelector: 'waveform',
    title: 'Real-Time Level Meter',
    body: 'The level meter shows your output levels in real time during playback. Keep the signal in the green — if it\'s hitting red, your mix is clipping and the export will sound distorted.',
    tooltipPlacement: 'above',
  },

  // ─── Metronome Overlay ───────────────────────────────────────────────────────

  {
    id: 'mo-toggle',
    module: 'Metronome Overlay',
    targetSelector: 'toolbar-metronome',
    title: 'Turn On the Click',
    body: 'Click the timer icon in the toolbar to toggle the metronome overlay. When it\'s on, a visual beat indicator pulses in sync with the project BPM during playback — your on-screen click track.',
    tooltipPlacement: 'below',
  },
  {
    id: 'mo-overlay',
    module: 'Metronome Overlay',
    targetSelector: 'metronome-overlay',
    title: 'Visual Beat Indicator',
    body: 'The metronome overlay flashes on every beat, synchronized to the project tempo. It\'s a great reference when you\'re reviewing edits and want to feel whether cuts are landing on the groove.',
    tooltipPlacement: 'right',
  },
  {
    id: 'mo-volume',
    module: 'Metronome Overlay',
    targetSelector: 'metronome-overlay',
    title: 'Metronome Volume',
    body: 'Use the volume control in the metronome panel to set how loud the click is in your monitor mix. Crank it up when you\'re recording, dial it back when you\'re just reviewing edits.',
    tooltipPlacement: 'right',
  },
  {
    id: 'mo-time-signature',
    module: 'Metronome Overlay',
    targetSelector: 'metronome-overlay',
    title: 'Time Signature',
    body: 'Change the time signature numerator to match your track — 4 for 4/4, 3 for a waltz, 7 for something more adventurous. The bar length in the timeline ruler and the metronome accent pattern both update to match.',
    tooltipPlacement: 'right',
  },

  // ─── Recording ───────────────────────────────────────────────────────────────

  {
    id: 'rec-tab',
    module: 'Recording',
    targetSelector: 'tracklist-record',
    title: 'Record a Live Take',
    body: 'Click the Record tab in the track list to open the recording panel. You can capture audio from your microphone directly into a new track — no need to leave the app or bounce to another DAW.',
    tooltipPlacement: 'right',
  },
  {
    id: 'rec-panel',
    module: 'Recording',
    targetSelector: 'recording-panel',
    title: 'Recording Panel',
    body: 'Hit the record button to start capturing. When you stop, the recorded clip is automatically placed on the timeline at the current playhead position, ready to edit like any other audio track.',
    tooltipPlacement: 'right',
  },
  {
    id: 'rec-level-meter',
    module: 'Recording',
    targetSelector: 'recording-panel',
    title: 'Set Your Input Level',
    body: 'Watch the level meter before you record. Aim for peaks in the upper green zone — loud enough to have a good signal, but not so hot that it clips into the red. Adjust your mic gain or interface level accordingly.',
    tooltipPlacement: 'right',
  },

  // ─── Export ──────────────────────────────────────────────────────────────────

  {
    id: 'ex-button',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'Export Your Music Video',
    body: 'When your edit is ready, click the Export button to open the export dialog. Here you\'ll choose your format, resolution, frame rate, and platform preset before rendering the final file.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ex-presets',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'Platform Presets',
    body: 'Choose YouTube, Instagram, or TikTok and MusicVid Pro sets the optimal resolution and aspect ratio for that platform automatically. No need to remember that Instagram Reels wants 9:16 at 1080×1920.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ex-format',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'MP4 or WebM',
    body: 'MP4 (H.264) is the safest choice — it plays everywhere. WebM is a smaller, open-source alternative that works well for web uploads. When in doubt, go MP4.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ex-ffmpeg',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'Rendered in Your Browser',
    body: 'Export runs entirely in your browser using FFmpeg WebAssembly — no files are uploaded to any server. Larger projects with many tracks take longer, so give it a few minutes for a full-length video.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ex-progress',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'Export Progress',
    body: 'A progress bar tracks the render. You can keep reviewing your timeline while it runs — the export happens in the background. When it\'s done, the file downloads automatically.',
    tooltipPlacement: 'below',
  },

  // ─── Project Saving ──────────────────────────────────────────────────────────

  {
    id: 'ps-save',
    module: 'Project Saving',
    targetSelector: 'toolbar-save',
    title: 'Save Your Project',
    body: 'Click the Save button to store your entire project — every track, clip position, BPM setting, and effect — in your browser\'s local storage. It\'s instant and happens right in the browser.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ps-local',
    module: 'Project Saving',
    targetSelector: 'toolbar-save',
    title: 'Saved Locally, Privately',
    body: 'Projects are saved in IndexedDB on your device. Nothing is uploaded to a server. Your music video stays on your machine until you choose to export and share it.',
    tooltipPlacement: 'below',
  },
  {
    id: 'ps-undo',
    module: 'Project Saving',
    targetSelector: 'toolbar',
    title: 'Undo and Redo',
    body: 'Made a mistake? Press Ctrl+Z to undo (Ctrl+Shift+Z to redo). The editor keeps up to 50 history snapshots per session, so you can step back through your edits freely.',
    tooltipPlacement: 'below',
  },
];

export const QUICK_TOUR_STEPS: TutorialStep[] = [
  {
    id: 'qt-layout',
    module: 'Getting Started',
    targetSelector: 'toolbar',
    title: 'Welcome to MusicVid Pro',
    body: "Let's get oriented. The toolbar at the top controls playback and BPM. The track list on the left is where you add your clips. The preview shows your video in real time, and the timeline below is your arrangement canvas. The inspector on the right shows settings for whichever track you've selected.",
    tooltipPlacement: 'below',
  },
  {
    id: 'qt-add-tracks',
    module: 'Getting Started',
    targetSelector: 'tracklist-upload',
    title: 'Add Your Media',
    body: 'Click the upload button to bring in a video or audio file. You can add as many tracks as you need — stack multiple camera angles, a backing track, or a live recording.',
    tooltipPlacement: 'right',
  },
  {
    id: 'qt-timeline-editing',
    module: 'Timeline Editing',
    targetSelector: 'timeline',
    title: 'Arrange Your Clips',
    body: 'Drag any clip left or right to reposition it. Grab the edge of a clip to trim it. To cut a clip in two, move the playhead to the cut point and click the scissors button in the toolbar.',
    tooltipPlacement: 'above',
  },
  {
    id: 'qt-bpm-snap',
    module: 'BPM & Tempo Sync',
    targetSelector: 'toolbar-bpm',
    title: 'Lock Your Edits to the Beat',
    body: 'MusicVid Pro detects the BPM of your audio automatically and displays it here. With snap-to-grid on, every clip you drag or trim locks to the nearest beat — so your cuts always land on the groove.',
    tooltipPlacement: 'below',
  },
  {
    id: 'qt-adjust',
    module: 'Time-Stretch & Pitch',
    targetSelector: 'inspector-adjust',
    title: 'Stretch and Tune Your Audio',
    body: 'Select an audio track and open the Adjust tab to change its tempo or key independently. Time-stretching makes a clip longer or shorter without changing pitch; pitch-shifting moves it up or down in key without changing its length.',
    tooltipPlacement: 'left',
  },
  {
    id: 'qt-waveform',
    module: 'Waveform Visualization',
    targetSelector: 'waveform',
    title: 'Read the Beat Visually',
    body: "Every audio clip shows a waveform — those sharp spikes are the transients (kick drums, snare hits). Aligning your video cuts to those spikes is the fastest way to make edits feel locked to the music.",
    tooltipPlacement: 'above',
  },
  {
    id: 'qt-multicam',
    module: 'Multi-Cam Sync',
    targetSelector: 'multicam-sync',
    title: 'Sync Multiple Camera Angles',
    body: 'Shot your performance from several angles? Multi-Cam Sync lines them all up automatically by comparing the audio in each clip. Pick a master track, hit Auto Sync, and every camera snaps into place.',
    tooltipPlacement: 'right',
  },
  {
    id: 'qt-metronome',
    module: 'Metronome Overlay',
    targetSelector: 'toolbar-metronome',
    title: 'Turn On the Visual Click',
    body: 'Click the timer icon to toggle the metronome overlay. It pulses on every beat during playback — a great reference for checking whether your cuts are landing on the groove.',
    tooltipPlacement: 'below',
  },
  {
    id: 'qt-export',
    module: 'Export',
    targetSelector: 'toolbar-export',
    title: 'Export Your Music Video',
    body: 'When your edit is ready, click Export. Choose a platform preset (YouTube, Instagram, TikTok) and MusicVid Pro sets the right resolution and aspect ratio automatically. Your video renders entirely in the browser — nothing is uploaded.',
    tooltipPlacement: 'below',
  },
  {
    id: 'qt-save-undo',
    module: 'Project Saving',
    targetSelector: 'toolbar-save',
    title: 'Save Your Work',
    body: "Click Save to store your project in your browser. Press Ctrl+Z to undo any edit — the editor keeps up to 50 history steps per session. That's the Quick Tour done; open the Dev Tour from the ? button for a deep dive into every feature.",
    tooltipPlacement: 'below',
  },
];
