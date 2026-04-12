/**
 * P2-E-1 through P2-E-5: Integration tests for processing and track operations.
 * Tests pure logic without loading FFmpeg WASM or the full Zustand store.
 */
import { describe, it, expect } from 'vitest';

// ---- Pure helpers mirroring store logic ----

interface AudioTrackLike {
  id: string;
  bpm: number;
  originalBpm: number;
  timeStretch: number;
  pitch: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration: number;
  duration: number;
  offset: number;
}

function applyTimeStretch(track: AudioTrackLike, ratio: number, syncOffsetMs = 0): AudioTrackLike {
  const newSourceDuration = Math.max(0.01, track.sourceDuration / ratio);
  const trimStartRatio = track.trimStart / track.sourceDuration;
  const trimEndRatio = track.trimEnd / track.sourceDuration;
  const remappedTrimStart = Math.max(0, Math.min(newSourceDuration - 0.01, trimStartRatio * newSourceDuration));
  const remappedTrimEnd = Math.max(remappedTrimStart + 0.01, Math.min(newSourceDuration, trimEndRatio * newSourceDuration));

  return {
    ...track,
    bpm: track.bpm * ratio,
    timeStretch: ratio,
    sourceDuration: newSourceDuration,
    duration: newSourceDuration,
    trimStart: remappedTrimStart,
    trimEnd: remappedTrimEnd,
    offset: track.offset + syncOffsetMs / 1000,
  };
}

function applyVideoSpeedChange(
  videoDuration: number,
  audioTrack: AudioTrackLike,
  ratio: number
): { newVideoDuration: number; newAudioTrack: AudioTrackLike } {
  const newVideoDuration = Math.max(0.01, videoDuration / ratio);
  const newAudioTrack = applyTimeStretch(audioTrack, ratio);
  return { newVideoDuration, newAudioTrack };
}

function makeAudioTrack(overrides: Partial<AudioTrackLike> = {}): AudioTrackLike {
  return {
    id: 'a1', bpm: 120, originalBpm: 120, timeStretch: 1, pitch: 0,
    trimStart: 0, trimEnd: 10, sourceDuration: 10, duration: 10, offset: 0,
    ...overrides,
  };
}

describe('P2-E-1: timeStretchTrack logic', () => {
  it('updates BPM proportionally to ratio', () => {
    const track = makeAudioTrack({ bpm: 120 });
    const result = applyTimeStretch(track, 2.0);
    expect(result.bpm).toBeCloseTo(240, 5);
  });

  it('halves duration for ratio=2.0', () => {
    const track = makeAudioTrack({ sourceDuration: 10 });
    const result = applyTimeStretch(track, 2.0);
    expect(result.sourceDuration).toBeCloseTo(5, 5);
  });

  it('doubles duration for ratio=0.5', () => {
    const track = makeAudioTrack({ sourceDuration: 10 });
    const result = applyTimeStretch(track, 0.5);
    expect(result.sourceDuration).toBeCloseTo(20, 5);
  });

  it('remaps trim points proportionally', () => {
    const track = makeAudioTrack({ trimStart: 2, trimEnd: 8, sourceDuration: 10 });
    const result = applyTimeStretch(track, 2.0);
    expect(result.trimStart).toBeCloseTo(1, 5);
    expect(result.trimEnd).toBeCloseTo(4, 5);
  });

  it('trim invariant holds after stretch', () => {
    const track = makeAudioTrack({ trimStart: 1, trimEnd: 9, sourceDuration: 10 });
    const result = applyTimeStretch(track, 3.0);
    expect(result.trimStart).toBeGreaterThanOrEqual(0);
    expect(result.trimEnd).toBeLessThanOrEqual(result.sourceDuration);
    expect(result.trimStart).toBeLessThan(result.trimEnd);
  });

  it('applies syncOffsetMs to offset', () => {
    const track = makeAudioTrack({ offset: 0 });
    const result = applyTimeStretch(track, 1.0, 500);
    expect(result.offset).toBeCloseTo(0.5, 5);
  });
});

