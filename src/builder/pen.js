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
// points (p1 included, p2 left for the next segment).
function segment(p0, p1, p2, p3, n) {
 const k = d => Math.max(Math.sqrt(d), 1e-6);
 const t0 = 0, t1 = t0 + k(dist(p0, p1)), t2 = t1 + k(dist(p1, p2)), t3 = t2 + k(dist(p2, p3));
 const lerp = (a, b, ta, tb, t) => { const u = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
 const out = [];
 for (let i = 0; i < n; i++) {
  const t = t1 + (t2 - t1) * i / n;
  const a1 = lerp(p0, p1, t0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
  const b1 = lerp(a1, a2, t0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
  out.push(lerp(b1, b2, t1, t2, t));
 }
 return out;
}

// The curve through `nodes` ([[x, z], ...]) as points, about `step` metres
// apart (at least 2 and at most 64 a segment). `closed`: back round to the
// first node. `sharp`: the indices of corner nodes. Fewer than two nodes: the
// nodes as they are; two on a closed curve: the line.
export function penCurve(nodes, {closed = false, sharp = [], step = 1} = {}) {
 const N = nodes.length;
 if (N < 2 || (closed && N < 3)) return nodes.map(p => [p[0], p[1]]);
 const corner = new Set(sharp), at = i => nodes[(i + N) % N], out = [];
 const segs = closed ? N : N - 1;
 for (let s = 0; s < segs; s++) {
  const i1 = s, i2 = s + 1, p1 = at(i1), p2 = at(i2);
  // The neighbours: a corner, or an open curve's end, runs straight.
  let p0 = closed || i1 > 0 ? at(i1 - 1) : mirror(p1, p2), p3 = closed || i2 < N - 1 ? at(i2 + 1) : mirror(p2, p1);
  if (corner.has(i1 % N)) p0 = mirror(p1, p2);
  if (corner.has(i2 % N)) p3 = mirror(p2, p1);
  const n = Math.max(2, Math.min(64, Math.ceil(dist(p1, p2) / step)));
  out.push(...segment(p0, p1, p2, p3, n));
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
