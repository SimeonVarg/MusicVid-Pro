# Requirements Document

## Introduction

An interactive, in-app tutorial system for MusicVid Pro that guides new musicians through the editor step by step. The tutorial is an overlay-driven, contextual experience — not a static document — that highlights real UI elements, explains what they do in musician-friendly language, and lets users try things out as they go. It covers every core feature: multi-track timeline editing, BPM detection and tempo-based sync, time-stretching and pitch-shifting, multi-cam sync, video speed adjustment, waveform visualization, metronome overlay, recording, export, and project saving.

The tutorial is designed to be fun, clear, and thorough — respecting that musicians understand rhythm and timing but may be new to video editing software.

---

## Glossary

- **Tutorial_System**: The overall in-app tutorial feature, including the controller, step renderer, and progress tracker.
- **Tutorial_Overlay**: The semi-transparent backdrop and spotlight that focuses attention on a specific UI element during a tutorial step.
- **Tutorial_Tooltip**: The floating card that displays step title, explanation text, and navigation controls (Back / Next / Skip).
- **Tutorial_Controller**: The logic layer that manages step sequencing, progress persistence, and tutorial lifecycle (start, pause, resume, complete, skip).
- **Tutorial_Launcher**: The UI entry point (button or prompt) that allows users to start or restart the tutorial.
- **Step**: A single unit of the tutorial, consisting of a target element, explanatory copy, and optional interactive prompt.
- **Spotlight**: The highlighted region of the Tutorial_Overlay that draws focus to the target UI element for the current Step.
- **Progress**: The user's saved position within the tutorial, stored in the browser so it survives page reloads.
- **Module**: A named group of Steps covering a single feature area (e.g., "Timeline Basics", "BPM & Sync").
- **New_User**: A user who has not previously completed or dismissed the tutorial.

---

## Requirements

### Requirement 1: Tutorial Entry Point

**User Story:** As a new musician opening MusicVid Pro for the first time, I want to be offered the tutorial automatically, so that I can learn the editor without having to hunt for help.

#### Acceptance Criteria

1. WHEN a New_User loads the editor for the first time, THE Tutorial_Launcher SHALL display a welcome prompt offering to start the tutorial.
2. THE Tutorial_Launcher SHALL provide a "Start Tutorial" action and a "Skip for now" action on the welcome prompt.
3. WHERE the user has previously dismissed or completed the tutorial, THE Tutorial_Launcher SHALL NOT display the automatic welcome prompt on subsequent loads.
4. THE Tutorial_Launcher SHALL be accessible at all times via a persistent "?" or "Tutorial" button in the editor toolbar.
5. WHEN the user activates the Tutorial_Launcher from the toolbar, THE Tutorial_System SHALL allow the user to restart the tutorial from the beginning or resume from their last saved Step.
6. IF the user's saved Progress is from a version of the tutorial that no longer exists, THEN THE Tutorial_Controller SHALL reset Progress to the beginning of the tutorial.

---

### Requirement 2: Tutorial Overlay and Spotlight

**User Story:** As a musician going through the tutorial, I want the UI to visually guide my attention to the right element at each step, so that I always know exactly what I'm looking at.

#### Acceptance Criteria

1. WHEN a Step is active, THE Tutorial_Overlay SHALL dim all editor UI outside the Spotlight region to a minimum opacity of 60%.
2. WHEN a Step is active, THE Tutorial_Overlay SHALL render a Spotlight that matches the bounding rectangle of the target UI element for that Step.
3. WHEN the target element of a Step is not visible in the current viewport, THE Tutorial_System SHALL scroll or navigate to make the target element visible before displaying the Spotlight.
4. THE Tutorial_Overlay SHALL allow pointer events to pass through the Spotlight region so the user can interact with the highlighted element.
5. WHEN the target element of a Step is resized or repositioned (e.g., due to window resize), THE Tutorial_Overlay SHALL recompute and rerender the Spotlight within 100ms.
6. IF a target element for a Step cannot be found in the DOM, THEN THE Tutorial_Controller SHALL skip that Step and log a warning, rather than blocking the tutorial.

---

### Requirement 3: Tutorial Tooltip

**User Story:** As a musician learning the editor, I want clear, friendly explanations at each step, so that I understand what a feature does and why it matters for my music video.

#### Acceptance Criteria

