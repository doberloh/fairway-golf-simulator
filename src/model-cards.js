// THE TINY COURSE MODELS ON THE CARDS (round 14). course-model.js makes a
// model, model-framing.js frames it; this draws them into the cards.
//
// ONE RENDERER: the game's own (renderer.js `view.renderer`) draws each model
// into one offscreen render target, read back into a small 2D canvas in the
// card -- not a WebGL context per card (browsers cap them at about sixteen and
// drop the oldest, which would be the game's). The game's render target and
// clear colour are put back after every draw.
//
// One model is made and drawn per timer tick (a model is about 50-100 ms), the
// selected card first; the flat drawing (course-picture.js) shows until then.
// Only the selected card sways, at up to 30 frames a second; the rest are drawn
// once. A hidden tab throttles both, which is fine.
//
// Read back without colour conversion: three applies the output colour space
// and tone mapping only when drawing to the screen, so the model carries its
// colours as display values (course-model.js MODEL_COLOURS) and the pixels are
// copied as they are.

import * as T from 'three';
import {layoutFor} from './course-picture.js';
import {modelPlan, modelData, buildCourseModel} from './course-model.js';
import {frameModel, SWAY} from './model-framing.js';

// WHAT THE MODEL CODE IS HANDED OF THREE, BY NAME -- never the namespace `T`
// itself. Passing `T` as a value made the bundler keep ALL of three.js (it can
// no longer tell which parts are used), file loaders and their fetch() calls
// included: 0.9's page carried three dead fetch() paths 0.8.3 had not (found
// 18 October 2026, release check). course-model.js and model-framing.js take
// `T` as an argument so their test can hand them three in Node; a name they
// start using must be added here, or the cards throw.
const PARTS = {BoxGeometry: T.BoxGeometry, BufferGeometry: T.BufferGeometry, Color: T.Color, ConeGeometry: T.ConeGeometry,
 CylinderGeometry: T.CylinderGeometry, DoubleSide: T.DoubleSide, Float32BufferAttribute: T.Float32BufferAttribute, Group: T.Group,
 IcosahedronGeometry: T.IcosahedronGeometry, InstancedMesh: T.InstancedMesh, LinearSRGBColorSpace: T.LinearSRGBColorSpace,
 Matrix4: T.Matrix4, Mesh: T.Mesh, MeshBasicMaterial: T.MeshBasicMaterial, PerspectiveCamera: T.PerspectiveCamera, Plane: T.Plane,
 Quaternion: T.Quaternion, Raycaster: T.Raycaster, Scene: T.Scene, Vector2: T.Vector2, Vector3: T.Vector3};

const MAX_W = 1024, MAX_H = 640, PERIOD = 16000;
const keyOf = s => JSON.stringify([s.seed, s.biome, s.holes, s.courseYards, s.footprint, s.spacing, s.doglegs, s.fairwayWidth, s.par3s]);

