// The pen's curve (src/builder/pen.js; the builder-ux goal): it passes through
// every node, closes without a kink, keeps corners sharp, and the preview and
// the fill are the same points.
import test from 'node:test';
import assert from 'node:assert/strict';
import {penCurve, closesOn, nodeAt} from '../src/builder/pen.js';

const near = (a, b, e = 1e-6) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const square = [[0, 0], [20, 0], [20, 20], [0, 20]];

test('the curve passes through every node', () => {
 for (const closed of [false, true]) {
  const c = penCurve(square, {closed});
  for (const n of square) assert.ok(c.some(p => near(p, n)), `${closed ? 'closed' : 'open'}: through ${n}`);
 }
 const open = penCurve(square);
 assert.ok(near(open[0], square[0]) && near(open.at(-1), square.at(-1)), 'an open curve starts and ends on its end nodes');
});

test('a closed curve rounds the corners and comes back to its start smoothly', () => {
 const c = penCurve(square, {closed: true});
 // Rounded: half-way along the first side the curve bulges out of the square.
 const mid = c[Math.floor(c.length / 8)];
 assert.ok(mid[1] < 0, `the curve bows outward between nodes: ${mid}`);
 // No kink at the first node: the turn there is as gentle as at the third.
 const turn = i => { const a = c[(i - 1 + c.length) % c.length], b = c[i], d = c[(i + 1) % c.length]; const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - b[0], d[1] - b[1]]; return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])); };
 const at = n => c.findIndex(p => near(p, square[n]));
 assert.ok(Math.abs(turn(at(0)) - turn(at(2))) < 1e-6, 'the first node turns as any other');
});

test('sharp nodes are corners: all sharp is the polygon itself', () => {
 const c = penCurve(square, {closed: true, sharp: [0, 1, 2, 3]});
 for (const p of c) assert.ok(Math.min(Math.abs(p[0]), Math.abs(p[0] - 20), Math.abs(p[1]), Math.abs(p[1] - 20)) < 1e-6, `${p} lies on the square's edge`);
});

test('the points are about a step apart, and close nodes do not loop', () => {
 const c = penCurve([[0, 0], [10, 0], [10.2, .1], [20, 0]], {step: .5});
 for (let i = 1; i < c.length; i++) assert.ok(Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]) < 1, 'no jump');
 // Centripetal: between the two close nodes the curve stays near them.
 assert.ok(c.every(p => p[0] > -1 && p[0] < 21 && Math.abs(p[1]) < 2), 'no overshoot or loop');
});

// HOW MUCH IT CURVES (the owner, 23 November 2026): off is straight lines, a
// strength between bulges less than the full curve, every one through the nodes.
test('the curve\'s strength: off is the polygon, half bulges half as far, all through the nodes', () => {
 const off = penCurve(square, {closed: true, curve: 0});
 for (const p of off) assert.ok(Math.min(Math.abs(p[0]), Math.abs(p[0] - 20), Math.abs(p[1]), Math.abs(p[1] - 20)) < 1e-9, `${p} lies on the square's edge`);
 // (Each laid as finely as its own bend asks, so their points differ; the
 // bulge is read off points a few centimetres apart.)
 const full = penCurve(square, {closed: true, step: .05}), half = penCurve(square, {closed: true, curve: .5, step: .05});
 const bulge = c => Math.min(...c.map(p => p[1]));
 assert.ok(Math.abs(bulge(half) - bulge(full) / 2) < 1e-3, `half the bulge: ${bulge(half)} against ${bulge(full)}`);
 for (const c of [off, half]) for (const n of square) assert.ok(c.some(p => near(p, n)), `through ${n}`);
 assert.deepEqual(penCurve(square, {closed: true, curve: 1, step: .05}), full, 'full strength is the default');
});

