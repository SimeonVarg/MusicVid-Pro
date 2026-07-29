import io
import os
import re

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']


def notes_in(folder):
    d = os.path.join('public', 'samples', folder)
    return sorted(f[:-4] for f in os.listdir(d) if f.endswith('.mp3')) if os.path.isdir(d) else []


def midi_of(stem):
    name = stem.rstrip('-0123456789')
    octv = stem[len(name):]
    return (int(octv) + 1) * 12 + SHARP.index(name) if name in SHARP and octv else None


p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

# ── pad maps for the new one-shot instruments ────────────────────────────────
maps = """
/** Orchestral cymbals: crashes, china, splash, ride and its bell. */
const CYMBAL_MAP: Record<number, string> = {
  36: 'crash-18.mp3', 38: 'crash-20.mp3', 40: 'orch-crash.mp3',
  41: 'china-19.mp3', 43: 'splash.mp3', 45: 'hihat.mp3',
  47: 'ride-21.mp3', 48: 'ride-bell.mp3',
};

/** Gongs and tam-tams, 20 to 40 inch. */
const GONG_MAP: Record<number, string> = {
  36: 'wind-gong.mp3', 38: 'tamtam-22.mp3',
  40: 'tamtam-28.mp3', 41: 'tamtam-40.mp3',
};

/** Tambourines, triangles, castanets, claves and woodblocks. */
const HAND_IOWA_MAP: Record<number, string> = {
  36: 'tambourine.mp3', 38: 'tambourine-2.mp3', 40: 'tambourine-3.mp3',
  41: 'triangle-6.mp3', 43: 'triangle-8.mp3',
  45: 'castanets.mp3', 47: 'claves.mp3',
  48: 'woodblock-7.mp3', 50: 'woodblock-10.mp3',
};

/**
 * Timpani, by velocity rather than by pitch: VCSL samples it as
 * Timpani1_Hit_v4_rr2, with no note information anywhere in the library, so a
 * chromatic timpani would be invented rather than recorded.
 */
const TIMPANI_MAP: Record<number, string> = {
  36: 'timpani-soft.mp3', 38: 'timpani-mid.mp3', 40: 'timpani-hard.mp3',
};
"""
s = s.replace("\n/** Auxiliary percussion one-shots laid out across the pad range. */",
              maps + "\n/** Auxiliary percussion one-shots laid out across the pad range. */")

# ── readable pad labels ──────────────────────────────────────────────────────
s = s.replace("  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',",
"""  'gong_1.mp3': 'Gong', 'gong_shot1.mp3': 'Gong Hit',
  'crash-18.mp3': 'Crash 18"', 'crash-20.mp3': 'Crash 20"', 'orch-crash.mp3': 'Orch. Crash',
  'china-19.mp3': 'China 19"', 'splash.mp3': 'Splash', 'ride-21.mp3': 'Ride 21"',
  'wind-gong.mp3': 'Wind Gong', 'tamtam-22.mp3': 'Tam-tam 22"',
  'tamtam-28.mp3': 'Tam-tam 28"', 'tamtam-40.mp3': 'Tam-tam 40"',
  'tambourine.mp3': 'Tambourine', 'tambourine-2.mp3': 'Tambourine 2',
  'tambourine-3.mp3': 'Tambourine 3', 'triangle-6.mp3': 'Triangle 6"',
  'triangle-8.mp3': 'Triangle 8"', 'castanets.mp3': 'Castanets',
  'claves.mp3': 'Claves', 'woodblock-7.mp3': 'Woodblock 7"',
  'woodblock-10.mp3': 'Woodblock 10"',
  'timpani-soft.mp3': 'Timpani soft', 'timpani-mid.mp3': 'Timpani mid',
  'timpani-hard.mp3': 'Timpani hard',""")

# ── the new instruments ──────────────────────────────────────────────────────
crot = notes_in('crotales')
crot_midis = [midi_of(n) for n in crot if midi_of(n) is not None]
crot_names = ', '.join(f"'{n.replace('s', '#')}'" for n in crot)

