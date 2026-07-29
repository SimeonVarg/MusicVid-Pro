/**
 * Instrument card art: the rule that decides what a card shows, plus the
 * geometry helpers the art is built from.
 *
 * WHY THIS EXISTS. Four attempts at instrument pictures were rejected. The two
 * cards that were praised are the guitar and bass fretboards, and the reason is
 * not merely that their coordinates are computed - the drum head and the mallet
 * bars were computed too and were called "a cacoon" and "trash". The missing
 * clause is that a fretboard is the SURFACE THE PLAYER'S HANDS LIVE ON, seen
 * flat and up close, with two ranks of elements crossing at right angles. That
 * reads instantly without being a picture of an object.
 *
 * So a card earns a macro crop only if all four clauses hold:
 *   FLAT       a head-on crop of it has no perspective and no closed outline
 *   TOUCH      it is the surface hands, sticks or mallets contact
 *   REPEATING  a rank of >=6 elements crossing the frame, plus a second rank
 *              crossing it (one rank alone is a barcode - that is exactly why
 *              a 4-string bowed neck failed)
 *   DERIVED    every position comes from a formula or measured constant
 *
 * An instrument that fails gets a MATERIAL PLATE instead: its own material, and
 * a band of true data measured from the samples we actually ship. A truthful
 * measurement beats a wrong picture, and a wrong picture is what "badly drawn
 * SVG ai graphics" means.
 */

export type ArtTreatment = 'surface' | 'plate';

export interface SurfaceVerdict {
  treatment: ArtTreatment;
  /** Why, in the language of the four clauses. Shown in dev, not in the UI. */
  reason: string;
}

export const SURFACE_TABLE: Record<string, SurfaceVerdict> = {
  'piano':            { treatment: 'surface', reason: 'keybed; semitone boundaries' },
  'guitar-acoustic':  { treatment: 'surface', reason: 'fretboard; 1-2^(-n/12)' },
  'bass-electric':    { treatment: 'surface', reason: 'fretboard; 1-2^(-n/12)' },
  'harp':             { treatment: 'surface', reason: 'string plane; diatonic colour code' },
  'drums-acoustic':   { treatment: 'surface', reason: 'head + lug ring; 2pi/10' },
  'perc-aux':         { treatment: 'surface', reason: 'conga head + lug ring; 2pi/6' },
  'drums-cr78':       { treatment: 'surface', reason: 'machine front panel; bar / 8' },
  'synth-lead':       { treatment: 'surface', reason: 'synth front panel; preset params' },
  'synth-bass':       { treatment: 'surface', reason: 'synth front panel; preset params' },
  'synth-pad':        { treatment: 'surface', reason: 'synth front panel; preset params' },

  'perc-concert':     { treatment: 'surface', reason: 'head + lug ring; 2pi/8' },
  'perc-hand':        { treatment: 'surface', reason: 'frame drum head + jingles; 2pi/6' },

  'xylophone':        { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'marimba':          { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'vibraphone':       { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'glockenspiel':     { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'tubular-bells':    { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },

  'violin':           { treatment: 'plate', reason: 'fails REPEATING - 4 strings, no crossing rank' },
  'cello':            { treatment: 'plate', reason: 'fails REPEATING - 4 strings, no crossing rank' },
  'contrabass':       { treatment: 'plate', reason: 'fails REPEATING - 4 strings, no crossing rank' },
  'saxophone':        { treatment: 'plate', reason: 'fails DERIVED - key touchpieces are ergonomic, not formulaic' },
  'flute':            { treatment: 'plate', reason: 'fails DERIVED - key touchpieces are ergonomic, not formulaic' },
  'clarinet':         { treatment: 'plate', reason: 'fails DERIVED - key touchpieces are ergonomic, not formulaic' },
  'bassoon':          { treatment: 'plate', reason: 'fails DERIVED - key touchpieces are ergonomic, not formulaic' },
  'trumpet':          { treatment: 'plate', reason: 'fails FLAT - identity is a coiled 3D body' },
  'trombone':         { treatment: 'plate', reason: 'fails FLAT - identity is a coiled 3D body' },
  'french-horn':      { treatment: 'plate', reason: 'fails FLAT - identity is a coiled 3D body' },
  'tuba':             { treatment: 'plate', reason: 'fails FLAT - identity is a coiled 3D body' },
};

export function treatmentFor(id: string): SurfaceVerdict {
  return SURFACE_TABLE[id] ?? { treatment: 'plate', reason: 'unclassified' };
}

// ── Pitch helpers ────────────────────────────────────────────────────────────
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A#1" | "Fs2" | "C4" -> MIDI number. Returns null when unparseable. */
export function parseNoteName(name: string): number | null {
  const m = /^([A-Ga-g])([#sb]?)(-?\d+)$/.exec(name.trim());
  if (!m) return null;
  const base = PC[m[1].toUpperCase()];
  if (base === undefined) return null;
  const accidental = m[2] === '#' || m[2] === 's' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + accidental;
}

/** The band's pitch domain: the piano's 88 keys, A0..C8. */
export const BAND_LO = 21;
export const BAND_HI = 108;

/** Position of a MIDI pitch across the band, 0..100. */
export function bandU(pitch: number): number {
  const t = (pitch - BAND_LO) / (BAND_HI - BAND_LO);
  return Math.max(0, Math.min(100, t * 100));
}

export interface RecordedRange {
  /** MIDI pitches we actually hold recordings for, ascending. */
  samples: number[];
  lo: number;
  hi: number;
  /** True when these are real recordings rather than a generated voice. */
  recorded: boolean;
}

/**
 * The instrument's REAL recorded compass, measured from the sample map we ship.
 * Synths have no samples, so they report their playable range as generated.
 */
export function recordedRange(def: {
  sampleMap?: Record<string, string>;
  drumMap?: Record<number, string>;
  defaultRange: [number, number];
  kind: string;
}): RecordedRange {
  const pitches: number[] = [];
  if (def.sampleMap) {
    for (const key of Object.keys(def.sampleMap)) {
      const p = parseNoteName(key);
      if (p !== null) pitches.push(p);
    }
  } else if (def.drumMap) {
    for (const key of Object.keys(def.drumMap)) pitches.push(Number(key));
  }
  pitches.sort((a, b) => a - b);
  if (pitches.length === 0) {
    return { samples: [], lo: def.defaultRange[0], hi: def.defaultRange[1], recorded: false };
  }
  return { samples: pitches, lo: pitches[0], hi: pitches[pitches.length - 1], recorded: def.kind !== 'synth' };
}

// ── Geometry used by the surface crops ───────────────────────────────────────

/** Fret stops as fractions of scale length: 1 - 2^(-n/12), normalised. */
export function fretStops(count: number): number[] {
  const raw = Array.from({ length: count + 1 }, (_, n) => 1 - 1 / Math.pow(2, n / 12));
  const span = raw[count];
  return raw.map((r) => r / span);
}

/** Lug angles around a drum hoop, evenly divided and phase-shifted. */
export function lugAngles(count: number, phaseDeg = -90): number[] {
  return Array.from({ length: count }, (_, i) => phaseDeg + (i * 360) / count);
}

/**
 * Mallet bar geometry. Both ranks must slope the SAME way: bars shorten as
 * pitch rises. The previous version anchored naturals to the bottom and
 * accidentals to the top, so the two ranks visibly diverged - reported as
 * "xylophone accidentals sloped opposite way". Returning an explicit centre
 * line for both ranks makes that failure impossible.
 */
export function barLengths(count: number, from = 96, to = 62): number[] {
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / Math.max(1, count - 1));
}
