# Requirements Document

## Introduction

MusicVid Pro currently ships a single 52-step tutorial that walks through every feature in the application. This is thorough but overwhelming for new users who just want to get started quickly. This feature introduces two distinct tutorial modes — **Quick Tour** and **Dev Tour** — selectable from the existing `TutorialLauncher` UI.

The **Quick Tour** is a new 10-step, musician-friendly walkthrough covering only the most important concepts, with related features combined into single steps. It is the default mode presented to new users.

The **Dev Tour** is the existing 52-step comprehensive walkthrough, preserved exactly as-is, targeted at developers and power users who want to explore every feature in depth.

The existing tutorial infrastructure (`TutorialOverlay`, `TutorialTooltip`, `useTutorialController`, `tutorialSlice`) is reused without modification to its rendering or navigation logic. This is a content and mode-selection change only.

---

## Glossary

- **Tutorial_System**: The combined set of components and state that renders the tutorial overlay, including `TutorialOverlay`, `TutorialTooltip`, `useTutorialController`, and `tutorialSlice`.
- **TutorialLauncher**: The toolbar component that presents the welcome dialog and the persistent help button (`?`) to the user.
- **Quick_Tour**: The new 10-step condensed tutorial targeting first-time users, defined by the `QUICK_TOUR_STEPS` array.
- **Dev_Tour**: The existing 52-step comprehensive tutorial, defined by the existing `TUTORIAL_STEPS` array, unchanged.
- **Tutorial_Mode**: An enum value of either `'quick'` or `'dev'`, stored in `tutorialSlice` state, that determines which step array the Tutorial_System uses.
- **QUICK_TOUR_STEPS**: A new static array of 10 `TutorialStep` objects defined in `lib/tutorial/tutorialSteps.ts`.
- **TUTORIAL_STEPS**: The existing static array of 52 `TutorialStep` objects in `lib/tutorial/tutorialSteps.ts`. THE Tutorial_System SHALL treat this array as read-only and make no modifications to it.
- **Mode_Selection_Dialog**: The dialog presented by TutorialLauncher that lets the user choose between Quick Tour and Dev Tour before starting a tutorial session.
- **Active_Step_Array**: The step array currently in use by the Tutorial_System — either `QUICK_TOUR_STEPS` or `TUTORIAL_STEPS`, determined by the active Tutorial_Mode.
- **Welcome_Dialog**: The first-time-user dialog shown on initial load, now extended to include mode selection.

---

## Requirements

### Requirement 1: Tutorial Mode Selection

**User Story:** As a new user, I want to choose between a quick overview and a comprehensive walkthrough before starting the tutorial, so that I can pick the level of depth that suits me.

#### Acceptance Criteria

1. WHEN the Welcome_Dialog is displayed to a first-time user, THE TutorialLauncher SHALL present two clearly labelled options: "Quick Tour (10 steps)" and "Dev Tour (52 steps)".
2. WHEN the user selects "Quick Tour" and confirms, THE Tutorial_System SHALL set Tutorial_Mode to `'quick'` and start the tutorial using QUICK_TOUR_STEPS.
3. WHEN the user selects "Dev Tour" and confirms, THE Tutorial_System SHALL set Tutorial_Mode to `'dev'` and start the tutorial using TUTORIAL_STEPS.
4. THE TutorialLauncher SHALL display "Quick Tour" as the default pre-selected option in the Welcome_Dialog.
5. WHEN the user clicks the persistent help button and a prior tutorial session exists, THE TutorialLauncher SHALL display the Mode_Selection_Dialog offering "Quick Tour", "Dev Tour", "Resume", and "Skip for now" options.
6. WHEN the user selects "Resume" from the Mode_Selection_Dialog, THE Tutorial_System SHALL resume the previously active Tutorial_Mode at the saved step index.
7. IF the user dismisses the Welcome_Dialog without selecting a mode, THEN THE Tutorial_System SHALL record the session as dismissed and SHALL NOT start a tutorial.

### Requirement 2: Quick Tour Step Content

**User Story:** As a first-time user, I want a concise 10-step tour that covers the most important features in plain musician-friendly language, so that I can start making music videos without reading a manual.

#### Acceptance Criteria