new = f"""  {{
    id: 'perc-cymbals',
    label: 'Orchestral Cymbals',
    kind: 'drums',
    family: 'perc-concert',
    folder: 'perc-cymbals',
    drumMap: CYMBAL_MAP,
    defaultRange: [36, 48],
  }},
  {{
    id: 'perc-gongs',
    label: 'Gongs & Tam-tams',
    kind: 'drums',
    family: 'perc-concert',
    folder: 'perc-gongs',
    drumMap: GONG_MAP,
    defaultRange: [36, 41],
  }},
  {{
    id: 'perc-hand-iowa',
    label: 'Tambourine & Hand Percussion',
    kind: 'drums',
    family: 'perc-concert',
    folder: 'perc-hand-iowa',
    drumMap: HAND_IOWA_MAP,
    defaultRange: [36, 50],
  }},
  {{
    id: 'perc-timpani',
    label: 'Timpani',
    kind: 'drums',
    family: 'perc-concert',
    folder: 'perc-timpani',
    drumMap: TIMPANI_MAP,
    defaultRange: [36, 40],
  }},
  {{
    id: 'crotales',
    label: 'Crotales',
    kind: 'sampler',
    family: 'perc-concert',
    folder: 'crotales',
    sampleMap: namesToMap([{crot_names}]),
    defaultRange: [{min(crot_midis)}, {max(crot_midis)}],
  }},
"""
s = s.replace("  { id: 'synth-lead',", new + "  { id: 'synth-lead',")
io.open(p, 'w', encoding='utf-8').write(s)
print(f'added 5 concert percussion instruments ({len(crot)} crotale notes)')

# ── art verdicts ─────────────────────────────────────────────────────────────
a = io.open('lib/midi/instrumentArt.ts', encoding='utf-8').read()
rows = []
for iid, kind in [('perc-cymbals', 'surface'), ('perc-gongs', 'surface'),
                  ('perc-hand-iowa', 'surface'), ('perc-timpani', 'surface'),
                  ('crotales', 'plate')]:
    if f"'{iid}':" in a:
        continue
    reason = ('head + lug ring; 2pi/8' if kind == 'surface'
              else 'drawn silhouette - no flat playing surface to crop')
    rows.append(f"  '{iid}':".ljust(24) + f" {{ treatment: '{kind}', reason: '{reason}' }},")
if rows:
    a = a.replace("  'violin':", '\n'.join(rows) + "\n\n  'violin':", 1)
    io.open('lib/midi/instrumentArt.ts', 'w', encoding='utf-8').write(a)

c = io.open('components/editor/InstrumentArt.tsx', encoding='utf-8').read()
if "'perc-cymbals'" not in c:
    c = c.replace("      case 'perc-concert': return <DrumHead lugs={8} headTone=\"#f0e8d6\" hoop=\"#9aa0a8\" />;",
"""      case 'perc-concert': return <DrumHead lugs={8} headTone="#f0e8d6" hoop="#9aa0a8" />;
      case 'perc-cymbals': return <DrumHead lugs={12} headTone="#e8d79a" hoop="#b8963c" />;
      case 'perc-gongs': return <DrumHead lugs={4} headTone="#d8bf7a" hoop="#8a6c1e" />;
      case 'perc-hand-iowa': return <DrumHead lugs={6} headTone="#e6d8bc" hoop="#8a7048" />;
      case 'perc-timpani': return <DrumHead lugs={8} headTone="#f2ead6" hoop="#7a5a34" />;""")
    io.open('components/editor/InstrumentArt.tsx', 'w', encoding='utf-8').write(c)

pick = io.open('components/editor/InstrumentPicker.tsx', encoding='utf-8').read()
skins = {
    'perc-cymbals': ('#d9b64a', 'Crashes, china, splash and ride'),
    'perc-gongs': ('#c9a24a', 'Wind gong and 22-40 inch tam-tams'),
    'perc-hand-iowa': ('#c99a6a', 'Tambourines, triangles, claves, blocks'),
    'perc-timpani': ('#c98b5a', 'Timpani, three dynamics'),
    'crotales': ('#e0cf7a', 'Tuned antique cymbals'),
}
rows = []
for iid, (accent, tag) in skins.items():
    if f"'{iid}':" in pick:
        continue
    rows.append(f"  '{iid}':".ljust(24) +
                f" {{ accent: '{accent}', tagline: '{tag}', panel: 'linear-gradient(150deg,#23201d,#141211 60%,#0a0908)' }},")
if rows:
    pick = pick.replace("};\nconst skinFor =", '\n'.join(rows) + "\n};\nconst skinFor =", 1)
    io.open('components/editor/InstrumentPicker.tsx', 'w', encoding='utf-8').write(pick)
print('art and skins wired')
