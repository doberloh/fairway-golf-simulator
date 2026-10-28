// TREES IN STILL WATER (the far-landscape goal; src/water-mirror.js): the
// bank's trees, turned over about their pond's own level. These hold that
// each twin stands under that level, straight below its tree, and that only
// trees near a still pond get one.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeWaterMirror} from '../src/water-mirror.js';
import {farWoodGeometry} from '../src/vegetation.js';

const pond = (x, z, level, R = 20) => {
 const geometry = new T.CircleGeometry(R, 24);
 return {mesh: {geometry}, level, center: {x, z}, ocean: false, stream: false};
};

test('a tree by a still pond is mirrored under that pond, straight below itself', () => {
 const trees = [
  {x: 30, z: 0, y: 3, h: 14, r: 4, kind: 'oak'},      // on pond A's bank
  {x: 230, z: 0, y: 11, h: 20, r: 3, kind: 'spruce'},  // on pond B's bank
  {x: 900, z: 900, y: 5, h: 15, r: 4, kind: 'oak'},   // far from any pond
 ];
 const view = {waterBodies: [pond(0, 0, 1), pond(200, 0, 8), {...pond(500, 0, 0), ocean: true}], world: {trees}};
 const mirror = makeWaterMirror(view, {farWoodGeometry, colors: [new T.Color('#3c6b33')]});
 assert.ok(mirror, 'a mirror is made');
 const m = new T.Matrix4(), p = new T.Vector3(), seen = [];
 for (const mesh of mirror.scene.children) {
  mesh.geometry.computeBoundingBox();
  for (let i = 0; i < mesh.count; i++) {
   mesh.getMatrixAt(i, m);
   const box = mesh.geometry.boundingBox.clone().applyMatrix4(m);
   p.setFromMatrixPosition(m);
   const tree = trees.find(t => Math.hypot(t.x - p.x, t.z - p.z) < .5);
   assert.ok(tree, `a twin at ${p.x.toFixed(1)},${p.z.toFixed(1)} under no tree`);
   const level = tree.x < 100 ? 1 : 8;
   assert.ok(box.max.y <= level - (tree.y - level) + 1e-6 + .01, `twin of the tree at ${tree.x} reaches ${box.max.y.toFixed(2)}, above its mirrored foot ${(2 * level - tree.y).toFixed(2)}`);
   assert.ok(box.min.y >= 2 * level - tree.y - tree.h - .01, `twin of the tree at ${tree.x} reaches below its mirrored top`);
   seen.push(tree.x);
  }
 }
 assert.ok(seen.includes(30) && seen.includes(230), 'both bank trees are mirrored');
 assert.ok(!seen.includes(900), 'a tree far from any still pond is not');
 mirror.dispose();
});

// Round 8: the bank's own edge, turned over -- from the waterline outward and
// down, never above the water, never inside the pond.
test("a pond made from its outline gets its bank's reflection, under the water and outside it", () => {
 const R = 20, level = 2, pts = Array.from({length: 48}, (_, i) => new T.Vector2(R * Math.cos(i / 48 * Math.PI * 2), R * Math.sin(i / 48 * Math.PI * 2)));
 const geometry = new T.ShapeGeometry(new T.Shape(pts));
 const view = {waterBodies: [{mesh: {geometry}, level, center: {x: 0, z: 0}, ocean: false, stream: false}], world: {trees: [{x: 26, z: 0, y: 3, h: 12, r: 4, kind: 'oak'}]}};
 const mirror = makeWaterMirror(view, {farWoodGeometry, colors: [new T.Color('#3c6b33')]});
 const skirt = mirror.scene.children.find(m => m.isMesh && !m.isInstancedMesh);
 assert.ok(skirt, 'no bank reflection');
 const p = skirt.geometry.attributes.position;
 for (let i = 0; i < p.count; i++) {
  assert.ok(p.getY(i) <= level + 1e-6, `a bank vertex ${p.getY(i).toFixed(2)} above the water`);
  assert.ok(Math.hypot(p.getX(i), p.getZ(i)) >= R - .05, 'a bank vertex inside the pond');
 }
 mirror.dispose();
});

test('no still water, or no tree near it, makes no mirror', () => {
 assert.equal(makeWaterMirror({waterBodies: [{...pond(0, 0, 0), ocean: true}], world: {trees: [{x: 10, z: 0, y: 2, h: 10, r: 3}]}}, {farWoodGeometry, colors: [new T.Color()]}), null);
 assert.equal(makeWaterMirror({waterBodies: [pond(0, 0, 0)], world: {trees: [{x: 600, z: 0, y: 2, h: 10, r: 3}]}}, {farWoodGeometry, colors: [new T.Color()]}), null);
});
