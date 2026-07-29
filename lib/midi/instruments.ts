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
  | 'mallets' | 'perc-aux' | 'perc-concert' | 'kits' | 'machines' | 'synths'
  | 'organs' | 'voice' | 'world';

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
  organs: 'Organs & Accordion',
  voice: 'Voice',
  world: 'World & Folk',
};

/** Section order in the studio. */
export const FAMILY_ORDER: InstrumentFamily[] = [
  'keys', 'guitars', 'strings', 'woodwinds', 'brass',
  'mallets', 'perc-concert', 'perc-aux', 'kits', 'machines', 'synths',
  'organs', 'voice', 'world',
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
  /**
   * Instruments sharing a `group` collapse into ONE card in the studio, and
   * their `variant` labels become the choices inside it: pick Brass, then
   * Trumpet, then which trumpet. Adding a B-flat/E-flat/piccolo trumpet or a
   * muted one is then a data edit here, not a UI change.
   */
  group?: string;
  /** Name of this variant within its group, e.g. 'B-flat', 'Harmon mute'. */
  variant?: string;
}

/** The instruments in a group, in catalogue order. */
export function variantsOf(groupOrId: string): InstrumentDef[] {
  const byGroup = INSTRUMENTS.filter((i) => i.group === groupOrId);
  if (byGroup.length) return byGroup;
  const single = INSTRUMENTS.find((i) => i.id === groupOrId);
  return single ? [single] : [];
}

