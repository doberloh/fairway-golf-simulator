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
// SEATED ON THE GROUND AS DRAWN (the far-landscape goal, 26 October 2026; the
// owner: "Floating assets out in the distance landscape doesn't look good").
// Sites were placed on the landscape's fine relief, but the ring draws it as
// triangles hundreds of metres wide: a grove 300 m across stood on the fine
// field's height at its centre and hung up to 150 m over the drawn valley
// (bench `farSeated`). Each crown now stands on `drawnGround` -- the same
// triangles -- over its whole footprint: every shape has a flat base at its
// own origin (FAR_SHAPES), a grove tilts with the ground under it (a canopy
// follows its hill) and is let down until no point of its base is above the
// ground; a broad grove over broken ground is drawn smaller rather than
// buried. One whose footprint reaches water is left out.
//
// Pure (no three.js): scenery only, nothing in the world, nothing a ball can
// reach. PLACED: every number.
import {drawnGround, drawnVertices} from './landscape-edge.js';
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

// THE SHAPES, as vegetation.js builds them: each flat-based at its origin, its
// base a disc `foot` wide (in units of the crown's radius), `tall` high, and
// whether it tilts with the ground (a canopy does; a spruce stands upright).
// vegetation.js scales its geometry by these; tests hold the two together.
// `scale` is the instance's width and height in units of the radius; `foot`
// and `tall` are measured from the built shapes (tests/far-woods.test.mjs).
export const FAR_SHAPES = {
 cluster: {foot: 1.01, tall: 1.01, scale: [1, .85], tilt: false}, // three lumps, a broadleaf crown
 spruce: {foot: .8, tall: 3.38, scale: [.8, 3.4], tilt: false},   // two stacked tiers
 dome: {foot: .86, tall: .5, scale: [1, .42], tilt: true},         // a grove of broadleaves
 cone: {foot: .55, tall: 2, scale: [.55, 2], tilt: false},         // a grove of conifers
 snags: {foot: .75, tall: 1.6, scale: [1, 1.6], tilt: false},      // dead trunks, Haunted Hollow
};
// Which shapes a landscape's far woods take (round 3 of the far landscape:
// Haunted Hollow's near crowns as clumps of bare dead trunks -- its purple
// lumps read as living woods; an `evergreen` share in the far forest's record
// draws as spruces and cones among the broadleaves, Autumn's pines and
// hemlocks, in its fourth colour).
const CONIFER_FAR = new Set(['pnw', 'mountain', 'redwood']);
export const farShapes = biome => CONIFER_FAR.has(biome) ? {near: 'spruce', grove: 'cone'} : biome === 'haunted' ? {near: 'snags', grove: 'dome'} : {near: 'cluster', grove: 'dome'};
const EVERGREEN = {near: 'spruce', grove: 'cone'};

