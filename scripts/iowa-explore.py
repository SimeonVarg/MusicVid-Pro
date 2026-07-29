import re
import urllib.parse
import urllib.request
from collections import defaultdict

BASE = "https://theremin.music.uiowa.edu/"
PAGES = [
    "MIScymbals.html", "MISgongtamtams.html", "MIStambourines.html",
    "MIShandpercussion.html", "MIScrotales.html", "MISbells.html",
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 musicvid-pro"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", "ignore")


for page in PAGES:
    try:
        html = get(BASE + page)
    except Exception as e:  # noqa: BLE001
        print(f"{page}: FAILED {e}")
        continue
    links = re.findall(r'href="([^"]+\.aiff?)"', html, re.I)
    groups = defaultdict(list)
    for l in links:
        name = urllib.parse.unquote(l.split('/')[-1])
        stem = re.split(r'[.]', name)[0]
        groups[stem].append(l)
    print(f"\n{page}: {len(links)} audio links, {len(groups)} instruments")
    for stem in sorted(groups)[:14]:
        print(f"   {stem:26} {len(groups[stem]):3} files   e.g. {urllib.parse.unquote(groups[stem][0].split('/')[-1])}")
