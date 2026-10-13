"""Find accurate positions for New York places whose decoded pin is unreliable: OSM name search across NYC, then addresses quoted in review pages."""
import json, re, time, math, unicodedata, urllib.request, urllib.parse, ssl
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = "PinnedCities/1.0 (https://masonj52.github.io/pinned-cities/; one-time data build)"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=30, context=ctx) as r: return json.loads(r.read().decode())
def km(a, b, c, d):
    r = math.pi / 180; x = math.sin((c - a) * r / 2); y = math.sin((d - b) * r / 2)
    return 2 * 6371 * math.asin(math.sqrt(x * x + math.cos(a * r) * math.cos(c * r) * y * y))
def norm(t): return " ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()))
STOP = {"the", "nyc", "new", "york", "ny", "and", "of", "bar", "inc", "soho", "east", "village", "brooklyn", "store", "shop", "restaurant", "cafe"}
def name_ok(title, cand):
    w = [x for x in norm(title.split(" | ")[0].split(" - ")[0]).split() if x not in STOP and len(x) > 1]
    c = norm(cand)
    return bool(w) and sum(x in c.split() or x in c for x in w) >= max(1, math.ceil(len(w) * 0.75))
places = {p["id"]: p for p in json.load(open("/home/claude/pinned-cities/data/places.json"))["places"] if p["city"] == "New York"}
osm = json.load(open("osm.json"))
rev = {}
for f in ["rev_a.json", "rev_b.json", "rev_c.json"]: rev.update(json.load(open(f)))
fetched = json.load(open("fetched.json")); rows = {l.split("\t")[1]: l.split("\t")[0] for l in open("list.tsv").read().splitlines()}
ADDR = re.compile(r"(\d+[A-Za-z\-]*(?:-\d+)?\s+[A-Za-z0-9 .'\-]+?(?:St|Street|Ave|Avenue|Pl|Place|Blvd|Rd|Road|Broadway|Bowery|Alley|Sq|Square|Ln|Way|Ave\.|St\.)\b\.?),?\s*(?:[A-Za-z .#0-9]*,\s*)?(New York|Brooklyn|Queens|Long Island City|Glendale|Ridgewood|Astoria|Flushing|Bronx|Manhattan)\s*,?\s*(?:NY|New York)\s*(\d{5})")
VIEW = "-74.27,40.92,-73.68,40.48"
out = {}
for pid, p in places.items():
    if (osm.get(pid) or {}).get("match"): continue
    rec = {"title": p["title"]}
    texts = [r["text"] + " " + r["desc"] for r in rev.get(pid, {}).get("reviews", [])]
    texts += [(r.get("text") or "") + " " + (r.get("desc") or "") for r in fetched.get(rows.get(pid, ""), [])]
    m = None
    for tx in texts:
        m = ADDR.search(tx)
        if m: break
    addr_hit = None
    if m:
        q = f"{m.group(1)}, {m.group(2)}, NY {m.group(3)}"
        rec["address_text"] = q
        try:
            r = get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 1, "viewbox": VIEW, "bounded": 1})); time.sleep(1.1)
            if r: addr_hit = r[0]
        except Exception as e: rec["err1"] = str(e)[:80]; time.sleep(3)
    name_hit = None
    try:
        r = get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": p["title"].split(" | ")[0], "format": "jsonv2", "addressdetails": 1, "extratags": 1, "namedetails": 1, "limit": 8, "viewbox": VIEW, "bounded": 1})); time.sleep(1.1)
        r = [x for x in r if name_ok(p["title"], (x.get("namedetails") or {}).get("name", x.get("name", "")))]
        if r:
            ref = (float(addr_hit["lat"]), float(addr_hit["lon"])) if addr_hit else (p["lat"], p["lng"])
            r.sort(key=lambda x: km(ref[0], ref[1], float(x["lat"]), float(x["lon"])))
            name_hit = r[0]
    except Exception as e: rec["err2"] = str(e)[:80]; time.sleep(3)
    if name_hit and (not addr_hit or km(float(addr_hit["lat"]), float(addr_hit["lon"]), float(name_hit["lat"]), float(name_hit["lon"])) < 1.5):
        rec["pick"] = "osm-name"; rec["hit"] = name_hit
    elif addr_hit:
        rec["pick"] = "address"; rec["hit"] = addr_hit
    if rec.get("hit"):
        rec["moved_km"] = round(km(p["lat"], p["lng"], float(rec["hit"]["lat"]), float(rec["hit"]["lon"])), 2) if p.get("lat") is not None else None
    out[pid] = rec
json.dump(out, open("relocate.json", "w"), ensure_ascii=False, indent=1)
fixed = [v for v in out.values() if v.get("hit")]
print("unmatched", len(out), "relocated", len(fixed), "by name", sum(1 for v in fixed if v["pick"] == "osm-name"), "by address", sum(1 for v in fixed if v["pick"] == "address"))
print("moved >1km:", sum(1 for v in fixed if (v.get("moved_km") or 0) > 1))
