// A TRACE THE PLAYER DRAWS (the course builder, door 2's manual trace; the
// owner's amended goal, 31 October 2026, docs/COURSE_BUILDER.md *The amended
// goal*). Every cell of the land given a surface or ground type -- painted
// with a brush, filled by an outline, smoothed, tidied -- and the trees, placed
// one at a time or scattered over a zone. The auto trace (lidar/trace.js)
// starts this same model, so its result is corrected with the same tools.
// Pure (no DOM); tests/trace-edit.test.mjs.
//
// Codes: TRACE's eight first (rough .. path, the auto trace's own), then every
// other ground type grounds.js knows. Local metres as door 2 lays them: x east
// of the land's middle, z south of it; the grid is the land's.
import {TRACE, boxMean} from '../lidar/trace.js';
import {GROUND_KINDS} from '../grounds.js';

export const PALETTE = [...TRACE, ...GROUND_KINDS.filter(k => !TRACE.includes(k))];
export const CODE = Object.fromEntries(PALETTE.map((k, i) => [k, i]));
// Patches smaller than this are specks and holes smaller than this are pocks
// (PLACED: 4 m², a small pot bunker is about 10).
export const SPECK = 4;

export function createTrace(grid, {codes = null, trees = []} = {}) {
 const {nx, nz, cell, halfX, halfZ} = grid, N = nx * nz;
 const s = {codes: codes ? Uint8Array.from(codes) : new Uint8Array(N), trees: trees.map(t => ({...t})), undo: [], redo: [], stroke: null};
 const idx = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
 // Every change goes through `put`, which remembers each cell's first value
 // in the current step, so a whole drag undoes at once.
 const begin = () => { if (!s.stroke) s.stroke = {cells: new Map(), trees: null}; };
 const put = (k, c) => { if (s.codes[k] === c) return; if (!s.stroke.cells.has(k)) s.stroke.cells.set(k, s.codes[k]); s.codes[k] = c; };
 const keepTrees = () => { if (!s.stroke.trees) s.stroke.trees = s.trees.map(t => ({...t})); };
 const end = () => { if (s.stroke && (s.stroke.cells.size || s.stroke.trees)) { s.undo.push(s.stroke); s.redo.length = 0; } s.stroke = null; };
 const box = (x, z, r) => ({i0: Math.max(0, Math.floor((x - r + halfX) / cell)), i1: Math.min(nx - 1, Math.ceil((x + r + halfX) / cell)), j0: Math.max(0, Math.floor((z - r + halfZ) / cell)), j1: Math.min(nz - 1, Math.ceil((z + r + halfZ) / cell))});
 const kindCode = k => { const c = CODE[k]; if (c == null) throw Error(`No such surface: ${k}`); return c; };
 const step = fn => { const own = !s.stroke; begin(); fn(); if (own) end(); };

 const api = {
  grid, state: s, PALETTE,
  kindAt: (x, z) => { const k = idx(x, z); return k < 0 ? null : PALETTE[s.codes[k]]; },
  // A brush stroke is one undo step from `beginStroke` to `endStroke`; a
  // single call outside a stroke is its own.
  beginStroke: begin, endStroke: end,
  paint({x, z, radius, kind}) { const c = kindCode(kind), r2 = radius * radius, b = box(x, z, radius);
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) { const dx = -halfX + i * cell - x, dz = -halfZ + j * cell - z; if (dx * dx + dz * dz <= r2) put(j * nx + i, c); } }); },
  erase({x, z, radius}) { api.paint({x, z, radius, kind: 'rough'}); },
  // An outline (rings, even-odd) filled with a surface.
  fill(rings, kind) { const c = kindCode(kind);
   step(() => { const zs = rings.flat().map(p => p[1]), j0 = Math.max(0, Math.ceil((Math.min(...zs) + halfZ) / cell)), j1 = Math.min(nz - 1, Math.floor((Math.max(...zs) + halfZ) / cell));
    for (let j = j0; j <= j1; j++) { const z = -halfZ + j * cell, xs = [];
     for (const ring of rings) for (let q = 0, p = ring.length - 1; q < ring.length; p = q++) { const [ax, az] = ring[p], [bx, bz] = ring[q]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
     xs.sort((u, v) => u - v);
     for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] + halfX) / cell)); i <= Math.min(nx - 1, Math.floor((xs[q + 1] + halfX) / cell)); i++) put(j * nx + i, c); } }); },
  // SMOOTHING: each cell takes the surface most of its neighbourhood has
  // (radius in metres), over the whole land or a circle of it; edges round
  // off, specks and pocks under the radius go. `kind` limits it to that
  // surface's own edges (it grows or shrinks, nothing else moves).
  smooth({radius = 1.5, x = null, z = null, area = null, kind = null} = {}) {
   const r = Math.max(1, Math.round(radius / cell)), b = x == null ? {i0: 0, i1: nx - 1, j0: 0, j1: nz - 1} : box(x, z, area ?? radius * 4);
   const kinds = kind ? [kindCode(kind)] : [...new Set(s.codes)];
   const share = kinds.map(c => boxMean(Float32Array.from(s.codes, v => v === c ? 1 : 0), nx, nz, r));
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) {
    const k = j * nx + i;
    if (x != null && Math.hypot(-halfX + i * cell - x, -halfZ + j * cell - z) > (area ?? radius * 4)) continue;
    if (kind) { const c = kinds[0], f = share[0][k]; if (f > .5 && s.codes[k] !== c) put(k, c); else if (f < .5 && s.codes[k] === c) put(k, mostAround(k, c)); continue; }
    let best = s.codes[k], bf = -1; for (let q = 0; q < kinds.length; q++) if (share[q][k] > bf) { bf = share[q][k]; best = kinds[q]; }
    put(k, best);
   } });
  },
  // TIDY: every patch under `minArea` m² joins what surrounds it, and every
  // hole under it inside a surface is filled -- no specks, no pocks.
  tidy({minArea = SPECK} = {}) { step(() => tidyCodes(s.codes, nx, nz, cell, minArea, put)); },
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
  undo() { const st = s.undo.pop(); if (!st) return false; const back = {cells: new Map(), trees: st.trees ? s.trees : null};
   for (const [k, v] of st.cells) { back.cells.set(k, s.codes[k]); s.codes[k] = v; } if (st.trees) s.trees = st.trees; s.redo.push(back); return true; },
  redo() { const st = s.redo.pop(); if (!st) return false; const back = {cells: new Map(), trees: st.trees ? s.trees : null};
   for (const [k, v] of st.cells) { back.cells.set(k, s.codes[k]); s.codes[k] = v; } if (st.trees) s.trees = st.trees; s.undo.push(back); return true; },
 };
 // The surface most common round a cell other than `not` (for a shrinking edge).
 function mostAround(k, not) {
  const i = k % nx, j = (k - i) / nx, count = new Map();
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const c = s.codes[jj * nx + ii]; if (c !== not) count.set(c, (count.get(c) || 0) + 1); }
  let best = CODE.rough, n = -1; for (const [c, v] of count) if (v > n) { n = v; best = c; } return best;
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
export function tidyCodes(codes, nx, nz, cell, minArea = SPECK, put = (k, c) => { codes[k] = c; }) {
 const N = nx * nz, seen = new Uint8Array(N), minCells = Math.max(1, Math.round(minArea / (cell * cell))), list = [];
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
   if (list.length >= minCells || !border.size) continue;
   let best = c, n = -1; for (const [b, v] of border) if (v > n) { n = v; best = b; }
   for (const k of list) put(k, best);
  }
 }
}
