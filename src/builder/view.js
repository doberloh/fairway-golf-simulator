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
import {LAYER_ORDER} from './layers.js';
import {regionOf} from '../regions.js';
import {seasonPalette} from '../seasons.js';

// The land's mesh: chunks of CHUNK samples a side, every `stride`-th sample of
// the stored grid (1 m stored; a course past about 1 km a side drawn at 2 or
// 3 m so the view stays under two million vertices -- PLACED).
const CHUNK = 128, MAX_VERTS = 2.2e6;
// The surfaces' texture: up to four texels a cell each way, and no more than
// about twelve million texels -- 48 MB on the card, about the same twice in
// memory (PLACED; a big eighteen at half a metre gets about 1.5 a cell).
const SMOOTH_TEXELS = 12e6;

export function surfaceColours(key) {
 const own = biomeOf(key), bio = {...own, ...seasonPalette(own, 'summer', regionOf(key))}, c = v => new T.Color(v);
 return PAINT.map(kind => {
  const col = kind === 'rough' ? bio.rough : kind === 'semi' ? bio.semi : kind === 'fairway' ? bio.fairway : kind === 'green' ? bio.green
   : kind === 'tee' ? bio.fairway : kind === 'sand' ? bio.sand : kind === 'water' ? (bio.water || '#4a8fb0') : GROUNDS[kind]?.map ?? bio.rough;
  const k = c(col); if (kind === 'tee') k.lerp(c('#ffffff'), .12);
  return [Math.round(k.r * 255), Math.round(k.g * 255), Math.round(k.b * 255)];
 });
}

