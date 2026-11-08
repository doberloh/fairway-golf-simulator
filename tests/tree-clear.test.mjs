// Clearing trees from tees and greens (src/builder/tree-clear.js; the owner,
// 1 November 2026): a crown over a green drawn in to stop short of it, a tree
// with no room taken out, the rest left -- in door 2's trace and in the
// editor (one undo); the editor's tree height scale, saved; and a hole's
// yards as the game measures them (built-world.js builtLine), which the
// holes step's scorecard and the automatic par read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {clearTrees, CLEAR_MARGIN, MIN_CROWN} from '../src/builder/tree-clear.js';
import {createEditor} from '../src/builder/editing.js';
import {validateDoc, TREE_STRIDE} from '../src/course-doc.js';
import {worldFromDoc, builtLine, YARD} from '../src/built-world.js';
import {docFromLand} from '../src/builder/real-course.js';

const grid = {nx: 101, nz: 101, cell: 1, x0: -50, z0: -50};
// A green, a disc 10 m round the middle.
const mask = Uint8Array.from({length: 101 * 101}, (_, k) => Math.hypot(k % 101 - 50, Math.floor(k / 101) - 50) <= 10 ? 1 : 0);

test('a crown over the green is drawn in short of it, a tree with no room or on the green taken out, one clear of it left', () => {
 const trees = [{x: 0, z: 18, crown: 7}, {x: 0, z: 11.5, crown: 4}, {x: 0, z: 0, crown: 3}, {x: 0, z: 30, crown: 5}, {x: 300, z: 0, crown: 9}];
 const got = clearTrees(trees, grid, mask);
 assert.equal(got.removed, 2, 'the one on the green and the one at its edge');
 assert.equal(got.shrunk, 1);
 const near = got.trees.find(t => t.z === 18);
 assert.ok(near.crown >= MIN_CROWN && near.crown <= 18 - 10 - CLEAR_MARGIN, `drawn in to ${near.crown}`);
 assert.equal(got.trees.find(t => t.z === 30).crown, 5, 'clear of the green: as it was');
 assert.equal(got.trees.find(t => t.x === 300).crown, 9, 'off the grid: as it was');
});

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc() {
 const nx = 201, nz = 201, heights = new Float32Array(nx * nz).fill(100);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Trees', landscape: 'pacnw', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz, heights},
  surfaces: {green: [box(-10, 70, 10, 90)], tee: [box(-8, -84, -2, -76)], fairway: [box(-12, -60, 12, 60)]}, water: [], holes,
  // One reaching over the green, one on the tee, one far off.
  trees: new Float32Array([16, 80, 15, 8, .4, 2, -1, -5, -80, 12, 3, .3, 2, -1, 60, 0, 14, 4, .4, 2, -1]), treeKinds: []});
}

test('in the editor: one press, one undo; the tree height scale saved with the trees, their own heights kept', () => {
 const e = createEditor(doc()), s = e.state;
 const got = e.clearTreesFromTurf();
 assert.equal(got.removed, 1, 'the tree on the tee'); assert.equal(got.shrunk, 1, 'the crown over the green');
 assert.ok(s.trees[0][3] < 8 && s.trees[0][3] <= 16 - 10 - CLEAR_MARGIN + .5, `drawn in to ${s.trees[0][3]}`);
 e.undo(); assert.equal(s.trees.length, 3); assert.equal(s.trees[0][3], 8, 'undone whole');
 e.setTreeScale(1.5);
 const d = e.toDoc();
 assert.equal(d.trees[2], 15 * 1.5); assert.equal(d.trees[2 * TREE_STRIDE + 2], 14 * 1.5, 'every tree, heights times the scale');
 assert.equal(d.trees[3], 8 * 1.5, 'the crown wider in proportion'); assert.ok(Math.abs(d.trees[4] - .4 * 1.5) < 1e-6, 'and the trunk');
 assert.equal(s.trees[0][2], 15, 'the trees keep their own heights'); assert.equal(s.trees[0][3], 8, 'and crowns');
 assert.ok(s.changed);
});

