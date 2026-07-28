"""
Vendor CC0 percussion from the Versilian Community Sample Library.

VCSL (github.com/sgossner/VCSL) is CC0 1.0 - public domain - so unlike a
commercial pack its recordings may be redistributed inside this app. It ships
24-bit WAV, which is far too heavy for the browser, so each pick is transcoded
to a small mono MP3 with the local ffmpeg.

Filenames carry the note and the dynamic, e.g.
    Marimba_hit_Outrigger_B2_med_01.wav
    glock_medium_C5_01.wav
so we pull one file per note at a middle dynamic and name it <Note>.mp3, which
is the convention lib/midi/instruments.ts already expects.
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

API = "https://api.github.com/repos/sgossner/VCSL/contents/"
RAW = "https://raw.githubusercontent.com/sgossner/VCSL/master/"
OUT_ROOT = os.path.join("public", "samples")

# folder in VCSL -> (our sample folder, kind)
#   'pitched'  : one mp3 per note, becomes a Tone.Sampler
#   'oneshot'  : a handful of hits, becomes a drum-style instrument
JOBS = [
    ("Idiophones/Struck Idiophones/Marimba",              "marimba",     "pitched"),
    ("Idiophones/Struck Idiophones/Vibraphone",           "vibraphone",  "pitched"),
    ("Idiophones/Struck Idiophones/Glockenspiel",         "glockenspiel","pitched"),
    ("Idiophones/Struck Idiophones/Tubular Bells 1",      "tubular-bells","pitched"),
    ("Membranophones/Struck Membranophones/Timpani 1",    "timpani",     "pitched"),
    ("Membranophones/Struck Membranophones/Bass Drum 1",  "perc-concert","oneshot"),
    ("Membranophones/Struck Membranophones/Snare Drum, Modern 1", "perc-concert", "oneshot"),
    ("Idiophones/Struck Idiophones/Clash Cymbals 1",      "perc-concert","oneshot"),
    ("Idiophones/Struck Idiophones/Suspended Cymbal 1",   "perc-concert","oneshot"),
    ("Idiophones/Struck Idiophones/Triangles",            "perc-concert","oneshot"),
    ("Idiophones/Struck Idiophones/Gong 1",               "perc-concert","oneshot"),
    ("Idiophones/Struck Idiophones/Tambourine 1",         "perc-aux2",   "oneshot"),
    ("Idiophones/Struck Idiophones/Claves",               "perc-aux2",   "oneshot"),
    ("Idiophones/Struck Idiophones/Woodblock",            "perc-aux2",   "oneshot"),
    ("Idiophones/Struck Idiophones/Cowbells",             "perc-aux2",   "oneshot"),
    ("Idiophones/Struck Idiophones/Shaker, Small",        "perc-aux2",   "oneshot"),
    ("Idiophones/Struck Idiophones/Cabasa",               "perc-aux2",   "oneshot"),
]

NOTE_RE = re.compile(r"[_-]([A-G](?:#|b)?)(-?\d)[_-]", re.IGNORECASE)
# middle dynamics first, so a card is not represented by its loudest possible hit
DYN_ORDER = ["med", "medium", "mf", "mp", "soft", "quiet", "loud", "hard", "ff"]


def api(path):
    url = API + urllib.parse.quote(path)
    req = urllib.request.Request(url, headers={"User-Agent": "musicvid-pro-vendor"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def dyn_rank(name):
    low = name.lower()
    for i, d in enumerate(DYN_ORDER):
        if d in low:
            return i
    return len(DYN_ORDER)


def transcode(src_url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(src_url, headers={"User-Agent": "musicvid-pro-vendor"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    tmp = dest + ".wav"
    with open(tmp, "wb") as f:
        f.write(raw)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
         "-ac", "1", "-ar", "44100", "-b:a", "112k", dest],
        check=True,
    )
    os.remove(tmp)


def walk_files(path):
    """Return every .wav under path, descending one level into subfolders."""
    out = []
    for entry in api(path):
        if entry["type"] == "file" and entry["name"].lower().endswith(".wav"):
            out.append((entry["name"], entry["path"]))
        elif entry["type"] == "dir":
            for sub in api(entry["path"]):
                if sub["type"] == "file" and sub["name"].lower().endswith(".wav"):
                    out.append((sub["name"], sub["path"]))
    return out


def main():
    total = 0
    for src, folder, kind in JOBS:
        try:
            files = walk_files(src)
        except Exception as e:  # noqa: BLE001 - report and continue to next instrument
            print(f"SKIP {src}: {e}", flush=True)
            continue

        picks = {}
        if kind == "pitched":
            for name, path in files:
                m = NOTE_RE.search(name)
                if not m:
                    continue
                note = m.group(1).replace("b", "b").upper().replace("B#", "B#") + m.group(2)
                note = m.group(1).upper().replace("B", "B") + m.group(2)
                key = note
                if key not in picks or dyn_rank(name) < dyn_rank(picks[key][0]):
                    picks[key] = (name, path)
        else:
            # one-shots: take the few best-dynamic files, named after the source
            ranked = sorted(files, key=lambda f: (dyn_rank(f[0]), f[0]))[:3]
            base = os.path.basename(src).lower().replace(" ", "-").replace(",", "")
            for i, (name, path) in enumerate(ranked):
                picks[f"{base}-{i+1}"] = (name, path)

        for key, (name, path) in sorted(picks.items()):
            dest = os.path.join(OUT_ROOT, folder, f"{key.replace('#','s')}.mp3")
            if os.path.exists(dest):
                continue
            try:
                transcode(RAW + urllib.parse.quote(path), dest)
                total += 1
            except Exception as e:  # noqa: BLE001
                print(f"  fail {name}: {e}", flush=True)
        print(f"{src} -> {folder}: {len(picks)} picks", flush=True)

    print(f"DONE, {total} new files", flush=True)


if __name__ == "__main__":
    sys.exit(main())
