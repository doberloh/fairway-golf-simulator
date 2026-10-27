// TREES IN STILL WATER (the far-landscape goal; the owner: "Trees in calm
// ponds' reflections, from the bank and a tee").
//
// A pond's reflection was a cube probe photographed from its middle: right
// for the sky, wrong for the bank -- a tree beside the water sits in a
// different place in a mirror seen from the far bank than in a photograph
// taken from the middle -- and, measured, the trees barely showed in it at
// all. A true mirror renders the whole scene again from below each pond,
// which is a second frame per pond.
//
// So the mirror holds only what it is for: the trees round each still pond,
// as low-poly twins (the far woods' shapes, vegetation.js farWoodGeometry,
// with a trunk), each turned upside down about ITS OWN pond's level, and
// drawn with the ordinary camera into a picture half the screen's size. A
// pond reads that picture where its surface is a mirror (renderer.js
// WATER_EDGES), so a tree appears exactly where its reflection would be,
// from any bank, and the sky's probe shows everywhere else. A few hundred
// instanced crowns a frame, and only while a still pond is near.
//
// The twins are unlit colour: the pond lights them with the light it gets.
import * as T from 'three';
import {crownRadius} from './species.js';

// Conifers read as spires in water; everything else as a round crown.
const SPIRE = /pine|spruce|cedar|fir|hemlock|redwood|cypress|larch/i;

export function makeWaterMirror(view, {farWoodGeometry, colors, reach = 30}) {
 const still = view.waterBodies.filter(b => !b.ocean && !b.stream);
 if (!still.length) return null;
 const trees = view.world.trees || [];
 const ponds = still.map(b => {
  b.mesh.geometry.computeBoundingSphere?.();
  const R = b.mesh.geometry.boundingSphere?.radius ?? 30;
  return {b, R, x: b.center?.x ?? 0, z: b.center?.z ?? 0};
 });
 const rounds = [], spires = [], trunks = [];
 for (const t of trees) {
  if (!(t.h > 3)) continue;
  // The nearest pond whose rim the tree stands within `reach` of plus its
  // height (a taller tree reflects from further back).
  let pond = null, best = 1e9;
  for (const p of ponds) { const d = Math.hypot(t.x - p.x, t.z - p.z) - p.R; if (d < reach + t.h && d < best) { best = d; pond = p; } }
  if (!pond || t.y < pond.b.level + .2) continue;
  (SPIRE.test(t.kind || '') ? spires : rounds).push({t, level: pond.b.level});
  trunks.push({t, level: pond.b.level});
 }
 if (!rounds.length && !spires.length) return null;
 const scene = new T.Scene(), m = new T.Matrix4(), flip = new T.Matrix4(), c = new T.Color();
 const mat = new T.MeshBasicMaterial({side: T.DoubleSide});
 const pick = (t, k) => { const v = Math.sin(t.x * 12.9898 + t.z * 78.233 + k) * 43758.5453; return v - Math.floor(v); };
 const add = (list, geo, place, colour) => {
  if (!list.length) { geo.dispose(); return; }
  const mesh = new T.InstancedMesh(geo, mat, list.length);
  list.forEach(({t, level}, i) => {
   place(t, m);
   // Upside down about the pond's own level: y -> 2 level - y.
   flip.makeScale(1, -1, 1).setPosition(0, 2 * level, 0);
   mesh.setMatrixAt(i, m.premultiply(flip));
   mesh.setColorAt(i, colour(t, c));
  });
  mesh.frustumCulled = false; scene.add(mesh);
 };
 const crown = (t, k) => colors[Math.floor(pick(t, k) * colors.length) % colors.length];
 // A round crown: the cluster's top at the tree's top, as wide as its crown
 // (the shape is about 1.01 of its radius tall), never more than 70% of the tree.
 add(rounds, farWoodGeometry('cluster'), (t, mm) => { const r = crownRadius(t) || t.r || t.h * .3; const top = Math.min(t.h * .7, 1.02 * r); mm.compose(new T.Vector3(t.x, t.y + t.h - top, t.z), new T.Quaternion(), new T.Vector3(top / 1.02, top / 1.02, top / 1.02)); },
  (t, cc) => cc.copy(crown(t, 1)));
 // A spire from a sixth of the way up to the top.
 add(spires, farWoodGeometry('spruce'), (t, mm) => { const s = t.h * .83 / 3.4; mm.compose(new T.Vector3(t.x, t.y + t.h * .17, t.z), new T.Quaternion(), new T.Vector3(s, s, s)); },
  (t, cc) => cc.copy(crown(t, 2)).multiplyScalar(.8));
 const trunk = new T.CylinderGeometry(.6, 1, 1, 5, 1).translate(0, .5, 0);
 add(trunks, trunk, (t, mm) => { const w = Math.max(.15, t.h * .025); mm.compose(new T.Vector3(t.x, t.y, t.z), new T.Quaternion(), new T.Vector3(w, t.h * .55, w)); },
  (t, cc) => cc.set('#3b2f25'));
 const target = new T.WebGLRenderTarget(4, 4, {depthBuffer: true});
 return {
  scene, target, ponds,
  // Drawn when a still pond is within `near` m of the camera, else cleared.
  render(renderer, camera, size, near = 700) {
   const w = Math.max(4, Math.round(size.x / 2)), h = Math.max(4, Math.round(size.y / 2));
   if (target.width !== w || target.height !== h) target.setSize(w, h);
   const was = renderer.getRenderTarget(), clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
   renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear();
   if (ponds.some(p => Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < near + p.R)) renderer.render(scene, camera);
   renderer.setRenderTarget(was); renderer.setClearColor(clear, alpha);
  },
  dispose() { target.dispose(); scene.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); mat.dispose(); },
 };
}
