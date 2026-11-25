// A test fixture: layers drawn as masks of cells, the way a draft saved
// before 24 November 2026 held them (and as tests draw shapes cell by cell
// before turning them into outlines once). The builder itself keeps no cells
// (src/builder/shapes.js); this is the tests' own stand-in for the old
// layers.js `createLayers`.
import {LAYER_ORDER} from '../../src/builder/layers.js';
import {PALETTE} from '../../src/builder/trace-edit.js';

export function cellLayers(nx, nz) {
 const masks = new Map();
 return {
  masks,
  mask(kind) { if (!masks.has(kind)) masks.set(kind, new Uint8Array(nx * nz)); return masks.get(kind); },
  recompose() {},
  // Each cell's topmost layer, as palette codes.
  get codes() { const c = new Uint8Array(nx * nz); for (const k of [...LAYER_ORDER].reverse()) { const m = masks.get(k); if (m) for (let i = 0; i < c.length; i++) if (m[i]) c[i] = PALETTE.indexOf(k); } return c; },
 };
}
