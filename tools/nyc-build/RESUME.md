# New York info cards: work in progress

Branch `wip/nyc-info-cards`. Nothing here is live yet; `main` is unchanged.

## Done
- Site code (app.js, i18n.js, style.css): "About this place" card on each place, summary + area in map popups, coordinate override from info files, "Follow whole lists in Google Maps" buttons (driven by `data/lists.json`, empty until the owner sends share links).
- `osm.json`: OpenStreetMap lookup for all 368 NYC places (140 matched: address, hours, website, exact position).
- `rev_a/b/c.json`, `wiki.json`, `sites.json`, `fetched.json`: sources (The Infatuation, Time Out, Wikipedia, venue sites, web-search picks in `urls.tsv`).
- `digest.py` -> `facts.json` (area, address, kind, hours, website, lat/lng per place).
- `sum0.json` … `sum7.json`: written summaries for all places with sources (keys = place id). Fields: `s` summary, optional `drop` (source URL substrings to exclude), `add` (extra sources), `area`/`address`/`lat`/`lng`/`kind` overrides, `nofacts` (ignore the OSM match, it was wrong).

## Found during the work
Google place IDs for newer places do NOT encode an accurate location: many NYC pins are kilometres off (e.g. Outer Heaven, Le Dive, Eavesdrop). `relocate.py` fixes this for places OSM didn't match: OSM name search across NYC, then the street address quoted in review pages. It was still running when the session paused; re-run it:

    cd tools/nyc-build && python3 -I relocate.py   # ~10 min, 1 req/s to Nominatim, writes relocate.json

The same problem likely affects other cities; offer to run the same fix there.

## Remaining steps
1. ~~Run `relocate.py`~~ Done: `relocate.json` has 125 of 228 unmatched places relocated (101 by OSM name, 24 by review address; 117 had moved more than 1 km).
2. Build `data/info/new-york.json` keyed by place id: merge `facts.json` + relocation (lat/lng, area from the hit's address) + `sum*.json` (summary, overrides, sources = review/wiki/fetched/site URLs minus `drop`, plus `add`). Skip facts when `nofacts`. Areas: prefer relocation/OSM address; only fall back to the decoded-pin reverse geocode if nothing better.
3. Write `data/info/index.json` = `{"New York": "new-york.json"}`.
4. Test in a browser (About card, popup summary, corrected pins), then merge into `main` and push. Remove `tools/nyc-build` from `main` or keep it out of the deploy (it's harmless but not needed).
5. Ask the owner for Google Maps share links per list (Saved › list › Share › anyone with link) for `data/lists.json`.