1. WHEN a Step is active, THE Tutorial_Tooltip SHALL display the Step title, a plain-language explanation of the highlighted feature, and navigation controls.
2. THE Tutorial_Tooltip SHALL position itself adjacent to the Spotlight without obscuring the target element, preferring placement below or to the side.
3. IF the preferred Tooltip position would place it outside the viewport, THEN THE Tutorial_Tooltip SHALL reposition to remain fully within the viewport.
4. THE Tutorial_Tooltip SHALL display a "Next" button, a "Back" button (disabled on the first Step), and a "Skip Tutorial" link.
5. THE Tutorial_Tooltip SHALL display the current Step number and total Step count (e.g., "Step 3 of 24").
6. THE Tutorial_Tooltip SHALL display the name of the current Module so the user knows which feature area they are in.
7. WHEN the user activates the "Next" button, THE Tutorial_Controller SHALL advance to the next Step.
8. WHEN the user activates the "Back" button, THE Tutorial_Controller SHALL return to the previous Step.
9. WHEN the user activates "Skip Tutorial", THE Tutorial_Controller SHALL end the tutorial and restore full editor interactivity.
10. THE Tutorial_Tooltip copy SHALL use musician-friendly language, avoiding generic software terminology where a musical analogy is clearer.

---

### Requirement 4: Tutorial Progress Persistence

**User Story:** As a musician who can't finish the tutorial in one sitting, I want my progress saved automatically, so that I can pick up where I left off next time I open the app.

#### Acceptance Criteria

1. WHEN the user advances to a new Step, THE Tutorial_Controller SHALL persist the current Step index to browser localStorage within 500ms.
2. WHEN the user returns to the editor after closing the browser, THE Tutorial_System SHALL restore the tutorial to the last saved Step.
3. WHEN the user completes the final Step, THE Tutorial_Controller SHALL mark the tutorial as completed in localStorage and SHALL NOT auto-launch the tutorial on future loads.
4. WHEN the user activates "Skip Tutorial", THE Tutorial_Controller SHALL mark the tutorial as dismissed in localStorage and SHALL NOT auto-launch the tutorial on future loads.
5. THE Tutorial_Controller SHALL store Progress using a versioned key so that tutorial content updates can invalidate stale Progress gracefully.

---

### Requirement 5: Module — Getting Started

**User Story:** As a new user, I want a brief orientation to the editor layout, so that I know where everything lives before diving into features.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Getting Started" Module as the first Module in the tutorial sequence.
2. WHEN the Getting Started Module is active, THE Tutorial_System SHALL guide the user through the Toolbar, TrackList panel, VideoPreview area, Timeline canvas, and InspectorPanel in sequence.
3. THE Tutorial_Tooltip for the Toolbar Step SHALL explain playback controls (play, pause, skip to start/end), the BPM control, the Save button, and the Export button.
4. THE Tutorial_Tooltip for the TrackList Step SHALL explain how to add video, audio, and text tracks using the upload and record menus.
5. THE Tutorial_Tooltip for the VideoPreview Step SHALL explain that the preview shows the composition at the current playhead position.
6. THE Tutorial_Tooltip for the Timeline Step SHALL explain that clips are arranged on horizontal lanes and that the playhead marks the current time.
7. THE Tutorial_Tooltip for the InspectorPanel Step SHALL explain that selecting a track reveals its properties and adjustment controls on the right.

---

### Requirement 6: Module — Multi-Track Timeline Editing

**User Story:** As a musician, I want to learn how to arrange and edit clips on the timeline, so that I can build my music video with confidence.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Timeline Editing" Module covering clip arrangement, trimming, splitting, and the snap-to-grid feature.
2. WHEN the Timeline Editing Module is active, THE Tutorial_System SHALL highlight the Timeline canvas and explain that video, audio, and text tracks each occupy their own lane.
3. THE Tutorial_Tooltip SHALL explain how to drag clips to reposition them on the timeline.
4. THE Tutorial_Tooltip SHALL explain how to drag the left or right edge of a clip to trim its start or end point.
5. THE Tutorial_Tooltip SHALL explain how to use the Split button in the Toolbar (or the context menu) to cut a clip at the playhead position.
6. THE Tutorial_Tooltip SHALL explain the snap-to-grid toggle and how it aligns clips to the beat grid when enabled.
7. THE Tutorial_Tooltip SHALL explain horizontal and vertical zoom controls and how to use Ctrl+scroll to zoom the timeline.
8. THE Tutorial_Tooltip SHALL explain the context menu (right-click on a clip) and its Copy, Paste, Duplicate, and Split Audio from Video options.

---

### Requirement 7: Module — BPM Detection and Tempo Sync

**User Story:** As a musician, I want to understand how BPM detection and tempo sync work, so that I can lock my video cuts to the beat of my music.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "BPM & Tempo Sync" Module.
2. WHEN the BPM & Tempo Sync Module is active, THE Tutorial_System SHALL highlight the BPMControl widget in the Toolbar.
3. THE Tutorial_Tooltip SHALL explain that MusicVid Pro automatically detects the BPM of imported audio tracks and displays it in the BPM control.
4. THE Tutorial_Tooltip SHALL explain how to manually override the BPM value by typing in the BPM control field.
5. THE Tutorial_Tooltip SHALL explain the snap-to-grid feature in the context of beat-aligned editing — that enabling it causes clips to snap to beat boundaries.
6. THE Tutorial_Tooltip SHALL explain the Adjust tab in the InspectorPanel and how the BPM Adjustor section allows the user to time-stretch an audio track to a target BPM.
7. THE Tutorial_Tooltip SHALL explain the "Current BPM", "Target BPM", and "Speed Factor" fields in the BPM Adjustor, using a musical analogy (e.g., "like changing the tempo of a loop without changing its pitch").
8. THE Tutorial_Tooltip SHALL explain the Sync Offset field and when a musician would use it to compensate for a pickup beat or intro silence.

