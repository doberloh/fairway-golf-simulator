// Outlines from a mask (src/contour.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {maskRings, simplify, ringArea, fitRing, cellArea} from '../src/contour.js';
import {polygonDistance} from '../src/built-world.js';

test('a disc becomes one ring of about its area, inside and outside agreeing', () => {
 const n = 101, cell = .5, x0 = -25, z0 = -25, R = 15;
 const disc = (i, j) => Math.hypot(x0 + i * cell, z0 + j * cell) < R;
 const rings = maskRings(disc, n, n, x0, z0, cell);
 assert.equal(rings.length, 1);
 const a = ringArea(rings[0]), want = Math.PI * R * R;
 assert.ok(Math.abs(a - want) / want < .02, `area ${a} vs ${want}`);
 assert.ok(polygonDistance(rings, 0, 0) < 0 && polygonDistance(rings, 20, 0) > 0);
 assert.ok(Math.abs(polygonDistance(rings, R, 0)) < cell);
});

test('a ring with a hole: both edges come out, and even-odd fills the mask', () => {
 const n = 81, cell = 1, x0 = -40, z0 = -40;
 const annulus = (i, j) => { const r = Math.hypot(x0 + i * cell, z0 + j * cell); return r < 30 && r > 12; };
 const rings = maskRings(annulus, n, n, x0, z0, cell);
 assert.equal(rings.length, 2);
 assert.ok(polygonDistance(rings, 0, 0) > 0, 'the hole is outside');
 assert.ok(polygonDistance(rings, 20, 0) < 0, 'the band is inside');
 assert.ok(polygonDistance(rings, 35, 0) > 0, 'past the band is outside');
});

test('simplify keeps a shape within its tolerance with far fewer points', () => {
 const n = 201, cell = .25, x0 = -25, z0 = -25;
 const rings = maskRings((i, j) => Math.hypot(x0 + i * cell, z0 + j * cell) < 20, n, n, x0, z0, cell);
 const s = simplify(rings[0], .1);
 assert.ok(s.length < rings[0].length / 2, `${s.length} of ${rings[0].length}`);
 for (const [x, z] of rings[0]) assert.ok(Math.abs(polygonDistance([s], x, z)) < .11);
});

// FITTED OUTLINES (23 November 2026, the owner's "jaggy edges" and a Line
// with Auto curve off coming out rounded): a tee turned a few degrees off the
// grid keeps straight sides and its corners; a green stays round with no kink.
const fitted = (inside, cell, half) => { const n = Math.round(2 * half / cell), x0 = -half; return maskRings((i, j) => inside(x0 + i * cell, x0 + j * cell), n, n, x0, x0, cell).map(r => fitRing(r, cell, {area: cellArea(r, x0, cell)})); };
const kinkOf = ring => Math.max(...ring.map((b, q) => { const a = ring[(q - 1 + ring.length) % ring.length], c = ring[(q + 1) % ring.length], ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1]; return Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz)) * 180 / Math.PI; }));
test('a fitted tee turned 6 degrees keeps straight sides and square corners, on half-metre and 1 m land', () => {
 const c = Math.cos(.105), s = Math.sin(.105), loc = (x, z) => [(x - .23) * c + (z + .37) * s, -(x - .23) * s + (z + .37) * c];
 const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([p, q]) => [.23 + p * 10 * c - q * 4 * s, -.37 + p * 10 * s + q * 4 * c]);
 for (const [cell, side, cut] of [[.5, .12, .35], [1, .3, .6]]) {
  const rings = fitted((x, z) => { const [u, v] = loc(x, z); return Math.abs(u) <= 10 && Math.abs(v) <= 4; }, cell, 20);
  assert.equal(rings.length, 1);
  // Away from the corners, within `side` of the true sides (the relaxing it
  // replaced: 13 and 52 cm); every corner within `cut` (72 and 127 cm).
  for (let q = 0; q < rings[0].length; q++) {
   const [x, z] = rings[0][q]; if (corners.some(([u, v]) => Math.hypot(x - u, z - v) < 1.5)) continue;
   const [u, v] = loc(x, z), d = Math.min(Math.abs(Math.abs(u) - 10), Math.abs(Math.abs(v) - 4));
   assert.ok(d < side, `${cell} m land: a side point ${d.toFixed(2)} m off`);
  }
  for (const [u, v] of corners) assert.ok(Math.min(...rings[0].map(([x, z]) => Math.hypot(x - u, z - v))) < cut, `${cell} m land: a corner cut`);
 }
});
test('a fitted green stays round, keeps its area and has no kink', () => {
 for (const cell of [.5, 1]) {
  const rings = fitted((x, z) => Math.hypot(x - .23, z + .37) <= 14, cell, 20);
  assert.equal(rings.length, 1);
  for (const [x, z] of rings[0]) assert.ok(Math.abs(Math.hypot(x - .23, z + .37) - 14) < .45 * cell + .05, `${cell} m land: ${Math.hypot(x - .23, z + .37).toFixed(2)} m from the middle`);
  assert.ok(Math.abs(ringArea(rings[0]) / (Math.PI * 196) - 1) < .02);
  assert.ok(kinkOf(rings[0]) < 12, `a ${kinkOf(rings[0]).toFixed(0)} degree kink`);
 }
});

