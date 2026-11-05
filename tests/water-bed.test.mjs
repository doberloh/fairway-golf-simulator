// A pond's bed (src/builder/water-bed.js) and the editor's ponds: the water
// has to stand above the ground it covers, or the game draws none of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {digBed, levelFrom, shoreOf, BED} from '../src/builder/water-bed.js';
import {createEditor} from '../src/builder/editing.js';
import {validateDoc} from '../src/course-doc.js';

const square = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
function grid(rise = (x, z) => 100) {
 const nx = 201, nz = 201, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = rise(-100 + i, -100 + j);
 return {heights, nx, nz, cell: 1, x0: -100, z0: -100};
}
const at = (g, x, z) => g.heights[(z + 100) * g.nx + x + 100];

test('on flat ground the whole pond is under its water', () => {
 const g = grid(), ring = square(-20, -20, 20, 20), level = levelFrom(shoreOf([ring], () => 100));
 assert.ok(level < 100);
 digBed(g, [ring], level);
 for (let z = -19; z <= 19; z += 4) for (let x = -19; x <= 19; x += 4) assert.ok(at(g, x, z) <= level - BED.shelf + 1e-3, `${x}, ${z}: ${at(g, x, z)}`);
 assert.ok(at(g, 0, 0) < level - 1, 'deeper in the middle');
 assert.ok(at(g, 60, 60) === 100, 'land far off is left alone');
});

test('on a hillside the sheet neither sinks into the slope nor hangs in the air', () => {
 const g = grid((x) => 100 + x * .2), ring = square(-20, -20, 20, 20), level = levelFrom(shoreOf([ring], (x) => 100 + x * .2));
 digBed(g, [ring], level);
 for (let x = -19; x <= 19; x++) assert.ok(at(g, x, 0) < level, `the bed at x ${x} is under the water`);
 // Every shore point is within a shelf of the water: the sheet meets ground.
 for (const x of [-21, 21]) { assert.ok(Math.abs(at(g, x, 0) - level) < 1, `the bank at x ${x} meets the water: ${at(g, x, 0)} against ${level}`); }
 // The high bank climbs no steeper than a bank.
 for (let x = 22; x < 60; x++) assert.ok(at(g, x + 1, 0) - at(g, x, 0) <= BED.slope + 1e-3, `no cliff behind it at x ${x}`);
});

test('digging twice changes nothing: every Save digs', () => {
 const g = grid((x, z) => 100 + x * .15 + Math.sin(z * .2)), ring = square(-20, -20, 20, 20), level = 92;
 digBed(g, [ring], level); const once = Float32Array.from(g.heights);
 digBed(g, [ring], level);
 assert.deepEqual(g.heights, once);
});

test('an island stays land; a green beside the water keeps its ground; a bed already deep stays', () => {
 const g = grid(), rings = [square(-40, -40, 40, 40), square(-5, -5, 5, 5)];
 g.heights[(30 + 100) * g.nx + 100] = 80;
 digBed(g, rings, 99.8, {keep: (x, z) => x > 42});
 assert.equal(at(g, 0, 0), 100, 'the island');
 assert.equal(at(g, 0, 30), 80, 'the deep hole');
 assert.equal(at(g, 45, 0), 100, 'the green');
});

test('a grid the water does not reach is left alone', () => {
 const g = grid();
 assert.equal(digBed(g, [square(500, 500, 520, 520)], 99), null);
});

function doc(rise = () => 100) {
 const nx = 201, nz = 201, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = rise(-100 + i, -100 + j);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Ponds', landscape: 'puget', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz, heights}, patches: [],
  surfaces: {green: [[square(-10, 70, 10, 90)]], fairway: [[square(-12, -60, 12, 60)]]}, water: [], holes, trees: new Float32Array(0), treeKinds: []});
}

test('a pond drawn in the editor is dug at once, and one undo fills it again', () => {
 const e = createEditor(doc((x) => 100 + x * .1)), ring = square(40, -20, 70, 10), before = e.height(55, -5);
 const level = e.addPond({ring});
 assert.ok(e.height(55, -5) < level, `the ground under the pond (${e.height(55, -5)}) is below its water (${level})`);
 assert.equal(e.surfaceAt(55, -5), 'water');
 e.undo();
 assert.equal(e.height(55, -5), before); assert.equal(e.state.water.length, 0); assert.equal(e.surfaceAt(55, -5), 'rough');
 e.redo();
 assert.ok(e.height(55, -5) < level); assert.equal(e.state.water.length, 1);
});

test('a course saved with water standing under the land comes right when saved again', () => {
 const old = doc(); old.water = [{rings: [square(-50, -30, -30, -10)], level: 99.7, kind: 'pond'}];
 const out = createEditor(old).toDoc(), h = (x, z) => out.land.heights[(z + 100) * out.land.nx + x + 100];
 assert.equal(old.land.heights[(-20 + 100) * 201 + 60], 100, 'the file it came from is not changed');
 assert.ok(h(-40, -20) < 99.7, `dug: ${h(-40, -20)}`);
 const again = createEditor(out).toDoc();
 assert.deepEqual(again.land.heights, out.land.heights, 'and saving again moves nothing');
});

test('water painted over a hill in a course file gets a level and a bed in the file', () => {
 const e = createEditor(doc((x) => 100 + x * .2));
 e.state.surfacesEdited = true;
 e.paint({kind: 'water', x: 40, z: 0, radius: 15});
 const out = e.toDoc(), w = out.water[0], h = out.land.heights[100 * out.land.nx + 140];
 assert.equal(out.water.length, 1);
 assert.ok(h < w.level, `the middle of the painted water: ground ${h}, water ${w.level}`);
});
