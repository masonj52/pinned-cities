"""Look up each New York place in OpenStreetMap (Nominatim), 1 request/second. Usage: python3 -I osm.py places.json out.json"""
import json, sys, time, math, re, urllib.request, urllib.parse, os, ssl
UA = "PinnedCities/1.0 (https://masonj52.github.io/pinned-cities/; one-time data build)"
ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt")
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read().decode())
def km(a, b, c, d):
    r = math.pi / 180; x = math.sin((c - a) * r / 2); y = math.sin((d - b) * r / 2)
    return 2 * 6371 * math.asin(math.sqrt(x * x + math.cos(a * r) * math.cos(c * r) * y * y))
places = [p for p in json.load(open(sys.argv[1]))["places"] if p["city"] == "New York"]
out = json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else {}
def variants(t):
    v = [t]
    for sep in [" | ", " - ", " – ", " (", ": ", ", "]:
        if sep in t: v.append(t.split(sep)[0].strip())
    v.append(re.sub(r"\b(nyc|new york|ny|brooklyn|soho|manhattan)\b", "", t, flags=re.I).strip(" -|,"))
    seen = []; [seen.append(x) for x in v if x and x not in seen]
    return seen
for i, p in enumerate(places):
    if p["id"] in out: continue
    rec = {"title": p["title"], "category": p["category"], "match": None}
    lat, lng = p.get("lat"), p.get("lng")
    try:
        if lat is not None:
            d = 0.008
            for q in variants(p["title"]):
                url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
                    "q": q, "format": "jsonv2", "addressdetails": 1, "extratags": 1, "namedetails": 1, "limit": 5,
                    "viewbox": f"{lng-d},{lat+d},{lng+d},{lat-d}", "bounded": 1})
                res = get(url); time.sleep(1.1)
                res = [r for r in res if km(lat, lng, float(r["lat"]), float(r["lon"])) < 0.6]
                if res:
                    res.sort(key=lambda r: km(lat, lng, float(r["lat"]), float(r["lon"])))
                    rec["match"] = res[0]; rec["query"] = q; break
            if not rec["match"]:
                rec["reverse"] = get("https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode({"lat": lat, "lon": lng, "format": "jsonv2", "addressdetails": 1, "zoom": 18}))
                time.sleep(1.1)
    except Exception as e:
        rec["error"] = str(e); time.sleep(5)
    out[p["id"]] = rec
    if i % 10 == 0:
        json.dump(out, open(sys.argv[2], "w")); print(i, len(out), flush=True)
json.dump(out, open(sys.argv[2], "w")); print("done", len(out), flush=True)
