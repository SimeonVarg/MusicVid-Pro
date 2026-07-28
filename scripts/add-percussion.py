import io

p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

maps = """
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
"""

s = s.replace("export const INSTRUMENTS: InstrumentDef[] = [", maps + "\nexport const INSTRUMENTS: InstrumentDef[] = [")

new = """  {
    id: 'marimba',
    label: 'Marimba',
    kind: 'sampler',
    family: 'mallets',
    folder: 'marimba',
    sampleMap: namesToMap(['F1', 'C2', 'G2', 'B2', 'F3', 'C4', 'G4', 'B4', 'F5', 'C6']),
    defaultRange: [36, 84],
  },
  {
    id: 'vibraphone',
    label: 'Vibraphone',
    kind: 'sampler',
    family: 'mallets',
    folder: 'vibraphone',
    sampleMap: namesToMap(['F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5']),
    defaultRange: [41, 89],
  },
  {
    id: 'glockenspiel',
    label: 'Glockenspiel',
    kind: 'sampler',
    family: 'mallets',
    folder: 'glockenspiel',
    sampleMap: namesToMap(['G4', 'C5', 'G5', 'C6', 'G6', 'G#6', 'C7']),
    defaultRange: [67, 108],
  },
  {
    id: 'tubular-bells',
    label: 'Tubular Bells',
    kind: 'sampler',
    family: 'mallets',
    folder: 'tubular-bells',
    sampleMap: namesToMap(['C3', 'D3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4']),
    defaultRange: [48, 77],
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
    label: 'Hand Percussion',
    kind: 'drums',
    family: 'perc-aux',
    folder: 'perc-aux2',
    drumMap: AUX2_PERC_MAP,
    defaultRange: [36, 51],
  },
"""

s = s.replace("  { id: 'synth-lead',", new + "  { id: 'synth-lead',")

# readable names for the new one-shots
s = s.replace("""  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',
};""",
"""  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',
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
};""")

io.open(p, 'w', encoding='utf-8').write(s)
print('percussion instruments added')

# art verdicts for the new instruments
p2 = 'lib/midi/instrumentArt.ts'
a = io.open(p2, encoding='utf-8').read()
a = a.replace("""  'violin':           { treatment: 'plate', reason:""",
"""  'marimba':          { treatment: 'surface', reason: 'bar ranks; graduated length' },
  'vibraphone':       { treatment: 'surface', reason: 'bar ranks; graduated length' },
  'glockenspiel':     { treatment: 'surface', reason: 'bar ranks; graduated length' },
  'tubular-bells':    { treatment: 'surface', reason: 'hanging tube rank; graduated length' },
  'perc-concert':     { treatment: 'surface', reason: 'head + lug ring; 2pi/8' },
  'perc-hand':        { treatment: 'surface', reason: 'frame drum head + jingles; 2pi/6' },

  'violin':           { treatment: 'plate', reason:""")
io.open(p2, 'w', encoding='utf-8').write(a)
print('art verdicts added')

# render the new surfaces
p3 = 'components/editor/InstrumentArt.tsx'
c = io.open(p3, encoding='utf-8').read()
c = c.replace("""      case 'xylophone': return <MalletBars />;""",
"""      case 'xylophone': return <MalletBars />;
      case 'marimba': return <MalletBars />;
      case 'vibraphone': return <MalletBars />;
      case 'glockenspiel': return <MalletBars />;
      case 'tubular-bells': return <MalletBars />;
      case 'perc-concert': return <DrumHead lugs={8} headTone="#f0e8d6" hoop="#9aa0a8" />;
      case 'perc-hand': return <DrumHead lugs={6} headTone="#e8d6b4" hoop="#7a5a34" />;""")
io.open(p3, 'w', encoding='utf-8').write(c)
print('art wired')
