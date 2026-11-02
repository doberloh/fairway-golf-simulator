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
import {createLayers, LAYER_ORDER} from './layers.js';
import {facingFrom, turnedCells} from './trace-edit.js';
import {layerRings} from './real-course.js';
import {GRID_MARGIN, landSampler, polygonDistance} from '../built-world.js';
import {TREE_STRIDE, CREEK_FIELDS} from '../course-doc.js';
import {clearTrees} from './tree-clear.js';

// The codes a surface cell can hold, in the order the field paints them
// lowest first: a later one wins where a document's outlines overlap.
export const PAINT = ['rough', ...GROUND_KINDS.filter(k => k !== 'path'), 'semi', 'fairway', 'path', 'tee', 'green', 'sand', 'water'];
export const CODE = Object.fromEntries(PAINT.map((k, i) => [k, i]));
export const RASTER = {cell: .5, maxSide: 4096};
// A brush's weight at a share `t` of its radius: 1 at the centre, 0 at the edge.
export const falloff = t => t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);

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
 const state = {
  doc, raster: r, land, patches, ex, ez,
  holes: structuredClone(doc.holes), water: structuredClone(doc.water || []), creeks: structuredClone(doc.creeks || []),
  trees: Array.from({length: doc.trees.length / TREE_STRIDE}, (_, i) => Array.from(doc.trees.subarray(i * TREE_STRIDE, (i + 1) * TREE_STRIDE))),
  homes: structuredClone(doc.homes || []),
  landscape: doc.landscape, name: doc.name,
  // THE TREES' HEIGHT SCALE (the owner, 1 November 2026: "allow the user to
  // adjust the tree height scale. show in real time"): every tree's height,
  // crown width and trunk times this -- the whole tree in proportion (the
  // owner's choice over a separate width) -- as drawn and as saved (toDoc);
  // the trees keep their own sizes, so it can go back to 1. A course saved
  // at 1.2 opens at 1 with its trees 1.2 times bigger.
  treeScale: 1,
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
 const records = () => structuredClone({holes: state.holes, water: state.water, creeks: state.creeks, trees: state.trees, homes: state.homes, landscape: state.landscape});
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
  // straight grade between their heights, `radius` either side). `strength`
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
     } else w = falloff(Math.hypot(px - x, pz - z) / radius) * strength;
     if (w <= 0) continue;
     if (op === 'raise') h[k] += w * .5;
     else if (op === 'lower') h[k] -= w * .5;
     else if (op === 'flatten') h[k] += (target - h[k]) * w;
     else if (op === 'ramp') h[k] += (t - h[k]) * w;
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
   recomposeBox(box);
   return box;
  },

  // ---- holes, water, trees: records, each change one undo step.
  editHoles(f) { remember('records', 0, 0, 0, 0); f(state.holes); },
  setTee(hole, set, x, z) { api.editHoles(hs => { const h = hs[hole], t = h.tees.find(q => q.set === set); if (t) Object.assign(t, {x, z}); else h.tees.push({x, z, set}); h.line[0] = [h.tees[0].x, h.tees[0].z]; }); },
  setGreen(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.green = {x, z}; h.line[h.line.length - 1] = [x, z]; }); },
  addBend(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.line.splice(h.line.length - 1, 0, [x, z]); }); },
  setPar(hole, par) { api.editHoles(hs => { hs[hole].par = par; }); },
  addTree(tree) { remember('records', 0, 0, 0, 0); state.trees.push(tree); },
  setTreeScale(f) { state.treeScale = Math.max(.25, Math.min(3, f)); state.changed = true; },
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
   const k = Math.max(.25, Math.min(3, f));
   state.trees[index] = [base[0], base[1], base[2] * k, base[3] * k, base[4] * k, ...base.slice(5)];
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
   const rot = rotation ?? facingFrom((px, pz) => api.surfaceAt(px, pz))(x, z), c = Math.cos(rot), sn = Math.sin(rot), MOWN = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'semi']);
   if ([[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].some(([a, b]) => { const lx = a * (width / 2 + 2), lz = b * (depth / 2 + 2); return MOWN.has(api.surfaceAt(x + lx * c + lz * sn, z - lx * sn + lz * c)); })) return false;
   remember('records', 0, 0, 0, 0); state.homes.push({x, z, rotation: rot, width, depth}); return true;
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
   const ti = api.treeAt({x, z});
   if (ti >= 0) return {type: 'tree', index: ti};
   const i = Math.floor((x - r.x0) / r.cell), j = Math.floor((z - r.z0) / r.cell); if (i < 0 || j < 0 || i >= r.nx || j >= r.nz) return null;
   const k0 = j * r.nx + i, want = kind && r.layers.masks.get(kind)?.[k0] ? kind : PAINT[r.layers.view[k0]];
   const m = want && want !== 'rough' ? r.layers.masks.get(want) : null; if (!m?.[k0]) return null;
   const N = r.nx * r.nz, seen = new Uint8Array(N), cells = [k0]; seen[k0] = 1;
   for (let q = 0; q < cells.length; q++) { const k = cells[q], ci = k % r.nx; for (const n of [ci > 0 ? k - 1 : -1, ci < r.nx - 1 ? k + 1 : -1, k - r.nx, k + r.nx]) if (n >= 0 && n < N && !seen[n] && m[n]) { seen[n] = 1; cells.push(n); } }
   return {type: 'shape', kind: want, cells};
  },
  moveShape(pick, dx, dz) {
   if (!pick) return null;
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
  addPond({ring, level = null}) {
   remember('records', 0, 0, 0, 0);
   const lv = level ?? Math.min(...ring.map(([x, z]) => sample(x, z))) - .3;
   state.water.push({rings: [ring], level: lv, kind: 'pond'});
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
   r.layers.mask('water', true);
   const st = remember('paint', Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)); state.undo.pop(); state.undo.at(-1).cells = st.cells; state.undo.at(-1).surfacesEdited = state.surfacesEdited; state.undo.at(-1).box = st.box;
   state.surfacesEdited = true; fill(r, [ring], r.layers.mask('water', true)); recomposeBox(st.box);
   return lv;
  },
  setLandscape(key) { remember('records', 0, 0, 0, 0); state.landscape = key; },

  // A BUNKER DUG at a click: sand painted in a disc and the ground lowered
  // under it, deepest at the middle with a lip at the edge -- one undo.
  digBunker({x, z, radius = 5, depth = .6}) {
   const box = [x - radius - 1, x + radius + 1, z - radius - 1, z + radius + 1];
   const sand = r.layers.mask('sand', true), st = remember('land', ...box), pt = remember('paint', ...box); state.undo.pop(); st.cells = pt.cells; st.surfacesEdited = state.surfacesEdited;
   state.surfacesEdited = true; noteEdit(box);
   for (const [g, i0, i1, j0, j1] of gridsIn(...box)) {
    const cz = g.cellZ ?? g.cell;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
     const d = Math.hypot(g.x0 + i * g.cell - x, g.z0 + j * cz - z) / radius;
     if (d < 1) g.heights[j * g.nx + i] -= depth * (1 - d * d * d * d);
    }
   }
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
   if (points.length < 2) throw Error('A creek needs two points.');
   // Water runs downhill: a creek drawn from its foot is turned round, or its
   // level, kept from the top, would cut an ever deeper trench up the slope.
   if (sample(...points.at(-1)) > sample(...points[0])) points = [...points].reverse();
   const st = [];
   for (let k = 1; k < points.length; k++) {
    const [ax, az] = points[k - 1], [bx, bz] = points[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let t = k === 1 ? 0 : 1; t <= n; t++) st.push([ax + (bx - ax) * t / n, az + (bz - az) * t / n]);
   }
   let level = Infinity;
   const stations = st.map(([x, z], i) => {
    level = Math.min(level, sample(x, z) - .4);
    const [px, pz] = st[Math.max(0, i - 1)], [qx, qz] = st[Math.min(st.length - 1, i + 1)], len = Math.hypot(qx - px, qz - pz) || 1;
    return {x, z, width, level, depth, nx: -(qz - pz) / len, nz: (qx - px) / len, miter: 1, bank: 14 + width * .6};
   });
   const xs = st.map(p => p[0]), zs = st.map(p => p[1]), reach = width / 2 + 4;
   const box = [Math.min(...xs) - reach, Math.max(...xs) + reach, Math.min(...zs) - reach, Math.max(...zs) + reach];
   const step = remember('land', ...box); step.snapshot = records(); noteEdit(box);
   for (const [g, i0, i1, j0, j1] of gridsIn(...box)) {
    const cz = g.cellZ ?? g.cell;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
     const px = g.x0 + i * g.cell, pz = g.z0 + j * cz;
     let best = null;
     for (let k = 1; k < stations.length; k++) {
      const a = stations[k - 1], b = stations[k], dx = b.x - a.x, dz = b.z - a.z, u = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(px - a.x - dx * u, pz - a.z - dz * u);
      if (!best || d < best.d) best = {d, level: a.level + (b.level - a.level) * u};
     }
     if (best.d > reach) continue;
     const half = width / 2, bed = best.d < half ? best.level - depth * (1 - (best.d / half) ** 2) : best.level + (best.d - half) * .5;
     const k = j * g.nx + i; if (bed < g.heights[k]) g.heights[k] = bed;
    }
   }
   resample();
   state.creeks.push({kind: 'creek', points: stations.map(p => CREEK_FIELDS.map(f => p[f]))});
   return box;
  },

  undo() { const s = state.undo.pop(); if (!s) return null; state.redo.push(swap(s)); return s; },
  redo() { const s = state.redo.pop(); if (!s) return null; state.undo.push(swap(s)); return s; },

  // ---- back to a document: the outlines traced from the grid (only when a
  // surface was painted), the water bodies matched to their levels.
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
    // Water: one body a ring that is not inside another, its islands with it;
    // its level the stored body it overlaps, else just under its lowest shore.
    const rings = traced.water || [], outer = rings.filter(ring => !rings.some(o => o !== ring && polygonDistance([o], ring[0][0], ring[0][1]) < 0));
    water = outer.map(o => {
     const islands = rings.filter(ring => ring !== o && polygonDistance([o], ring[0][0], ring[0][1]) < 0);
     // Matched by the middle of the stored body (its first point sits on the
     // traced edge, half a cell either side of it).
     const mid = ring => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
     const was = state.water.find(w => polygonDistance([o], ...mid(w.rings[0])) < 0 || polygonDistance(w.rings, ...mid(o)) < 0);
     const shore = o.map(([x, z]) => sample(x, z)).sort((p, q) => p - q);
     return {rings: [o, ...islands], level: was?.level ?? shore[Math.floor(shore.length * .1)] - .3, kind: was?.kind ?? 'pond'};
    });
   }
   const trees = new Float32Array(state.trees.length * TREE_STRIDE), f = state.treeScale;
   state.trees.forEach((t, i) => trees.set(f === 1 ? t : [t[0], t[1], t[2] * f, t[3] * f, t[4] * f, ...t.slice(5)], i * TREE_STRIDE));
   return {...doc, name: state.name, landscape: state.landscape, land: {...land, heights: Float32Array.from(land.heights)}, patches: patches.map(p => ({...p, heights: Float32Array.from(p.heights)})),
    surfaces, water, creeks: structuredClone(state.creeks), holes: structuredClone(state.holes), trees, homes: structuredClone(state.homes), landEdits: state.landEdits.map(b => [...b])};
  },
 };
 // A brush onto one layer (or every layer, `kind` null) -- covering (v 1) or
 // taking off (v 0) -- one undo step for a whole drag.
 function brush(kind, v, x, z, radius, group) {
  const box = [x - radius, x + radius, z - radius, z + radius];
  if (kind) r.layers.mask(kind, true);
  if (!group?.step) { const st = remember('paint', ...box); if (group) group.step = st; } else extendPaint(group.step, box);
  state.surfacesEdited = true;
  const masks = kind ? [r.layers.mask(kind)] : [...r.layers.masks.values()], [i0, i1, j0, j1] = cellBox(...box);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
   const px = r.x0 + (i + .5) * r.cell, pz = r.z0 + (j + .5) * r.cell;
   if (Math.hypot(px - x, pz - z) <= radius) for (const m of masks) m[j * r.nx + i] = v;
  }
  r.layers.recompose(i0, i1, j0, j1);
  return box;
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
