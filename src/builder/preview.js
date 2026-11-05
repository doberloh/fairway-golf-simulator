// THE PREVIEW: the real model of what a tool paints or places, in a small
// panel beside the 2D plan and the 3D editor (the owner, 4 November 2026;
// preview-items.js says what is in it). The game's own models, in the game's
// colours and at their real sizes, with a golfer to measure them by.
//
// They are the full models the game draws close up (`modelParts`; the far
// twins are a family of their own, `fartwin`, and never come here). What made
// the first panel look coarse was the picture round them (the owner, 4 November
// 2026: "can we use the high rez models"): 248 pixels wide, one drawn pixel to
// a screen pixel or fewer, and plain shading. So it is drawn at twice the
// screen's density (at most three times, PLACED) and scaled down, lit with the
// game's own toon ramp, and throws a shadow to sit on its ground.
//
// It draws only when what it shows changes, or while it is dragged round: a
// single still picture, so it costs a graphics card nothing while the editor
// is in use. One panel for the whole page, moved between the two editors.
//
// The models cost the page: asset-meshes.js is about 25 MB, and it is now part
// of `Fairway Builder.html` (DISTRIBUTION_REVIEW). PLACED: the owner asked for
// the model itself, and a stand-in would not show what the game grows.
import * as T from 'three';
import {previewOf} from './preview-items.js';
import {toonRamp} from '../textures.js';
import {biomeOf} from '../biomes.js';
import {regionOf} from '../regions.js';
import {seasonPalette} from '../seasons.js';

const W = 340, H = 230;
let panel = null;
let meshes = null;
const models = () => meshes ??= import('../mesh-assets.js');

