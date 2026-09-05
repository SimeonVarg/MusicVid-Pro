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

describe('an instrument cannot sound below its lowest note', () => {
  // The pads built every chord around C4 whatever was selected, so on a guitar
  // the bottom band asked for notes below the low E string. A guitarist voices
  // an open E off the low E, but an open C off C3 on the A string — never the
  // C below the instrument.
  const GUITAR_LOW_E = 40;
  const bass = voicingAt(1, 3); // bottom of the pad

  it('puts a guitar E chord bass exactly on the low E string', () => {
    const pitches = chordPitches({ rootPc: 4, quality: 'maj' }, bass, GUITAR_LOW_E + 12, GUITAR_LOW_E);
    expect(Math.min(...pitches)).toBe(GUITAR_LOW_E);
  });

  it('lifts a C chord to the octave a guitar can actually play', () => {
    const pitches = chordPitches({ rootPc: 0, quality: 'maj' }, bass, GUITAR_LOW_E + 12, GUITAR_LOW_E);
    expect(Math.min(...pitches)).toBe(48); // C3, the open C chord's bass
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(GUITAR_LOW_E);
  });

  it('never voices any chord of the key below the instrument', () => {
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const band of [0, 0.25, 0.5, 0.75, 1]) {
        const v = voicingAt(band, 3);
        const pitches = chordPitches({ rootPc, quality: 'maj' }, v, GUITAR_LOW_E + 12, GUITAR_LOW_E);
        expect(Math.min(...pitches)).toBeGreaterThanOrEqual(GUITAR_LOW_E);
      }
    }
  });

  it('shifts by whole octaves, so the chord shape survives', () => {
    const withFloor = chordPitches({ rootPc: 0, quality: 'maj' }, bass, 52, 40);
    const without = chordPitches({ rootPc: 0, quality: 'maj' }, bass, 52);
    expect(withFloor.map((p) => p - withFloor[0])).toEqual(without.map((p) => p - without[0]));
  });

  it('leaves a keyboard alone when no floor is given', () => {
    const pitches = chordPitches({ rootPc: 0, quality: 'maj' }, voicingAt(0.5, 3), 60);
    expect(pitches.length).toBeGreaterThan(0);
    expect(Math.min(...pitches)).toBeLessThan(72);
  });
});
