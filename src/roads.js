// THE ROADS (the US landscapes goal, phase 4; the study's PLAN.md section 4).
// A generated course's public road, entrance drive and parking lot:
//
//   the public road  runs straight along the side of the property nearest
//                    the clubhouse, outside every hole; beyond it is out of
//                    bounds (physics.js `outOfBounds`, `world.boundary`)
//   the lot          beside the clubhouse, on its road side, about 60 stalls
//                    for nine holes and 120 for eighteen
//   the drive        from the lot to the road, routed like a cart path
//                    (paths.js `costGrid`) with every fairway, semi-rough,
//                    green, fringe, tee and bunker blocked outright
//
// NO ROAD CROSSES A FAIRWAY, EVER (the owner's answer 8): the drive cannot
// enter a blocked cell, the road is laid where nothing is played, and
// tools/bench.mjs holds both to zero (`roadOnPlay`). A ball on a road or the
// lot plays as a road (grounds.js `road`: hardpan's bounce) and takes free
// relief as from a cart path. Cars are left out; the stalls are ready for
// them. The builder's roads (drawn anywhere) are its own (PLAN.md 4).
//
// Road objects have a cart path's shape ({points, width, kind}), so the
// path index, clearance and touch tests work on them (paths.js).
// Pure: no DOM, no three.js. tests/roads.test.mjs.
import {costGrid, lineOf} from './paths.js';
import {inBuilding, inForecourt} from './clubhouse.js';

// PLACED: a two-lane road 24 ft (7.3 m), a drive 20 ft (6.1 m); a stall 9 by
// 18 ft (2.7 by 5.5 m) on a 24 ft (7.3 m) aisle -- common US dimensions.
export const ROAD_WIDTH = {boundary: 7.3, drive: 6.1};
export const STALL = {width: 2.7, depth: 5.5, aisle: 7.3};
// How far beyond the holes' tees and greens the road runs (PLACED: past a
// corridor's half width and its rough, with a margin).
export const ROAD_MARGIN = 70;
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water']);
const NO_DRIVE = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand']);

// The box round every tee and green.
export function holesBox(holes) {
 let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
 for (const h of holes) {
  const pts = [h.worldGreen ?? h.toWorld(h.green), ...Object.values(h.tees).map(t => h.toWorld(t))];
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
 }
 return {x0, x1, z0, z1};
}

// The side of the box nearest a point: the axis it runs across, which way
// out, and how far the point is from it.
export function nearestSide(box, p) {
 const sides = [{axis: 'x', sign: -1, d: p.x - box.x0}, {axis: 'x', sign: 1, d: box.x1 - p.x},
  {axis: 'z', sign: -1, d: p.z - box.z0}, {axis: 'z', sign: 1, d: box.z1 - p.z}];
 return sides.reduce((a, b) => (b.d < a.d ? b : a));
}

// The lot's size: two double rows (two rows of stalls facing an aisle each).
export function lotSize(holes) {
 const stalls = holes.length > 9 ? 120 : 60, perRow = stalls / 4;
 return {stalls, width: +(perRow * STALL.width).toFixed(2), depth: +(2 * (2 * STALL.depth + STALL.aisle)).toFixed(2)};
}

// Distance from a point to a segment.
const segD = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };

// The sides of the box, nearest a point first.
export function sidesByDistance(box, p) {
 return [{axis: 'x', sign: -1, d: p.x - box.x0}, {axis: 'x', sign: 1, d: box.x1 - p.x},
  {axis: 'z', sign: -1, d: p.z - box.z0}, {axis: 'z', sign: 1, d: box.z1 - p.z}].sort((a, b) => a.d - b.d);
}

// A straight road outside the box on one side, moved further out until
// nothing played lies under it (sampled every 4 m along it and across its
// width), inside the world's edge; null when none fits (a coast).
function layRoad(side, box, half, surface) {
 const across = side.axis === 'x' ? 'z' : 'x';
 const lo = Math.max(-half[across] + 8, (across === 'x' ? box.x0 : box.z0) - 120), hi = Math.min(half[across] - 8, (across === 'x' ? box.x1 : box.z1) + 120);
 const base = side.axis === 'x' ? (side.sign > 0 ? box.x1 : box.x0) : (side.sign > 0 ? box.z1 : box.z0);
 const pt = (at, u) => (side.axis === 'x' ? {x: at, z: u} : {x: u, z: at});
 const clearAt = at => {
  for (let u = lo; u <= hi; u += 4) for (const o of [-ROAD_WIDTH.boundary / 2, 0, ROAD_WIDTH.boundary / 2]) {
   const p = pt(at + o * side.sign, u);
   if (PLAYED.has(surface(p.x, p.z))) return false;
  }
  return true;
 };
 for (let m = ROAD_MARGIN; m <= ROAD_MARGIN + 200; m += 10) {
  const at = base + side.sign * m;
  if (Math.abs(at) > half[side.axis] - 6) return null;
  if (!clearAt(at)) continue;
  const points = [];
  for (let u = lo; u <= hi + .01; u += 20) points.push(pt(at, Math.min(u, hi)));
  return {at, lo, hi, points};
 }
 return null;
}

