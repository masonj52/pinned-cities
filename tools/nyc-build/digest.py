import json, re
rows = [l.split("\t") for l in open("list.tsv").read().splitlines()]
osm = json.load(open("osm.json"))
rev = {}
for f in ["rev_a.json", "rev_b.json", "rev_c.json"]: rev.update(json.load(open(f)))
wiki = {k: v for k, v in json.load(open("wiki.json")).items() if v.get("wiki")}
sites = {k: v for k, v in json.load(open("sites.json")).items() if v.get("desc")}
fetched = json.load(open("fetched.json"))
BORO = {"Manhattan", "Brooklyn", "Queens", "The Bronx", "Bronx", "Staten Island"}
COUNTY = {"Kings County": "Brooklyn", "New York County": "Manhattan", "Queens County": "Queens", "Bronx County": "The Bronx", "Richmond County": "Staten Island"}
def area_of(addr):
    if not addr: return ""
    addr = {k: COUNTY.get(v, v) for k, v in addr.items()}
    hood = addr.get("neighbourhood") or addr.get("quarter") or addr.get("suburb") or ""
    boro = addr.get("city_district") or addr.get("borough") or (addr.get("suburb") if addr.get("suburb") in BORO else "")
    if boro == "Bronx": boro = "The Bronx"
    if hood == boro: hood = ""
    if not boro and addr.get("city") and addr.get("city") != "New York": boro = addr.get("city")
    return ", ".join([x for x in [hood, boro] if x])
def street_of(addr):
    if not addr: return ""
    return " ".join([x for x in [addr.get("house_number"), addr.get("road")] if x])
facts = {}; lines = []
for i, pid, cat, title in rows:
    o = osm.get(pid, {}); m = o.get("match") or {}; rv = o.get("reverse") or {}
    addr = m.get("address") or rv.get("address") or {}
    et = m.get("extratags") or {}
    kind = ""
    if m:
        t = (m.get("type") or "").replace("_", " ")
        if et.get("cuisine"): t = et["cuisine"].replace(";", ", ").replace("_", " ") + " " + (t if t != "yes" else "")
        kind = t.strip()
    f = {"area": area_of(addr), "address": street_of(addr) if m else "", "kind": kind,
         "hours": et.get("opening_hours", ""), "website": et.get("website") or et.get("contact:website") or ""}
    if m: f["lat"] = round(float(m["lat"]), 6); f["lng"] = round(float(m["lon"]), 6)
    facts[pid] = f
    src = []
    for r in rev.get(pid, {}).get("reviews", []): src.append((r["name"], r["url"], (r["desc"] + " | " + r["text"])[:420]))
    if pid in wiki: src.append(("Wikipedia", wiki[pid]["url"], wiki[pid]["extract"][:420]))
    for r in fetched.get(i, []):
        if r.get("text") or r.get("desc"): src.append((r.get("title", "")[:60], r["url"], ((r.get("desc") or "") + " | " + (r.get("text") or ""))[:420]))
    if pid in sites: src.append(("Official site", sites[pid]["website"], sites[pid]["desc"][:300]))
    head = f"#{i} [{pid}] {title} ({cat}) area={f['area']} addr={f['address']} kind={f['kind']}"
    lines.append(head + "\n" + "\n".join(f"  - {n} <{u}>: {re.sub(r'\s+',' ',t)}" for n, u, t in src) if src else head + "\n  - (no sources)")
json.dump(facts, open("facts.json", "w"), ensure_ascii=False, indent=1)
open("digest.txt", "w").write("\n".join(lines))
print(len(facts), "facts;", sum(1 for l in lines if "(no sources)" in l), "without sources;", len(open("digest.txt").read())//1000, "k chars")
