import json, time, urllib.request, urllib.parse, ssl
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = "PinnedCities/1.0 (https://masonj52.github.io/pinned-cities/; one-time data build)"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=30, context=ctx) as r: return json.loads(r.read().decode())
Q = {256:"Frick Madison",257:"Gagosian",265:"Whitney Museum of American Art",274:"Roosevelt Island Tramway",275:"Cooper Union",240:"Birdland jazz club",
 16:"Terminal 5 nightclub New York",1:"Brooklyn Mirage",5:"Market Hotel Brooklyn music venue",182:"Smith & Wollensky",111:"Gallagher's Steakhouse",132:"Le Pavillon Daniel Boulud",
 123:"JoJo Jean-Georges restaurant",90:"Cote Korean steakhouse",351:"H Mart",366:"Muji",280:"Chrome Hearts",293:"Acne Studios",298:"A Bathing Ape",299:"Birkenstock",
 304:"Buck Mason",321:"Golden Goose Deluxe Brand",326:"Noah clothing brand Brendon Babenzien",327:"Nudie Jeans",330:"Palace Skateboards",333:"Polo Ralph Lauren",338:"Salomon Group",
 341:"Stone Island",342:"Stüssy",344:"Theory clothing company",348:"Y-3 adidas Yohji Yamamoto",360:"Three Lives & Company",297:"Awake NY",325:"Nepenthes clothing Engineered Garments",
 316:"Frame denim brand",14:"Silencio David Lynch club",31:"Faena Group",13:"Signal nightclub Brooklyn",270:"Manhattan Bridge DUMBO",271:"Hamilton Park"}
rows = {int(l.split("\t")[0]): l.split("\t") for l in open("list.tsv").read().splitlines()}
out = {}
for i, q in Q.items():
    try:
        s = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action":"query","list":"search","srsearch":q,"srlimit":1,"format":"json"}))
        hits = s["query"]["search"]
        if hits:
            title = hits[0]["title"]
            d = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_")))
            out[rows[i][1]] = {"title": rows[i][3], "wiki": title, "extract": d.get("extract", "")[:700], "url": d.get("content_urls", {}).get("desktop", {}).get("page")}
    except Exception as e:
        print("err", i, e)
    time.sleep(0.5)
json.dump(out, open("wiki2.json", "w"), ensure_ascii=False, indent=1)
for v in out.values(): print(v["title"], "=>", v["wiki"])