function create() {
 const box = document.createElement('div'), title = document.createElement('b'), note = document.createElement('small'), canvas = document.createElement('canvas');
 box.className = 'cb-preview'; box.hidden = true; canvas.width = W; canvas.height = H;
 box.append(title, canvas, note);
 const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'low-power'});
 renderer.setPixelRatio(Math.min(3, (devicePixelRatio || 1) * 2)); renderer.setSize(W, H, false);
 renderer.shadowMap.enabled = true;
 const ramp = toonRamp(null);
 const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, W / H, .1, 800), holder = new T.Group();
 scene.background = new T.Color('#0e2c28');
 scene.add(holder, new T.HemisphereLight('#ffffff', '#6e7a5c', 2.2));
 const sun = new T.DirectionalLight('#fff4e0', 1.6); sun.position.set(-.5, 1, .6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun, sun.target);
 let turn = -.5, token = 0, wanted = null, frame = 0;
 const draw = () => { frame = 0; holder.rotation.y = turn; renderer.render(scene, camera); };
 const later = () => { if (!frame) frame = requestAnimationFrame(draw); };
 const empty = () => { holder.traverse(o => { if (o.isMesh) { o.material.dispose(); if (o.userData.own) o.geometry.dispose(); } }); holder.clear(); };
 const flat = (geo, colour, y = 0, extra = {}) => { const m = new T.Mesh(geo, new T.MeshToonMaterial({color: colour, gradientMap: ramp, ...extra})); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.userData.own = true; holder.add(m); return m; };
 const part = (geo, colour, x, y, z) => { const m = new T.Mesh(geo, new T.MeshToonMaterial({color: colour, gradientMap: ramp})); m.position.set(x, y, z); m.castShadow = true; m.userData.own = true; holder.add(m); return m; };
 // A piece: every part of the model, painted by its role as the game paints it.
 function place(p, a) {
  const names = a.familyModels(p.family); if (!names.length) return 0;
  const name = names[(p.shape ?? 0) % names.length], parts = a.modelParts(name), {rx, rz} = a.modelExtents(name), spread = Math.max(rx, rz, .05);
  const k = p.by === 'across' ? p.size / (2 * spread) : p.size;
  const paint = {bark: p.bark, leaf: p.leaf, stone: p.leaf, dirt: p.bark, accent: p.accent};
  for (const q of parts) {
   const textured = a.modelTextured(name) && q.geometry.attributes.uv, map = textured ? a.meshAtlas(0) : null;
   const m = new T.Mesh(q.geometry, new T.MeshToonMaterial({color: map ? '#ffffff' : paint[q.role] ?? p.leaf, vertexColors: !!q.painted, map, gradientMap: ramp}));
   m.castShadow = true; m.position.set(p.x, 0, p.z); m.scale.setScalar(k); m.rotation.y = p.turn ?? 0; holder.add(m);
  }
  return k;
 }
 async function show(scene2) {
  const mine = ++token, a = scene2.pieces?.length ? await models() : null;
  if (mine !== token) return;
  empty();
  const pieces = scene2.pieces ?? [];
  const tallest = Math.max(1.8, ...pieces.map(p => p.by === 'height' ? p.size : p.size * .7));
  const reach = Math.max(4, tallest * .9, ...pieces.map(p => Math.abs(p.x) + p.size)), R = reach * 1.5;
  // Pieces stood at shares of the scene (preview-items.js); cover gives metres.
  const scaleOf = p => Math.abs(p.x) <= 1 && Math.abs(p.z) <= 1 ? reach * .6 : 1;
  flat(new T.CircleGeometry(R, 48), scene2.ground);
  if (scene2.stripes) for (let i = -3; i <= 3; i += 2) flat(new T.PlaneGeometry(R * 2 / 7, R * 1.9), scene2.stripes, .01, {transparent: true, opacity: .35}).position.x = i * R / 7;
  if (scene2.bowl) { flat(new T.CircleGeometry(R * .68, 40), scene2.bowl, .02); }
  if (scene2.water) flat(new T.CircleGeometry(R * .68, 40), scene2.water, .02);
  if (scene2.strip) flat(new T.PlaneGeometry(R * 2, R * .3), scene2.strip, .02);
  if (scene2.tee) { part(new T.SphereGeometry(.12, 10, 8), '#f4f2e7', -1.2, .12, 0); part(new T.SphereGeometry(.12, 10, 8), '#f4f2e7', 1.2, .12, 0); }
  if (scene2.flag) {
   part(new T.CylinderGeometry(.03, .03, 2.2, 6), '#f4f2e7', 0, 1.1, 0);
   const f = part(new T.PlaneGeometry(.7, .45), '#d4443a', .35, 1.95, 0); f.material.side = T.DoubleSide;
  }
  if (a) for (const p of pieces) { const s = scaleOf(p); place({...p, x: p.x * s, z: p.z * s}, a); }
  if (scene2.golfer) {
   // 1.8 m, to measure everything else by.
   const gx = reach * .95, gz = reach * .55;
   part(new T.CylinderGeometry(.16, .13, 1.45, 8), '#e8e4d8', gx, .72, gz); part(new T.SphereGeometry(.14, 10, 8), '#d8a884', gx, 1.6, gz);
  }
  camera.position.set(0, tallest * .55 + R * .62, R * 1.75); camera.lookAt(0, tallest * .3, 0);
  // The shadow's box round this scene, from the sun's side.
  sun.position.set(-R * .6, R * 1.6, R * .8); sun.target.position.set(0, 0, 0);
  const c = sun.shadow.camera; c.left = c.bottom = -R * 1.2; c.right = c.top = R * 1.2; c.near = .1; c.far = R * 4 + tallest; c.updateProjectionMatrix(); sun.shadow.bias = -.0005; sun.shadow.normalBias = R * .002;
  draw();
 }
 // Dragged round, to see it from another side.
 let spun = null;
 canvas.addEventListener('pointerdown', e => { spun = e.clientX; canvas.setPointerCapture(e.pointerId); });
 canvas.addEventListener('pointermove', e => { if (spun == null) return; turn += (e.clientX - spun) * .012; spun = e.clientX; later(); });
 canvas.addEventListener('pointerup', () => { spun = null; });
 return {
  box,
  // `item` for `landscape` (a biome key); null hides it.
  show(item, landscape) {
   const own = item ? biomeOf(landscape) : null, bio = own ? {...own, ...seasonPalette(own, 'summer', regionOf(landscape))} : null, scene2 = previewOf(item, bio);
   wanted = scene2; box.hidden = !scene2;
   if (!scene2) { token++; return; }
   title.textContent = scene2.title; note.textContent = scene2.caption ?? '';
   show(wanted).catch(() => { box.hidden = true; });
  },
  mount(parent) { parent.append(box); },
 };
}
export const preview = () => panel ??= create();
