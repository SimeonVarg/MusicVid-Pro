# Bugfix Requirements Document

## Introduction

The video preview and export compositor render video track layers with inverted z-ordering. Tracks that appear earlier in the `videoTracks` array (higher in the track list UI) should be the topmost visual layer, but currently they render behind tracks that appear later in the array. This is most noticeable after splitting a track and moving the resulting segment to overlap with another track — the wrong layer appears on top.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN multiple video tracks overlap at the current playback time THEN the system renders the track with the highest array index on top (last in `videoTracks` = highest z-index)

1.2 WHEN a video track is split and the new segment overlaps with the original THEN the system renders the split segment (inserted at `index + 1`) on top of the original track in the preview

1.3 WHEN the timeline is exported via TimelineCompositor with overlapping video tracks THEN the system overlays tracks in array order so that the last track in the array appears on top in the output file

### Expected Behavior (Correct)

2.1 WHEN multiple video tracks overlap at the current playback time THEN the system SHALL render the track with the lowest array index on top (first in `videoTracks` = highest z-index)

2.2 WHEN a video track is split and the new segment overlaps with the original THEN the system SHALL render the original track (earlier in the array) on top of the split segment in the preview

2.3 WHEN the timeline is exported via TimelineCompositor with overlapping video tracks THEN the system SHALL overlay tracks so that the first track in the array appears on top in the output file

### Unchanged Behavior (Regression Prevention)

3.1 WHEN only a single video track is active at the current time THEN the system SHALL CONTINUE TO display it normally without z-ordering issues

3.2 WHEN video tracks do not overlap in time THEN the system SHALL CONTINUE TO display each track independently during its active time range

3.3 WHEN the user reorders video tracks via `reorderVideoTrack` THEN the system SHALL CONTINUE TO respect the new array order for z-index priority

3.4 WHEN text tracks are rendered over video THEN the system SHALL CONTINUE TO display text tracks above all video layers

3.5 WHEN video track fade opacity is applied THEN the system SHALL CONTINUE TO calculate fade opacity correctly regardless of z-order
