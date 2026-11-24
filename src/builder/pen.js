// THE PEN (the builder-ux goal, 10 November 2026; the owner: "outline fill
// needs to show a preview of the outline as you drag the line. I would like
// to see how the curve will line up as im dragging, and i want to see a 'node'
// at each click, and also allow me to close the outline by clicking the first
// node"). The curve through the clicked nodes, as the plan draws it while you
// draw and as the fill lays it -- one function for both, so what is seen is
// what lands. Pure; tests/builder-pen.test.mjs.
//
// The curve is a centripetal Catmull-Rom spline (alpha 0.5): it passes through
// every node, never loops or overshoots between close nodes as the uniform kind
// does, and needs no handles to drag -- a click is a node, as in a paint
// program's curve tool. A node marked sharp (Shift-click) is a corner: the
// curve runs straight into and out of it. Rejected: Bezier handles (a second
// thing to drag at every node, slower for tracing a green), and the straight
// lines the outline tool drew before (smoothed only after filling, so what
// landed was not what was drawn).

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mirror = (p, q) => [2 * p[0] - q[0], 2 * p[1] - q[1]];   // q reflected through p: a straight run out of p

// One segment p1 -> p2 of the spline with neighbours p0, p3, sampled at `n`
// points (p1 included, p2 left for the next segment), its handles at p1 and
// p2 `c` of the full curve's. Written as a Hermite curve with the centripetal
// spline's own tangents (Barry and Goldman's form, differentiated): at `c` 1
// it is the centripetal Catmull-Rom segment, at 0 the straight line, and
// between them the tangent at a node keeps its direction on both sides, so
// the curve is softened without a kink (24 November 2026: blending the
// spline's points toward the straight line, as at first, left a corner at
// every node -- 57 degrees on a box at half strength -- and the trace squared
// some of those off).
function segment(p0, p1, p2, p3, n, c = 1) {
 const k = d => Math.max(Math.sqrt(d), 1e-6);
 const t1 = k(dist(p0, p1)), t2 = t1 + k(dist(p1, p2)), t3 = t2 + k(dist(p2, p3)), h = t2 - t1;
 const tan = (a, b, ta, tb) => [(b[0] - a[0]) / (tb - ta), (b[1] - a[1]) / (tb - ta)];
 const d01 = tan(p0, p1, 0, t1), d02 = tan(p0, p2, 0, t2), d12 = tan(p1, p2, t1, t2), d13 = tan(p1, p3, t1, t3), d23 = tan(p2, p3, t2, t3);
 const m1 = [(d01[0] - d02[0] + d12[0]) * h * c, (d01[1] - d02[1] + d12[1]) * h * c];
 const m2 = [(d12[0] - d13[0] + d23[0]) * h * c, (d12[1] - d13[1] + d23[1]) * h * c];
 const out = [];
 for (let i = 0; i < n; i++) {
  const u = i / n, u2 = u * u, u3 = u2 * u, a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, d = -2 * u3 + 3 * u2, e = u3 - u2;
  out.push([a * p1[0] + b * m1[0] + d * p2[0] + e * m2[0], a * p1[1] + b * m1[1] + d * p2[1] + e * m2[1]]);
 }
 return out;
}

// The curve through `nodes` ([[x, z], ...]) as points, about `step` metres
// apart (at least 2 and at most 64 a segment). `closed`: back round to the
// first node. `sharp`: the indices of corner nodes. Fewer than two nodes: the
// nodes as they are; two on a closed curve: the line.
// HOW MUCH IT CURVES (the owner, 23 November 2026: "options for both the line
// and outline tool to toggle the 'auto curving' on and off and also the
// strength of the curve"): `curve` 1 is the full spline, 0 straight lines
// node to node, and between the two the spline's handles that much of their
// length -- still through every node, bulging that share as far, and smooth
// through each node (`segment`).
export function penCurve(nodes, {closed = false, sharp = [], step = 1, curve = 1} = {}) {
 const N = nodes.length;
 if (N < 2 || (closed && N < 3)) return nodes.map(p => [p[0], p[1]]);
 const corner = new Set(sharp), at = i => nodes[(i + N) % N], out = [], c = Math.max(0, Math.min(1, curve));
 const segs = closed ? N : N - 1;
 for (let s = 0; s < segs; s++) {
  const i1 = s, i2 = s + 1, p1 = at(i1), p2 = at(i2);
  // The neighbours: a corner, or an open curve's end, runs straight.
  let p0 = closed || i1 > 0 ? at(i1 - 1) : mirror(p1, p2), p3 = closed || i2 < N - 1 ? at(i2 + 1) : mirror(p2, p1);
  if (corner.has(i1 % N)) p0 = mirror(p1, p2);
  if (corner.has(i2 % N)) p3 = mirror(p2, p1);
  const n = Math.max(2, Math.min(64, Math.ceil(dist(p1, p2) / step)));
  if (c > 0) out.push(...segment(p0, p1, p2, p3, n, c));
  else for (let i = 0; i < n; i++) { const u = i / n; out.push([p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u]); }
 }
 if (!closed) out.push([nodes[N - 1][0], nodes[N - 1][1]]);
 return out;
}

// Is `p` on the first node, close enough to close the shape (within `reach`,
// the same units)? Only once there are three nodes (two for a line).
export const closesOn = (nodes, p, reach, min = 3) => nodes.length >= min && dist(nodes[0], p) <= reach;

// The node under `p`, or -1: the nearest within `reach`.
export function nodeAt(nodes, p, reach) {
 let best = -1, d0 = reach;
 nodes.forEach((q, i) => { const d = dist(q, p); if (d <= d0) { d0 = d; best = i; } });
 return best;
}
