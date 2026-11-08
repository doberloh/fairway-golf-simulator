// EVERY MODEL A LANDSCAPE DRAWS, ONE PICTURE EACH (the US golf courses status
// page, 8 November 2026; the owner: "add a picture of every model from each
// landscape into its tab. This would include grass, bushes, flowers, textures
// ... I want to keep this page up to date as things change").
//
//   node tools/capture/build-hooked.mjs                         the capture build
//   node tools/capture/landscape-models.mjs [biome ...] [--label r1] [--season summer] [--size 900]
//
// Each landscape's nine holes on seed FAIRWAY, drawn by the game itself on
// Ultra in the afternoon light:
//   - its ground: a look down at each surface and ground type the course has
//     (fairway, rough, green, bunker, rock, pine straw ...), as it lies;
//   - its rocks and buildings, where the generator put them;
//   - then every plant it planted -- trees, bushes, flowers, grasses -- each
//     species with EVERY model it is drawn from: the course's own trees are
//     taken away and one of each stands alone on the holes' fairways, at the
//     course's median size for its species, painted as the game paints it,
//     framed from its measured box with the sun behind the camera.
// The capture build's vegetation hook (build-hooked.mjs) lets a tree name its
// model; nothing in src/ is changed.
//
// Pictures: bench/shots/landscape-models/<label>/<biome>/<nn>-<name>.jpg and
// index.json (what each picture is), git-ignored. A landscape is about a
// minute on the graphics card; one landscape a process is fine, and every
// capture holds the card lock (gpu-lock.mjs), so run it through
// tools/gpu-run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, hourFor, HIDE_HUD, hideBallAndAim} from './capture.mjs';
import {BIOME_KEYS} from '../../src/settings-schema.js';
import {TREE_NAMES} from '../../src/builder/tree-names.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const label = opt('label', 'r1'), season = opt('season', 'summer'), SIZE = Number(opt('size', 900));
const flags = new Set(['--label', '--season', '--size']);
const biomes = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1]));
for (const b of biomes) if (!BIOME_KEYS.includes(b)) throw Error(`unknown landscape "${b}"; one of ${BIOME_KEYS.join(', ')}`);
const ROOT = path.resolve('bench/shots/landscape-models', label);
const slug = s => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// Everything the course has, read in the page: every species planted (its
// models, how many, its median plant), every surface with a spot well inside
// it, the rocks and the buildings.
const SURVEY = () => {
 const v = window.__view, w = v.world, P = window.__plants;
 const byKind = new Map();
 for (const t of w.trees) { if (!byKind.has(t.kind)) byKind.set(t.kind, []); byKind.get(t.kind).push(t); }
 const kinds = [...byKind].map(([kind, list]) => {
  const sorted = [...list].sort((a, b) => a.h - b.h), mid = sorted[Math.floor(sorted.length / 2)];
  const family = P.FAMILY_OF[kind];
  return {kind, count: list.length, family: family || null, models: family ? P.familyModels(family) : [], ground: P.GROUND_PLANTS.has(kind), median: {...mid}};
 }).sort((a, b) => (a.ground - b.ground) || b.median.h - a.median.h);
 // A spot well inside each surface: the same surface 5 m out every way, on
 // the gentlest ground, nearest the middle of the course.
 const spots = {};
 const step = 6, r = 5;
 for (let x = -w.halfX + 10; x < w.halfX - 10; x += step) for (let z = -w.halfZ + 10; z < w.halfZ - 10; z += step) {
  const s = w.surface(x, z);
  if ([[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]].some(([dx, dz]) => w.surface(x + dx, z + dz) !== s)) continue;
  const slope = Math.abs(w.height(x + 2, z) - w.height(x - 2, z)) + Math.abs(w.height(x, z + 2) - w.height(x, z - 2));
  const score = slope * 40 + Math.hypot(x, z) / 100;
  if (!spots[s] || score < spots[s].score) spots[s] = {x, z, y: w.height(x, z), score};
 }
 return {kinds, spots, rocks: (w.rocks || []).length, rock: [...(w.rocks || [])].sort((a, b) => b.sx * b.sy * b.sz - a.sx * a.sy * a.sz)[0] || null,
  buildings: [...(w.buildings || [])].map(b => ({kind: b.kind, model: b.model, x: b.x, z: b.z, y: b.y, width: b.width, depth: b.depth, height: b.height}))};
};

