// A CONTACT SHEET: every model at once, each in its own cell of one canvas.
//
// The single-model previewer is right for judging one thing and useless for
// judging a hundred and fifty. Reviewing a whole generated catalogue means
// seeing it laid out, the way you would spread photographs on a table --
// which is also the only way to notice that six models are subtly the same
// model, or that one species reads as another.
//
// One renderer, one scene, scissor-and-viewport per cell. Nothing here ships.
import * as T from 'three';
import {MODELS, TEXTURES} from './assets-data.js';

const ROLE_COLOUR = {bark: '#6d4f3a', leaf: '#3f6b40', stone: '#79807a', dirt: '#6f7a4e', accent: '#a89a73'};
const loader = new T.TextureLoader();
const TEX = TEXTURES.map(src => { const m = loader.load(src); m.colorSpace = T.SRGBColorSpace; return m; });

const canvas = document.getElementById('grid');
const renderer = new T.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
// PIXEL RATIO PINNED TO 1. The cells are placed by hand with setViewport and
// setScissor, in device pixels, and any mismatch between what three thinks the
// buffer is and what the canvas element is styled at silently stretches every
// cell across its neighbours -- which is what the first sheet did.
renderer.setPixelRatio(1);
renderer.setScissorTest(true);

const scene = new T.Scene();
scene.add(new T.HemisphereLight('#bcd2e8', '#33301f', 1.25));
const key = new T.DirectionalLight('#ffeccd', 1.9); key.position.set(40, 70, 30); scene.add(key);
const fill = new T.DirectionalLight('#9fb4c8', .55); fill.position.set(-35, 18, -45); scene.add(fill);
const camera = new T.PerspectiveCamera(34, 1, .01, 200);

// A 1.8 m figure in every cell, so scale is never in doubt.
const human = new T.Mesh(new T.CapsuleGeometry(.23, 1.34, 4, 8),
 new T.MeshStandardMaterial({color: '#b8563a', roughness: 1}));
const ground = new T.Mesh(new T.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
 new T.MeshStandardMaterial({color: '#20241b', roughness: 1}));

const decode = (b64, Type) => {
 const raw = atob(b64), bytes = new Uint8Array(raw.length);
 for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
 return new Type(bytes.buffer);
};

// Built once and kept: a hundred and fifty of these is a few hundred meshes,
// which is nothing, and rebuilding per frame would not be.
const built = new Map();
function modelGroup(m) {
 if (built.has(m.name)) return built.get(m.name);
 const g = new T.Group();
 for (const part of m.parts) {
  const q = decode(part.p, Int16Array), position = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) position[i] = q[i] / 16384;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(position, 3));
  geo.setIndex(new T.BufferAttribute(decode(part.i, Uint16Array), 1));
  if (part.n) {
   const p = decode(part.n, Int8Array), n = new Float32Array(p.length);
   for (let i = 0; i < p.length; i++) n[i] = p[i] / 127;
   geo.setAttribute('normal', new T.BufferAttribute(n, 3));
  } else geo.computeVertexNormals();
  const stated = part.kd && new T.Color(part.kd[0], part.kd[1], part.kd[2]);
  const s = {color: stated || ROLE_COLOUR[part.role] || '#999', roughness: 1,
   side: part.two ? T.FrontSide : T.DoubleSide};
  if (part.uv !== undefined) {
   const uv = decode(part.uv, Uint16Array), f = new Float32Array(uv.length);
   const span = part.uvSpan || 1;
   for (let i = 0; i < uv.length; i++) f[i] = uv[i] / 65535 * span;
   geo.setAttribute('uv', new T.BufferAttribute(f, 2));
   s.map = TEX[part.tex]; s.alphaTest = .4; s.color = stated || new T.Color('#ffffff');
  }
  g.add(new T.Mesh(geo, new T.MeshStandardMaterial(s)));
 }
 built.set(m.name, g);
 return g;
}

