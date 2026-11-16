// THE COURSE'S WOODS CARRY ON PAST ITS LINE (15 November 2026).
//
// The owner, looking down on the property line: the course's woods stop dead
// at it -- "We dont blend the trees out into the surrounding landscape. We
// need to make that fix at the root." A course's rim is an uncleared stand
// (stands.js) planted up to the line; past it the surroundings (surround.js)
// planted by the country's own pattern, which knows nothing of the course: a
// ruled edge of woods against meadow along whole sides, and the reverse where
// a hole comes close to the line and the country beyond is wooded.
//
// So the course's own edge is measured -- how wooded a strip `strip` metres
// deep inside the line is, in `segs` pieces along each side -- and for `band`
// metres past the line the country takes the course's share there, giving way
// to its own pattern by a wandering edge (`ragged` metres either way, a value
// noise on `cell` metre cells). surround.js plants by it; the ground's paint
// (ground.js, and Godot's farpaint) lays the forest floor by the same numbers,
// handed over as eight vec4s (`edgeUniform`).
//
// Looks only: the surroundings are not in `world.trees` (surround.js), so
// nothing a ball meets moves and no saved round changes. Pure: no three.js.
// PLACED: every number.
import {GROUND_PLANTS} from './species.js';
// (surround.js imports this module too: the two only call each other's
// functions, never at load, so the circle is harmless.)
import {coverHash} from './surround.js';

export const EDGE_WOODS = {strip: 45, segs: 8, band: 180, ragged: 90, cell: 90};

const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

// The share of each side's strip under woods, 0..1, as 4 x segs numbers:
// sides +x, -x, +z, -z, each run from its low end (-z or -x) to its high end.
// A strip is full when its tall trees stand as close as the surroundings plant
// a wood: `keep` (surround.js, 0.9) of a grid at the stand's spacing. So a
// share planted past the line comes out at the strip's own density (measured
// on seed FAIRWAY, nine holes: 0.42 of it on the Pacific Northwest before,
// 0.82 on Classic Parkland, 0.03 on Links).
export function edgeShares(world, spacing, o = EDGE_WOODS, keep = .9) {
 const hx = world.halfX, hz = world.halfZ, n = o.segs, counts = new Float64Array(4 * n);
 for (const t of world.trees || []) {
  if (GROUND_PLANTS.has(t.kind) || (t.h ?? 0) < 4) continue;
  const ax = hx - Math.abs(t.x), az = hz - Math.abs(t.z);
  if (ax >= 0 && ax < o.strip) counts[(t.x > 0 ? 0 : 1) * n + Math.min(n - 1, Math.floor((t.z + hz) / (2 * hz) * n))]++;
  if (az >= 0 && az < o.strip) counts[(t.z > 0 ? 2 : 3) * n + Math.min(n - 1, Math.floor((t.x + hx) / (2 * hx) * n))]++;
 }
 const full = keep / (spacing * spacing), raw = new Float64Array(4 * n);
 for (let s = 0; s < 4; s++) {
  const area = (s < 2 ? 2 * hz : 2 * hx) / n * o.strip;
  for (let k = 0; k < n; k++) raw[s * n + k] = Math.min(1, counts[s * n + k] / area / full);
 }
 // A little smoothing along the side: a hole touching one piece does not
 // open the woods beside it as a notch.
 const out = new Float32Array(4 * n);
 for (let s = 0; s < 4; s++) for (let k = 0; k < n; k++) {
  const a = raw[s * n + Math.max(0, k - 1)], b = raw[s * n + k], c = raw[s * n + Math.min(n - 1, k + 1)];
  out[s * n + k] = .25 * a + .5 * b + .25 * c;
 }
 return out;
}

// The value noise the wandering edge follows: coverHash on `cell` metre cells,
// smoothstepped -- written out the same in ground.js and farpaint.
function ragNoise(x, z, cell) {
 const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
 let fx = x / cell - cx, fz = z / cell - cz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
 const a = coverHash(cx + 17, cz + 5), b = coverHash(cx + 18, cz + 5), c = coverHash(cx + 17, cz + 6), d = coverHash(cx + 18, cz + 6);
 return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}

// The course's share at the line nearest (x, z): the side it faces, the pieces
// interpolated along it, the two sides blended round a corner.
function shareAt(shares, hx, hz, x, z, n) {
 const along = (s, t) => { const u = Math.max(0, Math.min(n - 1, t * n - .5)), i = Math.floor(u), j = Math.min(n - 1, i + 1); return shares[s * n + i] + (shares[s * n + j] - shares[s * n + i]) * (u - i); };
 const qx = Math.abs(x) - hx, qz = Math.abs(z) - hz;
 const sx = along(x > 0 ? 0 : 1, Math.max(0, Math.min(1, (z + hz) / (2 * hz))));
 const sz = along(z > 0 ? 2 : 3, Math.max(0, Math.min(1, (x + hx) / (2 * hx))));
 const wx = smooth(-30, 30, qx - qz);
 return sz + (sx - sz) * wx;
}

// How far the country's own pattern has taken over at (x, z), `d` metres past
// the line: 0 at the line, 1 by `band`, along a wandering edge.
export function edgeFade(x, z, d, o = EDGE_WOODS) {
 return smooth(0, 1, (d - o.band * .15 + o.ragged * 2 * (ragNoise(x, z, o.cell) - .5)) / o.band);
}

// cover(x, z) -> the share wooded, 0..1, with the course's edge (`shares`,
// edgeShares) carried out.
export function edgeWoods(world, shares, cover, o = EDGE_WOODS) {
 const hx = world.halfX, hz = world.halfZ;
 const at = (x, z) => {
  const c = cover(x, z), d = Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));
  if (d <= 0 || d >= o.band * 1.6) return c;
  const s = shareAt(shares, hx, hz, x, z, o.segs);
  return s + (c - s) * edgeFade(x, z, d, o);
 };
 return at;
}

// The shares as the ground's eight vec4s: side s, piece k at [s * 2 + k >> 2][k & 3].
export const edgeUniform = shares => Array.from({length: 8}, (_, i) => [shares[i * 4], shares[i * 4 + 1], shares[i * 4 + 2], shares[i * 4 + 3]]);
