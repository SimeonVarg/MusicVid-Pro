/**
 * What a strumming hand does, as numbers.
 *
 * A strum is not a chord with a delay. Three things make it read as a hand:
 *
 *  1. TIME between strings, scaled to tempo. The delay between adjacent strings
 *     is about 2.2% of the strum cycle — one down plus one up — which at 120 BPM
 *     is 11 ms per string and 55 ms across six. That figure comes from the
 *     patent behind keyboard "auto band" rhythm-guitar accompaniment, which is
 *     exactly the reference for this feature. It cross-checks against physics:
 *     the strings span ~48 mm at the soundhole, so 11 ms per string is a hand
 *     moving 0.87 m/s, and a 120 BPM eighth-note stroke peaks around 0.75 m/s.
 *
 *  2. ASYMMETRY. A downstroke rakes every string; an upstroke is a lighter
 *     return motion that catches only the top three to five. That difference is
 *     most of what separates real strumming from a chord being retriggered.
 *
 *  3. DYNAMICS across the stroke. The hand gives most of its force to the
 *     strings it meets first, so velocity falls slightly along the rake — about
 *     2 dB, enough to hear as a rake, not so much that it breaks into an
 *     arpeggio — and the last string lifts a little as the pick leaves it.
 */
import type { Voicing } from './fretVoicing';
import { soundingPitches } from './fretVoicing';

export type StrumDirection = 'down' | 'up';
export type StrumSpeed = 'slow' | 'medium' | 'fast';
/** A = accent, C = normal, g = ghost, M = muted chuck. */
export type StrokeWeight = 'A' | 'C' | 'g' | 'M';

export interface StrumNote {
  pitch: number;
  /** Seconds after the stroke anchor. */
  offsetSec: number;
  velocity: number;
  durationSec: number;
}

/** Delay between adjacent strings as a fraction of the strum cycle. */
const INTER_STRING_FRACTION = 0.022;

const SPEED_FACTOR: Record<StrumSpeed, number> = {
  // A deliberate ballad rake: 22 ms/string at 120 BPM.
  slow: 2.0,
  medium: 1.0,
  // 5.5 ms/string at 120 BPM — right at the edge of where the ear stops
  // resolving the strings separately, which is what "tight" should feel like.
  fast: 0.5,
};

/** The up-stroke is the faster return half of the hand's oscillation. */
const DIRECTION_FACTOR: Record<StrumDirection, number> = { down: 1.0, up: 0.75 };

const STROKE_VELOCITY: Record<StrokeWeight, number> = { A: 1.0, C: 0.72, g: 0.3, M: 0.35 };

/** Seconds between adjacent strings for this tempo, speed and direction. */
export function interStringSec(bpm: number, speed: StrumSpeed = 'medium', direction: StrumDirection = 'down'): number {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  const cycleSec = 60 / safeBpm;
  return INTER_STRING_FRACTION * cycleSec * SPEED_FACTOR[speed] * DIRECTION_FACTOR[direction];
}

/**
 * Which strings this stroke catches, in the order the hand meets them.
 *
 * A downstroke starts at the lowest string and rakes across everything. An
 * upstroke starts at the highest and only reaches down a few strings — harder
 * strokes reach further.
 */
export function stringsForStroke(
  sounding: number[],
  direction: StrumDirection,
  weight: StrokeWeight = 'C'
): number[] {
  if (sounding.length === 0) return [];
  if (direction === 'down') return [...sounding];
  const reach = weight === 'A' ? 5 : weight === 'g' ? 3 : 4;
  return [...sounding].slice(-Math.min(reach, sounding.length)).reverse();
}

export interface StrumOptions {
  bpm: number;
  direction: StrumDirection;
  speed?: StrumSpeed;
  weight?: StrokeWeight;
  /** Seconds each note is held. Strummed strings normally ring on. */
  durationSec?: number;
  /** 0-1. Timing and dynamic variation, so four identical bars are not identical. */
  feel?: number;
  /** Injected for deterministic tests. */
  random?: () => number;
}

/**
 * The notes of one stroke: which pitch sounds, how long after the stroke began,
 * and how hard.
 */
export function strumStroke(voicing: Voicing, tuning: number[], opts: StrumOptions): StrumNote[] {
  const {
    bpm, direction, speed = 'medium', weight = 'C',
    durationSec = 2.0, feel = 0.35, random = Math.random,
  } = opts;

  const sounding = soundingPitches(voicing, tuning);
  const order = stringsForStroke(sounding, direction, weight);
  if (order.length === 0) return [];

  const gap = interStringSec(bpm, speed, direction);
  const base = STROKE_VELOCITY[weight] * (direction === 'up' ? 0.8 : 1);
  const jitter = () => 1 + (random() * 2 - 1) * 0.08 * Math.max(0, Math.min(1, feel));

  let elapsed = 0;
  return order.map((pitch, i) => {
    if (i > 0) elapsed += gap * jitter();
    const spread = order.length > 1 ? i / (order.length - 1) : 0;
    // Force falls along the rake, and the last string lifts as the pick leaves
    // it — it is also the top of the voicing, the note that carries.
    let velocity = base * (1 - 0.18 * spread);
    if (i === order.length - 1) velocity *= 1.1;
    return {
      pitch,
      offsetSec: elapsed,
      velocity: Math.max(0.15, Math.min(1, velocity)),
      // A muted chuck is a percussive click, not a chord.
      durationSec: weight === 'M' ? 0.06 : durationSec,
    };
  });
}

/** Total time from the first string to the last, in seconds. */
export function strokeSpanSec(noteCount: number, bpm: number, speed: StrumSpeed = 'medium', direction: StrumDirection = 'down'): number {
  return Math.max(0, noteCount - 1) * interStringSec(bpm, speed, direction);
}
