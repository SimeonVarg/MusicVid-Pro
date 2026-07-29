"""Wire the 50 newly vendored GM instruments into the catalogue."""
import io
import os

SAMPLES = os.path.join('public', 'samples')

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']


def notes_for(folder):
    """Read the note names we actually downloaded, so the map can never lie."""
    d = os.path.join(SAMPLES, folder)
    if not os.path.isdir(d):
        return []
    out = []
    for f in sorted(os.listdir(d)):
        if f.endswith('.mp3'):
            out.append(f[:-4])
    return out


def midi_of(name):
    m = name.rstrip('-0123456789')
    octv = name[len(m):]
    try:
        return (int(octv) + 1) * 12 + SHARP.index(m)
    except ValueError:
        return None


def entry(iid, label, family, folder, group=None, variant=None):
    ns = notes_for(folder)
    if not ns:
        return None
    midis = [midi_of(n) for n in ns]
    midis = [m for m in midis if m is not None]
    lo, hi = min(midis), max(midis)
    names = ", ".join(f"'{n.replace('s', '#')}'" for n in ns)
    lines = [
        '  {',
        f"    id: '{iid}',",
        f"    label: '{label}',",
        "    kind: 'sampler',",
        f"    family: '{family}',",
    ]
    if group:
        lines.append(f"    group: '{group}',")
    if variant:
        lines.append(f"    variant: '{variant}',")
    lines += [
        f"    folder: '{folder}',",
        f"    sampleMap: namesToMap([{names}]),",
        f"    defaultRange: [{lo}, {hi}],",
        '  },',
    ]
    return '\n'.join(lines)


# id, label, family, folder, group, variant
NEW = [
    # Keyboards - pianos become one card with types, like GarageBand
    ('piano-bright', 'Piano', 'keys', 'piano-bright', 'piano', 'Bright grand'),
    ('piano-electric-grand', 'Piano', 'keys', 'piano-electric-grand', 'piano', 'Electric grand'),
    ('piano-honkytonk', 'Piano', 'keys', 'piano-honkytonk', 'piano', 'Honky-tonk'),
    ('rhodes', 'Electric Piano', 'keys', 'rhodes', 'ep', 'Rhodes'),
    ('wurlitzer', 'Electric Piano', 'keys', 'wurlitzer', 'ep', 'Wurlitzer'),
    ('harpsichord', 'Harpsichord', 'keys', 'harpsichord', None, None),
    ('clavinet', 'Clavinet', 'keys', 'clavinet', None, None),
    ('celesta', 'Celesta', 'keys', 'celesta', None, None),
    # Organs
    ('organ-drawbar', 'Organ', 'organs', 'organ-drawbar', 'organ', 'Drawbar (Hammond)'),
    ('organ-church', 'Organ', 'organs', 'organ-church', 'organ', 'Church pipe'),
    ('organ-reed', 'Organ', 'organs', 'organ-reed', 'organ', 'Reed'),
    ('accordion', 'Accordion', 'organs', 'accordion', None, None),
    ('harmonica', 'Harmonica', 'organs', 'harmonica', None, None),
    # Guitars
    ('guitar-nylon', 'Acoustic Guitar', 'guitars', 'guitar-nylon', 'guitar-ac', 'Nylon string'),
    ('guitar-steel', 'Acoustic Guitar', 'guitars', 'guitar-steel', 'guitar-ac', 'Steel string (GM)'),
    ('guitar-electric-clean', 'Electric Guitar', 'guitars', 'guitar-electric-clean', 'guitar-el', 'Clean'),
    ('guitar-electric-jazz', 'Electric Guitar', 'guitars', 'guitar-electric-jazz', 'guitar-el', 'Jazz'),
    ('guitar-electric-muted', 'Electric Guitar', 'guitars', 'guitar-electric-muted', 'guitar-el', 'Muted'),
    ('guitar-overdriven', 'Electric Guitar', 'guitars', 'guitar-overdriven', 'guitar-el', 'Overdriven'),
    ('guitar-distortion', 'Electric Guitar', 'guitars', 'guitar-distortion', 'guitar-el', 'Distortion'),
    ('bass-upright', 'Bass', 'guitars', 'bass-upright', 'bass', 'Upright'),
    ('bass-pick', 'Bass', 'guitars', 'bass-pick', 'bass', 'Electric, picked'),
    ('bass-fretless', 'Bass', 'guitars', 'bass-fretless', 'bass', 'Fretless'),
    ('bass-slap', 'Bass', 'guitars', 'bass-slap', 'bass', 'Slap'),
    # Strings
    ('viola', 'Viola', 'strings', 'viola', None, None),
    ('strings-ensemble', 'String Ensemble', 'strings', 'strings-ensemble', 'strsec', 'Sustained'),
    ('strings-pizzicato', 'String Ensemble', 'strings', 'strings-pizzicato', 'strsec', 'Pizzicato'),
    ('strings-tremolo', 'String Ensemble', 'strings', 'strings-tremolo', 'strsec', 'Tremolo'),
    # Woodwinds
    ('sax-soprano', 'Saxophone', 'woodwinds', 'sax-soprano', 'sax', 'Soprano'),
    ('sax-tenor', 'Saxophone', 'woodwinds', 'sax-tenor', 'sax', 'Tenor'),
    ('sax-baritone', 'Saxophone', 'woodwinds', 'sax-baritone', 'sax', 'Baritone'),
    ('oboe', 'Oboe', 'woodwinds', 'oboe', None, None),
    ('english-horn', 'English Horn', 'woodwinds', 'english-horn', None, None),
    ('piccolo', 'Piccolo', 'woodwinds', 'piccolo', None, None),
    ('recorder', 'Recorder', 'woodwinds', 'recorder', None, None),
    ('pan-flute', 'Pan Flute', 'woodwinds', 'pan-flute', None, None),
    ('shakuhachi', 'Shakuhachi', 'woodwinds', 'shakuhachi', None, None),
    ('ocarina', 'Ocarina', 'woodwinds', 'ocarina', None, None),
    # Brass
    ('trumpet-muted', 'Trumpet', 'brass', 'trumpet-muted', 'trumpet', 'Muted'),
    ('brass-section', 'Brass Section', 'brass', 'brass-section', None, None),
    # Voice
    ('choir-aahs', 'Choir', 'voice', 'choir-aahs', 'choir', 'Aahs'),
    ('choir-oohs', 'Choir', 'voice', 'choir-oohs', 'choir', 'Oohs'),
    # World
    ('sitar', 'Sitar', 'world', 'sitar', None, None),
    ('banjo', 'Banjo', 'world', 'banjo', None, None),
    ('koto', 'Koto', 'world', 'koto', None, None),
    ('shamisen', 'Shamisen', 'world', 'shamisen', None, None),
    ('kalimba', 'Kalimba', 'world', 'kalimba', None, None),
    ('bagpipe', 'Bagpipes', 'world', 'bagpipe', None, None),
    ('steel-drums', 'Steel Drums', 'world', 'steel-drums', None, None),
    ('taiko', 'Taiko Drum', 'world', 'taiko', None, None),
]


