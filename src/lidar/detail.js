// FULL DETAIL INSIDE THE COURSE, LESS OUTSIDE (the owner, 22 November 2026:
// "During the LIDAR phase, lets make the user roughly trace the course
// manually. Then we can use higher precision inside that boundary, and lower
// precision outside of it"; RESEARCH, *Full detail inside the course, less
// outside*). A USGS survey comes as an octree (ept.js): every depth holds a
// share of the points, a coarse sample at the top and the rest further down,
// so the full survey over a place is every node meeting it, and a thinner
// one is the nodes down to some depth. Here: which nodes to fetch for a box
// and a rough outline -- every depth where a node meets the outline (grown by
// BUFFER, since it is rough by design), and outside it only the depths that
// together give about `perM2` points a square metre. Pure; tests/lidar-detail.test.mjs.
//
// PLACED: BUFFER 30 m (a rough outline drawn by hand on a 2 m map misses by
// that much at worst). OUTSIDE_PER_CELL 8 points per land cell outside -- the
// owner's choice, 23 November 2026 ("Use more outside"), over 2: on Alpine
// Lake 2 a cell left 58% of the ground outside filled in and broke the woods
// into 16% more, smaller trees; 8 keeps the outside nearly as the whole
// survey makes it (16% filled, 43,121 trees against 44,314), reading about
// three quarters of the points.
// REACH .7: the depths step by four times the points, so "about" the density
// asked is the first depth reaching 70% of it (a 30 points a square metre
// survey: about 1.9 outside for 2 asked, not the 7.5 of the depth above; 7.5
// for 8).
export const DETAIL = {buffer: 30, outsidePerCell: 8, reach: .7};

const area = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const cut = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
export const depthOf = key => +key.split('-')[0];

// Inside a ring ([[x, y], ...], closed implicitly), even-odd.
export function inRing(ring, x, y) {
 let c = false;
 for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i]; if ((by > y) !== (ay > y) && x < (ax - bx) * (y - by) / (ay - by) + bx) c = !c; }
 return c;
}
// Whether segment p-q crosses segment r-s.
function crosses([px, py], [qx, qy], [rx, ry], [sx, sy]) {
 const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
 const d1 = d(rx, ry, sx, sy, px, py), d2 = d(rx, ry, sx, sy, qx, qy), d3 = d(px, py, qx, qy, rx, ry), d4 = d(px, py, qx, qy, sx, sy);
 return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
// Whether a ring and a box [x0, y0, x1, y1] share any ground.
export function ringMeetsBox(ring, b) {
 if (!ring?.length) return false;
 let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
 for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
 if (x1 < b[0] || x0 > b[2] || y1 < b[1] || y0 > b[3]) return false;
 if (ring.some(([x, y]) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) return true;
 if (inRing(ring, b[0], b[1]) || inRing(ring, b[2], b[3]) || inRing(ring, b[0], b[3]) || inRing(ring, b[2], b[1])) return true;
 const edges = [[[b[0], b[1]], [b[2], b[1]]], [[b[2], b[1]], [b[2], b[3]]], [[b[2], b[3]], [b[0], b[3]]], [[b[0], b[3]], [b[0], b[1]]]];
 for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) for (const [r, s] of edges) if (crosses(ring[j], ring[i], r, s)) return true;
 return false;
}

// `nodes`: [{key, points}] meeting `box` ([x0, y0, x1, y1] in the survey's
// units), `boxOf(key)` a node's box. `ring`: the outline in the same units,
// or null (every node). `metres`: ground metres per unit (Web Mercator's
// stretch: cos of the latitude). Returns {nodes, depth, perM2} -- the nodes
// to fetch, the deepest depth fetched outside the outline (null when that
// is every depth), and the points a square metre those depths give.
export function chooseNodes(nodes, boxOf, box, {ring = null, perM2 = 2, metres = 1, buffer = DETAIL.buffer} = {}) {
 if (!ring?.length) return {nodes, depth: null, perM2: null};
 const ground = area(box) * metres * metres || 1, byDepth = new Map();
 for (const n of nodes) { const b = boxOf(n.key), share = area(cut(b, box)) / (area(b) || 1); byDepth.set(depthOf(n.key), (byDepth.get(depthOf(n.key)) ?? 0) + n.points * share); }
 const depths = [...byDepth.keys()].sort((a, b) => a - b);
 let depth = null, got = 0;
 for (const d of depths) { got += byDepth.get(d) / ground; if (got >= perM2 * DETAIL.reach) { depth = d; break; } }
 if (depth === null || depth === depths.at(-1)) return {nodes, depth: null, perM2: got};
 const grow = buffer / metres;
 const chosen = nodes.filter(n => depthOf(n.key) <= depth || ringMeetsBox(ring, (b => [b[0] - grow, b[1] - grow, b[2] + grow, b[3] + grow])(boxOf(n.key))));
 return {nodes: chosen, depth, perM2: got};
}
