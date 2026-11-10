// The course builder's checks (src/builder/checks.js): each rule found on a
// course built to break it, and a sound course found sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../src/builder/editing.js';
import {checkCourse} from '../src/builder/checks.js';
import {validateDoc} from '../src/course-doc.js';

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc(over = {}) {
 const nx = 201, heights = new Float32Array(nx * nx).fill(50);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Checks', landscape: 'heartland', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz: nx, heights},
  surfaces: {green: [box(-12, 68, 12, 92)], tee: [box(-9, -84, -1, -76)], fairway: [box(-12, -60, 12, 60)]}, water: [], holes, trees: new Float32Array(0), ...over});
}

test('a sound course has nothing to report', () => {
 assert.deepEqual(checkCourse(createEditor(doc())).map(c => c.text), []);
});

test('a tee off its pad, a tee in water, a green too small, a steep green and a tree on a green are each found', () => {
 const e = createEditor(doc());
 e.setTee(1, 'back', 40, -40);
 e.addPond({ring: [[30, -70], [50, -70], [50, -50], [30, -50]]}); e.setTee(2, 'back', 40, -60);
 const found = () => checkCourse(e).map(c => c.text).join('\n');
 assert.match(found(), /Hole 2: the back tee is on rough/);
 assert.match(found(), /Hole 3: the back tee is in water/);
 e.addTree([0, 80, 12, 4, .3, 2, -1]);
 assert.match(found(), /A tree stands on a green/);
 e.shape({op: 'ramp', a: {x: 0, z: 68, y: 50}, b: {x: 0, z: 92, y: 54}, radius: 15, strength: 1});
 assert.match(found(), /slopes .*% on average/);
 const small = createEditor(doc({surfaces: {green: [box(-2, 78, 2, 82)], tee: [box(-9, -84, -1, -76)]}}));
 assert.match(checkCourse(small).map(c => c.text).join('\n'), /too small for a cup/);
});

// A COURSE'S WEIGHT (the frame-rate goal, 9 November 2026): past HEAVY's trees
// or houses, a note names them and points at the far trees' thickest stand.
test('a heavy course is named, with where its trees stand furthest from play', async () => {
 const {courseWeight, HEAVY} = await import('../src/builder/checks.js');
 const {TREE_STRIDE} = await import('../src/course-doc.js');
 assert.equal(courseWeight(doc()), null, 'a light course has no note');
 const n = HEAVY.trees + 10, trees = new Float32Array(n * TREE_STRIDE);
 // Most near the holes' line (x near 0), a stand of 4,000 far off at x 800.
 for (let i = 0; i < n; i++) { trees[i * TREE_STRIDE] = i < 4000 ? 800 + (i % 40) : (i % 100) - 50; trees[i * TREE_STRIDE + 1] = (i % 150) - 75; }
 const note = courseWeight({...doc(), trees});
 assert.ok(note && /heavy course/.test(note.text) && /4,000 of the trees/.test(note.text), note?.text);
 assert.ok(note.at.x > 700, `points at the far stand: ${note.at.x}`);
});