def main():
    p = 'lib/midi/instruments.ts'
    s = io.open(p, encoding='utf-8').read()

    # two new families
    s = s.replace(
        "  | 'mallets' | 'perc-aux' | 'perc-concert' | 'kits' | 'machines' | 'synths';",
        "  | 'mallets' | 'perc-aux' | 'perc-concert' | 'kits' | 'machines' | 'synths'\n  | 'organs' | 'voice' | 'world';")
    s = s.replace(
        "  synths: 'Synths',\n};",
        "  synths: 'Synths',\n  organs: 'Organs & Accordion',\n  voice: 'Voice',\n  world: 'World & Folk',\n};")
    s = s.replace(
        "  'mallets', 'perc-concert', 'perc-aux', 'kits', 'machines', 'synths',\n];",
        "  'mallets', 'perc-concert', 'perc-aux', 'kits', 'machines', 'synths',\n  'organs', 'voice', 'world',\n];")

    # the existing Salamander piano and alto sax join their new groups
    s = s.replace("""    id: 'piano',
    label: 'Grand Piano',
    kind: 'sampler',
    family: 'keys',""",
"""    id: 'piano',
    label: 'Piano',
    kind: 'sampler',
    family: 'keys',
    group: 'piano',
    variant: 'Concert grand',""")
    s = s.replace("""    id: 'saxophone',
    label: 'Saxophone',
    kind: 'sampler',
    family: 'woodwinds',""",
"""    id: 'saxophone',
    label: 'Saxophone',
    kind: 'sampler',
    family: 'woodwinds',
    group: 'sax',
    variant: 'Alto',""")
    s = s.replace("""    id: 'trumpet',
    label: 'Trumpet',
    kind: 'sampler',
    family: 'brass',""",
"""    id: 'trumpet',
    label: 'Trumpet',
    kind: 'sampler',
    family: 'brass',
    group: 'trumpet',
    variant: 'Open',""")
    s = s.replace("""    id: 'guitar-acoustic',
    label: 'Acoustic Guitar',
    kind: 'sampler',
    family: 'guitars',""",
"""    id: 'guitar-acoustic',
    label: 'Acoustic Guitar',
    kind: 'sampler',
    family: 'guitars',
    group: 'guitar-ac',
    variant: 'Steel string',""")
    s = s.replace("""    id: 'bass-electric',
    label: 'Electric Bass',
    kind: 'sampler',
    family: 'guitars',""",
"""    id: 'bass-electric',
    label: 'Bass',
    kind: 'sampler',
    family: 'guitars',
    group: 'bass',
    variant: 'Electric, fingered',""")

    blocks = []
    for args in NEW:
        e = entry(*args)
        if e:
            blocks.append(e)
        else:
            print(f"  !! no samples for {args[0]}, skipped")
    s = s.replace("  { id: 'synth-lead',", '\n'.join(blocks) + "\n  { id: 'synth-lead',")
    io.open(p, 'w', encoding='utf-8').write(s)
    print(f"added {len(blocks)} instruments")


if __name__ == '__main__':
    main()
