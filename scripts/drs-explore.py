import json
import urllib.request
from collections import defaultdict

REPO = "sfzinstruments/DrumGizmo.DRSKit"
url = f"https://api.github.com/repos/{REPO}/git/trees/master?recursive=1"
req = urllib.request.Request(url, headers={"User-Agent": "musicvid-pro"})
d = json.load(urllib.request.urlopen(req, timeout=180))
if "tree" not in d:
    print("API said:", str(d)[:200])
    raise SystemExit(1)

paths = [x["path"] for x in d["tree"] if x["type"] == "blob"]
print("blobs:", len(paths), "truncated:", d.get("truncated"))

audio = [p for p in paths if p.lower().endswith((".flac", ".wav"))]
print("audio files:", len(audio))

# group by piece folder
pieces = defaultdict(list)
for p in audio:
    parts = p.split("/")
    if "Samples" in parts:
        i = parts.index("Samples")
        if len(parts) > i + 1:
            pieces[parts[i + 1]].append(p)

print(f"\npieces: {len(pieces)}")
for name in sorted(pieces):
    files = pieces[name]
    # what mics exist for this piece
    mics = sorted({f.split("/")[-1].rsplit("-", 1)[-1].rsplit(".", 1)[0] for f in files})
    print(f"  {name:28} {len(files):4} files   mics: {', '.join(mics[:8])}")

print("\nsample filenames from one piece:")
k = sorted(pieces)[0]
for f in sorted(pieces[k])[:6]:
    print("   ", f.split("/")[-1])