export function createView(parent, editor, {onReady = () => {}, onWindowChange = null} = {}) {
 const s = editor.state, r = s.raster, L = s.land;
 const renderer = new T.WebGLRenderer({antialias: true});
 renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
 parent.append(renderer.domElement);
 renderer.domElement.tabIndex = 0;
 const scene = new T.Scene();
 // The landscape's own sky (biomes.js `sky`), set again when it changes.
 const setSky = () => { const sky = new T.Color(biomeOf(s.landscape).sky || '#a9cfe8'); scene.background = sky; scene.fog = new T.Fog(sky, 1500, 6000); };
 setSky();
 const camera = new T.PerspectiveCamera(50, 1, .5, 12000);
 scene.add(new T.HemisphereLight('#ffffff', '#8c9a7c', 2.3));
 const sun = new T.DirectionalLight('#fff4e0', 1.5); sun.position.set(-.5, 1, .35); scene.add(sun);
 const controls = new OrbitControls(camera, renderer.domElement);
 controls.mouseButtons = {LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE};
 controls.maxPolarAngle = Math.PI * .495; controls.screenSpacePanning = false;

 // ---- surfaces AS THEY WILL PLAY (the owner, 1 November 2026: "give that 3d
 // mode the resolution treatment we gave the tracing"): each layer's outlines
 // as Save writes them (editing.js `outlines`: traced, simplified, corners
 // rounded) drawn into a texture F times finer than the editing grid, bottom
 // layer first, the hidden ones left out. While a brush is down its cells
 // show; a moment after it lifts, that part is drawn smooth again. (Until then
 // one texel a cell, nearest-filtered: every edge a staircase.)
 let colours = surfaceColours(s.landscape);
 const F = Math.max(1, Math.min(4, Math.sqrt(SMOOTH_TEXELS / (r.nx * r.nz)), renderer.capabilities.maxTextureSize / Math.max(r.nx, r.nz)));
 const W = Math.round(r.nx * F), H = Math.round(r.nz * F);
 const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H;
 const g2 = sheet.getContext('2d', {willReadFrequently: true});
 const tex = new T.DataTexture(new Uint8Array(W * H * 4), W, H, T.RGBAFormat);
 tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.colorSpace = T.SRGBColorSpace;
 tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
 const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
 // Cells [i0, i1] x [j0, j1] to the sheet: as cells, or as outlines.
 function drawCells(i0, i1, j0, j1) {
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { g2.fillStyle = rgb(colours[r.layers.view[j * r.nx + i]]); g2.fillRect(i * F, j * F, F + .5, F + .5); }
 }
 const MARGIN = 8;   // cells round a redrawn part, so outlines there close outside it
 // Cells [i0, i1] x [j0, j1] as outlines onto a sheet, `scale` texels a metre
 // from (ox, oz) -- the whole course's sheet or the close-up one.
 function drawOutlines(g, i0, i1, j0, j1, ox, oz, scale) {
  const px = x => (x - ox) * scale, pz = z => (z - oz) * scale, ax = px(r.x0 + i0 * r.cell), az = pz(r.z0 + j0 * r.cell), w = (i1 - i0 + 1) * r.cell * scale, h = (j1 - j0 + 1) * r.cell * scale;
  g.save(); g.beginPath(); g.rect(ax, az, w, h); g.clip();
  g.fillStyle = rgb(colours[0]); g.fillRect(ax, az, w, h);
  for (const kind of [...LAYER_ORDER].reverse()) {
   if (!r.layers.masks.has(kind) || r.layers.hidden.has(kind)) continue;
   const rings = editor.outlines(kind, [i0, i1, j0, j1], MARGIN); if (!rings.length) continue;
   g.fillStyle = rgb(colours[PAINT.indexOf(kind)] ?? colours[0]); g.beginPath();
   for (const ring of rings) { ring.forEach(([x, z], q) => q ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); g.closePath(); }
   g.fill('evenodd');
  }
  g.restore();
 }
 const drawSmooth = (i0, i1, j0, j1) => drawOutlines(g2, i0, i1, j0, j1, r.x0, r.z0, F / r.cell);
 // The sheet's part to the texture: the copy kept in memory, and only that
 // rectangle sent to the card.
 function upload(i0, i1, j0, j1, whole = false) {
  const x = Math.floor(i0 * F), y = Math.floor(j0 * F), w = Math.min(W, Math.ceil((i1 + 1) * F)) - x, h = Math.min(H, Math.ceil((j1 + 1) * F)) - y;
  if (w <= 0 || h <= 0) return;
  const part = g2.getImageData(x, y, w, h).data;
  for (let row = 0; row < h; row++) tex.image.data.set(part.subarray(row * w * 4, (row + 1) * w * 4), ((y + row) * W + x) * 4);
  if (whole) { tex.needsUpdate = true; return; }
  const src = new T.DataTexture(new Uint8Array(part.buffer, part.byteOffset, part.length), w, h, T.RGBAFormat); src.colorSpace = T.SRGBColorSpace; src.needsUpdate = true;
  try { renderer.copyTextureToTexture(src, tex, null, new T.Vector2(x, y)); } catch { tex.needsUpdate = true; }
  src.dispose();
 }
 drawSmooth(0, r.nx - 1, 0, r.nz - 1); upload(0, r.nx - 1, 0, r.nz - 1, true);
 // The part painted since the last smooth redraw, redrawn a moment after the
 // strokes stop (PLACED: 300 ms).
 let dirty = null, smoothTimer = 0;
 function smoothLater(i0, i1, j0, j1) {
  dirty = dirty ? [Math.min(dirty[0], i0), Math.max(dirty[1], i1), Math.min(dirty[2], j0), Math.max(dirty[3], j1)] : [i0, i1, j0, j1];
  clearTimeout(smoothTimer);
  smoothTimer = setTimeout(() => { const d = dirty; dirty = null; if (!running || !d) return; drawSmooth(...d); upload(...d); closeUp.redraw(d); }, 300);
 }
 const material = new T.MeshLambertMaterial({map: tex});

 // THE CLOSE-UP SHEET (the owner, 1 November 2026: "the traces i see in the
 // 2d editor dont match the crispness of the edges in the 3d editor"): the
 // course's sheet is a third of a metre a texel on an eighteen, so close up an
 // edge is a soft staircase, where door 2's plan draws its outlines at the
 // screen's own pixels. So the same outlines are drawn again, CLOSE texels a
 // side, over a square round the ground between the camera and where it looks --
 // its side 2.2 times the camera's distance (PLACED: 30 to 300 m, so 1.5 to 15 cm a texel;
 // farther out it stays 300 m round the middle of the view: a wider square
 // took 270 ms to draw at 800 m on an eighteen, for texels no finer than the
 // course's own) --
 // and the ground shows that sheet inside the square, fading to the course's
 // over its last twentieth. Redrawn once the camera has kept still a moment
 // (PLACED: 150 ms) and has moved a quarter of the square or zoomed by a
 // half; a brush's cells go on it at once and its outlines with the course's.
 // 16 MB on the card, a third more with its mipmaps (PLACED).
 const CLOSE = 2048;
 const closeUp = (() => {
  const sheet = document.createElement('canvas'); sheet.width = sheet.height = CLOSE;
  const g = sheet.getContext('2d', {willReadFrequently: true});
  const t = new T.CanvasTexture(sheet); t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // (x0, z0, side, on): the square in metres.
  const box = new T.Vector4(0, 0, 1, 0);
  let timer = 0, wantX = 0, wantZ = 0, wantSide = 0, on = true;
  // The cells under the square (and the margin round it).
  const cellsOf = (x0, x1, z0, z1) => [Math.max(0, Math.floor((x0 - r.x0) / r.cell)), Math.min(r.nx - 1, Math.ceil((x1 - r.x0) / r.cell)), Math.max(0, Math.floor((z0 - r.z0) / r.cell)), Math.min(r.nz - 1, Math.ceil((z1 - r.z0) / r.cell))];
  const scale = () => CLOSE / box.z;
  // Cells [i0, i1] x [j0, j1] of the course onto the sheet; `smooth` as
  // outlines, else as cells (a brush stroke); the part sent to the card.
  function draw(c, smooth) {
   const [i0, i1, j0, j1] = c; if (i1 < i0 || j1 < j0) return;
   const k = scale();
   if (smooth) drawOutlines(g, i0, i1, j0, j1, box.x, box.y, k);
   else for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { g.fillStyle = rgb(colours[r.layers.view[j * r.nx + i]]); g.fillRect((r.x0 + i * r.cell - box.x) * k, (r.z0 + j * r.cell - box.y) * k, r.cell * k + .5, r.cell * k + .5); }
   const x = Math.max(0, Math.floor((r.x0 + i0 * r.cell - box.x) * k)), y = Math.max(0, Math.floor((r.z0 + j0 * r.cell - box.y) * k));
   const w = Math.min(CLOSE, Math.ceil((r.x0 + (i1 + 1) * r.cell - box.x) * k)) - x, h = Math.min(CLOSE, Math.ceil((r.z0 + (j1 + 1) * r.cell - box.y) * k)) - y;
   if (w <= 0 || h <= 0) return;
   if (w * h > CLOSE * CLOSE / 4) { t.needsUpdate = true; return; }
   const part = g.getImageData(x, y, w, h).data, src = new T.DataTexture(new Uint8Array(part.buffer, part.byteOffset, part.length), w, h, T.RGBAFormat);
   src.colorSpace = T.SRGBColorSpace; src.needsUpdate = true;
   try { renderer.copyTextureToTexture(src, t, null, new T.Vector2(x, y)); } catch { t.needsUpdate = true; }
   src.dispose();
  }
  // The cells a box of metres (or cells) reaches inside the square.
  const inside = ([i0, i1, j0, j1]) => { const c = cellsOf(box.x, box.x + box.z, box.y, box.y + box.z); return [Math.max(i0, c[0]), Math.min(i1, c[1]), Math.max(j0, c[2]), Math.min(j1, c[3])]; };
  let ms = 0;
  function place() {
   const t0 = performance.now();
   box.set(wantX - wantSide / 2, wantZ - wantSide / 2, wantSide, 1);
   g.fillStyle = rgb(colours[0]); g.fillRect(0, 0, CLOSE, CLOSE);
   draw(cellsOf(box.x, box.x + box.z, box.y, box.y + box.z), true); t.needsUpdate = true;
   ms = performance.now() - t0;
  }
  return {
   texture: t, box, ms: () => ms,
   // Each frame: where the camera looks, and whether the square should follow.
   check() {
    if (!on) return;
    // Centred halfway between the ground under the camera and what it looks
    // at, so the near ground -- the biggest on the screen -- is inside too.
    const tg = controls.target, cp = camera.position, mx = (tg.x + cp.x) / 2, mz = (tg.z + cp.z) / 2, side = Math.max(30, Math.min(300, cp.distanceTo(tg) * 2.2));
    const far = !box.w || Math.hypot(mx - (box.x + box.z / 2), mz - (box.y + box.z / 2)) > box.z / 4 || side / box.z > 1.5 || box.z / side > 1.5;
    if (!far) { clearTimeout(timer); timer = 0; return; }
    if (wantX === mx && wantZ === mz && wantSide === side && timer) return;
    wantX = mx; wantZ = mz; wantSide = side;
    clearTimeout(timer); timer = setTimeout(() => { timer = 0; if (running) place(); }, 150);
   },
   cells: c => { if (box.w) draw(inside(c), false); },
   redraw: c => { if (box.w) draw(inside(c), true); },
   all: () => { if (box.w) place(); },
   // Off for comparing (tools/builder-look.mjs --compare); back on, it places itself.
   setOn(v) { on = v; if (!v) { clearTimeout(timer); timer = 0; box.w = 0; } },
   dispose: () => { clearTimeout(timer); t.dispose(); },
  };
 })();
 material.onBeforeCompile = sh => {
  sh.uniforms.closeMap = {value: closeUp.texture}; sh.uniforms.closeBox = {value: closeUp.box};
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D closeMap;\nuniform vec4 closeBox;\nvarying vec2 vGroundXZ;')
   .replace('#include <map_fragment>', `#include <map_fragment>
 if (closeBox.w > 0.5) {
  vec2 cuv = (vGroundXZ - closeBox.xy) / closeBox.z;
  float edge = min(min(cuv.x, 1.0 - cuv.x), min(cuv.y, 1.0 - cuv.y));
  if (edge > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(closeMap, cuv).rgb, smoothstep(0.0, 0.05, edge));
 }`);
 };

 // ---- the land.
 const stride = Math.max(1, Math.ceil(Math.sqrt(L.nx * L.nz / MAX_VERTS)));
 const cz = L.cellZ ?? L.cell;
 const sx = Math.floor((L.nx - 1) / stride), sz = Math.floor((L.nz - 1) / stride);
 const chunks = [];
 for (let cj = 0; cj < sz; cj += CHUNK) for (let ci = 0; ci < sx; ci += CHUNK) {
  const w = Math.min(CHUNK, sx - ci), h = Math.min(CHUNK, sz - cj);
  const g = new T.PlaneGeometry(1, 1, w, h), pos = g.attributes.position, uv = g.attributes.uv;
  for (let b = 0; b <= h; b++) for (let a = 0; a <= w; a++) {
   const k = b * (w + 1) + a, x = L.x0 + (ci + a) * stride * L.cell, z = L.z0 + (cj + b) * stride * cz;
   // The texel under a point exactly as the sheet was drawn: the grid is a
   // whole number of cells and the sheet a whole number of texels, neither
   // quite 2ex, so a share of 2ex put edges up to half a metre off.
   pos.setXYZ(k, x, 0, z); uv.setXY(k, (x - r.x0) * F / r.cell / W, (z - r.z0) * F / r.cell / H);
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
 const layers = {water: new T.Group(), trees: new T.Group(), rocks: new T.Group(), homes: new T.Group(), holes: new T.Group(), marks: new T.Group()};
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
 // THE TREES AS THE LANDSCAPE GROWS THEM (the owner, 1 November 2026: "the
 // 3d editor needs to look like the biome you are editing as well.
 // Everything looks like just pine trees right now"): a stand-in shape for
 // the landscape's tree (biomes.js `treeKind`) in its own colour, varied
 // tree by tree, on a trunk -- conifers as cones (the Pacific Northwest's
 // pines, the mountains' narrower spruces, the redwoods' on red trunks), a
 // round crown on the oak landscapes,
 // a palm's flat head on a tall trunk, the desert's
 // low spreading mesquite, a links' squat shrub. The game draws the real
 // models; these say what grows where. Heights times the editor's tree scale.
 const cone = new T.ConeGeometry(1, 1, 8); cone.translate(0, .5, 0);
 const ball = new T.IcosahedronGeometry(1, 1); ball.translate(0, 1, 0); ball.scale(1, .5, 1);
 const stem = new T.CylinderGeometry(.7, 1, 1, 6); stem.translate(0, .5, 0);
 // [crown geometry, where the crown starts (a share of the height), its
 // width (a share of the crown), its height cap (a share of the crown's
 // width; 0: none)].
 const SHAPE = {pine: [cone, .2, 1, 0], spruce: [cone, .12, .75, 0], oak: [ball, .32, 1, 0], palm: [ball, .86, 1, .45], cactus: [ball, .3, 1.1, .9], shrub: [ball, 0, 1, 1.1]};
 // Bushes (a stored tree of the shrub role, painted as ground cover or a
 // stand's understory) are a low green mound, not a small tree. `treeSlot`
 // finds a stored tree's instance, so one carried is moved on its own and not
 // by rebuilding a whole wood every frame.
 const treeSlot = [];
 let treeMeshes = null;
 const low = t => (t[5] & 7) === 3;
 const bushGreen = new T.Color('#7a9a52');
 function placeTree(i) {
  const at = treeSlot[i]; if (at == null || !treeMeshes) return;
  const {mesh, trunks, bushes, base, wide, cap} = treeMeshes, f = s.treeScale ?? 1, m = new T.Matrix4(), q = new T.Quaternion();
  const [x, z, h0, cr0, trunk] = s.trees[i], y = editor.height(x, z);
  if (at < 0) {
   m.compose(new T.Vector3(x, y, z), q, new T.Vector3(Math.max(.25, cr0 * f), Math.max(.2, h0 * f), Math.max(.25, cr0 * f))); bushes.setMatrixAt(~at, m); bushes.instanceMatrix.needsUpdate = true; return;
  }
  // The whole tree at the scale -- height, crown and trunk -- as toDoc saves it.
  const h = Math.max(.8, h0 * f), cr = Math.max(.6, cr0 * f) * wide;
  const crownH = Math.max(.6, cap ? Math.min(h * (1 - base), cr * 2 * cap) : h * (1 - base)), y0 = y + h * base;
  m.compose(new T.Vector3(x, y0, z), q, new T.Vector3(cr, crownH, cr)); mesh.setMatrixAt(at, m);
  const tr = Math.max(.12, (trunk ? trunk * f : h * .02) * (s.landscape === 'redwood' ? 1.6 : 1));
  m.compose(new T.Vector3(x, y, z), q, new T.Vector3(tr, Math.max(.3, y0 - y + crownH * .3), tr)); trunks.setMatrixAt(at, m);
  mesh.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
 }
 function refreshTrees() {
  clear(layers.trees); treeSlot.length = 0; treeMeshes = null;
  if (!s.trees.length) return;
  const bio = biomeOf(s.landscape), kind = SHAPE[bio.treeKind] ? bio.treeKind : 'oak', [geo, base, wide, cap] = SHAPE[kind];
  const total = Math.min(s.trees.length, 120000); let n = 0, nLow = 0;
  for (let i = 0; i < total; i++) treeSlot[i] = low(s.trees[i]) ? ~nLow++ : n++;
  const mesh = new T.InstancedMesh(geo, new T.MeshLambertMaterial({color: '#ffffff'}), n), trunks = new T.InstancedMesh(stem, new T.MeshLambertMaterial({color: s.landscape === 'redwood' ? '#7a3b26' : '#5b4634'}), n), bushes = new T.InstancedMesh(ball, new T.MeshLambertMaterial({color: '#ffffff'}), nLow);
  treeMeshes = {mesh, trunks, bushes, base, wide, cap};
  const own = new T.Color(bio.tree || '#3f7d36'), col = new T.Color(), hsl = {};
  for (let i = 0; i < total; i++) {
   placeTree(i);
   // Each its own shade: a hash of where it stands.
   const [x, z] = s.trees[i], u = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
   if (treeSlot[i] < 0) { col.copy(bushGreen).multiplyScalar(.8 + u * .4); bushes.setColorAt(~treeSlot[i], col); continue; }
   own.getHSL(hsl); col.setHSL(hsl.h + (u - .5) * .04, hsl.s, Math.max(.05, Math.min(.9, hsl.l * (.85 + u * .3))));
   mesh.setColorAt(treeSlot[i], col);
  }
  for (const g of [mesh, trunks, bushes]) { g.instanceMatrix.needsUpdate = true; g.computeBoundingSphere(); }
  if (n) mesh.instanceColor.needsUpdate = true;
  if (nLow) bushes.instanceColor.needsUpdate = true;
  layers.trees.add(trunks, mesh, bushes);
 }
 // Rocks painted as ground cover: a grey stone in the landscape's own rock
 // colour; the game draws its model (vegetation.js).
 const stone = new T.IcosahedronGeometry(1, 1); stone.scale(1, .6, .8);
 let rockMesh = null;
 function placeRock(i) {
  if (!rockMesh || !s.rocks[i]) return;
  const [x, z, size, , turn] = s.rocks[i], m = new T.Matrix4(), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), turn), k = size / 2;
  m.compose(new T.Vector3(x, editor.height(x, z) + k * .3, z), q, new T.Vector3(k, k, k)); rockMesh.setMatrixAt(i, m); rockMesh.instanceMatrix.needsUpdate = true;
 }
 function refreshRocks() {
  clear(layers.rocks); rockMesh = null;
  if (!s.rocks.length) return;
  rockMesh = new T.InstancedMesh(stone, new T.MeshLambertMaterial({color: biomeOf(s.landscape).rock || '#8a8478'}), s.rocks.length);
  for (let i = 0; i < s.rocks.length; i++) placeRock(i);
  rockMesh.computeBoundingSphere(); layers.rocks.add(rockMesh);
 }
 // Houses: a block on each footprint, 6 m to the eaves (PLACED), its front
 // marked pale -- the game builds the house itself from the same record
 // (built-world.js builtHomes); this shows where and which way.
 const block = new T.BoxGeometry(1, 1, 1); block.translate(0, .5, 0);
 function refreshHomes() {
  clear(layers.homes);
  const list = s.homes || []; if (!list.length) return;
  const mesh = new T.InstancedMesh(block, new T.MeshLambertMaterial({color: '#d67860'}), list.length), front = new T.InstancedMesh(block, new T.MeshLambertMaterial({color: '#fff4d6'}), list.length);
  const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  list.forEach((h, i) => {
   q.setFromAxisAngle(up, h.rotation); const y = editor.height(h.x, h.z);
   m.compose(new T.Vector3(h.x, y, h.z), q, new T.Vector3(h.width, 6, h.depth)); mesh.setMatrixAt(i, m);
   const fx = h.x + Math.sin(h.rotation) * h.depth / 2, fz = h.z + Math.cos(h.rotation) * h.depth / 2;
   m.compose(new T.Vector3(fx, y, fz), q, new T.Vector3(h.width * .9, 6.2, .4)); front.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true; front.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); front.computeBoundingSphere();
  layers.homes.add(mesh, front);
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
 refreshWater(); refreshTrees(); refreshRocks(); refreshHomes(); refreshHoles();

 // ---- WHAT IS SELECTED (the owner, 4 November 2026: "click to select first,
 // then outline that shape ... Click and drag on anchors on the shape to rotate
 // or click and drag inside the shape to move it"). Its outline lying on the
 // ground, four anchors at the corners of its box, and while it is carried a
 // filled picture of it in its own colour under the pointer. All of it is a
 // few hundred points laid on the land each move: the course's texture is
 // redrawn only when the shape is picked up and when it is put down, as a big
 // fairway is a million cells.
 const sel = {rings: null, mid: null, dx: 0, dz: 0, angle: 0, lines: [], fill: null, base: null, anchors: null, corners: []};
 const selGroup = new T.Group(); scene.add(selGroup);
 const lineMat = new T.LineBasicMaterial({color: '#fde68a', depthTest: false, transparent: true});
 const anchorMat = new T.PointsMaterial({color: '#ffffff', size: 13, sizeAttenuation: false, depthTest: false, transparent: true});
 const RAISE = .35;
 const carried = (x, z) => { const u = x - sel.mid.x, v = z - sel.mid.z, c = Math.cos(sel.angle), sn = Math.sin(sel.angle); return [sel.mid.x + u * c - v * sn + sel.dx, sel.mid.z + u * sn + v * c + sel.dz]; };
 function layOut() {
  sel.lines.forEach((line, q) => {
   const ring = sel.rings[q], p = line.geometry.attributes.position;
   ring.forEach(([x, z], k) => { const [px, pz] = carried(x, z); p.setXYZ(k, px, editor.height(px, pz) + RAISE, pz); });
   p.needsUpdate = true; line.geometry.computeBoundingSphere();
  });
  if (sel.fill) {
   const p = sel.fill.geometry.attributes.position;
   for (let k = 0; k < sel.base.length; k += 2) { const [px, pz] = carried(sel.base[k], sel.base[k + 1]); p.setXYZ(k / 2, px, editor.height(px, pz) + RAISE, pz); }
   p.needsUpdate = true; sel.fill.geometry.computeBoundingSphere();
  }
  if (sel.anchors) {
   const p = sel.anchors.geometry.attributes.position;
   sel.corners.forEach(([x, z], k) => { const [px, pz] = carried(x, z); p.setXYZ(k, px, editor.height(px, pz) + RAISE, pz); });
   p.needsUpdate = true; sel.anchors.geometry.computeBoundingSphere();
  }
 }
 function clearSelection() { for (const c of [...selGroup.children]) { selGroup.remove(c); c.geometry?.dispose(); if (c.material !== lineMat && c.material !== anchorMat) c.material?.dispose(); } Object.assign(sel, {rings: null, mid: null, dx: 0, dz: 0, angle: 0, lines: [], fill: null, base: null, anchors: null, corners: []}); layers.water.visible = true; }
 const project = new T.Vector3();

 // ---- the cursor: a ring lying on the ground.
 const ringGeo = new T.BufferGeometry(), RING = 64;
 ringGeo.setAttribute('position', new T.BufferAttribute(new Float32Array((RING + 1) * 3), 3));
 const ring = new T.Line(ringGeo, new T.LineBasicMaterial({color: '#fde68a', depthTest: false}));
 ring.renderOrder = 10; ring.visible = false; scene.add(ring);
 const draft = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: '#ffffff', depthTest: false})); draft.renderOrder = 11; scene.add(draft);

 const raycaster = new T.Raycaster(), ndc = new T.Vector2();
 let width = 1, height = 1;
 function resize() {
  // The screen's density too: a window moved to another screen (it changes
  // no size, so onWindowChange tells of it).
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  width = parent.clientWidth || 1; height = parent.clientHeight || 1;
  renderer.setSize(width, height, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  camera.aspect = width / height; camera.updateProjectionMatrix();
 }
 new ResizeObserver(resize).observe(parent); resize();
 const stopWatching = onWindowChange?.(resize);
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

 // WASD FLYING (the owner, 1 November 2026): W and S along the way the camera
 // looks, A and D sideways, Q and E down and up, Shift three times as fast;
 // the speed grows with height over the ground (PLACED: 25 m/s, or the height
 // a second if higher). The orbit's centre moves with it, so the mouse still
 // turns about what is ahead. Not while typing in a box.
 const held = new Set(), FLY = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);
 const typing = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
 const onDown = e => { if (FLY.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey && !typing()) { held.add(e.code); e.preventDefault(); } if (e.key === 'Shift') held.add('Shift'); };
 const onUp = e => { held.delete(e.code); if (e.key === 'Shift') held.delete('Shift'); };
 const onBlur = () => held.clear();
 window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', onBlur);
 const ahead = new T.Vector3(), side = new T.Vector3(), move = new T.Vector3();
 function fly(dt) {
  const k = c => held.has(c) ? 1 : 0, f = k('KeyW') - k('KeyS'), sd = k('KeyD') - k('KeyA'), up = k('KeyE') - k('KeyQ');
  if (!f && !sd && !up) return;
  camera.getWorldDirection(ahead); ahead.y = 0; if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1); ahead.normalize();
  side.crossVectors(ahead, camera.up).normalize();
  const speed = Math.max(25, camera.position.y - editor.height(camera.position.x, camera.position.z)) * (held.has('Shift') ? 3 : 1) * dt;
  move.copy(ahead).multiplyScalar(f * speed).addScaledVector(side, sd * speed); move.y = up * speed;
  // Never below the ground.
  const floor = editor.height(camera.position.x + move.x, camera.position.z + move.z) + 2;
  if (camera.position.y + move.y < floor) move.y = floor - camera.position.y;
  camera.position.add(move); controls.target.add(move);
 }
 let running = true, paused = false, last = performance.now();
 const frame = (now = performance.now()) => { if (!running || paused) return; fly(Math.min(.1, (now - last) / 1000)); last = now; controls.update(); closeUp.check(); renderer.render(scene, camera); requestAnimationFrame(frame); };
 frame();
 onReady();

 return {
  renderer, scene, camera, controls, canvas: renderer.domElement, stride, closeUp,
  // The ground point under a mouse event, or null.
  pick(e) {
   const b = renderer.domElement.getBoundingClientRect();
   ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
   raycaster.setFromCamera(ndc, camera);
   const hit = raycaster.intersectObjects(chunks, false)[0];
   return hit ? {x: hit.point.x, y: hit.point.y, z: hit.point.z} : null;
  },
  // Selection: {rings, mid, anchors}, or null. Anchors a little outside the
  // corners of its box (PLACED: 2.5 m, or a tenth of its size).
  select(it) {
   clearSelection();
   if (!it) return;
   sel.rings = it.rings; sel.mid = it.mid;
   for (const ring of it.rings) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(ring.length * 3), 3));
    const line = new T.LineLoop(g, lineMat); line.renderOrder = 12; line.frustumCulled = false; selGroup.add(line); sel.lines.push(line);
   }
   if (it.anchors) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of it.rings[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const pad = Math.max(2.5, Math.max(x1 - x0, z1 - z0) * .1); x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    sel.corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3));
    sel.anchors = new T.Points(g, anchorMat); sel.anchors.renderOrder = 13; sel.anchors.frustumCulled = false; selGroup.add(sel.anchors);
   }
   layOut();
  },
  // Carried this far: the outline, the anchors and the picture follow.
  carry(dx, dz, angle = 0) { if (!sel.rings) return; sel.dx = dx; sel.dz = dz; sel.angle = angle; layOut(); },
  // The filled picture of a surface being carried, in its own colour (null:
  // gone). A pond's own sheet hides while the picture of it is carried.
  ghost(kind) {
   if (sel.fill) { selGroup.remove(sel.fill); sel.fill.geometry.dispose(); sel.fill.material.dispose(); sel.fill = null; sel.base = null; }
   layers.water.visible = kind !== 'water';
   if (!kind || !sel.rings) return;
   const [outer, ...holes] = sel.rings, shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
   for (const ring of holes) shape.holes.push(new T.Path(ring.map(([x, z]) => new T.Vector2(x, z))));
   const g = new T.ShapeGeometry(shape), p = g.attributes.position; sel.base = new Float32Array(p.count * 2);
   for (let k = 0; k < p.count; k++) { sel.base[k * 2] = p.getX(k); sel.base[k * 2 + 1] = p.getY(k); }
   sel.fill = new T.Mesh(g, new T.MeshBasicMaterial({color: rgb(colours[PAINT.indexOf(kind)] ?? colours[0]), depthTest: false, transparent: true, opacity: .85, side: T.DoubleSide}));
   sel.fill.renderOrder = 11; sel.fill.frustumCulled = false; selGroup.add(sel.fill); layOut();
  },
  // The anchor under a mouse event (within 11 pixels, PLACED), or -1.
  anchorAt(e) {
   if (!sel.anchors) return -1;
   const b = renderer.domElement.getBoundingClientRect(), p = sel.anchors.geometry.attributes.position;
   for (let k = 0; k < 4; k++) {
    project.fromBufferAttribute(p, k).project(camera);
    if (Math.hypot(b.left + (project.x + 1) / 2 * b.width - e.clientX, b.top + (1 - project.y) / 2 * b.height - e.clientY) <= 11) return k;
   }
   return -1;
  },
  // One stored tree, one rock: moved without rebuilding them all.
  placeTree, placeRock,
  // Game view is showing: draw nothing until it goes. Keys held when it opened
  // are let go, or the camera would set off on its own when it closes.
  pause(on) { if (on === paused) return; paused = on; held.clear(); if (!on) { last = performance.now(); frame(); } },
  // Where the camera is and what it looks at.
  eye: () => ({eye: {x: camera.position.x, y: camera.position.y, z: camera.position.z}, look: {x: controls.target.x, y: controls.target.y, z: controls.target.z}}),
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
  // A painted box (metres): its cells at once, its outlines a moment later.
  refreshSurface([x0, x1, z0, z1]) {
   const i0 = Math.max(0, Math.floor((x0 - r.x0) / r.cell)), i1 = Math.min(r.nx - 1, Math.ceil((x1 - r.x0) / r.cell));
   const j0 = Math.max(0, Math.floor((z0 - r.z0) / r.cell)), j1 = Math.min(r.nz - 1, Math.ceil((z1 - r.z0) / r.cell));
   if (i1 < i0 || j1 < j0) return;
   drawCells(i0, i1, j0, j1); upload(i0, i1, j0, j1); closeUp.cells([i0, i1, j0, j1]);
   smoothLater(i0, i1, j0, j1);
  },
  // Every surface redrawn smooth (a layer hidden or shown, the landscape changed).
  refreshLayers() { drawSmooth(0, r.nx - 1, 0, r.nz - 1); upload(0, r.nx - 1, 0, r.nz - 1, true); closeUp.all(); },
  refreshAll() { setSky(); colours = surfaceColours(s.landscape); drawSmooth(0, r.nx - 1, 0, r.nz - 1); upload(0, r.nx - 1, 0, r.nz - 1, true); closeUp.all(); for (const m of chunks) heightChunk(m); refreshWater(); refreshTrees(); refreshRocks(); refreshHomes(); refreshHoles(); },
  texels: () => ({width: W, height: H, perCell: F, close: closeUp.box.w ? {side: closeUp.box.z, cm: closeUp.box.z / CLOSE * 100, ms: closeUp.ms()} : null}),
  refreshWater, refreshTrees, refreshRocks, refreshHomes, refreshHoles, frameHole, planView,
  held, fly,
  dispose() { stopWatching?.(); running = false; clearTimeout(smoothTimer); window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onBlur); controls.dispose(); closeUp.dispose(); renderer.dispose(); renderer.domElement.remove(); tex.dispose(); material.dispose(); clearSelection(); lineMat.dispose(); anchorMat.dispose(); for (const m of chunks) m.geometry.dispose(); },
 };
}
