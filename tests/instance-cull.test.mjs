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

// A sun overhead whose shadow map covers only the square around the camera.
const sunOver = (half = 120) => {
 const light = new T.DirectionalLight();
 light.position.set(0, 500, -520); light.target.position.set(0, 0, -520);
 Object.assign(light.shadow.camera, {left: -half, right: half, top: half, bottom: -half, near: 1, far: 1000});
 light.shadow.camera.updateProjectionMatrix();
 light.updateMatrixWorld(); light.target.updateMatrixWorld(); light.shadow.updateMatrices(light);
 return light;
};
const shadowCount = (mesh, light) => {
 mesh.onBeforeShadow?.(null, mesh, null, light.shadow.camera);
 const n = mesh.count; mesh.onAfterShadow?.(); return n;
};

test('a shadow map draws only the trees inside it, and every one of them', () => {
 const {group, mesh} = field(), cull = cullInstances(group), cam = camera(), light = sunOver();
 cull.update(cam, null, [light]);
 const drawn = mesh.count, inMap = shadowCount(mesh, light);
 assert.ok(inMap < drawn * .5, `map drew ${inMap} of ${drawn}`);
 assert.equal(mesh.count, drawn, 'the count is put back after the shadow pass');
 // Every tree the map's volume touches is inside the prefix it draws.
 const kept = held(mesh), prefix = new Set(kept.slice(0, inMap).map(t => t.x + ',' + t.z));
 for (const t of kept) if (Math.abs(t.x) <= 120 && Math.abs(t.z + 520) <= 120) assert.ok(prefix.has(t.x + ',' + t.z), `tree at ${t.x},${t.z} is in the map but not drawn into it`);
 // A shadow camera it was not told about -- a floodlight's -- draws everything.
 const other = new T.SpotLight(); assert.equal(shadowCount(mesh, other), drawn);
});

test('the thinned twin stands in from its map onward and is never drawn into the picture', async () => {
 const {modelParts, farParts} = await import('../src/mesh-assets.js');
 const parts = modelParts('Redwood_Giant_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const group = new T.Group(), n = 40, mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), n);
 const m = new T.Matrix4();
 for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m.makeTranslation((i % 8) * 30 - 105, 0, Math.floor(i / 8) * 30 - 520));
 mesh.castShadow = true; mesh.userData = {model: 'Redwood_Giant_1', part: leaf, role: 'leaf'};
 group.add(mesh);
 const cull = cullInstances(group, {thinShadowsFrom: 1}), cam = camera(), near = sunOver(60), far = sunOver(400);
 cull.update(cam, null, [near, far]);
 const twin = group.children.find(o => o.name === 'shadow twin');
 assert.ok(twin, 'no twin was made');
 assert.equal(twin.instanceMatrix, mesh.instanceMatrix, 'the twin must share the instance buffer');
 assert.ok(twin.geometry.index.count < parts[leaf].geometry.index.count * .5);
 assert.equal(twin.geometry, farParts('Redwood_Giant_1')[leaf].geometry);
 // Map 0 keeps the whole tree; map 1 draws the twin instead.
 assert.ok(shadowCount(mesh, near) > 0); assert.equal(shadowCount(twin, near), 0);
 assert.equal(shadowCount(mesh, far), 0); assert.ok(shadowCount(twin, far) > 0);
 // Any render that is not a shadow map sees no instances of the twin.
 twin.onBeforeRender(); assert.equal(twin.count, 0); twin.onAfterRender();
 assert.equal(twin.count, mesh.count);
});

test('thinning keeps a third of the sprays, grown about their own centres, and shares the trunk', async () => {
 const {modelParts, farParts} = await import('../src/mesh-assets.js');
 const full = modelParts('DouglasFir_2'), far = farParts('DouglasFir_2');
 for (let i = 0; i < full.length; i++) {
  if (full[i].role !== 'leaf') { assert.equal(far[i].geometry, full[i].geometry); continue; }
  const ratio = far[i].geometry.index.count / full[i].geometry.index.count;
  assert.ok(ratio > .3 && ratio < .37, `kept ${ratio}`);
  // Same crown: the thinned sprays fill the same envelope.
  full[i].geometry.computeBoundingBox(); far[i].geometry.computeBoundingBox();
  const a = full[i].geometry.boundingBox, b = far[i].geometry.boundingBox;
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs((a.max[k] - a.min[k]) - (b.max[k] - b.min[k])) < (a.max[k] - a.min[k]) * .12, `envelope ${k}`);
 }
});

test('small crowns are drawn thinned, every held crown exactly once, and none near the camera', async () => {
 const {modelParts} = await import('../src/mesh-assets.js');
 const parts = modelParts('Redwood_Giant_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const group = new T.Group(), spots = [];
 for (let z = -500; z <= 1500; z += 50) for (let x = -200; x <= 200; x += 50) spots.push([x, z]);
 const mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), spots.length), m = new T.Matrix4();
 // Unit-height models scaled to 60 m trees.
 spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeScale(60, 60, 60).setPosition(x, 0, z)));
 mesh.castShadow = true; mesh.userData = {model: 'Redwood_Giant_1', part: leaf, role: 'leaf'};
 group.add(mesh);
 const cull = cullInstances(group, {farTrees: .15}), cam = camera();
 cull.update(cam, null);
 const far = group.children.find(o => o.name === 'far trees');
 assert.ok(far && far.count > 0 && mesh.count > 0, `near ${mesh.count}, far ${far?.count}`);
 const where = o => held(o).map(t => [t.x, t.z]);
 const near = where(mesh), thin = where(far), key = ([x, z]) => x + ',' + z;
 // Exactly once: no crown in both, none lost.
 const a = new Set(near.map(key));
 for (const t of thin) assert.ok(!a.has(key(t)), `crown at ${key(t)} drawn twice`);
 assert.equal(near.length + thin.length, cull.stats().drawn);
 // Thinned ones are the distant ones; nothing within 300 m is thinned.
 for (const [x, z] of thin) assert.ok(Math.hypot(x, z + 520) > 300, `crown at ${x},${z} thinned too close`);
 assert.ok(cull.stats().thinCrowns > 0 && cull.stats().thinCrowns < 1);
 // Turned off, the far mesh empties and the full one holds everything again.
 cull.tune({farTrees: 0}); cull.update(cam, null);
 assert.equal(far.count, 0);
 cull.tune({farTrees: null});
});

test('the tiers that split cascades split them inside their own shadow reach', async () => {
 const {TIERS} = await import('../src/graphics.js');
 for (const [name, t] of Object.entries(TIERS)) {
  if (!t.cascadeSplits) continue;
  assert.ok(t.cascades >= 2, `${name} splits cascades it does not have`);
  assert.equal(t.cascadeSplits.length, t.cascades - 1, `${name}: one edge per cascade but the last`);
  let prev = 0;
  for (const edge of t.cascadeSplits) { assert.ok(edge > prev && edge < t.shadowFar, `${name}: edge ${edge}`); prev = edge; }
  // A crown that shades itself must do it from the whole tree: the nearest
  // cascade never takes the thinned shadow twins (F3).
  assert.ok((t.thinShadowsFrom ?? Infinity) >= 1, `${name} thins the nearest cascade`);
 }
});
