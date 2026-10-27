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
// over a dark column of shade), each turned upside down about ITS OWN pond's level, and
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

export function makeWaterMirror(view, {farWoodGeometry, colors, reach = 60}) {
 const still = view.waterBodies.filter(b => !b.ocean && !b.stream);
 if (!still.length) return null;
 const trees = view.world.trees || [];
 const ponds = still.map(b => {
  b.mesh.geometry.computeBoundingSphere?.();
  const R = b.mesh.geometry.boundingSphere?.radius ?? 30;
  return {b, R, x: b.center?.x ?? 0, z: b.center?.z ?? 0};
 });
 const rounds = [], spires = [];
 for (const t of trees) {
  // Round 11: bushes too, 1.2 m and up, where they stand within 15 m of the
  // rim -- the bank's shrubs fill the first metre of a pond's reflection.
  if (!(t.h > 1.2)) continue;
  const bush = !(t.h > 3);
  // The nearest pond whose rim the tree stands within `reach` of plus its
  // height (a taller tree reflects from further back).
  let pond = null, best = 1e9;
  for (const p of ponds) { const d = Math.hypot(t.x - p.x, t.z - p.z) - p.R; if (d < (bush ? 15 : reach + t.h) && d < best) { best = d; pond = p; } }
  if (!pond || t.y < pond.b.level + .2) continue;
  (SPIRE.test(t.kind || '') ? spires : rounds).push({t, level: pond.b.level});
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
 // Round 9: crowns a third larger, to three quarters of the tree: at the
 // crown radius alone they sat small at the foot of long dark columns, where
 // above the water the same broadleaves fill most of their height.
 const CROWN = 1.35;
 // A round crown: the cluster's top at the tree's top, as wide as its crown
 // (the shape is about 1.01 of its radius tall), never more than 75% of the tree.
 add(rounds, farWoodGeometry('cluster'), (t, mm) => { const r = (crownRadius(t) || t.r || t.h * .3) * CROWN; const top = Math.min(t.h * .75, 1.02 * r); mm.compose(new T.Vector3(t.x, t.y + t.h - top, t.z), new T.Quaternion(), new T.Vector3(top / 1.02, top / 1.02, top / 1.02)); },
  (t, cc) => cc.copy(crown(t, 1)));
 // A spire from a sixth of the way up to the top.
 add(spires, farWoodGeometry('spruce'), (t, mm) => { const s = t.h * .83 / 3.4; mm.compose(new T.Vector3(t.x, t.y + t.h * .17, t.z), new T.Quaternion(), new T.Vector3(s, s, s)); },
  (t, cc) => cc.copy(crown(t, 2)).multiplyScalar(.8));
 // No trunks (round 5): thin dark lines down the water read as posts. But
 // crowns alone floated mid-pond, cut off from the bank (round 6): between a
 // bank and its trees' reflected crowns lies the shade under them. So each
 // tree's foot to its crown is a dark column most of the crown's width -- the
 // reflected woods' shadowed floor -- joining crown to bank.
 const shade = [...rounds, ...spires];
 // Round 7: narrower at the foot (0.7 of the top), and a dark neutral half
 // toward the shade colour -- in the crown's own hue they stood in Autumn's
 // pond as a row of orange-brown boxes; dark, neighbours merge into one band.
 const shadeTone = new T.Color('#1e2418');
 add(shade, new T.CylinderGeometry(1, .7, 1, 7, 1, true).translate(0, .5, 0), (t, mm) => {
  const spire = SPIRE.test(t.kind || ''), r = (spire ? t.h * .18 : crownRadius(t) || t.r || t.h * .3) * .7;
  const foot = spire ? t.h * .17 : t.h - Math.min(t.h * .75, 1.02 * (crownRadius(t) || t.r || t.h * .3) * CROWN);
  mm.compose(new T.Vector3(t.x, t.y, t.z), new T.Quaternion(), new T.Vector3(r, foot + r * .3, r));
 }, (t, cc) => cc.copy(crown(t, 1)).multiplyScalar(.32).lerp(shadeTone, .5));
 // THE BANK ITSELF (round 8): a pond's bank rises from the water, and its edge
 // reflects as a thin dark band just under the waterline that the reflected
 // woods hang from; without it the sky's probe showed right up to the shore.
 // A skirt per pond drawn from its own outline (the ShapeGeometry the water
 // was made from): from the waterline, 1.5 m out and 0.5 m up, turned over
 // like the trees. A pond made any other way has none.
 const bankMat = new T.MeshBasicMaterial({color: new T.Color(view.world?.bio?.rough ?? '#5b6b3a').multiplyScalar(.45).lerp(shadeTone, .3), side: T.DoubleSide});
 for (const p of ponds) {
  const shapes = p.b.mesh.geometry.parameters?.shapes, shape = Array.isArray(shapes) ? shapes[0] : shapes;
  const pts = shape?.getPoints?.();
  if (!pts || pts.length < 3) continue;
  const n = pts.length, L = p.b.level, pos = [], idx = [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const inward = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
   const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], q = pts[i];
   let tx = b.x - a.x, ty = b.y - a.y; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
   // Outward in the shape's plane is (ty, -tx) x inward; the plane's second axis is -z.
   const ox = ty * inward, oz = tx * inward;
   pos.push(q.x, L, -q.y, q.x + ox * 1.5, 2 * L - (L + .5), -q.y + oz * 1.5);
   const k = i * 2, m = ((i + 1) % n) * 2; idx.push(k, m, k + 1, k + 1, m, m + 1);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const skirt = new T.Mesh(g, bankMat); skirt.frustumCulled = false; scene.add(skirt);
 }
 const target = new T.WebGLRenderTarget(4, 4, {depthBuffer: true});
 const frustum = new T.Frustum(), view4 = new T.Matrix4(), sphere = new T.Sphere(), center = new T.Vector3();
 return {
  scene, target, ponds,
  // Drawn when a still pond is within `near` m of the camera, else cleared.
  render(renderer, camera, size, near = 700) {
   const w = Math.max(4, Math.round(size.x / 2)), h = Math.max(4, Math.round(size.y / 2));
   if (target.width !== w || target.height !== h) target.setSize(w, h);
   const was = renderer.getRenderTarget(), clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
   renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear();
   // Round 14: and only when a pond is in view -- a pond behind the camera,
   // or to the side, cost the whole pass for a picture nobody reads.
   camera.updateMatrixWorld();
   frustum.setFromProjectionMatrix(view4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
   if (ponds.some(p => Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < near + p.R && frustum.intersectsSphere(sphere.set(center.set(p.x, p.b.level, p.z), p.R)))) renderer.render(scene, camera);
   renderer.setRenderTarget(was); renderer.setClearColor(clear, alpha);
  },
  dispose() { target.dispose(); scene.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); mat.dispose(); bankMat.dispose(); },
 };
}
