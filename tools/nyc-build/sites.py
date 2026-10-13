"""Fetch each venue's own website (from OpenStreetMap) and keep its description meta tag."""
import json, re, html, time, urllib.request, ssl
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = "Mozilla/5.0 (compatible; PinnedCitiesBuild/1.0; +https://masonj52.github.io/pinned-cities/)"
def meta(h, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']' + prop + r'["\'][^>]+content=["\']([^"\']*)', h, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop, h, re.I)
    return html.unescape(m.group(1)).strip() if m else ""
osm = json.load(open("osm.json")); out = {}
for pid, r in osm.items():
    m = r.get("match") or {}
    w = (m.get("extratags") or {}).get("website") or (m.get("extratags") or {}).get("contact:website")
    if not w: continue
    if not w.startswith("http"): w = "https://" + w
    try:
        req = urllib.request.Request(w, headers={"User-Agent": UA, "Accept-Language": "en"})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            h = resp.read(400000).decode("utf-8", "ignore")
        out[pid] = {"website": w, "desc": meta(h, "og:description") or meta(h, "description"), "title": meta(h, "og:title")}
    except Exception as e:
        out[pid] = {"website": w, "error": str(e)[:80]}
    time.sleep(0.3)
json.dump(out, open("sites.json", "w"), ensure_ascii=False, indent=1)
print("done", len(out), sum(1 for v in out.values() if v.get("desc")))
