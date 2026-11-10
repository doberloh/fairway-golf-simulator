// THE BUILT COURSE'S FIELD (moved out of built-world.js on 9 November 2026,
// the frame-rate goal, so the bake can run on other cores -- bake-pool.js,
// bake-worker.js -- without bringing the rest of the world with it; the
// arithmetic is unchanged and built-world.js re-exports every name).
import {GROUND_KINDS} from './grounds.js';

export const BUILT_FIELD = {range: 6, maxSide: 2048, minCell: .5};
// THE TWO TEXTURES. The first holds four turf channels (R sand, G green, B
// fairway, A tee); the second water (R), semi-rough (G), and the ground types
// as ONE layer: B the type's code (BUILT_GROUND_CODE: ground.js's own
// GROUND_CODE, and 10 for a cart path; never blended: the point takes the type
// with the most weight among the four texels round it, builtGroundAt) and A the signed distance to the edge of whichever
// type that is. One layer rather than a channel each because a landscape
// lays several types side by side across most of its ground (Desert's hardpan
// floor round its rock) and there are not channels or samplers for ten.
// ground.js reads them by these positions.
export const BUILT_CHANNELS = ['sand', 'green', 'fairway', 'tee', 'water', 'semi', 'groundCode', 'ground'];
// The ground types' codes in the field: ground.js GROUND_CODE (which
// groundPaint draws; tests/built-world.test.mjs holds the two the same), and
// a cart path, which a generated course draws as its own strips instead, and
// a road or parking lot (roads.js; the US landscapes goal, phase 4).
export const BUILT_GROUND_CODE = {rock: 1, coral: 2, scree: 3, hardpan: 4, waste: 5, pinestraw: 6, litter: 7, heather: 8, native: 9, path: 10, road: 11};

// The field's size for ground running `ex`, `ez` either side of the centre.
export function fieldSize(ex, ez) {
 const cell = Math.max(BUILT_FIELD.minCell, 2 * Math.max(ex, ez) / BUILT_FIELD.maxSide);
 return {Sx: Math.ceil(2 * ex / cell), Sz: Math.ceil(2 * ez / cell), cell};
}
const byteOf = d => Math.round(Math.max(0, Math.min(1, .5 - d / (2 * BUILT_FIELD.range))) * 255);

// One layer: the signed distance in metres to the union of `polys`, per
// texel, clamped to the field's range -- for rows r0 to r1 (all by default):
// each texel is worked out on its own, so a band is the same bytes as the same
// rows of the whole (bake-pool.js bakes the bands on other cores).
function bakeDistance(polys, Sx, Sz, ex, ez, r0 = 0, r1 = Sz) {
 const R = BUILT_FIELD.range, rows = r1 - r0, dist = new Float32Array(Sx * rows).fill(R), inside = new Uint8Array(Sx * rows);
 const sx = Sx / (2 * ex), sz = Sz / (2 * ez);
 const ti = x => (x + ex) * sx - .5, tj = z => (z + ez) * sz - .5;
 const cx = i => ((i + .5) / sx) - ex, cz = j => ((j + .5) / sz) - ez;
 for (const poly of polys) {
  // Inside, by scanline: each texel row's centre crossings, filled in pairs.
  let zmin = Infinity, zmax = -Infinity;
  for (const ring of poly) for (const [, z] of ring) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
  const j0 = Math.max(r0, Math.ceil(tj(zmin))), j1 = Math.min(r1 - 1, Math.floor(tj(zmax)));
  for (let j = j0; j <= j1; j++) {
   const z = cz(j), xs = [];
   for (const ring of poly) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [ax, az] = ring[b], [bx, bz] = ring[a];
    if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax));
   }
   xs.sort((p, q) => p - q);
   for (let k = 0; k + 1 < xs.length; k += 2) {
    const i0 = Math.max(0, Math.ceil(ti(xs[k]))), i1 = Math.min(Sx - 1, Math.floor(ti(xs[k + 1])));
    for (let i = i0; i <= i1; i++) inside[(j - r0) * Sx + i] = 1;
   }
  }
  // The distance to the nearest edge, stamped segment by segment over the
  // texels within the field's range of it.
  for (const ring of poly) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
   const [ax, az] = ring[b], [bx, bz] = ring[a], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
   const i0 = Math.max(0, Math.floor(ti(Math.min(ax, bx) - R))), i1 = Math.min(Sx - 1, Math.ceil(ti(Math.max(ax, bx) + R)));
   const j0b = Math.max(r0, Math.floor(tj(Math.min(az, bz) - R))), j1b = Math.min(r1 - 1, Math.ceil(tj(Math.max(az, bz) + R)));
   for (let j = j0b; j <= j1b; j++) {
    const z = cz(j);
    for (let i = i0; i <= i1; i++) {
     const x = cx(i), t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
     const d = Math.hypot(x - ax - dx * t, z - az - dz * t), k = (j - r0) * Sx + i;
     if (d < dist[k]) dist[k] = d;
    }
   }
  }
 }
 for (let k = 0; k < dist.length; k++) if (inside[k]) dist[k] = -dist[k];
 return dist;
}

// The two textures' bytes for a document's outlines over ground running `ex`,
// `ez` either side of the centre: {Sx, Sz, ex, ez, cell, a, b}, RGBA each,
// BUILT_CHANNELS in order. Water is the stored bodies' outlines. Where two
// ground types meet, a texel takes the one it is deeper inside. `rows`:
// [r0, r1], a band of the field's rows (bake-pool.js); its bytes are those
// rows of the whole field's.
export function bakeBuiltField(doc, ex, ez, rows = null) {
 const {Sx, Sz, cell} = fieldSize(ex, ez), [r0, r1] = rows ?? [0, Sz], N = Sx * (r1 - r0);
 const turf = ['sand', 'green', 'fairway', 'tee'].map(k => bakeDistance(doc.surfaces?.[k] || [], Sx, Sz, ex, ez, r0, r1));
 const water = bakeDistance((doc.water || []).map(w => w.rings), Sx, Sz, ex, ez, r0, r1);
 const semi = bakeDistance(doc.surfaces?.semi || [], Sx, Sz, ex, ez, r0, r1);
 const code = new Uint8Array(N), best = new Float32Array(N).fill(BUILT_FIELD.range);
 for (const kind of GROUND_KINDS) {
  const polys = doc.surfaces?.[kind] || [];
  if (!polys.length || !BUILT_GROUND_CODE[kind]) continue;
  const d = bakeDistance(polys, Sx, Sz, ex, ez, r0, r1);
  for (let k = 0; k < N; k++) if (d[k] < best[k]) { best[k] = d[k]; code[k] = BUILT_GROUND_CODE[kind]; }
 }
 const a = new Uint8Array(N * 4), b = new Uint8Array(N * 4);
 for (let k = 0; k < N; k++) {
  for (let c = 0; c < 4; c++) a[k * 4 + c] = byteOf(turf[c][k]);
  b[k * 4] = byteOf(water[k]); b[k * 4 + 1] = byteOf(semi[k]); b[k * 4 + 2] = best[k] < BUILT_FIELD.range ? code[k] : 0; b[k * 4 + 3] = byteOf(best[k]);
 }
 return {Sx, Sz, ex, ez, cell, a, b};
}

