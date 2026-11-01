// SURFACES IN LAYERS (the owner, 1 November 2026: "the concept of layers so
// things can be easily painted in the trace step ... exposed in the editor as
// well in real time"; docs/COURSE_BUILDER.md *The amended goal*).
//
// Each surface or ground type is its own layer, a mask over the grid; a cell
// shows the topmost layer that covers it. Painting a layer changes that layer
// only -- a fairway painted through a bunker leaves the bunker, and the
// fairway runs on unbroken under it. The order is the game's own: a built
// course's field is read water, sand, green, tee, path, fairway, semi, then a
// ground type (built-world.js), so overlapping outlines in a course file
// resolve exactly as the layers show them. Hiding a layer hides it from the
// view only; a course is made from every layer.
//
// Pure (no DOM); used by the trace step (trace-edit.js) and the editor
// (editing.js); tests/layers.test.mjs.
import {GROUND_KINDS} from '../grounds.js';

// Top first.
export const LAYER_ORDER = ['water', 'sand', 'green', 'tee', 'path', 'fairway', 'semi', ...GROUND_KINDS.filter(k => k !== 'path')];

// `palette`: the composite's code for each kind (index; 'rough' is 0).
export function createLayers(nx, nz, palette) {
 const N = nx * nz, code = Object.fromEntries(palette.map((k, i) => [k, i]));
 for (const k of LAYER_ORDER) if (code[k] == null) throw Error(`The palette has no ${k}.`);
 const L = {
  nx, nz, palette, masks: new Map(), hidden: new Set(),
  codes: new Uint8Array(N),   // every layer: what the course will be
  view: new Uint8Array(N),    // the visible layers: what is shown
  // A layer's mask (made empty when first asked for with `make`).
  mask(kind, make = false) { if (!L.masks.has(kind) && make) { if (!LAYER_ORDER.includes(kind)) throw Error(`No layer called ${kind}.`); L.masks.set(kind, new Uint8Array(N)); } return L.masks.get(kind) ?? null; },
  // The layers that hold anything, top first.
  present: () => LAYER_ORDER.filter(k => L.masks.get(k)?.some(v => v)),
  kindAt: k => palette[L.codes[k]],
  // Recomputes the composites over a box of cells (inclusive), or the grid.
  recompose(i0 = 0, i1 = nx - 1, j0 = 0, j1 = nz - 1) {
   const order = LAYER_ORDER.filter(k => L.masks.has(k)).map(k => [L.masks.get(k), code[k], L.hidden.has(k)]);
   i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(nx - 1, i1); j1 = Math.min(nz - 1, j1);
   for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * nx + i; let all = 0, seen = 0, gotAll = false;
    for (const [m, c, hid] of order) if (m[k]) { if (!gotAll) { all = c; gotAll = true; } if (!hid) { seen = c; break; } }
    L.codes[k] = all; L.view[k] = seen;
   }
  },
  setHidden(kind, hide) { if (hide) L.hidden.add(kind); else L.hidden.delete(kind); L.recompose(); },
  // Layers from a composite (each code to its layer), replacing what is there.
  fromCodes(codes) { L.masks.clear(); for (let k = 0; k < N; k++) { const kind = palette[codes[k]]; if (kind !== 'rough') L.mask(kind, true)[k] = 1; } L.recompose(); return L; },
 };
 return L;
}

// A layer's mask tidied: patches of it under `speck` cells removed and holes
// in it under `pock` cells filled. `put(k, v)` writes (and may remember).
export function tidyMask(mask, nx, nz, speck, pock, put = (k, v) => { mask[k] = v; }) {
 const N = nx * nz, seen = new Uint8Array(N), list = [];
 for (let s = 0; s < N; s++) {
  if (seen[s]) continue;
  const on = mask[s]; list.length = 0; list.push(s); seen[s] = 1; let edge = false;
  for (let q = 0; q < list.length; q++) {
   const k = list[q], i = k % nx; if (i === 0 || i === nx - 1 || k < nx || k >= N - nx) edge = true;
   for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !seen[n] && mask[n] === on) { seen[n] = 1; list.push(n); }
  }
  if (on && list.length < speck) for (const k of list) put(k, 0);
  else if (!on && !edge && list.length < pock) for (const k of list) put(k, 1);
 }
}
