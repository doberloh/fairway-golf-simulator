// The course builder's editing model (src/builder/editing.js): every tool,
// undo and redo, and the document it gives back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor, PAINT, CODE, falloff} from '../src/builder/editing.js';
import {worldFromDoc} from '../src/built-world.js';
import {validateDoc, TREE_STRIDE} from '../src/course-doc.js';

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc() {
 const nx = 201, nz = 201, heights = new Float32Array(nx * nz).fill(100);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Edit me', landscape: 'pnw', halfX: 100, halfZ: 100,
  land: {x0: -100, z0: -100, cell: 1, nx, nz, heights},
  patches: [{x0: -15, z0: 65, cell: .25, nx: 121, nz: 121, heights: new Float32Array(121 * 121).fill(100)}],
  surfaces: {green: [box(-10, 70, 10, 90)], fairway: [box(-12, -60, 12, 60)], semi: [box(-18, -66, 18, 66)], sand: [box(20, 0, 26, 6)], heather: [box(50, -50, 90, 50)]},
  water: [{rings: box(-60, -10, -40, 10), level: 99, kind: 'pond'}], holes,
  trees: new Float32Array([30, 30, 15, 4, .4, 2, -1, 32, 30, 14, 4, .4, 2, -1, 70, 70, 12, 3, .3, 1, -1]), treeKinds: []});
}

test('the grid starts as the outlines say, in the field\'s order', () => {
 const e = createEditor(doc());
 assert.equal(e.surfaceAt(0, 80), 'green');
 assert.equal(e.surfaceAt(0, 0), 'fairway', 'fairway over its semi corridor');
 assert.equal(e.surfaceAt(15, 0), 'semi');
 assert.equal(e.surfaceAt(23, 3), 'sand');
 assert.equal(e.surfaceAt(-50, 0), 'water');
 assert.equal(e.surfaceAt(70, 0), 'heather');
 assert.equal(e.surfaceAt(-90, -90), 'rough');
 assert.equal(PAINT[CODE.water], 'water');
});

test('a brush falls off to nothing at its edge, and raise, flatten, smooth and restore do what they say', () => {
 assert.equal(falloff(0), 1); assert.equal(falloff(1), 0); assert.ok(falloff(.5) > 0 && falloff(.5) < 1);
 const e = createEditor(doc());
 e.shape({op: 'raise', x: 0, z: 0, radius: 10, strength: 1});
 assert.ok(Math.abs(e.height(0, 0) - 100.5) < 1e-3, `centre ${e.height(0, 0)}`);
 assert.equal(e.height(0, 11), 100, 'outside the radius untouched');
 e.shape({op: 'flatten', x: 0, z: 0, radius: 10, strength: 1, level: 100});
 assert.ok(Math.abs(e.height(0, 0) - 100) < 1e-3);
 e.shape({op: 'lower', x: 0, z: 0, radius: 6, strength: 1}); e.shape({op: 'smooth', x: 0, z: 0, radius: 6, strength: 1});
 assert.ok(e.height(0, 0) > 99.5 && e.height(0, 0) < 100, 'smoothing lifts a dent toward its rim');
 e.shape({op: 'restore', x: 0, z: 0, radius: 10, strength: 1});
 assert.ok(Math.abs(e.height(0, 0) - 100) < 1e-3, 'restore puts the land back');
});

test('a brush on a green shapes its fine patch too', () => {
 const e = createEditor(doc());
 e.shape({op: 'raise', x: 0, z: 80, radius: 4, strength: 1});
 assert.ok(e.height(0, 80) > 100.4, `the green rose (${e.height(0, 80)})`);
 assert.ok(e.state.patches[0].heights.some(h => h > 100.4), 'the patch itself changed');
});

test('a ramp grades between two points', () => {
 const e = createEditor(doc());
 e.shape({op: 'ramp', a: {x: -50, z: -50, y: 100}, b: {x: -50, z: -20, y: 106}, radius: 4, strength: 1});
 assert.ok(Math.abs(e.height(-50, -35) - 103) < .05, `half way up (${e.height(-50, -35)})`);
});

