/**
 * Chord engine — the musical logic behind the chord pads.
 *
 * Kept pure (no Tone, no React) so voicings can be unit-tested head-on: a chord
 * that plays the wrong inversion is a *rule* bug, and rules are cheaper to test
 * than to eyeball on a pad grid.
 *
 * Model, following GarageBand's Smart controls:
 *  - A chord = root pitch-class + quality (interval set).
 *  - WHERE you press a pad picks the voicing: low presses give a sparse bass
 *    voicing, high presses give fuller, higher inversions. So one pad is an
 *    expressive control, not a single fixed stack.
 *  - Strum spreads the notes in time (down = low→high, up = high→low).
 */

export type ChordQuality =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | '6' | 'm6' | '7' | 'maj7' | 'm7' | 'm7b5' | 'dim7' | '7sus4'
  | 'add9' | 'madd9' | '9' | 'maj9' | 'm9' | '7b9' | '7#5' | 'alt';

/** Semitones above the root. Extensions stay above the octave on purpose. */
export const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj:    [0, 4, 7],
  min:    [0, 3, 7],
  dim:    [0, 3, 6],
  aug:    [0, 4, 8],
  sus2:   [0, 2, 7],
  sus4:   [0, 5, 7],
  '6':    [0, 4, 7, 9],
  m6:     [0, 3, 7, 9],
  '7':    [0, 4, 7, 10],
  maj7:   [0, 4, 7, 11],
  m7:     [0, 3, 7, 10],
  m7b5:   [0, 3, 6, 10],
  dim7:   [0, 3, 6, 9],
  '7sus4':[0, 5, 7, 10],
  add9:   [0, 4, 7, 14],
  madd9:  [0, 3, 7, 14],
  '9':    [0, 4, 7, 10, 14],
  maj9:   [0, 4, 7, 11, 14],
  m9:     [0, 3, 7, 10, 14],
  '7b9':  [0, 4, 7, 10, 13],
  '7#5':  [0, 4, 8, 10],
  alt:    [0, 4, 10, 15, 20], // 7♯9♭13 — the usual "altered" grip
};

/** Display suffix for a quality (root name is prepended by the caller). */
export const QUALITY_LABEL: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4',
  '6': '6', m6: 'm6', '7': '7', maj7: 'maj7', m7: 'm7', m7b5: 'm7♭5',
  dim7: '°7', '7sus4': '7sus4', add9: 'add9', madd9: 'm(add9)',
  '9': '9', maj9: 'maj9', m9: 'm9', '7b9': '7♭9', '7#5': '7♯5', alt: 'alt',
};

export const QUALITY_GROUPS: { label: string; items: ChordQuality[] }[] = [
  { label: 'Triads',    items: ['maj', 'min', 'sus4', 'sus2', 'dim', 'aug'] },
  { label: 'Sixths',    items: ['6', 'm6'] },
  { label: 'Sevenths',  items: ['7', 'maj7', 'm7', 'm7b5', 'dim7', '7sus4', '7#5'] },
  { label: 'Extended',  items: ['add9', 'madd9', '9', 'maj9', 'm9', '7b9', 'alt'] },
];

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export interface Chord {
  /** 0–11, C = 0 */
  rootPc: number;
  quality: ChordQuality;
}

export function chordLabel(chord: Chord): string {
  return NOTE_NAMES[((chord.rootPc % 12) + 12) % 12] + QUALITY_LABEL[chord.quality];
}

/** How a press position maps to a voicing. `y` is 0 at the TOP, 1 at the BOTTOM. */
export interface Voicing {
  /** How many chord tones to sound (bass-only presses use 1). */
  noteCount: number;
  /** Chord inversion — 0 = root position. */
  inversion: number;
  /** Octave offset applied after inversion. */
  octaveShift: number;
  /** Human hint shown on the pad. */
  name: string;
}

/**
 * How many playable bands a chord pad is divided into. Each band steps the
 * voicing up by ONE CHORD TONE, not a whole octave: pressing one band higher
 * should give the next inversion up, the way moving up a guitar neck does.
 * A whole-octave jump per band is what made the pads feel unusable.
 */
export const VOICING_BANDS = 9;

