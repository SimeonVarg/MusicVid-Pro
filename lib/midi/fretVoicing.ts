/**
 * Turning a chord into a shape on a neck.
 *
 * `chordPitches` in chords.ts returns an interval stack — C major is three
 * notes, C E G. A guitar does not play that. An open C is x32010: five sounding
 * strings, C3 E3 G3 C4 E4, with C and E doubled. The doubling is not decoration:
 * a strum is only audible AS a strum when the strokes are far enough apart to be
 * heard as separate events, and three notes at a realistic 11 ms per string span
 * 22 ms — under the ~31-35 ms at which a guitarist can detect asynchrony at all.
 * Strum a three-note stack and you hear one chord, not a hand.
 *
 * So: pitches come from the tuning, always. String i sounds `tuning[i] +
 * frets[i]`, and `null` means the string is not played. Never build guitar
 * pitches from intervals.
 */
import { QUALITY_INTERVALS, type Chord, type ChordQuality } from './chords';

/** Standard tunings, low string first (MIDI). */
export const GUITAR_STANDARD = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
export const BASS_STANDARD = [28, 33, 38, 43];           // E1 A1 D2 G2

/** One fret per string, low string first. `null` = not sounded. */
export type Voicing = (number | null)[];

export interface VoicingOptions {
  /** Highest fret the shape may use. Keeps voicings in the sampled range. */
  maxFret?: number;
  /** Widest fret span across fretted (non-open) strings. A hand is four frets. */
  maxSpan?: number;
}

const pc = (n: number) => ((n % 12) + 12) % 12;

/**
 * The classic open shapes, written the way a guitarist writes them.
 *
 * They earn their place over anything the search finds: open strings ring
 * longer, they are what a player's hand actually does, and our acoustic guitar
 * is sampled over a narrow range so open-position pitches land nearest a real
 * recorded note rather than a stretched one.
 */
const OPEN_CHORDS: Record<string, Voicing> = {
  // root:quality
  '4:maj': [0, 2, 2, 1, 0, 0],        // E
  '4:min': [0, 2, 2, 0, 0, 0],        // Em
  '4:7': [0, 2, 0, 1, 0, 0],          // E7
  '4:m7': [0, 2, 0, 0, 0, 0],         // Em7
  '9:maj': [null, 0, 2, 2, 2, 0],     // A
  '9:min': [null, 0, 2, 2, 1, 0],     // Am
  '9:7': [null, 0, 2, 0, 2, 0],       // A7
  '9:m7': [null, 0, 2, 0, 1, 0],      // Am7
  '2:maj': [null, null, 0, 2, 3, 2],  // D
  '2:min': [null, null, 0, 2, 3, 1],  // Dm
  '2:7': [null, null, 0, 2, 1, 2],    // D7
  '2:sus4': [null, null, 0, 2, 3, 3], // Dsus4
  '7:maj': [3, 2, 0, 0, 0, 3],        // G
  '7:7': [3, 2, 0, 0, 0, 1],          // G7
  '0:maj': [null, 3, 2, 0, 1, 0],     // C
  '0:maj7': [null, 3, 2, 0, 0, 0],    // Cmaj7
};

/** Pitches that actually sound for a voicing, low string first. */
export function soundingPitches(voicing: Voicing, tuning: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < voicing.length && i < tuning.length; i++) {
    const fret = voicing[i];
    if (fret !== null && fret !== undefined) out.push(tuning[i] + fret);
  }
  return out;
}

/** Every pitch class the quality requires. */
function chordPcs(chord: Chord): Set<number> {
  const intervals = QUALITY_INTERVALS[chord.quality as ChordQuality] ?? [0, 4, 7];
  return new Set(intervals.map((i) => pc(chord.rootPc + i)));
}

/**
 * Is this shape playable and musically legal?
 * Rejects foreign notes, missing chord tones, impossible stretches, and a
 * seventh accidentally left in the bass.
 */
function isLegal(voicing: Voicing, tuning: number[], chord: Chord, maxSpan: number): boolean {
  const sounding = soundingPitches(voicing, tuning);
  if (sounding.length < 3) return false;

  const required = chordPcs(chord);
  const present = new Set(sounding.map(pc));
  for (const p of present) if (!required.has(p)) return false; // no foreign tones
  for (const p of required) if (!present.has(p)) return false; // nothing missing

  // The lowest note must be a root, third or fifth — a legal inversion.
  const bassInterval = pc(pc(sounding[0]) - chord.rootPc);
  const intervals = QUALITY_INTERVALS[chord.quality as ChordQuality] ?? [0, 4, 7];
  const bassAllowed = intervals.slice(0, 3).map((i) => pc(i));
  if (!bassAllowed.includes(bassInterval)) return false;

  const fretted = voicing.filter((f): f is number => f !== null && f > 0);
  if (fretted.length > 0 && Math.max(...fretted) - Math.min(...fretted) > maxSpan) return false;

  return true;
}

