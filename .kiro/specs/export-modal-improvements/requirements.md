# Requirements Document

## Introduction

The Export Modal in MusicVid Pro currently has layout and feature gaps that prevent users from completing an export. The modal content overflows the viewport without scrolling, causing the Export button and lower options to be hidden off-screen. Additionally, users have no way to export audio-only (e.g. MP3/WAV) or to choose a video quality/bitrate tier before exporting. This feature addresses all four issues: scrollable layout, always-visible Export button, audio-only export mode, and a video quality selector.

## Glossary

- **Export_Modal**: The dialog component (`ExportModal.tsx`) that presents export configuration options and triggers the FFmpeg-based export pipeline.
- **Export_Button**: The primary action button that initiates the export process.
- **Platform_Preset**: A named social-media export configuration (YouTube, Instagram Feed, Instagram Story, TikTok) that sets resolution and bitrate.
- **Export_Mode**: The top-level choice of what to export — `video` (video + audio) or `audio-only` (audio stream only).
- **Quality_Tier**: A named bitrate/encoding level (Low, Medium, High, Ultra) that overrides the default bitrate of the selected Platform_Preset.
- **TimelineCompositor**: The class in `lib/export/timelineCompositor.ts` that builds the FFmpeg `filter_complex` from timeline state.
- **ExportPreset**: The `ExportPreset` interface in `timelineCompositor.ts` that carries `resolution`, `bitrate`, `audioCodec`, `videoCodec`, and `preset` fields.
- **Preflight_Check**: The validation step that runs before export to surface blocking errors and non-blocking warnings.

---

## Requirements

### Requirement 1: Scrollable Modal Layout with Always-Visible Export Button

**User Story:** As a user, I want to see all export options and the Export button without the modal being cut off, so that I can configure and start my export without confusion.

#### Acceptance Criteria

1. THE Export_Modal SHALL render its options area in a vertically scrollable container so that all options are reachable regardless of viewport height.
2. THE Export_Modal SHALL render the Export_Button and Cancel button in a fixed footer area that remains visible at all times, independent of scroll position within the options area.
3. WHEN the Export_Modal is open on a viewport shorter than the modal's natural content height, THE Export_Modal SHALL display a scroll indicator (e.g. visible scrollbar or fade gradient) to signal that more content is available above the footer.
4. THE Export_Modal SHALL constrain its maximum height to 90% of the viewport height (`max-h-[90vh]`) so it never extends beyond the screen.

---

### Requirement 2: Export Mode Selection (Video or Audio-Only)

**User Story:** As a user, I want to choose between exporting a full video or an audio-only file, so that I can produce audio deliverables (e.g. MP3 or WAV) from my project without needing a separate tool.

#### Acceptance Criteria

1. THE Export_Modal SHALL present an Export_Mode selector with two options: `Video` and `Audio Only`.
2. WHEN the user selects `Video`, THE Export_Modal SHALL display the Platform_Preset selector and Quality_Tier selector.
3. WHEN the user selects `Audio Only`, THE Export_Modal SHALL hide the Platform_Preset selector and Quality_Tier selector, and SHALL display an audio format selector offering at least `MP3` and `WAV` options.
4. WHEN the user selects `Audio Only` and initiates export, THE Export_Modal SHALL invoke the FFmpeg pipeline to extract and encode only the audio stream, producing a file with the chosen audio format extension (`.mp3` or `.wav`).
5. WHEN the user selects `Audio Only` and there are no unmuted audio tracks, THE Preflight_Check SHALL add a blocking error: "No audio tracks available for audio-only export."
6. WHEN the user selects `Audio Only`, THE Export_Modal SHALL set the download filename extension to match the selected audio format.

---

### Requirement 3: Video Quality Tier Selector

**User Story:** As a user, I want to select a video quality level before exporting, so that I can balance file size against visual quality for my intended use case.

#### Acceptance Criteria

1. THE Export_Modal SHALL present a Quality_Tier selector with four named tiers: `Low`, `Medium`, `High`, and `Ultra`.
2. THE Export_Modal SHALL display the approximate output bitrate for each Quality_Tier so the user can make an informed choice.
3. WHEN the user selects a Quality_Tier, THE Export_Modal SHALL override the `bitrate` field of the active ExportPreset with the bitrate value corresponding to that tier before passing it to the TimelineCompositor.
4. THE Export_Modal SHALL default to the `High` Quality_Tier on open.
5. THE Quality_Tier selector SHALL only be visible when the Export_Mode is `Video`.

Quality tier bitrate mapping (applied to the `bitrate` field of ExportPreset):
- Low: `2M`
- Medium: `5M`
- High: `8M`
- Ultra: `15M`

---

### Requirement 4: Preflight Check Consistency with Export Mode

**User Story:** As a user, I want the preflight validation to reflect my chosen export mode, so that I am not blocked by irrelevant errors when exporting audio-only.

#### Acceptance Criteria

1. WHEN the Export_Mode is `Audio Only`, THE Preflight_Check SHALL NOT produce a blocking error for the absence of video tracks.
2. WHEN the Export_Mode is `Audio Only`, THE Preflight_Check SHALL NOT produce a blocking error for the absence of an exportable video file.
3. WHEN the Export_Mode is `Video`, THE Preflight_Check SHALL retain all existing blocking errors for missing video and audio tracks.
4. WHEN the Export_Mode is `Audio Only` and the timeline duration is zero, THE Preflight_Check SHALL produce a blocking error: "Timeline is empty. Add media before exporting."
