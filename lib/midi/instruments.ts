/**
 * Instrument catalog for MIDI tracks.
 *
 * Sample-based instruments play REAL recordings vendored in /public/samples
 * (offline-proof, same doctrine as the vendored ffmpeg wasm):
 *  - piano: Salamander Grand Piano (CC-BY 3.0, Alexander Holm)
 *  - bass/guitar/violin/sax/xylophone: VSCO2 via tonejs-instruments (CC0/CC-BY)
 *  - drum kits: Tone.js example drum one-shots
 * See public/samples/ATTRIBUTION.md.
 *
 * Synth entries are explicitly labeled "Synth" — extras, never the default.
 */

export type InstrumentKind = 'sampler' | 'drums' | 'synth';

/**
 * Orchestral family. Drives the sections in the Instrument Studio, so adding an
 * instrument to a section is a data edit rather than a UI change.
 */
export type InstrumentFamily =
  | 'keys' | 'guitars' | 'strings' | 'woodwinds' | 'brass'
  | 'mallets' | 'perc-aux' | 'perc-concert' | 'kits' | 'machines' | 'synths';

export const FAMILY_LABEL: Record<InstrumentFamily, string> = {
  keys: 'Keyboards',
  guitars: 'Guitars & Bass',
  strings: 'Strings',
  woodwinds: 'Woodwinds',
  brass: 'Brass',
  mallets: 'Mallet Percussion',
  'perc-aux': 'Auxiliary Percussion',
  'perc-concert': 'Concert Percussion',
  kits: 'Drum Kits',
  machines: 'Rhythm Machines',
  synths: 'Synths',
};

/** Section order in the studio. */
export const FAMILY_ORDER: InstrumentFamily[] = [
  'keys', 'guitars', 'strings', 'woodwinds', 'brass',
  'mallets', 'perc-concert', 'perc-aux', 'kits', 'machines', 'synths',
];

export interface InstrumentDef {
  id: string;
  label: string;
  kind: InstrumentKind;
  family: InstrumentFamily;
  /** Folder under /samples for sampler/drums kinds */
  folder?: string;
  /** Tone.Sampler urls map: note name -> file (sampler kind) */
  sampleMap?: Record<string, string>;
  /** MIDI pitch -> file (drums kind, GM-style mapping) */
  drumMap?: Record<number, string>;
  /** Suggested piano-roll default range [low, high] MIDI pitch */
  defaultRange: [number, number];
  /** Tone synth preset name (synth kind) */
  synthPreset?: 'lead' | 'bass' | 'pad';
}

function minorThirdMap(fromOctave: number, toOctave: number, topNote: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (let oct = fromOctave; oct <= toOctave; oct++) {
    map[`C${oct}`] = `C${oct}.mp3`;
    map[`D#${oct}`] = `Ds${oct}.mp3`;
    map[`F#${oct}`] = `Fs${oct}.mp3`;
    map[`A${oct}`] = `A${oct}.mp3`;
  }
  map[topNote] = `${topNote.replace('#', 's')}.mp3`;
  return map;
}

function namesToMap(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const n of names) map[n] = `${n.replace('#', 's')}.mp3`;
  return map;
}

/** GM-ish drum mapping onto kick/snare/hihat/tom1..3 one-shots. */
const GM_DRUM_MAP: Record<number, string> = {
  35: 'kick.mp3', 36: 'kick.mp3',
  37: 'snare.mp3', 38: 'snare.mp3', 39: 'snare.mp3', 40: 'snare.mp3',
  42: 'hihat.mp3', 44: 'hihat.mp3', 46: 'hihat.mp3',
  41: 'tom3.mp3', 43: 'tom3.mp3',
  45: 'tom2.mp3', 47: 'tom2.mp3',
  48: 'tom1.mp3', 50: 'tom1.mp3',
  49: 'hihat.mp3', 51: 'hihat.mp3', 57: 'hihat.mp3', // cymbals -> hat (v1)
};


