// Game view's rules (src/builder/game-look.js): when the picture is built again,
// the editor's camera as the game's, and flying. The picture itself needs a
// graphics card and is the builder journeys' to check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {changeMark, sameMark, poseFrom, samePose, clearOfGround, flyAxes, EYE_OVER_GROUND} from '../src/builder/game-look.js';
import {createEditor} from '../src/builder/editing.js';
import {validateDoc} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc() {
 const nx = 201, heights = new Float32Array(nx * nx).fill(100);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Look', landscape: 'puget', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz: nx, heights}, patches: [],
  surfaces: {green: [box(-10, 70, 10, 90)], fairway: [box(-12, -60, 12, 60)]}, water: [], holes, trees: new Float32Array([70, 70, 12, 3, .3, 1, -1]), treeKinds: []});
}

test('nothing edited, no rebuild; any edit, a rebuild', () => {
 const e = createEditor(doc()), s = e.state, mark = changeMark(s);
 assert.ok(sameMark(mark, changeMark(s)));
 assert.equal(sameMark(null, mark), false, 'the first look always builds');
 e.paint({kind: 'sand', x: 30, z: 0, radius: 4}); const a = changeMark(s);
 assert.ok(!sameMark(mark, a), 'a paint stroke');
 e.undo(); const b = changeMark(s);
 assert.ok(!sameMark(a, b), 'an undo');
 e.redo(); e.undo();
 e.paint({kind: 'sand', x: 40, z: 0, radius: 4});
 assert.ok(!sameMark(a, changeMark(s)), 'an undo and a different stroke leave the list as long but it is not the same course');
 const c = changeMark(s);
 e.setTreeScale(1.2); assert.ok(!sameMark(c, changeMark(s)), 'the tree scale');
 const d = changeMark(s);
 const i = e.treeAt({x: 70, z: 70}), base = [...s.trees[i]];
 e.sizeTree(i, base, 1.5, true); const f = changeMark(s);
 assert.ok(!sameMark(d, f), 'a tree sized');
 e.sizeTree(i, base, 2, false);
 assert.ok(!sameMark(f, changeMark(s)), 'the same slider dragged further, with no new undo step');
 const g = changeMark(s);
 s.name = 'Another'; assert.ok(!sameMark(g, changeMark(s)), 'the name');
});

test('the editor\'s camera is the game\'s: looking the same way from the same place', () => {
 const eye = {x: 10, y: 50, z: -20}, look = {x: 40, y: 20, z: 20}, {eye: e, yaw, pitch} = poseFrom(eye, look);
 assert.deepEqual(e, eye);
 const len = Math.hypot(30, -30, 40), along = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
 [30 / len, -30 / len, 40 / len].forEach((v, i) => assert.ok(Math.abs(along[i] - v) < 1e-9));
 assert.ok(samePose(poseFrom(eye, look), poseFrom(eye, look)));
 assert.ok(!samePose(poseFrom(eye, look), poseFrom({...eye, x: 11}, look)));
 assert.equal(samePose(null, poseFrom(eye, look)), false);
});

test('flying stays over the ground, and the keys mean what they say', () => {
 assert.equal(clearOfGround(50, 100), 100 + EYE_OVER_GROUND); assert.equal(clearOfGround(120, 100), 120);
 assert.deepEqual(flyAxes(new Set(['KeyW', 'KeyD', 'ShiftLeft'])), {forward: 1, right: 1, up: 0, fast: true});
 assert.deepEqual(flyAxes(new Set(['KeyS', 'KeyA', 'KeyQ'])), {forward: -1, right: -1, up: -1, fast: false});
 assert.deepEqual(flyAxes(new Set(['KeyW', 'KeyS'])), {forward: 0, right: 0, up: 0, fast: false});
});

test('the course it draws is the editor\'s, at the chosen season', () => {
 const e = createEditor(doc());
 e.paint({kind: 'sand', x: 30, z: 0, radius: 4});
 const w = worldFromDoc(e.toDoc(), {season: 'winter'});
 assert.equal(w.settings.season, 'winter');
 assert.equal(w.surface(30, 0), 'sand');
 w.settings.season = 'spring'; assert.equal(w.settings.season, 'spring', 'a season changes on the same world');
});

test('Game view holds no editing: it never touches the editor or saves a setting', () => {
 const src = fs.readFileSync('src/builder/game-view.js', 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
 assert.ok(!/editor\.\w+\(|editing\.js|saveGraphics|saveDaylight|localStorage\.setItem/.test(src));
 assert.match(src, /borrowedClock = true/);
 assert.match(src, /rate = 0/);
});
