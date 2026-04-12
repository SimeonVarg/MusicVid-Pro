# Bugfix Requirements Document

## Introduction

Three bugs have been identified in the MusicVid Pro timeline editor. Bug 1 prevents video tracks from being reordered vertically in the timeline — they are stuck in their initial position and cannot be dragged above or below other tracks. Bug 2 causes a visual freeze after undoing a video speed change — the video clip's last frame stays frozen until the original clip length elapses, meaning the undo operation does not correctly restore the previous speed state. Bug 3 is a complete non-function of the transpose feature, which also needs to be made available for video tracks (not just audio tracks) as the user expects.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Video Track Reordering**

1.1 WHEN a user drags a video track clip vertically in the timeline THEN the system constrains the drag to the clip's original Y position, preventing vertical reordering of tracks.

1.2 WHEN a user attempts to drag a video track above or below another video track in the timeline THEN the system does not update the track order in `videoTracks` state, leaving the visual order unchanged.

**Bug 2 — Undo After Video Speed Change**

1.3 WHEN a user changes a video track's playback speed and then invokes undo THEN the system restores the previous track state in the store but the video element continues to display the last frame of the speed-changed clip until the original clip's full duration elapses.

1.4 WHEN undo is applied after a video speed change THEN the system does not reload the video source URL from the restored snapshot, so the `<video>` element retains the stale speed-changed blob URL.

**Bug 3 — Transpose Non-Function**

1.5 WHEN a user applies a transpose (pitch shift) operation to an audio track THEN the system does not produce any audible change in pitch.

1.6 WHEN a user selects a video track in the inspector THEN the system does not present a transpose control, making transpose unavailable for video tracks.

---

### Expected Behavior (Correct)

**Bug 1 — Video Track Reordering**

2.1 WHEN a user drags a video track clip vertically past the midpoint of an adjacent track row THEN the system SHALL reorder the `videoTracks` array so the dragged track swaps position with the adjacent track, updating the visual order in the timeline.

2.2 WHEN a user releases a video track clip after a vertical drag THEN the system SHALL commit the new track order to the store and push a history snapshot so the reorder is undoable.

**Bug 2 — Undo After Video Speed Change**

2.3 WHEN undo is invoked after a video speed change THEN the system SHALL restore the previous `url` and `file` reference on the video track so the video element reloads from the correct source immediately.

2.4 WHEN undo restores a video track snapshot THEN the system SHALL trigger a re-render of the video preview with the restored source URL so no stale frame is displayed.

**Bug 3 — Transpose Non-Function**

2.5 WHEN a user applies a transpose value (in semitones) to an audio track THEN the system SHALL produce a correctly pitch-shifted audio buffer and update the track's `pitch` field and playback source.

2.6 WHEN a user selects a video track in the inspector THEN the system SHALL present a transpose control that, when applied, extracts the embedded audio (if not already extracted), pitch-shifts it, and links it back to the video track.

---

### Unchanged Behavior (Regression Prevention)

**Bug 1 — Video Track Reordering**

3.1 WHEN a user drags a video track clip horizontally along the timeline THEN the system SHALL CONTINUE TO update the track's `offset` without affecting the vertical order of any tracks.

3.2 WHEN a user drags an audio or text track clip THEN the system SHALL CONTINUE TO behave as before — horizontal repositioning only, unaffected by the video reorder fix.

**Bug 2 — Undo After Video Speed Change**

3.3 WHEN undo is invoked for any operation other than a video speed change (e.g., trim, offset, add track) THEN the system SHALL CONTINUE TO restore state correctly with no change in behavior.

3.4 WHEN a video speed change is applied without a subsequent undo THEN the system SHALL CONTINUE TO display the speed-changed video correctly.

**Bug 3 — Transpose Non-Function**

3.5 WHEN a user applies a BPM adjustment or time-stretch to an audio track THEN the system SHALL CONTINUE TO process the operation independently of the transpose fix.

3.6 WHEN a video track has no embedded audio and the user attempts to transpose it THEN the system SHALL CONTINUE TO surface an appropriate error rather than silently failing.
