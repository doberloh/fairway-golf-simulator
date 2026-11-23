// The wood Fill outside plants, sized from the survey (wood-size.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {woodSizer, WOOD} from '../src/builder/wood-size.js';
import {createTrace} from '../src/builder/trace-edit.js';

// A 101 m square at 1 m: a wood of 25 m canopy on the west half, an open
// field on the east, and a 9 m roof at (30, 0).
function land() {
 const nx = 101, nz = 101, cell = 1, halfX = 50, halfZ = 50, canopy = new Float32Array(nx * nz), building = new Uint8Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = -halfX + i; if (x < -5) canopy[j * nx + i] = 25; }
 for (let j = 48; j <= 52; j++) for (let i = 78; i <= 82; i++) { canopy[j * nx + i] = 9; building[j * nx + i] = 200; }
 return {nx, nz, cell, halfX, halfZ, canopy, building};
}
const survey = [{x: -30, z: 0, h: 25, crown: 7.5}, {x: -30, z: 30, h: 18, crown: 4}];

test('a tree under the canopy is as tall as it, its crown in the nearest survey tree\'s proportion', () => {
 const size = woodSizer(land(), survey), t = size(-28, 2, () => .5);
 assert.equal(t.h, 25);
 assert.ok(Math.abs(t.crown - 25 * 7.5 / 25) < 1e-9, `crown ${t.crown}`);
 // Far from any survey tree: the placed proportion.
 const far = woodSizer(land(), [{x: 40, z: 40, h: 10, crown: 3}])(-45, -45, () => .5);
 assert.ok(Math.abs(far.crown - 25 * WOOD.crown) < 1e-9);
});

test('on open ground a tree takes one of the survey\'s own sizes; a roof is not canopy', () => {
 const size = woodSizer(land(), survey);
 assert.deepEqual(size(20, 0, () => .1), {h: 25, crown: 7.5});
 assert.deepEqual(size(20, 0, () => .9), {h: 18, crown: 4});
 assert.equal([0, .5, .99].map(r => size(30, 0, () => r).h).every(h => h === 25 || h === 18), true, 'beside the roof, a survey tree\'s size, not 9 m');
});

test('nothing to size from: null, and Fill outside plants its old sizes', () => {
 const bare = {...land(), canopy: new Float32Array(101 * 101)};
 assert.equal(woodSizer(bare, []), null);
 assert.equal(woodSizer(null, survey), null);
 assert.ok(woodSizer(bare, survey), 'the survey\'s trees alone are enough');
});

test('Fill outside plants the sizes it is given', () => {
 const grid = {nx: 101, nz: 101, cell: 1, halfX: 50, halfZ: 50};
 const ring = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
 const t = createTrace(grid), n = t.fillOutside(ring, {density: 200, edge: 2, seed: 3, size: woodSizer(land(), survey)});
 assert.ok(n > 50);
 const trees = t.state.trees, west = trees.filter(q => q.x < -10), east = trees.filter(q => q.x > 10);
 assert.ok(west.every(q => q.h === 25), 'under the 25 m wood, 25 m');
 assert.ok(east.every(q => q.h === 25 || q.h === 18), 'on the field, the survey\'s sizes');
 const old = createTrace(grid); old.fillOutside(ring, {density: 200, edge: 2, seed: 3});
 assert.ok(old.state.trees.every(q => q.h >= 10 && q.h <= 22), 'with no sizer, 10 to 22 m as before');
});
