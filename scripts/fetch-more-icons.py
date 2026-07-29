"""Add silhouettes for the newly vendored instruments (game-icons.net, CC BY 3.0)."""
import io
import re
import urllib.request

RAW = "https://raw.githubusercontent.com/game-icons/icons/master/"

NEW = {
    # keys & organs
    'organ-drawbar':   ('caro-asercion/pipe-organ.svg', 'Caro Asercion'),
    'organ-church':    ('caro-asercion/pipe-organ.svg', 'Caro Asercion'),
    'organ-reed':      ('caro-asercion/pipe-organ.svg', 'Caro Asercion'),
    'accordion':       ('caro-asercion/accordion.svg', 'Caro Asercion'),
    'harmonica':       ('caro-asercion/accordion.svg', 'Caro Asercion'),
    # strings
    'viola':           ('lorc/viola.svg', 'Lorc'),
    'strings-pizzicato': ('zajkonur/violin.svg', 'Zajkonur'),
    'strings-tremolo': ('zajkonur/violin.svg', 'Zajkonur'),
    'strings-ensemble': ('zajkonur/violin.svg', 'Zajkonur'),
    # winds
    'oboe':            ('caro-asercion/clarinet.svg', 'Caro Asercion'),
    'english-horn':    ('caro-asercion/clarinet.svg', 'Caro Asercion'),
    'piccolo':         ('delapouite/flute.svg', 'Delapouite'),
    'recorder':        ('delapouite/flute.svg', 'Delapouite'),
    'pan-flute':       ('delapouite/pan-flute.svg', 'Delapouite'),
    'shakuhachi':      ('delapouite/flute.svg', 'Delapouite'),
    'ocarina':         ('delapouite/ocarina.svg', 'Delapouite'),
    'bagpipe':         ('delapouite/bagpipes.svg', 'Delapouite'),
    'sax-soprano':     ('delapouite/saxophone.svg', 'Delapouite'),
    'sax-tenor':       ('delapouite/saxophone.svg', 'Delapouite'),
    'sax-baritone':    ('delapouite/saxophone.svg', 'Delapouite'),
    # brass
    'trumpet-muted':   ('delapouite/trumpet.svg', 'Delapouite'),
    'brass-section':   ('delapouite/trumpet.svg', 'Delapouite'),
    # world
    'banjo':           ('delapouite/banjo.svg', 'Delapouite'),
    'sitar':           ('delapouite/banjo.svg', 'Delapouite'),
    'shamisen':        ('delapouite/banjo.svg', 'Delapouite'),
    'koto':            ('delapouite/harp.svg', 'Delapouite'),
    'kalimba':         ('delapouite/xylophone.svg', 'Delapouite'),
    'steel-drums':     ('delapouite/gong.svg', 'Delapouite'),
    'taiko':           ('delapouite/drum.svg', 'Delapouite'),
    # voice
    'choir-aahs':      ('lorc/lyre.svg', 'Lorc'),
    'choir-oohs':      ('lorc/lyre.svg', 'Lorc'),
}

PATH_RE = re.compile(r'<path[^>]*\sd="([^"]+)"', re.I)
VIEWBOX_RE = re.compile(r'viewBox="([^"]+)"', re.I)


def fetch(path):
    req = urllib.request.Request(RAW + path, headers={"User-Agent": "musicvid-pro"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def main():
    cur = io.open('lib/midi/instrumentIcons.ts', encoding='utf-8').read()
    cache, added, authors = {}, [], {}
    for iid, (path, author) in NEW.items():
        if f"'{iid}':" in cur:
            continue
        if path not in cache:
            try:
                svg = fetch(path)
            except Exception as e:  # noqa: BLE001
                print(f"  skip {iid}: {e}")
                continue
            paths = PATH_RE.findall(svg)
            if not paths:
                print(f"  skip {iid}: no path")
                continue
            vb = VIEWBOX_RE.search(svg)
            cache[path] = (max(paths, key=len), vb.group(1) if vb else '0 0 512 512')
        d, vb = cache[path]
        added.append(f"  '{iid}': {{ viewBox: '{vb}', d: '{d}' }},")
        authors[path] = author
        print(f"  + {iid} <- {path}")

    if added:
        cur = cur.replace('};\n\nexport function iconFor', '\n'.join(added) + '\n};\n\nexport function iconFor')
        io.open('lib/midi/instrumentIcons.ts', 'w', encoding='utf-8').write(cur)

    att = io.open('public/icons/instruments/ATTRIBUTION.md', encoding='utf-8').read()
    for path, author in sorted(authors.items()):
        row = f'| `{path}` | {author} |'
        if row not in att:
            att = att.rstrip() + '\n' + row + '\n'
    io.open('public/icons/instruments/ATTRIBUTION.md', 'w', encoding='utf-8').write(att)
    print(f"added {len(added)} icons")


if __name__ == '__main__':
    main()
