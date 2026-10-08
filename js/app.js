// app.js - the planner page (map, list of places, result)

var OSRM = "https://router.project-osrm.org";
var NOMINATIM = "https://nominatim.openstreetmap.org";
var MAX_PLACES = 25;

var stops = [];           // {name, lat, lon}  - stops[0] is the start
var markers = [];
var lastRoute = null;     // the order found last time, null if the list changed after that

var map = L.map("map").setView([12.955, 77.60], 12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
var routeLayer = L.layerGroup().addTo(map);

map.on("click", function (e) {
  var lat = e.latlng.lat, lon = e.latlng.lng;
  var stop = addStop(lat, lon, "Pinned place (" + lat.toFixed(4) + ", " + lon.toFixed(4) + ")");
  if (!stop) return;
  // try to get a proper name for the clicked point
  fetch(NOMINATIM + "/reverse?format=json&zoom=17&lat=" + lat + "&lon=" + lon)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.display_name) {
        stop.name = shortName(data.display_name);
        showStops();
      }
    })
    .catch(function () { /* no internet, keep the "Pinned place" name */ });
});


// ---------- list of places ----------

// "Lalbagh Main Gate, Krumbiegal Road, Mavalli, Bengaluru, ..." -> "Lalbagh Main Gate, Krumbiegal Road"
function shortName(displayName) {
  return displayName.split(",").slice(0, 2).join(",").trim();
}

function addStop(lat, lon, name) {
  if (stops.length >= MAX_PLACES) {
    showMessage("This planner takes up to " + MAX_PLACES + " places.", "warning");
    return null;
  }
  var stop = { name: name, lat: lat, lon: lon };
  stops.push(stop);
  listChanged();
  return stop;
}

function listChanged() {
  lastRoute = null;
  routeLayer.clearLayers();
  document.getElementById("result").innerHTML = "";
  showMessage("");
  showStops();
}

// draws the list on the left and the numbered pins on the map.
// order = the visiting order to number the pins with (if a route was found)
function showStops(order) {
  var list = document.getElementById("stopList");
  list.innerHTML = "";
  stops.forEach(function (s, i) {
    var li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-start";
    li.innerHTML = '<div class="ms-2 me-auto">' + s.name +
      (i === 0 ? ' <span class="badge bg-success">Start</span>' : "") + "</div>" +
      '<button class="remove" title="Remove">&times;</button>';
    li.querySelector(".remove").onclick = function () {
      stops.splice(i, 1);
      listChanged();
    };
    list.appendChild(li);
  });
  document.getElementById("count").textContent = stops.length ? "(" + stops.length + ")" : "";

  markers.forEach(function (m) { map.removeLayer(m); });
  markers = [];
  stops.forEach(function (s, i) {
    var label = i === 0 ? "S" : String(order ? order.indexOf(i) : i);
    var m = L.marker([s.lat, s.lon], {
      icon: L.divIcon({ className: "pin" + (i === 0 ? " start" : ""), html: label, iconSize: [26, 26] })
    }).bindTooltip(s.name).addTo(map);
    markers.push(m);
  });
}

function showMessage(text, kind) {
  document.getElementById("message").innerHTML =
    text ? '<div class="alert alert-' + (kind || "info") + ' py-2">' + text + "</div>" : "";
}


// ---------- search box ----------

function search() {
  var q = document.getElementById("searchBox").value.trim();
  var box = document.getElementById("searchResults");
  if (!q) return;
  box.innerHTML = '<div class="list-group-item text-muted">Searching...</div>';

  // places inside the part of the map you are looking at come first
  var b = map.getBounds();
  var url = NOMINATIM + "/search?format=json&limit=5&q=" + encodeURIComponent(q) +
    "&viewbox=" + b.getWest() + "," + b.getNorth() + "," + b.getEast() + "," + b.getSouth();

  fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (places) {
      box.innerHTML = "";
      if (places.length === 0) {
        box.innerHTML = '<div class="list-group-item text-muted">Nothing found. Try adding the city name.</div>';
        return;
      }
      places.forEach(function (p) {
        var item = document.createElement("a");
        item.className = "list-group-item list-group-item-action";
        item.textContent = p.display_name;
        item.onclick = function () {
          addStop(Number(p.lat), Number(p.lon), shortName(p.display_name));
          map.setView([p.lat, p.lon], Math.max(map.getZoom(), 13));
          box.innerHTML = "";
          document.getElementById("searchBox").value = "";
        };
        box.appendChild(item);
      });
    })
    .catch(function () {
      box.innerHTML = '<div class="list-group-item text-danger">Search is not working (no internet?). Click on the map instead.</div>';
    });
}

