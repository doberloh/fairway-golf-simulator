// THE EDITOR'S MODEL (the course builder, stages 3-5; docs/COURSE_BUILDER.md,
// *The editor*). A built document being edited: its land, its surfaces, its
// holes, water and trees, with undo. Pure -- no DOM, no three -- so every tool
// is tested in Node (tests/builder-editing.test.mjs); the view (view.js) only
// draws what this holds and turns the mouse into these calls.
//
// THE SURFACES ARE A GRID WHILE THEY ARE EDITED. A document stores outlines
// (course-doc.js), and outlines are what the game wants; but a brush that
// paints fairway across three bunkers and a pond is a polygon boolean every
// frame. So the editor rasterises the outlines once into a grid of codes, one
// surface a cell (half a metre, coarser only past 4096 cells a side), lets the
// tools paint and fill that grid, and traces it back into outlines when the
// course is saved (contour.js). Untouched, a document saves its own outlines
// unchanged; once any surface is painted, every surface is traced from the
// grid (a cell has one surface, where the stored outlines overlap and the
// field's order decides -- a semi-rough corridor under its fairway), so what
// is saved is what the editor showed.
//
// THE LAND is the document's own grid and patches, changed in place; every
// brush is a weight that falls off smoothly to nothing at its edge.
import {GROUND_KINDS} from '../grounds.js';
import {normaliseSurround} from '../surround-sides.js';
import {createLayers, LAYER_ORDER, tidyMask} from './layers.js';
import {facingFrom, turnedCells, POCK, SPECK} from './trace-edit.js';
import {layerRings} from './real-course.js';
import {GRID_MARGIN, landSampler, polygonDistance} from '../built-world.js';
import {TREE_STRIDE, TREE_ROLES, CREEK_FIELDS} from '../course-doc.js';
import {clearTrees} from './tree-clear.js';
import {skinFromHeights, SKIN} from './skin.js';
import {digBed, levelFrom, shoreOf, BED, digBowl, creekStations, creekBox, carveCreek} from './water-bed.js';
import {scatterCover, coverAt, refusedBy, treeSized, TREE_REFUSED} from './cover.js';
import {TREE_HAND} from '../built-world.js';
import {smoothCells, extrapolateCells, zoneTrees, zoneHomes} from './layer-ops.js';

// The codes a surface cell can hold, in the order the field paints them
// lowest first: a later one wins where a document's outlines overlap.
export const PAINT = ['rough', ...GROUND_KINDS.filter(k => k !== 'path'), 'semi', 'fairway', 'path', 'tee', 'green', 'sand', 'water'];
export const CODE = Object.fromEntries(PAINT.map((k, i) => [k, i]));
export const RASTER = {cell: .5, maxSide: 4096};
// A brush's weight at a share `t` of its radius: 1 at the centre, 0 at the edge.
export const falloff = t => t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
// How many points round a Fill to surrounding brush's edge it reads (PLACED).
const FILL_RIM = 48;
const TREE_ROLE_SHRUB = TREE_ROLES.indexOf('shrub');

function rasterSize(ex, ez) {
 const cell = Math.max(RASTER.cell, 2 * Math.max(ex, ez) / RASTER.maxSide);
 return {cell, nx: Math.ceil(2 * ex / cell), nz: Math.ceil(2 * ez / cell), x0: -ex, z0: -ez};
}
// Every cell centre inside `poly` (rings, even-odd), by scanline, onto a
// layer's mask (`v` 1 to cover, 0 to take off).
function fill(r, poly, mask, v = 1) {
 let zmin = Infinity, zmax = -Infinity;
 for (const ring of poly) for (const [, z] of ring) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
 const j0 = Math.max(0, Math.ceil((zmin - r.z0) / r.cell - .5)), j1 = Math.min(r.nz - 1, Math.floor((zmax - r.z0) / r.cell - .5));
 for (let j = j0; j <= j1; j++) {
  const z = r.z0 + (j + .5) * r.cell, xs = [];
  for (const ring of poly) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
   const [ax, az] = ring[b], [bx, bz] = ring[a];
   if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax));
  }
  xs.sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k += 2) {
   const i0 = Math.max(0, Math.ceil((xs[k] - r.x0) / r.cell - .5)), i1 = Math.min(r.nx - 1, Math.floor((xs[k + 1] - r.x0) / r.cell - .5));
   mask.fill(v, j * r.nx + i0, j * r.nx + i1 + 1);
  }
 }
}

