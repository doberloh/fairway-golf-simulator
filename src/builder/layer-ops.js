// WHAT BOTH EDITORS DO TO A LAYER (the owner, 4 November 2026: "we need to bring
// parity between the 2d and 3d editor"). The 2D trace (trace-edit.js) and the 3D
// editor (editing.js) hold their masks on different grids and remember undo in
// different ways, so each passes its own `put(k, v)`; the rule itself lives once,
// here, so the two cannot drift apart. Pure; tests/builder-parity.test.mjs.
import {boxMean, distanceFrom} from '../lidar/trace.js';

// SMOOTHING: a layer's edge takes the majority of its neighbourhood, over cells
// [i0, i1] x [j0, j1] where `within(i, j)`. Worked on a crop of the mask, so a
// brush dab on a big course reads only what it can reach.
export function smoothCells(mask, {nx, nz}, r, {i0, i1, j0, j1}, within, put) {
 const a0 = Math.max(0, i0 - r), a1 = Math.min(nx - 1, i1 + r), b0 = Math.max(0, j0 - r), b1 = Math.min(nz - 1, j1 + r), w = a1 - a0 + 1, h = b1 - b0 + 1;
 const crop = new Float32Array(w * h);
 for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) crop[j * w + i] = mask[(j + b0) * nx + i + a0];
 const share = boxMean(crop, w, h, r);
 for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
  if (!within(i, j)) continue;
  const k = j * nx + i, v = share[(j - b0) * w + i - a0], now = v > .5 ? 1 : v < .5 ? 0 : mask[k];
  if (now !== mask[k]) put(k, now);
 }
}

// EXTRAPOLATE: `width` metres round layer `from`. A layer below it runs on
// unbroken beneath it (`under`); one above takes only the band round it, so
// `from` still shows.
export function extrapolateCells(from, {nx, nz, cell}, width, under, put) {
 const d = distanceFrom(from, nx, nz, cell);
 for (let k = 0; k < d.length; k++) if (d[k] <= width && (under || !from[k])) put(k, 1);
}

// Where a selected shape's anchors stand: the corners of its box, a little
// outside it (PLACED: 2.5 m, or a tenth of its size), in either editor.
// WHICH ANCHOR A PRESS TAKES, in both editors: `corners` on the screen, the
// press at (x, y), `reach` in the same units. The nearest within reach, but never
// one the press is farther from than from the shape's middle: seen from afar a
// bunker is ten pixels across, all four anchors lie within reach of its centre,
// and a press there only ever turned it (the smoke's builder-tools, 5 November
// 2026). -1: not an anchor, so a press inside the outline moves it.
export function anchorHit(corners, x, y, reach) {
 const mx = corners.reduce((s, c) => s + c[0], 0) / corners.length, my = corners.reduce((s, c) => s + c[1], 0) / corners.length, toMiddle = Math.hypot(x - mx, y - my);
 let best = -1, near = reach;
 corners.forEach(([cx, cy], k) => { const d = Math.hypot(x - cx, y - cy); if (d <= near && d < toMiddle) { near = d; best = k; } });
 return best;
}
export function cornersOf(ring) {
 let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
 for (const [x, z] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
 const pad = Math.max(2.5, Math.max(x1 - x0, z1 - z0) * .1);
 return [[x0 - pad, z0 - pad], [x1 + pad, z0 - pad], [x1 + pad, z1 + pad], [x0 - pad, z1 + pad]];
}

const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// A seeded draw, so a zone is the same if it is drawn again.
export const seededDraw = seed => { let q = seed >>> 0 || 1; return () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648; };

// A TREE ZONE: trees in a ring at `density` a hectare, jittered off a grid, each
// on ground `open` says it may stand on. [{x, z, h, crown}].
export function zoneTrees(ring, {density = 120, height = [10, 22], crown = [2.5, 5], seed = 1, open}) {
 const rnd = seededDraw(seed), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), spacing = Math.sqrt(1e4 / density), out = [];
 for (let z = Math.min(...zs); z <= Math.max(...zs); z += spacing) for (let x = Math.min(...xs); x <= Math.max(...xs); x += spacing) {
  const px = x + (rnd() - .5) * spacing * .9, pz = z + (rnd() - .5) * spacing * .9;
  if (!inside(ring, px, pz) || !open(px, pz)) continue;
  out.push({x: px, z: pz, h: height[0] + rnd() * (height[1] - height[0]), crown: crown[0] + rnd() * (crown[1] - crown[0])});
 }
 return out;
}

// A HOUSE ZONE: a ring lined with houses `spacing` metres apart. `place(h)`
// says whether one stood there, and stands it.
export function zoneHomes(ring, {spacing = 42, seed = 1, place}) {
 const rnd = seededDraw(seed), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]); let n = 0;
 for (let z = Math.min(...zs) + spacing / 2; z <= Math.max(...zs); z += spacing) for (let x = Math.min(...xs) + spacing / 2; x <= Math.max(...xs); x += spacing) {
  const h = {x: x + (rnd() - .5) * spacing * .3, z: z + (rnd() - .5) * spacing * .3, width: 16 + rnd() * 9, depth: 13 + rnd() * 6};
  if (inside(ring, h.x, h.z) && place(h)) n++;
 }
 return n;
}