/** Auxiliary percussion one-shots laid out across the pad range. */
const AUX_PERC_MAP: Record<number, string> = {
  36: 'conga_1.mp3', 38: 'conga_2.mp3', 40: 'conga_3.mp3', 41: 'conga_4.mp3',
  42: 'egg_shaker1.mp3', 44: 'egg_shaker2.mp3',
  45: 'cowbell1_big.mp3', 47: 'cowbell2_small.mp3',
  48: 'crash_cymbal1.mp3', 49: 'china_cymbal1.mp3',
  50: 'gong_1.mp3', 51: 'gong_shot1.mp3',
};

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'piano',
    label: 'Grand Piano',
    family: 'keys',
    kind: 'sampler',
    folder: 'piano',
    sampleMap: minorThirdMap(2, 6, 'C7'),
    defaultRange: [36, 96],
  },
  {
    id: 'bass-electric',
    label: 'Electric Bass',
    family: 'guitars',
    kind: 'sampler',
    folder: 'bass-electric',
    sampleMap: namesToMap(['A#1', 'A#2', 'A#3', 'A#4', 'C#1', 'C#2', 'C#3', 'C#4', 'E1', 'E2', 'E3', 'E4', 'G1', 'G2', 'G3', 'G4']),
    defaultRange: [24, 60],
  },
  {
    id: 'guitar-acoustic',
    label: 'Acoustic Guitar',
    family: 'guitars',
    kind: 'sampler',
    folder: 'guitar-acoustic',
    sampleMap: namesToMap(['D2', 'E2', 'F#2', 'G#2', 'A#2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5']),
    defaultRange: [36, 84],
  },
  {
    id: 'violin',
    label: 'Violin',
    family: 'strings',
    kind: 'sampler',
    folder: 'violin',
    sampleMap: namesToMap(['A3', 'A4', 'A5', 'A6', 'C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G4', 'G5', 'G6']),
    defaultRange: [55, 100],
  },
  {
    id: 'saxophone',
    label: 'Saxophone',
    family: 'woodwinds',
    kind: 'sampler',
    folder: 'saxophone',
    sampleMap: namesToMap(['C#3', 'D3', 'D#3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5', 'E5', 'F#5', 'G#5']),
    defaultRange: [46, 88],
  },
  {
    id: 'xylophone',
    label: 'Xylophone',
    family: 'perc-aux',
    kind: 'sampler',
    folder: 'xylophone',
    sampleMap: namesToMap(['C5', 'C6', 'C7', 'C8', 'G4', 'G5', 'G6', 'G7']),
    defaultRange: [65, 108],
  },
  {
    id: 'drums-acoustic',
    label: 'Drum Kit (Acoustic)',
    family: 'kits',
    kind: 'drums',
    folder: 'drums-acoustic',
    drumMap: GM_DRUM_MAP,
    defaultRange: [35, 51],
  },
  {
    id: 'drums-cr78',
    label: 'Drum Machine (CR-78)',
    family: 'machines',
    kind: 'drums',
    folder: 'drums-cr78',
    drumMap: GM_DRUM_MAP,
    defaultRange: [35, 51],
  },
  {
    id: 'cello',
    label: 'Cello',
    kind: 'sampler',
    family: 'strings',
    folder: 'cello',
    sampleMap: namesToMap(['C2', 'E2', 'G#2', 'C3', 'E3', 'G#3', 'C4', 'E4', 'G#4', 'C5']),
    defaultRange: [36, 76],
  },
  {
    id: 'contrabass',
    label: 'Contrabass',
    kind: 'sampler',
    family: 'strings',
    folder: 'contrabass',
    sampleMap: namesToMap(['A#1', 'C#3', 'E2', 'F#1', 'G1', 'G#2', 'B3']),
    defaultRange: [28, 60],
  },
  {
    id: 'harp',
    label: 'Harp',
    kind: 'sampler',
    family: 'strings',
    folder: 'harp',
    sampleMap: namesToMap(['B1', 'D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6', 'F6', 'A6']),
    defaultRange: [24, 96],
  },
  {
    id: 'flute',
    label: 'Flute',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'flute',
    sampleMap: namesToMap(['A4', 'A5', 'A6', 'C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6']),
    defaultRange: [60, 96],
  },
  {
    id: 'clarinet',
    label: 'Clarinet',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'clarinet',
    sampleMap: namesToMap(['A#3', 'A#4', 'A#5', 'D3', 'D4', 'D5', 'D6', 'F3', 'F4', 'F5', 'F#6']),
    defaultRange: [50, 90],
  },
  {
    id: 'bassoon',
    label: 'Bassoon',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'bassoon',
    sampleMap: namesToMap(['A2', 'A3', 'A4', 'C3', 'C4', 'C5', 'E4', 'G2', 'G3', 'G4']),
    defaultRange: [34, 72],
  },
  {
    id: 'trumpet',
    label: 'Trumpet',
    kind: 'sampler',
    family: 'brass',
    folder: 'trumpet',
    sampleMap: namesToMap(['A3', 'A5', 'A#4', 'C4', 'C6', 'D5', 'D#4', 'F3', 'F4', 'F5', 'G4']),
    defaultRange: [52, 84],
  },
  {
    id: 'trombone',
    label: 'Trombone',
    kind: 'sampler',
    family: 'brass',
    folder: 'trombone',
    sampleMap: namesToMap(['A#1', 'A#2', 'A#3', 'C3', 'C4', 'C#2', 'C#4', 'D3', 'D4', 'D#2', 'D#3', 'D#4', 'F2', 'F3', 'F4', 'G#2', 'G#3']),
    defaultRange: [34, 72],
  },
  {
    id: 'french-horn',
    label: 'French Horn',
    kind: 'sampler',
    family: 'brass',
    folder: 'french-horn',
    sampleMap: namesToMap(['A1', 'A3', 'C2', 'C4', 'D3', 'D5', 'D#2', 'F3', 'F5', 'G2']),
    defaultRange: [34, 77],
  },
  {
    id: 'tuba',
    label: 'Tuba',
    kind: 'sampler',
    family: 'brass',
    folder: 'tuba',
    sampleMap: namesToMap(['A#1', 'A#2', 'A#3', 'D3', 'D4', 'D#2', 'F1', 'F2', 'F3']),
    defaultRange: [28, 65],
  },
  {
    id: 'perc-aux',
    label: 'Auxiliary Percussion',
    kind: 'drums',
    family: 'perc-aux',
    folder: 'perc-aux',
    drumMap: AUX_PERC_MAP,
    defaultRange: [36, 51],
  },
  { id: 'synth-lead', label: 'Synth Lead', kind: 'synth', family: 'synths', synthPreset: 'lead', defaultRange: [48, 96] },
  { id: 'synth-bass', label: 'Synth Bass', kind: 'synth', family: 'synths', synthPreset: 'bass', defaultRange: [24, 60] },
  { id: 'synth-pad', label: 'Synth Pad', kind: 'synth', family: 'synths', synthPreset: 'pad', defaultRange: [36, 84] },
];