/** One entry per card: a group if the instrument has one, else the instrument. */
export function instrumentCards(family: InstrumentFamily): { key: string; label: string; lead: InstrumentDef; count: number }[] {
  const out: { key: string; label: string; lead: InstrumentDef; count: number }[] = [];
  const seen = new Set<string>();
  for (const inst of INSTRUMENTS) {
    if (inst.family !== family) continue;
    const key = inst.group ?? inst.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const members = variantsOf(key);
    out.push({ key, label: inst.group ? inst.label.replace(/\s*\(.*\)$/, '') : inst.label, lead: members[0], count: members.length });
  }
  return out;
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


/** Concert percussion one-shots, laid out low to high across the pads. */
const CONCERT_PERC_MAP = {
  36: 'bass-drum-1-1.mp3', 38: 'bass-drum-1-2.mp3',
  40: 'snare-drum-modern-1-1.mp3', 41: 'snare-drum-modern-1-2.mp3',
  43: 'clash-cymbals-1-1.mp3', 45: 'suspended-cymbal-1-1.mp3',
  47: 'suspended-cymbal-1-2.mp3', 48: 'gong-1-1.mp3',
  50: 'triangles-1.mp3', 51: 'triangles-2.mp3',
} as Record<number, string>;

/** Hand and small percussion. */
const AUX2_PERC_MAP = {
  36: 'tambourine-1-1.mp3', 38: 'tambourine-1-2.mp3',
  40: 'claves-1.mp3', 41: 'woodblock-1.mp3',
  43: 'woodblock-2.mp3', 45: 'cowbells-1.mp3',
  47: 'cowbells-2.mp3', 48: 'shaker-small-1.mp3',
  50: 'shaker-small-2.mp3', 51: 'cabasa-1.mp3',
} as Record<number, string>;

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'piano',
    label: 'Piano',
    family: 'keys',
    kind: 'sampler',
    folder: 'piano',
    sampleMap: minorThirdMap(2, 6, 'C7'),
    defaultRange: [36, 96],
    group: 'piano',
    variant: 'Concert grand',
  },
  {
    id: 'bass-electric',
    label: 'Bass',
    family: 'guitars',
    kind: 'sampler',
    folder: 'bass-electric',
    sampleMap: namesToMap(['A#1', 'A#2', 'A#3', 'A#4', 'C#1', 'C#2', 'C#3', 'C#4', 'E1', 'E2', 'E3', 'E4', 'G1', 'G2', 'G3', 'G4']),
    defaultRange: [24, 60],
    group: 'bass',
    variant: 'Electric, fingered',
  },
  {
    id: 'guitar-acoustic',
    label: 'Acoustic Guitar',
    family: 'guitars',
    kind: 'sampler',
    folder: 'guitar-acoustic',
    sampleMap: namesToMap(['D2', 'E2', 'F#2', 'G#2', 'A#2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5']),
    defaultRange: [36, 84],
    group: 'guitar-ac',
    variant: 'Steel string',
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
    group: 'sax',
    variant: 'Alto',
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
    group: 'trumpet',
    variant: 'Open',
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
    group: 'aux-perc',
    variant: 'Congas, shakers & cymbals',
    folder: 'perc-aux',
    drumMap: AUX_PERC_MAP,
    defaultRange: [36, 51],
  },
  {
    id: 'marimba',
    label: 'Marimba',
    kind: 'sampler',
    family: 'mallets',
    folder: 'marimba',
    sampleMap: namesToMap(['B3', 'B5', 'C3', 'C5', 'C7', 'F2', 'F4', 'F6', 'G3', 'G5']),
    defaultRange: [41, 96],
  },
  {
    id: 'vibraphone',
    label: 'Vibraphone',
    kind: 'sampler',
    family: 'mallets',
    folder: 'vibraphone',
    sampleMap: namesToMap(['A3', 'A5', 'B4', 'C4', 'C6', 'D5', 'E4', 'E6', 'F3', 'F5', 'G4']),
    defaultRange: [53, 88],
  },
  {
    id: 'glockenspiel',
    label: 'Glockenspiel',
    kind: 'sampler',
    family: 'mallets',
    folder: 'glockenspiel',
    sampleMap: namesToMap(['C6', 'C7', 'C8', 'G5', 'G6', 'G7', 'G#7']),
    defaultRange: [79, 108],
  },
  {
    id: 'tubular-bells',
    label: 'Tubular Bells',
    kind: 'sampler',
    family: 'mallets',
    folder: 'tubular-bells',
    sampleMap: namesToMap(['A#4', 'C4', 'C5', 'D4', 'D5', 'E4', 'E5', 'F#4', 'G#4']),
    defaultRange: [60, 76],
  },
  {
    id: 'perc-concert',
    label: 'Concert Percussion',
    kind: 'drums',
    family: 'perc-concert',
    folder: 'perc-concert',
    drumMap: CONCERT_PERC_MAP,
    defaultRange: [36, 51],
  },
  {
    id: 'perc-hand',
    label: 'Auxiliary Percussion',
    kind: 'drums',
    family: 'perc-aux',
    group: 'aux-perc',
    variant: 'Tambourine, claves & woodblock',
    folder: 'perc-aux2',
    drumMap: AUX2_PERC_MAP,
    defaultRange: [36, 51],
  },
  {
    id: 'piano-bright',
    label: 'Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'piano',
    variant: 'Bright grand',
    folder: 'piano-bright',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'piano-electric-grand',
    label: 'Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'piano',
    variant: 'Electric grand',
    folder: 'piano-electric-grand',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'piano-honkytonk',
    label: 'Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'piano',
    variant: 'Honky-tonk',
    folder: 'piano-honkytonk',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'rhodes',
    label: 'Electric Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'ep',
    variant: 'Rhodes',
    folder: 'rhodes',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'wurlitzer',
    label: 'Electric Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'ep',
    variant: 'Wurlitzer',
    folder: 'wurlitzer',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'harpsichord',
    label: 'Harpsichord',
    kind: 'sampler',
    family: 'keys',
    folder: 'harpsichord',
    sampleMap: namesToMap(['A1', 'A2', 'A3', 'A4', 'A5', 'C#2', 'C#3', 'C#4', 'C#5', 'C#6', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6']),
    defaultRange: [29, 89],
  },
  {
    id: 'clavinet',
    label: 'Clavinet',
    kind: 'sampler',
    family: 'keys',
    folder: 'clavinet',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [28, 88],
  },
  {
    id: 'celesta',
    label: 'Celesta',
    kind: 'sampler',
    family: 'keys',
    folder: 'celesta',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G#4', 'G#5', 'G#6']),
    defaultRange: [60, 96],
  },
  {
    id: 'organ-drawbar',
    label: 'Organ',
    kind: 'sampler',
    family: 'organs',
    group: 'organ',
    variant: 'Drawbar (Hammond)',
    folder: 'organ-drawbar',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [36, 96],
  },
  {
    id: 'organ-church',
    label: 'Organ',
    kind: 'sampler',
    family: 'organs',
    group: 'organ',
    variant: 'Church pipe',
    folder: 'organ-church',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [36, 96],
  },
  {
    id: 'organ-reed',
    label: 'Organ',
    kind: 'sampler',
    family: 'organs',
    group: 'organ',
    variant: 'Reed',
    folder: 'organ-reed',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [36, 92],
  },
  {
    id: 'accordion',
    label: 'Accordion',
    kind: 'sampler',
    family: 'organs',
    folder: 'accordion',
    sampleMap: namesToMap(['A2', 'A3', 'A4', 'A5', 'C#3', 'C#4', 'C#5', 'C#6', 'F2', 'F3', 'F4', 'F5', 'F6']),
    defaultRange: [41, 89],
  },
  {
    id: 'harmonica',
    label: 'Harmonica',
    kind: 'sampler',
    family: 'organs',
    folder: 'harmonica',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 84],
  },
  {
    id: 'guitar-nylon',
    label: 'Acoustic Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-ac',
    variant: 'Nylon string',
    folder: 'guitar-nylon',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 84],
  },
  {
    id: 'guitar-steel',
    label: 'Acoustic Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-ac',
    variant: 'Steel string (GM)',
    folder: 'guitar-steel',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 84],
  },
  {
    id: 'guitar-electric-clean',
    label: 'Electric Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-el',
    variant: 'Clean',
    folder: 'guitar-electric-clean',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 88],
  },
  {
    id: 'guitar-electric-jazz',
    label: 'Electric Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-el',
    variant: 'Jazz',
    folder: 'guitar-electric-jazz',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 88],
  },
  {
    id: 'guitar-electric-muted',
    label: 'Electric Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-el',
    variant: 'Muted',
    folder: 'guitar-electric-muted',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 88],
  },
  {
    id: 'guitar-overdriven',
    label: 'Electric Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-el',
    variant: 'Overdriven',
    folder: 'guitar-overdriven',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 88],
  },
  {
    id: 'guitar-distortion',
    label: 'Electric Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-el',
    variant: 'Distortion',
    folder: 'guitar-distortion',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [40, 88],
  },
  {
    id: 'bass-upright',
    label: 'Bass',
    kind: 'sampler',
    family: 'guitars',
    group: 'bass',
    variant: 'Upright',
    folder: 'bass-upright',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'E1', 'E2', 'E3', 'E4', 'G4', 'G#1', 'G#2', 'G#3']),
    defaultRange: [28, 67],
  },
  {
    id: 'bass-pick',
    label: 'Bass',
    kind: 'sampler',
    family: 'guitars',
    group: 'bass',
    variant: 'Electric, picked',
    folder: 'bass-pick',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'E1', 'E2', 'E3', 'E4', 'G4', 'G#1', 'G#2', 'G#3']),
    defaultRange: [28, 67],
  },
  {
    id: 'bass-fretless',
    label: 'Bass',
    kind: 'sampler',
    family: 'guitars',
    group: 'bass',
    variant: 'Fretless',
    folder: 'bass-fretless',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'E1', 'E2', 'E3', 'E4', 'G4', 'G#1', 'G#2', 'G#3']),
    defaultRange: [28, 67],
  },
  {
    id: 'bass-slap',
    label: 'Bass',
    kind: 'sampler',
    family: 'guitars',
    group: 'bass',
    variant: 'Slap',
    folder: 'bass-slap',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'E1', 'E2', 'E3', 'E4', 'G4', 'G#1', 'G#2', 'G#3']),
    defaultRange: [28, 67],
  },
  {
    id: 'viola',
    label: 'Viola',
    kind: 'sampler',
    family: 'strings',
    folder: 'viola',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'E6', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 88],
  },
  {
    id: 'strings-ensemble',
    label: 'String Ensemble',
    kind: 'sampler',
    family: 'strings',
    group: 'strsec',
    variant: 'Sustained',
    folder: 'strings-ensemble',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#1', 'G#2', 'G#3', 'G#4', 'G#5', 'G#6']),
    defaultRange: [28, 96],
  },
  {
    id: 'strings-pizzicato',
    label: 'String Ensemble',
    kind: 'sampler',
    family: 'strings',
    group: 'strsec',
    variant: 'Pizzicato',
    folder: 'strings-pizzicato',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [36, 88],
  },
  {
    id: 'strings-tremolo',
    label: 'String Ensemble',
    kind: 'sampler',
    family: 'strings',
    group: 'strsec',
    variant: 'Tremolo',
    folder: 'strings-tremolo',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'E6', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [36, 88],
  },
  {
    id: 'sax-soprano',
    label: 'Saxophone',
    kind: 'sampler',
    family: 'woodwinds',
    group: 'sax',
    variant: 'Soprano',
    folder: 'sax-soprano',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E4', 'E5', 'E6', 'G#3', 'G#4', 'G#5']),
    defaultRange: [56, 88],
  },
  {
    id: 'sax-tenor',
    label: 'Saxophone',
    kind: 'sampler',
    family: 'woodwinds',
    group: 'sax',
    variant: 'Tenor',
    folder: 'sax-tenor',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'E3', 'E4', 'E5', 'G#2', 'G#3', 'G#4']),
    defaultRange: [44, 76],
  },
  {
    id: 'sax-baritone',
    label: 'Saxophone',
    kind: 'sampler',
    family: 'woodwinds',
    group: 'sax',
    variant: 'Baritone',
    folder: 'sax-baritone',
    sampleMap: namesToMap(['A4', 'C2', 'C3', 'C4', 'E2', 'E3', 'E4', 'G#2', 'G#3', 'G#4']),
    defaultRange: [36, 69],
  },
  {
    id: 'oboe',
    label: 'Oboe',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'oboe',
    sampleMap: namesToMap(['A#3', 'A#4', 'A#5', 'D4', 'D5', 'D6', 'F#4', 'F#5', 'F#6', 'G6']),
    defaultRange: [58, 91],
  },
  {
    id: 'english-horn',
    label: 'English Horn',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'english-horn',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [52, 84],
  },
  {
    id: 'piccolo',
    label: 'Piccolo',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'piccolo',
    sampleMap: namesToMap(['A#5', 'A#6', 'D5', 'D6', 'D7', 'F#5', 'F#6', 'F#7', 'G7']),
    defaultRange: [74, 103],
  },
  {
    id: 'recorder',
    label: 'Recorder',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'recorder',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G#4', 'G#5', 'G#6']),
    defaultRange: [60, 96],
  },
  {
    id: 'pan-flute',
    label: 'Pan Flute',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'pan-flute',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G#4', 'G#5', 'G#6']),
    defaultRange: [60, 96],
  },
  {
    id: 'shakuhachi',
    label: 'Shakuhachi',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'shakuhachi',
    sampleMap: namesToMap(['B3', 'B4', 'B5', 'D#4', 'D#5', 'D#6', 'G3', 'G4', 'G5', 'G6']),
    defaultRange: [55, 91],
  },
  {
    id: 'ocarina',
    label: 'Ocarina',
    kind: 'sampler',
    family: 'woodwinds',
    folder: 'ocarina',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E4', 'E5', 'E6', 'G6', 'G#4', 'G#5']),
    defaultRange: [60, 91],
  },
  {
    id: 'trumpet-muted',
    label: 'Trumpet',
    kind: 'sampler',
    family: 'brass',
    group: 'trumpet',
    variant: 'Muted',
    folder: 'trumpet-muted',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [52, 84],
  },
  {
    id: 'brass-section',
    label: 'Brass Section',
    kind: 'sampler',
    family: 'brass',
    folder: 'brass-section',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'C6', 'E2', 'E3', 'E4', 'E5', 'G#2', 'G#3', 'G#4', 'G#5']),
    defaultRange: [36, 84],
  },
  {
    id: 'choir-aahs',
    label: 'Choir',
    kind: 'sampler',
    family: 'voice',
    group: 'choir',
    variant: 'Aahs',
    folder: 'choir-aahs',
    sampleMap: namesToMap(['B2', 'B3', 'B4', 'B5', 'D#3', 'D#4', 'D#5', 'D#6', 'G2', 'G3', 'G4', 'G5', 'G6']),
    defaultRange: [43, 91],
  },
  {
    id: 'choir-oohs',
    label: 'Choir',
    kind: 'sampler',
    family: 'voice',
    group: 'choir',
    variant: 'Oohs',
    folder: 'choir-oohs',
    sampleMap: namesToMap(['B2', 'B3', 'B4', 'B5', 'D#3', 'D#4', 'D#5', 'D#6', 'G2', 'G3', 'G4', 'G5', 'G6']),
    defaultRange: [43, 91],
  },
  {
    id: 'sitar',
    label: 'Sitar',
    kind: 'sampler',
    family: 'world',
    folder: 'sitar',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 84],
  },
  {
    id: 'banjo',
    label: 'Banjo',
    kind: 'sampler',
    family: 'world',
    folder: 'banjo',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 84],
  },
  {
    id: 'koto',
    label: 'Koto',
    kind: 'sampler',
    family: 'world',
    folder: 'koto',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 84],
  },
  {
    id: 'shamisen',
    label: 'Shamisen',
    kind: 'sampler',
    family: 'world',
    folder: 'shamisen',
    sampleMap: namesToMap(['C3', 'C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [48, 84],
  },
  {
    id: 'kalimba',
    label: 'Kalimba',
    kind: 'sampler',
    family: 'world',
    folder: 'kalimba',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E4', 'E5', 'E6', 'G6', 'G#4', 'G#5']),
    defaultRange: [60, 91],
  },
  {
    id: 'bagpipe',
    label: 'Bagpipes',
    kind: 'sampler',
    family: 'world',
    folder: 'bagpipe',
    sampleMap: namesToMap(['B3', 'B4', 'B5', 'C6', 'D#4', 'D#5', 'G3', 'G4', 'G5']),
    defaultRange: [55, 84],
  },
  {
    id: 'steel-drums',
    label: 'Steel Drums',
    kind: 'sampler',
    family: 'world',
    folder: 'steel-drums',
    sampleMap: namesToMap(['C4', 'C5', 'C6', 'E3', 'E4', 'E5', 'G#3', 'G#4', 'G#5']),
    defaultRange: [52, 84],
  },
  {
    id: 'taiko',
    label: 'Taiko Drum',
    kind: 'sampler',
    family: 'world',
    folder: 'taiko',
    sampleMap: namesToMap(['C2', 'C3', 'C4', 'C5', 'E2', 'E3', 'E4', 'G#2', 'G#3', 'G#4']),
    defaultRange: [36, 72],
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
  'bass-drum-1-1.mp3': 'Bass Drum', 'bass-drum-1-2.mp3': 'Bass Drum 2',
  'snare-drum-modern-1-1.mp3': 'Snare', 'snare-drum-modern-1-2.mp3': 'Snare 2',
  'clash-cymbals-1-1.mp3': 'Clash Cymbals',
  'suspended-cymbal-1-1.mp3': 'Susp. Cymbal', 'suspended-cymbal-1-2.mp3': 'Susp. Cymbal 2',
  'gong-1-1.mp3': 'Tam-tam',
  'triangles-1.mp3': 'Triangle', 'triangles-2.mp3': 'Triangle 2',
  'tambourine-1-1.mp3': 'Tambourine', 'tambourine-1-2.mp3': 'Tambourine 2',
  'claves-1.mp3': 'Claves', 'woodblock-1.mp3': 'Woodblock', 'woodblock-2.mp3': 'Woodblock 2',
  'cowbells-1.mp3': 'Cowbell', 'cowbells-2.mp3': 'Cowbell 2',
  'shaker-small-1.mp3': 'Shaker', 'shaker-small-2.mp3': 'Shaker 2', 'cabasa-1.mp3': 'Cabasa',
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
