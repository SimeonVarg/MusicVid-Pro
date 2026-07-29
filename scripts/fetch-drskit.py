"""
Vendor a real acoustic drum kit: DrumGizmo DRSKit, sticks AND brushes.

Why: public/samples/drums-acoustic was six mp3s, and the GM map pointed crash,
ride and splash all at hihat.mp3 - the code even said `// cymbals -> hat (v1)`.
So the Drum Kits section had no cymbals at all, and both "kits" were the same
six files.

Licence: CC-BY 4.0, confirmed at the rights holder (drumgizmo.org, DRSKit page)
and in the port's verbatim LICENSE, not just a badge.

Layout: DrumGizmo/DRSKit/Samples/<Piece>/<take>-<Piece>-<Mic>.flac, take index
ascending with velocity.

Three traps this script handles, all called out by the research and confirmed
against the tree:
  - There are NO snare/tom/crash close mics. Available mics are AmbL, AmbR,
    Hihat, Kdrum_back, Kdrum_front, OHL, OHR, Ride. Overheads are the honest
    pick for anything without its own mic.
  - "_whisker" pieces are the BRUSH performance.
  - The brush set has no kick and no hi-hat foot, so those are borrowed from
    the stick set rather than left silent.
"""
import io
import json
import os
import subprocess
import urllib.parse
import urllib.request

REPO = "sfzinstruments/DrumGizmo.DRSKit"
RAW = f"https://raw.githubusercontent.com/{REPO}/master/"
OUT = os.path.join("public", "samples")

# piece -> (mic, our file name, seconds to keep)
STICKS = {
    'Kdrum_with_contact':  ('Kdrum_front', 'kick',        1.6),
    'Snare':               ('OHL',         'snare',       1.6),
    'Snare_rim':           ('OHL',         'rimshot',     1.6),
    'Hihat_closed':        ('Hihat',       'hihat',       1.2),
    'Hihat_open':          ('Hihat',       'hihat-open',  2.5),
    'Hihat_foot':          ('Hihat',       'hihat-foot',  1.2),
    'Ride_tip':            ('Ride',        'ride',        3.0),
    'Ride_shank_bell':     ('Ride',        'ride-bell',   3.0),
    'Crash_left_tip':      ('OHL',         'crash',       3.5),
    'Crash_right_tip':     ('OHR',         'crash2',      3.5),
    'Tom1':                ('OHL',         'tom1',        2.0),
    'Tom2':                ('OHL',         'tom2',        2.0),
    'Tom3':                ('OHR',         'tom3',        2.2),
}

BRUSHES = {
    'Kdrum_with_contact':   ('Kdrum_front', 'kick',       1.6),   # borrowed: no brush kick
    'Snare_whisker':        ('OHL',         'snare',      1.6),
    'Snare_circle_whisker': ('OHL',         'rimshot',    2.0),   # circular sweep
    'Hihat_closed_whisker': ('Hihat',       'hihat',      1.2),
    'Hihat_open_whisker':   ('Hihat',       'hihat-open', 2.5),
    'Hihat_foot':           ('Hihat',       'hihat-foot', 1.2),   # borrowed
    'Ride_whisker':         ('Ride',        'ride',       3.0),
    'Ride_shank_bell':      ('Ride',        'ride-bell',  3.0),   # borrowed
    'Crash_left_whisker':   ('OHL',         'crash',      3.5),
    'Crash_right_whisker':  ('OHR',         'crash2',     3.5),
    'Tom1_whisker':         ('OHL',         'tom1',       2.0),
    'Tom2_whisker':         ('OHL',         'tom2',       2.0),
    'Tom3_whisker':         ('OHR',         'tom3',       2.2),
}


def tree():
    url = f"https://api.github.com/repos/{REPO}/git/trees/master?recursive=1"
    req = urllib.request.Request(url, headers={"User-Agent": "musicvid-pro"})
    d = json.load(urllib.request.urlopen(req, timeout=240))
    return [x["path"] for x in d["tree"] if x["type"] == "blob"]


def pick_take(paths, piece, mic):
    """A firm but not maximum hit: 70% up the velocity ladder."""
    cands = []
    for p in paths:
        parts = p.split('/')
        if len(parts) < 2 or parts[-2] != piece:
            continue
        f = parts[-1]
        if not f.endswith(f'-{mic}.flac'):
            continue
        try:
            cands.append((int(f.split('-')[0]), p))
        except ValueError:
            continue
    if not cands:
        return None
    cands.sort()
    return cands[int(len(cands) * 0.7)][1]


def convert(src_path, dest, seconds):
    req = urllib.request.Request(RAW + urllib.parse.quote(src_path), headers={"User-Agent": "musicvid-pro"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    tmp = dest + ".flac"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(tmp, "wb") as f:
        f.write(raw)
    fade = max(0.15, seconds * 0.12)
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp,
         '-t', str(seconds),
         '-af', f'afade=t=out:st={max(0.05, seconds - fade):.2f}:d={fade:.2f},dynaudnorm=p=0.6',
         '-ac', '1', '-ar', '44100', '-b:a', '128k', dest],
        check=True)
    os.remove(tmp)
    return os.path.getsize(dest)


def build(paths, plan, folder):
    total = 0
    got = 0
    for piece, (mic, name, secs) in plan.items():
        dest = os.path.join(OUT, folder, f'{name}.mp3')
        if os.path.exists(dest):
            got += 1
            continue
        src = pick_take(paths, piece, mic)
        if not src:
            print(f'    !! no take for {piece} / {mic}')
            continue
        try:
            total += convert(src, dest, secs)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f'    !! {piece}: {e}')
    print(f'  {folder}: {got}/{len(plan)} pieces, {total // 1024}KB')


def main():
    print('reading tree...')
    paths = tree()
    print(f'  {len(paths)} blobs')
    build(paths, STICKS, 'drums-drs-sticks')
    build(paths, BRUSHES, 'drums-drs-brushes')


if __name__ == '__main__':
    main()
