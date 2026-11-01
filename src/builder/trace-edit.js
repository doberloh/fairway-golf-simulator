// A TRACE THE PLAYER DRAWS (the course builder, door 2's manual trace; the
// owner's amended goal, 31 October 2026, docs/COURSE_BUILDER.md *The amended
// goal*). Every surface or ground type in its own layer over the land --
// painted with a brush, filled by an outline, smoothed, tidied -- and the trees, placed
// one at a time or scattered over a zone. The auto trace (lidar/trace.js)
// starts this same model, so its result is corrected with the same tools.
// Pure (no DOM); tests/trace-edit.test.mjs.
//
// Codes: TRACE's eight first (rough .. path, the auto trace's own), then every
// other ground type grounds.js knows. Local metres as door 2 lays them: x east
// of the land's middle, z south of it; the grid is the land's.
import {TRACE, boxMean} from '../lidar/trace.js';
import {GROUND_KINDS} from '../grounds.js';
import {createLayers, tidyMask, LAYER_ORDER} from './layers.js';

export const PALETTE = [...TRACE, ...GROUND_KINDS.filter(k => !TRACE.includes(k))];
export const CODE = Object.fromEntries(PALETTE.map((k, i) => [k, i]));
// Patches smaller than this are specks and holes smaller than this are pocks
// (PLACED: 10 m², the smallest pot bunker; at 4 m² the imagery iterations
// still left specks and pocks the owner had asked to be rid of).
export const SPECK = 10;
// A hole of rough inside one surface under this is a pock, and filled
// (PLACED: 30 m²; the imagery iterations' fairways were moth-eaten with them).
// Only rough: a pot bunker inside a fairway is a feature, not a pock.
export const POCK = 30;

