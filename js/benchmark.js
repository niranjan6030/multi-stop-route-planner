// benchmark.js - the experiments for the performance analysis
// Open benchmark.html and press the button, or run   node js/benchmark.js

if (typeof module !== "undefined") {
  var tsp = require("./tsp.js");
  for (var key in tsp) global[key] = tsp[key];
}

function makeRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// distance table for n random places in a 20 km x 20 km square
function randomTable(n, random) {
  var pts = [];
  for (var i = 0; i < n; i++) pts.push([random() * 20, random() * 20]);
  var D = [];
  for (var a = 0; a < n; a++) {
    D.push([]);
    for (var b = 0; b < n; b++) {
      D[a].push(Math.sqrt(Math.pow(pts[a][0] - pts[b][0], 2) + Math.pow(pts[a][1] - pts[b][1], 2)));
    }
  }
  return D;
}

// runs fn again and again for at least 20 ms and returns the average time of one run in ms.
// (one run of a fast function is too short for the browser clock to measure)
function timeIt(fn) {
  var runs = 0;
  var t0 = performance.now();
  var t1 = t0;
  while (t1 - t0 < 20) {
    fn();
    runs++;
    t1 = performance.now();
  }
  return (t1 - t0) / runs;
}

function timeOnce(fn) {
  var t0 = performance.now();
  fn();
  return performance.now() - t0;
}

// Experiment 1: small numbers of stops. Time of every method and how far the quick methods
// are from the exact best. Each row is the average over SETS random sets of places.
function experimentSmall() {
  var SETS = 20;
  var rows = [];
  for (var stops = 4; stops <= 12; stops++) {
    var random = makeRandom(100 + stops);
    var tBrute = 0, tPruned = 0, tNN = 0, tTwo = 0, gapNN = 0, gapTwo = 0, checked = 0;
    // quick runs are repeated to get a steady number, slow ones are run once
    var measure = stops <= 8 ? timeIt : timeOnce;

    for (var s = 0; s < SETS; s++) {
      var D = randomTable(stops + 1, random);

      tNN += timeIt(function () { nearestNeighbour(D); });
      tTwo += timeIt(function () { twoOpt(D, nearestNeighbour(D), true); });
      var nn = nearestNeighbour(D);
      var two = twoOpt(D, nn, true).route;

      // plain brute force gets too slow after 10 stops (11! is about 40 million orders)
      if (stops <= 10) tBrute += measure(function () { tryEveryOrder(D, true, false); });

      var exact = tryEveryOrder(D, true, true, two);
      tPruned += measure(function () { tryEveryOrder(D, true, true, two); });
      checked += exact.checked;

      gapNN += (routeLength(D, nn, true) / exact.length - 1) * 100;
      gapTwo += (routeLength(D, two, true) / exact.length - 1) * 100;
    }

    rows.push({
      stops: stops,
      orders: factorial(stops),
      brute: stops <= 10 ? tBrute / SETS : null,
      pruned: tPruned / SETS,
      checked: checked / SETS,
      nn: tNN / SETS,
      two: tTwo / SETS,
      gapNN: gapNN / SETS,
      gapTwo: gapTwo / SETS
    });
  }
  return rows;
}

// Experiment 2: many stops. Only the quick methods can do this.
function experimentLarge() {
  var SETS = 5;
  var rows = [];
  var sizes = [25, 50, 100, 200, 400, 800];
  for (var k = 0; k < sizes.length; k++) {
    var n = sizes[k];
    var random = makeRandom(500 + n);
    var tNN = 0, tTwo = 0, lenNN = 0, lenTwo = 0, passes = 0;
    for (var s = 0; s < SETS; s++) {
      var D = randomTable(n + 1, random);
      tNN += timeIt(function () { nearestNeighbour(D); });
      var nn = nearestNeighbour(D);
      var two = twoOpt(D, nn, true);
      tTwo += timeIt(function () { twoOpt(D, nn, true); });
      passes += two.passes;
      lenNN += routeLength(D, nn, true);
      lenTwo += routeLength(D, two.route, true);
    }
    rows.push({
      stops: n,
      nn: tNN / SETS,
      two: tTwo / SETS,
      passes: passes / SETS,
      lenNN: lenNN / SETS,
      lenTwo: lenTwo / SETS,
      shorter: (1 - lenTwo / lenNN) * 100,
      tableNumbers: (n + 1) * (n + 1)
    });
  }
  return rows;
}

