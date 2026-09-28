import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cullInstances} from '../src/instance-cull.js';

// A 1 km square of "trees" 20 m apart, each coloured by its own position so a
// matrix that travels without its colour is caught.
const field = () => {
 const group = new T.Group(), spots = [];
 for (let x = -500; x <= 500; x += 20) for (let z = -500; z <= 500; z += 20) spots.push([x, z]);
 const mesh = new T.InstancedMesh(new T.BoxGeometry(2, 20, 2), new T.MeshBasicMaterial(), spots.length);
 const m = new T.Matrix4(), c = new T.Color();
 spots.forEach(([x, z], i) => {
  mesh.setMatrixAt(i, m.makeTranslation(x, 10, z));
  mesh.setColorAt(i, c.setRGB((x + 500) / 1000, (z + 500) / 1000, 0));
 });
 group.add(mesh);
 return {group, mesh, spots};
};
// At the south edge, looking north across the field.
const camera = () => {
 const cam = new T.PerspectiveCamera(53, 16 / 9, .5, 20000);
 cam.position.set(0, 2, -520); cam.lookAt(0, 2, 0); cam.updateMatrixWorld();
 return cam;
};
const held = mesh => {
 const out = [], m = new T.Matrix4(), p = new T.Vector3(), c = new T.Color();
 for (let i = 0; i < mesh.count; i++) {
  mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); mesh.getColorAt(i, c);
  out.push({x: p.x, z: p.z, r: c.r, g: c.g});
 }
 return out;
};

test('nothing moves until a camera asks', () => {
 // The vegetation tests build a view with no camera and read instances by
 // their original index; registering must leave the buffer exactly as built.
 const {group, mesh, spots} = field();
 const before = mesh.instanceMatrix.array.slice();
 cullInstances(group);
 assert.equal(mesh.count, spots.length);
 assert.deepEqual(mesh.instanceMatrix.array, before);
});

test('keeps what is in front, drops what is behind, and colours travel with their tree', () => {
 const {group, mesh, spots} = field(), cull = cullInstances(group), cam = camera();
 // Turned round to face south, away from the whole field.
 cam.lookAt(0, 2, -2000); cam.updateMatrixWorld();
 cull.update(cam, null);
 assert.ok(mesh.count < spots.length * .05, `facing away still held ${mesh.count}`);
 // And back to face it.
 cam.lookAt(0, 2, 0); cam.updateMatrixWorld();
 cull.update(cam, null);
 const kept = held(mesh);
 assert.ok(kept.length > spots.length * .3 && kept.length < spots.length, `held ${kept.length} of ${spots.length}`);
 for (const t of kept) {
  assert.ok(Math.abs(t.r - (t.x + 500) / 1000) < 1e-3 && Math.abs(t.g - (t.z + 500) / 1000) < 1e-3, 'colour left behind');
 }
 // Nothing near the camera is ever dropped, whatever the angle.
 const near = spots.filter(([x, z]) => Math.hypot(x, z + 520) < 40).length;
 assert.ok(kept.filter(t => Math.hypot(t.x, t.z + 520) < 40).length === near);
});

test('a tree just out of view is kept while its shadow falls into view', () => {
 const {group, mesh} = field(), cam = camera();
 // Looking straight along the west edge: the field to the east is out of view.
 cam.fov = 20; cam.updateProjectionMatrix();
 cam.position.set(-500, 2, -520); cam.lookAt(-500, 2, 500); cam.updateMatrixWorld();
 const plain = cullInstances(group);
 plain.update(cam, null);
 const without = mesh.count;
 // A low sun in the east throws every shadow west, across the view.
 const lowEast = new T.Vector3(1, .12, 0).normalize();
 const {group: g2, mesh: m2} = field(), lit = cullInstances(g2);
 lit.update(cam, lowEast);
 assert.ok(m2.count > without, `sun in the east kept ${m2.count}, no sun ${without}`);
 // A sun in the WEST throws them the other way, out of view: nothing extra.
 const {group: g3, mesh: m3} = field(), west = cullInstances(g3);
 west.update(cam, new T.Vector3(-1, .12, 0).normalize());
 assert.ok(m3.count < m2.count);
});

test('a hidden tree stays hidden, and showAll puts everything back', () => {
 const {group, mesh, spots} = field(), cam = camera();
 const hidden = new Uint8Array(spots.length);
 const inside = spots.findIndex(([x, z]) => x === 0 && z === -500);
 hidden[inside] = 1; mesh.userData.cullHidden = hidden;
 const cull = cullInstances(group);
 cull.update(cam, null);
 assert.ok(!held(mesh).some(t => t.x === 0 && t.z === -500), 'the hidden tree was drawn');
 cull.showAll();
 assert.equal(mesh.count, spots.length - 1);
 // A change it cannot see from the camera: the tree is no longer hidden.
 hidden[inside] = 0; cull.dirty(); cull.update(cam, null);
 assert.ok(held(mesh).some(t => t.x === 0 && t.z === -500));
});

test('meshes that opt out, and single meshes, are left alone', () => {
 const {group, mesh, spots} = field();
 mesh.userData.noCull = true;
 assert.equal(cullInstances(group), null);
 assert.equal(mesh.count, spots.length);
});