document.getElementById("searchBtn").onclick = search;
document.getElementById("searchBox").onkeydown = function (e) { if (e.key === "Enter") search(); };


// ---------- distance table ----------

// Gives back (through done) the distance table in km and the time table in minutes.
// With "real road distances" ticked it asks OSRM for the whole table in one request.
// If that does not work it falls back to straight line distances (times = null).
function getTables(done) {
  if (!document.getElementById("useRoads").checked) {
    done(straightTable(stops), null, false);
    return;
  }
  var coords = stops.map(function (s) { return s.lon + "," + s.lat; }).join(";");
  fetch(OSRM + "/table/v1/driving/" + coords + "?annotations=distance,duration")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.code !== "Ok") throw new Error(data.code);
      var D = [], T = [];
      for (var i = 0; i < stops.length; i++) {
        D.push([]); T.push([]);
        for (var j = 0; j < stops.length; j++) {
          if (data.distances[i][j] === null) throw new Error("no road between two of the places");
          D[i].push(data.distances[i][j] / 1000);     // metres to km
          T[i].push(data.durations[i][j] / 60);       // seconds to minutes
        }
      }
      done(D, T, true);
    })
    .catch(function () {
      showMessage("Could not get road distances, so straight line distances were used.", "warning");
      done(straightTable(stops), null, false);
    });
}


// ---------- find the best order ----------

function findBest() {
  if (stops.length < 3) {
    showMessage("Add the start and at least two places to visit.", "warning");
    return;
  }
  showMessage("Working...", "info");
  var roundTrip = document.getElementById("roundTrip").checked;

  getTables(function (D, T, byRoad) {
    if (byRoad || !document.getElementById("useRoads").checked) showMessage("");

    var t0 = performance.now();
    var S = makeSymmetric(D);
    var found = bestRoute(S, roundTrip);
    var ms = performance.now() - t0;

    var route = found.route;
    // A round trip can be driven in either direction. In the averaged table both are equal,
    // so I check the real one-way distances and take the shorter direction.
    if (roundTrip) {
      var backwards = [0].concat(route.slice(1).reverse());
      if (routeLength(D, backwards, true) < routeLength(D, route, true)) route = backwards;
    }

    var yourOrder = stops.map(function (s, i) { return i; });
    showResult(route, yourOrder, D, T, roundTrip, byRoad, found, ms);
    drawRoute(route, roundTrip, byRoad, "#0d6efd");
    showStops(route);
    lastRoute = route;

    // link under the result that switches the map between my order (red) and the shortest order (blue)
    var link = document.getElementById("compareLink");
    if (link) {
      var showingMine = false;
      link.onclick = function (e) {
        e.preventDefault();
        showingMine = !showingMine;
        drawRoute(showingMine ? yourOrder : route, roundTrip, byRoad, showingMine ? "#dc3545" : "#0d6efd");
        showStops(showingMine ? yourOrder : route);
        link.textContent = showingMine ? "Show the shortest order on the map" : "Show the order I added on the map";
      };
      if (location.search.indexOf("mine") !== -1) link.click();
    }
  });
}

function minutesText(m) {
  m = Math.round(m);
  if (m < 60) return m + " min";
  return Math.floor(m / 60) + " hr " + (m % 60) + " min";
}

