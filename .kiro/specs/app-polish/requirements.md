# Requirements Document

## Introduction

This feature covers a holistic polish pass on the MusicVid Pro browser-based editor. The goal is to elevate the visual quality, interaction consistency, and perceived responsiveness of the UI without changing any core editing logic. Improvements span the landing page, editor shell layout, Toolbar, TrackList, Timeline, VideoPreview, InspectorPanel, ExportModal, and shared UI primitives. The result should feel like a professional, cohesive dark-mode creative tool.

## Glossary

- **Editor**: The full-screen editing environment rendered at `/editor`.
- **Landing_Page**: The marketing/entry page rendered at `/`.
- **Toolbar**: The top bar containing playback controls, time display, BPM control, and action buttons.
- **TrackList**: The left-side panel for managing and uploading tracks.
- **Timeline**: The Konva canvas-based timeline area including the ruler, track rows, scrollbars, and zoom controls.
- **VideoPreview**: The black canvas area that renders active video layers and text overlays.
- **InspectorPanel**: The right-side panel for inspecting and adjusting selected track properties.
- **ExportModal**: The dialog for configuring and triggering video/audio export.
- **UI_Primitives**: Shared components in `components/ui/` (Button, Input, Slider, Dialog, etc.).
- **Processing_Overlay**: The full-screen modal shown during BPM adjustment or video speed processing.
- **Toast**: The `ErrorToast` notification component.
- **Color_Palette**: The zinc/purple dark-mode palette defined in `globals.css` and `tailwind.config.ts`.
- **Focus_Ring**: The visible keyboard-focus indicator on interactive elements.
- **Transition**: A CSS or Framer Motion animation applied to state changes in the UI.

---

## Requirements

### Requirement 1: Visual Consistency of the Color Palette

**User Story:** As a user, I want all panels and surfaces to use a consistent depth hierarchy so that the UI feels intentional and easy to read.

#### Acceptance Criteria

1. THE Editor SHALL render the outermost shell (`bg-zinc-950`), panel backgrounds (`bg-zinc-900`), and elevated surfaces such as cards and dropdowns (`bg-zinc-800`) at three distinct depth levels using only Color_Palette tokens.
2. WHEN a border separates two adjacent panels, THE Editor SHALL render that border using `border-zinc-800` consistently across all panel edges.
3. THE Editor SHALL apply no hardcoded hex color values in JSX `className` strings for background, border, or text colors; all colors SHALL reference Tailwind Color_Palette tokens or CSS custom properties.
4. WHEN a surface is interactive (button, card, menu item), THE Editor SHALL apply a hover state that lightens the surface by exactly one zinc step (e.g., `hover:bg-zinc-700` on a `bg-zinc-800` surface).

---

### Requirement 2: Toolbar Refinement

**User Story:** As a user, I want the Toolbar to feel polished and well-organized so that I can quickly access playback and export controls without visual clutter.

#### Acceptance Criteria

1. THE Toolbar SHALL maintain a fixed height of `h-16` and prevent any child element from causing vertical overflow or wrapping.
2. WHEN the viewport width is below 900px, THE Toolbar SHALL hide text labels on the Save and Export buttons while keeping their icons visible.
3. THE Toolbar SHALL render the app logo, playback controls, time display, BPM control, and action buttons as visually distinct groups separated by `Separator` components.
4. WHEN the play/pause button is in the playing state, THE Toolbar SHALL render the Pause icon with a `bg-purple-600` fill; WHEN in the paused state, THE Toolbar SHALL render the Play icon with the same fill.
5. WHEN the Save button is in the saving state, THE Toolbar SHALL render a spinner icon in place of the save label and disable pointer events on the button.
6. THE Toolbar settings dropdown SHALL render with a `shadow-xl` drop shadow, `rounded-md` corners, and a `border-zinc-700` border to visually separate it from the toolbar surface.

---

### Requirement 3: TrackList Panel Polish

**User Story:** As a user, I want the TrackList panel to clearly communicate track types, states, and available actions so that I can manage my project efficiently.

#### Acceptance Criteria

1. WHEN a track is selected, THE TrackList SHALL render that track row with a `border-purple-500` border and a `bg-purple-600/20` background to distinguish it from unselected rows.
2. WHEN a track row is hovered, THE TrackList SHALL reveal the mute, lock, and delete action buttons with a smooth `opacity` Transition of 150ms.
3. WHEN a track is muted, THE TrackList SHALL render a `Muted` badge using `bg-zinc-700` and `text-zinc-300`; WHEN a track is locked, THE TrackList SHALL render a `Locked` badge using the same style.
4. THE TrackList rail (left icon column) SHALL render active menu icons with `bg-purple-600` and inactive icons with `hover:bg-zinc-800` to indicate the current navigation state.
5. WHEN the track list is empty, THE TrackList SHALL render an empty state with a dashed border, centered icon, and descriptive text to guide the user toward adding media.
6. THE TrackList delete action SHALL require a confirmation before removing a track; IF the user cancels, THEN THE TrackList SHALL leave the track unchanged.

