// Dragging a hole's marks: on door 2's plan (hole-marks.js) and in the 3D editor
// (editing.js marksOf, holdMark).
import test from 'node:test';
import assert from 'node:assert/strict';
import {marksOf, markNear, moveMark} from '../src/builder/hole-marks.js';
import {createEditor} from '../src/builder/editing.js';
import {validateDoc} from '../src/course-doc.js';

const hole = (x = 0) => ({tees: [{x, z: 0, set: 'back'}, {x, z: 20, set: 'front'}], aims: [{x: x + 10, z: 100}, {x: x + 20, z: 150}], green: {x, z: 200}});

test('every mark of a hole is found, and an empty hole has none', () => {
 assert.deepEqual(marksOf(hole()).map(m => m.kind), ['tee', 'tee', 'aim', 'aim', 'green']);
 assert.deepEqual(marksOf(undefined), []);
 assert.deepEqual(marksOf({tees: [], aims: [], green: null}), []);
});

test('the mark under the pointer, nearest first, the hole in hand before others', () => {
 const holes = [hole(0), hole(3), undefined];
 assert.equal(markNear(holes, 0, {x: 1, z: 199}, 5).kind, 'green');
 assert.equal(markNear(holes, 0, {x: 1, z: 199}, 5).hole, 0);
 assert.equal(markNear(holes, 1, {x: 1, z: 199}, 5).hole, 1, 'both reach: the hole in hand');
 assert.equal(markNear([hole(0), hole(300)], 0, {x: 301, z: 19}, 5).hole, 1, 'another hole\'s, when the one in hand has none there');
 assert.equal(markNear(holes, 0, {x: 500, z: 500}, 5), null);
 const m = markNear(holes, 0, {x: 11, z: 101}, 5);
 assert.equal(m.kind, 'aim'); assert.equal(m.index, 0);
 assert.equal(markNear(holes, 0, {x: 1, z: 19}, 5).set, 'front');
});

test('a mark moves alone: its set and order stay', () => {
 const h = hole();
 moveMark(h, {kind: 'tee', set: 'front'}, {x: 5, z: 25});
 assert.deepEqual(h.tees[1], {x: 5, z: 25, set: 'front'}); assert.deepEqual(h.tees[0], {x: 0, z: 0, set: 'back'});
 moveMark(h, {kind: 'aim', index: 1}, {x: 40, z: 140});
 assert.deepEqual(h.aims, [{x: 10, z: 100}, {x: 40, z: 140}]);
 moveMark(h, {kind: 'green'}, {x: 9, z: 210});
 assert.deepEqual(h.green, {x: 9, z: 210});
});

function doc() {
 const nx = 201, heights = new Float32Array(nx * nx).fill(100);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}, {x: -5, z: -60, set: 'front'}], green: {x: 0, z: 80}, line: [[-5, -80], [10, 0], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Marks', landscape: 'puget', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz: nx, heights}, patches: [], surfaces: {}, water: [], holes, trees: new Float32Array(0), treeKinds: []});
}

test('in the 3D editor: each mark drags, the line follows, one undo a drag', () => {
 const e = createEditor(doc()), s = e.state, u = s.undo.length;
 assert.deepEqual(e.marksOf(0).map(m => m.kind), ['tee', 'tee', 'bend', 'green']);
 const [back, front, bend, green] = e.marksOf(0);
 const hold = e.holdMark(0, back);
 hold.set(-20, -85); hold.set(-30, -90); hold.done();
 assert.deepEqual([s.holes[0].tees[0].x, s.holes[0].tees[0].z], [-30, -90]);
 assert.deepEqual(s.holes[0].line[0], [-30, -90], 'the line starts at the first tee');
 assert.equal(s.undo.length, u + 1);
 e.undo(); assert.equal(s.holes[0].tees[0].x, -5);
 const h2 = e.holdMark(0, front); h2.set(9, -50); h2.done();
 assert.deepEqual(s.holes[0].line[0], [-5, -80], 'a second tee does not move the line');
 const h3 = e.holdMark(0, bend); h3.set(30, 5); h3.done();
 assert.deepEqual(s.holes[0].line[1], [30, 5]);
 const h4 = e.holdMark(0, green); h4.set(4, 85); h4.done();
 assert.deepEqual(s.holes[0].green, {x: 4, z: 85}); assert.deepEqual(s.holes[0].line.at(-1), [4, 85]);
 const count = s.undo.length, idle = e.holdMark(0, green); idle.done();
 assert.equal(s.undo.length, count, 'pressed and let go: no undo');
});
