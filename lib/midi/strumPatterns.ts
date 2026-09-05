/**
 * Strum patterns.
 *
 * The important idea: a pattern stores WHICH slots sound and HOW HARD, and the
 * DIRECTION is derived. A strumming hand keeps moving whether or not it touches
 * the strings, so on a sixteenth grid with the hand swinging in eighths, every
 * even swing is a downstroke and every odd one an upstroke — always, with no
 * choice in the matter. Storing direction as loose data would let you author a
 * pattern no hand could physically play.
 *
 * That rule regenerates the patterns people actually know. Take the folk/pop
 * standard, D-DU-UDU: the hand swings eighths (step = 2 slots) and touches
 * slots 0, 4, 6, 10, 12, 14. Halve those: 0, 2, 3, 5, 6, 7 — even, even, odd,
 * odd, even, odd — D, D, U, U, D, U. Which is D · DU · UDU, including the
 * silent downstroke on beat 3 that gives the pattern its lift.
 */
import type { StrokeWeight, StrumDirection, StrumSpeed } from './strum';

/**
 * One slot of a bar.
 *   A  accented chord      C  chord
 *   g  ghost (barely there) M  muted chuck
 *   -  the hand passes without touching the strings
 *   .  no hand motion at all
 */
export type SlotSymbol = 'A' | 'C' | 'g' | 'M' | '-' | '.';

export interface StrumPattern {
  id: string;
  label: string;
  /** How often the hand swings, in slots per bar: 4 = quarters, 8 = eighths. */
  handRate: number;
  /** Slot symbols for one bar of 4/4 (16 slots). */
  slots: SlotSymbol[];
  /** All strokes are downstrokes — the hand resets between them. */
  forceDown?: boolean;
  /** Overrides the player's speed setting where the pattern demands it. */
  speed?: StrumSpeed;
  blurb: string;
}

const parse = (s: string): SlotSymbol[] => s.replace(/\s/g, '').split('') as SlotSymbol[];

export const STRUM_PATTERNS: StrumPattern[] = [
  {
    id: 'quarters',
    label: 'Quarters',
    handRate: 4,
    forceDown: true,
    slots: parse('A...C...A...C...'),
    blurb: 'One down-strum a beat. The first thing anyone learns.',
  },
  {
    id: 'eighths',
    label: 'Driving eighths',
    handRate: 8,
    forceDown: true,
    slots: parse('A.C.C.C.A.C.C.C.'),
    blurb: 'All downstrokes, straight through. Punk and power-pop.',
  },
  {
    id: 'old-faithful',
    label: 'Old faithful',
    handRate: 8,
    slots: parse('A...C.C.-.C.C.C.'),
    blurb: 'D · DU · UDU — the folk and pop standard.',
  },
  {
    id: 'funk-16',
    label: '16th funk',
    handRate: 16,
    slots: parse('AMMCMMAMMMCCMMCM'),
    blurb: 'The hand never stops; the mutes carry the groove.',
  },
  {
    id: 'ballad',
    label: 'Ballad',
    handRate: 8,
    speed: 'slow',
    slots: parse('A.....C.C.....C.'),
    blurb: 'Slow rakes with air between them.',
  },
  {
    id: 'chuck',
    label: 'Muted chuck',
    handRate: 8,
    slots: parse('A.M.C.M.A.M.C.M.'),
    blurb: 'Chord on the beat, muted click on the off-beat.',
  },
];

export interface Stroke {
  /** Slot index within the bar. */
  slot: number;
  /** Beats from the start of the bar. */
  beat: number;
  direction: StrumDirection;
  weight: StrokeWeight;
}

/** Slots in one bar for a time signature. 4/4 = 16, 3/4 = 12, 6/8 = 12. */
export function slotsPerBar(numerator: number, denominator: number): number {
  return Math.max(1, Math.round(numerator * (16 / denominator)));
}

/**
 * The direction of the hand at a slot.
 *
 * Simple meters alternate down/up with the swing. Compound meters (6/8, 12/8)
 * group in threes, where the hand plays down, down, up across each group —
 * the standard 6/8 strum.
 */
export function directionAt(slot: number, handRate: number, compound: boolean, forceDown = false): StrumDirection {
  if (forceDown) return 'down';
  const step = Math.max(1, Math.round(16 / handRate));
  const swing = Math.floor(slot / step);
  if (compound) return swing % 3 === 2 ? 'up' : 'down';
  return swing % 2 === 0 ? 'down' : 'up';
}

/**
 * The strokes of one bar: when each happens, which way the hand is going, and
 * how hard. Slots where the hand does not touch the strings produce nothing,
 * but they still shape the parity of the strokes around them.
 */
export function strokesForBar(
  pattern: StrumPattern,
  timeSignature: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }
): Stroke[] {
  const total = slotsPerBar(timeSignature.numerator, timeSignature.denominator);
  const compound = timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0;
  // A sixteenth is a quarter of a beat in simple time; patterns are written for
  // 4/4 and repeat or truncate to fit anything else.
  const beatsPerSlot = 4 / 16;

  const out: Stroke[] = [];
  for (let slot = 0; slot < total; slot++) {
    const symbol = pattern.slots[slot % pattern.slots.length];
    if (symbol === '.' || symbol === '-') continue;
    out.push({
      slot,
      beat: slot * beatsPerSlot,
      direction: directionAt(slot, pattern.handRate, compound, pattern.forceDown),
      weight: symbol,
    });
  }
  return out;
}

export function patternById(id: string): StrumPattern {
  return STRUM_PATTERNS.find((p) => p.id === id) ?? STRUM_PATTERNS[2];
}
