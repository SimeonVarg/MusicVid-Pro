"""
Attach the original instruments to the groups their new variants created.

The first attempt matched on a fixed field ORDER (id/label/kind/family) and the
original entries are written id/label/family/kind, so the edit silently did
nothing and Salamander piano ended up as a separate card next to a "Piano" group
holding only the three GM pianos. Match on the id line instead, which does not
care about field order.
"""
import io
import re

TARGETS = {
    'piano':            ("'Piano'", 'piano', 'Concert grand'),
    'saxophone':        ("'Saxophone'", 'sax', 'Alto'),
    'trumpet':          ("'Trumpet'", 'trumpet', 'Open'),
    'guitar-acoustic':  ("'Acoustic Guitar'", 'guitar-ac', 'Steel string'),
    'bass-electric':    ("'Bass'", 'bass', 'Electric, fingered'),
}

p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

for iid, (label, group, variant) in TARGETS.items():
    m = re.search(r"(\{\s*\n\s*id: '" + re.escape(iid) + r"',\n)(.*?)(\n  \},)", s, re.S)
    if not m:
        print(f"  !! {iid} not found")
        continue
    body = m.group(2)
    if f"group: '{group}'" in body:
        print(f"  = {iid} already grouped")
        continue
    body = re.sub(r"label: '[^']*',", f"label: {label},", body, count=1)
    body = body.rstrip() + f"\n    group: '{group}',\n    variant: '{variant}',"
    s = s[:m.start(2)] + body + s[m.end(2):]
    print(f"  + {iid} -> group {group} / {variant}")

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