1. THE QUICK_TOUR_STEPS array SHALL contain exactly 10 `TutorialStep` objects.
2. THE QUICK_TOUR_STEPS array SHALL cover the following topics in order, one step per topic:
   - Step 1: Editor layout orientation (toolbar, track list, preview, timeline, inspector — combined overview)
   - Step 2: Adding tracks (uploading video or audio)
   - Step 3: Timeline editing (drag to reposition, trim edges, split at playhead — combined)
   - Step 4: BPM detection and snap to grid (combined — the core musical sync feature)
   - Step 5: Audio adjustments — time-stretch and pitch-shift (combined into one Adjust tab step)
   - Step 6: Waveform — reading beats visually
   - Step 7: Multi-cam sync
   - Step 8: Metronome overlay
   - Step 9: Export (format selection and platform presets — combined)
   - Step 10: Save and undo (combined final step)
3. WHEN a Quick Tour step targets a UI element, THE QUICK_TOUR_STEPS step SHALL use the same `targetSelector` value as the corresponding `data-tutorial` attribute already present on that element in the existing codebase.
4. THE body text of each QUICK_TOUR_STEPS step SHALL be written in musician-friendly language, avoiding developer jargon, and SHALL be no longer than 3 sentences.
5. THE QUICK_TOUR_STEPS array SHALL assign each step a unique `id` using the prefix `qt-` (e.g., `qt-layout`, `qt-add-tracks`).
6. THE QUICK_TOUR_STEPS array SHALL assign each step a `module` value drawn from the existing `TutorialModule` union type, choosing the most relevant module for the combined topic.

### Requirement 3: Dev Tour Preservation

**User Story:** As a developer or power user, I want the existing 52-step tutorial to remain exactly as it was, so that I can still access the full feature walkthrough without any content changes.

#### Acceptance Criteria

1. THE Tutorial_System SHALL preserve the `TUTORIAL_STEPS` array without any additions, removals, or edits to existing step content.
2. WHEN Tutorial_Mode is `'dev'`, THE Tutorial_System SHALL use `TUTORIAL_STEPS` as the Active_Step_Array with no modifications to step sequencing or navigation behavior.
3. THE `TutorialModule` union type SHALL remain unchanged; no new module values are required for the Quick Tour.

### Requirement 4: Active Step Array Switching

**User Story:** As a user, I want the tutorial system to correctly use the right set of steps for whichever mode I selected, so that I always see the content matching my chosen tour.

#### Acceptance Criteria

1. WHEN Tutorial_Mode is `'quick'`, THE Tutorial_System SHALL use `QUICK_TOUR_STEPS` as the Active_Step_Array for all step navigation, progress display, and persistence.
2. WHEN Tutorial_Mode is `'dev'`, THE Tutorial_System SHALL use `TUTORIAL_STEPS` as the Active_Step_Array for all step navigation, progress display, and persistence.
3. THE `useTutorialController` hook SHALL derive the Active_Step_Array from the current Tutorial_Mode on every render, requiring no changes to its spotlight, scroll, or resize logic.
4. WHEN the Tutorial_System displays a step counter (e.g., "Step N of M"), THE Tutorial_System SHALL use the length of the Active_Step_Array as M.
5. IF a stored step index is greater than or equal to the length of the Active_Step_Array for the current Tutorial_Mode, THEN THE Tutorial_System SHALL reset the step index to 0 for that mode.

### Requirement 5: Mode-Aware Persistence

**User Story:** As a returning user, I want the app to remember which tutorial mode I was using and where I left off in each mode independently, so that switching modes doesn't lose my progress.

#### Acceptance Criteria

1. THE Tutorial_System SHALL persist Tutorial_Mode alongside the step index in the existing localStorage progress record.
2. THE Tutorial_System SHALL store Quick Tour progress and Dev Tour progress independently, so that completing or advancing in one mode does not affect the saved step index of the other.
3. WHEN tutorial progress is loaded on startup, THE Tutorial_System SHALL restore both the Tutorial_Mode and the corresponding step index for that mode.
4. IF no persisted Tutorial_Mode is found (e.g., a user who completed the old single-mode tutorial), THEN THE Tutorial_System SHALL default Tutorial_Mode to `'dev'` to preserve backward compatibility with existing saved progress.
5. THE Tutorial_System SHALL use the existing versioned localStorage key strategy; a key version bump SHALL be used if the new schema is incompatible with the existing `mvp_tutorial_v1` format.

### Requirement 6: TutorialLauncher UI Updates

**User Story:** As a user, I want the tutorial launcher to clearly communicate the two available modes and make it easy to start, resume, or switch between them, so that I always know how to access the tutorial I want.

#### Acceptance Criteria