// 24 November 2026: part strength once blended the curve toward the straight
// lines, which left a corner at every node; now the handles shorten instead.
test('a curve at part strength has no kink at its nodes', () => {
 // (Small, so a segment's 64 points at most are 5 cm apart.)
 const nodes = [[0, 0], [3.4, 0], [3.4, 2.2], [0, 2.2]];
 // Sampled finely, a smooth curve turns little from one point to the next
 // even where it bends hardest; a kink turns at one point, however fine.
 for (const curve of [.25, .5, .75]) {
  const c = penCurve(nodes, {closed: true, curve, step: .02});
  const turn = j => { const i = (j + c.length) % c.length, a = c[(i - 1 + c.length) % c.length], b = c[i], d = c[(i + 1) % c.length]; const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - b[0], d[1] - b[1]]; return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI; };
  for (const n of nodes) {
   const i = c.findIndex(p => near(p, n));
   // (Before 24 November: 74 degrees at one point at a quarter strength.)
   assert.ok(turn(i) < 1.5 * Math.max(turn(i - 1), turn(i + 1)) + 1, `curve ${curve}, node ${n}: turns ${turn(i).toFixed(1)} degrees at one point, ${turn(i - 1).toFixed(1)} and ${turn(i + 1).toFixed(1)} beside it`);
  }
 }
});

test('full strength is the centripetal spline, as it always was', () => {
 // A point worked out by hand-free reference: the old de Boor-style form.
 const ref = (p0, p1, p2, p3, u) => {
  const k = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), t1 = k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3), t = t1 + (t2 - t1) * u;
  const L = (a, b, ta, tb) => [a[0] + (b[0] - a[0]) * (t - ta) / (tb - ta), a[1] + (b[1] - a[1]) * (t - ta) / (tb - ta)];
  const a1 = L(p0, p1, 0, t1), a2 = L(p1, p2, t1, t2), a3 = L(p2, p3, t2, t3), b1 = L(a1, a2, 0, t2), b2 = L(a2, a3, t1, t3);
  return L(b1, b2, t1, t2);
 };
 const nodes = [[0, 0], [12, 3], [20, 15], [4, 22]], c = penCurve(nodes, {closed: true, step: 1});
 // The second segment: from node 1 to node 2, every point on the reference
 // curve (laid more finely where it bends, so not evenly along it).
 const n0 = c.findIndex(p => near(p, nodes[1])), n1 = c.findIndex(p => near(p, nodes[2])) - n0;
 assert.ok(n0 > 0 && n1 >= Math.ceil(Math.hypot(8, 12)), 'at least a point a metre');
 const fine = Array.from({length: 20001}, (_, k) => ref(nodes[0], nodes[1], nodes[2], nodes[3], k / 20000));
 for (let i = 0; i < n1; i++) assert.ok(Math.min(...fine.map(q => Math.hypot(q[0] - c[n0 + i][0], q[1] - c[n0 + i][1]))) < 2e-3, `point ${i}`);
});

// 25 November 2026 (the owner: facets on an outline filled with Auto curve):
// a small shape is laid finely enough that no point turns more than about 5
// degrees from the last -- a metre a point turned 17 round a 12 m green.
test('a small curved outline has no facets', () => {
 const c = penCurve([[0, 0], [8, 1], [12, 8], [6, 14], [-2, 10]], {closed: true, step: 1});
 const turn = i => { const a = c[(i - 1 + c.length) % c.length], b = c[i], d = c[(i + 1) % c.length], u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - b[0], d[1] - b[1]]; return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI; };
 const worst = Math.max(...c.map((_, i) => turn(i)));
 assert.ok(worst < 6, `turns ${worst.toFixed(1)} degrees at one point`);
});

test('the first node closes the shape once there are three; a node is found under the pointer', () => {
 assert.ok(!closesOn(square.slice(0, 2), [0, 0], 1));
 assert.ok(closesOn(square, [.5, .5], 1));
 assert.ok(!closesOn(square, [3, 3], 1));
 assert.equal(nodeAt(square, [19.5, 19.6], 1), 2);
 assert.equal(nodeAt(square, [10, 10], 1), -1);
});
