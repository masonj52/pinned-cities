"""Fetch each chosen source page; keep title, description and opening text. Wikipedia pages go through its summary API."""
import json, re, html, time, urllib.request, urllib.parse, ssl, concurrent.futures as cf
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = "Mozilla/5.0 (compatible; PinnedCitiesBuild/1.0; +https://masonj52.github.io/pinned-cities/)"
def meta(h, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']' + prop + r'["\'][^>]+content=["\']([^"\']*)', h, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop, h, re.I)
    return html.unescape(m.group(1)).strip() if m else ""
def paras(h, n=4):
    body = re.sub(r"(?is)<(script|style|nav|header|footer|aside)[^>]*>.*?</\1>", " ", h)
    ps = [html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", body)]
    ps = [re.sub(r"\s+", " ", p) for p in ps if len(p) > 80 and not re.search(r"cookie|newsletter|sign up|subscribe|privacy", p, re.I)]
    return " ".join(ps[:n])[:1100]
def fetch(url):
    try:
        if "wikipedia.org/wiki/" in url:
            title = urllib.parse.unquote(url.split("/wiki/")[1])
            u = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title)
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "PinnedCities/1.0 (https://masonj52.github.io/pinned-cities/)"}), timeout=20, context=ctx) as r:
                d = json.loads(r.read().decode())
            return {"url": url, "title": d.get("title", ""), "desc": d.get("description", ""), "text": d.get("extract", "")[:1100]}
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=20, context=ctx) as r:
            h = r.read(800000).decode("utf-8", "ignore")
        t = meta(h, "og:title") or html.unescape((re.search(r"(?is)<title>(.*?)</title>", h) or [None, ""])[1]).strip()
        return {"url": url, "title": t, "desc": meta(h, "og:description") or meta(h, "description"), "text": paras(h)}
    except Exception as e:
        return {"url": url, "error": str(e)[:100]}
rows = [l.split("\t") for l in open("urls.tsv").read().splitlines() if l.strip()]
jobs = [(r[0], u) for r in rows for u in r[1:] if u]
out = {}
with cf.ThreadPoolExecutor(6) as ex:
    for (i, u), res in zip(jobs, ex.map(lambda j: fetch(j[1]), jobs)):
        out.setdefault(i, []).append(res)
json.dump(out, open("fetched.json", "w"), ensure_ascii=False, indent=1)
ok = sum(1 for v in out.values() if any(x.get("text") or x.get("desc") for x in v))
print("pages", len(jobs), "errors", sum(1 for v in out.values() for x in v if x.get("error")), "places with text", ok, "of", len(out))