test('paint and fill change the grid; undo and redo put it back and forward', () => {
 const e = createEditor(doc());
 const g = {};
 e.paint({kind: 'sand', x: 0, z: 0, radius: 3, group: g});
 e.paint({kind: 'sand', x: 4, z: 0, radius: 3, group: g});
 assert.equal(e.surfaceAt(0, 0), 'sand'); assert.equal(e.surfaceAt(5, 0), 'sand');
 assert.equal(e.state.undo.length, 1, 'a drag is one undo');
 e.undo();
 assert.equal(e.surfaceAt(0, 0), 'fairway'); assert.equal(e.surfaceAt(5, 0), 'fairway');
 e.redo();
 assert.equal(e.surfaceAt(5, 0), 'sand');
 e.fillOutline({kind: 'tee', ring: [[-90, -95], [-80, -95], [-80, -88], [-90, -88]]});
 assert.equal(e.surfaceAt(-85, -90), 'tee');
});

test('a drag of the land is one undo, and undo restores every sample it touched', () => {
 const e = createEditor(doc());
 const g = {};
 for (let x = -30; x <= 30; x += 5) e.shape({op: 'raise', x, z: 0, radius: 8, strength: 1, group: g});
 assert.equal(e.state.undo.length, 1);
 assert.ok(e.height(-30, 0) > 100 && e.height(30, 0) > 100);
 e.undo();
 for (let x = -40; x <= 40; x += 2) assert.ok(Math.abs(e.height(x, 0) - 100) < 1e-4, `x ${x}: ${e.height(x, 0)}`);
});

test('holes, trees, water and the landscape are records with undo', () => {
 const e = createEditor(doc());
 e.setGreen(0, 5, 85); assert.deepEqual(e.state.holes[0].green, {x: 5, z: 85});
 e.addBend(0, 10, 0); assert.equal(e.state.holes[0].line.length, 3);
 e.setTee(0, 'front', -5, -60); assert.equal(e.state.holes[0].tees.length, 2);
 e.removeTrees({x: 31, z: 30, radius: 3}); assert.equal(e.state.trees.length, 1);
 e.undo(); assert.equal(e.state.trees.length, 3);
 const level = e.addPond({ring: [[60, -90], [80, -90], [80, -75], [60, -75]]});
 assert.ok(level < 100); assert.equal(e.surfaceAt(70, -80), 'water'); assert.equal(e.state.water.length, 2);
 e.undo(); assert.equal(e.state.water.length, 1); assert.equal(e.surfaceAt(70, -80), 'rough', 'undoing a pond takes its water off the grid too');
 e.setLandscape('desert'); assert.equal(e.state.landscape, 'desert');
});

test('the document it gives back is a valid course that plays what was edited', () => {
 const e = createEditor(doc());
 e.paint({kind: 'sand', x: 0, z: 30, radius: 4});
 e.shape({op: 'raise', x: 0, z: 30, radius: 6, strength: 1});
 e.setLandscape('autumn');
 const out = validateDoc(e.toDoc());
 const w = worldFromDoc(out);
 assert.equal(w.surface(0, 30), 'sand');
 assert.equal(w.surface(0, 0), 'fairway');
 assert.equal(w.surface(0, 80), 'green');
 assert.equal(w.surface(-50, 0), 'water');
 assert.equal(w.surface(70, 0), 'heather');
 assert.ok(w.height(0, 30) > 100.3);
 assert.equal(out.landscape, 'autumn'); assert.equal(w.bio.name, worldFromDoc({...out, landscape: 'autumn'}).bio.name);
 assert.equal(out.water.length, 1); assert.equal(out.water[0].level, 99, 'the pond keeps its level');
 assert.equal(out.trees.length, 3 * TREE_STRIDE);
 const untouched = createEditor(doc()).toDoc();
 assert.deepEqual(untouched.surfaces.green, doc().surfaces.green, 'an unpainted course keeps its own outlines');
});