export function placeRoads({holes, s, surface, nearest, height, halfX, halfZ, club, paths = [], streams = null, pathTouches = () => false}) {
 const none = {roads: [], lot: null, boundary: null};
 if (!club || !holes?.length) return none;
 const box = holesBox(holes), half = {x: halfX, z: halfZ};
 // THE PUBLIC ROAD: on the clubhouse's side if it fits there, else the next
 // nearest side; none on a course with no straight dry edge (an island).
 let side = null, laid = null;
 for (const sd of sidesByDistance(box, club)) { laid = layRoad(sd, box, half, surface); if (laid) { side = sd; break; } }
 const roads = [], boundary = laid ? {axis: side.axis, sign: side.sign, at: laid.at, width: ROAD_WIDTH.boundary} : null;
 if (laid) roads.push({kind: 'boundary', width: ROAD_WIDTH.boundary, points: laid.points});
 const toward = p => (laid ? Math.abs((side.axis === 'x' ? p.x : p.z) - laid.at) : 0);
 // THE LOT: on a ring round the clubhouse, squared to it or turned a quarter,
 // on near-level open ground out of play, off the cart paths and the
 // clubhouse's lawn; the nearest to the clubhouse wins, the road side
 // breaking ties. A half-size lot where the full one fits nowhere.
 let lot = null;
 for (const scale of [1, .5]) {
  // Whole stalls a row (a half lot of 60 is 7 a row, 28 in all).
  const size = lotSize(holes), perRow = Math.floor(size.stalls * scale / 4), w = +(perRow * STALL.width).toFixed(2), d = size.depth, stalls = perRow * 4;
  const r0 = Math.hypot(club.width, club.depth) / 2 + Math.min(w, d) / 2 + 6;
  for (let r = r0; r <= r0 + 90; r += 10) for (let k = 0; k < 16; k++) for (const turn of [0, Math.PI / 2]) {
   const a = k / 16 * Math.PI * 2, c = {x: club.x + Math.cos(a) * r, z: club.z + Math.sin(a) * r};
   const rect = {x: c.x, z: c.z, rotation: club.rotation + turn, width: w, depth: d};
   const rc = Math.cos(rect.rotation), rs = Math.sin(rect.rotation);
   let ok = true, ylo = Infinity, yhi = -Infinity;
   // Every 4 m or closer, as the invariant samples it (phase 5: a quarter-
   // width grid let a pond's edge in between its samples).
   const su = 1 / Math.max(4, Math.ceil(w / 4)), sv = 1 / Math.max(4, Math.ceil(d / 4));
   for (let u = -.5; u <= .5 + 1e-9 && ok; u += su) for (let v = -.5; v <= .5 + 1e-9; v += sv) {
    const p = {x: c.x + u * w * rc + v * d * rs, z: c.z - u * w * rs + v * d * rc};
    if (PLAYED.has(surface(p.x, p.z)) || (nearest(p.x, p.z)?.d ?? 999) < 12 || inBuilding(club, p.x, p.z, 4) || inForecourt(club, p.x, p.z, 30)) { ok = false; break; }
    const y = height(p.x, p.z); ylo = Math.min(ylo, y); yhi = Math.max(yhi, y);
   }
   // And on the invariant's own grid, metre for metre (`roadOnPlay`: from
   // one corner every 4 m), so the two cannot disagree -- phase 7's Monterey
   // coast put a sliver of sea between the grid above's samples.
   if (ok) for (let u = -w / 2; u <= w / 2 && ok; u += 4) for (let v = -d / 2; v <= d / 2; v += 4) {
    if (PLAYED.has(surface(c.x + u * rc + v * rs, c.z - u * rs + v * rc))) { ok = false; break; }
   }
   if (!ok || yhi - ylo > 5 || pathTouches(paths, rect, 2)) continue;
   const score = r + toward(c) * .3 + (yhi - ylo) * 8;
   if (!lot || score < lot.score) lot = {...rect, stalls, y: (ylo + yhi) / 2, score};
  }
  if (lot) break;
 }
 if (lot) delete lot.score;
 // THE DRIVE: from the middle of the lot's side nearest the road to the
 // nearest point of the road, routed with play blocked; a straight drive
 // where the routing finds no way and the straight line crosses nothing
 // played.
 if (lot && laid) {
  const rc = Math.cos(lot.rotation), rs = Math.sin(lot.rotation);
  const from = [[0, -.5], [0, .5], [-.5, 0], [.5, 0]].map(([u, v]) => ({x: lot.x + u * lot.width * rc + v * lot.depth * rs, z: lot.z - u * lot.width * rs + v * lot.depth * rc}))
   .sort((a, b) => toward(a) - toward(b))[0];
  const onRoad = side.axis === 'x' ? {x: laid.at, z: Math.max(laid.lo, Math.min(laid.hi, from.z))} : {x: Math.max(laid.lo, Math.min(laid.hi, from.x)), z: laid.at};
  const grid = costGrid({holes, s, surface, streams, height, block: NO_DRIVE, dear: {}, pad: ROAD_MARGIN + 240, berth: true});
  const cells = grid.route(from, onRoad);
  let points = null;
  if (cells?.length) points = [from, ...lineOf(grid, cells).slice(1, -1), onRoad];
  else {
   const len = Math.hypot(onRoad.x - from.x, onRoad.z - from.z), n = Math.ceil(len / 3);
   let clear = true;
   for (let i = 0; i <= n && clear; i++) { const t = i / n; if (NO_DRIVE.has(surface(from.x + (onRoad.x - from.x) * t, from.z + (onRoad.z - from.z) * t))) clear = false; }
   if (clear) points = [from, onRoad];
  }
  if (points) roads.push({kind: 'drive', width: ROAD_WIDTH.drive, points});
 }
 return {roads, lot, boundary};
}

