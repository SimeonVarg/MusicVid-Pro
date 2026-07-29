"""
Audit every vendored pitched instrument: does each file sound the pitch its
filename claims?

Uses a harmonic product spectrum, which is specifically designed not to be
fooled by a strong 2nd harmonic - the failure mode that made a first, cruder
pass report "octave high" on struck percussion. Reports the MEDIAN offset per
instrument, because a systematic naming-convention error shows up as every note
being off by the same amount, while a detector slip shows up as scatter.
"""
import math
import os
import subprocess
import sys

import numpy as np

SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
SR = 22050


def midi_of_filename(stem):
    name = stem.rstrip('-0123456789')
    octv = stem[len(name):]
    if name not in SHARP or not octv:
        return None
    return (int(octv) + 1) * 12 + SHARP.index(name)


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def hps_pitch(x):
    """Harmonic product spectrum -> fundamental in Hz, or None."""
    if x.size < SR // 4:
        return None
    # analyse after the attack, where the tone has settled
    start = int(SR * 0.08)
    seg = x[start:start + SR // 2]
    if seg.size < 2048:
        seg = x[: SR // 2]
    if seg.size < 2048:
        return None
    seg = seg * np.hanning(seg.size)
    n = 1 << 16
    spec = np.abs(np.fft.rfft(seg, n))
    # downsample-multiply: harmonics reinforce the true fundamental
    hps = spec.copy()
    for h in (2, 3, 4, 5):
        dec = spec[::h]
        hps[: dec.size] *= dec
    freqs = np.fft.rfftfreq(n, 1 / SR)
    lo = np.searchsorted(freqs, 55)     # A1
    hi = np.searchsorted(freqs, 3000)
    if hi <= lo:
        return None
    idx = lo + int(np.argmax(hps[lo:hi]))
    return float(freqs[idx])


def midi_of_hz(f):
    return 69 + 12 * math.log2(f / 440.0)


def audit(folder):
    d = os.path.join('public', 'samples', folder)
    if not os.path.isdir(d):
        return None
    offsets = []
    for f in sorted(os.listdir(d)):
        if not f.endswith('.mp3'):
            continue
        claimed = midi_of_filename(f[:-4])
        if claimed is None:
            continue
        try:
            hz = hps_pitch(decode(os.path.join(d, f)))
        except Exception:  # noqa: BLE001
            continue
        if not hz or hz <= 0:
            continue
        offsets.append(midi_of_hz(hz) - claimed)
    if not offsets:
        return None
    a = np.array(offsets)
    return {
        'n': len(a),
        'median': float(np.median(a)),
        'mad': float(np.median(np.abs(a - np.median(a)))),
    }


def main():
    folders = sys.argv[1:] or [
        # VCSL-sourced, the ones the claim is about
        'marimba', 'vibraphone', 'glockenspiel', 'tubular-bells',
        # known-good controls from other sources
        'piano', 'flute', 'trumpet', 'cello', 'rhodes',
    ]
    print(f'{"instrument":18} {"n":>3}  {"median offset":>13}  {"spread":>6}  verdict')
    for folder in folders:
        r = audit(folder)
        if not r:
            print(f'{folder:18}   -   (no measurable notes)')
            continue
        med, mad = r['median'], r['mad']
        if abs(med) < 0.5:
            verdict = 'correct'
        elif abs(med + 12) < 1.0:
            verdict = 'ALL ONE OCTAVE LOW'
        elif abs(med - 12) < 1.0:
            verdict = 'ALL ONE OCTAVE HIGH'
        else:
            verdict = f'off by {med:+.1f}'
        flag = '' if mad < 1.5 else '   (scattered - detector unreliable here)'
        print(f'{folder:18} {r["n"]:>3}  {med:>+12.2f}  {mad:>6.2f}  {verdict}{flag}')


if __name__ == '__main__':
    main()
