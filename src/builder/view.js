// THE EDITOR'S VIEW (the course builder, stages 3-5; docs/COURSE_BUILDER.md,
// *The editor*): the land as it is being shaped, its surfaces in the
// landscape's own colours, the water, trees and holes, and the mouse on the
// ground. A WORKING view, not the game's picture: the game's renderer builds a
// whole course in seconds and a brush needs the next frame, so this draws the
// land as plain meshes rebuilt only where a stroke reached, and the surfaces
// as one texture updated only where a brush painted. How the course looks in
// Fairway is what *Play in Fairway* is for (PLACED, docs/COURSE_BUILDER.md).
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {biomeOf} from '../biomes.js';
import {GROUNDS} from '../grounds.js';
import {PAINT} from './editing.js';
import {TEE_COLORS} from '../course-plan.js';

// The land's mesh: chunks of CHUNK samples a side, every `stride`-th sample of
// the stored grid (1 m stored; a course past about 1 km a side drawn at 2 or
// 3 m so the view stays under two million vertices -- PLACED).
const CHUNK = 128, MAX_VERTS = 2.2e6;

export function surfaceColours(key) {
 const bio = biomeOf(key), c = v => new T.Color(v);
 return PAINT.map(kind => {
  const col = kind === 'rough' ? bio.rough : kind === 'semi' ? bio.semi : kind === 'fairway' ? bio.fairway : kind === 'green' ? bio.green
   : kind === 'tee' ? bio.fairway : kind === 'sand' ? bio.sand : kind === 'water' ? (bio.water || '#4a8fb0') : GROUNDS[kind]?.map ?? bio.rough;
  const k = c(col); if (kind === 'tee') k.lerp(c('#ffffff'), .12);
  return [Math.round(k.r * 255), Math.round(k.g * 255), Math.round(k.b * 255)];
 });
}

