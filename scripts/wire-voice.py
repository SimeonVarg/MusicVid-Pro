import io
import os

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']


def notes_in(folder):
    d = os.path.join('public', 'samples', folder)
    return sorted(f[:-4] for f in os.listdir(d) if f.endswith('.mp3')) if os.path.isdir(d) else []


def midi_of(stem):
    name = stem.rstrip('-0123456789')
    octv = stem[len(name):]
    return (int(octv) + 1) * 12 + SHARP.index(name) if name in SHARP and octv else None


def block(iid, label, family, folder, group=None, variant=None):
    ns = notes_in(folder)
    if not ns:
        return None
    ms = [midi_of(n) for n in ns if midi_of(n) is not None]
    names = ', '.join(f"'{n.replace('s', '#')}'" for n in ns)
    out = ['  {', f"    id: '{iid}',", f"    label: '{label}',", "    kind: 'sampler',",
           f"    family: '{family}',"]
    if group:
        out.append(f"    group: '{group}',")
    if variant:
        out.append(f"    variant: '{variant}',")
    out += [f"    folder: '{folder}',", f"    sampleMap: namesToMap([{names}]),",
            f"    defaultRange: [{min(ms)}, {max(ms)}],", '  },']
    return '\n'.join(out)


p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

adds = [
    block('choir-synth', 'Choir', 'voice', 'choir-synth', 'choir', 'Synth choir'),
    block('orchestra-hit', 'Orchestra Hit', 'voice', 'orchestra-hit'),
]
adds = [a for a in adds if a]
s = s.replace("  { id: 'synth-lead',", '\n'.join(adds) + "\n  { id: 'synth-lead',")
io.open(p, 'w', encoding='utf-8').write(s)
print(f'added {len(adds)} voice entries')

a = io.open('lib/midi/instrumentArt.ts', encoding='utf-8').read()
rows = [f"  '{i}':".ljust(24) + " { treatment: 'plate', reason: 'drawn silhouette - no flat playing surface to crop' },"
        for i in ['choir-synth', 'orchestra-hit'] if f"'{i}':" not in a]
if rows:
    a = a.replace("  'violin':", '\n'.join(rows) + "\n\n  'violin':", 1)
    io.open('lib/midi/instrumentArt.ts', 'w', encoding='utf-8').write(a)

pick = io.open('components/editor/InstrumentPicker.tsx', encoding='utf-8').read()
rows = []
for iid, tag in [('choir-synth', 'Synthetic choir pad'), ('orchestra-hit', 'Full orchestra stab')]:
    if f"'{iid}':" in pick:
        continue
    rows.append(f"  '{iid}':".ljust(24) +
                f" {{ accent: '#d9a3c4', tagline: '{tag}', panel: 'linear-gradient(150deg,#2e1c28,#1c1018 55%,#100a0e)' }},")
if rows:
    pick = pick.replace("};\nconst skinFor =", '\n'.join(rows) + "\n};\nconst skinFor =", 1)
    io.open('components/editor/InstrumentPicker.tsx', 'w', encoding='utf-8').write(pick)

icons = io.open('lib/midi/instrumentIcons.ts', encoding='utf-8').read()
if "'choir-synth'" not in icons and "'choir-aahs':" in icons:
    src = icons.split("'choir-aahs': ")[1].split('\n')[0].rstrip(',')
    add = f"  'choir-synth': {src},\n  'orchestra-hit': {src},\n"
    icons = icons.replace('};\n\nexport function iconFor', add + '};\n\nexport function iconFor')
    io.open('lib/midi/instrumentIcons.ts', 'w', encoding='utf-8').write(icons)
print('art, skins and icons wired')
