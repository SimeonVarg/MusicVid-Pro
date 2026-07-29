"""
Turn Concert Percussion from one card into five.

Sources:
  - University of Iowa Electronic Music Studios (MIS). Rights holder's own words:
    "these recordings have been freely available on this website and may be
    downloaded and used for any projects, without restrictions."
  - VCSL (CC0) for timpani, which Iowa does not have.

Iowa files are anechoic AIFF with enormous decays - a 40" tam-tam runs about a
minute and 18MB - so every hit is truncated with a fade. Without that, one gong
would outweigh every drum kit in the app.

Iowa naming: <instrument>.<articulation>.<dynamic>.aif, dynamics pp/mf/ff.
We take mf where present.
"""
import io
import os
import re
import subprocess
import urllib.parse
import urllib.request

IOWA = "https://theremin.music.uiowa.edu/"
VCSL = "https://raw.githubusercontent.com/sgossner/VCSL/master/"
OUT = os.path.join("public", "samples")


def get(url):
    # Iowa paths contain spaces and "&" ("gongs & tamtams"), which urllib
    # rejects outright, so encode the path before asking for it.
    parts = urllib.parse.urlsplit(url)
    url = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path)))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 musicvid-pro"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def page_links(page):
    html = get(IOWA + page).decode("utf-8", "ignore")
    return re.findall(r'href="([^"]+\.aiff?)"', html, re.I)


def convert(url, dest, seconds):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    raw = get(url)
    tmp = dest + ".src"
    with open(tmp, "wb") as f:
        f.write(raw)
    fade = max(0.2, seconds * 0.18)
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp,
         '-t', str(seconds),
         '-af', f'afade=t=out:st={max(0.05, seconds - fade):.2f}:d={fade:.2f}',
         '-ac', '1', '-ar', '44100', '-b:a', '128k', dest],
        check=True)
    os.remove(tmp)
    return os.path.getsize(dest)


def pick(links, stem, want_bits, dynamic='mf'):
    """First link whose filename starts with stem and carries the wanted bits."""
    for l in links:
        name = urllib.parse.unquote(l.split('/')[-1]).lower()
        if not name.startswith(stem.lower()):
            continue
        if dynamic and f'.{dynamic}.' not in name:
            continue
        if all(b.lower() in name for b in want_bits):
            return l
    return None


def build_iowa(page, folder, plan):
    links = page_links(page)
    total, got = 0, 0
    for out_name, stem, bits, secs in plan:
        dest = os.path.join(OUT, folder, out_name + '.mp3')
        if os.path.exists(dest):
            got += 1
            continue
        l = pick(links, stem, bits) or pick(links, stem, bits, dynamic='ff') or pick(links, stem, bits, dynamic=None)
        if not l:
            print(f'    !! no file for {out_name} ({stem} {bits})')
            continue
        url = urllib.parse.urljoin(IOWA, l)
        try:
            total += convert(url, dest, secs)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f'    !! {out_name}: {e}')
    print(f'  {folder}: {got}/{len(plan)} pieces, {total // 1024}KB')


# ── orchestral cymbals ───────────────────────────────────────────────────────
CYMBALS = [
    ('crash-18',     '18crash',     ['stick'],  4.0),
    ('crash-20',     '20crash',     ['stick'],  4.5),
    ('orch-crash',   '18orchcrash', [],         4.5),
    ('china-19',     '19chinese',   ['stick'],  3.5),
    ('splash',       'splash',      ['stick'],  2.5),
    ('ride-21',      '21ride',      ['stick'],  3.5),
    ('ride-bell',    '21ride',      ['bell'],   3.0),
    ('hihat',        'hihat',       [],         2.0),
]

GONGS = [
    ('tamtam-22',   '22tamtam',   [], 6.0),
    ('tamtam-28',   '28tamtam',   [], 7.0),
    ('tamtam-40',   '40tamtam',   [], 8.0),
    ('wind-gong',   '20windgong', [], 6.0),
]

TAMBOURINES = [
    ('tambourine',   'tambourine1', ['normal'], 2.0),
    ('tambourine-2', 'tambourine2', ['normal'], 2.0),
    ('tambourine-3', 'tambourine3', ['normal'], 2.0),
]

HAND = [
    ('triangle-6',   '6triangle',   [],         4.0),
    ('triangle-8',   '8triangle',   [],         4.5),
    ('castanets',    'castanet1',   [],         1.2),
    ('claves',       'clave1',      [],         1.5),
    ('woodblock-7',  '7wb',         [],         1.5),
    ('woodblock-10', '10wb',        [],         1.8),
]


def build_crotales():
    """Crotales are pitched: crotale.C6.pp.aif -> C6.mp3"""
    links = page_links('MIScrotales.html')
    got, total = 0, 0
    seen = set()
    for l in links:
        name = urllib.parse.unquote(l.split('/')[-1])
        m = re.match(r'crotale\.([A-G][b#]?\d)\.(pp|mf|ff)\.aiff?$', name, re.I)
        if not m:
            continue
        note, dyn = m.group(1), m.group(2).lower()
        # Iowa recorded crotales at pp and ff only - there is no mf - and spells
        # accidentals as flats, while our sample maps use sharps.
        if dyn != 'ff' or note in seen:
            continue
        seen.add(note)
        flat_to_sharp = {'Db': 'Cs', 'Eb': 'Ds', 'Gb': 'Fs', 'Ab': 'Gs', 'Bb': 'As'}
        stem = note[:-1]
        octv = note[-1]
        stem = flat_to_sharp.get(stem, stem.replace('#', 's'))
        dest = os.path.join(OUT, 'crotales', stem + octv + '.mp3')
        if os.path.exists(dest):
            got += 1
            continue
        try:
            total += convert(urllib.parse.urljoin(IOWA, l), dest, 3.5)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f'    !! crotale {note}: {e}')
    print(f'  crotales: {got} notes, {total // 1024}KB')


def build_timpani():
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
        m = re.search(r'_v(\d+)_', p)
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
            total += convert(VCSL + src, dest, 4.0)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f'    !! {name}: {e}')
    print(f'  perc-timpani: {got} hits, {total // 1024}KB')


def main():
    build_iowa('MIScymbals.html', 'perc-cymbals', CYMBALS)
    build_iowa('MISgongtamtams.html', 'perc-gongs', GONGS)
    build_iowa('MIStambourines.html', 'perc-hand-iowa', TAMBOURINES)
    build_iowa('MIShandpercussion.html', 'perc-hand-iowa', HAND)
    build_crotales()
    build_timpani()


if __name__ == '__main__':
    main()