// Height in metres per model, so a fern is not drawn the size of a redwood.
// Read off the name, which is the only thing that knows what the model is.
function metres(name) {
 if (/Giant/.test(name)) return 95;
 if (/Redwood_Mature/.test(name)) return 62;
 if (/Redwood_Young/.test(name)) return 26;
 if (/Sapling|Seedling/.test(name)) return 3.5;
 if (/Leaner|Burled/.test(name)) return 70;
 if (/DouglasFir/.test(name)) return 55;
 if (/Hemlock/.test(name)) return 40;
 if (/RedCedar/.test(name)) return 45;
 if (/Tanoak/.test(name)) return 16;
 if (/VineMaple/.test(name)) return 9;
 if (/Snag/.test(name)) return 34;
 if (/Stump/.test(name)) return 2.6;
 if (/NurseLog|FallenLog/.test(name)) return 1.5;
 if (/RootWad/.test(name)) return 3.2;
 if (/SwordFern_Young/.test(name)) return .8;
 if (/SwordFern/.test(name)) return 1.15;
 if (/Salal|Huckleberry/.test(name)) return 1.1;
 if (/Sorrel/.test(name)) return .22;
 if (/MossMound/.test(name)) return .5;
 if (/Boulder/.test(name)) return .9;
 if (/Litter/.test(name)) return .18;
 return 10;
}

let shown = [];
function layout() {
 const f = document.getElementById('q').value.trim().toLowerCase();
 shown = MODELS.filter(m => !f || m.name.toLowerCase().includes(f) || m.pack.toLowerCase().includes(f));
 document.getElementById('count').textContent = `${shown.length} of ${MODELS.length}`;
 const cols = Math.max(2, +document.getElementById('cols').value || 4);
 const cell = Math.max(90, +document.getElementById('cell').value || 230);
 const rows = Math.ceil(shown.length / cols);
 canvas.style.width = cols * cell + 'px';
 canvas.style.height = rows * cell + 'px';
 renderer.setSize(cols * cell, rows * cell, false);
 // Names, as an overlay: a sheet of unlabelled thumbnails tells you a
 // catalogue exists and nothing about which model is which.
 const tags = document.getElementById('tags');
 tags.style.width = cols * cell + 'px';
 tags.replaceChildren();
 shown.forEach((m, i) => {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;left:${(i % cols) * cell}px;top:${Math.floor(i / cols) * cell + cell - 15}px;`
   + `width:${cell}px;text-align:center;font-size:10px;color:#9aa08f;pointer-events:none`;
  d.textContent = `${m.name}  ${metres(m.name)}m`;
  tags.appendChild(d);
 });
 camera.aspect = 1;
 camera.updateProjectionMatrix();
 draw(cols, cell, rows);
}

let spin = 0;
function draw(cols, cell, rows) {
 const dpr = renderer.getPixelRatio();
 const H = rows * cell;
 renderer.setClearColor('#12140f', 1);
 // Scissor test is on, and clear() honours it -- so clearing without first
 // opening the scissor to the whole canvas leaves the previous layout's
 // thumbnails sitting in every cell the new one does not reach.
 renderer.setScissor(0, 0, cols * cell * dpr, H * dpr);
 renderer.clear();
 for (let i = 0; i < shown.length; i++) {
  const m = shown[i];
  const cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
  // three's viewport origin is bottom-left; the grid runs top-down.
  const vx = cx * dpr, vy = (H - cy - cell) * dpr, vs = cell * dpr;
  renderer.setViewport(vx, vy, vs, vs);
  renderer.setScissor(vx, vy, vs, vs);

  const h = metres(m.name);
  const g = modelGroup(m);
  g.scale.setScalar(h);
  g.rotation.y = spin;
  scene.add(g);
  human.position.set(m.radius * h + Math.max(.6, h * .06), .9, 0);
  human.visible = h > 1.2;
  ground.scale.setScalar(Math.max(m.radius * h * 1.15, h * .09, .5));
  scene.add(human); scene.add(ground);

  const reach = Math.max(h, m.radius * h * 2) * 1.04;
  const d = reach / Math.tan(camera.fov * Math.PI / 360) * .55;
  camera.position.set(Math.sin(.7) * d, h * .55, Math.cos(.7) * d);
  camera.lookAt(0, h * .46, 0);
  renderer.render(scene, camera);
  scene.remove(g);
 }
}

for (const id of ['q', 'cols', 'cell']) document.getElementById(id).oninput = layout;
addEventListener('keydown', e => { if (e.key === 'r') { spin += .6; layout(); } });
layout();
window.__sheet = {layout, get shown() { return shown.map(s => s.name); }};
