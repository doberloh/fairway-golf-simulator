// The tiny course models' framing (round 14): the mockup's CPU check, on the
// game's own courses. Five landscapes x four box shapes -- the Play card
// (186 x 92), an Endless landscape (197 x 66), an earlier week (96 x 52) and
// 16:9 -- every box full of ground at both ends of the sway, every tee and
// green in view.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {layoutFor} from '../src/course-picture.js';
import {modelPlan, modelData, buildCourseModel} from '../src/course-model.js';
import {frameModel, boxCovered, shareInView} from '../src/model-framing.js';

const LANDS = [['pnw', 9], ['desert', 18], ['island', 9], ['mountain', 18], ['haunted', 9]];
const BOXES = [['Play card', 186 / 92], ['Endless', 197 / 66], ['earlier week', 96 / 52], ['16:9', 16 / 9]];

for (const [biome, holes] of LANDS) {
 test(`a ${holes}-hole ${biome} model fills every box with its whole course in view`, () => {
  const d = modelData(modelPlan(layoutFor({seed: 'FRAME-' + biome, biome, holes})));
  assert.ok(d.trees.length > 50, `${d.trees.length} trees`);
  assert.equal(d.flags.length, holes);
  for (const [name, aspect] of BOXES) {
   const cam = frameModel(T, d, aspect);
   assert.ok(boxCovered(T, d, cam), `${name}: the box shows the land's edge`);
   assert.equal(shareInView(T, d, cam), 1, `${name}: a tee or green out of the box`);
  }
 });
}

test('the same course gives the same model', () => {
 const a = modelData(modelPlan(layoutFor({seed: 'SAME', biome: 'links', holes: 9})));
 const b = modelData(modelPlan(layoutFor({seed: 'SAME', biome: 'links', holes: 9})));
 assert.deepEqual(a.trees.slice(0, 20), b.trees.slice(0, 20));
 assert.deepEqual(a.ground.pos.slice(0, 60), b.ground.pos.slice(0, 60));
});

test('each landscape grows its own kind of tree, and the haunted one its pumpkins', () => {
 const kind = biome => modelData(modelPlan(layoutFor({seed: 'KIND', biome, holes: 9})));
 assert.equal(kind('pnw').kind, 'cone');
 assert.equal(kind('desert').kind, 'cactus');
 assert.equal(kind('island').kind, 'palm');
 assert.equal(kind('autumn').kind, 'round');
 const h = kind('haunted');
 assert.equal(h.kind, 'dead');
 assert.ok(h.pumpkins.length > 0);
});

test('the model builds as a three.js scene', () => {
 const d = modelData(modelPlan(layoutFor({seed: 'SCENE', biome: 'midwest', holes: 9})));
 const m = buildCourseModel(T, d);
 let meshes = 0;
 m.scene.traverse(o => { if (o.isMesh) meshes++; });
 assert.ok(meshes > 9, `${meshes} meshes`);
 m.dispose();
});
