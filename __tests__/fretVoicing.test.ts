import { describe, expect, it } from 'vitest';
import {
  BASS_STANDARD,
  GUITAR_STANDARD,
  soundingPitches,
  tuningFor,
  voiceOnNeck,
} from '@/lib/midi/fretVoicing';
import { QUALITY_INTERVALS, type ChordQuality } from '@/lib/midi/chords';

const pc = (n: number) => ((n % 12) + 12) % 12;
const QUALITIES: ChordQuality[] = ['maj', 'min', '7', 'm7', 'maj7', 'sus4', 'sus2', '6', 'm6'];
const sounding = (rootPc: number, quality: ChordQuality, tuning = GUITAR_STANDARD) =>
  soundingPitches(voiceOnNeck({ rootPc, quality }, tuning), tuning);

describe('the open shapes a guitarist actually plays', () => {
  it('gives open E its six ringing strings, low E first', () => {
    expect(sounding(4, 'maj')).toEqual([40, 47, 52, 56, 59, 64]);
  });

  it('gives open Am the shape everyone learns first', () => {
    // x02210 -> A2 E3 A3 C4 E4
    expect(sounding(9, 'min')).toEqual([45, 52, 57, 60, 64]);
  });

  it('gives open D its top four strings only', () => {
    expect(sounding(2, 'maj')).toEqual([50, 57, 62, 66]);
  });

  it('doubles pitch classes — which is what makes a strum audible at all', () => {
    // Three distinct notes at 11ms/string span 22ms, under the ~31-35ms at which
    // a guitarist can hear asynchrony. A real shape has five or six.
    for (const [root, q] of [[4, 'maj'], [9, 'min'], [7, 'maj'], [0, 'maj']] as const) {
      const notes = sounding(root, q as ChordQuality);
      expect(notes.length).toBeGreaterThanOrEqual(5);
      expect(new Set(notes.map(pc)).size).toBeLessThan(notes.length);
    }
  });
});

describe('every chord, every root, is legal on the neck', () => {
  it('contains exactly the chord tones — nothing missing, nothing foreign', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of QUALITIES) {
        const notes = sounding(root, q);
        const present = new Set(notes.map(pc));
        const required = new Set(QUALITY_INTERVALS[q].map((i) => pc(root + i)));
        expect([...present].sort()).toEqual([...required].sort());
      }
    }
  });

  it('never asks for a note below the instrument', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of QUALITIES) {
        expect(Math.min(...sounding(root, q))).toBeGreaterThanOrEqual(GUITAR_STANDARD[0]);
        expect(Math.min(...sounding(root, q, BASS_STANDARD))).toBeGreaterThanOrEqual(BASS_STANDARD[0]);
      }
    }
  });

  it('puts a root, third or fifth in the bass — never a stray seventh', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of QUALITIES) {
        const bass = pc(pc(sounding(root, q)[0]) - root);
        const legal = QUALITY_INTERVALS[q].slice(0, 3).map(pc);
        expect(legal).toContain(bass);
      }
    }
  });

  it('stays within a four-fret hand and the first fourteen frets', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of QUALITIES) {
        const frets = voiceOnNeck({ rootPc: root, quality: q }, GUITAR_STANDARD);
        const fretted = frets.filter((f): f is number => f !== null && f > 0);
        if (fretted.length > 1) {
          expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4);
        }
        for (const f of frets) if (f !== null) expect(f).toBeGreaterThanOrEqual(0);
        for (const f of frets) if (f !== null) expect(f).toBeLessThanOrEqual(14);
      }
    }
  });

  it('sounds at least four strings for a triad', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of ['maj', 'min'] as ChordQuality[]) {
        expect(sounding(root, q).length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('rises from the low string to the high one, and wastes no string on a unison', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of QUALITIES) {
        const notes = sounding(root, q);
        for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThanOrEqual(notes[i - 1]);
        // Every sounding string should add a voice. Doubling an octave apart is
        // what a guitar does; doubling at the same pitch just loses a string.
        expect(new Set(notes).size).toBe(notes.length);
      }
    }
  });
});

describe('a bass is not a guitar', () => {
  it('voices on four strings and never below the low E', () => {
    for (let root = 0; root < 12; root++) {
      const notes = sounding(root, 'maj', BASS_STANDARD);
      expect(notes.length).toBeLessThanOrEqual(4);
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(28);
    }
  });
});

describe('which instruments have a neck', () => {
  it('covers every guitar and bass, not just the two that had a tuning', () => {
    for (const id of ['guitar-acoustic', 'guitar-nylon', 'guitar-steel', 'guitar-electric-clean', 'guitar-distortion']) {
      expect(tuningFor(id, 'guitars')).toEqual(GUITAR_STANDARD);
    }
    for (const id of ['bass-electric', 'bass-upright', 'bass-pick', 'bass-fretless', 'bass-slap']) {
      expect(tuningFor(id, 'guitars', 'bass')).toEqual(BASS_STANDARD);
    }
  });

  it('gives a piano no neck', () => {
    expect(tuningFor('piano', 'keys')).toBeUndefined();
    expect(tuningFor('marimba', 'mallets')).toBeUndefined();
  });
});
