"""
Vendor General MIDI instruments from FluidR3_GM, pre-rendered per note.

Source: gleitz/midi-js-soundfonts (gh-pages), the MIDI.js rendering of Frank
Wen's FluidR3_GM soundfont. Licence was verified by three independent checks in
the research workflow: the upstream soundfont is MIT and the repo labels it
CC-BY 3.0 - both permit redistribution inside a shipped app, and we credit Frank
Wen either way.

These are ALREADY small mono mp3s (~25KB/note, all 88 notes, flat spellings like
Bb3), so unlike VCSL there is nothing to transcode. We take a spread of notes
per instrument rather than all 88: Tone.Sampler interpolates between them, and
12 notes keeps an instrument near 300KB.
"""
import io
import os
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM"
OUT = os.path.join("public", "samples")

NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def note_name(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


def our_name(midi):
    """Our sampleMap convention: sharps written with s, e.g. As3."""
    sharp = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
    return f"{sharp[midi % 12]}{midi // 12 - 1}"


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "musicvid-pro"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if len(data) < 500:
        raise IOError(f"suspiciously small ({len(data)} bytes)")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def vendor(gm_folder, our_folder, lo, hi, step=4):
    """Take every `step` semitones from lo..hi inclusive."""
    got, total = 0, 0
    midis = list(range(lo, hi + 1, step))
    if midis[-1] != hi:
        midis.append(hi)
    for m in midis:
        dest = os.path.join(OUT, our_folder, our_name(m) + ".mp3")
        if os.path.exists(dest):
            got += 1
            continue
        url = f"{BASE}/{gm_folder}-mp3/{note_name(m)}.mp3"
        try:
            total += fetch(url, dest)
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f"    miss {gm_folder} {note_name(m)}: {e}", flush=True)
    print(f"  {our_folder}: {got}/{len(midis)} notes, {total // 1024}KB", flush=True)
    return got


# (gm folder, our folder, low midi, high midi)
JOBS = [
    # Keyboards
    ('bright_acoustic_piano', 'piano-bright', 28, 96),
    ('electric_grand_piano', 'piano-electric-grand', 28, 96),
    ('honkytonk_piano', 'piano-honkytonk', 28, 96),
    ('electric_piano_1', 'rhodes', 28, 96),
    ('electric_piano_2', 'wurlitzer', 28, 96),
    ('harpsichord', 'harpsichord', 29, 89),
    ('clavinet', 'clavinet', 28, 88),
    ('celesta', 'celesta', 60, 96),
    # Organs
    ('drawbar_organ', 'organ-drawbar', 36, 96),
    ('church_organ', 'organ-church', 36, 96),
    ('reed_organ', 'organ-reed', 36, 92),
    ('accordion', 'accordion', 41, 89),
    ('harmonica', 'harmonica', 48, 84),
    # Guitars
    ('acoustic_guitar_nylon', 'guitar-nylon', 40, 84),
    ('acoustic_guitar_steel', 'guitar-steel', 40, 84),
    ('electric_guitar_clean', 'guitar-electric-clean', 40, 88),
    ('electric_guitar_jazz', 'guitar-electric-jazz', 40, 88),
    ('electric_guitar_muted', 'guitar-electric-muted', 40, 88),
    ('overdriven_guitar', 'guitar-overdriven', 40, 88),
    ('distortion_guitar', 'guitar-distortion', 40, 88),
    # Bass
    ('acoustic_bass', 'bass-upright', 28, 67),
    ('electric_bass_pick', 'bass-pick', 28, 67),
    ('fretless_bass', 'bass-fretless', 28, 67),
    ('slap_bass_1', 'bass-slap', 28, 67),
    # Strings
    ('viola', 'viola', 48, 88),
    ('pizzicato_strings', 'strings-pizzicato', 36, 88),
    ('tremolo_strings', 'strings-tremolo', 36, 88),
    ('string_ensemble_1', 'strings-ensemble', 28, 96),
    # Brass
    ('muted_trumpet', 'trumpet-muted', 52, 84),
    ('brass_section', 'brass-section', 36, 84),
    # Reeds
    ('soprano_sax', 'sax-soprano', 56, 88),
    ('tenor_sax', 'sax-tenor', 44, 76),
    ('baritone_sax', 'sax-baritone', 36, 69),
    ('oboe', 'oboe', 58, 91),
    ('english_horn', 'english-horn', 52, 84),
    # Pipes
    ('piccolo', 'piccolo', 74, 103),
    ('recorder', 'recorder', 60, 96),
    ('pan_flute', 'pan-flute', 60, 96),
    ('shakuhachi', 'shakuhachi', 55, 91),
    ('ocarina', 'ocarina', 60, 91),
    # Voice
    ('choir_aahs', 'choir-aahs', 43, 91),
    ('voice_oohs', 'choir-oohs', 43, 91),
    ('synth_choir', 'choir-synth', 43, 91),
    ('orchestra_hit', 'orchestra-hit', 36, 84),
    # World
    ('sitar', 'sitar', 48, 84),
    ('banjo', 'banjo', 48, 84),
    ('koto', 'koto', 48, 84),
    ('shamisen', 'shamisen', 48, 84),
    ('kalimba', 'kalimba', 60, 91),
    ('bagpipe', 'bagpipe', 55, 84),
    ('steel_drums', 'steel-drums', 52, 84),
    ('taiko_drum', 'taiko', 36, 72),
]


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    n = 0
    for gm, ours, lo, hi in JOBS:
        if only and only not in ours:
            continue
        if vendor(gm, ours, lo, hi):
            n += 1
    print(f"DONE, {n} instruments vendored")


if __name__ == "__main__":
    main()