// Aim the camera at a box [min, max] from the sun's side (or `from`, a yaw),
// framed so the whole box fits with a margin.
const FRAME = ([box, opts]) => {
 const v = window.__view, w = v.world;
 const [x0, y0, z0, x1, y1, z1] = box;
 const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
 const half = Math.max((y1 - y0) / 2, (x1 - x0) / 2, (z1 - z0) / 2, opts.least || .6);
 const t = Math.tan(v.camera.fov * Math.PI / 360);
 const d = half * (opts.margin || 1.25) / t + Math.max(x1 - x0, z1 - z0) / 2;
 const sun = v.sunDir, yaw0 = opts.from ?? Math.atan2(sun.x, sun.z);
 // The sun behind the camera: the camera stands toward the sun from the
 // thing and looks back at it. Raised where the ground would hide it.
 let best = null;
 for (const turn of [0, .5, -.5, 1, -1, 1.6, -1.6]) {
  const a = yaw0 + turn, ex = cx + Math.sin(a) * d, ez = cz + Math.cos(a) * d;
  const g = w.height(ex, ez), ey = Math.max(cy + (opts.lift || 0) * d, g + 1.2);
  if (!best || ey - cy < best.ey - best.cy) best = {ex, ez, ey, cy};
  if (ey - cy < d * .25) break;
 }
 const {ex, ez, ey} = best;
 const yaw = Math.atan2(cx - ex, cz - ez), pitch = Math.atan2(cy - ey, Math.hypot(cx - ex, cz - ez));
 v.placeCamera({x: ex, y: ey, z: ez}, yaw, pitch);
 return {d: +d.toFixed(1), eye: [ex, ey, ez].map(n => +n.toFixed(1))};
};

// The course's trees taken away and one of each species and model stood on
// the fairways, spaced so no other is in its picture. Returns each one's
// drawn box, measured from the instances the game made.
const LINEUP = async specimens => {
 const v = window.__view, w = v.world;
 const sites = [];
 const room = (h, s) => sites.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 2.6 * (h + o.h) + 12);
 const placed = [];
 for (const sp of specimens) {
  const h = Math.max(sp.median.h, 1.5);
  let at = null;
  for (const want of ['fairway', 'rough', 'semi', null]) {
   for (const hole of w.holes) {
    const tee = hole.worldTee, pin = hole.worldPin, len = Math.hypot(pin.x - tee.x, pin.z - tee.z);
    for (let a = 30; a < len - 20 && !at; a += 6) for (const across of [0, 18, -18, 36, -36]) {
     const p = hole.toWorld({x: across, z: a});
     const s = w.surface(p.x, p.z);
     if (s === 'water' || s === 'green' || s === 'sand' || s === 'tee' || (want && s !== want)) continue;
     if (room(h, p)) { at = p; break; }
    }
    if (at) break;
   }
   if (at) break;
  }
  if (!at) { placed.push(null); continue; }
  sites.push({x: at.x, z: at.z, h});
  const t = {...sp.median, x: at.x, z: at.z, y: w.height(at.x, at.z), model: sp.model || undefined, under: false};
  placed.push(t);
 }
 w.trees = placed.filter(Boolean);
 v.build(w, v.style, 0);
 // A plant the camera stands close to is cleared away in play (vegetation.js
 // clearCameraTrees); a portrait stands close on purpose, so every specimen
 // stays drawn.
 v.clearCameraTrees = () => {
  for (const batch of v.treeInstances) {
   let changed = false;
   batch.hidden.forEach((h, i) => { if (h) { batch.hidden[i] = 0; if (!v.cull?.has(batch.mesh)) batch.mesh.setMatrixAt(i, batch.matrices[i]); changed = true; } });
   if (changed) { if (v.cull?.has(batch.mesh)) v.cull.dirty(); else batch.mesh.instanceMatrix.needsUpdate = true; }
  }
 };
 await new Promise(r => setTimeout(r, 3000));
 const boxes = placed.map(() => null);
 for (const batch of v.treeInstances) {
  const g = batch.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  batch.owners.forEach((o, i) => {
   const n = placed.indexOf(o); if (n < 0) return;
   const e = batch.matrices[i].elements;
   for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
    const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12], Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13], Z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
    const b = boxes[n] || (boxes[n] = [X, Y, Z, X, Y, Z]);
    b[0] = Math.min(b[0], X); b[1] = Math.min(b[1], Y); b[2] = Math.min(b[2], Z); b[3] = Math.max(b[3], X); b[4] = Math.max(b[4], Y); b[5] = Math.max(b[5], Z);
   }
  });
 }
 // A procedural species has no instances to measure: its plant's own size.
 return placed.map((t, n) => t && (boxes[n] || [t.x - t.r, t.y, t.z - t.r, t.x + t.r, t.y + t.h, t.z + t.r]));
};

async function shoot(p, file, frame, args) {
 const r = await p.evaluate(frame, args);
 await hideBallAndAim(p);
 // Near grass is built a tile a frame, the far shadows every fourth frame.
 await p.waitForTimeout(2200);
 await p.screenshot({path: file, type: 'jpeg', quality: 86});
 return r;
}

