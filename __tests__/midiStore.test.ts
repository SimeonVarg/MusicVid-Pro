import './helpers/ensureLocalStorage'; // must precede the store import
import { describe, expect, it, beforeEach } from 'vitest';
import { useEditorStore } from '@/stores/editorStore';
import type { MidiNote } from '@/lib/midi/noteUtils';

// Reset the relevant slices between tests.
function reset() {
  useEditorStore.setState({
    midiTracks: [],
    videoTracks: [],
    audioTracks: [],
    textTracks: [],
    selectedTrackIds: [],
    pianoRollTrackId: null,
    timeline: { ...useEditorStore.getState().timeline, currentTime: 0, duration: 0 },
    musical: { ...useEditorStore.getState().musical, bpm: 120 },
  });
}

const note = (over: Partial<MidiNote> = {}): MidiNote => ({
  id: `n-${Math.random().toString(36).slice(2)}`,
  pitch: 60,
  startBeat: 0,
  durationBeats: 1,
  velocity: 0.8,
  ...over,
});

describe('MIDI store actions', () => {
  beforeEach(reset);

  it('adds a MIDI track with a default instrument and selects it', () => {
    const id = useEditorStore.getState().addMidiTrack();
    const state = useEditorStore.getState();
    expect(state.midiTracks).toHaveLength(1);
    expect(state.midiTracks[0].id).toBe(id);
    expect(state.midiTracks[0].instrumentId).toBe('piano');
    expect(state.selectedTrackIds).toEqual([id]);
    expect(state.midiTracks[0].duration).toBeGreaterThan(0);
  });

  it('updates notes and recomputes the clip duration from content', () => {
    const id = useEditorStore.getState().addMidiTrack();
    // a note ending at beat 6 → clip rounds up to 2 bars (8 beats) at 4/4
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ startBeat: 4, durationBeats: 2 })]);
    const t = useEditorStore.getState().midiTracks.find((m) => m.id === id)!;
    expect(t.notes).toHaveLength(1);
    // 8 beats at 120bpm = 4 seconds
    expect(t.duration).toBeCloseTo(4);
    expect(t.trimEnd).toBeCloseTo(4);
    expect(useEditorStore.getState().timeline.duration).toBeGreaterThanOrEqual(4);
  });

  it('transpose and velocity actions mutate notes', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ pitch: 60, velocity: 0.5 })]);
    useEditorStore.getState().transposeMidiTrack(id, 12);
    expect(useEditorStore.getState().midiTracks[0].notes[0].pitch).toBe(72);
    useEditorStore.getState().scaleMidiVelocity(id, 1.5);
    expect(useEditorStore.getState().midiTracks[0].notes[0].velocity).toBeCloseTo(0.75);
  });

  it('setBPM rescales MIDI clip length (BPM-relative)', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ startBeat: 0, durationBeats: 4 })]);
    const at120 = useEditorStore.getState().midiTracks[0].duration; // 4 beats = 2s
    expect(at120).toBeCloseTo(2);
    useEditorStore.getState().setBPM(60);
    const at60 = useEditorStore.getState().midiTracks[0].duration; // 4 beats = 4s
    expect(at60).toBeCloseTo(4);
  });

  it('removeTrack removes a MIDI track', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().removeTrack(id);
    expect(useEditorStore.getState().midiTracks).toHaveLength(0);
  });

  it('undo restores notes after an edit', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().updateMidiTrackNotes(id, [note(), note({ startBeat: 1 })]);
    expect(useEditorStore.getState().midiTracks[0].notes).toHaveLength(2);
    useEditorStore.getState().undo(); // undo the notes edit
    expect(useEditorStore.getState().midiTracks[0].notes).toHaveLength(0);
  });

  it('openPianoRoll only opens for existing MIDI tracks', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().openPianoRoll('nonexistent');
    expect(useEditorStore.getState().pianoRollTrackId).toBeNull();
    useEditorStore.getState().openPianoRoll(id);
    expect(useEditorStore.getState().pianoRollTrackId).toBe(id);
  });

  it('setMidiLoopLength extends the clip and only loops past the content', () => {
    const id = useEditorStore.getState().addMidiTrack();
    // A 4-beat (1-bar) pattern → 2s clip at 120 BPM.
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ startBeat: 0, durationBeats: 4 })]);
    expect(useEditorStore.getState().midiTracks[0].duration).toBeCloseTo(2);

    // Loop ×4 → 16 beats → 8s clip.
    useEditorStore.getState().setMidiLoopLength(id, 16);
    expect(useEditorStore.getState().midiTracks[0].loopLengthBeats).toBe(16);
    expect(useEditorStore.getState().midiTracks[0].duration).toBeCloseTo(8);

    // A length at/under the content clears the loop (can't loop shorter than the pattern).
    useEditorStore.getState().setMidiLoopLength(id, 4);
    expect(useEditorStore.getState().midiTracks[0].loopLengthBeats).toBeUndefined();
    expect(useEditorStore.getState().midiTracks[0].duration).toBeCloseTo(2);
  });

  it('the stored pattern is unchanged by looping (non-destructive)', () => {
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ startBeat: 0, durationBeats: 1 })]);
    useEditorStore.getState().setMidiLoopLength(id, 16);
    // Loop lives as metadata; the source stays a single note (repeats are synthesized
    // at playback/export via tileLoopedNotes, not baked into the clip).
    expect(useEditorStore.getState().midiTracks[0].notes).toHaveLength(1);
  });

  it('dragging a MIDI clip edge past its content loops it (resizeTrackEdge path)', () => {
    // This is the exact commit the timeline clip-edge drag runs on mouse-up.
    useEditorStore.setState({ timeline: { ...useEditorStore.getState().timeline, snapToGrid: false } });
    const id = useEditorStore.getState().addMidiTrack();
    useEditorStore.getState().updateMidiTrackNotes(id, [note({ startBeat: 0, durationBeats: 4 })]); // 2s content
    // Drag the right edge out to 8s → loop to 16 beats.
    useEditorStore.getState().resizeTrackEdge(id, 'end', 8, true);
    expect(useEditorStore.getState().midiTracks[0].loopLengthBeats).toBeCloseTo(16);
    expect(useEditorStore.getState().midiTracks[0].duration).toBeCloseTo(8);
    // Drag it back inside the content → loop clears (plain clip again).
    useEditorStore.getState().resizeTrackEdge(id, 'end', 1, true);
    expect(useEditorStore.getState().midiTracks[0].loopLengthBeats).toBeUndefined();
    expect(useEditorStore.getState().midiTracks[0].duration).toBeCloseTo(2);
  });
});
