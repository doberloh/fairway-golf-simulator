// Back and forth between door 2's trace and the 3D editor (round-trip.js; the
// owner, 1 November 2026: "keeping changes made in both directions"): a
// course made from a trace, edited in the editor, taken back, and made again
// -- with the editor's bunker, hill, tee, par, tree and house in it, and the
// layers it did not touch exactly as the trace had them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {docFromLand} from '../src/builder/real-course.js';
import {createEditor} from '../src/builder/editing.js';
import {cellLayers} from './fixtures/cell-layers.mjs';
import {PALETTE} from '../src/builder/trace-edit.js';
import {validateDoc, TREE_STRIDE} from '../src/course-doc.js';
import {fromEditor} from '../src/builder/round-trip.js';
import * as S from '../src/builder/shapes.js';

function course() {
 const cell = .5, halfX = 80, halfZ = 100, nx = 321, nz = 401, N = nx * nz;
 const ground = new Float32Array(N).fill(100), layers = cellLayers(nx, nz);
 const at = (x, z) => Math.round((z + halfZ) / cell) * nx + Math.round((x + halfX) / cell);
 const fairway = layers.mask('fairway', true), green = layers.mask('green', true), tee = layers.mask('tee', true);
 // Nine holes side by side, 16 m apart; the fifth down the middle.
 const holes = [];
 for (let n = 0; n < 9; n++) {
  const hx = -64 + n * 16;
  for (let z = -45; z <= 50; z += cell) for (let x = hx - 3; x <= hx + 3; x += cell) fairway[at(x, z)] = 1;
  for (let z = -56; z <= -44; z += cell) for (let x = hx - 6; x <= hx + 6; x += cell) if (Math.hypot(x - hx, z + 50) < 5) green[at(x, z)] = 1;
  for (let z = 52; z <= 58; z += cell) for (let x = hx - 2; x <= hx + 2; x += cell) tee[at(x, z)] = 1;
  holes.push({tees: [{x: hx, z: 55, set: 'back'}], aims: [], green: {x: hx, z: -50}});
 }
 layers.recompose();
 const land = {nx, nz, cell, halfX, halfZ, ground};
 const trees = [{x: 24, z: 0, h: 12, crown: 4}];
 // The fixture drawn in cells, the trace's outlines made from it once.
 const shapes = new Map([...layers.masks].map(([k, m]) => [k, S.fromMask(m, land)]));
 return {land, shapes, holes, trees};
}
const make = (c, extra = {}) => validateDoc(docFromLand({land: c.land, traced: {shapes: c.shapes}, holes: c.holes.map((h, i) => ({number: i + 1, par: h.par ?? null, index: h.index ?? null, tees: h.tees, green: h.green, line: [[h.tees[0].x, h.tees[0].z], ...h.aims.map(a => [a.x, a.z]), [h.green.x, h.green.z]]})), trees: c.trees, homes: c.homes ?? [], name: 'Round trip', ...extra}));

test('the editor\'s work comes back to the trace and into the next course; the layers it left alone stay as they were', () => {
 const c = course(), base = make(c), e = createEditor(base);
 const fairwayBefore = c.shapes.get('fairway');
 // In 3D: a bunker, a hill, the tee moved, the par set, a tree planted, a house.
 e.paint({kind: 'sand', x: 6, z: 0, radius: 2.5});
 e.shape({op: 'raise', x: -40, z: 0, radius: 8, strength: 1});
 e.setTee(4, 'back', 0, 60);
 e.setPar(4, 5);
 e.addTree([40, 30, 14, 5, .4, 2, -1]);
 assert.ok(e.addHome({x: 0, z: 85}));
 const now = e.toDoc(), changed = e.changedLayers();
 assert.deepEqual([...changed.keys()], ['sand'], 'only the painted layer changed');
 const got = fromEditor({base, now, grid: c.land, changed, holesBefore: c.holes});
 // The trace takes them.
 assert.ok(S.contains(got.shapes.get('sand'), 6, 0) && !got.shapes.has('fairway'));
 assert.ok(got.landEdits && got.landEdits.some(d => d > .1), 'the hill as a difference');
 assert.deepEqual(got.holes[4].tees[0], {x: 0, z: 60, set: 'back'});
 assert.equal(got.holes[4].par, 5, 'a par set in 3D stays set');
 assert.equal(got.holes[4].index, null, 'an index it did not touch stays worked out');
 assert.ok(got.trees.some(t => t.x === 40 && t.kept), 'the planted tree, kept');
 assert.ok(got.trees.some(t => t.x === 24 && !t.kept), 'the survey\'s tree, as it was');
 assert.equal(got.homes.length, 1);
 // Door 2 applies them (as door-real.js remount does) and makes the course again.
 for (const [k, set] of got.shapes) c.shapes.set(k, set);
 Object.assign(c, {holes: got.holes, trees: got.trees, homes: got.homes});
 const again = make(c, {landEdits: got.landEdits});
 assert.equal(c.shapes.get('fairway'), fairwayBefore, 'the fairway exactly as traced');
 assert.ok(again.surfaces.sand?.length, 'the bunker in the course');
 const k = 200 * 321 + Math.round((-40 + 80) / .5);
 assert.ok(Math.abs(again.land.heights[k] - now.land.heights[k]) < .01, `the hill as shaped: ${again.land.heights[k]} against ${now.land.heights[k]}`);
 assert.equal(again.holes[4].par, 5);
 assert.deepEqual(again.holes[4].tees[0], {x: 0, z: 60, set: 'back'});
 const xs = []; for (let q = 0; q < again.trees.length; q += TREE_STRIDE) xs.push(again.trees[q]);
 assert.ok(xs.includes(40) && xs.includes(24), 'both trees');
 assert.equal(again.homes.length, 1);
 // And into the editor again: nothing left to carry.
 const e2 = createEditor(again), back = fromEditor({base: again, now: e2.toDoc(), grid: c.land, changed: e2.changedLayers(), holesBefore: c.holes});
 assert.equal(back.shapes.size, 0); assert.equal(back.landEdits, null);
});