export const DEFAULT_INSTRUMENT_ID = 'piano';

export function getInstrument(id: string): InstrumentDef {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}

/** Readable name for a one-shot file, shared by lane labels and pad labels. */
const HIT_NAMES: Record<string, string> = {
  'kick.mp3': 'Kick', 'snare.mp3': 'Snare', 'hihat.mp3': 'Hi-Hat',
  'tom1.mp3': 'Tom Hi', 'tom2.mp3': 'Tom Mid', 'tom3.mp3': 'Tom Low',
  'conga_1.mp3': 'Conga Hi', 'conga_2.mp3': 'Conga Mid', 'conga_3.mp3': 'Conga Lo', 'conga_4.mp3': 'Conga Slap',
  'egg_shaker1.mp3': 'Shaker', 'egg_shaker2.mp3': 'Shaker 2',
  'cowbell1_big.mp3': 'Cowbell', 'cowbell2_small.mp3': 'Cowbell Hi',
  'crash_cymbal1.mp3': 'Crash', 'china_cymbal1.mp3': 'China',
  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',
};

/** Human label for the drum lane at a MIDI pitch (drum kind only). */
export function drumLaneLabel(pitch: number): string | null {
  const file = GM_DRUM_MAP[pitch];
  if (!file) return null;
  return HIT_NAMES[file] ?? null;
}

/** Pads for a drum instrument, derived from its own map so each kit differs. */
export function drumPads(instrumentId: string): { label: string; pitch: number }[] {
  const def = getInstrument(instrumentId);
  if (def.kind !== 'drums' || !def.drumMap) return [];
  const seen = new Set<string>();
  const pads: { label: string; pitch: number }[] = [];
  for (const [pitchStr, file] of Object.entries(def.drumMap)) {
    if (seen.has(file)) continue;
    seen.add(file);
    pads.push({ label: HIT_NAMES[file] ?? file.replace(/\.mp3$/, ''), pitch: Number(pitchStr) });
  }
  return pads.sort((a, b) => a.pitch - b.pitch);
}
