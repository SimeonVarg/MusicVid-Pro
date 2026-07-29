"""
Measure the real fundamental of a vendored sample and compare it to the pitch
its FILENAME claims.

Reason this exists: a research pass claimed VCSL names notes with C3 = MIDI 60
while Tone.js uses C4 = MIDI 60, which would make every pitched VCSL instrument
we ship sound an octave low. That is a claim about audio, so it gets checked
against audio rather than against a README.

Pure stdlib: ffmpeg decodes to 8 kHz mono PCM, then autocorrelation finds the
period. Good to well under a semitone at these frequencies, which is all we need
to tell an octave error from a correct mapping.
"""
import array
import math
import os
import subprocess
import sys

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
SR = 8000


def midi_of_filename(stem):
    name = stem.rstrip('-0123456789')
    octv = stem[len(name):]
    if name not in SHARP or not octv:
        return None
    return (int(octv) + 1) * 12 + SHARP.index(name)


def hz_of_midi(m):
    return 440.0 * (2 ** ((m - 69) / 12))


def midi_of_hz(f):
    return 69 + 12 * math.log2(f / 440.0)


def fundamental(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
        capture_output=True, check=True).stdout
    pcm = array.array('h')
    pcm.frombytes(raw[: (len(raw) // 2) * 2])
    if len(pcm) < SR // 2:
        return None
    # skip the attack transient, analyse a 0.25 s window of steady tone
    start = int(SR * 0.12)
    win = pcm[start:start + SR // 4]
    if len(win) < 500:
        return None
    mean = sum(win) / len(win)
    x = [v - mean for v in win]
    # autocorrelation over plausible musical periods (60 Hz .. 2000 Hz)
    lo_lag, hi_lag = SR // 2000, SR // 60
    best_lag, best_val = 0, 0.0
    for lag in range(lo_lag, min(hi_lag, len(x) - 1)):
        s = 0.0
        for i in range(0, len(x) - lag, 3):   # stride for speed
            s += x[i] * x[i + lag]
        if s > best_val:
            best_val, best_lag = s, lag
    if not best_lag:
        return None
    return SR / best_lag


def main():
    folders = sys.argv[1:] or ['marimba', 'vibraphone', 'glockenspiel', 'tubular-bells', 'piano', 'flute']
    for folder in folders:
        d = os.path.join('public', 'samples', folder)
        if not os.path.isdir(d):
            print(f'{folder}: missing')
            continue
        files = sorted(f for f in os.listdir(d) if f.endswith('.mp3'))
        picks = files[len(files) // 2: len(files) // 2 + 3] or files[:3]
        print(f'\n{folder}:')
        for f in picks:
            stem = f[:-4]
            claimed = midi_of_filename(stem)
            if claimed is None:
                print(f'  {stem}: not a note name')
                continue
            try:
                hz = fundamental(os.path.join(d, f))
            except Exception as e:  # noqa: BLE001
                print(f'  {stem}: decode failed {e}')
                continue
            if not hz:
                print(f'  {stem}: no pitch found')
                continue
            measured = midi_of_hz(hz)
            delta = measured - claimed
            verdict = 'OK' if abs(delta) < 0.6 else (
                'OCTAVE LOW (file is one octave below its name)' if abs(delta + 12) < 0.9 else
                'OCTAVE HIGH' if abs(delta - 12) < 0.9 else f'off by {delta:+.1f} semitones')
            print(f'  {stem}: claims {hz_of_midi(claimed):7.1f} Hz, measures {hz:7.1f} Hz  -> {verdict}')


if __name__ == '__main__':
    main()