const ORDINAL = ['root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];

/**
 * Bottom of the pad = sparse and low (bass note, then root + 5th), everything
 * above = the full chord walking up one inversion at a time. `y` is 0 at the
 * TOP and 1 at the BOTTOM, matching pointer maths.
 */
export function voicingAt(y: number, chordSize = 3): Voicing {
  const t = Math.max(0, Math.min(1, y));
  // band 0 at the bottom .. VOICING_BANDS-1 at the top
  const band = Math.min(VOICING_BANDS - 1, Math.floor((1 - t) * VOICING_BANDS));
  if (band === 0) return { noteCount: 1, inversion: 0, octaveShift: -1, name: 'bass' };
  if (band === 1) return { noteCount: 2, inversion: 0, octaveShift: -1, name: 'root + 5th' };

  // Remaining bands walk the full chord up one tone per band. Once past the top
  // inversion the shape repeats an octave higher, which is exactly what the next
  // position up the neck is.
  const step = band - 2;
  const size = Math.max(2, chordSize);
  const inversion = step % size;
  const octaveShift = Math.floor(step / size);
  const name = octaveShift > 0
    ? `${ORDINAL[inversion] ?? `inversion ${inversion}`} +${octaveShift}oct`
    : (ORDINAL[inversion] ?? `inversion ${inversion}`);
  return { noteCount: 99, inversion, octaveShift, name };
}

/**
 * Build the sounding pitches for a chord at a voicing.
 * `baseOctave` is the MIDI octave of the root before any shift (60 = C4).
 */
export function chordPitches(
  chord: Chord,
  voicing: Voicing,
  baseRoot = 60,
  lowestPitch?: number
): number[] {
  const intervals = QUALITY_INTERVALS[chord.quality];
  const rootPc = ((chord.rootPc % 12) + 12) % 12;
  // Root nearest the base, then the quality's intervals on top of it.
  const root = baseRoot - (baseRoot % 12) + rootPc;
  let pitches = intervals.map((i) => root + i);

  if (voicing.noteCount === 2) {
    // root + fifth: take the root and whichever tone is the perfect/altered 5th
    const fifth = intervals.find((i) => i === 7) ?? intervals.find((i) => i === 6 || i === 8) ?? 7;
    pitches = [root, root + fifth];
  } else if (voicing.noteCount < intervals.length) {
    pitches = pitches.slice(0, voicing.noteCount);
  }

  // Inversion: move the lowest note up an octave, `inversion` times.
  for (let k = 0; k < voicing.inversion && pitches.length > 1; k++) {
    const low = Math.min(...pitches);
    pitches = pitches.map((p) => (p === low ? p + 12 : p));
  }

  let voiced = pitches.map((p) => p + voicing.octaveShift * 12).sort((a, b) => a - b);

  // An instrument cannot sound below its lowest note. Lift the whole chord by
  // octaves rather than clamping note by note, which would collapse the shape.
  //
  // This is what a guitarist does without thinking: the bass of an open E is
  // the low E string, but the bass of an open C is C3 on the A string, not the
  // C below the guitar's range. Without it the pads' bottom band asked for
  // notes the instrument does not have, and the sampler answered with the
  // nearest one it did - which is why the low end sounded an octave adrift.
  if (lowestPitch !== undefined && voiced.length > 0) {
    while (voiced[0] < lowestPitch) voiced = voiced.map((p) => p + 12);
  }

  return voiced;
}

export type StrumDirection = 'down' | 'up' | 'none';

/**
 * Per-note time offsets (seconds) for a strum. Down = low→high (a downstroke
 * hits the low strings first), up = high→low, none = block chord.
 */
export function strumOffsets(count: number, spreadSec: number, direction: StrumDirection): number[] {
  if (direction === 'none' || count <= 1 || spreadSec <= 0) return new Array(count).fill(0);
  const step = spreadSec / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => (direction === 'down' ? i : count - 1 - i) * step);
}

/** The 8 pads of a key — the I–vi chords players actually reach for, plus a V7. */
export function chordSetForKey(tonicPc: number, minor = false): Chord[] {
  const t = ((tonicPc % 12) + 12) % 12;
  const at = (semis: number) => (t + semis) % 12;
  return minor
    ? [
        { rootPc: t, quality: 'min' },        { rootPc: at(3), quality: 'maj' },
        { rootPc: at(5), quality: 'min' },    { rootPc: at(7), quality: 'min' },
        { rootPc: at(8), quality: 'maj' },    { rootPc: at(10), quality: 'maj' },
        { rootPc: at(7), quality: '7' },      { rootPc: at(2), quality: 'm7b5' },
      ]
    : [
        { rootPc: t, quality: 'maj' },        { rootPc: at(2), quality: 'min' },
        { rootPc: at(4), quality: 'min' },    { rootPc: at(5), quality: 'maj' },
        { rootPc: at(7), quality: 'maj' },    { rootPc: at(9), quality: 'min' },
        { rootPc: at(7), quality: '7' },      { rootPc: at(11), quality: 'dim' },
      ];
}