---

### Requirement 8: Module — Time-Stretching and Pitch-Shifting

**User Story:** As a musician, I want to learn how to change the speed and pitch of audio independently, so that I can fit loops to my project without them sounding wrong.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Time-Stretch & Pitch" Module.
2. WHEN the Time-Stretch & Pitch Module is active, THE Tutorial_System SHALL highlight the Adjust tab of the InspectorPanel with an audio track selected.
3. THE Tutorial_Tooltip SHALL explain that time-stretching changes the duration of an audio clip without affecting its pitch.
4. THE Tutorial_Tooltip SHALL explain that pitch-shifting changes the key of an audio clip without affecting its duration.
5. THE Tutorial_Tooltip SHALL explain the "Preserve Pitch" toggle in the BPM Adjustor and when a musician would want to keep it on (e.g., when stretching a vocal to fit a new tempo).
6. THE Tutorial_Tooltip SHALL explain the Pitch (semitones) field in the Adjust tab and that positive values raise the pitch while negative values lower it.
7. THE Tutorial_Tooltip SHALL explain the pitch engine selector (Standard vs. Rubberband) and that Rubberband produces higher-quality results for musical content.
8. THE Tutorial_Tooltip SHALL explain the Direct Speed Factor field as an alternative to BPM-based adjustment for non-musical content.

---

### Requirement 9: Module — Multi-Cam Sync

**User Story:** As a musician who recorded from multiple camera angles, I want to learn how to sync all my clips to the audio automatically, so that I don't have to align them by hand.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Multi-Cam Sync" Module.
2. WHEN the Multi-Cam Sync Module is active, THE Tutorial_System SHALL highlight the MultiCamSync component.
3. THE Tutorial_Tooltip SHALL explain that multi-cam sync uses audio cross-correlation to align video clips that share a common audio source (e.g., a room mic or clap).
4. THE Tutorial_Tooltip SHALL explain how to designate a master audio track and select the video tracks to sync against it.
5. THE Tutorial_Tooltip SHALL explain the "Auto Sync" action and that it repositions each selected video clip so its embedded audio aligns with the master track.
6. THE Tutorial_Tooltip SHALL explain the "Split Audio from Video" option (available in the context menu) and when a musician would use it to work with the embedded audio separately.
7. THE Tutorial_Tooltip SHALL explain the Sync Master selector in the InspectorPanel and how it is used to sync multiple audio tracks to a single reference.

---

### Requirement 10: Module — Video Speed Adjustment

**User Story:** As a musician, I want to learn how to change the playback speed of a video clip, so that I can create slow-motion or fast-motion effects that match the energy of my track.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Video Speed" Module.
2. WHEN the Video Speed Module is active, THE Tutorial_System SHALL highlight the Adjust tab of the InspectorPanel with a video track selected.
3. THE Tutorial_Tooltip SHALL explain the Direct Speed Factor field for video tracks and that values below 1.0 slow the clip down while values above 1.0 speed it up.
4. THE Tutorial_Tooltip SHALL explain that video speed changes are processed via FFmpeg and may take a moment to complete.
5. THE Tutorial_Tooltip SHALL explain the progress indicator that appears during video speed processing and that the editor remains usable after processing completes.
6. THE Tutorial_Tooltip SHALL explain that the BPM Adjustor can also be used on a video track to match its duration to a musical tempo.

---

### Requirement 11: Module — Waveform Visualization

**User Story:** As a musician, I want to understand the waveform display on audio tracks, so that I can visually identify beats, drops, and silences when editing.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Waveform Visualization" Module.
2. WHEN the Waveform Visualization Module is active, THE Tutorial_System SHALL highlight an audio track clip on the Timeline canvas.
3. THE Tutorial_Tooltip SHALL explain that the waveform drawn on each audio clip represents the amplitude of the audio over time.
4. THE Tutorial_Tooltip SHALL explain how to read the waveform to identify loud transients (beats, snare hits) and quiet passages (breaks, intros).
5. THE Tutorial_Tooltip SHALL explain that zooming in on the timeline reveals finer waveform detail, making it easier to align cuts precisely to transients.
6. THE Tutorial_Tooltip SHALL explain the LevelMeter component and that it shows real-time output levels during playback.

