import io
import re

p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

# A real General MIDI map, now that real cymbals exist. The old one sent crash,
# ride and splash to hihat.mp3 because there was nothing else in the folder.
drs_map = """
/**
 * DRSKit mapping. Unlike the old six-file kit, every GM slot here points at the
 * instrument it names: crash is a crash, ride is a ride, the ride bell is the
 * bell, and the hi-hat has closed / open / foot rather than one sample reused.
 */
const DRS_KIT_MAP: Record<number, string> = {
  35: 'kick.mp3', 36: 'kick.mp3',
  37: 'rimshot.mp3',
  38: 'snare.mp3', 40: 'snare.mp3',
  39: 'rimshot.mp3',
  41: 'tom3.mp3', 43: 'tom3.mp3',
  42: 'hihat.mp3',
  44: 'hihat-foot.mp3',
  45: 'tom2.mp3', 47: 'tom2.mp3',
  46: 'hihat-open.mp3',
  48: 'tom1.mp3', 50: 'tom1.mp3',
  49: 'crash.mp3', 57: 'crash2.mp3',
  51: 'ride.mp3', 59: 'ride.mp3',
  53: 'ride-bell.mp3',
};
"""

s = s.replace("\n/** Auxiliary percussion one-shots laid out across the pad range. */",
              drs_map + "\n/** Auxiliary percussion one-shots laid out across the pad range. */")

# readable pad labels for the new pieces
s = s.replace("""  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',""",
"""  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',
  'hihat-open.mp3': 'Hi-Hat Open', 'hihat-foot.mp3': 'Hi-Hat Foot',
  'rimshot.mp3': 'Rimshot', 'crash.mp3': 'Crash', 'crash2.mp3': 'Crash 2',
  'ride.mp3': 'Ride', 'ride-bell.mp3': 'Ride Bell',""")

# the two DRS kits become variants of one card
new_kits = """  {
    id: 'drums-drs-sticks',
    label: 'Acoustic Drum Kit',
    kind: 'drums',
    family: 'kits',
    group: 'kit-acoustic',
    variant: 'Sticks',
    folder: 'drums-drs-sticks',
    drumMap: DRS_KIT_MAP,
    defaultRange: [35, 59],
  },
  {
    id: 'drums-drs-brushes',
    label: 'Acoustic Drum Kit',
    kind: 'drums',
    family: 'kits',
    group: 'kit-acoustic',
    variant: 'Brushes',
    folder: 'drums-drs-brushes',
    drumMap: DRS_KIT_MAP,
    defaultRange: [35, 59],
  },
"""

# put them ahead of the old six-file kit, and demote that to a third variant
m = re.search(r"(\{\s*\n\s*id: 'drums-acoustic',[\s\S]*?\n  \},\n)", s)
if not m:
    raise SystemExit('drums-acoustic entry not found')
old = m.group(1)
old2 = old.replace("label: 'Drum Kit (Acoustic)',", "label: 'Acoustic Drum Kit',")
if "group: 'kit-acoustic'" not in old2:
    old2 = old2.replace("family: 'kits',", "family: 'kits',\n    group: 'kit-acoustic',\n    variant: 'Vintage (6-piece)',")
s = s.replace(old, new_kits + old2)

io.open(p, 'w', encoding='utf-8').write(s)
print('DRS kits wired as variants of one card')

# art + skins for the two new kits
a = io.open('lib/midi/instrumentArt.ts', encoding='utf-8').read()
if "'drums-drs-sticks'" not in a:
    a = a.replace("  'drums-acoustic':",
                  "  'drums-drs-sticks':  { treatment: 'surface', reason: 'head + lug ring; 2pi/10' },\n"
                  "  'drums-drs-brushes': { treatment: 'surface', reason: 'head + lug ring; 2pi/10' },\n"
                  "  'drums-acoustic':", 1)
    io.open('lib/midi/instrumentArt.ts', 'w', encoding='utf-8').write(a)

c = io.open('components/editor/InstrumentArt.tsx', encoding='utf-8').read()
if "'drums-drs-sticks'" not in c:
    c = c.replace("      case 'drums-acoustic': return <DrumHead lugs={10} />;",
                  "      case 'drums-acoustic': return <DrumHead lugs={10} />;\n"
                  "      case 'drums-drs-sticks': return <DrumHead lugs={10} />;\n"
                  "      case 'drums-drs-brushes': return <DrumHead lugs={10} headTone=\"#e9e2d0\" hoop=\"#8a8f96\" />;")
    io.open('components/editor/InstrumentArt.tsx', 'w', encoding='utf-8').write(c)

pick = io.open('components/editor/InstrumentPicker.tsx', encoding='utf-8').read()
if "'drums-drs-sticks'" not in pick:
    rows = (
        "  'drums-drs-sticks':  { accent: '#e5675f', tagline: 'Real kit, played with sticks', panel: 'linear-gradient(150deg,#27272c,#161619 60%,#0a0a0c)' },\n"
        "  'drums-drs-brushes': { accent: '#d8a07a', tagline: 'Real kit, played with brushes', panel: 'linear-gradient(150deg,#2a2420,#181413 60%,#0b0908)' },\n"
    )
    pick = pick.replace("};\nconst skinFor =", rows + "};\nconst skinFor =", 1)
    io.open('components/editor/InstrumentPicker.tsx', 'w', encoding='utf-8').write(pick)
print('art and skins added')
