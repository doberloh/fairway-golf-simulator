import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {cullInstances} from '../src/instance-cull.js';
import {modelParts, midParts, farParts, MID_MIN_TRIANGLES} from '../src/mesh-assets.js';
import {MID_CELLS} from '../src/mid-cells.js';
import {TIERS} from '../src/graphics.js';
import {midCells, midTiers, render, MID_OUTLINE} from '../tools/mid-cells.mjs';
import {outlineScore} from '../tools/far-cluster.mjs';

// A TREE'S MIDDLE VERSION (the frame-rate pass, 13 November 2026). On High and
// Ultra a painted tree small on screen is drawn as itself made coarser, not as
// its far twin (some 300 triangles, lumps over about a hundred pixels), and
// the swap is judged model by model in each square, in the picture's own
// pixels. What is held here is the arithmetic; how it looks is in captures
// (docs/SURROUNDINGS.md, *The frame-rate pass*).
const camera = (z = -520) => {
 const cam = new T.PerspectiveCamera(53, 16 / 9, .5, 20000);
 cam.position.set(0, 2, z); cam.lookAt(0, 2, 0); cam.updateMatrixWorld();
 return cam;
};
const tris = g => g.index.count / 3;

test('a middle version is the model at about its share of the triangles, with its paint, wind and shape', () => {
 for (const name of ['Blender_MtLodgepolePine_1', 'Blender_Oak_1', 'Blender_MtQuakingAspen_1']) {
  const parts = modelParts(name), far = farParts(name);
  for (const {share} of midTiers()) {
   const mid = midParts(name, share);
   assert.ok(mid && mid.length === parts.length, `${name} has a middle version, part for part`);
   let coarser = 0;
   parts.forEach((p, i) => {
    const g = p.geometry, m = mid[i].geometry;
    if (tris(g) < MID_MIN_TRIANGLES) { assert.equal(m, g, `${name} ${p.role}: a small part is left whole`); return; }
    if (m === g) return;
    coarser++;
    assert.ok(tris(m) >= tris(g) * share && tris(m) <= tris(g) * .6, `${name} ${p.role} at ${share}: ${tris(m)} of ${tris(g)} triangles`);
    assert.ok(tris(m) > tris(far[i].geometry), 'finer than its far twin');
    for (const a of ['position', 'normal', 'color', 'flex']) assert.equal(!!m.attributes[a], !!g.attributes[a], `${name} ${p.role}: ${a} kept`);
   });
   assert.ok(coarser > 0, `${name}: something was made coarser`);
   // And it keeps the model's outline at the size its tier swaps at (the
   // owner's rule for far versions, held tighter: tools/mid-cells.mjs).
   const px = midTiers().find(t => t.share === share).px, arrays = ps => ps.map(p => ({position: p.geometry.attributes.position.array, index: p.geometry.index.array}));
   const score = outlineScore(arrays(parts), arrays(mid), px);
   assert.ok(score.kept >= MID_OUTLINE.kept && score.extra <= MID_OUTLINE.extra && score.area >= MID_OUTLINE.area, `${name} at ${share}: kept ${score.kept.toFixed(2)}, extra ${score.extra.toFixed(2)}, area ${score.area.toFixed(2)}`);
   assert.equal(midParts(name, share), mid, 'made once');
  }
 }
});

test('the grids are worked out ahead: src/mid-cells.js is what tools/mid-cells.mjs writes, for every share a tier asks for', () => {
 const shares = midTiers().map(t => t.share);
 assert.deepEqual(shares, [...new Set([TIERS.high.midTrees.share, TIERS.ultra.midTrees.share])].sort(), 'High and Ultra ask for one');
 assert.equal(TIERS.low.midTrees, undefined); assert.equal(TIERS.medium.midTrees, undefined);
 assert.equal(fs.readFileSync(new URL('../src/mid-cells.js', import.meta.url), 'utf8'), render(midCells()), 'run node tools/mid-cells.mjs');
 for (const s of shares) assert.ok(Object.keys(MID_CELLS[s]).length > 100, `share ${s} has its models`);
 // A model none of whose middle versions keeps its outline has none, and says so with zeros.
 const whole = Object.entries(MID_CELLS[shares[0]]).filter(([, c]) => c.every(x => !x)).map(([k]) => k);
 assert.ok(whole.includes('Blender_Palo_1'), 'thin wood is left whole');
 assert.equal(midParts('Blender_Palo_1', shares[0]), null, 'and the game makes it no middle version');
 assert.ok(whole.length < 30, `${whole.length} models left whole`);
});

// Two kinds of tree in the same squares: one 30 units tall, one 8.
const stand = opts => {
 const parts = modelParts('Blender_Oak_1'), leaf = parts.findIndex(p => p.role === 'leaf');
 const group = new T.Group(), m = new T.Matrix4(), n = 60, meshes = {};
 for (const [key, model, scale] of [['tall', 'Blender_Oak_1', 30], ['short', 'Blender_Oak_2', 8]]) {
  const ps = modelParts(model), at = ps.findIndex(p => p.role === 'leaf');
  const mesh = new T.InstancedMesh(ps[at].geometry, new T.MeshBasicMaterial(), n);
  for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, m.makeScale(scale, scale, scale).setPosition((i % 6) * 9 - 22 + (key === 'short' ? 4 : 0), 0, Math.floor(i / 6) * 60)); mesh.setColorAt(i, new T.Color(1, 1, 1)); }
  mesh.userData = {model, part: at, role: 'leaf'}; mesh.castShadow = true;
  group.add(mesh); meshes[key] = mesh;
 }
 const cull = cullInstances(group, opts);
 return {group, cull, meshes, leaf};
};
const farOf = (group, mesh) => group.children.find(o => o.name === 'far trees' && o.userData.farOf === mesh);

