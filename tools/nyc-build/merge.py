"""Build data/info/new-york.json from facts + relocation + written summaries."""
import json, glob, os, urllib.parse
BORO = {"Manhattan", "Brooklyn", "Queens", "The Bronx", "Bronx", "Staten Island"}
COUNTY = {"Kings County": "Brooklyn", "New York County": "Manhattan", "Queens County": "Queens", "Bronx County": "The Bronx", "Richmond County": "Staten Island"}
HOOD = {"Chelsea District": "Chelsea", "University Village": "Greenwich Village", "Five Points": "Chinatown",
        "Village View Houses": "East Village", "Seaport": "South Street Seaport", "Dyker Heights": "Sunset Park", "Clinton": "Hell's Kitchen"}
ZIP = {"10002": "Lower East Side", "10003": "East Village", "10009": "East Village", "10012": "SoHo", "10014": "West Village",
       "10011": "Chelsea", "10001": "Chelsea", "10010": "Flatiron District", "10016": "Murray Hill", "10017": "Midtown East",
       "10022": "Midtown East", "10019": "Midtown West", "10036": "Midtown", "10018": "Midtown", "10065": "Upper East Side",
       "10021": "Upper East Side", "10075": "Upper East Side", "10028": "Upper East Side", "10023": "Upper West Side",
       "10024": "Upper West Side", "10025": "Upper West Side", "10004": "Financial District", "10005": "Financial District",
       "10006": "Financial District", "10038": "Financial District", "10007": "Tribeca", "10013": "Chinatown",
       "11211": "Williamsburg", "11249": "Williamsburg", "11222": "Greenpoint", "11237": "Bushwick", "11206": "East Williamsburg",
       "11378": "Maspeth", "11385": "Ridgewood"}
def area_of(addr):
    if not addr: return ""
    addr = {k: COUNTY.get(v, v) for k, v in addr.items()}
    ok = lambda h: h and "Community" not in h and h not in BORO and h != "Lower Manhattan"
    hood = next((addr[k] for k in ("neighbourhood", "quarter", "suburb") if ok(addr.get(k))), "")
    if not hood: hood = ZIP.get((addr.get("postcode") or "")[:5], "")
    hood = HOOD.get(hood, hood)
    boro = addr.get("city_district") or addr.get("borough") or (addr.get("suburb") if addr.get("suburb") in BORO else "")
    if boro not in BORO and addr.get("suburb") in BORO: boro = addr["suburb"]
    if boro == "Bronx": boro = "The Bronx"
    if boro not in BORO: boro = ""
    if hood == boro: hood = ""
    if not boro and addr.get("city") and addr.get("city") != "New York": boro = addr.get("city")
    return ", ".join([x for x in [hood, boro] if x])
def street_of(addr):
    if not addr: return ""
    return " ".join([x for x in [addr.get("house_number"), addr.get("road")] if x])

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "data", "info")
L = lambda f: json.load(open(os.path.join(HERE, f)))

rows = [l.split("\t") for l in open(os.path.join(HERE, "list.tsv")).read().splitlines()]
facts, reloc, osm = L("facts.json"), L("relocate.json"), L("osm.json")
rev = {}
for f in ["rev_a.json", "rev_b.json", "rev_c.json"]: rev.update(L(f))
wiki = {k: v for k, v in L("wiki.json").items() if v.get("wiki")}
wiki.update({k: v for k, v in L("wiki2.json").items() if v.get("url")})
sites = {k: v for k, v in L("sites.json").items() if v.get("desc")}
fetched = L("fetched.json")
# Name-search relocations that matched the wrong place: keep the original pin, drop the guessed area.
REJECT = {"p8431yj", "p1djniea", "pd6mqwt", "p1kevkuy", "p1cvtpnf", "psijtas", "p2bfkh8", "p1f0fqtg", "p6sx5jp"}
# Hand-checked addresses (geocoded once into fixgeo.json).
FIX = L("fixgeo.json"); FIX["p1jtdkw3"] = dict(FIX["p1oe878x"], lon=str(float(FIX["p1oe878x"]["lon"]) + 0.0005))  # Storehouse shares the Avant Gardner complex with the Mirage
for k in REJECT: reloc.pop(k, None)
for k, h in FIX.items(): reloc[k] = {"pick": "address", "hit": h}
ADDR = {"prpt6ty": "52-19 Flushing Avenue"}
AREA = {"prpt6ty": "Maspeth, Queens", "p1se9al7": "Financial District, Manhattan"}
summ = {}
for f in sorted(glob.glob(os.path.join(HERE, "sum*.json"))): summ.update(json.load(open(f)))