test('in the editor: one tree sized from what it was when picked, the whole scale on top, one undo for the drag', () => {
 const e = createEditor(doc()), s = e.state;
 const i = e.treeAt({x: 60, z: 2}); assert.equal(i, 2, 'the tree whose crown holds the point');
 assert.equal(e.treeAt({x: 200, z: 200}), -1);
 const base = [...s.trees[i]], steps = s.undo.length;
 e.sizeTree(i, base, 1.5, true); e.sizeTree(i, base, 2);
 assert.deepEqual(s.trees[i].slice(2, 5).map(v => +v.toFixed(4)), [28, 8, .8], 'twice: height, crown and trunk');
 assert.deepEqual(s.trees[0].slice(2, 5), [15, 8, Math.fround(.4)], 'the others as they were');
 assert.equal(s.undo.length, steps + 1, 'one undo step');
 e.setTreeScale(1.5); assert.equal(e.toDoc().trees[i * TREE_STRIDE + 2], 28 * 1.5, 'the whole scale on top');
 e.sizeTree(i, base, 9); assert.equal(s.trees[i][2], 14 * 3, 'at most 3 times');
 e.undo(); assert.equal(s.trees[i][2], 14, 'undone whole');
});

test('in the editor: clearing measured at the tree scale, so the crowns saved stop short of the green', () => {
 const plain = createEditor(doc()); plain.clearTreesFromTurf();
 const e = createEditor(doc()); e.setTreeScale(1.5); e.clearTreesFromTurf();
 const room = plain.state.trees[0][3];
 assert.ok(Math.abs(e.toDoc().trees[3] - room) < 1e-4, `the saved crown ${e.toDoc().trees[3]} as the room ${room}`);
});

test('a hole\'s yards as the game measures them: along the line through its bends; a bend going back skipped; white and red the nearer tees', () => {
 const rec = {tees: [{x: 0, z: 0, set: 'back'}, {x: 0, z: 40, set: 'middle'}], green: {x: 0, z: 300}, line: [[0, 0], [60, 150], [50, 100], [0, 300]]};
 const L = builtLine(rec);
 assert.equal(L.skipped, 1, 'the bend that turns back');
 const along = (Math.hypot(60, 150) + Math.hypot(60, 150)) / YARD;
 assert.ok(Math.abs(L.yards.blue - along) < 1.5, `${L.yards.blue} against ${along}`);
 assert.ok(L.yards.white < L.yards.blue && L.yards.white === L.yards.red, 'white and red from the middle tee');
 // The game's own hole says the same.
 const w = worldFromDoc(doc());
 const r0 = doc().holes[0];
 assert.ok(Math.abs(w.holes[0].tees.blue.yards - builtLine(r0).yards.blue) < 1e-9);
});

test('door 2\'s par, unless set, from the yards along the line: a dogleg is longer than the straight', () => {
 const land = {nx: 61, nz: 61, cell: 10, halfX: 300, halfZ: 300, ground: new Float32Array(61 * 61).fill(10), filled: new Uint8Array(61 * 61), canopy: new Float32Array(61 * 61), center: {x: 0, y: 0}, unit: {h: 1, v: 1}};
 const codes = new Uint8Array(61 * 61);
 // 220 m straight from tee to green (241 yd: a par 3), 325 m round the
 // dogleg (356 yd: a par 4).
 const hole = {number: 1, tees: [{x: 0, z: 110, set: 'back'}], green: {x: 0, z: -110}, line: [[0, 110], [120, 0], [0, -110]]};
 let made;
 made = docFromLand({land, traced: {codes}, holes: [hole], trees: [], name: 'Par', landscape: 'heartland'});
 assert.equal(made.holes[0].par, 4, `along the dogleg (${Math.round(builtLine(made.holes[0]).yards.blue)} yd) a par 4, though 241 yd straight`);
 assert.equal(docFromLand({land, traced: {codes}, holes: [{...hole, par: 3}], trees: [], name: 'Par', landscape: 'heartland'}).holes[0].par, 3, 'a par set by hand kept');
});
