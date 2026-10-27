// THE FAR WOODS (the polish goal, 26 October 2026). The owner: "it still
// looks like there is a band of completely empty space before those textured
// pieces start. Fix that and then can we make those an actual 3d mesh of some
// sort?" -- and, seeing the first rounds: "There needs to be 3d objects all
// the way to the edge of the landscape where relevant (really tall mountains
// obviously don't need trees all the way to the top, and desert probably
// doesn't need THICK coverage). LODs can obviously fade but should not
// transition to just bare ground ever."
//
// The stands (stands.js) are planted to the property line; past it, real
// geometry all the way out to the landscape's last ring (13 km), wherever the
// painted far forest (ground.js, THE FOREST ON THE FAR HILLS) says woods grow:
// its patchy cover, its treeline (Mountain's peaks stay bare above it), off
// cliffs and water. Desert's cover is low, so its woods are thin.
//
// LEVELS OF DETAIL BY DISTANCE, NEVER BY ABSENCE. Sites lie on jittered grids
// in bands outward from the property line; each band's spacing grows with its
// distance (13 m at the line, about 6% of the distance beyond), so a crown
// stays a similar size on screen and the count stays bounded however far the
// land runs. Near crowns (`near`) are drawn as clusters of lumps or two-tier
// spruces; beyond `NEAR_REACH` as single low grove blobs a few hundred
// triangles fewer, each standing for a stand of trees. Under them the
// painting carries the colour, so a gap shows forest floor, not bare rough.
//
// Pure (no three.js): scenery only, nothing in the world, nothing a ball can
// reach. PLACED: every number.
import {ringRelief} from './landscape-edge.js';
import {biomeOf} from './biomes.js';

const glslHash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
// The painting's patch noise, as ground.js computes it, so woods and painting agree.
function broad(x, z) {
 const cx = Math.floor(x / 380), cz = Math.floor(z / 380);
 let fx = x / 380 - cx, fz = z / 380 - cz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
 const n00 = glslHash(cx, cz), n10 = glslHash(cx + 1, cz), n01 = glslHash(cx, cz + 1), n11 = glslHash(cx + 1, cz + 1);
 const a = n00 + (n10 - n00) * fx, b = n01 + (n11 - n01) * fx;
 return a + (b - a) * fz;
}
const boxOut = (x, z, hx, hz) => Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));

// Crowns nearer the property line than this are drawn as clusters; beyond, as blobs.
export const NEAR_REACH = 420;
// How far out the woods run: the landscape ring's own reach (landscape-edge.js).
export const FAR_REACH = 12800;
// A band's crown spacing at `d` metres past the property line.
export const spacingAt = d => Math.max(13, .06 * (d + 150));

export function farWoodSites(w, {reach = FAR_REACH} = {}) {
 const f = biomeOf(w.settings.biome).farForest;
 if (!f) return [];
 const g = w.groundGrid, gx = g.halfX, gz = g.halfZ, px = w.halfX, pz = w.halfZ, relief = ringRelief(w);
 const line = f.line ?? 1e5, cover = f.cover ?? 0;
 const groundAt = (x, z) => { const o = boxOut(x, z, gx, gz); return w.height(x, z) + (o > 0 ? relief.at(x, z, o) : 0); };
 const out = [];
 // Bands: each four spacings deep (or a quarter of its distance), its own grid.
 for (let d0 = 0; d0 < reach;) {
  const s = spacingAt(d0), d1 = Math.min(reach, d0 + Math.max(4 * s, d0 * .25));
  const ex = px + d1, ez = pz + d1;
  for (let x = -ex; x <= ex; x += s) for (let z = -ez; z <= ez; z += s) {
   const jx = x + (glslHash(x * .37, z * .11) - .5) * s * .8, jz = z + (glslHash(z * .29, x * .19) - .5) * s * .8;
   const d = boxOut(jx, jz, px, pz);
   if (d <= 2 || d < d0 || d >= d1) continue;
   if (smooth(1 - cover - .12, 1 - cover + .12, broad(jx, jz)) < glslHash(jx * .53, jz * .71)) continue;
   const y = groundAt(jx, jz);
   if (y > line + glslHash(jx, jz) * 40 - 20) continue;           // above the treeline
   if (y < .5) continue;                                          // water
   const e = Math.max(4, s * .3), slope = Math.hypot(groundAt(jx + e, jz) - groundAt(jx - e, jz), groundAt(jx, jz + e) - groundAt(jx, jz - e)) / (2 * e);
   // A cliff (round 5: groves held to gentler ground, .65, than near crowns:
   // on Mountain's steep ring faces they stood out as plates).
   if (slope > (d < NEAR_REACH ? .9 : .65)) continue;
   const size = .75 + glslHash(jz, jx) * .5;
   out.push({x: jx, z: jz, y, r: s * .55 * size, near: d < NEAR_REACH, pick: glslHash(jx * 1.7, jz * 2.3), size, slope});
  }
  d0 = d1;
 }
 return out;
}