// Where a shape of radius `r` stands at (x, z): its base point, its up
// direction, and how far it was let down. `at` is the drawn ground, `verts`
// its vertices near a point (landscape-edge.js drawnVertices): the base is
// held under rings of samples AND every drawn vertex inside the footprint,
// the only places the flat-faced ground can dip lower. Null when its
// footprint reaches water.
// The rim's samples close enough for the ground's slope: a valley line
// crossing the rim between two samples is a dip they straddle, as deep as
// the slope times half their spacing -- 4 m on Mountain's ring faces at 11 m,
// 0.8 m under a small crown at 1.6 m. So the spacing keeps that dip under
// the bench's tolerance (2% of the radius, at least 30 cm) for the site's
// slope (taken one and a half times, plus 0.1, for the drawn faces being
// steeper than the fine field's), never under half a metre: 22 to 96 samples.
// Round 4 of the far landscape: a ring at 90% as well -- two Mountain crowns
// hung 0.3-0.7 m over a point just inside the rim.
const RINGS = [[0, 1], [.35, 6], [.7, 8], [.9, 10], [1, 16]];
export function seatOn(at, x, z, r, shape, wet, verts, slope = 1) {
 const foot = r * shape.foot, pts = [], gap = Math.max(.5, 2 * Math.max(.3, .02 * r) / (1.5 * slope + .1));
 const rim = Math.min(48, Math.max(16, Math.ceil(6.2832 * foot / gap)));
 // The inner rings too, though on flat-faced ground the lowest point is on
 // the rim or at a vertex: without them two crowns in 900,000 hung 40 cm
 // (inside the course's ground, where the vertex list is not the whole story).
 const outer = [];
 for (const [q, n0] of RINGS) {
  const n = q === 1 ? rim : q === .9 ? Math.max(10, rim >> 2) : n0, ring = [];
  for (let k = 0; k < n; k++) {
   const a = (k / n + q * .37) * 6.2832, dx = Math.cos(a) * foot * q, dz = Math.sin(a) * foot * q, g = at(x + dx, z + dz);
   if (wet(x + dx, z + dz, g)) return null;
   pts.push([dx, dz, g]); ring.push({a, g});
  }
  if (q >= .7) outer.push([q, ring]);
 }
 // AND REFINED WHERE IT CHANGES FAST (round 4 of the far landscape): the
 // site's slope comes from the fine relief, but the ground under a rim can
 // hold a bank it never saw (a Desert crown hung 1.6 m over one). Wherever two
 // neighbouring rim samples differ by more than the tolerance, a sample goes
 // between them, up to six times over (a crag's gully, 15 m down in 3 m, cut
 // one rim between samples a sixteenth of a turn apart).
 // The outer rings (70%, 90%) refined the same way: one Mountain crown hung
 // 0.7 m over a dip between two of the 90% ring's samples.
 const tol = Math.max(.3, .02 * r);
 // Only where the ground BENDS between samples (their second difference past
 // the tolerance): a plain slope changes steadily and hides no dip; refining
 // wherever neighbours merely differed sampled every slope six times over.
 for (let [q, ring] of outer) for (let pass = 0; pass < 6; pass++) {
  const next = [], L = ring.length, bend = k => Math.abs(ring[(k - 1 + L) % L].g - 2 * ring[k].g + ring[(k + 1) % L].g) > tol;
  for (let k = 0; k < L; k++) {
   const p = ring[k], o = ring[(k + 1) % L]; next.push(p);
   if (!bend(k) && !bend((k + 1) % L)) continue;
   const a = p.a + ((o.a - p.a + 6.2832) % 6.2832) / 2, dx = Math.cos(a) * foot * q, dz = Math.sin(a) * foot * q, g = at(x + dx, z + dz);
   if (wet(x + dx, z + dz, g)) return null;
   pts.push([dx, dz, g]); next.push({a, g});
  }
  if (next.length === ring.length) break;
  ring = next;
 }
 if (verts) for (const [px, pz, g] of verts(x, z, foot)) { if (wet(px, pz, g)) return null; pts.push([px - x, pz - z, g]); }
 // The ground's plane under the footprint (least squares), held to 30 degrees.
 let b = 0, c = 0;
 const mean = pts.reduce((m, p) => m + p[2], 0) / pts.length;
 if (shape.tilt) {
  let sxx = 0, szz = 0, sxz = 0, sxg = 0, szg = 0;
  for (const [dx, dz, g] of pts) { sxx += dx * dx; szz += dz * dz; sxz += dx * dz; sxg += dx * (g - mean); szg += dz * (g - mean); }
  const det = sxx * szz - sxz * sxz;
  if (det > 1e-9) { b = (sxg * szz - szg * sxz) / det; c = (szg * sxx - sxg * sxz) / det; }
  const s = Math.hypot(b, c), cap = .58;
  if (s > cap) { b *= cap / s; c *= cap / s; }
 }
 // Let down until no point of the base is above the ground.
 let drop = 0;
 for (const [dx, dz, g] of pts) drop = Math.max(drop, mean + b * dx + c * dz - g);
 const n = Math.hypot(b, 1, c);
 return {y: mean - drop - .02 * r, ux: -b / n, uy: 1 / n, uz: -c / n, drop, slope: Math.hypot(b, c)};
}

