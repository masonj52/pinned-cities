/* Pinned Cities: filters, map, list and basket. Everything runs in the visitor's browser. */
(function () {
  "use strict";
  var t = I18N.t;
  var DATA = { places: [], updated: "" }, BYID = {}, ICONS = {}, PICKS = {}, INFO = {}, INFO_FILES = {}, INFO_LOADED = {}, LISTS = {};
  var $ = function (id) { return document.getElementById(id); };
  var WORLD = "world";
  var view = { city: null, cats: [], picks: false, q: "", sel: null, sort: "list", inView: false };
  var desktop = window.matchMedia("(min-width: 960px)");
  var darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function iconFor(cat) { return ICONS[cat] || "📍"; }
  function isPick(p) { return !!PICKS[p.id]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function countBy(list, fn) { var m = {}; list.forEach(function (p) { var k = fn(p); m[k] = (m[k] || 0) + 1; }); return m; }
  function sortedKeys(m) { return Object.keys(m).sort(function (a, b) { return (m[b] - m[a]) || a.localeCompare(b); }); }
  function cityKey(p) { return p.city || "__other"; }
  function cityName(k) { return k === "__other" ? t("other") : I18N.city(k); }
  function hasPin(p) { return typeof p.lat === "number" && typeof p.lng === "number"; }
  function mapsLink(p) {
    if (p.url && /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(p.url)) return p.url;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.title + (p.city ? " " + p.city : ""));
  }
  function fmtDate(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString(t("updatedFmt"), { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return iso; } }
  function fmtNum(n) { return Number(n).toLocaleString(t("updatedFmt")); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function km(a, b, c, d) { var r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2); return 2 * 6371 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y)); }
  function fmtKm(k) { return k < 1 ? Math.round(k * 100) * 10 + " m" : k.toFixed(1) + " km"; }

  // ---------- Language and theme ----------
  var lang = store("pinned-lang") || ((navigator.language || "").toLowerCase().indexOf("ko") === 0 ? "ko" : "en");
  I18N.set(lang);
  document.documentElement.lang = lang;
  var themeMode = store("pinned-theme") || "auto";
  function isDark() { return themeMode === "dark" || (themeMode === "auto" && darkMQ.matches); }
  function applyTheme() {
    if (themeMode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", themeMode);
  }
  applyTheme();
  var mapIsDark = isDark();
  function themeChanged() {
    applyTheme();
    if (map && isDark() !== mapIsDark) { mapIsDark = isDark(); mapReady = false; map.setStyle(styleUrl(), { diff: false }); }
  }
  darkMQ.addEventListener("change", themeChanged);

  // ---------- Starting state: link first, then this browser's last visit, then the world view ----------
  var params = new URLSearchParams(location.search);
  var startPlace = params.get("place");
  if (params.get("city")) {
    view.city = params.get("city");
    view.cats = (params.get("cat") || "").split(",").filter(Boolean);
  } else {
    try { var saved = JSON.parse(store("pinned-view") || "null"); if (saved) { view.city = saved.city; view.cats = saved.cats || []; } } catch (e) {}
  }
  view.sort = store("pinned-sort") || "list";
  view.inView = store("pinned-inview") === "1";
  function remember() {
    store("pinned-view", JSON.stringify({ city: view.city, cats: view.cats }));
    try {
      var u = new URL(location.href);
      u.searchParams.set("city", view.city);
      if (view.cats.length) u.searchParams.set("cat", view.cats.join(",")); else u.searchParams.delete("cat");
      u.searchParams.delete("place");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  // ---------- Map (MapLibre + OpenFreeMap, streets load on demand) ----------
  var map = null, mapReady = false, popup = null, lastFitKey = "", readyQueue = [], firstLoadDone = false;
  function styleUrl() { return "https://tiles.openfreemap.org/styles/" + (isDark() ? "dark" : "positron"); }
  function whenMapReady(fn) { if (mapReady) fn(); else readyQueue.push(fn); }
  function initMap() {
    if (!window.maplibregl) { $("map").innerHTML = '<div class="map-off">' + t("mapOff") + "</div>"; return; }
    try {
      map = new maplibregl.Map({ container: "map", style: styleUrl(), center: [10, 25], zoom: 1.3, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    } catch (e) { map = null; $("map").innerHTML = '<div class="map-off">' + t("noWebGL") + "</div>"; return; }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
    map.on("style.load", addLayers);
    map.on("styleimagemissing", function (e) {
      if (e.id.indexOf("pin|") !== 0 || map.hasImage(e.id)) return;
      var parts = e.id.split("|");
      map.addImage(e.id, makeBadge(parts[1], parts[2] === "on", parts[3] === "star"), { pixelRatio: 2 });
    });
    map.on("click", "pins", function (e) { if (e.features && e.features[0]) select(e.features[0].properties.id, false); });
    map.on("click", "clusters", function (e) {
      var f = e.features && e.features[0]; if (!f) return;
      map.getSource("places").getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
        map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z + 0.5, 16) });
      });
    });
    map.on("click", "city-bubbles", function (e) { if (e.features && e.features[0]) pickCity(e.features[0].properties.key); });
    ["pins", "clusters", "city-bubbles"].forEach(function (id) {
      map.on("mouseenter", id, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, function () { map.getCanvas().style.cursor = ""; });
    });
    map.on("moveend", function () {
      if (view.city !== WORLD && (view.inView || view.sort === "center") && $("bag").hidden) renderList();
    });
  }
  // Each pin is a round badge holding its list's emoji; top picks get a gold star.
  function makeBadge(emoji, on, star) {
    var S = 72, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d");
    g.shadowColor = "rgba(0,0,0,.28)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
    g.beginPath(); g.arc(S / 2, S / 2, 28, 0, Math.PI * 2);
    g.fillStyle = cssVar("--surface") || "#fff"; g.fill();
    g.shadowColor = "transparent";
    g.lineWidth = on ? 6 : 4; g.strokeStyle = on ? cssVar("--ink") : cssVar("--accent"); g.stroke();
    g.font = '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000";
    g.fillText(emoji, S / 2, S / 2 + 2);
    if (star) {
      g.beginPath(); g.arc(S - 13, 13, 11, 0, Math.PI * 2); g.fillStyle = "#f5b301"; g.fill();
      g.lineWidth = 2; g.strokeStyle = cssVar("--surface") || "#fff"; g.stroke();
      g.font = "bold 15px sans-serif"; g.fillStyle = "#1d1826"; g.fillText("★", S - 13, 14);
    }
    return { width: S, height: S, data: new Uint8Array(g.getImageData(0, 0, S, S).data.buffer) };
  }
  function addLayers() {
    if (!map.getSource("places")) {
      map.addSource("places", { type: "geojson", data: emptyFC(), cluster: true, clusterMaxZoom: 13, clusterRadius: 44 });
      map.addSource("cities", { type: "geojson", data: emptyFC() });
      var accent = cssVar("--accent"), ink = cssVar("--accent-ink"), surface = cssVar("--surface");
      map.addLayer({ id: "clusters", type: "circle", source: "places", filter: ["has", "point_count"], paint: {
        "circle-color": accent, "circle-stroke-color": surface, "circle-stroke-width": 3,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 40, 25, 120, 30]
      } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "places", filter: ["has", "point_count"], layout: {
        "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true
      }, paint: { "text-color": ink } });
      var sel = ["==", ["get", "sel"], 1];
      map.addLayer({ id: "pins", type: "symbol", source: "places", filter: ["!", ["has", "point_count"]], layout: {
        "icon-image": ["get", "img"], "icon-allow-overlap": true, "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "sel"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, ["case", sel, 0.85, 0.65], 12, ["case", sel, 1, 0.8], 15, ["case", sel, 1.2, 1]]
      } });
      map.addLayer({ id: "city-bubbles", type: "circle", source: "cities", paint: {
        "circle-color": accent, "circle-opacity": 0.88, "circle-stroke-color": surface, "circle-stroke-width": 2,
        "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 1, 9, 22, 34]
      } });
      map.addLayer({ id: "city-labels", type: "symbol", source: "cities", layout: {
        "text-field": ["format", ["get", "label"], { "font-scale": 0.95 }, "\n", {}, ["to-string", ["get", "count"]], { "font-scale": 0.8 }],
        "text-font": ["Noto Sans Bold"], "text-size": 13, "text-offset": [0, 2.2], "text-anchor": "top",
        "text-allow-overlap": false, "symbol-sort-key": ["-", 0, ["get", "count"]]
      }, paint: { "text-color": cssVar("--ink"), "text-halo-color": surface, "text-halo-width": 1.6 } });
    }
    if (!mapReady && !firstLoadDone) { firstLoadDone = true; lastFitKey = ""; }
    mapReady = true;
    updateMap();
    var q = readyQueue; readyQueue = []; q.forEach(function (fn) { fn(); });
  }
  function emptyFC() { return { type: "FeatureCollection", features: [] }; }
  function pinFC(list) {
    return { type: "FeatureCollection", features: list.filter(hasPin).map(function (p) {
      var on = p.id === view.sel;
      return { type: "Feature", properties: { id: p.id, sel: on ? 1 : 0, img: "pin|" + iconFor(p.category) + "|" + (on ? "on" : "off") + "|" + (isPick(p) ? "star" : "") }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } };
    }) };
  }
  function cityFC(list) {
    var acc = {};
    list.forEach(function (p) {
      if (!hasPin(p)) return;
      var k = cityKey(p), a = acc[k] || (acc[k] = { n: 0, la: 0, ln: 0 });
      a.n++; a.la += p.lat; a.ln += p.lng;
    });
    return { type: "FeatureCollection", features: Object.keys(acc).map(function (k) {
      var a = acc[k];
      return { type: "Feature", properties: { key: k, label: cityName(k), count: a.n }, geometry: { type: "Point", coordinates: [a.ln / a.n, a.la / a.n] } };
    }) };
  }
  function updateMap() {
    if (!map) return;
    var world = view.city === WORLD, list = filtered;
    if (mapReady) {
      map.getSource("places").setData(world ? emptyFC() : pinFC(list));
      map.getSource("cities").setData(world ? cityFC(list) : emptyFC());
    }
    var key = view.city + "|" + view.cats.slice().sort().join(",") + "|" + view.picks;
    if (key === lastFitKey) return;
    var pts = list.filter(hasPin);
    if (!pts.length) return;
    var first = lastFitKey === "";
    lastFitKey = key;
    if (world) {
      var fc = cityFC(list).features;
      if (fc.length === 1) { map.jumpTo({ center: fc[0].geometry.coordinates, zoom: 9 }); return; }
      var wb = new maplibregl.LngLatBounds();
      fc.forEach(function (f) { wb.extend(f.geometry.coordinates); });
      map.fitBounds(wb, { padding: 60, maxZoom: 6, duration: first ? 0 : 700 });
      return;
    }
    if (pts.length === 1) { map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 }); return; }
    var b = new maplibregl.LngLatBounds();
    pts.forEach(function (p) { b.extend([p.lng, p.lat]); });
    map.fitBounds(b, { padding: 40, maxZoom: 15, duration: first ? 0 : 700 });
  }
  function popupHtml(p) {
    return '<div class="pop"><span class="k">' + iconFor(p.category) + " " + esc(I18N.cat(p.category || "")) + (isPick(p) ? ' · <span class="star">★ ' + esc(t("topPick")) + "</span>" : "") + "</span><h4>" + esc(p.title) + "</h4>" +
      (INFO[p.id] && INFO[p.id].area ? '<p class="pop-area">' + esc(INFO[p.id].area) + "</p>" : "") +
      (INFO[p.id] && INFO[p.id].summary ? '<p class="pop-sum">' + esc(INFO[p.id].summary) + "</p>" : "") +
      (p.note ? "<p>" + esc(p.note) + "</p>" : "") +
      '<a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">' + t("openGM") + "</a>" +
      '<div class="pop-actions">' + bagBtn(p.id) + shareBtn(p.id) + "</div></div>";
  }
  function select(id, fly) {
    var p = BYID[id];
    view.sel = id;
    if (mapReady && view.city !== WORLD) map.getSource("places").setData(pinFC(filtered));
    markCards();
    if (!p || !map || !hasPin(p)) return;
    if (fly) {
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
      if (!desktop.matches) $("map").scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (desktop.matches) {
      var card = document.querySelector('[data-card="' + id + '"]'); if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    var old = popup; popup = null; if (old) old.remove();
    var pp = new maplibregl.Popup({ offset: 14, maxWidth: "270px", focusAfterOpen: false }).setLngLat([p.lng, p.lat]).setHTML(popupHtml(p)).addTo(map);
    pp.on("close", function () {
      if (popup === pp) { popup = null; view.sel = null; if (mapReady && view.city !== WORLD) map.getSource("places").setData(pinFC(filtered)); markCards(); }
    });
    popup = pp;
  }
  function clearSel() { view.sel = null; var old = popup; popup = null; if (old) old.remove(); }
  function markCards() { document.querySelectorAll("[data-card]").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-card") === view.sel); }); }

  // ---------- Filtering ----------
  var filtered = [];
  function computeFiltered() {
    var q = view.q.trim().toLowerCase(), world = view.city === WORLD;
    filtered = DATA.places.filter(function (p) {
      if (!world && cityKey(p) !== view.city) return false;
      if (view.cats.length && view.cats.indexOf(p.category) === -1) return false;
      if (view.picks && !isPick(p)) return false;
      if (!q) return true;
      return (p.title + " " + (p.note || "") + " " + (p.category || "") + " " + I18N.cat(p.category || "") + " " + (world ? (p.city || "") + " " + I18N.city(p.city || "") : "")).toLowerCase().indexOf(q) !== -1;
    });
  }
  function sortList(list) {
    var byTitle = function (a, b) { return a.title.localeCompare(b.title); };
    if (view.sort === "az") return list.sort(byTitle);
    if (view.sort === "picks") return list.sort(function (a, b) { return (isPick(b) - isPick(a)) || (a.category || "").localeCompare(b.category || "") || byTitle(a, b); });
    if (view.sort === "center" && map) {
      var c = map.getCenter();
      var d = function (p) { return hasPin(p) ? km(c.lat, c.lng, p.lat, p.lng) : 1e9; };
      return list.sort(function (a, b) { return d(a) - d(b); });
    }
    return list.sort(function (a, b) { return (a.category || "").localeCompare(b.category || "") || byTitle(a, b); });
  }

  // ---------- Page ----------
  function renderTop() {
    var cities = Object.keys(countBy(DATA.places, cityKey)).length;
    var themeName = t(themeMode === "auto" ? "themeAuto" : themeMode === "light" ? "themeLight" : "themeDark");
    var themeIcon = themeMode === "auto" ? "◐" : themeMode === "light" ? "☀" : "☾";
    $("top").innerHTML = '<div class="topbar"><span class="eyebrow">' + esc(t("eyebrow", { p: fmtNum(DATA.places.length), c: cities })) + '</span><div class="top-actions">' +
      '<button class="btn quiet" id="lang-btn" type="button" aria-label="' + esc(t("langLabel")) + '">' + esc(t("langBtn")) + "</button>" +
      '<button class="btn quiet" id="theme-btn" type="button" aria-label="' + esc(t("themeLabel", { m: themeName })) + '" title="' + esc(t("themeLabel", { m: themeName })) + '"><span aria-hidden="true">' + themeIcon + "</span> " + esc(themeName) + "</button>" +
      '<button class="btn" id="open-bag" type="button">' + esc(t("basket")) + '<span class="count-pill" id="bag-count">' + basket.length + "</span></button></div></div>";
    $("open-bag").addEventListener("click", openBag);
    $("lang-btn").addEventListener("click", function () {
      lang = lang === "ko" ? "en" : "ko"; I18N.set(lang); store("pinned-lang", lang); document.documentElement.lang = lang;
      if (!$("bag").hidden) renderBag(); else renderViewer();
      if (mapReady) map.getSource("cities").setData(view.city === WORLD ? cityFC(filtered) : emptyFC());
    });
    $("theme-btn").addEventListener("click", function () {
      themeMode = themeMode === "auto" ? "light" : themeMode === "light" ? "dark" : "auto";
      store("pinned-theme", themeMode); themeChanged(); renderTop();
    });
    updateBagUI();
  }

  function renderViewer() {
    var byCity = countBy(DATA.places, cityKey);
    var cities = sortedKeys(byCity);
    if (!view.city || (view.city !== WORLD && !byCity[view.city])) view.city = WORLD;
    var world = view.city === WORLD;
    var scope = world ? DATA.places : DATA.places.filter(function (p) { return cityKey(p) === view.city; });
    var byCat = countBy(scope, function (p) { return p.category || ""; });
    var cats = sortedKeys(byCat);
    view.cats = view.cats.filter(function (c) { return byCat[c]; });
    var picksHere = scope.filter(isPick).length;
    if (!picksHere) view.picks = false;
    renderTop();

    var h = '<section class="hero"><h1 class="city-name">' + esc(world ? t("allCities") : cityName(view.city)) + '</h1><div class="hero-meta">' +
      esc(world ? t("worldMeta", { p: fmtNum(DATA.places.length), c: cities.length, d: fmtDate(DATA.updated) }) : t("cityMeta", { n: fmtNum(scope.length), d: fmtDate(DATA.updated) })) + "</div></section>";
    var top = cities.slice(0, 8);
    if (!world && top.indexOf(view.city) === -1) top.push(view.city);
    h += '<div><div class="rail-label"><span>' + esc(t("city")) + "</span>";
    if (cities.length > 8) {
      h += '<select class="city-select" id="city-select" aria-label="' + esc(t("allNCities", { n: cities.length })) + '"><option value="">' + esc(t("allNCities", { n: cities.length })) + "</option>";
      cities.slice().sort(function (a, b) { return cityName(a).localeCompare(cityName(b)); }).forEach(function (c) {
        h += '<option value="' + esc(c) + '"' + (c === view.city ? " selected" : "") + ">" + esc(cityName(c)) + " (" + byCity[c] + ")</option>";
      });
      h += "</select>";
    }
    h += '</div><div class="rail" role="group" aria-label="' + esc(t("city")) + '">';
    h += '<button type="button" class="chip" data-city="' + WORLD + '" aria-pressed="' + world + '"><span class="emo" aria-hidden="true">🌍</span>' + esc(t("allCities")) + '<span class="n">' + cities.length + "</span></button>";
    top.forEach(function (c) { h += '<button type="button" class="chip" data-city="' + esc(c) + '" aria-pressed="' + (c === view.city) + '">' + esc(cityName(c)) + '<span class="n">' + byCity[c] + "</span></button>"; });
    h += "</div></div>";
    h += '<div><div class="rail-label"><span>' + esc(t("category")) + '</span></div><div class="rail" role="group" aria-label="' + esc(t("category")) + '">';
    h += '<button type="button" class="chip" data-cat="__all" aria-pressed="' + (!view.cats.length && !view.picks) + '">' + esc(t("all")) + '<span class="n">' + fmtNum(scope.length) + "</span></button>";
    if (picksHere) h += '<button type="button" class="chip pick-chip" data-picks="1" aria-pressed="' + view.picks + '"><span class="emo" aria-hidden="true">★</span>' + esc(t("topPicks")) + '<span class="n">' + picksHere + "</span></button>";
    cats.forEach(function (c) { h += '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (view.cats.indexOf(c) !== -1) + '"><span class="emo" aria-hidden="true">' + iconFor(c) + "</span>" + esc(I18N.cat(c) || "—") + '<span class="n">' + byCat[c] + "</span></button>"; });
    h += "</div></div>";
    h += '<input class="search" id="q" type="search" placeholder="' + esc(world ? t("searchWorld") : t("search", { city: cityName(view.city) })) + '" value="' + esc(view.q) + '" aria-label="' + esc(world ? t("searchWorld") : t("search", { city: cityName(view.city) })) + '">';
    $("head").innerHTML = h;
    bindHead();
    document.querySelectorAll('.rail .chip[aria-pressed="true"]').forEach(function (c) {
      var rail = c.parentNode, left = c.offsetLeft - rail.offsetLeft;
      if (left < rail.scrollLeft || left + c.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = Math.max(0, left - 16);
    });
    refresh();
  }
  function refresh() { computeFiltered(); renderList(); updateMap(); if (view.city !== WORLD) loadInfo(view.city); }

  // ---------- Info cards ----------
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }
  function aboutHtml(p) {
    var i = INFO[p.id], h = '<details class="about"' + (p.id === view.sel ? " open" : "") + "><summary>" + esc(t("about")) + "</summary>";
    if (i.summary) h += '<p class="about-sum">' + esc(i.summary) + "</p>";
    h += '<dl class="facts">';
    if (i.area || i.address) h += "<dt>" + esc(t("where")) + "</dt><dd>" + esc([i.address, i.area].filter(Boolean).join(" · ")) + "</dd>";
    if (i.kind) h += "<dt>" + esc(t("kind")) + "</dt><dd>" + esc(i.kind) + "</dd>";
    if (i.hours) h += "<dt>" + esc(t("hours")) + '</dt><dd><span class="mono">' + esc(i.hours) + '</span><span class="fine">' + esc(t("hoursNote")) + "</span></dd>";
    if (i.website) h += "<dt>" + esc(t("website")) + '</dt><dd><a class="maps" href="' + esc(i.website) + '" target="_blank" rel="noopener">' + esc(hostOf(i.website)) + " ↗</a></dd>";
    h += "</dl>";
    if (i.sources && i.sources.length) h += '<p class="fine">' + esc(t("sources")) + " " + i.sources.map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name || hostOf(s.url)) + "</a>";
    }).join(", ") + "</p>";
    return h + "</details>";
  }
  function loadInfo(city) {
    var f = INFO_FILES[city];
    if (!f || INFO_LOADED[city]) return;
    INFO_LOADED[city] = true;
    getJSON("data/info/" + f, {}).then(function (d) {
      Object.keys(d).forEach(function (id) {
        INFO[id] = d[id];
        var p = BYID[id];
        // OpenStreetMap's position for the venue is more exact than the one decoded from Google's id.
        if (p && typeof d[id].lat === "number" && typeof d[id].lng === "number") { p.lat = d[id].lat; p.lng = d[id].lng; }
      });
      if ($("bag").hidden && (view.city === city || view.city === WORLD)) refresh();
    });
  }
  // ---------- Follow whole lists in Google Maps ----------
  function followHtml(scope) {
    var cats = view.cats.length ? view.cats : sortedKeys(countBy(scope, function (p) { return p.category || ""; }));
    var have = cats.filter(function (c) { return LISTS[c]; });
    if (!have.length) return "";
    return '<div class="follow"><span class="follow-label">' + esc(t("followTitle")) + '</span><div class="follow-links">' + have.map(function (c) {
      return '<a class="chip follow-chip" href="' + esc(LISTS[c]) + '" target="_blank" rel="noopener"><span class="emo" aria-hidden="true">' + iconFor(c) + "</span>" + esc(I18N.cat(c)) + " ↗</a>";
    }).join("") + '</div><span class="fine">' + esc(t("followHelp")) + "</span></div>";
  }
  function cardHtml(p, withCity) {
    var pin = hasPin(p);
    var h = '<article class="place' + (p.id === view.sel ? " on" : "") + '" data-card="' + esc(p.id) + '"><div class="place-head"><h3>' +
      (isPick(p) ? '<span class="star" title="' + esc(t("topPick")) + '">★</span> ' : "") +
      (pin ? '<button type="button" class="pin-btn" data-pid="' + esc(p.id) + '">' + esc(p.title) + "</button>" : esc(p.title)) +
      "</h3>" + (p.category ? '<span class="tag"><span class="emo" aria-hidden="true">' + iconFor(p.category) + "</span>" + esc(I18N.cat(p.category)) + "</span>" : "") + "</div>";
    if (withCity) h += '<span class="nopin">' + esc(cityName(cityKey(p))) + "</span>";
    if (p.note) h += "<p>" + esc(p.note) + "</p>";
    if (!pin) h += '<span class="nopin">' + esc(t("noPin")) + "</span>";
    if (INFO[p.id]) h += aboutHtml(p);
    h += '<div class="place-foot"><div class="foot-actions">' + bagBtn(p.id) + shareBtn(p.id) + '</div><a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">' + t("openGM") + "</a></div></article>";
    return h;
  }
  function renderList() {
    var world = view.city === WORLD, l = "";
    if (world && !view.q.trim()) {
      var by = countBy(filtered, cityKey), keys = sortedKeys(by);
      l += '<div class="list-tools"><span class="eyebrow">' + esc(t("pickCity")) + "</span></div>";
      if (!keys.length) l += '<div class="empty">' + esc(t("nothingFilter")) + "</div>";
      else {
        l += '<div class="city-grid">';
        keys.forEach(function (k) {
          var inCity = filtered.filter(function (p) { return cityKey(p) === k; });
          var cb = countBy(inCity, function (p) { return p.category || ""; });
          var emos = sortedKeys(cb).slice(0, 5).map(iconFor).join(" ");
          l += '<button type="button" class="city-card" data-city="' + esc(k) + '"><span class="cc-name">' + esc(cityName(k)) + '</span><span class="cc-n">' + esc(t("placesN", { n: fmtNum(by[k]) })) + '</span><span class="cc-emo" aria-hidden="true">' + emos + "</span></button>";
        });
        l += "</div>";
      }
      l += '<p class="tip">' + esc(t("worldNote")) + "</p>";
      $("list").innerHTML = l;
      $("map-note").textContent = t("worldNote");
      bindList();
      return;
    }
    var items = filtered.slice();
    if (view.inView && !world && map && mapReady) {
      var b = map.getBounds();
      items = items.filter(function (p) { return hasPin(p) && b.contains([p.lng, p.lat]); });
    }
    sortList(items);
    var shown = world ? items.slice(0, 200) : items;
    l += '<div class="list-tools"><span class="eyebrow">' + esc(items.length === 1 ? t("showingOne") : t("showing", { n: fmtNum(items.length) })) + "</span>";
    if (!world) {
      l += '<label class="switch"><input type="checkbox" id="inview"' + (view.inView ? " checked" : "") + '><span class="track" aria-hidden="true"></span>' + esc(t("inView")) + "</label>";
      l += '<label class="sort"><span>' + esc(t("sort")) + '</span><select id="sort">' +
        [["list", "sortList"], ["az", "sortAZ"], ["center", "sortCenter"], ["picks", "sortPicks"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (view.sort === o[0] ? " selected" : "") + ">" + esc(t(o[1])) + "</option>";
        }).join("") + "</select></label>";
    }
    l += "</div>";
    if (!world) l += followHtml(DATA.places.filter(function (p) { return cityKey(p) === view.city; }));
    if (shown.length) {
      l += '<div class="list">' + shown.map(function (p) { return cardHtml(p, world); }).join("") + "</div>";
    } else {
      l += '<div class="empty">' + esc(view.inView && filtered.length ? t("nothingView") : view.q.trim() ? t("nothing", { q: view.q }) : t("nothingFilter")) + "</div>";
    }
    l += '<p class="tip">' + t("tip") + "</p>";
    $("list").innerHTML = l;
    $("map-note").textContent = t("mapNote");
    bindList();
  }

  function bindHead() {
    document.querySelectorAll("#head [data-city]").forEach(function (b) { b.addEventListener("click", function () { pickCity(b.getAttribute("data-city")); }); });
    var s = $("city-select"); if (s) s.addEventListener("change", function () { if (s.value) pickCity(s.value); });
    document.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = b.getAttribute("data-cat");
        if (c === "__all") { view.cats = []; view.picks = false; }
        else { var i = view.cats.indexOf(c); if (i === -1) view.cats.push(c); else view.cats.splice(i, 1); }
        clearSel(); remember(); renderViewer();
      });
    });
    var pk = document.querySelector("[data-picks]");
    if (pk) pk.addEventListener("click", function () { view.picks = !view.picks; clearSel(); renderViewer(); });
    $("q").addEventListener("input", function () { view.q = this.value; refresh(); });
  }
  function bindList() {
    document.querySelectorAll("#list [data-city]").forEach(function (b) { b.addEventListener("click", function () { pickCity(b.getAttribute("data-city")); }); });
    document.querySelectorAll("[data-pid]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = BYID[b.getAttribute("data-pid")];
        if (view.city === WORLD && p) { view.city = cityKey(p); view.cats = []; view.q = ""; remember(); renderViewer(); }
        select(b.getAttribute("data-pid"), true);
      });
    });
    var iv = $("inview"); if (iv) iv.addEventListener("change", function () { view.inView = iv.checked; store("pinned-inview", iv.checked ? "1" : "0"); renderList(); });
    var so = $("sort"); if (so) so.addEventListener("change", function () { view.sort = so.value; store("pinned-sort", so.value); renderList(); });
  }
  function pickCity(c) {
    view.city = c; view.cats = []; view.picks = false; view.q = ""; clearSel(); remember();
    if (!$("bag").hidden) showOnly("viewer");
    renderViewer();
    if (!desktop.matches && c !== WORLD) $("head").scrollIntoView({ block: "start" });
  }

  // ---------- Sharing a place ----------
  function shareBtn(id) { return '<button type="button" class="share-btn" data-share="' + esc(id) + '">' + esc(t("share")) + "</button>"; }
  function placeUrl(p) {
    var u = new URL(location.href.split("?")[0].split("#")[0]);
    u.searchParams.set("city", cityKey(p)); u.searchParams.set("place", p.id);
    return u.toString();
  }
  var toastTimer = null;
  function toast(html) {
    var el = $("toast"); el.innerHTML = html; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 4000);
  }
  function sharePlace(id) {
    var p = BYID[id]; if (!p) return;
    var url = placeUrl(p);
    if (navigator.share && !desktop.matches) { navigator.share({ title: p.title, url: url }).catch(function () {}); return; }
    var fail = function () { toast(esc(t("linkReady")) + ' <input class="toast-link" readonly value="' + esc(url) + '" onclick="this.select()">'); };
    try { navigator.clipboard.writeText(url).then(function () { toast(esc(t("linkCopied"))); }, fail); } catch (e) { fail(); }
  }

  // ---------- Basket (kept in this visitor's browser) ----------
  var basket = [], bagConfirmClear = false, bagStatus = "";
  function loadBasket() { try { basket = (JSON.parse(store("pinned-basket") || "[]") || []).filter(function (id) { return BYID[id]; }); } catch (e) { basket = []; } }
  function saveBasket() { store("pinned-basket", JSON.stringify(basket)); }
  function inBag(id) { return basket.indexOf(id) !== -1; }
  function bagBtn(id) {
    var on = inBag(id);
    return '<button type="button" class="bag-btn" data-bag="' + esc(id) + '" aria-pressed="' + on + '">' + esc(on ? t("added") : t("add")) + "</button>";
  }
  function toggleBag(id) {
    var i = basket.indexOf(id);
    if (i === -1) basket.push(id); else basket.splice(i, 1);
    saveBasket();
    document.querySelectorAll('[data-bag="' + id + '"]').forEach(function (b) {
      if (b.classList.contains("x")) return;
      var on = inBag(id); b.setAttribute("aria-pressed", on); b.textContent = on ? t("added") : t("add");
    });
    updateBagUI();
    if (!$("bag").hidden) renderBag();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bag]");
    if (b) { e.preventDefault(); toggleBag(b.getAttribute("data-bag")); return; }
    var s = e.target.closest && e.target.closest("[data-share]");
    if (s) { e.preventDefault(); sharePlace(s.getAttribute("data-share")); }
  });
  function updateBagUI() {
    var c = $("bag-count"); if (c) c.textContent = basket.length;
    var bar = $("bagbar"), show = basket.length > 0 && !$("viewer").hidden;
    bar.hidden = !show;
    if (show) {
      bar.innerHTML = '<div class="bagbar-in"><span>' + t("bagBar", { n: basket.length }) + '</span><button type="button" class="btn" id="bagbar-open">' + esc(t("viewBasket")) + "</button></div>";
      $("bagbar-open").addEventListener("click", openBag);
    }
  }
  function showOnly(id) {
    ["viewer", "bag"].forEach(function (k) { $(k).hidden = k !== id; });
    $("top").hidden = false;
    updateBagUI();
    window.scrollTo(0, 0);
  }
  function openBag() { bagConfirmClear = false; bagStatus = ""; showOnly("bag"); renderBag(); }
  function closeBag() { $("bag").innerHTML = ""; showOnly("viewer"); renderViewer(); if (map) setTimeout(function () { map.resize(); }, 0); }
  function bagPlaces() { return basket.map(function (id) { return BYID[id]; }).filter(Boolean); }

  // Walking order: nearest-neighbour from every start, then 2-opt on the best path.
  function pathLen(ps) { var s = 0; for (var i = 1; i < ps.length; i++) s += km(ps[i - 1].lat, ps[i - 1].lng, ps[i].lat, ps[i].lng); return s; }
  function walkOrder(ps) {
    if (ps.length < 3) return ps.slice();
    var best = null, bestLen = Infinity;
    ps.forEach(function (start) {
      var left = ps.filter(function (p) { return p !== start; }), path = [start];
      while (left.length) {
        var last = path[path.length - 1], bi = 0, bd = Infinity;
        left.forEach(function (p, i) { var d = km(last.lat, last.lng, p.lat, p.lng); if (d < bd) { bd = d; bi = i; } });
        path.push(left.splice(bi, 1)[0]);
      }
      var L = pathLen(path); if (L < bestLen) { bestLen = L; best = path; }
    });
    var improved = true, n = best.length;
    while (improved) {
      improved = false;
      for (var i = 0; i < n - 2; i++) for (var j = i + 2; j < n; j++) {
        var cand = best.slice(0, i + 1).concat(best.slice(i + 1, j + 1).reverse(), best.slice(j + 1));
        var cl = pathLen(cand); if (cl + 1e-9 < bestLen) { best = cand; bestLen = cl; improved = true; }
      }
    }
    return best;
  }
  var DETOUR = 1.3, WALK_KMH = 4.8;
  function walkMin(k) { return Math.max(1, Math.round(k * DETOUR / WALK_KMH * 60)); }
  function routeLinks(ps) {
    var q = function (p) { return encodeURIComponent((p.title.replace(/\s*\|\s*/g, " ") + (p.city ? ", " + p.city : "")).trim()); };
    var out = [];
    for (var i = 0; i < ps.length; i += 10) {
      var chunk = ps.slice(i, i + 10);
      var url = chunk.length === 1 ? mapsLink(chunk[0]) :
        "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" + q(chunk[0]) + "&destination=" + q(chunk[chunk.length - 1]) +
        (chunk.length > 2 ? "&waypoints=" + chunk.slice(1, -1).map(q).join("%7C") : "");
      out.push({ url: url, from: i + 1, to: i + chunk.length });
    }
    return out;
  }
  function renderBag() {
    renderTop();
    var ps = bagPlaces(), groups = {}, order = [];
    ps.forEach(function (p) { var c = cityKey(p); if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(p); });
    order.forEach(function (c) { groups[c] = walkOrder(groups[c].filter(hasPin)).concat(groups[c].filter(function (p) { return !hasPin(p); })); });
    var h = '<div class="topbar" style="width:100%;max-width:760px"><span class="eyebrow">' + esc(t("yourBasket")) + " · " + esc(t("placesN", { n: ps.length })) + '</span><button class="btn quiet" id="close-bag" type="button">' + esc(t("back")) + "</button></div>";
    h += '<section class="panel"><h2>' + esc(t("yourBasket")) + "</h2>";
    if (!ps.length) {
      h += '<div class="empty">' + t("bagEmpty") + "</div></section>";
    } else {
      order.forEach(function (c) {
        var g = groups[c], pinned = g.filter(hasPin);
        h += '<div class="bag-group"><h4><span>' + esc(cityName(c)) + "</span><span>" + g.length + "</span></h4>";
        if (pinned.length > 2) h += '<p class="walk-total">' + esc(t("walkTotal", { d: fmtKm(pathLen(pinned) * DETOUR) })) + "</p>";
        g.forEach(function (p, i) {
          var next = g[i + 1];
          h += '<div class="bag-row"><span class="t">' + (pinned.length > 2 && hasPin(p) ? '<span class="stop">' + (i + 1) + "</span>" : "") + esc(p.title) + '<span class="c">' + iconFor(p.category) + " " + esc(I18N.cat(p.category || "")) + '</span></span><a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">' + esc(t("saveLink")) + '</a><button type="button" class="x" data-bag="' + esc(p.id) + '" aria-label="' + esc(t("remove")) + " " + esc(p.title) + '">' + esc(t("remove")) + "</button></div>";
          if (next && hasPin(p) && hasPin(next) && pinned.length > 1) {
            var k = km(p.lat, p.lng, next.lat, next.lng);
            h += '<div class="leg">↓ ' + esc(t("walkLeg", { d: fmtKm(k * DETOUR), m: walkMin(k) })) + "</div>";
          }
        });
        h += "</div>";
      });
      h += '<p class="sub">' + esc(t("walkNote")) + "</p></section>";
      h += '<section class="panel"><h2>' + esc(t("putTitle")) + '</h2><ol class="how">';
      h += "<li><strong>" + esc(t("oneTitle")) + "</strong><p>" + t("oneBody") + "</p></li>";
      h += "<li><strong>" + esc(t("routeTitle")) + "</strong><p>" + t("routeBody") + "</p>";
      order.forEach(function (c) {
        var rl = routeLinks(groups[c]);
        h += '<div class="route-links">' + rl.map(function (r) {
          return '<a class="maps" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(t("routeLink", { city: cityName(c) }).replace(" ↗", "") + (rl.length > 1 ? t("stops", { a: r.from, b: r.to }) : "")) + " ↗</a>";
        }).join("") + "</div>";
      });
      h += "</li>";
      h += "<li><strong>" + esc(t("mmTitle")) + "</strong><p>" + t("mmBody", { link: '<a class="maps" href="https://www.google.com/maps/d/" target="_blank" rel="noopener">Google My Maps ↗</a>' }) + "</p></li></ol>";
      h += '<div class="actions"><button type="button" class="btn primary" id="bag-dl">' + esc(t("dl")) + '</button><button type="button" class="btn" id="bag-copy">' + esc(t("copy")) + "</button>" +
        '<button type="button" class="x' + (bagConfirmClear ? " confirm" : "") + '" id="bag-clear">' + esc(bagConfirmClear ? t("clearConfirm", { n: ps.length }) : t("clear")) + "</button></div>";
      h += '<div class="status" id="bag-status">' + esc(bagStatus) + '</div><div id="copy-fallback"></div></section>';
    }
    $("bag").innerHTML = '<div style="display:flex;flex-direction:column;gap:20px;align-items:center">' + h + "</div>";
    $("close-bag").addEventListener("click", closeBag);
    var dl = $("bag-dl"); if (dl) dl.addEventListener("click", downloadCSV);
    var cp = $("bag-copy"); if (cp) cp.addEventListener("click", copyList);
    var cl = $("bag-clear"); if (cl) cl.addEventListener("click", function () {
      if (!bagConfirmClear) { bagConfirmClear = true; renderBag(); return; }
      basket = []; saveBasket(); bagConfirmClear = false; updateBagUI(); renderBag();
    });
  }
  function setBagStatus(msg) { bagStatus = msg; var s = $("bag-status"); if (s) s.textContent = msg; }
  function copyList() {
    var text = bagPlaces().map(function (p) { return p.title + " (" + I18N.cat(p.category || "") + (p.city ? ", " + cityName(p.city) : "") + ")\n" + mapsLink(p); }).join("\n\n");
    function fallback() {
      $("copy-fallback").innerHTML = '<textarea class="copy-box" id="copy-box" readonly aria-label="' + esc(t("yourBasket")) + '"></textarea>';
      var box = $("copy-box"); box.value = text; box.focus(); box.select();
      setBagStatus(t("copyFail"));
    }
    try { navigator.clipboard.writeText(text).then(function () { setBagStatus(t("copied", { n: bagPlaces().length })); }, fallback); }
    catch (e) { fallback(); }
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCSV() {
    var ps = bagPlaces(), pinned = ps.filter(hasPin), skipped = ps.length - pinned.length;
    var rows = [["Name", "Latitude", "Longitude", "Category", "City", "Note", "Google Maps link"]];
    pinned.forEach(function (p) { rows.push([p.title, p.lat, p.lng, p.category || "", p.city || "", p.note || "", mapsLink(p)]); });
    var csv = "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "pinned-cities-basket.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setBagStatus(t("downloaded") + (skipped ? t("downloadedSkip", { n: skipped }) : ""));
  }

  // ---------- Start ----------
  $("head").innerHTML = '<div class="loading">' + esc(t("loading")) + "</div>";
  initMap();
  function getJSON(u, fallback) { return fetch(u, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : fallback; }).catch(function () { return fallback; }); }
  Promise.all([
    fetch("data/places.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
    getJSON("data/icons.json", {}),
    getJSON("data/picks.json", { picks: [] }),
    getJSON("data/info/index.json", {}),
    getJSON("data/lists.json", { lists: {} })
  ]).then(function (res) {
    DATA = res[0]; ICONS = res[1] || {}; INFO_FILES = res[3] || {}; LISTS = (res[4] && res[4].lists) || {};
    DATA.places.forEach(function (p) { BYID[p.id] = p; });
    // Top picks can be listed by id, by exact name, or as "Name | City".
    var want = {};
    ((res[2] && res[2].picks) || []).forEach(function (s) { want[String(s).trim().toLowerCase()] = 1; });
    DATA.places.forEach(function (p) {
      if (want[p.id.toLowerCase()] || want[p.title.toLowerCase()] || want[(p.title + " | " + (p.city || "")).toLowerCase()]) PICKS[p.id] = 1;
    });
    loadBasket();
    var target = startPlace && BYID[startPlace];
    if (target) { view.city = cityKey(target); view.cats = []; }
    renderViewer();
    if (target) whenMapReady(function () { select(target.id, true); });
  }).catch(function () {
    $("head").innerHTML = '<div class="empty">' + esc(t("loadFail")) + "</div>";
  });
})();
