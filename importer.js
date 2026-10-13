/* Pinned Cities importer: turns Google Takeout "Saved" CSVs into places.json.
   Used by import.html in the browser, and works in Node for building the data file. */
(function (root) {
  "use strict";

  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    var rows = [], row = [], field = "", i = 0, inQ = false;
    while (i < text.length) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function placesFromCSV(text) {
    var rows = parseCSV(text).filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (v) { return v.trim().toLowerCase(); });
    var iT = head.indexOf("title"), iU = head.indexOf("url"), iN = head.indexOf("note"), iC = head.indexOf("comment");
    var body = rows.slice(1);
    if (iT === -1) { iT = 0; iN = 1; iU = 2; iC = -1; body = rows; }
    var out = [];
    body.forEach(function (r) {
      var title = (r[iT] || "").trim(), url = iU > -1 ? (r[iU] || "").trim() : "";
      if (!title && !url) return;
      if (!title) title = titleFromUrl(url) || "Untitled place";
      var note = [iN > -1 ? r[iN] : "", iC > -1 ? r[iC] : ""].map(function (s) { return (s || "").trim(); }).filter(Boolean).join(" · ");
      out.push({ title: title, url: url, note: note });
    });
    return out;
  }
  function titleFromUrl(url) { var m = /\/maps\/place\/([^/]+)/.exec(url); if (!m) return ""; try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return ""; } }

  // Google place IDs ("1s0x<cell>:0x<id>") start with an S2 cell id, which gives the place's location.
  var LIJ = (function () {
    var t = [], P2IJ = [[0, 1, 3, 2], [0, 2, 3, 1], [3, 2, 0, 1], [3, 1, 0, 2]], P2O = [1, 0, 0, 3];
    function init(level, i, j, oo, pos, o) {
      if (level === 4) { t[(pos << 2) + oo] = (((i << 4) + j) << 2) + o; return; }
      level++; i <<= 1; j <<= 1; pos <<= 2;
      for (var k = 0; k < 4; k++) { var r = P2IJ[o][k]; init(level, i + (r >> 1), j + (r & 1), oo, pos + k, o ^ P2O[k]); }
    }
    [0, 1, 2, 3].forEach(function (o) { init(0, 0, 0, o, 0, o); });
    return t;
  })();
  function stToUV(s) { return s >= 0.5 ? (4 * s * s - 1) / 3 : (1 - 4 * (1 - s) * (1 - s)) / 3; }
  function cellToLatLng(hex) {
    var id; try { id = BigInt(hex); } catch (e) { return null; }
    var face = Number(id >> BigInt(61));
    if (face > 5) return null;
    var i = 0, j = 0, bits = face & 1;
    for (var k = 7; k >= 0; k--) {
      var nb = k === 7 ? 2 : 4;
      bits += Number((id >> BigInt(k * 8 + 1)) & BigInt((1 << (2 * nb)) - 1)) << 2;
      bits = LIJ[bits];
      i += (bits >> 6) * Math.pow(2, k * 4);
      j += ((bits >> 2) & 15) * Math.pow(2, k * 4);
      bits &= 3;
    }
    var u = stToUV((i + 0.5) / 1073741824), v = stToUV((j + 0.5) / 1073741824), x, y, z;
    switch (face) {
      case 0: x = 1; y = u; z = v; break;
      case 1: x = -u; y = 1; z = v; break;
      case 2: x = -u; y = -v; z = 1; break;
      case 3: x = -1; y = -v; z = -u; break;
      case 4: x = v; y = -1; z = -u; break;
      default: x = v; y = u; z = -1;
    }
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI, Math.atan2(y, x) * 180 / Math.PI];
  }
  function locate(url) {
    if (!url) return null;
    var m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url) || /[@\/=](-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/.exec(url);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = /0x([0-9a-f]{6,16}):0x[0-9a-f]+/i.exec(url);
    if (m) { var h = m[1]; while (h.length < 16) h = "0" + h; return cellToLatLng("0x" + h); }
    return null;
  }

  var CITIES = "Seoul,37.5665,126.978;Incheon,37.456,126.705;Suwon,37.263,127.029;Cheonan,36.81,127.11;Busan,35.18,129.075;Daegu,35.871,128.601;Daejeon,36.35,127.385;Gwangju,35.16,126.851;Ulsan,35.538,129.311;Jeju,33.5,126.53;Seogwipo,33.254,126.56;Gangneung,37.752,128.876;Sokcho,38.207,128.592;Jeonju,35.824,127.148;Gyeongju,35.856,129.225;" +
    "Tokyo,35.68,139.76;Yokohama,35.444,139.638;Gotemba,35.3,138.93;Osaka,34.69,135.5;Kyoto,35.01,135.77;Fukuoka,33.59,130.4;Sapporo,43.06,141.35;Hakodate,41.77,140.73;Nagoya,35.18,136.91;Okinawa,26.21,127.68;" +
    "Shanghai,31.23,121.47;Beijing,39.9,116.4;Shenzhen,22.54,114.06;Guangzhou,23.13,113.26;Chengdu,30.66,104.07;Hong Kong,22.3,114.17;Macau,22.19,113.54;Taipei,25.03,121.56;" +
    "Singapore,1.29,103.85;Bangkok,13.75,100.5;Phuket,7.88,98.39;Chiang Mai,18.79,98.99;Kuala Lumpur,3.14,101.69;Jakarta,-6.2,106.85;Bali,-8.65,115.15;Manila,14.6,121.0;Ho Chi Minh City,10.78,106.7;Hanoi,21.03,105.85;Da Nang,16.05,108.2;Hoi An,15.88,108.33;Mumbai,19.08,72.88;Delhi,28.61,77.21;Bengaluru,12.97,77.59;" +
    "Dubai,25.2,55.27;Abu Dhabi,24.45,54.38;Doha,25.29,51.53;Tel Aviv,32.08,34.78;Istanbul,41.01,28.98;Tbilisi,41.72,44.79;" +
    "London,51.507,-0.128;Manchester,53.48,-2.24;Bristol,51.45,-2.59;Glasgow,55.86,-4.25;Edinburgh,55.95,-3.19;Dublin,53.35,-6.26;Paris,48.857,2.352;Lyon,45.76,4.84;Marseille,43.3,5.37;Nice,43.7,7.27;Saint-Tropez,43.26,6.64;" +
    "Berlin,52.52,13.405;Hamburg,53.55,9.99;Munich,48.14,11.58;Frankfurt,50.11,8.68;Cologne,50.94,6.96;Leipzig,51.34,12.37;Amsterdam,52.37,4.9;Rotterdam,51.92,4.48;Brussels,50.85,4.35;Antwerp,51.22,4.4;Gruyères,46.58,7.08;" +
    "Ibiza,38.98,1.43;Menorca,39.95,4.05;Barcelona,41.39,2.17;Madrid,40.42,-3.7;Valencia,39.47,-0.38;Mallorca,39.57,2.65;Lisbon,38.72,-9.14;Porto,41.15,-8.61;Milan,45.46,9.19;Rome,41.9,12.5;Florence,43.77,11.26;Naples,40.85,14.27;Venice,45.44,12.32;Dubrovnik,42.65,18.09;" +
    "Zurich,47.38,8.54;Geneva,46.2,6.14;Vienna,48.21,16.37;Prague,50.08,14.44;Budapest,47.5,19.04;Warsaw,52.23,21.01;Krakow,50.06,19.94;Copenhagen,55.68,12.57;Stockholm,59.33,18.07;Oslo,59.91,10.75;Helsinki,60.17,24.94;Tallinn,59.44,24.75;Riga,56.95,24.11;Athens,37.98,23.73;Mykonos,37.45,25.33;Belgrade,44.79,20.45;Bucharest,44.43,26.1;" +
    "New York,40.713,-74.006;Pittsburgh,40.44,-79.996;Philadelphia,39.95,-75.17;Boston,42.36,-71.06;Washington DC,38.9,-77.04;Baltimore,39.29,-76.61;Chicago,41.88,-87.63;Detroit,42.33,-83.05;Miami,25.76,-80.19;Orlando,28.54,-81.38;Atlanta,33.75,-84.39;Nashville,36.16,-86.78;New Orleans,29.95,-90.07;Austin,30.27,-97.74;Houston,29.76,-95.37;Dallas,32.78,-96.8;Denver,39.74,-104.99;Las Vegas,36.17,-115.14;Phoenix,33.45,-112.07;Los Angeles,34.05,-118.24;San Diego,32.72,-117.16;San Francisco,37.77,-122.42;Oakland,37.8,-122.27;Napa Valley,38.4,-122.36;Seattle,47.61,-122.33;Portland,45.52,-122.68;Medford,42.33,-122.87;Honolulu,21.31,-157.86;" +
    "Toronto,43.65,-79.38;Montreal,45.5,-73.57;Vancouver,49.28,-123.12;Mexico City,19.43,-99.13;Tulum,20.21,-87.46;Cancun,21.16,-86.85;Playa del Carmen,20.63,-87.08;Havana,23.11,-82.37;Kingston,17.99,-76.79;Bogota,4.71,-74.07;Medellin,6.24,-75.58;Cartagena,10.39,-75.48;Lima,-12.05,-77.04;Sao Paulo,-23.55,-46.63;Rio de Janeiro,-22.91,-43.17;Buenos Aires,-34.6,-58.38;Santiago,-33.45,-70.67;" +
    "Sydney,-33.87,151.21;Melbourne,-37.81,144.96;Brisbane,-27.47,153.03;Perth,-31.95,115.86;Auckland,-36.85,174.76;Cape Town,-33.92,18.42;Johannesburg,-26.2,28.05;Marrakech,31.63,-8.0;Essaouira,31.51,-9.77;Cairo,30.04,31.24;Lagos,6.52,3.38;Nairobi,-1.29,36.82";
  var CITY_LIST = CITIES.split(";").map(function (s) { var a = s.split(","); return { name: a[0], lat: +a[1], lng: +a[2] }; });

  // Places whose Google record points somewhere wrong. Keyed by title.
  var FIXES = {
    "Bamonte's": { city: "New York", noPin: true },
    "After Hours Club": { city: "", noPin: true }
  };

  function km(a, b, c, d) { var r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2); return 2 * 6371 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y)); }
  function cityFor(ll) {
    var best = null, bd = 1e9;
    CITY_LIST.forEach(function (c) { var d = km(ll[0], ll[1], c.lat, c.lng); if (d < bd) { bd = d; best = c; } });
    if (best && bd < 60) return best.name;
    return "Near " + ll[0].toFixed(1) + ", " + ll[1].toFixed(1);
  }
  function cityInName(name) {
    var n = " " + name.toLowerCase() + " ", hit = "";
    CITY_LIST.forEach(function (c) { if (n.indexOf(" " + c.name.toLowerCase() + " ") !== -1 && c.name.length > hit.length) hit = c.name; });
    return hit;
  }
  function categoryFor(listName, city) {
    var c = listName;
    if (city) c = c.replace(new RegExp("\\b" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), "");
    c = c.replace(/\s+/g, " ").trim() || listName.trim();
    return c.charAt(0).toUpperCase() + c.slice(1);
  }
  // Stable ids, so a viewer's basket survives data updates.
  function stableId(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return "p" + h.toString(36);
  }

  // csvs: [{name: "Clubs.csv", text: "..."}] -> {places, lists, skipped}
  function build(csvs) {
    var seen = {}, places = [], lists = 0, dup = 0;
    csvs.forEach(function (c) {
      var listName = c.name.replace(/\.csv$/i, "").replace(/_+/g, " ").trim();
      var nameCity = cityInName(listName), cat = categoryFor(listName, nameCity);
      var items = placesFromCSV(c.text);
      if (items.length) lists++;
      items.forEach(function (it) {
        var key = (it.url || it.title) + "|" + cat;
        if (seen[key]) { dup++; return; }
        seen[key] = 1;
        var ll = locate(it.url);
        var p = { id: stableId(key), title: it.title, note: it.note, url: it.url, city: ll ? cityFor(ll) : nameCity, category: cat };
        if (ll) { p.lat = +ll[0].toFixed(5); p.lng = +ll[1].toFixed(5); }
        var fix = FIXES[it.title];
        if (fix) { p.city = fix.city; if (fix.noPin) { delete p.lat; delete p.lng; } }
        places.push(p);
      });
    });
    places.sort(function (a, b) { return (a.city || "").localeCompare(b.city || "") || a.category.localeCompare(b.category) || a.title.localeCompare(b.title); });
    return { places: places, lists: lists, skipped: dup };
  }

  var api = { build: build, parseCSV: parseCSV, locate: locate, cityFor: cityFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PinnedImport = api;
})(this);
