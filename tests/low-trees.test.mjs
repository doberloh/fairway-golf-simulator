// LOW NEVER LEAVES OUT A TREE OF THE HOLE BEING PLAYED (src/low-trees.js; the
// owner, 9 November 2026). Every hole of a generated course and of a built one,
// the ball walked from the tee to the green: every tree within the hole's reach
// of its line, or the ball's reach of the ball, is drawn -- by the tree's own
// test and by its square's (the prefix instance-cull.js draws). Away from the
// hole the share falls with distance, and in free flight the camera keeps its
// own ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';
import {LOW_TREES, holePath, protectedAt, keepAt, drawnAt, squareKeep, shareAt, treeHash, pathDistance2} from '../src/low-trees.js';

const CELL = 64;   // instance-cull.js squares
const squareOf = (x, z) => ({x0: Math.floor(x / CELL) * CELL, x1: Math.floor(x / CELL) * CELL + CELL, z0: Math.floor(z / CELL) * CELL, z1: Math.floor(z / CELL) * CELL + CELL});

function everyHoleKeepsItsTrees(world, label) {
 let checked = 0;
 for (const hole of world.holes) {
  const path = holePath(hole);
  assert.ok(path.length >= 4, `${label}: hole ${hole.number ?? '?'} has a line`);
  for (let along = 0; along <= hole.length; along += hole.length / 6) {
   const ballAt = hole.toWorld({x: 0, z: along});
   // The camera behind the ball, as play stands it, and up in the overview.
   for (const camera of [hole.toWorld({x: 0, z: along - 8}), hole.toWorld({x: 0, z: hole.length / 2})]) {
    const region = {path, ball: ballAt, camera, flying: false};
    for (const t of world.trees) {
     const own = pathDistance2(path, t.x, t.z) <= LOW_TREES.holeReach ** 2 || (t.x - ballAt.x) ** 2 + (t.z - ballAt.z) ** 2 <= LOW_TREES.ballReach ** 2;
     if (!own) continue;
     checked++;
     assert.ok(protectedAt(region, t.x, t.z), `${label}: a tree of the hole is not protected`);
     assert.equal(keepAt(region, t.x, t.z), 1);
     assert.ok(drawnAt(region, t.x, t.z), `${label}: a tree of the hole would not be drawn`);
     assert.equal(squareKeep(region, squareOf(t.x, t.z)), 1, `${label}: the square of a tree of the hole is thinned`);
    }
   }
  }
 }
 return checked;
}

test('a generated course: every hole keeps every tree of its own, tee to green', () => {
 const world = generateWorld({...DEFAULT_COURSE, seed: 'LOW-TREES', biome: 'pacnw', holes: 9});
 assert.ok(world.trees.length > 1000, 'a wooded course');
 const n = everyHoleKeepsItsTrees(world, 'generated');
 assert.ok(n > 1000, `checked ${n}`);
});

test('a built course: every hole keeps every tree of its own, tee to green', async () => {
 const w = generateWorld({...DEFAULT_COURSE, seed: 'LOW-TREES-BUILT', biome: 'redwood', holes: 9});
 const world = worldFromDoc(await readBuiltFile(await writeBuiltFile(freezeWorld(w, {name: 'Low trees'}), BUILT_VERSION)), {});
 assert.ok(world.trees.length > 1000);
 const n = everyHoleKeepsItsTrees(world, 'built');
 assert.ok(n > 1000, `checked ${n}`);
});

test('a square\'s share is never under any of its trees\' own', () => {
 const world = generateWorld({...DEFAULT_COURSE, seed: 'LOW-TREES', biome: 'pacnw', holes: 9});
 const hole = world.holes[3], region = {path: holePath(hole), ball: hole.toWorld({x: 0, z: 100}), camera: hole.toWorld({x: 0, z: 92}), flying: false};
 for (const t of world.trees) assert.ok(squareKeep(region, squareOf(t.x, t.z)) >= keepAt(region, t.x, t.z) - 1e-9);
});

test('away from the hole the share falls with distance, and free flight keeps the camera\'s ring', () => {
 assert.equal(shareAt(0), 1);
 assert.equal(shareAt(LOW_TREES.nearAll), 1);
 assert.equal(shareAt(LOW_TREES.thinTo), LOW_TREES.minKeep);
 assert.ok(shareAt((LOW_TREES.nearAll + LOW_TREES.thinTo) / 2) < 1);
 const far = {path: new Float32Array([0, 0, 0, 10]), ball: {x: 0, z: 0}, camera: {x: 5000, z: 5000}, flying: false};
 assert.equal(keepAt(far, 5100, 5000), 1, 'within the camera\'s near ring all are kept');
 assert.ok(keepAt(far, 5000 + LOW_TREES.flyReach - 10, 5000) < 1, 'walking, a tree 240 m off is thinned');
 assert.equal(keepAt({...far, flying: true}, 5000 + LOW_TREES.flyReach - 10, 5000), 1, 'flying, it is kept');
 assert.equal(squareKeep({...far, flying: true}, {x0: 5200, x1: 5264, z0: 5000, z1: 5064}), 1);
});

test('a tree\'s place in the order is fixed and spread evenly', () => {
 assert.equal(treeHash(12.3, -40.1), treeHash(12.3, -40.1));
 let low = 0; const n = 20000;
 for (let i = 0; i < n; i++) if (treeHash(i * 3.7 - 500, (i % 97) * 11.3) < .5) low++;
 assert.ok(Math.abs(low / n - .5) < .02, `half under .5: ${low / n}`);
});
