// THE GROUND DRAWN COARSER WITH DISTANCE (src/ground-lod.js; the frame-rate
// goal, 9 November 2026). Drawing only: the squares cover the ground exactly
// once whatever the camera, a leaf's own triangles are exactly the grid's,
// and what is drawn coarse stands off the ground the ball meets by no more
// than the tolerance in pixels, seen from the camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGroundGrid, groundHeight} from '../src/terrain-grid.js';
import {buildGroundLod, select, nodeBox} from '../src/ground-lod.js';

// Rough land, 1.2 by 0.9 km, refined where it bends -- as a LIDAR course is.
const land = (x, z) => 30 * Math.sin(x / 180) * Math.cos(z / 140) + 4 * Math.sin(x / 13 + z / 17) + .8 * Math.sin(x / 2.3) * Math.sin(z / 3.1);
const grid = makeGroundGrid(land, 600, 450, 3, (x, z, a, b, c, d) => a !== undefined && Math.abs(land(x, z) - (a + b + c + d) / 4) > .05);
const lod = buildGroundLod(grid);

test('every triangle of the grid is in exactly one leaf', () => {
 const leaves = lod.nodes.filter(n => n.level === 0);
 const total = leaves.reduce((s, n) => s + countGround(n.fine), 0);
 assert.equal(total, grid.indices.length / 3);
});
// A square's own triangles (its skirt's vertices are past the grid's).
function countGround(idx) { const base = grid.positions.length / 3; let n = 0; for (let k = 0; k < idx.length; k += 3) if (idx[k] < base && idx[k + 1] < base && idx[k + 2] < base) n++; return n; }

test('the squares drawn cover the ground once, from near and from far', () => {
 const area = (grid.nx * grid.dx) * (grid.nz * grid.dz);
 for (const camera of [{x: 0, y: 40, z: 0}, {x: -500, y: 5, z: 400}, {x: 0, y: 3000, z: 0}, {x: 2000, y: 100, z: 2000}]) {
  const drawn = select(lod, grid, camera, 900, 1);
  let sum = 0;
  for (const {node} of drawn) { const b = nodeBox(grid, node); sum += (b.x1 - b.x0) * (b.z1 - b.z0); }
  assert.ok(Math.abs(sum - area) < 1, `covered ${sum} of ${area}`);
 }
});

test('far off it is coarse, close by it is the grid itself', () => {
 const near = select(lod, grid, {x: 0, y: 2, z: 0}, 900, 1), far = select(lod, grid, {x: 0, y: 6000, z: 0}, 900, 1);
 assert.ok(near.some(s => s.fine), 'the square under the camera is drawn fine');
 assert.ok(far.length < near.length, `${far.length} squares from far, ${near.length} from near`);
 assert.ok(far.every(s => !s.fine));
});

test('what is drawn stands off the ground by under the tolerance, in pixels', () => {
 const focal = 900, tolerance = 1.5;
 const P = grid.positions;
 for (const camera of [{x: 10, y: 3, z: -20}, {x: -400, y: 60, z: 300}, {x: 0, y: 800, z: 0}]) {
  const drawn = select(lod, grid, camera, focal, tolerance);
  for (const {node, fine} of drawn) {
   if (fine) continue;
   const idx = node.coarse, b = nodeBox(grid, node);
   // The coarse surface at points of the ground inside the square: each
   // triangle's corners are ground vertices, so test its middle against the
   // ground the ball meets there.
   for (let k = 0; k < idx.length; k += 3 * 7) {
    const a = idx[k], bb = idx[k + 1], c = idx[k + 2];
    if (a * 3 >= P.length || bb * 3 >= P.length || c * 3 >= P.length) continue;
    const x = (P[a * 3] + P[bb * 3] + P[c * 3]) / 3, z = (P[a * 3 + 2] + P[bb * 3 + 2] + P[c * 3 + 2]) / 3, y = (P[a * 3 + 1] + P[bb * 3 + 1] + P[c * 3 + 1]) / 3;
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    const off = Math.abs(y - groundHeight(grid, x, z, land));
    const d = Math.max(1, Math.hypot(x - camera.x, y - camera.y, z - camera.z));
    assert.ok(off * focal / d <= tolerance + .25, `off by ${off.toFixed(2)} m at ${d.toFixed(0)} m: ${(off * focal / d).toFixed(2)} px`);
   }
  }
 }
});

test('skirts hang below their edges', () => {
 assert.ok(lod.extra.from.length > 0);
 for (const d of lod.extra.drop) assert.ok(d >= 2);
 for (const v of lod.extra.from) assert.ok(v < grid.positions.length / 3);
});