test('on a tier with middle versions the far mesh is the middle version, and the shadow stand-in is still the twin', () => {
 const {group, cull, meshes} = stand({farPainted: .05, midShare: .25, farPaintedPx: 300, screenPx: () => 1080, thinShadowsFrom: 1});
 cull.update(camera(), null);
 const far = farOf(group, meshes.tall), part = meshes.tall.userData.part;
 assert.ok(far, 'a far mesh for the oak');
 assert.equal(far.geometry, midParts('Blender_Oak_1', .25)[part].geometry, 'drawn with the middle version');
 const twins = group.children.filter(o => o.name === 'shadow twin');
 assert.ok(twins.length >= 1, 'a stand-in for the far shadow maps');
 for (const t of twins) assert.ok([modelParts('Blender_Oak_1_Far'), modelParts('Blender_Oak_2_Far')].some(ps => ps.some(p => p.geometry === t.geometry)), 'which is the shipped twin');
 // And without the tier's asking, the far mesh is the twin as before.
 const plain = stand({farPainted: .05});
 plain.cull.update(camera(), null);
 assert.equal(farOf(plain.group, plain.meshes.tall).geometry, modelParts('Blender_Oak_1_Far')[part].geometry);
});

test('each kind of tree in a square is swapped by its own height, not by the tallest thing there', () => {
 const {group, cull, meshes} = stand({farPainted: .03});
 cull.update(camera(-400), null);
 const count = mesh => ({whole: mesh.count, far: farOf(group, mesh)?.count ?? 0});
 const tall = count(meshes.tall), short = count(meshes.short);
 assert.ok(tall.whole + tall.far > 20 && short.whole + short.far > 20, 'both kinds are in view');
 // The same squares at the same distances: the short kind is under the line
 // where the tall kind is still over it.
 assert.ok(short.far > tall.far, `the short kind swaps sooner (far ${short.far} of the short, ${tall.far} of the tall)`);
 assert.ok(tall.whole > short.whole, `and the tall kind stays whole further out (${tall.whole} against ${short.whole})`);
 // No tree is lost or doubled outside the fade.
 const fades = group.children.filter(o => o.name === 'fading trees').reduce((a, o) => a + o.count, 0);
 assert.ok(tall.whole + tall.far + short.whole + short.far + fades >= 20, 'trees are held');
});

test('the line in pixels wins where it is more of the screen, and a taller screen moves it', () => {
 const far = px => {
  const s = stand({farPainted: .02, midShare: .25, farPaintedPx: 40, screenPx: () => px});
  s.cull.update(camera(-400), null);
  return farOf(s.group, s.meshes.tall)?.count ?? 0;
 };
 const small = far(720), large = far(2160);
 assert.ok(small > large, `40 pixels is more of a 720-line screen than of a 2,160-line one (${small} far against ${large})`);
 // With no pixel line, only the share counts.
 const s = stand({farPainted: .02, midShare: .25});
 s.cull.update(camera(-400), null);
 assert.ok((farOf(s.group, s.meshes.tall)?.count ?? 0) <= large, 'and without one the share alone decides');
});

test('a tree out of the picture, kept for its shadow, is drawn as its far version however near it is', () => {
 // A row of big oaks beside the view, 40 to 90 m east of a camera looking
 // north: near enough to be whole models, and out of the picture.
 const build = sun => {
  const parts = modelParts('Blender_Oak_1'), at = parts.findIndex(p => p.role === 'leaf');
  const group = new T.Group(), m = new T.Matrix4(), n = 40;
  const mesh = new T.InstancedMesh(parts[at].geometry, new T.MeshBasicMaterial(), n);
  for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, m.makeScale(25, 25, 25).setPosition(i < 20 ? 150 + (i % 5) * 12 : (i % 5) * 6 - 12, 0, i < 20 ? -380 + Math.floor(i / 5) * 12 : -300 + Math.floor((i - 20) / 5) * 12)); mesh.setColorAt(i, new T.Color(1, 1, 1)); }
  mesh.userData = {model: 'Blender_Oak_1', part: at, role: 'leaf'}; mesh.castShadow = true;
  group.add(mesh);
  const cull = cullInstances(group, {farPainted: .02});
  const cam = new T.PerspectiveCamera(30, 16 / 9, .5, 20000);
  cam.position.set(0, 2, -520); cam.lookAt(0, 2, 0); cam.updateMatrixWorld();
  cull.update(cam, sun);
  return {whole: mesh.count, far: farOf(group, mesh)?.count ?? 0};
 };
 // No sun: the trees beside the view are not drawn at all; those ahead are whole.
 const dark = build(null);
 assert.equal(dark.far, 0, 'nothing ahead is small enough to swap');
 assert.ok(dark.whole >= 20 && dark.whole < 40, `only what is in view (${dark.whole})`);
 // A low sun in the east throws the side trees' shadows across the view:
 // they are kept, and as their far version -- the trees ahead still whole.
 const lit = build(new T.Vector3(1, .12, 0).normalize());
 assert.equal(lit.whole, dark.whole, 'the trees in the picture are as they were');
 assert.ok(lit.far >= 15, `the shadow casters beside the view are far versions (${lit.far})`);
});