// A copy of a document an editor can change. `doc` is a validated built
// document (course-doc.js); it is not changed.
export function createEditor(doc) {
 const ex = doc.halfX + GRID_MARGIN, ez = doc.halfZ + GRID_MARGIN;
 const r = {...rasterSize(ex, ez)};
 // THE SURFACES IN LAYERS (layers.js; the owner, 1 November 2026): each its
 // own mask, the topmost shown -- in the game's order, so the course plays
 // what is shown. `r.codes` is every layer's composite (what a ball lies on),
 // `r.layers.view` the visible layers' (what the view draws).
 r.layers = createLayers(r.nx, r.nz, PAINT);
 for (const kind of LAYER_ORDER) {
  const polys = kind === 'water' ? (doc.water || []).map(w => w.rings) : doc.surfaces?.[kind] || [];
  for (const poly of polys) fill(r, poly, r.layers.mask(kind, true));
 }
 r.layers.recompose();
 r.codes = r.layers.codes;
 // Each layer as it opened, as a fingerprint: what Back to 2D carries home is
 // the layers changed since (round-trip.js).
 const printOf = m => { let h = 2166136261 >>> 0; for (let k = 0; k < m.length; k++) if (m[k]) h = Math.imul(h ^ k, 16777619) >>> 0; return h; };
 const opened = new Map([...r.layers.masks].map(([k, m]) => [k, printOf(m)]));
 const copyGrid = g => ({...g, heights: Float32Array.from(g.heights)});
 const land = copyGrid(doc.land), patches = (doc.patches || []).map(copyGrid);
 const original = {land: Float32Array.from(doc.land.heights), patches: patches.map(p => Float32Array.from(p.heights))};
 let waterDirty = false;   // the water layer changed and its bodies have not been read again
 const state = {
  doc, raster: r, land, patches, ex, ez,
  holes: structuredClone(doc.holes), water: structuredClone(doc.water || []), creeks: structuredClone(doc.creeks || []),
  trees: Array.from({length: doc.trees.length / TREE_STRIDE}, (_, i) => Array.from(doc.trees.subarray(i * TREE_STRIDE, (i + 1) * TREE_STRIDE))),
  // Each tree's `kind` is an index here; a bush painted as ground cover adds
  // its species (cover.js). Rocks are [x, z, size, shape, turn] (course-doc.js).
  treeKinds: [...(doc.treeKinds || [])], rocks: structuredClone(doc.rocks || []),
  homes: structuredClone(doc.homes || []),
  landscape: doc.landscape, name: doc.name,
  // THE TREES' HEIGHT SCALE (the owner, 1 November 2026: "allow the user to
  // adjust the tree height scale. show in real time"): every tree's height,
  // crown width and trunk times this -- the whole tree in proportion (the
  // owner's choice over a separate width) -- as drawn and as saved (toDoc);
  // the trees keep their own sizes, so it can go back to 1. A course saved
  // at 1.2 opens at 1 with its trees 1.2 times bigger.
  treeScale: 1,
  // The trees placed for the player (tree-plan.js): no undo step, as treeScale.
  treePlan: doc.treePlan ?? null,
  // What stands past the property line on each side (surround-sides.js; the
  // surroundings rework): scenery, so no undo step, as the tree plan.
  surround: doc.surround ?? null,
  surfacesEdited: false, changed: false, undo: [], redo: [],
  // Where the land has been shaped, merged into boxes: the game refines its
  // mesh to the land there (built-world.js), so a hill plays as drawn.
  landEdits: [...(doc.landEdits || [])],
 };
 let sample = landSampler({land, patches});
 const resample = () => { sample = landSampler({land, patches}); };

 // Every grid the land is stored in (the land, then each patch) that a box
 // touches: [grid, i0, i1, j0, j1].
 const gridsIn = (x0, x1, z0, z1) => [land, ...patches].map(g => {
  const cz = g.cellZ ?? g.cell;
  const i0 = Math.max(0, Math.floor((x0 - g.x0) / g.cell)), i1 = Math.min(g.nx - 1, Math.ceil((x1 - g.x0) / g.cell));
  const j0 = Math.max(0, Math.floor((z0 - g.z0) / cz)), j1 = Math.min(g.nz - 1, Math.ceil((z1 - g.z0) / cz));
  return i0 <= i1 && j0 <= j1 ? [g, i0, i1, j0, j1] : null;
 }).filter(Boolean);
 const remember = (kind, x0, x1, z0, z1) => {
  const step = {kind, box: [x0, x1, z0, z1]};
  if (kind === 'land') step.parts = gridsIn(x0, x1, z0, z1).map(([g, i0, i1, j0, j1]) => {
   const rows = []; for (let j = j0; j <= j1; j++) rows.push(g.heights.slice(j * g.nx + i0, j * g.nx + i1 + 1));
   return {g, i0, i1, j0, j1, rows};
  });
  else if (kind === 'paint') {
   const [i0, i1, j0, j1] = cellBox(x0, x1, z0, z1), layers = new Map();
   for (const [k, m] of r.layers.masks) { const rows = []; for (let j = j0; j <= j1; j++) rows.push(m.slice(j * r.nx + i0, j * r.nx + i1 + 1)); layers.set(k, rows); }
   step.cells = {i0, i1, j0, j1, layers}; step.surfacesEdited = state.surfacesEdited;
  } else step.snapshot = records();
  state.undo.push(step); state.redo.length = 0;
  if (state.undo.length > 200) state.undo.shift();
  state.changed = true;
  return step;
 };
 const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return Math.hypot(x - ax - t * dx, z - az - t * dz); };
 const records = () => structuredClone({holes: state.holes, water: state.water, creeks: state.creeks, trees: state.trees, treeKinds: state.treeKinds, rocks: state.rocks, homes: state.homes, landscape: state.landscape});
 const cellBox = (x0, x1, z0, z1) => [Math.max(0, Math.floor((x0 - r.x0) / r.cell)), Math.min(r.nx - 1, Math.ceil((x1 - r.x0) / r.cell)),
  Math.max(0, Math.floor((z0 - r.z0) / r.cell)), Math.min(r.nz - 1, Math.ceil((z1 - r.z0) / r.cell))];
 // Swaps a step's stored state with the present (undo and redo are the same act).
 const swap = step => {
  if (step.parts) { for (const p of step.parts) p.rows = p.rows.map((row, k) => { const at = (p.j0 + k) * p.g.nx + p.i0, now = p.g.heights.slice(at, at + row.length); p.g.heights.set(row, at); return now; }); resample(); }
  if (step.cells) { const c = step.cells; for (const [kind, rows] of c.layers) { const m = r.layers.mask(kind, true); c.layers.set(kind, rows.map((row, k) => { const at = (c.j0 + k) * r.nx + c.i0, now = m.slice(at, at + row.length); m.set(row, at); return now; })); } r.layers.recompose(c.i0, c.i1, c.j0, c.j1); const was = state.surfacesEdited; state.surfacesEdited = step.surfacesEdited; step.surfacesEdited = was; }
  if (step.snapshot) { const now = records(); Object.assign(state, step.snapshot); step.snapshot = now; }
  return step;
 };

 // A LAYER'S OUTLINES AS THE COURSE GETS THEM (1 November 2026: the editor's
 // 3D view given the trace step's "resolution treatment"): the cells traced,
 // simplified and their corners rounded -- real-course.js `layerRings`, the
 // same routine door 2 makes its course with -- over the layer's own box, or
 // over cells [i0, i1, j0, j1] widened by `margin` (the view redraws a
 // stroke's part). Save writes these; the view draws these.
 const outlines = (kind, box = null, margin = 0) => {
  const m = r.layers.masks.get(kind); if (!m) return [];
  let [i0, i1, j0, j1] = box ?? [Infinity, -1, Infinity, -1];
  if (!box) for (let j = 0; j < r.nz; j++) for (let i = 0; i < r.nx; i++) if (m[j * r.nx + i]) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
  if (i1 < i0) return [];
  i0 = Math.max(0, i0 - margin); i1 = Math.min(r.nx - 1, i1 + margin); j0 = Math.max(0, j0 - margin); j1 = Math.min(r.nz - 1, j1 + margin);
  const w = i1 - i0 + 1, h = j1 - j0 + 1, sub = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) sub.set(m.subarray((j + j0) * r.nx + i0, (j + j0) * r.nx + i0 + w), j * w);
  return layerRings(sub, {nx: w, nz: h, cell: r.cell, x0: r.x0 + (i0 + .5) * r.cell, z0: r.z0 + (j0 + .5) * r.cell});
 };
 const api = {
  state,
  outlines,
  // The layers changed since the editor opened: kind -> its outlines (none
  // for a layer emptied), for door 2 to take back (round-trip.js fromEditor).
  changedLayers() {
   const out = new Map();
   for (const k of new Set([...opened.keys(), ...r.layers.masks.keys()])) { const m = r.layers.masks.get(k), p = m ? printOf(m) : printOf([]); if (p !== (opened.get(k) ?? printOf([]))) out.set(k, m ? outlines(k) : []); }
   return out;
  },
  hiddenLayers: () => [...r.layers.hidden],
  height: (x, z) => sample(x, z),
  codeAt(x, z) { const i = Math.floor((x - r.x0) / r.cell), j = Math.floor((z - r.z0) / r.cell); return i < 0 || j < 0 || i >= r.nx || j >= r.nz ? 0 : r.codes[j * r.nx + i]; },
  surfaceAt(x, z) { return PAINT[api.codeAt(x, z)]; },
  // The layers: those holding anything (top first), and hiding one from view.
  layersPresent: () => r.layers.present(),
  isHidden: kind => r.layers.hidden.has(kind),
  setHidden(kind, hide) { r.layers.setHidden(kind, hide); },

  // ---- the ground. `op`: raise, lower, smooth, flatten (to `level`),
  // roughen, restore (to the land it started as), ramp (from `a` to `b`, a
  // straight grade between their heights, `radius` either side), fill (a hole
  // raised to the ground round it: below). `strength`
  // 0-1: metres a stroke for raise and lower at the centre (times 0.5),
  // the share moved toward the target for the rest. Returns the box changed.
  // `group` lets a drag be one undo: pass the same object for every dab.
  shape({op, x, z, radius = 10, strength = .5, level = null, a = null, b = null, group = null}) {
   const box = op === 'ramp' ? [Math.min(a.x, b.x) - radius, Math.max(a.x, b.x) + radius, Math.min(a.z, b.z) - radius, Math.max(a.z, b.z) + radius]
    : [x - radius, x + radius, z - radius, z + radius];
   if (!group?.step) { const st = remember('land', ...box); if (group) group.step = st; }
   else extendLand(group.step, box);
   noteEdit(box);
   const target = op === 'flatten' ? (level ?? sample(x, z)) : null;
   // FILL TO SURROUNDING (the owner, 4 November 2026: "this brush will raise
   // ground to the surrounding level smoothly"). The ground the brush's edge
   // stands on, all the way round, is the level wanted: across the disc the
   // target runs from each point of the rim in to the rim's average, so on a
   // hillside the fill follows the hill rather than lying flat. It only ever
   // raises, so a brush bigger than the hole fills the hole and leaves what
   // stands above it. It meets the edge exactly, so nothing shows where it
   // stopped. Holds no shape of its own: drag it and each dab reads the ground
   // the last one left. Weighted full over the inner three quarters (PLACED):
   // the plain brush's falloff filled a pit's middle and left its sides.
   let rim = null, rimMean = 0;
   if (op === 'fill') {
    rim = Array.from({length: FILL_RIM}, (_, k) => sample(x + Math.cos(k / FILL_RIM * Math.PI * 2) * radius, z + Math.sin(k / FILL_RIM * Math.PI * 2) * radius));
    rimMean = rim.reduce((a, v) => a + v, 0) / FILL_RIM;
   }
   for (const [g, i0, i1, j0, j1] of gridsIn(...box)) {
    const cz = g.cellZ ?? g.cell, h = g.heights, orig = g === land ? original.land : original.patches[patches.indexOf(g)];
    const old = op === 'smooth' ? Float32Array.from(h) : null;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
     const px = g.x0 + i * g.cell, pz = g.z0 + j * cz, k = j * g.nx + i;
     let w, t = null;
     if (op === 'ramp') {
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
      w = falloff(Math.hypot(px - a.x - dx * u, pz - a.z - dz * u) / radius) * strength;
      t = a.y + (b.y - a.y) * u;
     } else if (op === 'fill') {
      const d = Math.hypot(px - x, pz - z) / radius; if (d >= 1) continue;
      const u = ((Math.atan2(pz - z, px - x) / (Math.PI * 2) + 1) % 1) * FILL_RIM, n = Math.floor(u) % FILL_RIM, f = u - Math.floor(u);
      t = rimMean + (rim[n] + (rim[(n + 1) % FILL_RIM] - rim[n]) * f - rimMean) * d;
      if (t <= h[k]) continue;
      const e = Math.min(1, (1 - d) / .25); w = e * e * (3 - 2 * e) * strength;
     } else w = falloff(Math.hypot(px - x, pz - z) / radius) * strength;
     if (w <= 0) continue;
     if (op === 'raise') h[k] += w * .5;
     else if (op === 'lower') h[k] -= w * .5;
     else if (op === 'flatten') h[k] += (target - h[k]) * w;
     else if (op === 'ramp' || op === 'fill') h[k] += (t - h[k]) * w;
     else if (op === 'restore') h[k] += (orig[k] - h[k]) * w;
     else if (op === 'roughen') h[k] += Math.sin(px * 1.7 + pz * .3) * Math.cos(pz * 1.3 - px * .5) * .25 * w;
     else if (op === 'smooth' && i > 0 && j > 0 && i < g.nx - 1 && j < g.nz - 1) h[k] += ((old[k - 1] + old[k + 1] + old[k - g.nx] + old[k + g.nx]) / 4 - old[k]) * w;
    }
   }
   resample();
   return box;
  },

  // ---- the surfaces. Paint a disc of `kind`; fill an outline with it.
  // A disc onto `kind`'s layer; 'rough' takes every layer off there, and
  // `erase` takes one layer (or, with no kind, every one) off.
  paint({kind, x, z, radius = 3, group = null}) {
   if (CODE[kind] === undefined) throw Error(`No surface called ${kind}.`);
   return brush(kind === 'rough' ? null : kind, kind === 'rough' ? 0 : 1, x, z, radius, group);
  },
  erase({kind = null, x, z, radius = 3, group = null}) { return brush(kind, 0, x, z, radius, group); },
  fillOutline({kind, ring}) {
   const code = CODE[kind]; if (code === undefined || ring.length < 3) throw Error('An outline needs a surface and three points.');
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), box = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
   if (kind !== 'rough') r.layers.mask(kind, true);
   remember('paint', ...box); state.surfacesEdited = true;
   if (kind === 'rough') for (const m of r.layers.masks.values()) fill(r, [ring], m, 0); else fill(r, [ring], r.layers.mask(kind));
   if (kind === 'water' || kind === 'rough') waterDirty = true;
   recomposeBox(box);
   return box;
  },
  // THE LAYERS' CLEAN-UP, as door 2's (layer-ops.js): each one undo, a drag
  // with `group`. Smoothing with no `x` is the whole course; no `kind`, every
  // layer. `radius` the neighbourhood, `area` the brush's reach. Returns the box.
  smoothEdges({radius = 1.5, x = null, z = null, area = null, kind = null, group = null} = {}) {
   const reach = area ?? radius * 4, box = x == null ? [r.x0, -r.x0, r.z0, -r.z0] : [x - reach, x + reach, z - reach, z + reach], [i0, i1, j0, j1] = cellBox(...box);
   if (!group?.step) { const st = remember('paint', ...box); if (group) group.step = st; } else extendPaint(group.step, box);
   state.surfacesEdited = true;
   const n = Math.max(1, Math.round(radius / r.cell));
   for (const k of kind ? [kind] : [...r.layers.masks.keys()]) {
    const m = r.layers.masks.get(k); if (!m) continue;
    smoothCells(m, r, n, {i0, i1, j0, j1}, (i, j) => x == null || Math.hypot(r.x0 + (i + .5) * r.cell - x, r.z0 + (j + .5) * r.cell - z) <= reach, (c, v) => { m[c] = v; if (k === 'water') waterDirty = true; });
   }
   r.layers.recompose(i0, i1, j0, j1);
   return box;
  },
  tidy({minArea = SPECK, kind = null} = {}) {
   const box = [r.x0, -r.x0, r.z0, -r.z0];
   remember('paint', ...box); state.surfacesEdited = true;
   for (const k of kind ? [kind] : [...r.layers.masks.keys()]) { const m = r.layers.masks.get(k); if (!m) continue; tidyMask(m, r.nx, r.nz, Math.round(minArea / (r.cell * r.cell)), Math.round(POCK / (r.cell * r.cell))); if (k === 'water') waterDirty = true; }
   r.layers.recompose();
   return box;
  },
  extrapolate({from, to, width}) {
   const F = r.layers.masks.get(from); if (!F || to === from || to === 'rough' || !(width > 0)) return null;
   const T = r.layers.mask(to, true), box = [r.x0, -r.x0, r.z0, -r.z0];
   remember('paint', ...box); state.surfacesEdited = true;
   extrapolateCells(F, r, width, LAYER_ORDER.indexOf(to) > LAYER_ORDER.indexOf(from), (k, v) => { T[k] = v; });
   if (to === 'water') waterDirty = true;
   r.layers.recompose();
   return box;
  },
  // WATER PAINTED, ERASED OR TIDIED BY ANY TOOL, at the end of its stroke: the
  // bodies are read from the layer again, each keeping its level where it can,
  // and new ones dug in (water-bed.js), so the sheet follows the paint and what
  // is erased goes (until 4 November 2026 an erased pond's sheet stayed in the
  // view). Joins the stroke's undo step. Returns the box of land changed, or null.
  settleWater() {
   if (!waterDirty) return null;
   waterDirty = false;
   const step = state.undo.at(-1), before = records();
   const bodies = bodiesFrom(outlines('water').map(ring => ring.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])));
   step.snapshot = before; state.water = bodies;
   if (!bodies.length) return null;
   const xs = bodies.flatMap(w => w.rings[0].map(p => p[0])), zs = bodies.flatMap(w => w.rings[0].map(p => p[1])), m = BED.reach + 2;
   const wide = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m];
   const land0 = remember('land', ...wide); state.undo.pop(); step.parts = land0.parts;
   step.box = [Math.min(step.box[0], wide[0]), Math.max(step.box[1], wide[1]), Math.min(step.box[2], wide[2]), Math.max(step.box[3], wide[3])];
   for (const w of bodies) digInto([land, ...patches], w.rings, w.level);
   noteEdit(wide); resample();
   return wide;
  },

  // SKIN THE LAND FROM ITS HEIGHTS (skin.js; the owner, 3 November 2026):
  // the landscape's rock on the steep ground and its apron below, read off
  // the land as shaped now, added to the layers (or replacing those two
  // kinds' painting with `replace`); never on the holes' turf, sand, paths
  // or water, nor within the skin's `clear` metres of them. One undo step.
  // Returns what it painted: {kinds, cells}.
  skinFromLand({bio, replace = false} = {}) {
   const nx = r.nx, nz = r.nz, ground = new Float32Array(nx * nz);
   for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ground[j * nx + i] = sample(r.x0 + (i + .5) * r.cell, r.z0 + (j + .5) * r.cell);
   const land = {nx, nz, cell: r.cell, halfX: -r.x0, halfZ: -r.z0, ground};
   const PLAYED = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'semi']), c = SKIN.clear;
   const keepOut = (x, z) => [[0, 0], [c, 0], [-c, 0], [0, c], [0, -c]].some(([dx, dz]) => PLAYED.has(api.surfaceAt(x + dx, z + dz)));
   const skin = skinFromHeights(land, bio, keepOut);
   // The layers made before the undo snapshot, so undo knows them (as
   // fillOutline does).
   for (const kind of Object.keys(skin.masks)) r.layers.mask(kind, true);
   remember('paint', r.x0, -r.x0, r.z0, -r.z0); state.surfacesEdited = true;
   for (const [kind, m] of Object.entries(skin.masks)) {
    const into = r.layers.mask(kind, true);
    for (let k = 0; k < m.length; k++) if (m[k]) into[k] = 1; else if (replace) into[k] = 0;
   }
   r.layers.recompose();
   return {kinds: skin.kinds, cells: skin.cells};
  },

  // ---- holes, water, trees: records, each change one undo step.
  editHoles(f) { remember('records', 0, 0, 0, 0); f(state.holes); },
  setTee(hole, set, x, z) { api.editHoles(hs => { const h = hs[hole], t = h.tees.find(q => q.set === set); if (t) Object.assign(t, {x, z}); else h.tees.push({x, z, set}); h.line[0] = [h.tees[0].x, h.tees[0].z]; }); },
  setGreen(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.green = {x, z}; h.line[h.line.length - 1] = [x, z]; }); },
  addBend(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.line.splice(h.line.length - 1, 0, [x, z]); }); },
  // A HOLE'S MARKS, TO DRAG (the owner, 5 November 2026): its tees, the bends in
  // its line and its green, and one carried: the line follows, as setTee and
  // setGreen keep it, and the whole drag is one undo, or none if it did not move.
  marksOf(i) {
   const h = state.holes[i];
   return [...h.tees.map((t, n) => ({kind: 'tee', index: n, x: t.x, z: t.z})), ...h.line.slice(1, -1).map(([x, z], n) => ({kind: 'bend', index: n + 1, x, z})), {kind: 'green', x: h.green.x, z: h.green.z}];
  },
  holdMark(i, m) {
   const step = remember('records', 0, 0, 0, 0), h = () => state.holes[i]; let moved = false;
   return {
    set(x, z) {
     moved = true;
     if (m.kind === 'green') { h().green = {x, z}; h().line[h().line.length - 1] = [x, z]; }
     else if (m.kind === 'bend') h().line[m.index] = [x, z];
     else { Object.assign(h().tees[m.index], {x, z}); if (m.index === 0) h().line[0] = [x, z]; }
    },
    done() { if (!moved) state.undo.splice(state.undo.indexOf(step), 1); },
   };
  },
  setPar(hole, par) { api.editHoles(hs => { hs[hole].par = par; }); },
  // ADDING AND REMOVING HOLES (the builder-ux goal, item 9; TODO: the editor
  // could not "add or remove holes"): a new hole after the last, its back tee
  // at `at` and its green 300 m (328 yards) on in the direction given, par 4,
  // for its marks to be dragged where it belongs; or a hole taken out, the rest
  // renumbered in order. A course keeps at least one. One undo each.
  addHole({x, z, dx = 0, dz = -1}) {
   const L = Math.hypot(dx, dz) || 1, gx = x + dx / L * 300, gz = z + dz / L * 300;
   api.editHoles(hs => { const n = hs.length + 1; hs.push({number: n, par: 4, index: n, tees: [{x, z, set: 'blue'}], green: {x: gx, z: gz}, line: [[x, z], [gx, gz]]}); });
   return state.holes.length - 1;
  },
  removeHole(hole) {
   if (state.holes.length <= 1 || !state.holes[hole]) return false;
   api.editHoles(hs => { hs.splice(hole, 1); hs.forEach((h, k) => { h.number = k + 1; if (h.index > hs.length) h.index = k + 1; }); });
   return true;
  },
  addTree(tree) { remember('records', 0, 0, 0, 0); state.trees.push(tree); },
  // ONE TREE PICKED BY NAME (the owner, 5 November 2026): its size from its height
  // and role, its species kept. Null `species`: the landscape chooses, as before.
  placeTree({x, z, h, species = null}) {
   if (!species) return api.addTree([x, z, h, h * .28, Math.min(.8, h * .027), 2 | TREE_HAND, -1]);
   remember('records', 0, 0, 0, 0);
   let kind = state.treeKinds.indexOf(species); if (kind < 0) kind = state.treeKinds.push(species) - 1;
   const t = treeSized(species, h); state.trees.push([x, z, t.h, t.crown, t.trunk, t.role | TREE_HAND, kind]);
  },
  // May a tree stand here? Not on mown turf, sand, water, a path or a road.
  treeFits: (x, z) => !TREE_REFUSED.has(api.surfaceAt(x, z)),
  // A TREE ZONE, as door 2's (layer-ops.js zoneTrees). Returns how many.
  treeZone(ring, {density = 120, seed = 1} = {}) {
   const got = zoneTrees(ring, {density, seed, open: api.treeFits}); if (!got.length) return 0;
   remember('records', 0, 0, 0, 0);
   for (const t of got) state.trees.push([t.x, t.z, t.h, t.crown, Math.min(.8, t.h * .027), 2, -1]);
   return got.length;
  },
  // A HOUSE ZONE, as door 2's (layer-ops.js zoneHomes). One undo. Returns how many.
  homeZone(ring, {seed = 1} = {}) {
   const before = records(), step = remember('records', 0, 0, 0, 0);
   const n = zoneHomes(ring, {seed, place: h => { const home = {...h, rotation: facingFrom((px, pz) => api.surfaceAt(px, pz))(h.x, h.z)}; if (!api.homeFits(home)) return false; state.homes.push(home); return true; }});
   if (n) step.snapshot = before; else state.undo.splice(state.undo.indexOf(step), 1);
   return n;
  },
  setTreeScale(f) { state.treeScale = Math.max(.25, Math.min(3, f)); state.changed = true; },
  setTreePlan(plan) { state.treePlan = plan ?? null; state.changed = true; },
  setSurround(record) { state.surround = normaliseSurround(record); state.changed = true; },
  // The tree whose crown holds a point (at least 1.5 m round its trunk), the
  // nearest of several; -1 for none.
  treeAt({x, z}) {
   let ti = -1, td = Infinity; state.trees.forEach((t, q) => { const d = Math.hypot(t[0] - x, t[1] - z); if (d <= Math.max(1.5, t[3]) && d < td) { td = d; ti = q; } });
   return ti;
  },
  // ONE TREE'S SIZE (the owner, 1 November 2026: "let me be able to set
  // scale per tree in the editor as well"): tree `index` made `f` times the
  // `base` record it had when picked -- height, crown and trunk together, as
  // the whole-course scale does, which still applies on top. 0.25 to 3 times
  // (PLACED, the whole scale's bounds). `first` starts one undo step, so a
  // slider dragged on one pick is one Undo.
  sizeTree(index, base, f, first = false) {
   if (!state.trees[index]) return;
   if (first) remember('records', 0, 0, 0, 0);
   // Later moves of the slider make no step, and Game view has to know.
   state.touched = (state.touched ?? 0) + 1;
   const k = Math.max(.25, Math.min(3, f));
   state.trees[index] = [base[0], base[1], base[2] * k, base[3] * k, base[4] * k, ...base.slice(5)];
   state.trees[index][5] |= TREE_HAND;
  },
  // Crowns drawn in off the greens and tees, a tree with no room taken out
  // (tree-clear.js); one undo step. Returns {shrunk, removed}. Measured at
  // the tree scale, as the crowns are drawn and saved, so a scaled crown
  // stops short of the green too (raised afterwards, it can reach again).
  clearTreesFromTurf() {
   const N = r.nx * r.nz, mask = new Uint8Array(N), f = state.treeScale;
   for (const k of ['green', 'tee']) { const m = r.layers.masks.get(k); if (m) for (let q = 0; q < N; q++) if (m[q]) mask[q] = 1; }
   const got = clearTrees(state.trees, {nx: r.nx, nz: r.nz, cell: r.cell, x0: r.x0 + r.cell / 2, z0: r.z0 + r.cell / 2}, mask,
    {get: t => ({x: t[0], z: t[1], crown: t[3] * f}), put: (t, crown) => { const n = [...t]; n[3] = crown / f; return n; }});
   if (!got.shrunk && !got.removed) return got;
   remember('records', 0, 0, 0, 0); state.trees = got.trees;
   return got;
  },
  // Removes trees within `radius`, or every `keep`-th one is kept (thinning).
  removeTrees({x, z, radius, keep = 0}) {
   remember('records', 0, 0, 0, 0);
   let n = 0;
   state.trees = state.trees.filter(t => { const inside = Math.hypot(t[0] - x, t[1] - z) <= radius; if (!inside) return true; n++; return keep > 0 && n % keep === 0; });
  },
  // HOUSES (1 November 2026: carried through the editor, never shown or
  // edited until now): a footprint stood where clicked, facing the nearest
  // fairway, green or tee, as door 2 stands them (trace-edit.js facingFrom);
  // taken off under the brush. Records, one undo step each.
  // Refused (false) where it would not stand on open ground all round -- not
  // turf, sand, water or a path -- as door 2 refuses one (trace-edit.js homeFits).
  addHome({x, z, rotation = null, width = 20, depth = 15}) {
   const home = {x, z, rotation: rotation ?? facingFrom((px, pz) => api.surfaceAt(px, pz))(x, z), width, depth};
   if (!api.homeFits(home)) return false;
   remember('records', 0, 0, 0, 0); state.homes.push(home); return true;
  },
  homeFits({x, z, rotation, width, depth}) {
   const c = Math.cos(rotation), sn = Math.sin(rotation), MOWN = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'semi']);
   return ![[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].some(([a, b]) => { const lx = a * (width / 2 + 2), lz = b * (depth / 2 + 2); return MOWN.has(api.surfaceAt(x + lx * c + lz * sn, z - lx * sn + lz * c)); });
  },
  // GROUND COVER (cover.js; the owner, 4 November 2026: "a paint brush for
  // ground cover, so things like rocks, mixed bushes, etc."): one dab of the
  // brush scattered on open ground, each piece its own size between `min` and
  // `max` metres. `group` makes a drag one undo. Returns how many were added.
  paintCover({cover, x, z, radius, min, max, density, group = null, rng = Math.random}) {
   if (!group?.step) { const st = remember('records', 0, 0, 0, 0); if (group) group.step = st; }
   const refused = refusedBy(cover.key), got = scatterCover({cover, x, z, radius, min, max, density, rng, open: (px, pz) => !refused.has(api.surfaceAt(px, pz)), taken: (px, pz, reach) => coverAt(state, px, pz, reach)});
   for (const p of got) {
    if (p.rock) { state.rocks.push(p.rock); continue; }
    let kind = state.treeKinds.indexOf(p.species); if (kind < 0) kind = state.treeKinds.push(p.species) - 1;
    if (cover.key === 'trees') { const t = treeSized(p.species, p.size); state.trees.push([p.x, p.z, t.h, t.crown, t.trunk, t.role, kind]); }
    else state.trees.push([p.x, p.z, p.size, p.size * .6, .05, TREE_ROLE_SHRUB, kind]);
   }
   return got.length;
  },
  // Rocks, and plants sized as ground cover, off under the brush; not trees.
  clearCover({x, z, radius, group = null}) {
   const near = (px, pz) => Math.hypot(px - x, pz - z) <= radius, low = t => (t[5] & 7) === TREE_ROLE_SHRUB;
   const rocks = state.rocks.filter(q => !near(q[0], q[1])), trees = state.trees.filter(t => !(low(t) && near(t[0], t[1])));
   const n = state.rocks.length - rocks.length + state.trees.length - trees.length; if (!n) return 0;
   if (!group?.step) { const st = remember('records', 0, 0, 0, 0); if (group) group.step = st; }
   state.rocks = rocks; state.trees = trees;
   return n;
  },
  removeHomes({x, z, radius}) { const keep = state.homes.filter(h => Math.hypot(h.x - x, h.z - z) > radius); if (keep.length === state.homes.length) return 0; remember('records', 0, 0, 0, 0); const n = state.homes.length - keep.length; state.homes = keep; return n; },
  // MOVING ONE SHAPE (amendment 12, in the editor as in door 2's trace step):
  // what is under a point -- a house whose footprint holds it, a tree whose
  // crown does (at least 1.5 m), else one layer's patch, its cells joined edge
  // to edge: `kind`'s where it covers the point, else the topmost shown --
  // and `moveShape` puts it down `dx`, `dz` metres off, by whole cells. One
  // undo step; returns the box changed (metres) for the view.
  pickAt({x, z, kind = null}) {
   const hi = state.homes.findIndex(h => { const c = Math.cos(h.rotation), sn = Math.sin(h.rotation), lx = (x - h.x) * c - (z - h.z) * sn, lz = (x - h.x) * sn + (z - h.z) * c; return Math.abs(lx) <= h.width / 2 && Math.abs(lz) <= h.depth / 2; });
   if (hi >= 0) return {type: 'home', index: hi};
   const ri = state.rocks.findIndex(q => Math.hypot(q[0] - x, q[1] - z) <= Math.max(1, q[2] / 2));
   if (ri >= 0) return {type: 'rock', index: ri};
   const ti = api.treeAt({x, z});
   if (ti >= 0) return {type: 'tree', index: ti};
   // A CREEK (the builder-ux goal, item 9): within its half-width and 2 m of
   // its line, so it can be chosen and deleted.
   const ci = state.creeks.findIndex(c => c.points.some((q, n) => n && segDist(x, z, c.points[n - 1][0], c.points[n - 1][1], q[0], q[1]) <= q[2] / 2 + 2));
   if (ci >= 0) return {type: 'creek', index: ci};
   const i = Math.floor((x - r.x0) / r.cell), j = Math.floor((z - r.z0) / r.cell); if (i < 0 || j < 0 || i >= r.nx || j >= r.nz) return null;
   const k0 = j * r.nx + i, want = kind && r.layers.masks.get(kind)?.[k0] ? kind : PAINT[r.layers.view[k0]];
   const m = want && want !== 'rough' ? r.layers.masks.get(want) : null; if (!m?.[k0]) return null;
   const N = r.nx * r.nz, seen = new Uint8Array(N), cells = [k0]; seen[k0] = 1;
   for (let q = 0; q < cells.length; q++) { const k = cells[q], ci = k % r.nx; for (const n of [ci > 0 ? k - 1 : -1, ci < r.nx - 1 ? k + 1 : -1, k - r.nx, k + r.nx]) if (n >= 0 && n < N && !seen[n] && m[n]) { seen[n] = 1; cells.push(n); } }
   return {type: 'shape', kind: want, cells};
  },
  // DELETING ONE THING (the builder-ux goal, item 9; TODO: "The editor cannot
  // move or delete a pond or creek once drawn"): a shape off its own layer --
  // a pond's water body with it -- a tree, a rock, a house, or a creek. One
  // undo. A pond's dug bed and a creek's cut channel stay in the land, as a
  // pond moved leaves its pit (Fill to surrounding raises them). Returns the
  // box changed (metres) for the view, or null for a record alone.
  removePick(pick) {
   if (!pick) return null;
   if (pick.type === 'creek') { remember('records', 0, 0, 0, 0); const c = state.creeks.splice(pick.index, 1)[0]; const xs = c.points.map(q => q[0]), zs = c.points.map(q => q[1]); return [Math.min(...xs) - 8, Math.max(...xs) + 8, Math.min(...zs) - 8, Math.max(...zs) + 8]; }
   if (pick.type !== 'shape') { remember('records', 0, 0, 0, 0); const list = pick.type === 'home' ? 'homes' : pick.type === 'rock' ? 'rocks' : 'trees'; state[list] = state[list].filter((_, q) => q !== pick.index); return null; }
   const box = api.boxOf(pick.cells), mid = api.middleOf(pick), step = remember('paint', ...box);
   if (pick.kind === 'water') { const body = state.water.findIndex(w => polygonDistance(w.rings, mid.x, mid.z) < 0); if (body >= 0) { step.snapshot = records(); state.water.splice(body, 1); } }
   state.surfacesEdited = true;
   const m = r.layers.mask(pick.kind, true); for (const k of pick.cells) m[k] = 0;
   recomposeBox(box);
   return box;
  },
  moveShape(pick, dx, dz) {
   if (!pick) return null;
   if (pick.type === 'rock') { remember('records', 0, 0, 0, 0); const q = state.rocks[pick.index]; state.rocks[pick.index] = [q[0] + dx, q[1] + dz, ...q.slice(2)]; return null; }
   if (pick.type === 'tree') { remember('records', 0, 0, 0, 0); const t = state.trees[pick.index]; state.trees[pick.index] = [t[0] + dx, t[1] + dz, ...t.slice(2)]; return null; }
   if (pick.type === 'home') { remember('records', 0, 0, 0, 0); const h = state.homes[pick.index]; state.homes[pick.index] = {...h, x: h.x + dx, z: h.z + dz}; return null; }
   const di = Math.round(dx / r.cell), dj = Math.round(dz / r.cell); if (!di && !dj) return null;
   let i0 = r.nx, i1 = 0, j0 = r.nz, j1 = 0; for (const k of pick.cells) { const i = k % r.nx, j = (k - i) / r.nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
   const box = [r.x0 + (Math.min(i0, i0 + di)) * r.cell, r.x0 + (Math.max(i1, i1 + di) + 1) * r.cell, r.z0 + (Math.min(j0, j0 + dj)) * r.cell, r.z0 + (Math.max(j1, j1 + dj) + 1) * r.cell];
   remember('paint', ...box); state.surfacesEdited = true;
   const m = r.layers.mask(pick.kind, true);
   for (const k of pick.cells) m[k] = 0;
   for (const k of pick.cells) { const i = k % r.nx + di, j = Math.floor(k / r.nx) + dj; if (i >= 0 && j >= 0 && i < r.nx && j < r.nz) m[j * r.nx + i] = 1; }
   recomposeBox(box);
   return box;
  },
  // Turning one shape `angle` radians about its middle (trace-edit.js
  // turnedCells): a patch cell by cell, a house's facing; a tree is round.
  // One undo step; returns the box changed (metres) for the view.
  turnShape(pick, angle) {
   if (!pick || !angle) return null;
   if (pick.type === 'home') { remember('records', 0, 0, 0, 0); const h = state.homes[pick.index]; state.homes[pick.index] = {...h, rotation: h.rotation - angle}; return null; }   // a facing is measured the other way round
   if (pick.type !== 'shape') return null;
   const out = turnedCells(pick.cells, angle, r.nx, r.nz);
   let i0 = r.nx, i1 = 0, j0 = r.nz, j1 = 0; for (const k of [...pick.cells, ...out]) { const i = k % r.nx, j = (k - i) / r.nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
   const box = [r.x0 + i0 * r.cell, r.x0 + (i1 + 1) * r.cell, r.z0 + j0 * r.cell, r.z0 + (j1 + 1) * r.cell];
   remember('paint', ...box); state.surfacesEdited = true;
   const m = r.layers.mask(pick.kind, true);
   for (const k of pick.cells) m[k] = 0;
   for (const k of out) m[k] = 1;
   recomposeBox(box);
   return box;
  },
  // A POND: its water on the grid and its bed dug into the land there and
  // then (water-bed.js), so it shows at once and in the game. One undo.
  addPond({ring, level = null}) {
   const lv = level ?? levelFrom(shoreOf([ring], sample));
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), m = BED.reach + 2;
   const box = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m];
   r.layers.mask('water', true);
   const step = remember('land', ...box); step.snapshot = records();
   const pt = remember('paint', ...box); state.undo.pop(); step.cells = pt.cells; step.surfacesEdited = state.surfacesEdited;
   state.water.push({rings: [ring], level: lv, kind: 'pond'});
   state.surfacesEdited = true; fill(r, [ring], r.layers.mask('water', true)); recomposeBox(box);
   digInto([land, ...patches], [ring], lv); noteEdit(box); resample();
   return lv;
  },
  // HOLDING ONE THING (the owner, 4 November 2026: "click to select first,
  // then outline that shape. We also need to make the moves for that shape
  // real time"). A press-and-drag on what is selected: the thing comes off the
  // course at once, so what lies under it shows, the view carries it as a
  // picture of itself under the pointer, and `drop` puts it down `dx`, `dz`
  // metres off, turned `angle`. The whole hold is one undo; let go where it
  // began and there is none. Returns {rings, mid, box, set, drop}: `set` moves
  // a record (a tree, a rock, a house) as it is carried, `drop` ends it and
  // returns {box, pick}, the box changed (metres) and the pick where it lies.
  holdShape(pick) {
   // A creek is not carried (PLACED, builder-ux: delete it and draw it again):
   // its channel is cut into the land, which a carry cannot lift.
   if (pick.type === 'creek') return {pick, rings: api.ringsOf(pick), mid: api.middleOf(pick), box: null, set() {}, drop() { return {box: null, pick}; }};
   if (pick.type !== 'shape') {
    const list = pick.type === 'home' ? state.homes : pick.type === 'rock' ? state.rocks : state.trees, was = list[pick.index];
    const rings = api.ringsOf(pick), mid = api.middleOf(pick), step = remember('records', 0, 0, 0, 0), plain = pick.type === 'home';
    const set = (dx, dz, angle = 0) => {
     if (plain) state.homes[pick.index] = {...was, x: was.x + dx, z: was.z + dz, rotation: was.rotation - angle};
     else list[pick.index] = [was[0] + dx, was[1] + dz, ...was.slice(2)];
    };
    return {pick, rings, mid, box: null, set,
     drop(dx, dz, angle = 0) { set(dx, dz, angle); if (!dx && !dz && !angle) state.undo.splice(state.undo.indexOf(step), 1); return {box: null, pick}; }};
   }
   const mid = api.middleOf(pick), rings = api.ringsOf(pick), box = api.boxOf(pick.cells), m = r.layers.mask(pick.kind, true), hadEdited = state.surfacesEdited;
   const step = remember('paint', ...box); state.surfacesEdited = true;
   // A pond carries its water body: its outline moves with it and its level
   // and bed are found again where it lands.
   const body = pick.kind === 'water' ? state.water.findIndex(w => polygonDistance(w.rings, mid.x, mid.z) < 0) : -1;
   if (body >= 0) step.snapshot = records();
   for (const k of pick.cells) m[k] = 0;
   recomposeBox(box);
   return {pick, rings, mid, box, set() {},
    drop(dx, dz, angle = 0) {
     const di = Math.round(dx / r.cell), dj = Math.round(dz / r.cell);
     if (!di && !dj && !angle) {
      for (const k of pick.cells) m[k] = 1;
      recomposeBox(box);
      state.undo.splice(state.undo.indexOf(step), 1); state.surfacesEdited = hadEdited;
      return {box, pick};
     }
     const turned = angle ? turnedCells(pick.cells, angle, r.nx, r.nz) : pick.cells, cells = [];
     for (const k of turned) { const i = k % r.nx + di, j = Math.floor(k / r.nx) + dj; if (i >= 0 && j >= 0 && i < r.nx && j < r.nz) cells.push(j * r.nx + i); }
     const landed = cells.length ? api.boxOf(cells) : box, all = [Math.min(box[0], landed[0]), Math.max(box[1], landed[1]), Math.min(box[2], landed[2]), Math.max(box[3], landed[3])];
     extendPaint(step, all);
     for (const k of cells) m[k] = 1;
     recomposeBox(all);
     if (body >= 0) {
      const c = Math.cos(angle), sn = Math.sin(angle), w = state.water[body];
      const moved = w.rings.map(ring => ring.map(([x, z]) => { const u = x - mid.x, v = z - mid.z; return [mid.x + u * c - v * sn + di * r.cell, mid.z + u * sn + v * c + dj * r.cell]; }));
      const level = levelFrom(shoreOf(moved, sample)), reach = BED.reach + 2, wide = [landed[0] - reach, landed[1] + reach, landed[2] - reach, landed[3] + reach];
      const was = remember('land', ...wide); state.undo.pop(); step.parts = was.parts;
      step.box = [Math.min(all[0], wide[0]), Math.max(all[1], wide[1]), Math.min(all[2], wide[2]), Math.max(all[3], wide[3])];
      state.water[body] = {...w, rings: moved, level};
      digInto([land, ...patches], moved, level); noteEdit(wide); resample();
      return {box: step.box, pick: {...pick, cells}, water: true};
     }
     return {box: all, pick: {...pick, cells}};
    }};
  },
  // A shape's middle, the box of its cells (metres), and its outline: the
  // rings the view draws round what is selected.
  middleOf(pick) {
   if (pick.type === 'creek') { const c = state.creeks[pick.index].points, q = c[Math.floor(c.length / 2)]; return {x: q[0], z: q[1]}; }
   if (pick.type === 'home') { const h = state.homes[pick.index]; return {x: h.x, z: h.z}; }
   if (pick.type !== 'shape') { const q = (pick.type === 'rock' ? state.rocks : state.trees)[pick.index]; return {x: q[0], z: q[1]}; }
   let sx = 0, sz = 0; for (const k of pick.cells) { sx += r.x0 + (k % r.nx + .5) * r.cell; sz += r.z0 + (Math.floor(k / r.nx) + .5) * r.cell; }
   return {x: sx / pick.cells.length, z: sz / pick.cells.length};
  },
  boxOf(cells) {
   let i0 = r.nx, i1 = 0, j0 = r.nz, j1 = 0; for (const k of cells) { const i = k % r.nx, j = (k - i) / r.nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
   return [r.x0 + i0 * r.cell, r.x0 + (i1 + 1) * r.cell, r.z0 + j0 * r.cell, r.z0 + (j1 + 1) * r.cell];
  },
  ringsOf(pick) {
   const round = (x, z, q) => [Array.from({length: 24}, (_, k) => [x + Math.cos(k / 24 * Math.PI * 2) * q, z + Math.sin(k / 24 * Math.PI * 2) * q])];
   if (pick.type === 'tree') { const t = state.trees[pick.index]; return round(t[0], t[1], Math.max(1.5, t[3] * state.treeScale)); }
   // A creek: its line both ways, a thin outline along it.
   if (pick.type === 'creek') { const c = state.creeks[pick.index].points.map(q => [q[0], q[1]]); return [[...c, ...c.slice().reverse()]]; }
   if (pick.type === 'rock') { const q = state.rocks[pick.index]; return round(q[0], q[1], Math.max(1, q[2] / 2)); }
   if (pick.type === 'home') {
    const h = state.homes[pick.index], c = Math.cos(h.rotation), sn = Math.sin(h.rotation), a = h.width / 2, b = h.depth / 2;
    return [[[-a, -b], [a, -b], [a, b], [-a, b]].map(([u, v]) => [h.x + u * c + v * sn, h.z - u * sn + v * c])];
   }
   let i0 = r.nx, i1 = 0, j0 = r.nz, j1 = 0; for (const k of pick.cells) { const i = k % r.nx, j = (k - i) / r.nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
   const w = i1 - i0 + 3, h = j1 - j0 + 3, sub = new Uint8Array(w * h);
   for (const k of pick.cells) { const i = k % r.nx, j = (k - i) / r.nx; sub[(j - j0 + 1) * w + i - i0 + 1] = 1; }
   return layerRings(sub, {nx: w, nz: h, cell: r.cell, x0: r.x0 + (i0 - .5) * r.cell, z0: r.z0 + (j0 - .5) * r.cell}).sort((p, q) => q.length - p.length);
  },
  // Is a point on the shape picked: where a press starts a move, not a new pick.
  onPick(pick, x, z) {
   if (pick.type !== 'shape') { const g = api.pickAt({x, z}); return g?.type === pick.type && g.index === pick.index; }
   const i = Math.floor((x - r.x0) / r.cell), j = Math.floor((z - r.z0) / r.cell);
   return i >= 0 && j >= 0 && i < r.nx && j < r.nz && pick.cells.includes(j * r.nx + i);
  },
  setLandscape(key) { remember('records', 0, 0, 0, 0); state.landscape = key; },

  // A BUNKER DUG at a click: sand painted in a disc and the ground lowered
  // under it (water-bed.js digBowl) -- one undo.
  digBunker({x, z, radius = 5, depth = .6}) {
   const box = [x - radius - 1, x + radius + 1, z - radius - 1, z + radius + 1];
   const sand = r.layers.mask('sand', true), st = remember('land', ...box), pt = remember('paint', ...box); state.undo.pop(); st.cells = pt.cells; st.surfacesEdited = state.surfacesEdited;
   state.surfacesEdited = true; noteEdit(box);
   for (const g of [land, ...patches]) digBowl(g, {x, z, radius, depth});
   resample();
   const [i0, i1, j0, j1] = cellBox(...box);
   for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(r.x0 + (i + .5) * r.cell - x, r.z0 + (j + .5) * r.cell - z) <= radius) sand[j * r.nx + i] = 1;
   r.layers.recompose(i0, i1, j0, j1);
   return box;
  },

  // A CREEK DRAWN as a line from its head to its foot: stations every 2 m,
  // the water's level never rising downstream and kept under the ground, the
  // channel cut into the land under it (a parabola across, the bank graded
  // out over 3 m) -- the same station record a generated creek has
  // (streams.js), so the game's channel code draws and plays it. One undo.
  addCreek({points, width = 3, depth = .7}) {
   const stations = creekStations(points, {width, depth, height: sample}), box = creekBox(stations);
   const step = remember('land', ...box); step.snapshot = records(); noteEdit(box);
   for (const g of [land, ...patches]) carveCreek(g, stations);
   resample();
   state.creeks.push({kind: 'creek', points: stations.map(p => CREEK_FIELDS.map(f => p[f]))});
   return box;
  },

  undo() { const s = state.undo.pop(); if (!s) return null; state.redo.push(swap(s)); return s; },
  redo() { const s = state.redo.pop(); if (!s) return null; state.undo.push(swap(s)); return s; },

  // ---- back to a document: the outlines traced from the grid (only when a
  // surface was painted), the water bodies matched to their levels, and every
  // body's bed dug (water-bed.js): a course saved before ponds were dug comes
  // right by opening it here and saving it again.
  toDoc({onStep = () => {}} = {}) {
   let surfaces = doc.surfaces, water = state.water;
   if (state.surfacesEdited) {
    surfaces = Object.fromEntries(Object.keys(doc.surfaces).map(k => [k, []]));
    // Each LAYER traced from its own mask (overlaps kept: the game reads them
    // in the layers' order), over its own box, not the course.
    const traced = {};
    LAYER_ORDER.forEach((kind, n) => {
     if (!r.layers.masks.get(kind)) return;
     onStep(`Tracing the ${kind}`, n / LAYER_ORDER.length);
     // As door 2 makes its course (outlines, above): until 1 November 2026
     // the editor simplified to a third of a cell and kept the staircase.
     const rings = outlines(kind).map(ring => ring.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]));
     if (rings.length) traced[kind] = rings;
    });
    for (const [kind, rings] of Object.entries(traced)) if (kind !== 'water' && rings.length) surfaces[kind] = [rings];
    water = bodiesFrom(traced.water || []);
   }
   const grids = [{...land, heights: Float32Array.from(land.heights)}, ...patches.map(p => ({...p, heights: Float32Array.from(p.heights)}))];
   for (const w of water) digInto(grids, w.rings, w.level);
   const trees = new Float32Array(state.trees.length * TREE_STRIDE), f = state.treeScale;
   state.trees.forEach((t, i) => trees.set(f === 1 ? t : [t[0], t[1], t[2] * f, t[3] * f, t[4] * f, ...t.slice(5)], i * TREE_STRIDE));
   const {treePlan: _old, surround: _was, ...rest} = doc;
   return {...rest, ...(state.treePlan ? {treePlan: state.treePlan} : {}), ...(state.surround ? {surround: state.surround} : {}), name: state.name, landscape: state.landscape, land: grids[0], patches: grids.slice(1),
    surfaces, water, creeks: structuredClone(state.creeks), holes: structuredClone(state.holes), trees, treeKinds: [...state.treeKinds], rocks: structuredClone(state.rocks), homes: structuredClone(state.homes), landEdits: state.landEdits.map(b => [...b])};
  },
 };
 // A brush onto one layer (or every layer, `kind` null) -- covering (v 1) or
 // taking off (v 0) -- one undo step for a whole drag.
 function brush(kind, v, x, z, radius, group) {
  const box = [x - radius, x + radius, z - radius, z + radius];
  if (kind) r.layers.mask(kind, true);
  if (!group?.step) { const st = remember('paint', ...box); if (group) group.step = st; } else extendPaint(group.step, box);
  state.surfacesEdited = true;
  if (!kind || kind === 'water') waterDirty = true;
  const masks = kind ? [r.layers.mask(kind)] : [...r.layers.masks.values()], [i0, i1, j0, j1] = cellBox(...box);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
   const px = r.x0 + (i + .5) * r.cell, pz = r.z0 + (j + .5) * r.cell;
   if (Math.hypot(px - x, pz - z) <= radius) for (const m of masks) m[j * r.nx + i] = v;
  }
  r.layers.recompose(i0, i1, j0, j1);
  return box;
 }
 // A body's bed dug into each grid; a green or tee beside it keeps its ground.
 function digInto(grids, rings, level) {
  const keep = (x, z) => { const k = api.surfaceAt(x, z); return k === 'green' || k === 'tee'; };
  for (const g of grids) digBed(g, rings, level, {keep});
 }
 // Water bodies from the layer's rings: one a ring not inside another, its
 // islands with it; its level the stored body it overlaps, else just under its
 // lowest shore. A stored level stays unless the ground here is far from it
 // (PLACED: 2 m from the shore's middle): the water was moved somewhere else.
 function bodiesFrom(rings) {
  const outer = rings.filter(ring => !rings.some(o => o !== ring && polygonDistance([o], ring[0][0], ring[0][1]) < 0));
  return outer.map(o => {
   const islands = rings.filter(ring => ring !== o && polygonDistance([o], ring[0][0], ring[0][1]) < 0);
   // Matched by the middle of the stored body (its first point sits on the
   // traced edge, half a cell either side of it).
   const mid = ring => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
   const was = state.water.find(w => polygonDistance([o], ...mid(w.rings[0])) < 0 || polygonDistance(w.rings, ...mid(o)) < 0);
   const shore = shoreOf([o], sample), middle = [...shore].sort((p, q) => p - q)[shore.length >> 1];
   return {rings: [o, ...islands], level: was && Math.abs(middle - was.level) <= 2 ? was.level : levelFrom(shore), kind: was?.kind ?? 'pond'};
  });
 }
 function recomposeBox(box) { const [i0, i1, j0, j1] = cellBox(...box); r.layers.recompose(i0, i1, j0, j1); }
 // A shaped box joins the one it overlaps, else is added; past 400 boxes the
 // two nearest are merged, so a long afternoon's shaping stays a short list.
 function noteEdit([x0, x1, z0, z1]) {
  const e = state.landEdits, hit = e.find(b => x0 <= b[1] + 2 && x1 >= b[0] - 2 && z0 <= b[3] + 2 && z1 >= b[2] - 2);
  if (hit) { hit[0] = Math.min(hit[0], x0); hit[1] = Math.max(hit[1], x1); hit[2] = Math.min(hit[2], z0); hit[3] = Math.max(hit[3], z1); }
  else e.push([x0, x1, z0, z1]);
  while (e.length > 400) { const b = e.pop(); const a = e.at(-1); a[0] = Math.min(a[0], b[0]); a[1] = Math.max(a[1], b[1]); a[2] = Math.min(a[2], b[2]); a[3] = Math.max(a[3], b[3]); }
 }
 // A drag is one undo: its box grows, and the grids' rows it now reaches are
 // remembered as they were before the drag touched them.
 function extendLand(step, box) {
  const [x0, x1, z0, z1] = step.box, nb = [Math.min(x0, box[0]), Math.max(x1, box[1]), Math.min(z0, box[2]), Math.max(z1, box[3])];
  if (nb.every((v, i) => v === step.box[i])) return;
  const fresh = remember('land', ...nb); state.undo.pop();
  // Keep the earlier rows where they were remembered (the state before the drag).
  for (const p of fresh.parts) {
   const q = step.parts.find(o => o.g === p.g); if (!q) continue;
   q.rows.forEach((row, k) => { const j = q.j0 + k; if (j < p.j0 || j > p.j1) return; p.rows[j - p.j0].set(row, q.i0 - p.i0); });
  }
  step.parts = fresh.parts; step.box = nb;
 }
 function extendPaint(step, box) {
  const [x0, x1, z0, z1] = step.box, nb = [Math.min(x0, box[0]), Math.max(x1, box[1]), Math.min(z0, box[2]), Math.max(z1, box[3])];
  if (nb.every((v, i) => v === step.box[i])) return;
  const fresh = remember('paint', ...nb); state.undo.pop();
  const q = step.cells, p = fresh.cells;
  for (const [kind, rows] of q.layers) { const pr = p.layers.get(kind); if (pr) rows.forEach((row, k) => pr[q.j0 + k - p.j0].set(row, q.i0 - p.i0)); }
  step.cells = p; step.box = nb;
 }
 return api;
}