export function createModelCards({renderer, hot = () => '#facc15', doc = globalThis.document} = {}) {
 const models = new Map();     // course key -> {data, built}
 const cards = new Set();      // card records still on the page
 const queue = [];
 let rt = null, pixels = null, timer = 0, frame = 0, last = 0;

 const modelFor = settings => {
  const k = keyOf(settings) + '|' + hot();
  let m = models.get(k);
  if (!m) {
   if (models.size > 24) { const [k0, m0] = models.entries().next().value; m0.built?.dispose(); models.delete(k0); }
   const data = modelData(modelPlan(layoutFor(settings)));
   m = {data, built: buildCourseModel(PARTS, data, {hot: hot()})};
   models.set(k, m);
  }
  return m;
 };
 // Is this card the selected one (it sways)?
 const live = c => !!c.el.closest('.on,.active,[aria-pressed=true]');

 function draw(c, t) {
  const r = renderer();
  if (!r || !c.el.isConnected) return false;
  const box = c.el.getBoundingClientRect();
  if (box.width < 4 || box.height < 4) return false;
  const k = Math.min(2, globalThis.devicePixelRatio || 1);
  // The canvas covers the picture's whole leaning shape (wider by its lean).
  const lean = parseFloat(getComputedStyle(c.el).getPropertyValue('--lean')) || 0;
  const cssW = box.width + lean * (box.width / (c.el.offsetWidth || box.width));
  const w = Math.min(MAX_W, Math.round(cssW * k)), h = Math.min(MAX_H, Math.round(box.height * k));
  const m = modelFor(c.settings);
  if (!c.cam || c.w !== w || c.h !== h) { c.cam = frameModel(PARTS, m.data, w / h); c.w = w; c.h = h; }
  if (!c.canvas) {
   c.canvas = doc.createElement('canvas'); c.canvas.className = 'model-pic'; c.canvas.setAttribute('aria-hidden', 'true');
   c.el.append(c.canvas); c.el.classList.add('has-model');
  }
  if (c.canvas.width !== w || c.canvas.height !== h) { c.canvas.width = w; c.canvas.height = h; }
  if (!rt || rt.width < w || rt.height < h) {
   rt?.dispose();
   rt = new T.WebGLRenderTarget(Math.max(w, rt?.width || 0), Math.max(h, rt?.height || 0), {depthBuffer: true, samples: 4});
   pixels = null;
  }
  m.built.pivot.rotation.y = c.live ? Math.sin(t / PERIOD * Math.PI * 2) * SWAY : -SWAY * .5;
  const prev = r.getRenderTarget(), clear = r.getClearColor(new T.Color()), alpha = r.getClearAlpha(), auto = r.autoClear;
  rt.viewport.set(0, 0, w, h); rt.scissor.set(0, 0, w, h); rt.scissorTest = true;
  r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.autoClear = true;
  r.clear(); r.render(m.built.scene, c.cam);
  r.setRenderTarget(prev); r.setClearColor(clear, alpha); r.autoClear = auto;
  // Read once the target is resolved (it is multisampled) and the game's put back.
  const size = rt.width * rt.height * 4;
  if (!pixels || pixels.length < size) pixels = new Uint8Array(size);
  r.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
  // Rows come back bottom first.
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(pixels.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  c.canvas.getContext('2d').putImageData(img, 0, 0);
  c.drawn = true;
  return true;
 }

 function pump() {
  if (timer || !queue.length) return;
  timer = setTimeout(() => {
   timer = 0;
   // The selected card first, then in order.
   queue.sort((a, b) => live(b) - live(a));
   const c = queue.shift();
   try { if (cards.has(c)) { c.live = live(c); draw(c, performance.now()); } } catch (e) { console.warn('course model:', e); }
   pump();
  }, 16);
 }

 // The selected card sways; nothing else moves.
 function tick(t) {
  frame = 0;
  for (const c of [...cards]) if (!c.el.isConnected) { cards.delete(c); c.canvas?.remove(); }
  if (!cards.size) return;
  frame = requestAnimationFrame(tick);
  if (t - last < 33) return;
  last = t;
  for (const c of cards) {
   const now = live(c);
   if (now || c.live) { const was = c.live; c.live = now; if (c.drawn && (now || was)) draw(c, t); }
  }
 }

 return {
  // `items` [{el, settings}]: the cards to give models, in order. Older cards
  // no longer on the page are forgotten.
  queue(items) {
   for (const it of items) {
    if (!it.el || !it.settings) continue;
    let c = [...cards].find(x => x.el === it.el);
    if (c && keyOf(c.settings) === keyOf(it.settings)) continue;
    if (c) { cards.delete(c); c.canvas?.remove(); }
    c = {el: it.el, settings: it.settings, live: false, drawn: false};
    cards.add(c); queue.push(c);
   }
   pump();
   if (!frame) frame = requestAnimationFrame(tick);
  },
  // After a resize the framing is worked out again.
  refit() { for (const c of cards) { c.cam = null; if (c.drawn) queue.push(c); } pump(); },
 };
}
