# Pinned Cities

Saved Google Maps places, sorted by city and list, with a street map and a basket that sends picks to Google Maps.

## Files

- `index.html`, `style.css`, `app.js`: the site. Everything runs in the visitor's browser.
- `data/places.json`: the places. This is the only file that changes when the lists change.
- `import.html` + `importer.js`: turns a Google Takeout export into a new `places.json`.

## Updating the places

1. Export **Saved** from takeout.google.com.
2. Open `/import.html` on the live site and drop the export in.
3. Download `places.json`, then in this repository open `data/`, choose **Add file › Upload files**, and commit.

The site updates within a couple of minutes.

## Credits

Map: [OpenFreeMap](https://openfreemap.org), data © OpenStreetMap contributors. Map library: MapLibre GL JS.
