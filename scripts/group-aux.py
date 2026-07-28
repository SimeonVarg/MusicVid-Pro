import io

p = 'lib/midi/instruments.ts'
s = io.open(p, encoding='utf-8').read()

# The two auxiliary kits are the same instrument with different contents, so
# they become variants of one card: pick Aux Percussion, then which set.
s = s.replace("""    id: 'perc-aux',
    label: 'Auxiliary Percussion',
    kind: 'drums',
    family: 'perc-aux',""",
"""    id: 'perc-aux',
    label: 'Auxiliary Percussion',
    kind: 'drums',
    family: 'perc-aux',
    group: 'aux-perc',
    variant: 'Congas, shakers & cymbals',""")

s = s.replace("""    id: 'perc-hand',
    label: 'Hand Percussion',
    kind: 'drums',
    family: 'perc-aux',""",
"""    id: 'perc-hand',
    label: 'Auxiliary Percussion',
    kind: 'drums',
    family: 'perc-aux',
    group: 'aux-perc',
    variant: 'Tambourine, claves & woodblock',""")

io.open(p, 'w', encoding='utf-8').write(s)
print('aux kits grouped as variants')

# scope the "distinct bar" check to pitched instruments: every drum kit maps to
# the same pad range by design, so identical bars there are correct.
t = '__tests__/instrumentArt.test.ts'
a = io.open(t, encoding='utf-8').read()
a = a.replace("""    // and across the whole rack, no two instruments in a family draw an
    // identical bar
    const seen = new Map<string, string>();
    for (const inst of INSTRUMENTS) {""",
"""    // and across the whole rack, no two PITCHED instruments in a family draw an
    // identical bar. Drum kits are excluded on purpose: every kit maps onto the
    // same pad range, so identical bars there are correct, not a collision.
    const seen = new Map<string, string>();
    for (const inst of INSTRUMENTS.filter((i) => i.kind === 'sampler')) {""")
io.open(t, 'w', encoding='utf-8').write(a)
print('test scoped to pitched instruments')
