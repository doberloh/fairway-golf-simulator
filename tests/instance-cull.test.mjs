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
 const parts = modelParts('Blender_Redwood_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const group = new T.Group(), n = 40, mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), n);
 const m = new T.Matrix4();
 for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m.makeTranslation((i % 8) * 30 - 105, 0, Math.floor(i / 8) * 30 - 520));
 mesh.castShadow = true; mesh.userData = {model: 'Blender_Redwood_1', part: leaf, role: 'leaf'};
 group.add(mesh);
 const cull = cullInstances(group, {thinShadowsFrom: 1}), cam = camera(), near = sunOver(60), far = sunOver(400);
 cull.update(cam, null, [near, far]);
 const twin = group.children.find(o => o.name === 'shadow twin');
 assert.ok(twin, 'no twin was made');
 assert.equal(twin.instanceMatrix, mesh.instanceMatrix, 'the twin must share the instance buffer');
 assert.ok(twin.geometry.index.count < parts[leaf].geometry.index.count * .6, 'the shipped twin is a fraction of the crown');
 assert.equal(twin.geometry, farParts('Blender_Redwood_1')[leaf].geometry);
 // Map 0 keeps the whole tree; map 1 draws the twin instead.
 assert.ok(shadowCount(mesh, near) > 0); assert.equal(shadowCount(twin, near), 0);
 assert.equal(shadowCount(mesh, far), 0); assert.ok(shadowCount(twin, far) > 0);
 // Any render that is not a shadow map sees no instances of the twin.
 twin.onBeforeRender(); assert.equal(twin.count, 0); twin.onAfterRender();
 assert.equal(twin.count, mesh.count);
});

// Since the cartoon overhaul no shipped crown is thinned -- the grown grove it
// was written for is remade -- so the arithmetic is held on a crown of
// sprays built here: 600 separate little triangles filling a ball.
test('thinning keeps a third of the sprays, grown about their own centres', async () => {
 const {thinSprays} = await import('../src/mesh-assets.js');
 const pos = [], idx = [];
 let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
 for (let k = 0; k < 600; k++) {
  const a = rnd() * 6.28, b = Math.acos(2 * rnd() - 1), r = 5 * Math.cbrt(rnd());
  const c = [r * Math.sin(b) * Math.cos(a), 10 + r * Math.cos(b), r * Math.sin(b) * Math.sin(a)];
  for (const d of [[.2, 0, 0], [0, .2, 0], [0, 0, .2]]) pos.push(c[0] + d[0], c[1] + d[1], c[2] + d[2]);
  idx.push(k * 3, k * 3 + 1, k * 3 + 2);
 }
 const full = new T.BufferGeometry();
 full.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); full.setIndex(idx);
 const far = thinSprays(full, 1 / 3);
 const ratio = far.index.count / full.index.count;
 assert.ok(ratio > .3 && ratio < .37, `kept ${ratio}`);
 // Same crown: the thinned sprays fill the same envelope.
 full.computeBoundingBox(); far.computeBoundingBox();
 const a = full.boundingBox, b = far.boundingBox;
 for (const k of ['x', 'y', 'z']) assert.ok(Math.abs((a.max[k] - a.min[k]) - (b.max[k] - b.min[k])) < (a.max[k] - a.min[k]) * .12, `envelope ${k}`);
});

test('small crowns are drawn thinned, every held crown exactly once, and none near the camera', async () => {
 const {modelParts} = await import('../src/mesh-assets.js');
 const parts = modelParts('Blender_Redwood_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const group = new T.Group(), spots = [];
 for (let z = -500; z <= 1500; z += 50) for (let x = -200; x <= 200; x += 50) spots.push([x, z]);
 const mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), spots.length), m = new T.Matrix4();
 // Unit-height models scaled to 60 m trees.
 spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeScale(60, 60, 60).setPosition(x, 0, z)));
 mesh.castShadow = true; mesh.userData = {model: 'Blender_Redwood_1', part: leaf, role: 'leaf'};
 group.add(mesh);
 const cull = cullInstances(group, {farPainted: .15}), cam = camera();
 cull.update(cam, null);
 const far = group.children.find(o => o.name === 'far trees');
 assert.ok(far && far.count > 0 && mesh.count > 0, `near ${mesh.count}, far ${far?.count}`);
 const where = o => held(o).map(t => [t.x, t.z]);
 const near = where(mesh), thin = where(far), key = ([x, z]) => x + ',' + z;
 // Exactly once: no crown in both, none lost.
 const a = new Set(near.map(key));
 for (const t of thin) assert.ok(!a.has(key(t)), `crown at ${key(t)} drawn twice`);
 assert.equal(near.length + thin.length, cull.stats().drawn);
 // Thinned ones are the distant ones; nothing within 150 m is thinned (300 m
 // for the grown redwood this was written for; the cartoon one's leaf part is
 // its narrow top third, so it is small on screen sooner).
 for (const [x, z] of thin) assert.ok(Math.hypot(x, z + 520) > 150, `crown at ${x},${z} thinned too close`);
 assert.ok(cull.stats().thinCrowns > 0 && cull.stats().thinCrowns < 1);
 // Turned off, the far mesh empties and the full one holds everything again.
 cull.tune({farPainted: 0}); cull.update(cam, null);
 assert.equal(far.count, 0);
 cull.tune({farPainted: null});
});