---

### Requirement 4: Timeline Visual Polish

**User Story:** As a user, I want the Timeline to feel precise and readable so that I can make accurate edits with confidence.

#### Acceptance Criteria

1. THE Timeline scrollbars SHALL render using `accent-purple-500` to match the editor's primary color.
2. THE Timeline zoom controls SHALL render inside a `bg-zinc-800` pill with `rounded-lg` corners and clearly labeled H (horizontal) and V (vertical) axes.
3. WHEN the Timeline has no tracks, THE Timeline SHALL render a centered empty-state message within the track area.
4. THE Timeline context menu SHALL render with `rounded-md` corners, `shadow-2xl`, `border-zinc-700`, and `bg-zinc-900` background, consistent with other dropdown surfaces.
5. WHEN a context menu item is hovered, THE Timeline SHALL apply `hover:bg-zinc-800` to that item with no additional color change.
6. THE Timeline ruler SHALL visually distinguish major grid lines from minor grid lines using a higher opacity and stroke width for major lines.

---

### Requirement 5: VideoPreview Panel Polish

**User Story:** As a user, I want the VideoPreview to feel like a professional monitor so that I can evaluate my composition clearly.

#### Acceptance Criteria

1. WHEN no video track is loaded, THE VideoPreview SHALL render a centered placeholder with an icon and the text "No video loaded" in `text-zinc-500`.
2. THE VideoPreview playback info overlay (track count and resolution) SHALL render with `bg-black/70 backdrop-blur-sm` and `rounded-lg` to avoid obscuring the video content.
3. WHEN a video layer is selected in the VideoPreview, THE VideoPreview SHALL render a `ring-2 ring-purple-500` selection ring around that layer.
4. WHEN a text overlay is selected in the VideoPreview, THE VideoPreview SHALL render a `ring-2 ring-pink-400` selection ring around that text element.
5. THE VideoPreview resize handle for selected video layers SHALL render as a `bg-purple-500` square at the bottom-right corner with a `cursor-se-resize` cursor.

---

### Requirement 6: InspectorPanel Polish

**User Story:** As a user, I want the InspectorPanel to present track properties in a clean, scannable layout so that I can make adjustments without hunting for controls.

#### Acceptance Criteria

1. WHEN no track is selected, THE InspectorPanel SHALL render a centered empty state with the `Sliders` icon, a heading, and a descriptive subtitle in `text-zinc-500`.
2. THE InspectorPanel tab bar (Inspect / Adjust) SHALL render active tabs with `bg-zinc-800 text-zinc-100` and inactive tabs with `text-zinc-400 hover:bg-zinc-800/60`.
3. WHEN a section within the InspectorPanel is separated from the previous section, THE InspectorPanel SHALL use `border-t border-zinc-800 pt-6` to create consistent vertical rhythm.
4. THE InspectorPanel Slider controls SHALL display the current value as a `font-mono text-zinc-300` label aligned to the right of the control label.
5. WHEN a processing operation is in progress (pitch shift, BPM adjust, video speed), THE InspectorPanel SHALL render a `Progress` bar with a descriptive stage label above it.
6. WHEN the InspectorPanel is collapsed, THE InspectorPanel SHALL render a single icon button centered in the collapsed rail to allow re-expansion.

---

### Requirement 7: ExportModal Polish

**User Story:** As a user, I want the ExportModal to guide me through export settings clearly so that I can export with confidence and without confusion.

#### Acceptance Criteria

1. THE ExportModal SHALL render preset and quality option cards with `border-2` borders; WHEN a card is selected, THE ExportModal SHALL apply `border-purple-500 bg-purple-500/10`; WHEN unselected, THE ExportModal SHALL apply `border-zinc-700 hover:border-zinc-600`.
2. WHEN preflight errors are present, THE ExportModal SHALL render them in a `border-red-500/50 bg-red-500/10 text-red-300` block above the settings.
3. WHEN preflight warnings are present, THE ExportModal SHALL render them in a `border-amber-500/50 bg-amber-500/10 text-amber-300` block above the settings.
4. WHEN an export is in progress, THE ExportModal SHALL render a `Progress` bar with a stage label and numeric percentage, and SHALL disable the Export button.
5. THE ExportModal scrollable content area SHALL apply a fade-out mask at the bottom edge to indicate additional scrollable content.
6. THE ExportModal footer SHALL always remain visible and SHALL not scroll with the content area.

