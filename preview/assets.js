// The asset contact sheet. See tools/asset-preview.mjs for why this exists and
// how to regenerate its data.
//
// Nothing here ships with the game. It is a local tool for answering "which of
// these 729 models do we actually want", which has already been answered wrong
// twice by reading file names.
import * as T from 'three';
import {MODELS, TEXTURES} from './assets-data.js';

// The role colours the game paints these with, so a model reads here roughly as
// it will on a course rather than in whatever colours its author chose.
const ROLE_COLOUR = {bark: '#6d4f3a', leaf: '#3f6b40', stone: '#79807a', dirt: '#6f7a4e', accent: '#a89a73'};

// Loaded once and shared. A sprite sheet is an alpha mask here, not colour:
// the tint still comes from the role, so a textured leaf reads the same as an
// untextured one but with its shape cut out.
const loader = new T.TextureLoader();
const TEX = TEXTURES.map(src => {
 const map = loader.load(src);
 map.colorSpace = T.SRGBColorSpace;
 return map;
});

// The shortest tail of a pack's directory name that no other pack contains.
// `stylized-nature` looks like a fine hint for the Ultimate Stylized pack right
// up until you notice it is also inside `stylized-nature-megakit`, and the
// ingest would reject it as ambiguous -- which is the rejection working, but
// the tool should hand you a name that is right first time.
const PACKS = [...new Set(MODELS.map(m => m.pack))];
const HINT = {};
for (const pack of PACKS) {
 const parts = pack.split('-');
 let hint = pack;
 for (let take = 1; take <= parts.length; take++) {
  const tail = parts.slice(-take).join('-');
  if (PACKS.filter(p => p.includes(tail)).length === 1) { hint = tail; break; }
 }
 HINT[pack] = hint;
}

const $ = id => document.getElementById(id);
const canvas = $('view');
const renderer = new T.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new T.Scene();
scene.background = new T.Color('#15171a');
scene.add(new T.HemisphereLight('#cfe3ff', '#3a3326', 1.7));
const key = new T.DirectionalLight('#fff3dd', 2.0);
key.position.set(40, 70, 30);
scene.add(key);
const camera = new T.PerspectiveCamera(42, 1, .1, 6000);

// A 1.8 m figure and a one-metre grid. "Is this the right model" is almost
// always a question about scale, and a model floating in the void answers it
// for nobody.
const human = new T.Mesh(new T.CapsuleGeometry(.23, 1.34, 4, 10),
 new T.MeshStandardMaterial({color: '#c9643f', roughness: 1}));
scene.add(human);
const grid = new T.GridHelper(120, 120, '#33463a', '#232729');
scene.add(grid);

let current = null, spin = true, yaw = .8, pitch = .26, dist = 70, look = 15;

const decode = (b64, Type) => {
 const raw = atob(b64), bytes = new Uint8Array(raw.length);
 for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
 return new Type(bytes.buffer);
};

// How many times the silhouette reverses direction on its way up. One mass
// turns over once; a tiered "wedding cake" conifer turns over at every plate,
// and at redwood scale that draws as separate green discs with daylight
// between them. This is the number that would have caught the MegaKit pines
// before they were built, shipped and taken out again.
function reversals(profile) {
 let n = 0;
 for (let i = 1; i < profile.length - 1; i++) {
  const a = profile[i - 1], b = profile[i], c = profile[i + 1];
  if ((b > a + 1 && b > c + 1) || (b < a - 1 && b < c - 1)) n++;
 }
 return n;
}