function ms(x) {
  if (x === null) return "-";
  if (x < 0.01) return x.toFixed(4);
  if (x < 1) return x.toFixed(3);
  if (x < 100) return x.toFixed(1);
  return Math.round(x).toLocaleString();
}

// ---------- browser: fill the tables and draw the charts in benchmark.html ----------

var COLOUR = { brute: "#eb6834", pruned: "#2a78d6", nn: "#eda100", two: "#1baf7a" };

function showExperiments() {
  var small = experimentSmall();
  var large = experimentLarge();

  var html = "";
  small.forEach(function (r) {
    html += "<tr><td>" + r.stops + '</td><td class="num">' + r.orders.toLocaleString() + '</td><td class="num">' + ms(r.brute) +
      '</td><td class="num">' + ms(r.pruned) + '</td><td class="num">' + ms(r.nn) + '</td><td class="num">' + ms(r.two) +
      '</td><td class="num">' + r.gapNN.toFixed(1) + '%</td><td class="num">' + r.gapTwo.toFixed(2) + "%</td></tr>";
  });
  document.getElementById("smallRows").innerHTML = html;

  html = "";
  large.forEach(function (r) {
    html += "<tr><td>" + r.stops + '</td><td class="num">' + ms(r.nn) + '</td><td class="num">' + ms(r.two) +
      '</td><td class="num">' + r.passes.toFixed(1) + '</td><td class="num">' + r.lenNN.toFixed(1) + '</td><td class="num">' +
      r.lenTwo.toFixed(1) + '</td><td class="num">' + r.shorter.toFixed(1) + '%</td><td class="num">' +
      r.tableNumbers.toLocaleString() + "</td></tr>";
  });
  document.getElementById("largeRows").innerHTML = html;

  var labels = small.map(function (r) { return r.stops; });
  function line(label, key, colour, shape) {
    return { label: label, data: small.map(function (r) { return r[key]; }), borderColor: colour, backgroundColor: colour,
             borderWidth: 2, pointRadius: 4, pointStyle: shape };
  }
  new Chart(document.getElementById("timeChart"), {
    type: "line",
    data: { labels: labels, datasets: [
      line("Try every order (brute force)", "brute", COLOUR.brute, "rect"),
      line("Every order with pruning", "pruned", COLOUR.pruned, "triangle"),
      line("Nearest neighbour + 2-opt", "two", COLOUR.two, "circle")
    ] },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { type: "logarithmic", title: { display: true, text: "time for one answer in ms (log scale)" } },
        x: { title: { display: true, text: "number of stops" } }
      }
    }
  });

  new Chart(document.getElementById("gapChart"), {
    type: "bar",
    data: { labels: labels, datasets: [
      { label: "Nearest neighbour only", data: small.map(function (r) { return r.gapNN; }), backgroundColor: COLOUR.nn },
      { label: "Nearest neighbour + 2-opt", data: small.map(function (r) { return r.gapTwo; }), backgroundColor: COLOUR.two }
    ] },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { title: { display: true, text: "% longer than the best possible route" } },
        x: { title: { display: true, text: "number of stops" } }
      }
    }
  });

  document.getElementById("status").textContent = "Done. Numbers depend on the computer, run it again and they change a little.";
}

if (typeof document !== "undefined") {
  document.getElementById("runBtn").onclick = function () {
    document.getElementById("status").textContent = "Running, this takes about 10 seconds...";
    this.disabled = true;
    setTimeout(showExperiments, 50);     // small wait so the "Running" text shows first
  };
  // benchmark.html?run starts by itself
  if (location.search.indexOf("run") !== -1) showExperiments();
}

if (typeof document === "undefined") {
  // terminal
  var small = experimentSmall();
  console.log("stops | possible orders | brute force ms | pruned ms | NN ms | NN+2opt ms | NN gap % | NN+2opt gap %");
  small.forEach(function (r) {
    console.log([r.stops, r.orders, ms(r.brute), ms(r.pruned), ms(r.nn), ms(r.two), r.gapNN.toFixed(1), r.gapTwo.toFixed(2)].join(" | "));
  });
  var large = experimentLarge();
  console.log("\nstops | NN ms | 2-opt ms | passes | NN km | 2-opt km | shorter % | numbers in table");
  large.forEach(function (r) {
    console.log([r.stops, ms(r.nn), ms(r.two), r.passes.toFixed(1), r.lenNN.toFixed(1), r.lenTwo.toFixed(1), r.shorter.toFixed(1), r.tableNumbers].join(" | "));
  });
}
