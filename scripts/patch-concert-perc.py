import io

p = 'scripts/fetch-concert-perc.py'
s = io.open(p, encoding='utf-8').read()

# 1) Iowa paths contain spaces and ampersands; encode before requesting.
s = s.replace(
    'def get(url):\n    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 musicvid-pro"})',
    'def get(url):\n'
    '    # Iowa paths contain spaces and "&" ("gongs & tamtams"), which urllib\n'
    '    # rejects outright, so encode the path before asking for it.\n'
    '    parts = urllib.parse.urlsplit(url)\n'
    '    url = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path)))\n'
    '    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 musicvid-pro"})')

# 2) tambourines live on their own page
s = s.replace("""HAND = [
    ('tambourine',   'tambourine1', ['normal'], 2.0),
    ('tambourine-2', 'tambourine2', ['normal'], 2.0),
    ('tambourine-3', 'tambourine3', ['normal'], 2.0),
""", """TAMBOURINES = [
    ('tambourine',   'tambourine1', ['normal'], 2.0),
    ('tambourine-2', 'tambourine2', ['normal'], 2.0),
    ('tambourine-3', 'tambourine3', ['normal'], 2.0),
]

HAND = [
""")

# 3) crotales: Iowa ships pp and ff only, and spells accidentals as flats
s = s.replace("""        note, dyn = m.group(1), m.group(2).lower()
        if dyn != 'mf' or note in seen:
            continue""",
"""        note, dyn = m.group(1), m.group(2).lower()
        # Iowa recorded crotales at pp and ff only - there is no mf - and spells
        # accidentals as flats, while our sample maps use sharps.
        if dyn != 'ff' or note in seen:
            continue""")
s = s.replace(r"        m = re.match(r'crotale\.([A-G]#?\d)\.(pp|mf|ff)\.aiff?$', name, re.I)",
              r"        m = re.match(r'crotale\.([A-G][b#]?\d)\.(pp|mf|ff)\.aiff?$', name, re.I)")
s = s.replace("""        dest = os.path.join(OUT, 'crotales', note.replace('#', 's') + '.mp3')""",
"""        flat_to_sharp = {'Db': 'Cs', 'Eb': 'Ds', 'Gb': 'Fs', 'Ab': 'Gs', 'Bb': 'As'}
        stem = note[:-1]
        octv = note[-1]
        stem = flat_to_sharp.get(stem, stem.replace('#', 's'))
        dest = os.path.join(OUT, 'crotales', stem + octv + '.mp3')""")

# 4) VCSL Timpani filenames carry velocity and round-robin but NO pitch
#    (Timpani1_Hit_v4_rr2_Sum.wav), so it cannot be a chromatic instrument.
#    Take a few velocity layers as pad hits instead of inventing pitches.
old_timp_start = s.index('def build_timpani():')
old_timp_end = s.index('def main():')
s = s[:old_timp_start] + '''def build_timpani():
    """
    VCSL Timpani 1 is sampled by VELOCITY and round-robin, not by pitch:
    Timpani1_Hit_v4_rr2_Sum.wav. There is no note information in the library, so
    a chromatic timpani cannot honestly be built from it. Take three velocity
    layers as pad hits instead, and leave pitched timpani unclaimed.
    """
    import json
    req = urllib.request.Request(
        'https://api.github.com/repos/sgossner/VCSL/git/trees/master?recursive=1',
        headers={'User-Agent': 'musicvid-pro'})
    tree = json.load(urllib.request.urlopen(req, timeout=240))['tree']
    files = sorted(x['path'] for x in tree
                   if x['path'].startswith('Membranophones/Struck Membranophones/Timpani 1/Hit/')
                   and x['path'].lower().endswith('.wav'))
    if not files:
        print('  timpani: none found')
        return
    picks = {}
    for p in files:
        m = re.search(r'_v(\\d+)_', p)
        if m:
            picks.setdefault(int(m.group(1)), p)
    chosen = [picks[k] for k in sorted(picks)][:6]
    names = ['timpani-soft', 'timpani-mid', 'timpani-hard']
    got, total = 0, 0
    for name, src in zip(names, chosen[::max(1, len(chosen) // 3)]):
        dest = os.path.join(OUT, 'perc-timpani', name + '.mp3')
        if os.path.exists(dest):
            got += 1
            continue
        try:
            total += convert(VCSL + urllib.parse.quote(src), dest, 4.0)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f'    !! {name}: {e}')
    print(f'  perc-timpani: {got} hits, {total // 1024}KB')


''' + s[old_timp_end:]

s = s.replace("""    build_iowa('MIShandpercussion.html', 'perc-hand-iowa', HAND)""",
"""    build_iowa('MIStambourines.html', 'perc-hand-iowa', TAMBOURINES)
    build_iowa('MIShandpercussion.html', 'perc-hand-iowa', HAND)""")

io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