function showResult(route, yourOrder, D, T, roundTrip, byRoad, found, ms) {
  var best = routeLength(D, route, roundTrip);
  var yours = routeLength(D, yourOrder, roundTrip);
  var saved = yours - best;
  var html = "";

  html += '<div class="alert alert-success"><div class="saving"><b>Shortest order: ' + best.toFixed(1) + " km</b>" +
    (T ? " (about " + minutesText(routeLength(T, route, roundTrip)) + " driving)" : "") + "</div>";
  if (saved > 0.05) {
    html += "In the order you added them it is " + yours.toFixed(1) + " km. You save <b>" +
      saved.toFixed(1) + " km (" + Math.round(saved / yours * 100) + "%)</b>.";
  } else {
    html += "The order you added them in is already the shortest.";
  }
  html += (byRoad ? "" : " <i>Straight line distances.</i>") + "</div>";

  html += '<table class="table table-sm table-bordered"><tr><th>#</th><th>Go to</th><th class="num">km</th>' +
    (T ? '<th class="num">min</th>' : "") + "</tr>";
  html += "<tr><td>S</td><td>" + stops[0].name + "</td><td></td>" + (T ? "<td></td>" : "") + "</tr>";
  for (var i = 1; i < route.length; i++) {
    var a = route[i - 1], b = route[i];
    html += "<tr><td>" + i + "</td><td>" + stops[b].name + '</td><td class="num">' + D[a][b].toFixed(1) + "</td>" +
      (T ? '<td class="num">' + Math.round(T[a][b]) + "</td>" : "") + "</tr>";
  }
  if (roundTrip) {
    var last = route[route.length - 1];
    html += "<tr><td></td><td>Back to " + stops[0].name + '</td><td class="num">' + D[last][0].toFixed(1) + "</td>" +
      (T ? '<td class="num">' + Math.round(T[last][0]) + "</td>" : "") + "</tr>";
  }
  html += "</table>";

  // link that opens the same order in Google Maps (it accepts about 10 places in one link)
  var points = route.map(function (r) { return stops[r].lat + "," + stops[r].lon; });
  if (roundTrip) points.push(points[0]);
  if (points.length <= 10) {
    html += '<a class="btn btn-success btn-sm" target="_blank" href="https://www.google.com/maps/dir/' +
      points.join("/") + '">Open this route in Google Maps</a>';
  }
  if (saved > 0.05) {
    html += ' <a href="#" id="compareLink" class="small ms-1">Show the order I added on the map</a>';
  }

  var n = stops.length - 1;
  var all = factorial(n);
  var allText = all < 1e15 ? all.toLocaleString() : all.toExponential(1);
  if (found.method === "exact") {
    html += '<p class="how mt-2">How: ' + n + " stops can be visited in " + allText + " different orders. " +
      "The search with pruning only had to finish " + found.checked.toLocaleString() +
      " of them to be sure this is the best one. Took " + ms.toFixed(1) + " ms.</p>";
  } else {
    html += '<p class="how mt-2">How: ' + n + " stops can be visited in about " + allText + " different orders, too many to try. " +
      "Used nearest neighbour and then 2-opt (" + found.passes + " passes). Took " + ms.toFixed(1) +
      " ms. This is a very good route but not guaranteed to be the perfect one.</p>";
  }
  document.getElementById("result").innerHTML = html;
}

// draws the route on the map: along the roads if OSRM answers, straight lines otherwise
var drawNumber = 0;

function drawRoute(route, roundTrip, byRoad, colour) {
  routeLayer.clearLayers();
  // OSRM answers a little later. If drawRoute is called again before that,
  // the old answer must not be drawn on top of the new route.
  drawNumber++;
  var thisDraw = drawNumber;

  var pts = route.map(function (r) { return [stops[r].lat, stops[r].lon]; });
  if (roundTrip) pts.push(pts[0]);

  function straight() {
    var line = L.polyline(pts, { color: colour, weight: 4, dashArray: byRoad ? null : "8 8" }).addTo(routeLayer);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }
  if (!byRoad) { straight(); return; }

  var coords = pts.map(function (p) { return p[1] + "," + p[0]; }).join(";");
  fetch(OSRM + "/route/v1/driving/" + coords + "?overview=full&geometries=geojson")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (thisDraw !== drawNumber) return;
      var shape = data.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      var line = L.polyline(shape, { color: colour, weight: 5, opacity: 0.8 }).addTo(routeLayer);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
    })
    .catch(function () {
      if (thisDraw === drawNumber) straight();
    });
}


// ---------- buttons ----------

document.getElementById("goBtn").onclick = findBest;

document.getElementById("clearBtn").onclick = function () {
  stops = [];
  listChanged();
};

document.getElementById("roundTrip").onchange = function () { if (lastRoute) findBest(); };
document.getElementById("useRoads").onchange = function () { if (lastRoute) findBest(); };

// a day of errands in Bengaluru, added in a deliberately bad order
var EXAMPLE = [
  ["Dairy Circle", 12.93989, 77.60233],
  ["Indiranagar", 12.97807, 77.63881],
  ["Jayanagar 4th Block", 12.92982, 77.58428],
  ["Majestic Bus Stand", 12.97791, 77.57239],
  ["HSR Layout BDA Complex", 12.91374, 77.63746],
  ["MG Road", 12.97553, 77.60679],
  ["KR Market", 12.96090, 77.57464],
  ["Koramangala (Sony Signal)", 12.93723, 77.62681],
  ["Lalbagh Main Gate", 12.95415, 77.58468]
];

function loadExample() {
  stops = EXAMPLE.map(function (e) { return { name: e[0], lat: e[1], lon: e[2] }; });
  listChanged();
  map.fitBounds(stops.map(function (s) { return [s.lat, s.lon]; }), { padding: [30, 30] });
}

document.getElementById("exampleBtn").onclick = function (e) {
  e.preventDefault();
  loadExample();
};

showStops();

// index.html?example       opens the page with the example already solved
// index.html?example=mine  same, but showing the order I added (I use these two for screenshots)
if (location.search.indexOf("example") !== -1) {
  loadExample();
  findBest();
}