// A plant's name: the builder's name for the species, else its model's name
// spelled out (Blender_SoapweedYucca_1: Soapweed yucca); a number when the
// species has more than one model.
const plantName = sp => {
 const own = TREE_NAMES[sp.kind]?.replace(/ [(].*[)]$/, '');
 const fromModel = sp.model && sp.model.replace(/^[A-Za-z]+_/, '').replace(/_[0-9]+$/, '').replace(/^(Bd|Pr|Mt|Dt|Dr|Hi|Fl|Low|Sl|Cc|Nw|Nor|South|Park)(?=[A-Z])/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
 const name = own || (fromModel ? fromModel[0] + fromModel.slice(1).toLowerCase() : sp.kind);
 return sp.models > 1 ? `${name} ${sp.model.match(/_([0-9]+)$/)?.[1] ?? ''}`.trim() : name;
};
const NAMES = {fairway: 'Fairway', rough: 'Rough', semi: 'First cut', green: 'Green', fringe: 'Fringe', tee: 'Tee', sand: 'Bunker sand', water: 'Water'};
async function take(biome) {
 const dir = path.join(ROOT, biome);
 fs.rmSync(dir, {recursive: true, force: true});
 fs.mkdirSync(dir, {recursive: true});
 const b = await launch();
 const index = {biome, season, seed: 'FAIRWAY', holes: 9, taken: new Date().toISOString(), pictures: []};
 try {
  const p = await openGame(b, {width: SIZE, height: SIZE, density: 1, quality: 'ultra'});
  await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed: 'FAIRWAY', season});
  await p.addStyleTag({content: HIDE_HUD});
  await p.evaluate(at => { const v = window.__view; v.daylight.hour = at; v.daylight.rate = 0; v.setFloodlights?.(false); }, hourFor(biome, 'afternoon'));
  await p.waitForTimeout(3000);
  const survey = await p.evaluate(SURVEY);
  let n = 0;
  const add = (name, title, group, extra = {}) => { const file = `${String(++n).padStart(2, '0')}-${slug(name)}.jpg`; Object.assign(extra, {file, title, group}); index.pictures.push(extra); return path.join(dir, file); };
  // Every species, every model, standing alone.
  const specimens = survey.kinds.flatMap(k => (k.models.length ? k.models : [null]).map(model => ({kind: k.kind, model, median: k.median, ground: k.ground, count: k.count, family: k.family, models: k.models.length})));
  const boxes = await p.evaluate(LINEUP, specimens);
  for (const [i, sp] of specimens.entries()) {
   const box = boxes[i];
   if (!box) { console.log(`${biome}: no room for ${sp.kind} ${sp.model || ''}`); continue; }
   const entry = {kind: sp.kind, model: sp.model, family: sp.family, of: sp.models, planted: sp.count, height: +(box[4] - box[1]).toFixed(1), box: box.map(q => +q.toFixed(1))};
   entry.camera = await shoot(p, add(`${sp.kind}-${sp.model || 'drawn'}`, plantName(sp), sp.ground ? 'plant' : 'tree', entry), FRAME, [box, {least: sp.ground ? .3 : 1.5, lift: sp.ground ? .5 : .08}]);
  }
  // The ground, rocks and buildings, once the course's own trees are gone (their shade hid them in a wood): a look down at each surface.
  const { surfaceLabel } = await import('../../src/grounds.js');
  for (const [s, at] of Object.entries(survey.spots)) {
   if (s === 'ob' || s === 'road' || s === 'path') continue;
   // Looked down on from about 7 m, half a dozen metres of it across.
   await shoot(p, add(`ground-${s}`, NAMES[s] || surfaceLabel(s), 'ground', {surface: s}), FRAME, [[at.x - 3, at.y, at.z - 3, at.x + 3, at.y, at.z + 3], {least: 3, lift: 1}]);
  }
  // The long grass at eye height, where the rough is.
  if (survey.spots.rough) {
   const at = survey.spots.rough;
   await shoot(p, add('long-grass', 'Long grass in the rough', 'ground', {surface: 'rough'}), FRAME, [[at.x - 1, at.y, at.z - 1, at.x + 1, at.y + 1.2, at.z + 1], {least: 1.6, lift: .15}]);
  }
  if (survey.rock) {
   const r = survey.rock, s = Math.max(r.sx, r.sz, r.sy) * 1.2;
   await shoot(p, add('rock', 'Rock', 'rock'), FRAME, [[r.x - s, r.y, r.z - s, r.x + s, r.top ?? r.y + r.sy, r.z + s], {lift: .25}]);
  }
  for (const bd of survey.buildings) {
   const s = Math.max(bd.width || 8, bd.depth || 8) / 2;
   await shoot(p, add(`building-${bd.kind}`, bd.kind[0].toUpperCase() + bd.kind.slice(1), 'building', {model: bd.model}), FRAME, [[bd.x - s, bd.y, bd.z - s, bd.x + s, bd.y + (bd.height || 6), bd.z + s], {lift: .15}]);
  }
  if (p.errors.length) { index.errors = p.errors.slice(0, 5); console.log(`${biome}: page errors: ${p.errors.slice(0, 3).join(' | ')}`); }
  await p.context().close();
 } finally { await b.close(); }
 fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
 console.log(`${biome}: ${index.pictures.length} pictures in ${dir}`);
}

for (const biome of biomes.length ? biomes : BIOME_KEYS) await take(biome);