// The cartoon overhaul's crowns have thousands of triangles -- far over
// TWIN_MIN_TRIANGLES -- but are a few dozen lobes, so they are never THINNED:
// a painted tree ships its own far twin from Blender (the same lobes,
// faceted), swapped by `farPainted` alone.
test('a cartoon crown is never thinned: it swaps only to the twin it ships', async () => {
 const {modelParts} = await import('../src/mesh-assets.js');
 const parts = modelParts('Blender_Oak_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const twin = modelParts('Blender_Oak_1_Far');
 assert.ok(twin && twin[leaf].role === 'leaf', 'the oak ships a far twin, part for part');
 assert.ok(twin[leaf].geometry.index.count < parts[leaf].geometry.index.count / 6, 'at a fraction of the triangles');
 const build = opts => {
  const group = new T.Group(), m = new T.Matrix4(), n = 200;
  const mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), n);
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m.makeScale(15, 15, 15).setPosition((i % 10) * 40 - 200, 0, Math.floor(i / 10) * 300));
  mesh.userData = {model: 'Blender_Oak_1', part: leaf, role: 'leaf'};
  group.add(mesh);
  const cull = cullInstances(group, opts);
  cull.update(camera(), null);
  return {group, cull};
 };
 // The grown trees' line alone never touches it.
 const a = build({farTrees: .15});
 assert.ok(!a.group.children.some(o => o.name === 'far trees'), 'farTrees swapped a painted crown');
 // Its own line swaps it, and only ever to the shipped twin.
 const b = build({farPainted: .15});
 const far = b.group.children.find(o => o.name === 'far trees');
 assert.ok(far, 'farPainted made no far mesh');
 assert.equal(far.geometry, twin[leaf].geometry, 'the far mesh is not the shipped twin');
 assert.ok(b.cull.stats().thinCrowns > 0, 'nothing far enough to swap');
});

// Kept from before the shipped twins: without a twin of its own, a crown with
// paint is never thinned by the grown trees' arithmetic.
test('a painted crown without a shipped twin is never thinned into shards', async () => {
 const {modelParts} = await import('../src/mesh-assets.js');
 const {TWIN_MIN_TRIANGLES} = await import('../src/instance-cull.js');
 const parts = modelParts('Blender_Naupaka_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 assert.ok(parts[leaf].geometry.index.count / 3 >= TWIN_MIN_TRIANGLES, 'the cartoon gorse has more triangles than the twin threshold');
 assert.ok(parts[leaf].geometry.attributes.flex, 'and carries its paint');
 const group = new T.Group(), m = new T.Matrix4(), n = 200;
 const mesh = new T.InstancedMesh(parts[leaf].geometry, new T.MeshBasicMaterial(), n);
 for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m.makeScale(15, 15, 15).setPosition((i % 10) * 40 - 200, 0, Math.floor(i / 10) * 80));
 mesh.castShadow = true; mesh.userData = {model: 'Blender_Naupaka_1', part: leaf, role: 'leaf'};
 group.add(mesh);
 const cull = cullInstances(group, {farTrees: .15, thinShadowsFrom: 1}), cam = camera();
 cull.update(cam, null);
 assert.ok(!group.children.some(o => o.name === 'far trees' || o.name === 'shadow twin'), 'no twin mesh for a cartoon crown');
 assert.equal(cull.stats().thinCrowns, 0);
 assert.equal(mesh.count, cull.stats().drawn);
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

// The cartoon overhaul's frame-rate pass: the long grass is drawn only so far
// (`cullReach`), and a bush's shadow goes only into the nearest map
// (`shadowNear`).
test('a mesh with a reach drops whole squares past it, and only those', () => {
 const {group, mesh} = field();
 mesh.userData.cullReach = 200;
 const cull = cullInstances(group), cam = camera();
 cull.update(cam, null);
 const kept = held(mesh);
 assert.ok(kept.length > 0, 'nothing kept');
 // A square goes once its nearest point is past the reach, so nothing kept is
 // further than the reach plus a square's diagonal (64 m squares).
 for (const t of kept) assert.ok(Math.hypot(t.x, t.z + 520) < 200 + 64 * Math.SQRT2 + 2, `kept a tree ${Math.hypot(t.x, t.z + 520).toFixed(0)} m away`);
 // ...and everything in view nearer than the reach less a square is still there.
 const {group: g2, mesh: m2} = field(), plain = cullInstances(g2);
 plain.update(cam, null);
 const near = held(m2).filter(t => Math.hypot(t.x, t.z + 520) < 200 - 64 * Math.SQRT2).length;
 assert.equal(kept.filter(t => Math.hypot(t.x, t.z + 520) < 200 - 64 * Math.SQRT2).length, near);
});

test('a plant whose shadow is near work casts into the nearest map alone', () => {
 const {group, mesh} = field();
 mesh.userData.shadowNear = true;
 const cull = cullInstances(group), cam = camera(), nearMap = sunOver(120), farMap = sunOver(600);
 cull.update(cam, null, [nearMap, farMap]);
 assert.ok(shadowCount(mesh, nearMap) > 0, 'nothing in the nearest map');
 assert.equal(shadowCount(mesh, farMap), 0, 'drawn into a further map');
 assert.ok(mesh.count > 0, 'the count is put back');
});