---

### Requirement 8: Shared UI Primitive Consistency

**User Story:** As a developer and user, I want all shared UI components to behave and look consistently so that the app feels unified.

#### Acceptance Criteria

1. THE Button component SHALL render a visible Focus_Ring (`focus-visible:ring-2 focus-visible:ring-purple-500`) on keyboard focus for all variants.
2. THE Button component SHALL apply `disabled:opacity-50 disabled:pointer-events-none` to all variants when the `disabled` prop is set.
3. THE Input component SHALL render with `border-zinc-700 bg-zinc-800` base styles and a `focus:ring-purple-500` Focus_Ring.
4. THE Slider component SHALL render the track in `bg-zinc-700` and the filled range in `bg-purple-500` to match the Color_Palette.
5. THE Dialog component SHALL render with `bg-zinc-900 border-zinc-800 text-zinc-100` and a `backdrop-blur-sm` overlay.
6. WHEN a UI_Primitive receives a `className` prop, THE component SHALL merge it with the base variant classes without overriding required structural styles.

---

### Requirement 9: Processing Overlay Polish

**User Story:** As a user, I want processing overlays to clearly communicate progress so that I know the app is working and not frozen.

#### Acceptance Criteria

1. WHEN a Processing_Overlay is displayed, THE Editor SHALL render a `backdrop-blur-sm bg-zinc-950/80` full-screen scrim behind the overlay card.
2. THE Processing_Overlay card SHALL render with `rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl` styling.
3. WHEN the BPM adjustment overlay is shown, THE Editor SHALL render an animated spinner using `animate-spin border-purple-500 border-t-transparent`.
4. WHEN the video speed processing overlay is shown, THE Editor SHALL render a `Progress` bar with a stage label (`Preparing`, `Encoding`, `Finalizing`) and a numeric percentage.
5. WHEN a Processing_Overlay is dismissed, THE Editor SHALL restore full interactivity to all editor controls within one animation frame.

---

### Requirement 10: Landing Page Polish

**User Story:** As a prospective user, I want the landing page to feel professional and inviting so that I am motivated to launch the editor.

#### Acceptance Criteria

1. THE Landing_Page SHALL render a full-height gradient background using `from-zinc-950 to-zinc-900` with no visible seam at the viewport boundary.
2. THE Landing_Page feature cards SHALL render with `border-zinc-700 bg-zinc-800/50` and `rounded-lg` corners, and SHALL apply a `hover:border-zinc-600 hover:bg-zinc-800` Transition on hover.
3. THE Landing_Page "Launch Editor" button SHALL render with `bg-purple-600 hover:bg-purple-700` and include a leading icon.
4. THE Landing_Page SHALL render the app name and tagline in a centered hero section with the `Music` icon displayed at `h-12 w-12 text-purple-500`.
5. WHEN the user hovers over a feature card, THE Landing_Page SHALL apply a smooth `transition-colors duration-200` Transition to the border and background.

---

### Requirement 11: Keyboard Accessibility and Focus Management

**User Story:** As a keyboard user, I want all interactive controls to be reachable and clearly focused so that I can operate the editor without a mouse.

#### Acceptance Criteria

1. THE Editor SHALL ensure every interactive element (buttons, inputs, sliders, menu items) is reachable via the Tab key in a logical document order.
2. WHEN a modal or dropdown is opened, THE Editor SHALL move keyboard focus to the first interactive element within that surface.
3. WHEN a modal or dropdown is closed, THE Editor SHALL return keyboard focus to the element that triggered the open action.
4. THE Editor SHALL render a visible Focus_Ring on all focused interactive elements that meets a minimum 2px outline width.
5. IF a keyboard shortcut conflicts with a browser default, THEN THE Editor SHALL call `preventDefault()` on the event to ensure the shortcut functions as intended.

---

### Requirement 12: Micro-interaction and Animation Consistency

**User Story:** As a user, I want UI state changes to feel smooth and intentional so that the editor feels responsive and alive.

#### Acceptance Criteria

1. THE Editor SHALL apply `transition-colors duration-150` to all hover and active state color changes on interactive elements.
2. WHEN the InspectorPanel collapses or expands, THE Editor SHALL animate the width change using `transition-[width] duration-200`.
3. WHEN a Toast notification appears, THE Toast SHALL animate in from the bottom of the screen using a slide-up Transition.
4. WHEN a dropdown or context menu opens, THE Editor SHALL render it with an `opacity` and `scale` entrance animation of no more than 150ms duration.
5. THE Editor SHALL not apply Transitions to canvas elements (`canvas`, `video`, `audio`) as defined by the `transition: none !important` rule in `globals.css`.
