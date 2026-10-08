// tests.js - test cases for tsp.js
// Open tests.html in a browser, or run   node js/tests.js   in the terminal.

if (typeof module !== "undefined") {
  var tsp = require("./tsp.js");
  for (var key in tsp) global[key] = tsp[key];
}

// distance table for points given as [x, y] in km on flat paper (easier to check by hand)
function flatTable(points) {
  var D = [];
  for (var i = 0; i < points.length; i++) {
    D.push([]);
    for (var j = 0; j < points.length; j++) {
      D[i].push(Math.sqrt(Math.pow(points[i][0] - points[j][0], 2) + Math.pow(points[i][1] - points[j][1], 2)));
    }
  }
  return D;
}

// My own small random number generator so that the "random" places are the same
// every time the tests run (Math.random cannot be given a seed).
function makeRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// n random places inside a 20 km x 20 km square
function randomPlaces(n, random) {
  var pts = [];
  for (var i = 0; i < n; i++) pts.push([random() * 20, random() * 20]);
  return pts;
}

function near(a, b) { return Math.abs(a - b) < 0.005; }

// true if the route starts at 0 and has every place exactly once
function isValidRoute(route, n) {
  if (route.length !== n || route[0] !== 0) return false;
  var seen = [];
  for (var i = 0; i < n; i++) seen.push(false);
  for (var k = 0; k < n; k++) {
    if (seen[route[k]] !== false) return false;
    seen[route[k]] = true;
  }
  return true;
}

// the worked example from the poster: Home and five places
var POSTER = [[8, 1], [5, 3], [2, 0], [8, 5], [7, 2], [7, 5]];
var LETTER = ["H", "A", "B", "C", "D", "E"];
function letters(route) { return route.map(function (r) { return LETTER[r]; }).join("-"); }

// the example that the planner page loads (real coordinates from OpenStreetMap)
var BENGALURU = [
  { name: "Dairy Circle", lat: 12.93989, lon: 77.60233 },
  { name: "Indiranagar", lat: 12.97807, lon: 77.63881 },
  { name: "Jayanagar 4th Block", lat: 12.92982, lon: 77.58428 },
  { name: "Majestic Bus Stand", lat: 12.97791, lon: 77.57239 },
  { name: "HSR Layout BDA Complex", lat: 12.91374, lon: 77.63746 },
  { name: "MG Road", lat: 12.97553, lon: 77.60679 },
  { name: "KR Market", lat: 12.96090, lon: 77.57464 },
  { name: "Koramangala (Sony Signal)", lat: 12.93723, lon: 77.62681 },
  { name: "Lalbagh Main Gate", lat: 12.95415, lon: 77.58468 }
];