// `groves`: every crown seated as a grove (Low and Medium draw them so); else
// near crowns as their near shape, the rest as groves. A crown is seated only
// in the shape it will be drawn as.
export function farWoodSites(w, {reach = FAR_REACH, groves = false} = {}) {
 const f = biomeOf(w.settings.biome).farForest;
 if (!f) return [];
 const g = w.groundGrid, gx = g.halfX, gz = g.halfZ, px = w.halfX, pz = w.halfZ, at = drawnGround(w), verts = drawnVertices(w);
 const line = f.line ?? 1e5, cover = f.cover ?? 0, r0 = (f.size ?? 11) * .55, shapes = farShapes(w.settings.biome);
 const sea = !!w.bio?.sea || !!biomeOf(w.settings.biome).sea, level = w.waterLevel ?? 0;
 // Water: the sea (drawn ground under its level), and inside the course's
 // ground a lake or a creek -- asked of the lakes and streams directly, at
 // every point of a footprint (the whole surface classifier at each was 70%
 // of the far woods' time). Ponds lie on the holes, inside the property; the
 // full classifier is asked once, at each crown's centre.
 const wet = (x, z, y) => (sea && y < level + .4) || (Math.abs(x) < gx && Math.abs(z) < gz && (w.lakeOwner(x, z) || w.streams.at(x, z)?.edge <= 0));
 // The treeline, water and slope tests read the ground as drawn too (round 4 of
 // the far landscape): the fine relief past the course's ground cost a third
 // of the far woods' time, five lookups a site, for answers about ground the
 // player sees drawn otherwise.
 const groundAt = at;
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
   if (Math.abs(jx) < gx && Math.abs(jz) < gz && w.surface(jx, jz) === 'water') continue;
   const e = Math.max(4, s * .3), slope = Math.hypot(groundAt(jx + e, jz) - groundAt(jx - e, jz), groundAt(jx, jz + e) - groundAt(jx, jz - e)) / (2 * e);
   // A cliff (round 5: groves held to gentler ground, .65, than near crowns:
   // on Mountain's steep ring faces they stood out as plates).
   if (slope > (d < NEAR_REACH ? .9 : .65)) continue;
   // Round 4 of the far landscape: no seam where near crowns become groves.
   // The switch at a fixed 420 m drew a line round the course -- 6 m crowns
   // on one side, 19 m domes on the other. Now each site switches somewhere
   // in a 240 m band (by its own hash), and a near crown grows with its band's
   // spacing (up to 40% of it), so the sizes meet.
   const size = .75 + glslHash(jz, jx) * .5, near = d < NEAR_REACH - 120 + 240 * glslHash(jx * .91, jz * 1.13), pick = glslHash(jx * 1.7, jz * 2.3);
   const evergreen = !!f.evergreen && pick >= 1 - f.evergreen, kind = evergreen ? EVERGREEN : shapes;
   if (near && !groves) {
    const nearR = Math.max(r0, s * .4) * size, nearSeat = seatOn(at, jx, jz, nearR, FAR_SHAPES[kind.near], wet, verts, slope);
    if (nearSeat) out.push({x: jx, z: jz, y, near, pick, size, slope, evergreen, shape: kind.near, r: nearR, seat: nearSeat});
    continue;
   }
   // A grove over broken ground is drawn smaller rather than buried: let down
   // by more than a third of its height, it tries again at two thirds the size.
   let groveR = Math.max(r0, s * .55 * size), grove = null;
   for (let k = 0; k < 3; k++, groveR *= .67) {
    grove = seatOn(at, jx, jz, groveR, FAR_SHAPES[kind.grove], wet, verts, slope);
    if (!grove || grove.drop < FAR_SHAPES[kind.grove].tall * groveR * .35 || groveR <= r0) break;
   }
   if (grove) out.push({x: jx, z: jz, y, near, pick, size, slope, evergreen, shape: kind.grove, r: groveR, seat: grove});
  }
  d0 = d1;
 }
 return out;
}
