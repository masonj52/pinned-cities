/* Pinned Cities: filters, map, list and basket. Everything runs in the visitor's browser. */
(function () {
  "use strict";
  var DATA = { places: [], updated: "" }, BYID = {};
  var $ = function (id) { return document.getElementById(id); };
  var view = { city: null, cat: "All", q: "", sel: null };
  var NO_CITY = "Other places";
  var desktop = window.matchMedia("(min-width: 960px)");
  var dark = window.matchMedia("(prefers-color-scheme: dark)");

  // Starting city/category: from the link first, then from this browser's last visit.
  var params = new URLSearchParams(location.search);
  if (params.get("city")) { view.city = params.get("city"); view.cat = params.get("cat") || "All"; }
  else { try { var saved = JSON.parse(localStorage.getItem("pinned-view") || "null"); if (saved) { view.city = saved.city; view.cat = saved.cat || "All"; } } catch (e) {} }
  function remember() {
    try { localStorage.setItem("pinned-view", JSON.stringify({ city: view.city, cat: view.cat })); } catch (e) {}
    try {
      var u = new URL(location.href);
      u.searchParams.set("city", view.city);
      if (view.cat !== "All") u.searchParams.set("cat", view.cat); else u.searchParams.delete("cat");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function countBy(list, fn) { var m = {}; list.forEach(function (p) { var k = fn(p); m[k] = (m[k] || 0) + 1; }); return m; }
  function sortedKeys(m) { return Object.keys(m).sort(function (a, b) { return (m[b] - m[a]) || a.localeCompare(b); }); }
  function cityOf(p) { return p.city || NO_CITY; }
  function hasPin(p) { return typeof p.lat === "number" && typeof p.lng === "number"; }
  function mapsLink(p) {
    if (p.url && /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(p.url)) return p.url;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.title + (p.city ? " " + p.city : ""));
  }
  function fmtDate(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return iso; } }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  // ---------- Map (MapLibre + OpenFreeMap, streets load on demand) ----------
  var map = null, mapReady = false, popup = null, lastFitKey = "", shownNow = [];
  function styleUrl() { return "https://tiles.openfreemap.org/styles/" + (dark.matches ? "dark" : "positron"); }
  function initMap() {
    if (!window.maplibregl) { $("map").innerHTML = '<div class="map-off">The map couldn\'t load right now. Every place still has its Google Maps link.</div>'; return; }
    try {
      map = new maplibregl.Map({ container: "map", style: styleUrl(), center: [10, 25], zoom: 1.3, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    } catch (e) {
      map = null;
      $("map").innerHTML = '<div class="map-off">This browser can\'t draw the map. Every place still has its Google Maps link.</div>';
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
    map.on("style.load", addPins);
    map.on("click", "pins", function (e) { if (e.features && e.features[0]) select(e.features[0].properties.id, false); });
    map.on("mouseenter", "pins", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "pins", function () { map.getCanvas().style.cursor = ""; });
    dark.addEventListener("change", function () { mapReady = false; map.setStyle(styleUrl()); });
  }
  function geo() {
    return { type: "FeatureCollection", features: shownNow.filter(hasPin).map(function (p) {
      return { type: "Feature", properties: { id: p.id, sel: p.id === view.sel ? 1 : 0 }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } };
    }) };
  }
  function addPins() {
    if (map.getSource("places")) { mapReady = true; return; }
    map.addSource("places", { type: "geojson", data: geo() });
    map.addLayer({ id: "pins", type: "circle", source: "places", layout: { "circle-sort-key": ["get", "sel"] }, paint: {
      "circle-radius": ["case", ["==", ["get", "sel"], 1], 9, 6],
      "circle-color": ["case", ["==", ["get", "sel"], 1], cssVar("--ink"), cssVar("--accent")],
      "circle-stroke-color": cssVar("--surface"), "circle-stroke-width": 2
    } });
    mapReady = true;
  }
  function refreshPins() { if (map && mapReady && map.getSource("places")) map.getSource("places").setData(geo()); }
  function popupHtml(p) {
    return '<div class="pop"><span class="k">' + esc(p.category || "") + "</span><h4>" + esc(p.title) + "</h4>" + (p.note ? "<p>" + esc(p.note) + "</p>" : "") +
      '<a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">Open in Google Maps ↗</a>' + bagBtn(p.id) + "</div>";
  }
  function updatePins(shown) {
    shownNow = shown;
    refreshPins();
    var pts = shown.filter(hasPin);
    var key = view.city + "|" + view.cat;
    if (map && key !== lastFitKey) {
      var first = lastFitKey === "";
      lastFitKey = key;
      if (pts.length === 1) map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 });
      else if (pts.length) {
        var b = new maplibregl.LngLatBounds();
        pts.forEach(function (p) { b.extend([p.lng, p.lat]); });
        map.fitBounds(b, { padding: 40, maxZoom: 15, duration: first ? 0 : 700 });
      }
    }
    $("map-note").textContent = "Pins are close to the real spot. Open a place in Google Maps for the exact door.";
  }
  function select(id, fly) {
    var p = BYID[id];
    view.sel = id; refreshPins(); markCards();
    if (!p || !map || !hasPin(p)) return;
    if (fly) {
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
      if (!desktop.matches) $("map").scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (desktop.matches) {
      var card = document.querySelector('[data-card="' + id + '"]'); if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    var old = popup; popup = null; if (old) old.remove();
    var pp = new maplibregl.Popup({ offset: 12, maxWidth: "260px", focusAfterOpen: false }).setLngLat([p.lng, p.lat]).setHTML(popupHtml(p)).addTo(map);
    pp.on("close", function () { if (popup === pp) { popup = null; view.sel = null; refreshPins(); markCards(); } });
    popup = pp;
  }
  function markCards() { document.querySelectorAll("[data-card]").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-card") === view.sel); }); }

  // ---------- List ----------
  function renderViewer() {
    var places = DATA.places;
    var byCity = countBy(places, cityOf);
    var cities = sortedKeys(byCity);
    if (!view.city || !byCity[view.city]) view.city = cities[0] || null;
    var inCity = places.filter(function (p) { return cityOf(p) === view.city; });
    var byCat = countBy(inCity, function (p) { return p.category || ""; });
    var cats = sortedKeys(byCat);
    if (view.cat !== "All" && !byCat[view.cat]) view.cat = "All";
    var q = view.q.trim().toLowerCase();
    var shown = inCity.filter(function (p) {
      if (view.cat !== "All" && p.category !== view.cat) return false;
      if (!q) return true;
      return (p.title + " " + (p.note || "") + " " + (p.category || "")).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (a.category || "").localeCompare(b.category || "") || a.title.localeCompare(b.title); });

    $("top").innerHTML = '<div class="topbar"><span class="eyebrow">' + places.length + " saved places · " + cities.length + (cities.length === 1 ? " city" : " cities") +
      '</span><div class="top-actions"><button class="btn" id="open-bag" type="button">Basket<span class="count-pill" id="bag-count">' + basket.length + "</span></button></div></div>";
    $("open-bag").addEventListener("click", openBag);
    updateBagUI();

    if (!cities.length) { $("head").innerHTML = '<div class="empty">No places yet.</div>'; $("list").innerHTML = ""; updatePins([]); return; }

    var h = '<section class="hero"><h1 class="city-name">' + esc(view.city) + '</h1><div class="hero-meta">' + inCity.length + " saved here · updated " + esc(fmtDate(DATA.updated)) + "</div></section>";
    var top = cities.slice(0, 8);
    if (top.indexOf(view.city) === -1) top.push(view.city);
    h += '<div><div class="rail-label"><span>City</span>';
    if (cities.length > 8) {
      h += '<select class="city-select" id="city-select" aria-label="All cities"><option value="">All ' + cities.length + " cities…</option>";
      cities.slice().sort().forEach(function (c) { h += '<option value="' + esc(c) + '"' + (c === view.city ? " selected" : "") + ">" + esc(c) + " (" + byCity[c] + ")</option>"; });
      h += "</select>";
    }
    h += '</div><div class="rail" role="group" aria-label="City">';
    top.forEach(function (c) { h += '<button type="button" class="chip" data-city="' + esc(c) + '" aria-pressed="' + (c === view.city) + '">' + esc(c) + '<span class="n">' + byCity[c] + "</span></button>"; });
    h += "</div></div>";
    h += '<div><div class="rail-label"><span>Category</span></div><div class="rail" role="group" aria-label="Category">';
    h += '<button type="button" class="chip" data-cat="All" aria-pressed="' + (view.cat === "All") + '">All<span class="n">' + inCity.length + "</span></button>";
    cats.forEach(function (c) { h += '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === view.cat) + '">' + esc(c || "Uncategorized") + '<span class="n">' + byCat[c] + "</span></button>"; });
    h += "</div></div>";
    h += '<input class="search" id="q" type="search" placeholder="Search ' + esc(view.city) + '" value="' + esc(view.q) + '" aria-label="Search places">';
    $("head").innerHTML = h;

    var l = "";
    if (shown.length) {
      l += '<div class="list">';
      shown.forEach(function (p) {
        var pin = hasPin(p);
        l += '<article class="place' + (p.id === view.sel ? " on" : "") + '" data-card="' + esc(p.id) + '"><div class="place-head"><h3>' +
          (pin ? '<button type="button" class="pin-btn" data-pid="' + esc(p.id) + '" title="Show on map">' + esc(p.title) + "</button>" : esc(p.title)) +
          "</h3>" + (p.category ? '<span class="tag">' + esc(p.category) + "</span>" : "") + "</div>";
        if (p.note) l += "<p>" + esc(p.note) + "</p>";
        if (!pin) l += '<span class="nopin">No pin on the map</span>';
        l += '<div class="place-foot">' + bagBtn(p.id) + '<a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">Open in Google Maps ↗</a></div></article>';
      });
      l += "</div>";
    } else {
      l += '<div class="empty">Nothing matches “' + esc(view.q) + "” here.</div>";
    }
    l += '<p class="tip">Tap a name to find it on the map. In Google Maps, tap <strong>Save</strong> to add a place to your own lists.</p>';
    $("list").innerHTML = l;
    document.querySelectorAll('.rail .chip[aria-pressed="true"]').forEach(function (c) {
      var rail = c.parentNode, left = c.offsetLeft - rail.offsetLeft;
      if (left < rail.scrollLeft || left + c.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = Math.max(0, left - 16);
    });
    bindViewer();
    updatePins(shown);
  }
  function bindViewer() {
    document.querySelectorAll("[data-city]").forEach(function (b) { b.addEventListener("click", function () { pickCity(b.getAttribute("data-city")); }); });
    var s = $("city-select"); if (s) s.addEventListener("change", function () { if (s.value) pickCity(s.value); });
    document.querySelectorAll("[data-cat]").forEach(function (b) { b.addEventListener("click", function () { view.cat = b.getAttribute("data-cat"); clearSel(); remember(); renderViewer(); }); });
    document.querySelectorAll("[data-pid]").forEach(function (b) { b.addEventListener("click", function () { select(b.getAttribute("data-pid"), true); }); });
    var q = $("q");
    if (q) q.addEventListener("input", function () {
      view.q = q.value; var pos = q.selectionStart; renderViewer();
      var q2 = $("q"); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} }
    });
  }
  function clearSel() { view.sel = null; var old = popup; popup = null; if (old) old.remove(); }
  function pickCity(c) { view.city = c; view.cat = "All"; view.q = ""; clearSel(); remember(); renderViewer(); }

  // ---------- Basket (kept in this visitor's browser) ----------
  var basket = [], bagConfirmClear = false, bagStatus = "";
  function loadBasket() { try { basket = (JSON.parse(localStorage.getItem("pinned-basket") || "[]") || []).filter(function (id) { return BYID[id]; }); } catch (e) { basket = []; } }
  function saveBasket() { try { localStorage.setItem("pinned-basket", JSON.stringify(basket)); } catch (e) {} }
  function inBag(id) { return basket.indexOf(id) !== -1; }
  function bagBtn(id) {
    var on = inBag(id);
    return '<button type="button" class="bag-btn" data-bag="' + esc(id) + '" aria-pressed="' + on + '">' + (on ? "✓ In basket" : "+ Basket") + "</button>";
  }
  function toggleBag(id) {
    var i = basket.indexOf(id);
    if (i === -1) basket.push(id); else basket.splice(i, 1);
    saveBasket();
    document.querySelectorAll('[data-bag="' + id + '"]').forEach(function (b) {
      var on = inBag(id); b.setAttribute("aria-pressed", on); b.textContent = on ? "✓ In basket" : "+ Basket";
    });
    updateBagUI();
    if (!$("bag").hidden) renderBag();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bag]");
    if (b) { e.preventDefault(); toggleBag(b.getAttribute("data-bag")); }
  });
  function updateBagUI() {
    var c = $("bag-count"); if (c) c.textContent = basket.length;
    var bar = $("bagbar"), show = basket.length > 0 && !$("viewer").hidden;
    bar.hidden = !show;
    if (show) {
      bar.innerHTML = '<div class="bagbar-in"><span><strong>' + basket.length + (basket.length === 1 ? " place" : " places") + "</strong> in your basket</span>" +
        '<button type="button" class="btn" id="bagbar-open">View basket</button></div>';
      $("bagbar-open").addEventListener("click", openBag);
    }
  }
  function showOnly(id) {
    ["viewer", "bag"].forEach(function (k) { $(k).hidden = k !== id; });
    $("top").hidden = id !== "viewer";
    updateBagUI();
    window.scrollTo(0, 0);
  }
  function openBag() { bagConfirmClear = false; bagStatus = ""; showOnly("bag"); renderBag(); }
  function closeBag() { $("bag").innerHTML = ""; showOnly("viewer"); renderViewer(); if (map) setTimeout(function () { map.resize(); }, 0); }
  function bagPlaces() { return basket.map(function (id) { return BYID[id]; }).filter(Boolean); }
  function routeLinks(ps) {
    var q = function (p) { return encodeURIComponent((p.title.replace(/\s*\|\s*/g, " ") + (p.city ? ", " + p.city : "")).trim()); };
    var out = [];
    for (var i = 0; i < ps.length; i += 10) {
      var chunk = ps.slice(i, i + 10);
      var url = chunk.length === 1 ? mapsLink(chunk[0]) :
        "https://www.google.com/maps/dir/?api=1&origin=" + q(chunk[0]) + "&destination=" + q(chunk[chunk.length - 1]) +
        (chunk.length > 2 ? "&waypoints=" + chunk.slice(1, -1).map(q).join("%7C") : "");
      out.push({ url: url, from: i + 1, to: i + chunk.length });
    }
    return out;
  }
  function renderBag() {
    var ps = bagPlaces(), groups = {}, order = [];
    ps.forEach(function (p) { var c = cityOf(p); if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(p); });
    var h = '<div class="topbar" style="width:100%;max-width:760px"><span class="eyebrow">Your basket · ' + ps.length + (ps.length === 1 ? " place" : " places") + '</span><button class="btn quiet" id="close-bag" type="button">Back to guide</button></div>';
    h += '<section class="panel"><h2>Your basket</h2>';
    if (!ps.length) {
      h += '<div class="empty">Your basket is empty. Tap <strong>+ Basket</strong> on any place to add it.</div></section>';
    } else {
      order.forEach(function (c) {
        h += '<div class="bag-group"><h4><span>' + esc(c) + "</span><span>" + groups[c].length + "</span></h4>";
        groups[c].forEach(function (p) {
          h += '<div class="bag-row"><span class="t">' + esc(p.title) + '<span class="c">' + esc(p.category || "") + '</span></span><a class="maps" href="' + esc(mapsLink(p)) + '" target="_blank" rel="noopener">Save ↗</a><button type="button" class="x" data-bag="' + esc(p.id) + '" aria-label="Remove ' + esc(p.title) + '">Remove</button></div>';
        });
        h += "</div>";
      });
      h += "</section>";
      h += '<section class="panel"><h2>Put them in your Google Maps</h2><ol class="how">';
      h += "<li><strong>One by one</strong><p>Tap <strong>Save ↗</strong> next to a place. In Google Maps, tap Save and pick a list. Best for a handful of places.</p></li>";
      h += "<li><strong>As a route</strong><p>Opens the places as stops on one Google Maps route, up to 10 per link. Stops are found by name, so check them.</p>";
      order.forEach(function (c) {
        var rl = routeLinks(groups[c]);
        h += '<div class="route-links">' + rl.map(function (r) {
          return '<a class="maps" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(c) + (rl.length > 1 ? " · stops " + r.from + "–" + r.to : "") + " route ↗</a>";
        }).join("") + "</div>";
      });
      h += "</li>";
      h += '<li><strong>All at once with Google My Maps</strong><p>Download the basket as a file, then go to <a class="maps" href="https://www.google.com/maps/d/" target="_blank" rel="noopener">Google My Maps ↗</a>, create a new map, choose <strong>Import</strong> and pick the file. Use Latitude and Longitude for the position and Name for the title. The map then shows in the Google Maps app under <strong>Saved › Maps</strong>.</p></li></ol>';
      h += '<div class="actions"><button type="button" class="btn primary" id="bag-dl">Download for My Maps (.csv)</button><button type="button" class="btn" id="bag-copy">Copy list</button>' +
        '<button type="button" class="x' + (bagConfirmClear ? " confirm" : "") + '" id="bag-clear">' + (bagConfirmClear ? "Clear all " + ps.length + "?" : "Clear basket") + "</button></div>";
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
    var text = bagPlaces().map(function (p) { return p.title + " (" + (p.category || "") + (p.city ? ", " + p.city : "") + ")\n" + mapsLink(p); }).join("\n\n");
    function fallback() {
      $("copy-fallback").innerHTML = '<textarea class="copy-box" id="copy-box" readonly aria-label="Basket list"></textarea>';
      var box = $("copy-box"); box.value = text; box.focus(); box.select();
      setBagStatus("Couldn't copy automatically. The list is selected below, so copy it yourself.");
    }
    try { navigator.clipboard.writeText(text).then(function () { setBagStatus("Copied " + bagPlaces().length + " places with their Google Maps links."); }, fallback); }
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
    setBagStatus("Downloaded. Import it in Google My Maps." + (skipped ? " " + skipped + " place without a pin was left out." : ""));
  }

  // ---------- Start ----------
  initMap();
  fetch("data/places.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    DATA = d; DATA.places.forEach(function (p) { BYID[p.id] = p; });
    loadBasket(); renderViewer();
  }).catch(function () {
    $("head").innerHTML = '<div class="empty">The places couldn\'t load. Refresh the page to try again.</div>';
  });
})();
