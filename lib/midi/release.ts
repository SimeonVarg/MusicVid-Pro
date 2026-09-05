/**
 * What happens when you let go of a note.
 *
 * Tone's Sampler defaults to `release: 0.1` with an exponential curve, and
 * nothing here ever overrode it — so every instrument, from a concert grand to
 * a crotale, got the same 100 ms chop when a key came up. That is what makes a
 * held piano note "stop abruptly": on a real piano the damper takes about a
 * second to bring a mid-range string to silence, and the top octaves have no
 * dampers at all.
 *
 * So release time is a property of the physical instrument, not a constant:
 *
 *   ONE-SHOT   You cannot un-ring it. A struck bar, a plucked pizzicato, a
 *              cymbal. Releasing the key must do NOTHING; the sample plays to
 *              its natural end. (Every one of these sample folders was measured
 *              to end at digital silence — below -50 dBFS over the last 300 ms
 *              — so letting them run cannot click.)
 *   DAMPED     Piano and friends. A felt damper falls on a moving string; it
 *              takes time, and it takes longer on a heavy bass string. Above
 *              the damper line there is no damper at all.
 *   PLUCKED    A finger leaving a fretted string stops it fast, but not
 *              instantly, and the body keeps ringing.
 *   BLOWN/BOWED Stop the air or the bow and the note stops - but a room and an
 *              instrument body do not stop instantly either.
 *
 * The piano numbers are not invented. They are the release values from the
 * Salamander Grand Piano SFZ, which is the library our piano samples come from:
 * a global `ampeg_release` of 1.0 s for the damped range, 3.0 s from MIDI 89,
 * and 4.0 s from MIDI 95 - the regions the SFZ itself marks "Notes without
 * dampers". The damper boundary at 89 matches the physical instrument, where
 * the last damper sits around the second-highest F.
 */

/** How an instrument answers a key-up. */
export type ReleaseClass = 'one-shot' | 'damped-keys' | 'plucked' | 'sustained' | 'envelope';

/**
 * Instruments that physically cannot be stopped by letting go. Releasing one of
 * these must be a no-op, not a fast fade — a marimba bar does not care that you
 * lifted your finger.
 */
const ONE_SHOT_IDS = new Set([
  'marimba', 'xylophone', 'glockenspiel', 'vibraphone', 'tubular-bells',
  'crotales', 'kalimba', 'steel-drums', 'taiko', 'orchestra-hit',
  'strings-pizzicato', 'harp',
]);

/** Struck strings with felt dampers: the piano family. */
const DAMPED_KEY_IDS = new Set([
  'piano', 'piano-bright', 'piano-electric-grand', 'piano-honkytonk',
  'rhodes', 'wurlitzer', 'celesta', 'clavinet', 'harpsichord',
]);

/** Families whose every member rings out regardless of the key. */
const ONE_SHOT_FAMILIES = new Set(['kits', 'machines', 'perc-aux', 'perc-concert', 'mallets']);

/** Families that stop when the player stops pushing air or hair. */
const SUSTAINED_FAMILIES = new Set(['strings', 'woodwinds', 'brass', 'voice', 'organs']);

export function releaseClassFor(instrumentId: string, family?: string): ReleaseClass {
  if (ONE_SHOT_IDS.has(instrumentId)) return 'one-shot';
  if (family && ONE_SHOT_FAMILIES.has(family)) return 'one-shot';
  if (DAMPED_KEY_IDS.has(instrumentId)) return 'damped-keys';
  if (instrumentId.startsWith('guitar') || instrumentId.startsWith('bass')) return 'plucked';
  if (family === 'guitars') return 'plucked';
  if (family && SUSTAINED_FAMILIES.has(family)) return 'sustained';
  // A harpsichord-ish or unknown sampled instrument: a short, natural tail is
  // always safer than a 100 ms chop.
  return 'sustained';
}

/**
 * Seconds of release for a note, or `null` when the instrument must not be
 * released at all (let the sample ring to its end).
 *
 * The piano curve is pitch-dependent because the instrument is: below the
 * damper line a note is damped in about a second, above it nothing damps it.
 */
export function releaseSecondsFor(instrumentId: string, pitch: number, family?: string): number | null {
  const cls = releaseClassFor(instrumentId, family);
  switch (cls) {
    case 'one-shot':
      return null;
    case 'damped-keys':
      // Salamander's own regions: damped range, then the two undamped bands.
      if (pitch >= 95) return 4.0;
      if (pitch >= 89) return 3.0;
      return 1.0;
    case 'plucked':
      // A finger leaving the string mutes it quickly; the body rings on.
      return instrumentId.includes('muted') ? 0.25 : 0.6;
    case 'sustained':
      // Long enough to be a note ending rather than a cut, short enough that it
      // still reads as "I stopped bowing".
      return 0.3;
    case 'envelope':
    default:
      return null;
  }
}

/** Tone's own default, kept so callers can restore it for synth voices. */
export const TONE_DEFAULT_RELEASE = 0.1;
