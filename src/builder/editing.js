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
import {maskRings, simplify} from '../contour.js';
import {GRID_MARGIN, landSampler, polygonDistance} from '../built-world.js';
import {TREE_STRIDE} from '../course-doc.js';

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
// Every cell centre inside `poly` (rings, even-odd), by scanline.
function fill(r, poly, code) {
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
   r.codes.fill(code, j * r.nx + i0, j * r.nx + i1 + 1);
  }
 }
}

// A copy of a document an editor can change. `doc` is a validated built
// document (course-doc.js); it is not changed.
export function createEditor(doc) {
 const ex = doc.halfX + GRID_MARGIN, ez = doc.halfZ + GRID_MARGIN;
 const r = {...rasterSize(ex, ez)};
 r.codes = new Uint8Array(r.nx * r.nz);
 for (const kind of PAINT) {
  if (kind === 'rough') continue;
  const polys = kind === 'water' ? (doc.water || []).map(w => w.rings) : doc.surfaces?.[kind] || [];
  for (const poly of polys) fill(r, poly, CODE[kind]);
 }
 const copyGrid = g => ({...g, heights: Float32Array.from(g.heights)});
 const land = copyGrid(doc.land), patches = (doc.patches || []).map(copyGrid);
 const original = {land: Float32Array.from(doc.land.heights), patches: patches.map(p => Float32Array.from(p.heights))};
 const state = {
  doc, raster: r, land, patches, ex, ez,
  holes: structuredClone(doc.holes), water: structuredClone(doc.water || []),
  trees: Array.from({length: doc.trees.length / TREE_STRIDE}, (_, i) => Array.from(doc.trees.subarray(i * TREE_STRIDE, (i + 1) * TREE_STRIDE))),
  landscape: doc.landscape, name: doc.name,
  surfacesEdited: false, changed: false, undo: [], redo: [],
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
   const [i0, i1, j0, j1] = cellBox(x0, x1, z0, z1), rows = [];
   for (let j = j0; j <= j1; j++) rows.push(r.codes.slice(j * r.nx + i0, j * r.nx + i1 + 1));
   step.cells = {i0, i1, j0, j1, rows}; step.surfacesEdited = state.surfacesEdited;
  } else step.snapshot = structuredClone({holes: state.holes, water: state.water, trees: state.trees, landscape: state.landscape});
  state.undo.push(step); state.redo.length = 0;
  if (state.undo.length > 200) state.undo.shift();
  state.changed = true;
  return step;
 };
 const cellBox = (x0, x1, z0, z1) => [Math.max(0, Math.floor((x0 - r.x0) / r.cell)), Math.min(r.nx - 1, Math.ceil((x1 - r.x0) / r.cell)),
  Math.max(0, Math.floor((z0 - r.z0) / r.cell)), Math.min(r.nz - 1, Math.ceil((z1 - r.z0) / r.cell))];
 // Swaps a step's stored state with the present (undo and redo are the same act).
 const swap = step => {
  if (step.parts) { for (const p of step.parts) p.rows = p.rows.map((row, k) => { const at = (p.j0 + k) * p.g.nx + p.i0, now = p.g.heights.slice(at, at + row.length); p.g.heights.set(row, at); return now; }); resample(); }
  if (step.cells) { const c = step.cells; c.rows = c.rows.map((row, k) => { const at = (c.j0 + k) * r.nx + c.i0, now = r.codes.slice(at, at + row.length); r.codes.set(row, at); return now; }); const was = state.surfacesEdited; state.surfacesEdited = step.surfacesEdited; step.surfacesEdited = was; }
  if (step.snapshot) { const now = structuredClone({holes: state.holes, water: state.water, trees: state.trees, landscape: state.landscape}); Object.assign(state, step.snapshot); step.snapshot = now; }
  return step;
 };

 const api = {
  state,
  height: (x, z) => sample(x, z),
  codeAt(x, z) { const i = Math.floor((x - r.x0) / r.cell), j = Math.floor((z - r.z0) / r.cell); return i < 0 || j < 0 || i >= r.nx || j >= r.nz ? 0 : r.codes[j * r.nx + i]; },
  surfaceAt(x, z) { return PAINT[api.codeAt(x, z)]; },

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
  paint({kind, x, z, radius = 3, group = null}) {
   const code = CODE[kind]; if (code === undefined) throw Error(`No surface called ${kind}.`);
   const box = [x - radius, x + radius, z - radius, z + radius];
   if (!group?.step) { const st = remember('paint', ...box); if (group) group.step = st; } else extendPaint(group.step, box);
   state.surfacesEdited = true;
   const [i0, i1, j0, j1] = cellBox(...box);
   for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = r.x0 + (i + .5) * r.cell, pz = r.z0 + (j + .5) * r.cell;
    if (Math.hypot(px - x, pz - z) <= radius) r.codes[j * r.nx + i] = code;
   }
   return box;
  },
  fillOutline({kind, ring}) {
   const code = CODE[kind]; if (code === undefined || ring.length < 3) throw Error('An outline needs a surface and three points.');
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), box = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
   remember('paint', ...box); state.surfacesEdited = true;
   fill(r, [ring], code);
   return box;
  },

  // ---- holes, water, trees: records, each change one undo step.
  editHoles(f) { remember('records', 0, 0, 0, 0); f(state.holes); },
  setTee(hole, set, x, z) { api.editHoles(hs => { const h = hs[hole], t = h.tees.find(q => q.set === set); if (t) Object.assign(t, {x, z}); else h.tees.push({x, z, set}); h.line[0] = [h.tees[0].x, h.tees[0].z]; }); },
  setGreen(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.green = {x, z}; h.line[h.line.length - 1] = [x, z]; }); },
  addBend(hole, x, z) { api.editHoles(hs => { const h = hs[hole]; h.line.splice(h.line.length - 1, 0, [x, z]); }); },
  setPar(hole, par) { api.editHoles(hs => { hs[hole].par = par; }); },
  addTree(tree) { remember('records', 0, 0, 0, 0); state.trees.push(tree); },
  // Removes trees within `radius`, or every `keep`-th one is kept (thinning).
  removeTrees({x, z, radius, keep = 0}) {
   remember('records', 0, 0, 0, 0);
   let n = 0;
   state.trees = state.trees.filter(t => { const inside = Math.hypot(t[0] - x, t[1] - z) <= radius; if (!inside) return true; n++; return keep > 0 && n % keep === 0; });
  },
  addPond({ring, level = null}) {
   remember('records', 0, 0, 0, 0);
   const lv = level ?? Math.min(...ring.map(([x, z]) => sample(x, z))) - .3;
   state.water.push({rings: [ring], level: lv, kind: 'pond'});
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
   const st = remember('paint', Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)); state.undo.pop(); state.undo.at(-1).cells = st.cells; state.undo.at(-1).surfacesEdited = state.surfacesEdited; state.undo.at(-1).box = st.box;
   state.surfacesEdited = true; fill(r, [ring], CODE.water);
   return lv;
  },
  setLandscape(key) { remember('records', 0, 0, 0, 0); state.landscape = key; },

  undo() { const s = state.undo.pop(); if (!s) return null; state.redo.push(swap(s)); return s; },
  redo() { const s = state.redo.pop(); if (!s) return null; state.undo.push(swap(s)); return s; },

  // ---- back to a document: the outlines traced from the grid (only when a
  // surface was painted), the water bodies matched to their levels.
  toDoc({onStep = () => {}} = {}) {
   let surfaces = doc.surfaces, water = state.water;
   if (state.surfacesEdited) {
    surfaces = Object.fromEntries(Object.keys(doc.surfaces).map(k => [k, []]));
    // Each code's box first, so a code is traced over where it is, not the course.
    const box = PAINT.map(() => [Infinity, -1, Infinity, -1]);
    for (let j = 0; j < r.nz; j++) for (let i = 0; i < r.nx; i++) { const b = box[r.codes[j * r.nx + i]]; if (i < b[0]) b[0] = i; if (i > b[1]) b[1] = i; if (j < b[2]) b[2] = j; if (j > b[3]) b[3] = j; }
    const traced = {};
    PAINT.forEach((kind, code) => {
     if (kind === 'rough' || box[code][1] < 0) return;
     onStep(`Tracing the ${kind}`, code / PAINT.length);
     const [i0, i1, j0, j1] = box[code], w = i1 - i0 + 1, h = j1 - j0 + 1;
     const rings = maskRings((i, j) => r.codes[(j + j0) * r.nx + i + i0] === code, w, h, r.x0 + (i0 + .5) * r.cell, r.z0 + (j0 + .5) * r.cell, r.cell)
      .map(ring => simplify(ring, r.cell * .35).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])).filter(ring => ring.length >= 3);
     traced[kind] = rings;
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
   const trees = new Float32Array(state.trees.length * TREE_STRIDE);
   state.trees.forEach((t, i) => trees.set(t, i * TREE_STRIDE));
   return {...doc, name: state.name, landscape: state.landscape, land: {...land, heights: Float32Array.from(land.heights)}, patches: patches.map(p => ({...p, heights: Float32Array.from(p.heights)})),
    surfaces, water, holes: structuredClone(state.holes), trees};
  },
 };
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
  q.rows.forEach((row, k) => p.rows[q.j0 + k - p.j0].set(row, q.i0 - p.i0));
  step.cells = p; step.box = nb;
 }
 return api;
}
