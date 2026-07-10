import { describe, expect, it } from 'vitest';
import {
  beatsToSeconds,
  clampPitch,
  contentLengthBeats,
  isBlackKey,
  notesActiveAt,
  pitchToName,
  quantizeNotes,
  scaleVelocities,
  secondsToBeats,
  snapBeat,
  transposeNotes,
  type MidiNote,
} from '../lib/midi/noteUtils';

const note = (over: Partial<MidiNote> = {}): MidiNote => ({
  id: 'n1',
  pitch: 60,
  startBeat: 0,
  durationBeats: 1,
  velocity: 0.8,
  ...over,
});

describe('pitch naming', () => {
  it('names middle C and neighbors correctly', () => {
    expect(pitchToName(60)).toBe('C4');
    expect(pitchToName(61)).toBe('C#4');
    expect(pitchToName(69)).toBe('A4');
    expect(pitchToName(21)).toBe('A0');
    expect(pitchToName(108)).toBe('C8');
  });

  it('identifies black keys', () => {
    expect(isBlackKey(61)).toBe(true); // C#
    expect(isBlackKey(60)).toBe(false); // C
    expect(isBlackKey(70)).toBe(true); // A#
  });

  it('clamps out-of-range pitches', () => {
    expect(clampPitch(-5)).toBe(0);
    expect(clampPitch(200)).toBe(127);
  });
});

describe('tempo conversion', () => {
  it('round-trips beats and seconds at 120 BPM', () => {
    expect(beatsToSeconds(4, 120)).toBeCloseTo(2);
    expect(secondsToBeats(2, 120)).toBeCloseTo(4);
  });

  it('one beat at 60 BPM is one second', () => {
    expect(beatsToSeconds(1, 60)).toBeCloseTo(1);
  });
});

describe('snapping + quantize', () => {
  it('snaps to the nearest grid line', () => {
    expect(snapBeat(1.3, 0.5)).toBeCloseTo(1.5);
    expect(snapBeat(1.2, 0.5)).toBeCloseTo(1);
    expect(snapBeat(0.1, 0.25)).toBeCloseTo(0);
  });

  it('never snaps negative', () => {
    expect(snapBeat(-0.4, 0.5)).toBe(0);
  });

  it('grid <= 0 disables snapping', () => {
    expect(snapBeat(1.37, 0)).toBeCloseTo(1.37);
  });

  it('quantize moves starts but preserves durations', () => {
    const [q] = quantizeNotes([note({ startBeat: 1.1, durationBeats: 0.7 })], 0.25);
    expect(q.startBeat).toBeCloseTo(1);
    expect(q.durationBeats).toBeCloseTo(0.7);
  });
});

describe('transpose + velocity', () => {
  it('transposes and clamps at range edges', () => {
    const [up] = transposeNotes([note({ pitch: 60 })], 12);
    expect(up.pitch).toBe(72);
    const [top] = transposeNotes([note({ pitch: 120 })], 12);
    expect(top.pitch).toBe(127);
  });

  it('zero transpose returns identical pitches', () => {
    const [same] = transposeNotes([note({ pitch: 60 })], 0);
    expect(same.pitch).toBe(60);
  });

  it('scales velocity with clamping', () => {
    const [v] = scaleVelocities([note({ velocity: 0.5 })], 1.5);
    expect(v.velocity).toBeCloseTo(0.75);
    const [max] = scaleVelocities([note({ velocity: 0.9 })], 2);
    expect(max.velocity).toBe(1);
    const [min] = scaleVelocities([note({ velocity: 0.05 })], 0.01);
    expect(min.velocity).toBeCloseTo(0.01);
  });
});

describe('content length + active notes', () => {
  it('rounds content length up to whole bars with a 1-bar floor', () => {
    expect(contentLengthBeats([])).toBe(4);
    expect(contentLengthBeats([note({ startBeat: 3.5, durationBeats: 1 })])).toBe(8);
    expect(contentLengthBeats([note({ startBeat: 0, durationBeats: 4 })])).toBe(4);
  });

  it('finds notes sounding at a beat (exclusive of edges)', () => {
    const notes = [
      note({ id: 'a', startBeat: 0, durationBeats: 1 }),
      note({ id: 'b', startBeat: 1, durationBeats: 1 }),
    ];
    expect(notesActiveAt(notes, 0.5).map((n) => n.id)).toEqual(['a']);
    expect(notesActiveAt(notes, 1).map((n) => n.id)).toEqual([]); // boundary: a ended, b starts
    expect(notesActiveAt(notes, 1.5).map((n) => n.id)).toEqual(['b']);
  });
});
