"""
Fix the VCSL octave offset.

VCSL names notes with C3 = MIDI 60; Tone.js uses C4 = MIDI 60. The fetch script
copied VCSL's names straight through, so every pitched VCSL instrument is
mapped a full octave away from what it actually sounds. Measured, not assumed:
marimba reads +11.98 semitones against its filenames with a spread of 0.06,
while non-VCSL controls (piano, flute, trumpet, cello, rhodes) all read within
0.02 of correct.

Fix at the filename layer so the sample map stays the obvious thing it looks
like: a file called C4.mp3 contains a C4.
"""
import io
import os
import re

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
AFFECTED = ['marimba', 'vibraphone', 'glockenspiel', 'tubular-bells']


def parse(stem):
    name = stem.rstrip('-0123456789')
    octv = stem[len(name):]
    if name not in SHARP or not octv:
        return None
    return name, int(octv)


def main():
    moved_total = 0
    new_maps = {}
    for folder in AFFECTED:
        d = os.path.join('public', 'samples', folder)
        if not os.path.isdir(d):
            print(f'  {folder}: missing')
            continue
        files = [f for f in os.listdir(d) if f.endswith('.mp3')]
        plan = []
        for f in files:
            p = parse(f[:-4])
            if not p:
                continue
            name, octv = p
            plan.append((f, f'{name}{octv + 1}.mp3'))
        # rename via a temp name so C4->C5 cannot clobber an existing C5
        for src, dst in plan:
            os.rename(os.path.join(d, src), os.path.join(d, dst + '.tmp'))
        for _, dst in plan:
            os.rename(os.path.join(d, dst + '.tmp'), os.path.join(d, dst))
        moved_total += len(plan)
        notes = sorted(dst[:-4] for _, dst in plan)
        new_maps[folder] = notes
        print(f'  {folder}: {len(plan)} files shifted up one octave')

    # rewrite the sample maps and ranges to match
    p = 'lib/midi/instruments.ts'
    s = io.open(p, encoding='utf-8').read()
    for folder, notes in new_maps.items():
        midis = []
        for n in notes:
            nm, octv = parse(n)
            midis.append((octv + 1) * 12 + SHARP.index(nm))
        names = ', '.join(f"'{n.replace('s', '#')}'" for n in notes)
        block = re.search(r"(\{\s*\n\s*id: '" + re.escape(folder) + r"',[\s\S]*?\n  \},)", s)
        if not block:
            print(f'  !! no catalogue entry for {folder}')
            continue
        body = block.group(1)
        body2 = re.sub(r"sampleMap: namesToMap\(\[[^\]]*\]\),", f"sampleMap: namesToMap([{names}]),", body)
        body2 = re.sub(r"defaultRange: \[\d+, \d+\],", f"defaultRange: [{min(midis)}, {max(midis)}],", body2)
        s = s.replace(body, body2)
    io.open(p, 'w', encoding='utf-8').write(s)
    print(f'renamed {moved_total} files and rewrote {len(new_maps)} sample maps')


if __name__ == '__main__':
    main()