// 25 November 2026 (the owner's waves along the Alpine draft's straight turf):
// a straight edge whose squares step unevenly -- runs of 8, 6, 3 and 6, one
// stepping back -- comes out within 15 cm of a straight line, not bending
// with each step; and a small blob of a tee has no spike out past its cells.
test('uneven steps along a straight edge make a straight edge; a small blob has no spike', () => {
 const runs = [8, 6, 3, 6, 9, 4, 7, 5, 8, 6, 3, 6, 9, 4, 7, 5], top = [];
 let x = 0, z = 0; for (const [q, r] of runs.entries()) { for (let k = 0; k < r; k++) top.push(z); x += r; z += q === 2 ? -1 : 1; }
 const n = top.length + 10, mask = (i, j) => i >= 5 && i < n - 5 && j >= 0 && j <= top[i - 5] + 10;
 // How far the top edge bends off the best straight line through it, and how
 // often it turns back and forth (the waves), fitted now and the first way.
 const bend = opts => {
  const rings = maskRings(mask, n, 40, 0, 0, 1).map(r => fitRing(r, 1, {area: cellArea(r, 0, 1), ...opts}));
  assert.equal(rings.length, 1);
  const edge = rings[0].filter(([px, pz]) => px > 15 && px < n - 15 && pz > 12).sort((a, b) => a[0] - b[0]);
  const mx = edge.reduce((a, p) => a + p[0], 0) / edge.length, mz = edge.reduce((a, p) => a + p[1], 0) / edge.length;
  const k = edge.reduce((a, p) => a + (p[0] - mx) * (p[1] - mz), 0) / edge.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  let flips = 0, last = 0;
  for (let q = 2; q < edge.length; q++) { const [a, b, c] = [edge[q - 2], edge[q - 1], edge[q]], t = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(t) > 1e-4) { const sg = Math.sign(t); if (last && sg !== last) flips++; last = sg; } }
  return {off: Math.max(...edge.map(([px, pz]) => Math.abs(pz - (mz + k * (px - mx))) / Math.hypot(1, k))), flips};
 };
 const now = bend({}), first = bend({tol: .55, spline: false});
 assert.ok(now.flips < first.flips, `it turns one way then the other ${now.flips} times along the edge (${first.flips} the first way)`);
 assert.ok(now.off < 1, `the edge bends ${now.off.toFixed(2)} m off a straight line (the cells' own steps wander about a metre)`);
 // A 10 x 8 m blob of a tee on 1 m land (an L-shaped step in its cells).
 const blob = (i, j) => { const u = (i - 20) / 5, v = (j - 20) / 4; return u * u + v * v <= 1 || (i === 16 && j === 23); };
 const [b] = maskRings(blob, 40, 40, 0, 0, 1).map(r => fitRing(r, 1, {area: cellArea(r, 0, 1)}));
 assert.ok(b.every(([px, pz]) => Math.hypot((px - 20) / 5.6, (pz - 20) / 4.6) <= 1.12), 'nothing a metre out past the blob');
});

test('two separate blobs are two rings; an empty or full mask is handled', () => {
 const rings = maskRings((i, j) => (i < 5 || i > 14) && j > 2 && j < 8, 20, 10, 0, 0, 1);
 assert.equal(rings.length, 2);
 assert.equal(maskRings(() => false, 10, 10, 0, 0, 1).length, 0);
 assert.equal(maskRings(() => true, 10, 10, 0, 0, 1).length, 1);
});