var TESTS = [

  { name: "Only the starting place, nothing to visit",
    input: "1 place",
    expected: "route [0], 0 km",
    run: function () {
      var r = bestRoute([[0]], true);
      return { got: "route [" + r.route + "], " + r.length + " km", pass: r.route.length === 1 && r.length === 0 };
    } },

  { name: "Start and one stop 3 km away, round trip",
    input: "(0,0) and (3,0)",
    expected: "6.00 km",
    run: function () {
      var r = bestRoute(flatTable([[0, 0], [3, 0]]), true);
      return { got: r.length.toFixed(2) + " km", pass: near(r.length, 6) };
    } },

  { name: "Places along one straight road, one way trip",
    input: "start at km 0, stops added as km 5, 2, 8, 3",
    expected: "visit 2, 3, 5, 8 in that order = 8.00 km",
    run: function () {
      var km = [0, 5, 2, 8, 3];
      var r = bestRoute(flatTable(km.map(function (k) { return [k, 0]; })), false);
      var order = r.route.slice(1).map(function (i) { return km[i]; });
      return { got: "visit " + order.join(", ") + " = " + r.length.toFixed(2) + " km",
               pass: order.join() === "2,3,5,8" && near(r.length, 8) };
    } },

  { name: "Same straight road but coming back to the start",
    input: "start at km 0, stops at km 5, 2, 8, 3",
    expected: "16.00 km (8 there + 8 back)",
    run: function () {
      var r = bestRoute(flatTable([[0, 0], [5, 0], [2, 0], [8, 0], [3, 0]]), true);
      return { got: r.length.toFixed(2) + " km", pass: near(r.length, 16) };
    } },

  { name: "Four corners of a 1 km square, added in a criss-cross order",
    input: "(0,0) start, then (1,1), (1,0), (0,1)",
    expected: "4.00 km (go around the square, not across it)",
    run: function () {
      var D = flatTable([[0, 0], [1, 1], [1, 0], [0, 1]]);
      var r = bestRoute(D, true);
      var typed = routeLength(D, [0, 1, 2, 3], true);
      return { got: r.length.toFixed(2) + " km (added order was " + typed.toFixed(2) + " km)", pass: near(r.length, 4) };
    } },

  { name: "Poster example: nearest neighbour alone",
    input: "H(8,1) A(5,3) B(2,0) C(8,5) D(7,2) E(7,5)",
    expected: "H-D-A-E-C-B, 21.37 km",
    run: function () {
      var D = flatTable(POSTER);
      var nn = nearestNeighbour(D);
      var len = routeLength(D, nn, true);
      return { got: letters(nn) + ", " + len.toFixed(2) + " km", pass: letters(nn) === "H-D-A-E-C-B" && near(len, 21.37) };
    } },

  { name: "Poster example: after 2-opt",
    input: "the route from the test above",
    expected: "H-D-C-E-A-B, 18.73 km",
    run: function () {
      var D = flatTable(POSTER);
      var two = twoOpt(D, nearestNeighbour(D), true);
      var len = routeLength(D, two.route, true);
      return { got: letters(two.route) + ", " + len.toFixed(2) + " km", pass: letters(two.route) === "H-D-C-E-A-B" && near(len, 18.73) };
    } },

  { name: "Poster example: is 18.73 km really the best? (try all 120 orders)",
    input: "same six places, no pruning",
    expected: "18.73 km, 120 orders checked",
    run: function () {
      var r = tryEveryOrder(flatTable(POSTER), true, false);
      return { got: r.length.toFixed(2) + " km, " + r.checked + " orders checked", pass: near(r.length, 18.73) && r.checked === 120 };
    } },

  { name: "Pruning must not change the answer",
    input: "40 random sets of 8 stops",
    expected: "same length with and without pruning, 40 of 40",
    run: function () {
      var random = makeRandom(11), same = 0, saved = 0;
      for (var t = 0; t < 40; t++) {
        var D = flatTable(randomPlaces(9, random));
        var plain = tryEveryOrder(D, true, false);
        var pruned = tryEveryOrder(D, true, true);
        if (near(plain.length, pruned.length)) same++;
        saved += 1 - pruned.checked / plain.checked;
      }
      return { got: same + " of 40 same (pruning skipped " + Math.round(saved / 40 * 100) + "% of the orders)", pass: same === 40 };
    } },

  { name: "2-opt should never make a route longer",
    input: "200 random sets, 5 to 60 places",
    expected: "0 routes got longer",
    run: function () {
      var random = makeRandom(22), worse = 0;
      for (var t = 0; t < 200; t++) {
        var D = flatTable(randomPlaces(5 + Math.floor(random() * 56), random));
        var nn = nearestNeighbour(D);
        var two = twoOpt(D, nn, true);
        if (routeLength(D, two.route, true) > routeLength(D, nn, true) + 0.000001) worse++;
      }
      return { got: worse + " routes got longer", pass: worse === 0 };
    } },

  { name: "Every place is visited exactly once and the route starts at the start",
    input: "100 random sets, 3 to 80 places, round trip and one way",
    expected: "200 of 200 routes valid",
    run: function () {
      var random = makeRandom(33), ok = 0;
      for (var t = 0; t < 100; t++) {
        var n = 3 + Math.floor(random() * 78);
        var D = flatTable(randomPlaces(n, random));
        if (isValidRoute(bestRoute(D, true).route, n)) ok++;
        if (isValidRoute(bestRoute(D, false).route, n)) ok++;
      }
      return { got: ok + " of 200 routes valid", pass: ok === 200 };
    } },

  { name: "How close is nearest neighbour + 2-opt to the true best?",
    input: "60 random sets of 9 stops, compared with the exact answer",
    expected: "on average less than 3% longer",
    run: function () {
      var random = makeRandom(44), total = 0, worst = 0, exactHits = 0;
      for (var t = 0; t < 60; t++) {
        var D = flatTable(randomPlaces(10, random));
        var two = twoOpt(D, nearestNeighbour(D), true);
        var exact = tryEveryOrder(D, true, true, two.route);
        var gap = (routeLength(D, two.route, true) / exact.length - 1) * 100;
        total += gap;
        if (gap > worst) worst = gap;
        if (gap < 0.001) exactHits++;
      }
      return { got: "average " + (total / 60).toFixed(2) + "% longer, worst " + worst.toFixed(1) + "%, exactly the best in " + exactHits + " of 60",
               pass: total / 60 < 3 };
    } },

  { name: "Two stops at exactly the same spot",
    input: "(0,0) start, (4,0), (4,0), (4,3)",
    expected: "valid route, 12.00 km",
    run: function () {
      var D = flatTable([[0, 0], [4, 0], [4, 0], [4, 3]]);
      var r = bestRoute(D, true);
      return { got: (isValidRoute(r.route, 4) ? "valid" : "INVALID") + " route, " + r.length.toFixed(2) + " km",
               pass: isValidRoute(r.route, 4) && near(r.length, 12) };
    } },

  { name: "A one way trip can never be longer than the round trip",
    input: "100 random sets of 4 to 10 stops (exact answers)",
    expected: "true for 100 of 100",
    run: function () {
      var random = makeRandom(55), ok = 0;
      for (var t = 0; t < 100; t++) {
        var D = flatTable(randomPlaces(5 + Math.floor(random() * 7), random));
        if (bestRoute(D, false).length <= bestRoute(D, true).length + 0.000001) ok++;
      }
      return { got: "true for " + ok + " of 100", pass: ok === 100 };
    } },

  { name: "Road distances that differ by direction (one-way streets)",
    input: "3 places, A to B = 2 km but B to A = 4 km",
    expected: "averaged table has 3 km both ways",
    run: function () {
      var S = makeSymmetric([[0, 2, 5], [4, 0, 1], [5, 3, 0]]);
      return { got: "A to B = " + S[0][1] + ", B to A = " + S[1][0] + ", B to C = " + S[1][2] + ", C to B = " + S[2][1],
               pass: S[0][1] === 3 && S[1][0] === 3 && S[1][2] === 2 && S[2][1] === 2 };
    } },

  { name: "Real places: the Bengaluru example (straight line distances)",
    input: "Dairy Circle + 8 places in the order they are listed on the planner page",
    expected: "best order is shorter than the listed order and equals plain brute force",
    run: function () {
      var D = straightTable(BENGALURU);
      var listed = routeLength(D, [0, 1, 2, 3, 4, 5, 6, 7, 8], true);
      var r = bestRoute(D, true);
      var brute = tryEveryOrder(D, true, false);
      return { got: "listed order " + listed.toFixed(1) + " km, best " + r.length.toFixed(1) + " km, brute force " + brute.length.toFixed(1) +
                    " km (" + brute.checked + " orders)",
               pass: r.length < listed && near(r.length, brute.length) };
    } },

  { name: "More stops than the exact limit switches to nearest neighbour + 2-opt",
    input: "10 stops and 11 stops",
    expected: "10 stops: exact, 11 stops: nearest neighbour + 2-opt",
    run: function () {
      var random = makeRandom(66);
      var a = bestRoute(flatTable(randomPlaces(11, random)), true).method;
      var b = bestRoute(flatTable(randomPlaces(12, random)), true).method;
      return { got: "10 stops: " + a + ", 11 stops: " + b, pass: a === "exact" && b === "nearest neighbour + 2-opt" };
    } },

  { name: "Big input still answers quickly",
    input: "300 random places",
    expected: "valid route in under 1 second",
    run: function () {
      var D = flatTable(randomPlaces(300, makeRandom(77)));
      var t0 = performance.now();
      var r = bestRoute(D, true);
      var ms = performance.now() - t0;
      return { got: (isValidRoute(r.route, 300) ? "valid" : "INVALID") + " route in " + ms.toFixed(1) + " ms", pass: isValidRoute(r.route, 300) && ms < 1000 };
    } }
];