1. THE TutorialLauncher SHALL display a mode label ("Quick Tour" or "Dev Tour") alongside the step counter in the active tutorial tooltip, so the user always knows which mode is running.
2. WHEN the user completes the Quick Tour, THE TutorialLauncher SHALL display a completion message that mentions the Dev Tour as an option for deeper exploration.
3. WHEN the user completes the Dev Tour, THE TutorialLauncher SHALL display the standard completion message.
4. THE TutorialLauncher SHALL NOT require changes to the persistent help button icon or its position in the Toolbar.
5. THE TutorialLauncher SHALL reuse the existing `Dialog` component from `components/ui/Dialog` for all new dialogs introduced by this feature.

### Requirement 7: Quick Tour Step Definitions

**User Story:** As a developer implementing this feature, I want the exact content of all 10 Quick Tour steps specified in the requirements, so that implementation matches the intended user experience.

#### Acceptance Criteria

1. Step 1 (id: `qt-layout`) SHALL target `targetSelector: 'toolbar'`, title: "Welcome to MusicVid Pro", body: "Let's get oriented. The toolbar at the top controls playback and BPM. The track list on the left is where you add your clips. The preview shows your video in real time, and the timeline below is your arrangement canvas. The inspector on the right shows settings for whichever track you've selected.", tooltipPlacement: `'below'`.

2. Step 2 (id: `qt-add-tracks`) SHALL target `targetSelector: 'tracklist-upload'`, title: "Add Your Media", body: "Click the upload button to bring in a video or audio file. You can add as many tracks as you need — stack multiple camera angles, a backing track, or a live recording.", tooltipPlacement: `'right'`.

3. Step 3 (id: `qt-timeline-editing`) SHALL target `targetSelector: 'timeline'`, title: "Arrange Your Clips", body: "Drag any clip left or right to reposition it. Grab the edge of a clip to trim it. To cut a clip in two, move the playhead to the cut point and click the scissors button in the toolbar.", tooltipPlacement: `'above'`.

4. Step 4 (id: `qt-bpm-snap`) SHALL target `targetSelector: 'toolbar-bpm'`, title: "Lock Your Edits to the Beat", body: "MusicVid Pro detects the BPM of your audio automatically and displays it here. With snap-to-grid on, every clip you drag or trim locks to the nearest beat — so your cuts always land on the groove.", tooltipPlacement: `'below'`.

5. Step 5 (id: `qt-adjust`) SHALL target `targetSelector: 'inspector-adjust'`, title: "Stretch and Tune Your Audio", body: "Select an audio track and open the Adjust tab to change its tempo or key independently. Time-stretching makes a clip longer or shorter without changing pitch; pitch-shifting moves it up or down in key without changing its length.", tooltipPlacement: `'left'`.

6. Step 6 (id: `qt-waveform`) SHALL target `targetSelector: 'waveform'`, title: "Read the Beat Visually", body: "Every audio clip shows a waveform — those sharp spikes are the transients (kick drums, snare hits). Aligning your video cuts to those spikes is the fastest way to make edits feel locked to the music.", tooltipPlacement: `'above'`.

7. Step 7 (id: `qt-multicam`) SHALL target `targetSelector: 'multicam-sync'`, title: "Sync Multiple Camera Angles", body: "Shot your performance from several angles? Multi-Cam Sync lines them all up automatically by comparing the audio in each clip. Pick a master track, hit Auto Sync, and every camera snaps into place.", tooltipPlacement: `'right'`.

8. Step 8 (id: `qt-metronome`) SHALL target `targetSelector: 'toolbar-metronome'`, title: "Turn On the Visual Click", body: "Click the timer icon to toggle the metronome overlay. It pulses on every beat during playback — a great reference for checking whether your cuts are landing on the groove.", tooltipPlacement: `'below'`.

9. Step 9 (id: `qt-export`) SHALL target `targetSelector: 'toolbar-export'`, title: "Export Your Music Video", body: "When your edit is ready, click Export. Choose a platform preset (YouTube, Instagram, TikTok) and MusicVid Pro sets the right resolution and aspect ratio automatically. Your video renders entirely in the browser — nothing is uploaded.", tooltipPlacement: `'below'`.

10. Step 10 (id: `qt-save-undo`) SHALL target `targetSelector: 'toolbar-save'`, title: "Save Your Work", body: "Click Save to store your project in your browser. Press Ctrl+Z to undo any edit — the editor keeps up to 50 history steps per session. That's the Quick Tour done; open the Dev Tour from the ? button for a deep dive into every feature.", tooltipPlacement: `'below'`.
