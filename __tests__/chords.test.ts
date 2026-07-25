import { describe, expect, it } from 'vitest';
import {
  chordPitches,
  voicingAt,
  VOICING_BANDS,
  strumOffsets,
  chordLabel,
  chordSetForKey,
  QUALITY_INTERVALS,
} from '@/lib/midi/chords';

const pcs = (pitches: number[]) => pitches.map((p) => ((p % 12) + 12) % 12);
/** Pointer y (0 = top, 1 = bottom) landing in the middle of band `b`. */
const yForBand = (b: number) => 1 - (b + 0.5) / VOICING_BANDS;

describe('chord construction', () => {
  it('builds a root-position major triad on the right pitch classes', () => {
    // C major at baseRoot 60 → C4 E4 G4
    const notes = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(yForBand(2), 3), 60);
    expect(notes).toEqual([60, 64, 67]);
  });

  it('respects quality — minor flattens the third, 7ths add the seventh', () => {
    expect(chordPitches({ rootPc: 0, quality: 'min' }, voicingAt(yForBand(2), 3), 60)).toEqual([60, 63, 67]);
    expect(chordPitches({ rootPc: 0, quality: 'maj7' }, voicingAt(yForBand(2), 4), 60)).toEqual([60, 64, 67, 71]);
    expect(chordPitches({ rootPc: 0, quality: 'm7' }, voicingAt(yForBand(2), 4), 60)).toEqual([60, 63, 67, 70]);
  });

  it('inverts by lifting the lowest note an octave, keeping the same pitch classes', () => {
    const root = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(yForBand(2), 3), 60);
    const first = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(yForBand(3), 3), 60);
    expect(root).toEqual([60, 64, 67]);
    expect(first).toEqual([64, 67, 72]);
    expect(new Set(pcs(first))).toEqual(new Set(pcs(root)));
  });

  it('each band steps up by ONE CHORD TONE, never a whole octave', () => {
    // The complaint: every box jumped an octave. Walking up the pad should walk
    // up the chord, so each band's lowest note is the previous band's SECOND
    // note - exactly what moving up a guitar neck does.
    const chord = { rootPc: 0, quality: 'maj' } as const;
    const full = [];
    for (let b = 2; b < VOICING_BANDS; b++) {
      full.push(chordPitches(chord, voicingAt(yForBand(b), 3), 60));
    }
    for (let i = 1; i < full.length; i++) {
      expect(full[i][0]).toBe(full[i - 1][1]);
      const jump = full[i][0] - full[i - 1][0];
      expect(jump).toBeGreaterThan(0);
      expect(jump).toBeLessThan(12); // a full octave jump is the bug
    }
  });

  it('gives many playable bands, not a couple', () => {
    expect(VOICING_BANDS).toBeGreaterThanOrEqual(8);
    const names = new Set<string>();
    for (let b = 0; b < VOICING_BANDS; b++) names.add(voicingAt(yForBand(b), 3).name);
    expect(names.size).toBe(VOICING_BANDS);
  });

  it('a seventh chord walks through four inversions before repeating', () => {
    const seventh = { rootPc: 0, quality: 'maj7' } as const;
    const lows = [];
    for (let b = 2; b < 2 + 5; b++) lows.push(chordPitches(seventh, voicingAt(yForBand(b), 4), 60)[0]);
    expect(lows).toEqual([60, 64, 67, 71, 72]); // C E G B, then C an octave up
  });

  it('transposes with the root', () => {
    const g = chordPitches({ rootPc: 7, quality: 'maj' }, voicingAt(yForBand(2), 3), 60);
    expect(pcs(g).sort((a, b) => a - b)).toEqual([2, 7, 11]); // G B D
  });

  it('always returns ascending pitches', () => {
    for (const q of Object.keys(QUALITY_INTERVALS) as (keyof typeof QUALITY_INTERVALS)[]) {
      for (let b = 0; b < VOICING_BANDS; b++) {
        const notes = chordPitches({ rootPc: 3, quality: q }, voicingAt(yForBand(b), 3), 60);
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