export function createView(parent, editor, {onReady = () => {}} = {}) {
 const s = editor.state, r = s.raster, L = s.land;
 const renderer = new T.WebGLRenderer({antialias: true});
 renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
 parent.append(renderer.domElement);
 renderer.domElement.tabIndex = 0;
 const scene = new T.Scene();
 scene.background = new T.Color('#a9cfe8');
 scene.fog = new T.Fog('#a9cfe8', 1500, 6000);
 const camera = new T.PerspectiveCamera(50, 1, .5, 12000);
 scene.add(new T.HemisphereLight('#ffffff', '#8c9a7c', 2.3));
 const sun = new T.DirectionalLight('#fff4e0', 1.5); sun.position.set(-.5, 1, .35); scene.add(sun);
 const controls = new OrbitControls(camera, renderer.domElement);
 controls.mouseButtons = {LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE};
 controls.maxPolarAngle = Math.PI * .495; controls.screenSpacePanning = false;

 // ---- surfaces: one texture of the editing grid in the landscape's colours.
 let colours = surfaceColours(s.landscape);
 const tex = new T.DataTexture(new Uint8Array(r.nx * r.nz * 4), r.nx, r.nz, T.RGBAFormat);
 tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearFilter; tex.colorSpace = T.SRGBColorSpace;
 const paintCells = (i0, i1, j0, j1, into = tex.image.data, w = r.nx, ox = 0, oz = 0) => {
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
   const c = colours[r.layers.view[j * r.nx + i]], o = ((j - oz) * w + (i - ox)) * 4;
   into[o] = c[0]; into[o + 1] = c[1]; into[o + 2] = c[2]; into[o + 3] = 255;
  }
 };
 paintCells(0, r.nx - 1, 0, r.nz - 1); tex.needsUpdate = true;
 const material = new T.MeshLambertMaterial({map: tex});

 // ---- the land.
 const stride = Math.max(1, Math.ceil(Math.sqrt(L.nx * L.nz / MAX_VERTS)));
 const cz = L.cellZ ?? L.cell, ex = s.ex, ez = s.ez;
 const sx = Math.floor((L.nx - 1) / stride), sz = Math.floor((L.nz - 1) / stride);
 const chunks = [];
 for (let cj = 0; cj < sz; cj += CHUNK) for (let ci = 0; ci < sx; ci += CHUNK) {
  const w = Math.min(CHUNK, sx - ci), h = Math.min(CHUNK, sz - cj);
  const g = new T.PlaneGeometry(1, 1, w, h), pos = g.attributes.position, uv = g.attributes.uv;
  for (let b = 0; b <= h; b++) for (let a = 0; a <= w; a++) {
   const k = b * (w + 1) + a, x = L.x0 + (ci + a) * stride * L.cell, z = L.z0 + (cj + b) * stride * cz;
   pos.setXYZ(k, x, 0, z); uv.setXY(k, (x + ex) / (2 * ex), (z + ez) / (2 * ez));
  }
  // PlaneGeometry's rows run down its y; laid here with rows running up z,
  // its triangles (a, b, d) already face up: (b - a) x (d - a) is +y.
  const mesh = new T.Mesh(g, material);
  mesh.userData = {ci, cj, w, h, x0: L.x0 + ci * stride * L.cell, x1: L.x0 + (ci + w) * stride * L.cell, z0: L.z0 + cj * stride * cz, z1: L.z0 + (cj + h) * stride * cz};
  chunks.push(mesh); scene.add(mesh);
 }
 const heightChunk = m => {
  const pos = m.geometry.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, editor.height(pos.getX(k), pos.getZ(k)));
  pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox();
 };
 for (const m of chunks) heightChunk(m);

 // ---- water, trees, holes: rebuilt whole when they change (they are small).
 const layers = {water: new T.Group(), trees: new T.Group(), holes: new T.Group(), marks: new T.Group()};
 for (const g of Object.values(layers)) scene.add(g);
 const clear = g => { for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose(); } };
 function refreshWater() {
  clear(layers.water);
  for (const w of s.water) {
   const [outer, ...holes] = w.rings, shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, -z)));
   for (const ring of holes) shape.holes.push(new T.Path(ring.map(([x, z]) => new T.Vector2(x, -z))));
   const geo = new T.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
   const m = new T.Mesh(geo, new T.MeshLambertMaterial({color: biomeOf(s.landscape).water || '#4a8fb0', transparent: true, opacity: .85}));
   m.position.y = w.level; layers.water.add(m);
  }
  // Creeks: a ribbon along the stations at their own levels.
  for (const c of s.creeks || []) {
   const pos = [], idx = [];
   c.points.forEach(([x, z, width, level, , nx, nz], i) => { const h = width / 2; pos.push(x + nx * h, level, z + nz * h, x - nx * h, level, z - nz * h); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
   const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
   layers.water.add(new T.Mesh(geo, new T.MeshLambertMaterial({color: biomeOf(s.landscape).water || '#4a8fb0', side: T.DoubleSide})));
  }
 }
 const crown = new T.ConeGeometry(1, 1, 7); crown.translate(0, .5, 0);
 function refreshTrees() {
  clear(layers.trees);
  if (!s.trees.length) return;
  const n = Math.min(s.trees.length, 120000), mesh = new T.InstancedMesh(crown, new T.MeshLambertMaterial({color: '#ffffff'}), n);
  const m = new T.Matrix4(), q = new T.Quaternion(), roleCol = [new T.Color('#2f6b3a'), new T.Color('#1f5132'), new T.Color('#3f7d36'), new T.Color('#6b8f3a'), new T.Color('#4f8d4a')];
  for (let i = 0; i < n; i++) {
   const [x, z, h, cr, , role] = s.trees[i];
   m.compose(new T.Vector3(x, editor.height(x, z), z), q, new T.Vector3(Math.max(.6, cr), Math.max(.8, h), Math.max(.6, cr)));
   mesh.setMatrixAt(i, m); mesh.setColorAt(i, roleCol[role & 7] || roleCol[0]);
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
  layers.trees.add(mesh);
 }
 function refreshHoles(selected = -1) {
  clear(layers.holes);
  const ball = new T.SphereGeometry(1.6, 12, 8), pole = new T.CylinderGeometry(.15, .15, 6, 6); pole.translate(0, 3, 0);
  const flag = new T.PlaneGeometry(2.4, 1.6); flag.translate(1.2, 5.2, 0);
  s.holes.forEach((h, i) => {
   const on = i === selected, line = new T.BufferGeometry().setFromPoints(h.line.map(([x, z]) => new T.Vector3(x, editor.height(x, z) + .6, z)));
   layers.holes.add(new T.Line(line, new T.LineBasicMaterial({color: on ? '#fde68a' : '#ffffff', transparent: true, opacity: on ? 1 : .55})));
   for (const t of h.tees) { const m = new T.Mesh(ball, new T.MeshBasicMaterial({color: TEE_COLORS[{back: 'blue', middle: 'white', front: 'red'}[t.set] || 'white'] || '#ffffff'})); m.position.set(t.x, editor.height(t.x, t.z) + .8, t.z); layers.holes.add(m); }
   const g = new T.Group(); g.add(new T.Mesh(pole, new T.MeshBasicMaterial({color: '#f4f2e7'}))); g.add(new T.Mesh(flag, new T.MeshBasicMaterial({color: on ? '#fde68a' : '#d4443a', side: T.DoubleSide})));
   g.position.set(h.green.x, editor.height(h.green.x, h.green.z), h.green.z); g.userData.hole = i; layers.holes.add(g);
  });
 }
 refreshWater(); refreshTrees(); refreshHoles();

 // ---- the cursor: a ring lying on the ground.
 const ringGeo = new T.BufferGeometry(), RING = 64;
 ringGeo.setAttribute('position', new T.BufferAttribute(new Float32Array((RING + 1) * 3), 3));
 const ring = new T.Line(ringGeo, new T.LineBasicMaterial({color: '#fde68a', depthTest: false}));
 ring.renderOrder = 10; ring.visible = false; scene.add(ring);
 const draft = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: '#ffffff', depthTest: false})); draft.renderOrder = 11; scene.add(draft);

 const raycaster = new T.Raycaster(), ndc = new T.Vector2();
 let width = 1, height = 1;
 function resize() {
  width = parent.clientWidth || 1; height = parent.clientHeight || 1;
  renderer.setSize(width, height, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  camera.aspect = width / height; camera.updateProjectionMatrix();
 }
 new ResizeObserver(resize).observe(parent); resize();
 // Start over the first hole, looking down it from behind its tee.
 function frameHole(i = 0) {
  const h = s.holes[i] || s.holes[0], t = h.tees[0], g = h.green, dx = g.x - t.x, dz = g.z - t.z, len = Math.hypot(dx, dz) || 1;
  const y = editor.height(t.x, t.z);
  camera.position.set(t.x - dx / len * 60, y + 45, t.z - dz / len * 60);
  controls.target.set((t.x + g.x) / 2, editor.height((t.x + g.x) / 2, (t.z + g.z) / 2), (t.z + g.z) / 2); controls.update();
 }
 function planView() {
  const H = Math.max(s.ex, s.ez) * 1.6;
  controls.target.set(0, editor.height(0, 0), 0); camera.position.set(0, H, 1); controls.update();
 }
 frameHole(0);

 let running = true;
 (function frame() { if (!running) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame); })();
 onReady();

 return {
  renderer, scene, camera, controls, canvas: renderer.domElement, stride,
  // The ground point under a mouse event, or null.
  pick(e) {
   const b = renderer.domElement.getBoundingClientRect();
   ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
   raycaster.setFromCamera(ndc, camera);
   const hit = raycaster.intersectObjects(chunks, false)[0];
   return hit ? {x: hit.point.x, y: hit.point.y, z: hit.point.z} : null;
  },
  // A tool takes the left button; navigating gives it back to panning.
  setToolActive(on) { controls.mouseButtons.LEFT = on ? null : T.MOUSE.PAN; },
  cursor(x, z, radius) {
   if (x == null) { ring.visible = false; return; }
   const p = ringGeo.attributes.position;
   for (let k = 0; k <= RING; k++) { const a = k / RING * Math.PI * 2, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius; p.setXYZ(k, px, editor.height(px, pz) + .25, pz); }
   p.needsUpdate = true; ringGeo.computeBoundingSphere(); ring.visible = true;
  },
  // An outline being drawn, point by point.
  draft(points) { draft.geometry.dispose(); draft.geometry = new T.BufferGeometry().setFromPoints(points.map(([x, z]) => new T.Vector3(x, editor.height(x, z) + .4, z))); },
  refreshLand([x0, x1, z0, z1]) { for (const m of chunks) { const u = m.userData; if (u.x1 >= x0 && u.x0 <= x1 && u.z1 >= z0 && u.z0 <= z1) heightChunk(m); } },
  refreshSurface([x0, x1, z0, z1]) {
   const i0 = Math.max(0, Math.floor((x0 - r.x0) / r.cell)), i1 = Math.min(r.nx - 1, Math.ceil((x1 - r.x0) / r.cell));
   const j0 = Math.max(0, Math.floor((z0 - r.z0) / r.cell)), j1 = Math.min(r.nz - 1, Math.ceil((z1 - r.z0) / r.cell));
   if (i1 < i0 || j1 < j0) return;
   paintCells(i0, i1, j0, j1);
   // Only the rectangle painted goes to the card, not the whole texture.
   const w = i1 - i0 + 1, h = j1 - j0 + 1, part = new Uint8Array(w * h * 4);
   paintCells(i0, i1, j0, j1, part, w, i0, j0);
   const src = new T.DataTexture(part, w, h, T.RGBAFormat); src.colorSpace = T.SRGBColorSpace; src.needsUpdate = true;
   try { renderer.copyTextureToTexture(src, tex, null, new T.Vector2(i0, j0)); } catch { tex.needsUpdate = true; }
   src.dispose();
  },
  refreshAll() { colours = surfaceColours(s.landscape); paintCells(0, r.nx - 1, 0, r.nz - 1); tex.needsUpdate = true; for (const m of chunks) heightChunk(m); refreshWater(); refreshTrees(); refreshHoles(); },
  refreshWater, refreshTrees, refreshHoles, frameHole, planView,
  dispose() { running = false; controls.dispose(); renderer.dispose(); renderer.domElement.remove(); tex.dispose(); material.dispose(); for (const m of chunks) m.geometry.dispose(); },
 };
}
