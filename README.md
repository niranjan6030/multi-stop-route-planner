# Multi-Stop Route Planner

You have many places to visit in one trip. In which order should you go so that you travel the least?

This is a small web page that answers that. You add your starting place and the stops (search or click on the
map), press **Find best order**, and it shows the shortest order, the km saved compared to the order you
typed, and a button that opens the route in Google Maps.

The problem is the Travelling Salesman Problem. I solve it with Nearest Neighbour + 2-opt, and with an exact
search when there are 10 stops or fewer.

**Try it:** https://niranjan6030.github.io/multi-stop-route-planner/

Blog post that explains everything: https://niranjan6030.github.io/multi-stop-route-planner/blog.html

Poster: [poster/poster.pdf](poster/poster.pdf)

## How to run

Just open `index.html` in a browser. Nothing to install.

If you want to rebuild the poster or the browser blocks something, start a small server in this folder and open
http://localhost:8753

```bash
python3 -m http.server 8753
```

Click **Load an example** on the page to try it with 9 places in Bengaluru.

## Files

| File | What it is |
|---|---|
| `index.html`, `js/app.js` | the planner page (map, list of places, result) |
| `js/tsp.js` | the algorithms. Everything else uses this file |
| `blog.html` | the write-up: problem, algorithm, tests, complexity, experiments |
| `tests.html`, `js/tests.js` | 18 test cases, they run when the page opens |
| `benchmark.html`, `js/benchmark.js` | timing and quality experiments with charts |
| `poster/` | the poster (HTML source, PDF, PNG) and the screenshots used in it |
| `lib/` | Leaflet, Bootstrap and Chart.js, saved here so the pages do not need a CDN |

## The algorithm in short

Place 0 is the start. `D[i][j]` is the distance from place i to place j.

1. **Nearest neighbour** - start at 0, keep going to the closest place that is not visited yet. O(n²).
2. **2-opt** - take two positions in the route and reverse the part between them. Keep it if the route got
   shorter. Repeat until a full pass changes nothing. One pass is O(n²).
3. **Exact search** (only for 10 stops or fewer) - try every order with recursion, but stop going deeper when
   the half built route is already longer than the best one found so far. The 2-opt route is used as the
   first "best".

Road distances come from the OSRM server (OpenStreetMap data) in one request. They are a little different
in the two directions because of one-ways, so I average the two before running the algorithm. If there is no
internet the page uses straight line distance.

## Tests and experiments

```bash
node js/tests.js
node js/benchmark.js
```

or open `tests.html` and `benchmark.html`.

Some numbers from my laptop (Chrome, MacBook Air M4):

| Stops | Brute force | With pruning | NN + 2-opt | NN + 2-opt longer than best by |
|---|---|---|---|---|
| 8 | 1.4 ms | 0.28 ms | 0.0004 ms | 0.12% |
| 10 | 149 ms | 9.2 ms | 0.0006 ms | 0.67% |
| 12 | too slow | 154 ms | 0.0008 ms | 1.15% |

## Things it does not do

- No live traffic. The driving time is what OSRM gives for empty roads.
- Above 10 stops the answer is very good but not guaranteed to be the best one.
- One vehicle only, no opening times for the places.
- The free OSRM and Nominatim servers are for light use, so it is limited to 25 places.

## Credits

- Map and road data: OpenStreetMap contributors
- Routing and distance table: Project OSRM (router.project-osrm.org)
- Place search: Nominatim
- Map library: Leaflet. Styling: Bootstrap. Charts: Chart.js
- 2-opt: G. A. Croes, "A method for solving traveling-salesman problems", Operations Research, 1958
- I looked at OptiMap (gebweb.net/optimap) and tspvis.com to see how other people built this kind of tool