NAMES = {"en.wikipedia.org": "Wikipedia", "timeout.com": "Time Out", "theinfatuation.com": "The Infatuation",
         "evgrieve.com": "EV Grieve", "nyctourism.com": "NYC Tourism", "mixmag.net": "Mixmag", "bkmag.com": "Brooklyn Magazine",
         "secretnyc.co": "Secret NYC", "6sqft.com": "6sqft", "djmag.com": "DJ Mag", "direct.djmag.com": "DJ Mag",
         "greenpointers.com": "Greenpointers", "tribecacitizen.com": "Tribeca Citizen", "theshopkeepers.com": "The Shopkeepers",
         "highsnobiety.com": "Highsnobiety", "insidehook.com": "InsideHook", "brooklynvegan.com": "BrooklynVegan",
         "news.artnet.com": "Artnet", "amny.com": "amNY", "complex.com": "Complex", "hypebeast.com": "Hypebeast",
         "papermag.com": "PAPER", "untappedcities.com": "Untapped New York", "commercialobserver.com": "Commercial Observer",
         "dazeddigital.com": "Dazed", "afar.com": "AFAR", "theworlds50best.com": "The World's 50 Best", "villagevoice.com": "Village Voice",
         "eater.com": "Eater", "ny.eater.com": "Eater NY", "nytimes.com": "The New York Times", "grubstreet.com": "Grub Street",
         "theculturetrip.com": "Culture Trip", "therooftopguide.com": "The Rooftop Guide", "brownstoner.com": "Brownstoner",
         "bkreader.com": "BK Reader", "edm.com": "EDM.com", "michelin.com": "Michelin Guide", "guide.michelin.com": "Michelin Guide",
         "resy.com": "Resy", "gq.com": "GQ", "vogue.com": "Vogue", "cntraveler.com": "Condé Nast Traveler"}
def host(u):
    h = urllib.parse.urlparse(u).netloc.lower()
    return h[4:] if h.startswith("www.") else h
def name_of(u):
    h = host(u)
    return NAMES.get(h) or NAMES.get(".".join(h.split(".")[-2:])) or h

def norm(u): return u.rstrip("/").replace("http://", "https://")

info = {}
for i, pid, cat, title in rows:
    s = summ.get(pid)
    if not s or not s.get("s"): continue
    f = {} if s.get("nofacts") else dict(facts.get(pid, {}))
    if s.get("nofacts"):
        f = {}
    om = (osm.get(pid, {}).get("match") or {}).get("address")
    if om and not s.get("nofacts"): f["area"] = area_of(om)
    r = reloc.get(pid, {}).get("hit")
    if r and not s.get("nofacts"):
        f["lat"] = round(float(r["lat"]), 6); f["lng"] = round(float(r["lon"]), 6)
        a = area_of(r.get("address")); st = street_of(r.get("address"))
        if a: f["area"] = a
        if st: f["address"] = st
        et = r.get("extratags") or {}
        if reloc[pid].get("pick") == "osm-name":
            f["hours"] = f.get("hours") or et.get("opening_hours", "")
            f["website"] = f.get("website") or et.get("website") or et.get("contact:website") or ""
    elif not s.get("nofacts") and "lat" not in f:
        # Area came from reverse-geocoding a possibly wrong decoded pin: don't trust it.
        f["area"] = ""
    if pid in AREA: f["area"] = AREA[pid]
    if pid in ADDR: f["address"] = ADDR[pid]
    for k in ("area", "address", "lat", "lng", "kind"):
        if k in s: f[k] = s[k]
    srcs, seen = [], set()
    def add(n, u):
        if not u or any(d in u for d in s.get("drop", [])): return
        k = norm(u)
        if k in seen: return
        seen.add(k); srcs.append({"name": n, "url": u})
    for rv in rev.get(pid, {}).get("reviews", []): add(rv["name"], rv["url"])
    if pid in wiki: add("Wikipedia", wiki[pid]["url"])
    for rv in fetched.get(i, []):
        if rv.get("text") or rv.get("desc"): add(name_of(rv["url"]), rv["url"])
    for a in s.get("add", []): add(a["name"], a["url"])
    site = f.get("website") or (sites[pid]["website"] if pid in sites else "")
    if site and any(d in site for d in s.get("drop", [])): site = ""
    if pid in sites and not any(d in sites[pid]["website"] for d in s.get("drop", [])): add("Official site", sites[pid]["website"])
    e = {"summary": s["s"]}
    for k in ("area", "address", "kind", "hours"):
        if f.get(k): e[k] = f[k]
    if site: e["website"] = site
    if isinstance(f.get("lat"), (int, float)) and isinstance(f.get("lng"), (int, float)):
        e["lat"], e["lng"] = f["lat"], f["lng"]
    if srcs: e["sources"] = srcs
    info[pid] = e

os.makedirs(OUT, exist_ok=True)
json.dump(info, open(os.path.join(OUT, "new-york.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"New York": "new-york.json"}, open(os.path.join(OUT, "index.json"), "w"))
print(len(info), "places with info;", sum(1 for e in info.values() if "lat" in e), "with exact position;",
      sum(1 for e in info.values() if "area" in e), "with area;", sum(1 for e in info.values() if not e.get("sources")), "without sources")