function runAllTests() {
  var results = [];
  for (var i = 0; i < TESTS.length; i++) {
    var t = TESTS[i];
    var out;
    try {
      out = t.run();
    } catch (err) {
      out = { got: "ERROR: " + err.message, pass: false };
    }
    results.push({ no: i + 1, name: t.name, input: t.input, expected: t.expected, got: out.got, pass: out.pass });
  }
  return results;
}

if (typeof document !== "undefined") {
  // browser: fill the table in tests.html
  var results = runAllTests();
  var passed = 0;
  var rows = "";
  results.forEach(function (r) {
    if (r.pass) passed++;
    rows += "<tr><td>" + r.no + "</td><td>" + r.name + "</td><td>" + r.input + "</td><td>" + r.expected +
      "</td><td>" + r.got + '</td><td class="' + (r.pass ? "pass" : "fail") + '">' + (r.pass ? "PASS" : "FAIL") + "</td></tr>";
  });
  document.getElementById("rows").innerHTML = rows;
  var box = document.getElementById("summary");
  box.textContent = passed + " of " + results.length + " test cases passed";
  box.className = "alert " + (passed === results.length ? "alert-success" : "alert-danger");
} else {
  // terminal
  var all = runAllTests();
  var count = 0;
  all.forEach(function (r) {
    if (r.pass) count++;
    console.log((r.pass ? "PASS  " : "FAIL  ") + r.no + ". " + r.name + "\n        expected: " + r.expected + "\n        got:      " + r.got);
  });
  console.log("\n" + count + " of " + all.length + " test cases passed");
}