---

### Requirement 12: Module — Metronome Overlay

**User Story:** As a musician, I want to learn how to use the metronome overlay, so that I can keep my edits locked to the beat while I work.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Metronome Overlay" Module.
2. WHEN the Metronome Overlay Module is active, THE Tutorial_System SHALL highlight the metronome toggle button in the Toolbar.
3. THE Tutorial_Tooltip SHALL explain that the metronome overlay displays a visual beat indicator synchronized to the project BPM during playback.
4. THE Tutorial_Tooltip SHALL explain how to toggle the metronome on and off using the Timer icon button in the Toolbar.
5. THE Tutorial_Tooltip SHALL explain the metronome volume control available in the MetronomeOverlay component.
6. THE Tutorial_Tooltip SHALL explain the time signature setting and how changing the numerator affects the bar length shown in the metronome and timeline ruler.

---

### Requirement 13: Module — Recording

**User Story:** As a musician, I want to learn how to record audio directly into the editor, so that I can capture a live take without leaving the app.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Recording" Module.
2. WHEN the Recording Module is active, THE Tutorial_System SHALL highlight the Record tab in the TrackList panel.
3. THE Tutorial_Tooltip SHALL explain that the recording panel allows the user to capture audio from their microphone directly into a new audio track.
4. THE Tutorial_Tooltip SHALL explain how to start and stop a recording and that the resulting clip is automatically added to the timeline at the current playhead position.
5. THE Tutorial_Tooltip SHALL explain the LevelMeter displayed during recording and how to use it to set an appropriate input level before recording.
6. IF the browser does not support the MediaRecorder API, THEN THE Tutorial_System SHALL display an explanatory message for the Recording Module Step instead of highlighting a non-functional control.

---

### Requirement 14: Module — Export

**User Story:** As a musician, I want to learn how to export my finished music video, so that I can share it on YouTube, Instagram, or TikTok.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include an "Export" Module.
2. WHEN the Export Module is active, THE Tutorial_System SHALL highlight the Export button in the Toolbar.
3. THE Tutorial_Tooltip SHALL explain that clicking Export opens the ExportModal where the user configures format, resolution, frame rate, and preset.
4. THE Tutorial_Tooltip SHALL explain the social media presets (YouTube, Instagram, TikTok) and that each preset configures the optimal resolution and aspect ratio for that platform.
5. THE Tutorial_Tooltip SHALL explain the format options (MP4, WebM) and that MP4 is the most broadly compatible choice.
6. THE Tutorial_Tooltip SHALL explain that export is processed in the browser using FFmpeg WASM and that larger projects take longer to render.
7. THE Tutorial_Tooltip SHALL explain the progress indicator shown during export and that the user can continue reviewing the timeline while export runs.

---

### Requirement 15: Module — Project Saving

**User Story:** As a musician, I want to learn how to save and reload my project, so that I can work on my music video across multiple sessions.

#### Acceptance Criteria

1. THE Tutorial_System SHALL include a "Project Saving" Module as the final Module in the tutorial sequence.
2. WHEN the Project Saving Module is active, THE Tutorial_System SHALL highlight the Save button in the Toolbar.
3. THE Tutorial_Tooltip SHALL explain that saving stores the full project state — all tracks, clip positions, BPM settings, and effects — in the browser's IndexedDB.
4. THE Tutorial_Tooltip SHALL explain that projects are saved locally in the browser and are not uploaded to any server.
5. THE Tutorial_Tooltip SHALL explain the undo/redo capability (Ctrl+Z / Ctrl+Shift+Z) and that the editor maintains up to 50 history snapshots per session.
6. WHEN the user completes the Project Saving Module, THE Tutorial_Controller SHALL display a completion screen congratulating the user and offering a "Go make something great" call to action that dismisses the tutorial.

---

### Requirement 16: Tutorial Accessibility

**User Story:** As a musician with accessibility needs, I want the tutorial to be fully keyboard-navigable and screen-reader friendly, so that I can complete it without relying solely on a mouse.

#### Acceptance Criteria

1. THE Tutorial_Tooltip SHALL be navigable using the Tab key, with focus moving between the Back button, Next button, and Skip link.
2. WHEN a new Step becomes active, THE Tutorial_System SHALL move keyboard focus to the Tutorial_Tooltip.
3. WHEN the user presses the Escape key while the tutorial is active, THE Tutorial_Controller SHALL pause the tutorial and offer to resume or exit.
4. THE Tutorial_Overlay SHALL include an ARIA live region that announces the current Step title and Module name to screen readers when a Step changes.
5. THE Tutorial_Tooltip SHALL have a minimum contrast ratio of 4.5:1 between text and background colors.
6. THE Tutorial_Overlay backdrop SHALL not trap pointer events outside the Spotlight, so users can still interact with the highlighted element using assistive technology.
