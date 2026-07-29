import io
import re

# ── 1. every new instrument needs an art verdict ─────────────────────────────
inst = io.open('lib/midi/instruments.ts', encoding='utf-8').read()
all_ids = re.findall(r"^\s*id: '([a-z0-9-]+)',", inst, re.M)

art = io.open('lib/midi/instrumentArt.ts', encoding='utf-8').read()
classified = set(re.findall(r"'([a-z0-9-]+)':\s*\{ treatment", art))

missing = [i for i in all_ids if i not in classified]
if missing:
    rows = []
    for i in missing:
        rows.append(f"  '{i}':".ljust(24) + " { treatment: 'plate', reason: 'drawn silhouette - no flat playing surface to crop' },")
    art = art.replace("  'violin':", '\n'.join(rows) + "\n\n  'violin':", 1)
    io.open('lib/midi/instrumentArt.ts', 'w', encoding='utf-8').write(art)
print(f"classified {len(missing)} new instruments")

# ── 2. and a skin: accent + material, by family ──────────────────────────────
FAMILY_SKIN = {
    'keys':      ('#e8c579', 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)'),
    'organs':    ('#c9a86a', 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)'),
    'guitars':   ('#d99b57', 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)'),
    'strings':   ('#cf7361', 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)'),
    'woodwinds': ('#b9c6d6', 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)'),
    'brass':     ('#f0c94a', 'linear-gradient(150deg,#463714,#2b2109 55%,#181205)'),
    'voice':     ('#d9a3c4', 'linear-gradient(150deg,#2e1c28,#1c1018 55%,#100a0e)'),
    'world':     ('#8fb98a', 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)'),
    'mallets':   ('#c98b4b', 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)'),
}
TAGLINE = {
    'piano-bright': 'Bright acoustic grand', 'piano-electric-grand': 'Electric grand',
    'piano-honkytonk': 'Detuned honky-tonk upright', 'rhodes': 'Tine electric piano',
    'wurlitzer': 'Reed electric piano', 'harpsichord': 'Plucked harpsichord',
    'clavinet': 'Funk clavinet', 'celesta': 'Struck celesta',
    'organ-drawbar': 'Tonewheel drawbar organ', 'organ-church': 'Cathedral pipe organ',
    'organ-reed': 'Reed organ', 'accordion': 'Piano accordion', 'harmonica': 'Diatonic harmonica',
    'guitar-nylon': 'Nylon-string classical', 'guitar-steel': 'Steel-string acoustic',
    'guitar-electric-clean': 'Clean electric', 'guitar-electric-jazz': 'Hollow-body jazz',
    'guitar-electric-muted': 'Palm-muted electric', 'guitar-overdriven': 'Overdriven electric',
    'guitar-distortion': 'High-gain electric', 'bass-upright': 'Upright acoustic bass',
    'bass-pick': 'Picked electric bass', 'bass-fretless': 'Fretless electric bass',
    'bass-slap': 'Slap electric bass', 'viola': 'Solo viola, arco',
    'strings-ensemble': 'Sustained string section', 'strings-pizzicato': 'Plucked string section',
    'strings-tremolo': 'Tremolo string section', 'sax-soprano': 'Soprano saxophone',
    'sax-tenor': 'Tenor saxophone', 'sax-baritone': 'Baritone saxophone',
    'oboe': 'Orchestral oboe', 'english-horn': 'Cor anglais', 'piccolo': 'Piccolo flute',
    'recorder': 'Wooden recorder', 'pan-flute': 'Pan pipes', 'shakuhachi': 'Japanese shakuhachi',
    'ocarina': 'Ceramic ocarina', 'trumpet-muted': 'Muted trumpet',
    'brass-section': 'Full brass section', 'choir-aahs': 'Choir, aah', 'choir-oohs': 'Choir, ooh',
    'sitar': 'Indian sitar', 'banjo': 'Five-string banjo', 'koto': 'Japanese koto',
    'shamisen': 'Japanese shamisen', 'kalimba': 'Thumb piano', 'bagpipe': 'Highland bagpipes',
    'steel-drums': 'Caribbean steel pan', 'taiko': 'Japanese taiko',
}

fam_of = {}
for m in re.finditer(r"id: '([a-z0-9-]+)',\s*\n\s*label: '[^']*',\s*\n\s*kind: '[a-z]+',\s*\n\s*family: '([a-z-]+)'", inst):
    fam_of[m.group(1)] = m.group(2)

pick = io.open('components/editor/InstrumentPicker.tsx', encoding='utf-8').read()
have = set(re.findall(r"^\s*'([a-z0-9-]+)':\s*\{ accent", pick, re.M))
rows = []
for iid in all_ids:
    if iid in have:
        continue
    fam = fam_of.get(iid, 'keys')
    accent, panel = FAMILY_SKIN.get(fam, FAMILY_SKIN['keys'])
    tag = TAGLINE.get(iid, '')
    rows.append(f"  '{iid}':".ljust(26) + f" {{ accent: '{accent}', tagline: '{tag}', panel: '{panel}' }},")

if rows:
    pick = pick.replace("};\nconst skinFor =", '\n'.join(rows) + "\n};\nconst skinFor =", 1)
    io.open('components/editor/InstrumentPicker.tsx', 'w', encoding='utf-8').write(pick)
print(f"skinned {len(rows)} new instruments")
