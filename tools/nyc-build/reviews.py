"""Try predictable review URLs (The Infatuation, Time Out) for each NYC place; keep og:description and the opening text when the page title matches."""
import json, sys, time, re, html, unicodedata, urllib.request, ssl
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = "Mozilla/5.0 (compatible; PinnedCitiesBuild/1.0; +https://masonj52.github.io/pinned-cities/)"
def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            if r.status != 200: return None, r.geturl()
            return r.read(600000).decode("utf-8", "ignore"), r.geturl()
    except Exception:
        return None, None
def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"&", " and ", t); t = re.sub(r"['’.]", "", t)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")
def meta(h, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']' + prop + r'["\'][^>]+content=["\']([^"\']*)', h, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop, h, re.I)
    return html.unescape(m.group(1)).strip() if m else ""
def paras(h, n=3):
    body = re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", h)
    ps = [html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", body)]
    ps = [re.sub(r"\s+", " ", p) for p in ps if len(p) > 80 and "cookie" not in p.lower() and "newsletter" not in p.lower() and "sign up" not in p.lower()]
    return " ".join(ps[:n])[:900]
def words(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return [w for w in re.findall(r"[a-z0-9]+", t) if len(w) > 1 and w not in ("the", "nyc", "new", "york", "ny", "bar", "and", "of")]
def matches(title, page_title):
    w = words(title.split(" | ")[0].split(" - ")[0])
    pt = " ".join(words(page_title))
    return bool(w) and sum(x in pt for x in w) >= max(1, round(len(w) * 0.7))
SECTIONS = {"Clubs": ["nightlife", "clubs", "bars"], "Drinks": ["bars", "nightlife", "restaurants"], "Pubs": ["bars"], "Food": ["restaurants"], "Cafes": ["restaurants", "bars"],
            "Sound": ["nightlife", "music", "bars"], "Records": ["shopping", "music"], "Clothes": ["shopping"], "Designs": ["shopping"], "Markets": ["shopping", "restaurants"],
            "Books": ["shopping"], "Art": ["art", "attractions"], "Exhibitions": ["art", "attractions"], "Sights": ["attractions"], "Activities": ["things-to-do", "attractions"],
            "Hotels": ["hotels"], "Tech": ["shopping"], "Utility": ["shopping"]}
rows = [l.split("\t") for l in open("list.tsv").read().splitlines()]
lo, hi, OUT = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
rows = [r for r in rows if lo <= int(r[0]) < hi]
out = {}
for i, pid, cat, title in rows:
    base = slug(title.split(" | ")[0].split(" - ")[0])
    cands = []
    if cat in ("Food", "Drinks", "Cafes", "Pubs", "Clubs", "Sound", "Markets"): cands.append(("The Infatuation", "https://www.theinfatuation.com/new-york/reviews/" + base))
    cands += [("Time Out", "https://www.timeout.com/newyork/%s/%s" % (s, base)) for s in SECTIONS.get(cat, ["things-to-do"])]
    got = []
    for name, url in cands:
        h, final = fetch(url); time.sleep(0.6)
        if not h: continue
        pt = meta(h, "og:title") or (re.search(r"(?is)<title>(.*?)</title>", h) or [None, ""])[1]
        if not matches(title, pt): continue
        got.append({"name": name, "url": final or url, "title": html.unescape(pt), "desc": meta(h, "og:description") or meta(h, "description"), "text": paras(h)})
        if len(got) >= 2: break
    if got: out[pid] = {"title": title, "category": cat, "reviews": got}
    if int(i) % 20 == 0:
        json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1); print(i, len(out), flush=True)
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1); print("done", len(out), flush=True)
