// tsp.js
// All the route finding code is in this file. The page (app.js), the tests (tests.js)
// and the speed experiments (benchmark.js) use these same functions.
//
// A "route" here is just a list of place numbers, for example [0, 3, 1, 2].
// Place 0 is always the starting point, so every route begins with 0.
// D is the distance table: D[i][j] = distance from place i to place j.


// straight line distance between two {lat, lon} points in km (haversine formula)
function straightKm(a, b) {
  var R = 6371;
  var p = Math.PI / 180;
  var x = Math.sin((b.lat - a.lat) * p / 2) * Math.sin((b.lat - a.lat) * p / 2) +
          Math.cos(a.lat * p) * Math.cos(b.lat * p) *
          Math.sin((b.lon - a.lon) * p / 2) * Math.sin((b.lon - a.lon) * p / 2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// distance table made from straight line distances
function straightTable(points) {
  var D = [];
  for (var i = 0; i < points.length; i++) {
    D.push([]);
    for (var j = 0; j < points.length; j++) D[i].push(straightKm(points[i], points[j]));
  }
  return D;
}

// Road distances are not exactly the same in both directions because of one-ways.
// 2-opt reverses parts of the route, so I need A->B and B->A to be equal.
// This returns a new table where both are the average of the two.
function makeSymmetric(D) {
  var S = [];
  for (var i = 0; i < D.length; i++) {
    S.push([]);
    for (var j = 0; j < D.length; j++) S[i].push((D[i][j] + D[j][i]) / 2);
  }
  return S;
}

// total length of a route. If roundTrip is true the way back to the start is added.
function routeLength(D, route, roundTrip) {
  var total = 0;
  for (var i = 1; i < route.length; i++) total += D[route[i - 1]][route[i]];
  if (roundTrip && route.length > 1) total += D[route[route.length - 1]][route[0]];
  return total;
}


// ---------- 1. Nearest neighbour ----------
// Start at place 0. Keep going to the closest place that is not visited yet.
// Two loops inside each other, so O(n^2) time.
function nearestNeighbour(D) {
  var n = D.length;
  var visited = [];
  for (var i = 0; i < n; i++) visited.push(false);

  var route = [0];
  visited[0] = true;
  var at = 0;

  for (var step = 1; step < n; step++) {
    var next = -1;
    for (var j = 0; j < n; j++) {
      if (!visited[j] && (next === -1 || D[at][j] < D[at][next])) next = j;
    }
    visited[next] = true;
    route.push(next);
    at = next;
  }
  return route;
}


// ---------- 2. 2-opt improvement ----------
// Takes a route and keeps improving it. It picks two positions i and j and reverses
// the part of the route between them. If that makes the route shorter the change is kept.
// (This is what removes the places where the route crosses over itself.)
// It repeats until one full pass finds nothing to improve.
//
// Reversing route[i..j] only changes two connections:
//     before:  a -> b ... c -> d          a = route[i-1], b = route[i]
//     after:   a -> c ... b -> d          c = route[j],   d = route[j+1]
// so I only compare those two instead of adding up the whole route again.
// One pass looks at every pair (i, j), so a pass is O(n^2).
function twoOpt(D, startRoute, roundTrip) {
  var route = startRoute.slice();
  var n = route.length;
  var passes = 0;
  var improved = true;

  while (improved) {
    improved = false;
    passes++;
    for (var i = 1; i < n - 1; i++) {
      for (var j = i + 1; j < n; j++) {
        var a = route[i - 1], b = route[i], c = route[j];
        var change;
        if (j < n - 1) {
          var d = route[j + 1];
          change = D[a][c] + D[b][d] - D[a][b] - D[c][d];
        } else if (roundTrip) {
          change = D[a][c] + D[b][route[0]] - D[a][b] - D[c][route[0]];   // d is the start
        } else {
          change = D[a][c] - D[a][b];             // one way trip, nothing comes after c
        }

        if (change < -0.0000001) {
          // reverse route[i..j]
          var left = i, right = j;
          while (left < right) {
            var t = route[left]; route[left] = route[right]; route[right] = t;
            left++; right--;
          }
          improved = true;
        }
      }
    }
  }
  return { route: route, passes: passes };
}


// ---------- 3. Trying every order (exact answer) ----------
// Goes through every possible order of the places with recursion and remembers the best.
// For n places after the start there are n! orders, so this only works for small n.
//
// prune = true : if the half built route is already longer than the best complete route
//                found so far, stop going deeper (it can never win).
// seed         : (optional) a route we already know, so that pruning works from the beginning.
function tryEveryOrder(D, roundTrip, prune, seed) {
  var n = D.length;
  var bestRoute = seed ? seed.slice() : null;
  var bestLength = seed ? routeLength(D, seed, roundTrip) : Infinity;
  var checked = 0;        // how many complete routes were looked at

  var used = [];
  for (var i = 0; i < n; i++) used.push(false);
  used[0] = true;
  var current = [0];

  function extend(last, lengthSoFar) {
    if (current.length === n) {
      checked++;
      var total = lengthSoFar + (roundTrip ? D[last][0] : 0);
      if (total < bestLength) {
        bestLength = total;
        bestRoute = current.slice();
      }
      return;
    }
    for (var next = 1; next < n; next++) {
      if (used[next]) continue;
      var len = lengthSoFar + D[last][next];
      if (prune && len >= bestLength) continue;
      used[next] = true;
      current.push(next);
      extend(next, len);
      current.pop();
      used[next] = false;
    }
  }

  extend(0, 0);
  return { route: bestRoute, length: bestLength, checked: checked };
}


// ---------- what the planner actually uses ----------
// Small number of stops : exact answer (every order, with pruning).
// More stops            : nearest neighbour, then 2-opt.
var EXACT_LIMIT = 10;     // number of stops, not counting the start

function bestRoute(D, roundTrip) {
  var n = D.length;
  if (n <= 2) {
    var simple = n === 2 ? [0, 1] : [0];
    return { route: simple, length: routeLength(D, simple, roundTrip), method: "only one possible order" };
  }

  var first = nearestNeighbour(D);
  var better = twoOpt(D, first, roundTrip);

  if (n - 1 <= EXACT_LIMIT) {
    var exact = tryEveryOrder(D, roundTrip, true, better.route);
    return { route: exact.route, length: exact.length, method: "exact", checked: exact.checked };
  }
  return {
    route: better.route,
    length: routeLength(D, better.route, roundTrip),
    method: "nearest neighbour + 2-opt",
    passes: better.passes
  };
}

// n! as a number (only used for showing "there are ... possible orders")
function factorial(n) {
  var f = 1;
  for (var i = 2; i <= n; i++) f *= i;
  return f;
}

// so the same file works in node (I run the tests from the terminal too)
if (typeof module !== "undefined") {
  module.exports = {
    straightKm: straightKm, straightTable: straightTable, makeSymmetric: makeSymmetric,
    routeLength: routeLength, nearestNeighbour: nearestNeighbour, twoOpt: twoOpt,
    tryEveryOrder: tryEveryOrder, bestRoute: bestRoute, factorial: factorial, EXACT_LIMIT: EXACT_LIMIT
  };
}