function show(model) {
 if (current) {
  scene.remove(current);
  current.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
 }
 current = new T.Group();
 const h = Math.max(1, Number($('h').value) || 30);
 for (const part of model.parts) {
  const quantised = decode(part.p, Int16Array);
  const position = new Float32Array(quantised.length);
  for (let i = 0; i < quantised.length; i++) position[i] = quantised[i] / 16384 * h;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3));
  geometry.setIndex(new T.BufferAttribute(decode(part.i, Uint16Array), 1));
  geometry.computeVertexNormals();
  const settings = {color: ROLE_COLOUR[part.role] || '#9a9a9a', roughness: 1, side: T.DoubleSide};
  if (part.uv !== undefined) {
   const uv = decode(part.uv, Uint16Array), f = new Float32Array(uv.length);
   for (let i = 0; i < uv.length; i++) f[i] = uv[i] / 65535;
   geometry.setAttribute('uv', new T.BufferAttribute(f, 2));
   settings.map = TEX[part.tex];
   settings.alphaTest = .4;
   // WHITE, not the role colour. three multiplies map by colour, and a green
   // sheet through a green tint comes out near-black -- and the point of
   // looking at a sprite sheet is to see the sheet. How the game tints these
   // is a separate decision from how they are judged here.
   settings.color = '#ffffff';
  }
  current.add(new T.Mesh(geometry, new T.MeshStandardMaterial(settings)));
 }
 scene.add(current);

 human.position.set(model.radius * h + 2.4, .9, 0);
 grid.scale.setScalar(Math.max(.25, h / 30));
 look = h * .45;
 dist = h * 2.4;

 $('title').textContent = model.name;
 $('sub').textContent = `${model.pack}  ·  ${model.verts.toLocaleString()} verts  ·  `
  + `${model.parts.map(p => p.role + (p.uv !== undefined ? ' (textured)' : '')).join(' + ')}`
  + `  ·  ${(model.radius * h * 2).toFixed(1)} m wide at ${h} m tall`;
 $('pickline').textContent = HINT[model.pack] + ':' + model.name;

 const bars = $('bars');
 bars.replaceChildren();
 for (const b of model.profile) {
  const bar = document.createElement('i');
  bar.style.height = Math.max(2, b / 15 * 70) + 'px';
  bars.appendChild(bar);
 }
 const n = reversals(model.profile), verdict = $('verdict');
 verdict.textContent = n >= 4 ? `tiered — ${n} reversals, a stack of plates`
  : n >= 2 ? `lumpy — ${n} reversals` : 'one mass';
 verdict.className = n >= 4 ? 'warn' : '';
}

const list = $('list');
function build(filter) {
 list.replaceChildren();
 const f = filter.trim().toLowerCase();
 let pack = null, shown = 0;
 for (const model of MODELS) {
  if (f && !model.name.toLowerCase().includes(f) && !model.pack.toLowerCase().includes(f)) continue;
  if (model.pack !== pack) {
   pack = model.pack;
   const heading = document.createElement('div');
   heading.className = 'packname';
   heading.textContent = pack;
   list.appendChild(heading);
  }
  const row = document.createElement('div');
  row.className = 'row';
  const name = document.createElement('div');
  name.textContent = model.name;
  const meta = document.createElement('span');
  const n = reversals(model.profile);
  meta.textContent = model.verts.toLocaleString();
  if (n >= 4) { const flag = document.createElement('em'); flag.textContent = ' tiered'; meta.appendChild(flag); }
  row.append(name, meta);
  row.onclick = () => {
   for (const on of list.querySelectorAll('.row.on')) on.classList.remove('on');
   row.classList.add('on');
   show(model);
  };
  list.appendChild(row);
  shown++;
 }
 $('count').textContent = `${shown} of ${MODELS.length} models`;
 list.querySelector('.row')?.click();
}

$('q').oninput = event => build(event.target.value);
$('h').oninput = () => list.querySelector('.row.on')?.click();
$('spin').onclick = event => { spin = !spin; event.target.textContent = 'spin: ' + (spin ? 'on' : 'off'); };
$('copy').onclick = () => navigator.clipboard?.writeText($('pickline').textContent);

let drag = null;
canvas.onpointerdown = event => { drag = {x: event.clientX, y: event.clientY}; canvas.setPointerCapture(event.pointerId); };
canvas.onpointerup = () => { drag = null; };
canvas.onpointermove = event => {
 if (!drag) return;
 yaw -= (event.clientX - drag.x) * .008;
 pitch = Math.max(-.35, Math.min(1.3, pitch + (event.clientY - drag.y) * .005));
 drag = {x: event.clientX, y: event.clientY};
};
canvas.onwheel = event => { event.preventDefault(); dist = Math.max(2, dist * (1 + Math.sign(event.deltaY) * .12)); };

function frame() {
 const w = canvas.clientWidth, h = canvas.clientHeight, ratio = renderer.getPixelRatio();
 if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
 }
 if (spin && !drag) yaw += .0035;
 camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, look + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
 camera.lookAt(0, look, 0);
 renderer.render(scene, camera);
 requestAnimationFrame(frame);
}

build('');
frame();