// The trace is in LAYERS (layers.js; the owner, 1 November 2026): each
// surface its own mask, the topmost shown. A brush, an outline, smoothing and
// tidying work on one layer (`kind`), or -- Erase, Smooth all, Tidy with no
// kind -- on every layer. `state.codes` is what the course will be made of,
// `state.layers.view` what is shown (hidden layers left out).
export function createTrace(grid, {codes = null, trees = []} = {}) {
 const {nx, nz, cell, halfX, halfZ} = grid, N = nx * nz;
 const layers = createLayers(nx, nz, PALETTE);
 if (codes) layers.fromCodes(codes);
 const s = {layers, codes: layers.codes, trees: trees.map(t => ({...t})), undo: [], redo: [], stroke: null};
 const idx = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
 // Every change goes through `put`, which remembers each layer cell's first
 // value in the current step (so a whole drag undoes at once) and the box the
 // composites must be redone over.
 const LI = Object.fromEntries(LAYER_ORDER.map((k, i) => [k, i]));
 const begin = () => { if (!s.stroke) s.stroke = {cells: new Map(), trees: null, box: [nx, -1, nz, -1]}; };
 const put = (kind, k, v) => {
  const m = layers.mask(kind, v === 1); if (!m || m[k] === v) return;
  const key = k * 32 + LI[kind]; if (!s.stroke.cells.has(key)) s.stroke.cells.set(key, m[k]);
  m[k] = v; const i = k % nx, j = (k - i) / nx, bx = s.stroke.box;
  if (i < bx[0]) bx[0] = i; if (i > bx[1]) bx[1] = i; if (j < bx[2]) bx[2] = j; if (j > bx[3]) bx[3] = j;
 };
 const keepTrees = () => { if (!s.stroke.trees) s.stroke.trees = s.trees.map(t => ({...t})); };
 const settle = () => { const bx = s.stroke?.box; if (bx && bx[1] >= 0) layers.recompose(bx[0], bx[1], bx[2], bx[3]); };
 const end = () => { settle(); if (s.stroke && (s.stroke.cells.size || s.stroke.trees)) { s.undo.push(s.stroke); s.redo.length = 0; } s.stroke = null; };
 const box = (x, z, r) => ({i0: Math.max(0, Math.floor((x - r + halfX) / cell)), i1: Math.min(nx - 1, Math.ceil((x + r + halfX) / cell)), j0: Math.max(0, Math.floor((z - r + halfZ) / cell)), j1: Math.min(nz - 1, Math.ceil((z + r + halfZ) / cell))});
 const layerOf = k => { if (k == null || k === 'rough') return null; if (CODE[k] == null || !LAYER_ORDER.includes(k)) throw Error(`No such surface: ${k}`); return k; };
 const step = fn => { const own = !s.stroke; begin(); fn(); if (own) end(); else settle(); };
 const every = () => [...layers.masks.keys()];

 const api = {
  grid, state: s, PALETTE,
  kindAt: (x, z) => { const k = idx(x, z); return k < 0 ? null : PALETTE[layers.codes[k]]; },
  layersPresent: () => layers.present(),
  setHidden(kind, hide) { layers.setHidden(kind, hide); },
  // A brush stroke is one undo step from `beginStroke` to `endStroke`; a
  // single call outside a stroke is its own.
  beginStroke: begin, endStroke: end,
  // Paints a disc onto `kind`'s layer ('rough' takes every layer off there).
  paint({x, z, radius, kind}) {
   if (kind === 'rough') return api.erase({x, z, radius});
   const L = layerOf(kind), r2 = radius * radius, b = box(x, z, radius);
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) { const dx = -halfX + i * cell - x, dz = -halfZ + j * cell - z; if (dx * dx + dz * dz <= r2) put(L, j * nx + i, 1); } });
  },
  // Takes a disc off one layer, or off every layer.
  erase({x, z, radius, kind = null}) {
   const kinds = kind ? [layerOf(kind)] : every(), r2 = radius * radius, b = box(x, z, radius);
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) { const dx = -halfX + i * cell - x, dz = -halfZ + j * cell - z; if (dx * dx + dz * dz <= r2) for (const L of kinds) put(L, j * nx + i, 0); } });
  },
  // An outline (rings, even-odd) filled onto a layer ('rough' clears every one).
  fill(rings, kind) {
   const L = kind === 'rough' ? null : layerOf(kind);
   step(() => { const zs = rings.flat().map(p => p[1]), j0 = Math.max(0, Math.ceil((Math.min(...zs) + halfZ) / cell)), j1 = Math.min(nz - 1, Math.floor((Math.max(...zs) + halfZ) / cell));
    for (let j = j0; j <= j1; j++) { const z = -halfZ + j * cell, xs = [];
     for (const ring of rings) for (let q = 0, p = ring.length - 1; q < ring.length; p = q++) { const [ax, az] = ring[p], [bx, bz] = ring[q]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
     xs.sort((u, v) => u - v);
     for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] + halfX) / cell)); i <= Math.min(nx - 1, Math.floor((xs[q + 1] + halfX) / cell)); i++) { if (L) put(L, j * nx + i, 1); else for (const K of every()) put(K, j * nx + i, 0); } } });
  },
  // SMOOTHING: a layer's edge takes the majority of its neighbourhood (radius
  // in metres), over the land or a circle of it; specks and pocks under the
  // radius go. With no `kind`, every layer is smoothed.
  smooth({radius = 1.5, x = null, z = null, area = null, kind = null} = {}) {
   const r = Math.max(1, Math.round(radius / cell)), reach = area ?? radius * 4, b = x == null ? {i0: 0, i1: nx - 1, j0: 0, j1: nz - 1} : box(x, z, reach);
   const kinds = kind ? [layerOf(kind)] : every();
   step(() => { for (const L of kinds) {
    const m = layers.mask(L); if (!m) continue;
    const share = boxMean(Float32Array.from(m), nx, nz, r);
    for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) {
     if (x != null && Math.hypot(-halfX + i * cell - x, -halfZ + j * cell - z) > reach) continue;
     const k = j * nx + i, v = share[k] > .5 ? 1 : share[k] < .5 ? 0 : m[k]; if (v !== m[k]) put(L, k, v);
    }
   } });
  },
  // TIDY: on each layer (or `kind`'s), patches under `minArea` m² go and
  // holes under POCK m² fill -- no specks, no pocks.
  tidy({minArea = SPECK, kind = null} = {}) {
   const kinds = kind ? [layerOf(kind)] : every();
   step(() => { for (const L of kinds) { const m = layers.mask(L); if (m) tidyMask(m, nx, nz, Math.round(minArea / (cell * cell)), Math.round(POCK / (cell * cell)), (k, v) => put(L, k, v)); } });
  },
  // TREES: one, or a zone scattered at a density (trees a hectare), each a
  // height and crown from the given ranges, never on mown ground or water.
  addTree(t) { step(() => { keepTrees(); s.trees.push({x: t.x, z: t.z, h: t.h ?? 14, crown: t.crown ?? 4}); }); },
  removeTrees({x, z, radius}) { step(() => { keepTrees(); s.trees = s.trees.filter(t => Math.hypot(t.x - x, t.z - z) > radius); }); },
  treeZone(ring, {density = 120, height = [10, 22], crown = [2.5, 5], seed = 1} = {}) {
   let q = seed >>> 0 || 1; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
   const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), spacing = Math.sqrt(1e4 / density);
   step(() => { keepTrees();
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += spacing) for (let x = Math.min(...xs); x <= Math.max(...xs); x += spacing) {
     const px = x + (rnd() - .5) * spacing * .9, pz = z + (rnd() - .5) * spacing * .9;
     if (!inside(ring, px, pz)) continue;
     const here = api.kindAt(px, pz); if (!here || !OPEN.has(here)) continue;
     s.trees.push({x: px, z: pz, h: height[0] + rnd() * (height[1] - height[0]), crown: crown[0] + rnd() * (crown[1] - crown[0])});
    } });
  },
  undo() { return swapStep(s.undo, s.redo); },
  redo() { return swapStep(s.redo, s.undo); },
 };
 // Undo and redo are one act: a step's remembered values swapped with the present.
 function swapStep(from, to) {
  const st = from.pop(); if (!st) return false;
  const back = {cells: new Map(), trees: st.trees ? s.trees : null, box: st.box};
  for (const [key, v] of st.cells) { const L = LAYER_ORDER[key % 32], k = Math.floor(key / 32), m = layers.mask(L, true); back.cells.set(key, m[k]); m[k] = v; }
  if (st.trees) s.trees = st.trees;
  if (st.box[1] >= 0) layers.recompose(st.box[0], st.box[1], st.box[2], st.box[3]);
  to.push(back); return true;
 }
 return api;
}
// Where a tree may stand: rough and the wild ground types, not mown turf,
// sand, water or path.
const OPEN = new Set(PALETTE.filter(k => !['fairway', 'tee', 'green', 'sand', 'water', 'path'].includes(k)));
const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// Specks merged into their surroundings and pocks filled, in place (`put(k,
// code)` writes; the default writes straight into `codes`). Exported for the
// auto trace and for making a course, which tidy the same way.
export function tidyCodes(codes, nx, nz, cell, minArea = SPECK, put = (k, c) => { codes[k] = c; }, pockArea = POCK) {
 const N = nx * nz, seen = new Uint8Array(N), minCells = Math.max(1, Math.round(minArea / (cell * cell))), pockCells = Math.round(pockArea / (cell * cell)), list = [];
 for (let pass = 0; pass < 2; pass++) {
  seen.fill(0);
  for (let s0 = 0; s0 < N; s0++) {
   if (seen[s0]) continue;
   const c = codes[s0]; list.length = 0; list.push(s0); seen[s0] = 1;
   const border = new Map();
   for (let q = 0; q < list.length; q++) {
    const k = list[q], i = k % nx;
    for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k + nx < N ? k + nx : -1]) {
     if (n < 0) continue;
     if (codes[n] !== c) { border.set(codes[n], (border.get(codes[n]) || 0) + 1); continue; }
     if (!seen[n]) { seen[n] = 1; list.push(n); }
    }
   }
   const pock = c === 0 && border.size === 1 && list.length < pockCells && !list.some(k => { const i = k % nx; return i === 0 || i === nx - 1 || k < nx || k >= N - nx; });
   if ((list.length >= minCells && !pock) || !border.size) continue;
   let best = c, n = -1; for (const [b, v] of border) if (v > n) { n = v; best = b; }
   for (const k of list) put(k, best);
  }
 }
}
