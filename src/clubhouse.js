// THE CLUBHOUSE (architect-courses, phase 2; the study, workstreams F and G).
// A course's clubhouse (every generated course since Architect was removed, 2
// November 2026) stands where an architect would put it:
// near the first tee, as near the last green as the land allows, on flat
// ground clear of every corridor and every tee shot, facing the first tee
// (ASGCA: the clubhouse is sited first and the 1st and 10th tees and the 9th
// and 18th greens fit round it -- phase 4 routes from it; until then it is
// sited round the routing Classic's planner made).
//
// It is world data, `world.buildings` -- an oriented box physics stops the
// ball against (physics.js, with the houses; never out of bounds), that houses
// and trees keep off, and that paths reach (paths.js `linkBuilding`). The
// renderer draws the landscape's own model (tools/blender/architect_clubhouses.py)
// fitted to the box. Pure: tests/clubhouse.test.mjs.

// Footprint and height by club, metres (PLACED: a modest municipal clubhouse
// to a championship venue's).
import {worldOf, WORLD_GENERIC} from './biomes.js';
const GENERIC_CLUBHOUSE = WORLD_GENERIC.clubhouse;

export const CLUBHOUSE_SIZE = {
 municipal: {width: 18, depth: 12, height: 7},
 members: {width: 26, depth: 16, height: 9},
 resort: {width: 32, depth: 20, height: 10},
 championship: {width: 36, depth: 22, height: 11},
};
// Each model's height for its width, as built (tools/blender/
// architect_clubhouses.py, measured off the ingested models): the building is
// as tall as its own model is for the club's width, so a tall house keeps its
// roof and a pavilion stays low (iteration 4: one height for all squashed
// Haunted Hollow's manor, since removed).
export const CLUBHOUSE_ASPECT = {lodge: .394, adobe: .434, chalet: .431, stonehouse: .442, farmhouse: .462, pavilion: .401, loglodge: .397, clapboard: .467, shingle: .414};
// The landscape's build (the study's landscape table); the model's name.
// Each landscape's clubhouse is its world block's (biomes.js).
// Looked up by landscape through worldOf, never by the key in a table: the
// tables are the regions' (step 2 of the US landscapes goal moved them, and
// a lookup by landscape key found nothing for seven of the nine).
export const clubhouseKind = key => worldOf(key).clubhouse || GENERIC_CLUBHOUSE;

const corners = (c, w, d, rot) => {
 const cs = Math.cos(rot), sn = Math.sin(rot), out = [];
 for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
  const lx = a * w / 2, lz = b * d / 2;
  out.push({x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs});
 }
 return out;
};

// Where the clubhouse goes. `blocked(x, z, pad)` says whether a point is in a
// tee's shot or view. Returns null when nowhere fits.
// `clear`: whether a footprint {x, z, rotation, width, depth} is clear of
// everything the corners cannot see -- the cart paths (paths.js `pathTouches`;
// the owner, 31 October 2026: a path ran under the Midwest farmhouse).
export function siteClubhouse({holes, s, surface, nearest, height, blocked, clear = () => true}) {
 if (!holes?.length) return null;
 // The club's own size first; a steep landscape that finds nowhere for it
 // falls back to a municipal footprint on ground falling up to 6.5 m
 // (Mountain, iteration 6). Proper levelling is phase 5's earthworks.
 for (const [size, fall] of [[CLUBHOUSE_SIZE.members, 4.5], [CLUBHOUSE_SIZE.municipal, 6.5]]) {
  const found = siteOf({holes, s, surface, nearest, height, blocked, clear, size, fall});
  if (found) return found;
 }
 return null;
}
function siteOf({holes, s, surface, nearest, height, blocked, clear, size, fall}) {
 const first = holes[0], last = holes[holes.length - 1];
 const tee = first.toWorld(first.tees.blue || first.tee), home = last.worldGreen;
 const reach = Math.max(size.width, size.depth) / 2;
 // The box round every tee and green: the property's edges, near enough.
 let box = {x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity};
 for (const h of holes) for (const p of [h.worldGreen ?? h.toWorld(h.green), ...Object.values(h.tees).map(t => h.toWorld(t))]) box = {x0: Math.min(box.x0, p.x), x1: Math.max(box.x1, p.x), z0: Math.min(box.z0, p.z), z1: Math.max(box.z1, p.z)};
 let best = null;
 // Out to 150 m first; a steep landscape that finds nothing there looks to 270.
 for (const far of [150, 270]) { if (best) break;
 for (const centre of [tee, home]) for (let r = 40 + reach; r <= far + reach; r += 12) for (let k = 0; k < 24; k++) {
  const a = k / 24 * Math.PI * 2, c = {x: centre.x + Math.cos(a) * r, z: centre.z + Math.sin(a) * r};
  // Facing the first tee: the front (local -z) toward it.
  const rot = Math.atan2(tee.x - c.x, tee.z - c.z) + Math.PI;
  const pts = corners(c, size.width + 8, size.depth + 8, rot);
  let ok = true, lo = Infinity, hi = -Infinity;
  for (const p of pts) {
   const sf = surface(p.x, p.z), n = nearest(p.x, p.z);
   if (sf === 'water' || sf === 'green' || sf === 'tee' || sf === 'sand' || n.d < 14 || blocked(p.x, p.z, 4)) { ok = false; break; }
   const y = height(p.x, p.z); lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  // A slope is terraced: the floor level with the high side, a stone wall
  // down to the low side (renderer.js addBuildings). Iteration 5: Mountain
  // found nowhere within 3.5 m and had no clubhouse.
  if (!ok || hi - lo > fall || !clear({x: c.x, z: c.z, rotation: rot, width: size.width, depth: size.depth})) continue;
  // Near the first tee and the last green, on level ground -- and toward an
  // edge of the property, so the drive from the public road is short (the
  // US landscapes goal, phase 4; roads.js; weight PLACED).
  const score = Math.hypot(c.x - tee.x, c.z - tee.z) + Math.hypot(c.x - home.x, c.z - home.z) * .8 + (hi - lo) * 12
   + Math.max(0, Math.min(c.x - box.x0, box.x1 - c.x, c.z - box.z0, box.z1 - c.z)) * .3;
  if (!best || score < best.score) best = {score, c, rot, lo, hi};
 }
 }
 if (!best) return null;
 const model = clubhouseKind(s.biome);
 return {kind: 'clubhouse', model, club: true,
  x: best.c.x, z: best.c.z, y: best.hi - .3, base: best.lo, rotation: best.rot, ...size, height: +(size.width * (CLUBHOUSE_ASPECT[model] ?? .42)).toFixed(2)};
}

// Inside a building's footprint, padded by `pad` metres.
export function inBuilding(b, x, z, pad = 0) {
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = x - b.x, dz = z - b.z;
 const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
 return Math.abs(lx) <= b.width / 2 + pad && Math.abs(lz) <= b.depth / 2 + pad;
}

// The lawn in front of a building, toward the first tee, `reach` metres deep
// and a little wider than the building: kept clear of trees so the clubhouse
// is seen from its course (iteration 5: a chalet hid in a mountain wood).
export function inForecourt(b, x, z, reach = 40) {
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = x - b.x, dz = z - b.z;
 const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
 return lz < 0 && lz > -b.depth / 2 - reach && Math.abs(lx) < b.width / 2 + 12;
}
