// Outlines from a mask (src/contour.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {maskRings, simplify, ringArea} from '../src/contour.js';
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

test('two separate blobs are two rings; an empty or full mask is handled', () => {
 const rings = maskRings((i, j) => (i < 5 || i > 14) && j > 2 && j < 8, 20, 10, 0, 0, 1);
 assert.equal(rings.length, 2);
 assert.equal(maskRings(() => false, 10, 10, 0, 0, 1).length, 0);
 assert.equal(maskRings(() => true, 10, 10, 0, 0, 1).length, 1);
});
