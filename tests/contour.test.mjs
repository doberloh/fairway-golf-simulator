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

test('two separate blobs are two rings; an empty or full mask is handled', () => {
 const rings = maskRings((i, j) => (i < 5 || i > 14) && j > 2 && j < 8, 20, 10, 0, 0, 1);
 assert.equal(rings.length, 2);
 assert.equal(maskRings(() => false, 10, 10, 0, 0, 1).length, 0);
 assert.equal(maskRings(() => true, 10, 10, 0, 0, 1).length, 1);
});
