import { describe, expect, it } from 'vitest';
import {
  chordPitches,
  voicingAt,
  strumOffsets,
  chordLabel,
  chordSetForKey,
  QUALITY_INTERVALS,
} from '@/lib/midi/chords';

const pcs = (pitches: number[]) => pitches.map((p) => ((p % 12) + 12) % 12);

describe('chord construction', () => {
  it('builds a root-position major triad on the right pitch classes', () => {
    // C major at baseRoot 60 → C4 E4 G4
    const notes = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(0.5), 60);
    expect(notes).toEqual([60, 64, 67]);
  });

  it('respects quality — minor flattens the third, 7ths add the seventh', () => {
    expect(chordPitches({ rootPc: 0, quality: 'min' }, voicingAt(0.5), 60)).toEqual([60, 63, 67]);
    expect(chordPitches({ rootPc: 0, quality: 'maj7' }, voicingAt(0.5), 60)).toEqual([60, 64, 67, 71]);
    expect(chordPitches({ rootPc: 0, quality: 'm7' }, voicingAt(0.5), 60)).toEqual([60, 63, 67, 70]);
  });

  it('inverts by lifting the lowest note an octave, keeping the same pitch classes', () => {
    const root = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(0.5), 60);   // root position
    const first = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(0.3), 60);  // 1st inversion
    expect(first).toEqual([64, 67, 72]);
    // An inversion re-voices the SAME chord — the set of pitch classes is unchanged.
    expect(new Set(pcs(first))).toEqual(new Set(pcs(root)));
  });

  it('gives sparse low voicings at the bottom and fuller high ones at the top', () => {
    const bottom = chordPitches({ rootPc: 0, quality: 'maj7' }, voicingAt(0.95), 60);
    const lowMid = chordPitches({ rootPc: 0, quality: 'maj7' }, voicingAt(0.7), 60);
    const top = chordPitches({ rootPc: 0, quality: 'maj7' }, voicingAt(0.05), 60);
    expect(bottom).toHaveLength(1);                       // bass note only
    expect(lowMid).toHaveLength(2);                       // root + 5th
    expect(top.length).toBeGreaterThanOrEqual(4);         // full chord
    // and it genuinely rises as you move up the pad
    expect(Math.min(...bottom)).toBeLessThan(Math.min(...lowMid) + 1);
    expect(Math.min(...top)).toBeGreaterThan(Math.min(...bottom));
  });

  it('root + 5th picks the actual fifth of the chord, including altered fifths', () => {
    // this band also drops an octave (octaveShift -1), hence 48 rather than 60
    expect(chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(0.7), 60)).toEqual([48, 55]);
    // diminished has no perfect 5th — it must use the ♭5, not fall back to 7 semis
    expect(chordPitches({ rootPc: 0, quality: 'dim' }, voicingAt(0.7), 60)).toEqual([48, 54]);
    expect(chordPitches({ rootPc: 0, quality: 'aug' }, voicingAt(0.7), 60)).toEqual([48, 56]);
  });

  it('transposes with the root', () => {
    const g = chordPitches({ rootPc: 7, quality: 'maj' }, voicingAt(0.5), 60);
    expect(pcs(g).sort((a, b) => a - b)).toEqual([2, 7, 11]); // G B D
  });

  it('always returns ascending pitches', () => {
    for (const q of Object.keys(QUALITY_INTERVALS) as (keyof typeof QUALITY_INTERVALS)[]) {
      for (const y of [0.05, 0.3, 0.5, 0.7, 0.95]) {
        const notes = chordPitches({ rootPc: 3, quality: q }, voicingAt(y), 60);
        expect(notes).toEqual([...notes].sort((a, b) => a - b));
        expect(notes.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('strum', () => {
  it('spreads a downstroke low→high and an upstroke high→low', () => {
    expect(strumOffsets(4, 0.06, 'down')).toEqual([0, 0.02, 0.04, 0.06]);
    expect(strumOffsets(4, 0.06, 'up')).toEqual([0.06, 0.04, 0.02, 0]);
  });

  it('block chords have no spread', () => {
    expect(strumOffsets(4, 0.06, 'none')).toEqual([0, 0, 0, 0]);
    expect(strumOffsets(1, 0.06, 'down')).toEqual([0]);
  });
});

describe('chord sets and labels', () => {
  it('labels chords readably', () => {
    expect(chordLabel({ rootPc: 0, quality: 'maj' })).toBe('C');
    expect(chordLabel({ rootPc: 9, quality: 'min' })).toBe('Am');
    expect(chordLabel({ rootPc: 7, quality: '7' })).toBe('G7');
  });

  it('builds the familiar major-key pad set (C: C Dm Em F G Am G7 B°)', () => {
    expect(chordSetForKey(0).map(chordLabel)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7', 'B°']);
  });

  it('builds a minor-key set rooted on the tonic minor', () => {
    const set = chordSetForKey(9, true); // A minor
    expect(chordLabel(set[0])).toBe('Am');
    expect(chordLabel(set[1])).toBe('C');
  });
});