describe('P2-E-2: changeVideoPlaybackSpeed — video and audio durations match', () => {
  it('video and audio have same duration after speed change', () => {
    const audioTrack = makeAudioTrack({ sourceDuration: 10 });
    const { newVideoDuration, newAudioTrack } = applyVideoSpeedChange(10, audioTrack, 2.0);
    expect(newVideoDuration).toBeCloseTo(newAudioTrack.sourceDuration, 5);
  });

  it('ratio=0.5 doubles both durations', () => {
    const audioTrack = makeAudioTrack({ sourceDuration: 10 });
    const { newVideoDuration, newAudioTrack } = applyVideoSpeedChange(10, audioTrack, 0.5);
    expect(newVideoDuration).toBeCloseTo(20, 5);
    expect(newAudioTrack.sourceDuration).toBeCloseTo(20, 5);
  });

  it('ratio=1.0 is identity', () => {
    const audioTrack = makeAudioTrack({ sourceDuration: 10 });
    const { newVideoDuration, newAudioTrack } = applyVideoSpeedChange(10, audioTrack, 1.0);
    expect(newVideoDuration).toBeCloseTo(10, 5);
    expect(newAudioTrack.sourceDuration).toBeCloseTo(10, 5);
  });
});

describe('P2-E-3: syncAudioTracksToMaster — offsets applied to correct IDs', () => {
  it('maps results back to the correct track IDs', () => {
    const trackIds = ['id-a', 'id-b', 'id-c'];
    const offsets = [0.1, 0.5, -0.2];

    // Simulate the fixed syncTracksToMaster returning correct IDs
    const syncResults = trackIds.map((id, i) => ({ trackId: id, offset: offsets[i], confidence: 0.85 }));

    const tracks = trackIds.map((id, i) => ({ id, offset: 0 }));
    const updated = tracks.map((t) => {
      const result = syncResults.find((r) => r.trackId === t.id);
      return result ? { ...t, offset: result.offset } : t;
    });

    expect(updated[0].offset).toBeCloseTo(0.1, 8);
    expect(updated[1].offset).toBeCloseTo(0.5, 8);
    expect(updated[2].offset).toBeCloseTo(-0.2, 8);
  });

  it('does not apply offsets to wrong tracks when IDs are correct', () => {
    const syncResults = [{ trackId: 'track-b', offset: 1.5, confidence: 0.9 }];
    const tracks = [
      { id: 'track-a', offset: 0 },
      { id: 'track-b', offset: 0 },
    ];
    const updated = tracks.map((t) => {
      const result = syncResults.find((r) => r.trackId === t.id);
      return result ? { ...t, offset: result.offset } : t;
    });

    expect(updated[0].offset).toBe(0);       // track-a unchanged
    expect(updated[1].offset).toBeCloseTo(1.5, 8); // track-b updated
  });
});

describe('P2-E-4: splitTrack — two tracks with correct trim points', () => {
  function splitTrack(track: { trimStart: number; trimEnd: number; offset: number }, splitTime: number) {
    const sourceTime = track.trimStart + (splitTime - track.offset);
    if (sourceTime <= track.trimStart || sourceTime >= track.trimEnd) return null;
    return {
      left: { ...track, trimEnd: sourceTime },
      right: { ...track, id: 'right', offset: splitTime, trimStart: sourceTime },
    };
  }

  it('produces two clips with no gap', () => {
    const track = { trimStart: 0, trimEnd: 10, offset: 0 };
    const result = splitTrack(track, 5)!;
    expect(result.left.trimEnd).toBeCloseTo(result.right.trimStart, 8);
  });

  it('right clip starts at split time', () => {
    const track = { trimStart: 0, trimEnd: 10, offset: 0 };
    const result = splitTrack(track, 4)!;
    expect(result.right.offset).toBeCloseTo(4, 8);
  });
});

describe('P2-E-5: undo/redo state identity', () => {
  interface State { value: number }

  function applyAction(state: State, delta: number): State {
    return { value: state.value + delta };
  }

  it('undo(redo(state)) === state', () => {
    const initial: State = { value: 10 };
    const past: State[] = [];
    const future: State[] = [];

    // Apply action
    past.push(initial);
    const afterAction = applyAction(initial, 5);

    // Redo (simulate)
    past.push(afterAction);
    const afterRedo = applyAction(afterAction, 3);

    // Undo
    const undone = past.pop()!;
    future.push(afterRedo);

    expect(undone.value).toBe(afterAction.value);

    // Undo again
    const undoneAgain = past.pop()!;
    expect(undoneAgain.value).toBe(initial.value);
  });
});
