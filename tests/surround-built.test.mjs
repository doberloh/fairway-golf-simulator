// A built course's own surroundings (the surroundings rework): the record in
// the file (course-doc.js), in the world the game makes from it
// (built-world.js) and in the builder's model (builder/editing.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeBuiltFile, readBuiltFile, validateDoc} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {createEditor} from '../src/builder/editing.js';
import {draftFromDoc} from '../src/builder/draft-from-doc.js';
import {ringMesh} from '../src/landscape-edge.js';
import {seaLevelUnder, SURROUND_KINDS, SURROUND_NAMES} from '../src/surround-sides.js';
import {surroundTrees} from '../src/surround.js';

const square = (cx, cz, r) => [[[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]]];
function tinyDoc(over = {}) {
 const nx = 121, nz = 101, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = 470 + Math.sin(i * .07) * 3.21 + j * .013;
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -50 + i * 10, z: -40, set: 'middle'}], green: {x: -50 + i * 10, z: 40}, line: [[-50 + i * 10, -40], [-50 + i * 10, 40]]}));
 return {type: 'built', name: 'Test Links', landscape: 'parkland', designer: null, halfX: 60, halfZ: 50,
  land: {x0: -60, z0: -50, cell: 1, nx, nz, heights},
  patches: [],
  surfaces: {green: [square(0, 40, 8)], fairway: [square(0, 0, 15)], tee: [square(0, -40, 3)], sand: [square(12, 30, 2.5)]},
  water: [], holes, trees: new Float32Array([10, 10, 15, 4, .3, 0, 0, -20, 5, 8, 2.5, .2, 1, -1]), treeKinds: ['oak'], credits: ['Test data'], from: null, picture: null, ...over};
}
const SEA_EAST = {sides: {n: 'auto', e: 'sea', s: 'range', w: 'auto'}, height: 1.2};

test('the file keeps the record, and leaves it out when every choice is the landscape\'s own', async () => {
 const kept = validateDoc(tinyDoc({surround: SEA_EAST}));
 assert.deepEqual(kept.surround, SEA_EAST);
 const back = await readBuiltFile(await writeBuiltFile(kept));
 assert.deepEqual(back.surround, SEA_EAST);
 assert.ok(!('surround' in validateDoc(tinyDoc())), 'a course that never chose has none');
 assert.ok(!('surround' in validateDoc(tinyDoc({surround: {sides: {n: 'auto', e: 'auto', s: 'auto', w: 'auto'}, height: 1}}))), 'all auto is no record');
 assert.ok(!('surround' in await readBuiltFile(await writeBuiltFile(validateDoc(tinyDoc())))));
 // A kind this copy does not know reads as the landscape's own.
 assert.deepEqual(validateDoc(tinyDoc({surround: {sides: {e: 'volcano', w: 'mesas'}, height: 5, cover: 2}})).surround, {sides: {n: 'auto', e: 'auto', s: 'auto', w: 'mesas'}, height: 2, cover: 1});
 for (const k of SURROUND_KINDS) assert.ok(SURROUND_NAMES[k], `${k} has a name a player reads`);
});

test('the game\'s world carries it: a side of water is a sea under the land, and floods none of the course', () => {
 const plain = worldFromDoc(validateDoc(tinyDoc()));
 assert.equal(plain.surround, null);
 assert.equal(plain.bio.sea, false);
 const doc = validateDoc(tinyDoc({surround: SEA_EAST})), w = worldFromDoc(doc);
 assert.deepEqual(w.surround, SEA_EAST);
 assert.equal(w.bio.sea, true, 'a landscape with no sea has one when a side asks');
 assert.ok(Math.abs(w.waterLevel - seaLevelUnder(doc.land.heights)) < 1e-9);
 let low = Infinity; for (const h of doc.land.heights) low = Math.min(low, h);
 assert.ok(Math.abs(w.waterLevel - (low - 2.5)) < .02, `the sea stands ${(low - w.waterLevel).toFixed(2)} m under the lowest land`);
 // No part of the land is water for it: the same lies as the course without.
 for (let x = -58; x <= 58; x += 7) for (let z = -48; z <= 48; z += 7) assert.equal(w.surface(x, z), plain.surface(x, z), `the lie at ${x}, ${z}`);
 // Past the east side the drawn ground goes under the water; past the west it does not.
 const P = ringMesh(w, {grow: 1.1}).positions;
 let east = 0, wet = 0, west = 0, dry = 0;
 for (let i = 0; i < P.length; i += 3) {
  if (Math.abs(P[i + 2]) > w.halfZ) continue;
  if (P[i] > w.groundGrid.halfX + 400) { east++; if (P[i + 1] < w.waterLevel) wet++; }
  if (P[i] < -w.groundGrid.halfX - 400) { west++; if (P[i + 1] >= w.waterLevel) dry++; }
 }
 assert.ok(east > 10 && wet === east, `${wet} of ${east} ring vertices past the east side are under water`);
 assert.ok(west > 10 && dry === west, `${dry} of ${west} past the west side are land`);
 // And no tree stands in that sea.
 const far = surroundTrees(w, {reach: 1500, detail: {grow: 1.1}}).far;
 for (const s of far) assert.ok(s.y >= w.waterLevel, 'no tree under the water');
 // A file with a sea of its own keeps its level.
 assert.equal(worldFromDoc(validateDoc(tinyDoc({surround: SEA_EAST, sea: {level: 460}}))).waterLevel, 460);
});

test('how wooded the surroundings are is the course\'s to say', () => {
 const none = surroundTrees(worldFromDoc(validateDoc(tinyDoc({surround: {sides: {}, height: 1, cover: 0}}))), {reach: 1200, detail: {grow: 1.1}});
 const thick = surroundTrees(worldFromDoc(validateDoc(tinyDoc({surround: {sides: {}, height: 1, cover: 1}}))), {reach: 1200, detail: {grow: 1.1}});
 assert.equal(none.far.length + none.near.length, 0, 'cover 0 is no trees');
 assert.ok(thick.far.length > 2000, `${thick.far.length} trees at full cover`);
});

test('the builder\'s model holds it, saves it and carries it back to 2D', () => {
 const ed = createEditor(validateDoc(tinyDoc()));
 assert.equal(ed.state.surround, null);
 ed.setSurround(SEA_EAST);
 assert.deepEqual(ed.state.surround, SEA_EAST);
 assert.ok(ed.state.changed);
 assert.deepEqual(validateDoc(ed.toDoc()).surround, SEA_EAST);
 // Set back to the landscape's own, the record leaves the file.
 ed.setSurround({sides: {n: 'auto', e: 'auto', s: 'auto', w: 'auto'}, height: 1});
 assert.equal(ed.state.surround, null);
 assert.ok(!('surround' in validateDoc(ed.toDoc())));
 // Opened from a file that has one, and taken back to door 2.
 const doc = validateDoc(tinyDoc({surround: SEA_EAST}));
 assert.deepEqual(createEditor(doc).state.surround, SEA_EAST);
 assert.deepEqual(draftFromDoc(doc).surround, SEA_EAST);
});