// THE STREETS KIT PLACED (tools/blender/cartoon_streets.py; PLAN.md 4): the
// lot's light poles down each aisle every 20 m, a planted island at both ends
// of each row of stalls, a wheel stop in every stall, the bag drop at the
// lot's edge nearest the clubhouse, and street lamps along the drive every
// 30 m, 4 m off its side. Decoration: nothing collides with them. Positions
// PLACED. `rot` turns a model's front (-Y, glTF +z) as the lot is turned.
export function streetFurniture({lot, roads = [], club}) {
 const out = [];
 if (lot) {
  const rc = Math.cos(lot.rotation), rs = Math.sin(lot.rotation), at = (u, v) => ({x: lot.x + u * rc + v * rs, z: lot.z - u * rs + v * rc});
  const D = STALL.depth, A = STALL.aisle, rows = [-lot.depth / 2, -lot.depth / 2 + D + A, lot.depth / 2 - 2 * D - A, lot.depth / 2 - D];
  // The aisles' middles: between the first two rows, and the last two.
  for (const v of [-lot.depth / 2 + D + A / 2, lot.depth / 2 - D - A / 2]) for (let u = -lot.width / 2 + 10; u < lot.width / 2 - 5; u += 20) out.push({kind: 'lightpole', ...at(u, v), rot: lot.rotation});
  for (const [i, v0] of rows.entries()) {
   const face = i % 2 ? Math.PI : 0;
   for (let u = -lot.width / 2 + STALL.width / 2; u < lot.width / 2; u += STALL.width) out.push({kind: 'wheelstop', ...at(u, v0 + (i % 2 ? .6 : D - .6)), rot: lot.rotation + face});
   for (const side of [-1, 1]) out.push({kind: 'island', ...at(side * (lot.width / 2 + 1.4), v0 + D / 2), rot: lot.rotation});
  }
  if (club) {
   const toClub = [[0, -lot.depth / 2 - 4], [0, lot.depth / 2 + 4], [-lot.width / 2 - 6, 0], [lot.width / 2 + 6, 0]].map(([u, v]) => at(u, v))
    .sort((a, b) => Math.hypot(a.x - club.x, a.z - club.z) - Math.hypot(b.x - club.x, b.z - club.z))[0];
   out.push({kind: 'bagdrop', ...toClub, rot: Math.atan2(club.x - toClub.x, club.z - toClub.z) + Math.PI});
  }
 }
 for (const r of roads) if (r.kind === 'drive') {
  let run = 0, next = 15;
  for (let k = 1; k < r.points.length; k++) {
   const a = r.points[k - 1], b = r.points[k], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
   while (run + l >= next) { const t = (next - run) / l; out.push({kind: 'streetlight', x: a.x + (b.x - a.x) * t + nx * (r.width / 2 + 4), z: a.z + (b.z - a.z) * t + nz * (r.width / 2 + 4), rot: 0}); next += 30; }
   run += l;
  }
 }
 return out;
}

