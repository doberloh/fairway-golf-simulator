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

test('the first node closes the shape once there are three; a node is found under the pointer', () => {
 assert.ok(!closesOn(square.slice(0, 2), [0, 0], 1));
 assert.ok(closesOn(square, [.5, .5], 1));
 assert.ok(!closesOn(square, [3, 3], 1));
 assert.equal(nodeAt(square, [19.5, 19.6], 1), 2);
 assert.equal(nodeAt(square, [10, 10], 1), -1);
});
