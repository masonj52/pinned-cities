# Pinned Cities

- To Access App: https://masonj52.github.io/pinned-cities/
  
Saved Google Maps places, sorted by city and list, with a street map and a basket that sends picks to Google Maps.

## Files

- `index.html`, `style.css`, `app.js`: the site. Everything runs in the visitor's browser.
- `i18n.js`: English and Korean text for buttons and labels, plus Korean names for lists and cities.
- `data/places.json`: the places. Rebuild it from a Takeout export with `import.html`.
- `data/icons.json`: the emoji for each list, used for map pins and labels.
- `data/picks.json`: your top picks. List places by exact name (`"Berghain | Panorama Bar"`), or by name and city (`"Faust | Seoul"`) when a name appears in more than one city.
- `og.png`: the image shown when the link is shared.
- `import.html` + `importer.js`: turns a Google Takeout export into a new `places.json`.

## Updating the places

1. Export **Saved** from takeout.google.com.
2. Open `/import.html` on the live site and drop the export in.
3. Download `places.json`, then in this repository open `data/`, choose **Add file › Upload files**, and commit.

The site updates within a couple of minutes.

## Sharing

- A city or list: copy the address bar, e.g. `?city=Berlin&cat=Clubs,Drinks`.
- One place: the **Share** button on any place.
- `?city=world` opens the world overview.

## Credits

Map: [OpenFreeMap](https://openfreemap.org), data © OpenStreetMap contributors. Map library: MapLibre GL JS.
