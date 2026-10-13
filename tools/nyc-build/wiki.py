"""Find Wikipedia articles for New York places, accepted only if the article's coordinates are within 400 m of the pin."""
import json, sys, time, math, urllib.request, urllib.parse, os, ssl
UA = "PinnedCities/1.0 (https://masonj52.github.io/pinned-cities/; one-time data build)"
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r: return json.loads(r.read().decode())
def km(a, b, c, d):
    r = math.pi / 180; x = math.sin((c - a) * r / 2); y = math.sin((d - b) * r / 2)
    return 2 * 6371 * math.asin(math.sqrt(x * x + math.cos(a * r) * math.cos(c * r) * y * y))
places = [p for p in json.load(open(sys.argv[1]))["places"] if p["city"] == "New York" and p.get("lat") is not None]
out = {}
for i, p in enumerate(places):
    try:
        # geosearch: articles near the pin, then match by name overlap
        g = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "list": "geosearch", "gscoord": f"{p['lat']}|{p['lng']}", "gsradius": 400, "gslimit": 50, "format": "json"}))
        cands = g.get("query", {}).get("geosearch", [])
        t = p["title"].lower().replace("the ", "")
        words = [w for w in "".join(c if c.isalnum() else " " for c in t).split() if len(w) > 2 and w not in ("new", "york", "nyc", "bar", "club", "cafe", "restaurant", "shop", "store")]
        best = None
        for c in cands:
            ct = c["title"].lower()
            if words and sum(w in ct for w in words) >= max(1, len(words) // 2 + (1 if len(words) > 2 else 0)):
                best = c; break
        if best:
            s = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(best["title"].replace(" ", "_")))
            out[p["id"]] = {"title": p["title"], "wiki": best["title"], "dist_m": best["dist"], "extract": s.get("extract", ""), "url": s.get("content_urls", {}).get("desktop", {}).get("page")}
        time.sleep(0.5)
    except Exception as e:
        out[p["id"]] = {"title": p["title"], "error": str(e)}; time.sleep(3)
    if i % 25 == 0: print(i, len([v for v in out.values() if v.get("wiki")]), flush=True)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print("done", len([v for v in out.values() if v.get("wiki")]), "matches", flush=True)