// THE CART BARN (tools/blender/cartoon_streets.py; the streets kit, PLAN 4):
// 40 by 15.2 m and 6.85 m to the ridge (its model's own proportions),
// squared to the lot beside a long side or an end, 4, 12 or 20 m off it --
// the first that is open, out of play (12 m from any corridor), off the cart paths and the
// clubhouse, the ground under it within 3 m. A building: physics stops the
// ball against it. None where neither side fits. Sizes PLACED.
export const CART_BARN = {width: 40, depth: 15.2, height: 6.85};
export function placeCartBarn({lot, club, surface, nearest, height, paths = [], pathTouches = () => false}) {
 if (!lot) return null;
 const rc = Math.cos(lot.rotation), rs = Math.sin(lot.rotation), {width: w, depth: d} = CART_BARN;
 // Beside either long side or either end, 4 m off and then 8 and 16 m further
 // (the first site on RD-1 had the clubhouse on one side, the drive the other).
 const sites = [];
 for (const extra of [0, 8, 16]) for (const [su, sv] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) sites.push([su * (lot.width / 2 + 4 + w / 2 + extra), sv * (lot.depth / 2 + 4 + d / 2 + extra)]);
 for (const [u0, v] of sites) {
  const c = {x: lot.x + u0 * rc + v * rs, z: lot.z - u0 * rs + v * rc};
  const rect = {x: c.x, z: c.z, rotation: lot.rotation, width: w, depth: d};
  let ok = true, lo = Infinity, hi = -Infinity;
  for (let u = -.5; u <= .5 + 1e-9 && ok; u += .125) for (let t = -.5; t <= .5 + 1e-9; t += .25) {
   const x = c.x + u * w * rc + t * d * rs, z = c.z - u * w * rs + t * d * rc;
   if (PLAYED.has(surface(x, z)) || surface(x, z) === 'road' || (nearest(x, z)?.d ?? 999) < 12 || (club && inBuilding(club, x, z, 4))) { ok = false; break; }
   const y = height(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  if (!ok || hi - lo > 3 || pathTouches(paths, rect, 2)) continue;
  return {kind: 'cartbarn', model: 'CartBarn_1', club: true, story: true, x: c.x, z: c.z, y: lo, base: lo, rotation: lot.rotation, ...CART_BARN};
 }
 return null;
}

// Is (x, z) on a road or the lot? `index` is a paths.js pathIndex of the roads.
export function onRoad(index, lot, x, z) {
 return !!(index?.onPath(x, z) || (lot && inBuilding(lot, x, z, 0)));
}

// How far (x, z) is past the public road's outer edge (positive: out of
// bounds), for physics.js.
export function pastBoundary(boundary, x, z) {
 if (!boundary) return -Infinity;
 const v = boundary.axis === 'x' ? x : z;
 return boundary.sign * (v - boundary.at) - boundary.width / 2;
}

// Every place a road or the lot lies on played ground: the invariant
// (tools/bench.mjs `roadOnPlay`, tests/roads.test.mjs). Sampled every 3 m
// along each road across its width, and over the lot on a 4 m grid.
export function roadOnPlay({roads = [], lot = null}, surface) {
 const bad = [];
 for (const r of roads) for (let k = 1; k < r.points.length; k++) {
  const a = r.points[k - 1], b = r.points[k], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 3));
  const nx = -(b.z - a.z) / (len || 1), nz = (b.x - a.x) / (len || 1);
  for (let i = 0; i <= n; i++) for (const o of [-r.width / 2, 0, r.width / 2]) {
   const t = i / n, x = a.x + (b.x - a.x) * t + nx * o, z = a.z + (b.z - a.z) * t + nz * o, sf = surface(x, z);
   if (NO_DRIVE.has(sf)) bad.push({kind: r.kind, x, z, sf});
  }
 }
 if (lot) {
  const rc = Math.cos(lot.rotation), rs = Math.sin(lot.rotation);
  for (let u = -lot.width / 2; u <= lot.width / 2; u += 4) for (let v = -lot.depth / 2; v <= lot.depth / 2; v += 4) {
   const x = lot.x + u * rc + v * rs, z = lot.z - u * rs + v * rc, sf = surface(x, z);
   if (PLAYED.has(sf)) bad.push({kind: 'lot', x, z, sf});
  }
 }
 return bad;
}
export {segD as roadSegmentDistance};