/** Higher is better. Prefers open position, full shapes and a low bass. */
function score(voicing: Voicing, tuning: number[], isOpenTable: boolean): number {
  const sounding = soundingPitches(voicing, tuning);
  let s = 0;
  if (isOpenTable) s += 3;
  const fretted = voicing.filter((f): f is number => f !== null && f > 0);
  const lowestFret = fretted.length > 0 ? Math.min(...fretted) : 0;
  if (lowestFret <= 7) s += 2;
  s += Math.max(0, sounding.length - 4);
  // A guitar chord's bass belongs near the bottom of the instrument.
  if (sounding[0] <= tuning[0] + 7) s += 2;
  // Open strings ring; prefer them.
  s += voicing.filter((f) => f === 0).length * 0.25;
  // Two strings on the SAME pitch is a wasted string. It is playable — an open
  // B and the G string's 4th fret are both B3 — but it adds no voice to the
  // chord, and the point of a neck voicing is more sounding notes, not fewer.
  const unisons = sounding.length - new Set(sounding).size;
  s -= unisons * 1.5;
  return s;
}

/**
 * Search for a shape by sliding a four-fret hand up the neck and, at each
 * position, giving every string the lowest fret under that hand that lands on a
 * chord tone. This is what a player does when there is no open shape to reach
 * for, and unlike a fixed form table it works for every quality we ship.
 */
function searchVoicing(chord: Chord, tuning: number[], opts: Required<VoicingOptions>): Voicing | null {
  const required = chordPcs(chord);
  let best: Voicing | null = null;
  let bestScore = -Infinity;

  for (let position = 0; position + opts.maxSpan <= opts.maxFret; position++) {
    const frets: Voicing = tuning.map((open) => {
      // Open strings count when the position includes them.
      const lo = position === 0 ? 0 : position;
      for (let f = lo; f <= position + opts.maxSpan; f++) {
        if (required.has(pc(open + f))) return f;
      }
      return null;
    });

    // Drop low strings until the bass note is a legal one.
    const candidate = [...frets];
    for (let attempt = 0; attempt < candidate.length; attempt++) {
      if (isLegal(candidate, tuning, chord, opts.maxSpan)) {
        const sc = score(candidate, tuning, false);
        if (sc > bestScore) { bestScore = sc; best = [...candidate]; }
        break;
      }
      const firstSounding = candidate.findIndex((f) => f !== null);
      if (firstSounding === -1) break;
      candidate[firstSounding] = null;
    }
  }
  return best;
}

/**
 * The shape to play for a chord on a given tuning.
 *
 * Returns one fret per string (low string first), `null` for strings that are
 * not sounded. Falls back to a stacked voicing only if nothing legal exists,
 * so a caller always gets something playable.
 */
export function voiceOnNeck(chord: Chord, tuning: number[], options: VoicingOptions = {}): Voicing {
  const opts: Required<VoicingOptions> = {
    maxFret: options.maxFret ?? 14,
    maxSpan: options.maxSpan ?? 4,
  };

  // A standard-tuned six-string gets the open shapes a guitarist would use.
  const isStandardGuitar =
    tuning.length === GUITAR_STANDARD.length && tuning.every((t, i) => t === GUITAR_STANDARD[i]);
  if (isStandardGuitar) {
    const open = OPEN_CHORDS[`${pc(chord.rootPc)}:${chord.quality}`];
    if (open && isLegal(open, tuning, chord, opts.maxSpan)) return [...open];
  }

  const found = searchVoicing(chord, tuning, opts);
  if (found) return found;

  // Nothing legal under a four-fret hand: sound the chord tones we can reach,
  // lowest first. Rare, and better than silence.
  const required = [...chordPcs(chord)];
  return tuning.map((open, i) => {
    const target = required[i % required.length];
    for (let f = 0; f <= opts.maxFret; f++) if (pc(open + f) === target) return f;
    return null;
  });
}

/** Standard tuning for an instrument id, or undefined if it is not fretted. */
export function tuningFor(instrumentId: string, family?: string, group?: string): number[] | undefined {
  if (group === 'bass' || instrumentId.startsWith('bass')) return BASS_STANDARD;
  if (family === 'guitars' || instrumentId.startsWith('guitar')) return GUITAR_STANDARD;
  return undefined;
}
