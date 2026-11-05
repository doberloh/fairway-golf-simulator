// A POND'S BED (the owner, 4 November 2026: "water doesn't look like it draws
// in game after its been painted into a course. Do we need to 'dig out' where
// water is painted to properly set the water line?"). Yes. The water is one
// flat sheet at its level, and the land is whatever it was: a pond drawn in
// the editor set its level just under its lowest bank and left the ground
// alone, so all of it but that lowest bank stood ABOVE the water, and the
// sheet lay hidden under the turf. Door 2 dug its own, but only a flat metre
// down inside the edge, with a wall all round it and the sheet hanging in the
// air wherever the shore was lower than the level.
//
// So one routine, used by both, does the whole job on the land's grid:
//   inside the outline  the ground goes down to a bed under the level: a
//                       shallow shelf at the edge (a ball's splash, a bank to
//                       see), falling to DEEP over RAMP metres;
//   on the high shore   the ground may rise from the water no steeper than a
//                       bank, so a pond dug in a hillside has a bank, not a wall;
//   on the low shore    the ground may fall from the water no steeper than a
//                       bank, so the sheet never hangs in the air.
// Each is a limit, not a shape: ground already inside it stays as it was, so a
// body already deep keeps its bed, and running this twice changes nothing --
// which matters, as every Save runs it. An island in the outline is land, and
// `keep` names ground that stays whatever the water wants (a green or a tee
// beside the pond). Pure; tests/water-bed.test.mjs.
import {distanceFrom} from '../lidar/trace.js';

// All PLACED, from a golf pond's section: shallow at the bank, a little over a
// metre deep soon after. The banks 1 in 2. The high side is graded up to 30 m
// back, until the bank meets the hill (at 8 m the first try left a 6 m cliff
// behind a pond on a 1 in 5 hillside); the low side only 8 m, or a pond on a
// slope would stand behind a long dam.
export const BED = {shelf: .35, deep: 1.3, ramp: 5, reach: 30, low: 8, slope: .5, freeboard: .1, drop: .15};

// A body's level from its shore's heights: `drop` under its lowest tenth (one
// low notch in a bank does not sink the whole pond).
export function levelFrom(shore, drop = BED.drop) {
 const s = [...shore].sort((a, b) => a - b);
 return s[Math.floor(s.length * .1)] - drop;
}
export const shoreOf = (rings, height) => rings[0].map(([x, z]) => height(x, z));

// Digs one body into a grid {heights, nx, nz, cell, cellZ?, x0, z0} (the
// land's, or a patch's), in place. Returns the box changed [x0, x1, z0, z1] in
// metres, or null when the grid does not reach it.
export function digBed(grid, rings, level, {reach: far = BED.reach, keep = null} = {}) {
 const {nx, nz, cell, x0, z0, heights: h} = grid, cz = grid.cellZ ?? cell, d = Math.min(cell, cz), outer = rings[0];
 let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
 for (const [x, z] of outer) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z; }
 const reach = far + 2 * Math.max(cell, cz);
 const i0 = Math.max(0, Math.floor((bx0 - reach - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((bx1 + reach - x0) / cell));
 const j0 = Math.max(0, Math.floor((bz0 - reach - z0) / cz)), j1 = Math.min(nz - 1, Math.ceil((bz1 + reach - z0) / cz));
 if (i1 < i0 || j1 < j0) return null;
 const w = i1 - i0 + 1, n = j1 - j0 + 1, wet = new Uint8Array(w * n), dry = new Uint8Array(w * n).fill(1);
 // Row by row (even-odd over the rings, so an island is land): a big lake's
 // outline has thousands of points and its box millions of samples.
 for (let j = 0; j < n; j++) {
  const z = z0 + (j0 + j) * cz, xs = [];
  for (const ring of rings) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) { const [px, pz] = ring[b], [qx, qz] = ring[a]; if ((pz > z) !== (qz > z)) xs.push(px + (z - pz) / (qz - pz) * (qx - px)); }
  xs.sort((p, q) => p - q);
  for (let q = 0; q + 1 < xs.length; q += 2) {
   const a = Math.max(0, Math.ceil((xs[q] - x0) / cell) - i0), b = Math.min(w - 1, Math.floor((xs[q + 1] - x0) / cell) - i0);
   if (b >= a) { wet.fill(1, j * w + a, j * w + b + 1); dry.fill(0, j * w + a, j * w + b + 1); }
  }
 }
 const toWater = distanceFrom(wet, w, n, d), toShore = distanceFrom(dry, w, n, d);
 for (let j = 0; j < n; j++) for (let i = 0; i < w; i++) {
  const k = j * w + i, at = (j0 + j) * nx + i0 + i;
  if (wet[k]) {
   // Inside: never above the bed; a bed already deeper stays.
   const t = Math.min(1, toShore[k] / BED.ramp), bed = level - BED.shelf - (BED.deep - BED.shelf) * t * t * (3 - 2 * t);
   if (h[at] > bed) h[at] = bed;
  } else if (toWater[k] < far) {
   // The shore: held between a bank up from the water and a bank down from it.
   if (keep?.(x0 + (i0 + i) * cell, z0 + (j0 + j) * cz)) continue;
   const edge = level + BED.freeboard, rise = BED.slope * toWater[k];
   if (h[at] > edge + rise) h[at] = edge + rise; else if (h[at] < edge - rise && toWater[k] < BED.low) h[at] = edge - rise;
  }
 }
 return [x0 + i0 * cell, x0 + i1 * cell, z0 + j0 * cz, z0 + j1 * cz];
}
