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
//   the streets      with fairway homes on, behind the houses and joined to
//                    the road (placeStreets, below), a lane from every drive
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
import {costGrid, lineOf, worstTurn, CELL, JOIN_MERGE} from './paths.js';
import {inBuilding, inForecourt} from './clubhouse.js';
import {segDist} from './story.js';

// PLACED: a two-lane road 24 ft (7.3 m), a drive 20 ft (6.1 m); a stall 9 by
// 18 ft (2.7 by 5.5 m) on a 24 ft (7.3 m) aisle -- common US dimensions.
export const ROAD_WIDTH = {boundary: 7.3, drive: 6.1};
export const STALL = {width: 2.7, depth: 5.5, aisle: 7.3};
// How far beyond the holes' tees and greens the road runs (PLACED: past a
// corridor's half width and its rough, with a margin).
export const ROAD_MARGIN = 70;
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water']);
const NO_DRIVE = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand']);
const NO_STREET = new Set([...NO_DRIVE, 'water']);

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
function layRoad(side, box, half, surface, club) {
 const across = side.axis === 'x' ? 'z' : 'x';
 const lo = Math.max(-half[across] + 8, (across === 'x' ? box.x0 : box.z0) - 120), hi = Math.min(half[across] - 8, (across === 'x' ? box.x1 : box.z1) + 120);
 const base = side.axis === 'x' ? (side.sign > 0 ? box.x1 : box.x0) : (side.sign > 0 ? box.z1 : box.z0);
 const pt = (at, u) => (side.axis === 'x' ? {x: at, z: u} : {x: u, z: at});
 const clearAt = at => {
  for (let u = lo; u <= hi; u += 4) for (const o of [-ROAD_WIDTH.boundary / 2, 0, ROAD_WIDTH.boundary / 2]) {
   const p = pt(at + o * side.sign, u);
   if (PLAYED.has(surface(p.x, p.z)) || inBuilding(club, p.x, p.z, 4)) return false;
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
 for (const sd of sidesByDistance(box, club)) { laid = layRoad(sd, box, half, surface, club); if (laid) { side = sd; break; } }
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
  const sides = [[0, -.5], [0, .5], [-.5, 0], [.5, 0]].map(([u, v]) => ({x: lot.x + u * lot.width * rc + v * lot.depth * rs, z: lot.z - u * lot.width * rs + v * lot.depth * rc}))
   .sort((a, b) => toward(a) - toward(b));
  const grid = costGrid({holes, s, surface, streams, height, block: NO_DRIVE, dear: {}, pad: ROAD_MARGIN + 240, berth: true});
  // Not through the clubhouse (the bench's `roadOnHouse`, generator 84: a
  // drive ran under it on about one course in forty).
  {const [ci, cj] = grid.cellOf(club), n = Math.ceil((Math.hypot(club.width, club.depth) / 2 + 12) / CELL);
   for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= grid.nx || j >= grid.nz) continue; const p = grid.at(i, j); if (inBuilding(club, p.x, p.z, 5)) grid.cost[j * grid.nx + i] = Infinity; }}
  // The side nearest the road first; the next where that one's way out is
  // walled by the clubhouse.
  let points = null;
  for (const from of sides) {
   const onRoad = side.axis === 'x' ? {x: laid.at, z: Math.max(laid.lo, Math.min(laid.hi, from.z))} : {x: Math.max(laid.lo, Math.min(laid.hi, from.x)), z: laid.at};
   const hitsOf = pts => { const drive = {roads: [{kind: 'drive', width: ROAD_WIDTH.drive, points: pts}]}; return [...roadOnPlay(drive, surface), ...roadOnHouse({...drive, buildings: [club]})]; };
   let cells = grid.route(from, onRoad);
   // A FEATURE THINNER THAN A CELL (generator 80: a Lowcountry tidal creek's
   // tip, its sandy bank between two cells' centres): the routed drive is
   // checked as the invariant checks it, and the cells round anything it
   // clipped are closed and the drive routed again. Only a drive that would
   // have broken the rule changes.
   for (let tries = 0; tries < 4 && cells?.length; tries++) {
    const pts = [from, ...lineOf(grid, cells).slice(1, -1), onRoad], hits = hitsOf(pts);
    if (!hits.length) { points = pts; break; }
    for (const h of hits) {
     const [ci, cj] = grid.cellOf(h);
     for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < grid.nx && j < grid.nz) grid.cost[j * grid.nx + i] = Infinity; }
    }
    cells = grid.route(from, onRoad);
   }
   if (!points && !hitsOf([from, onRoad]).length) points = [from, onRoad];
   if (points) break;
  }
  if (points) roads.push({kind: 'drive', width: ROAD_WIDTH.drive, points});
 }
 return {roads, lot, boundary};
}

// THE STREETS (PLAN.md 4: "the housing's streets serve the homes"; generator
// 84). Fairway homes are built with their backs to the fairway and their
// fronts, drives and mailboxes to a street behind them, as a golf community's
// are; the street runs round the outside of the row, away from play.
//
//   a row        the garaged houses on one side of one hole, in order along it
//   a street     from the nearest road or street, past the row's gates (a
//                point STREET.off beyond each drive's end), routed on the
//                drive's grid with all water closed as well as everything
//                played, and every house, building, wall and the lot; rounded
//                (no 4 m turns past STREET.turn degrees) and meeting what it
//                joins at a slant
//   its far end  runs on to the next street if one is close, else turns in a
//                cul-de-sac: the teardrop the cart paths loop in, wider
//   a lane       from each drive's end along the drive's line to the street
//
// A drive that no street reaches is not built (`garage` false): a house's drive
// always arrives somewhere. All of it PLACED except the street's width, a
// common US residential 20 ft. Road objects, as in placeRoads.
export const STREET = {width: 6.1, lane: 3.4, off: 7, reach: 30, near: 24, turn: 20, grade: .24, merge: 14, loops: [12, 10, 8, 6.5], link: 130};

// WHERE A HOUSE'S DRIVE LIES: its centre in the house's own frame (+z the
// house's front), 3.4 x 9 m. Shared by the drive, the grass that keeps off it,
// its lane and its mailbox. (homes.js re-exports it.)
export function driveFrame(h) { return {gx: (h.width / 2 + 2.4) * (h.trim > .5 ? 1 : -1), gz: -h.depth * .1 + 7.4}; }

// A drive's street end in the world, and the way the drive runs out.
export function driveEnd(h) {
 const {gx, gz} = driveFrame(h), c = Math.cos(h.rotation), s = Math.sin(h.rotation), lz = gz + 4.5;
 return {x: h.x + gx * c + lz * s, z: h.z - gx * s + lz * c, dx: s, dz: c};
}

// A MAILBOX AT EACH DRIVE (the streets kit, PLAN 4): on the street's verge at
// the lane, 2.3 m to its side, its door to the street; at the drive's own end
// on a built course, whose houses have no lanes. Drawing only.
export function mailboxAt(h) {
 const E = driveEnd(h), {gx} = driveFrame(h), side = gx > 0 ? 1 : -1;
 const lx = h.lane ? h.lane.x - E.x : E.dx, lz = h.lane ? h.lane.z - E.z : E.dz, len = Math.hypot(lx, lz) || 1, ux = lx / len, uz = lz / len;
 const at = h.lane ? Math.max(0, len - STREET.width / 2 - .9) : .1;
 // The house's right, in the world, turned with it.
 const nx = uz, nz = -ux;
 return {x: E.x + ux * at + nx * side * 2.3, z: E.z + uz * at + nz * side * 2.3, rot: Math.atan2(ux, uz)};
}

const lengthOf = pts => { let l = 0; for (let k = 1; k < pts.length; k++) l += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z); return l; };
const every2 = pts => {
 const out = [pts[0]];
 for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 2)); for (let t = 1; t <= n; t++) out.push({x: a.x + (b.x - a.x) * t / n, z: a.z + (b.z - a.z) * t / n}); }
 return out;
};
// Points a straight stretch does not need go: a street is sampled at every
// lie, and the path index's cells would carry every 2 m step of it. Within
// 5 cm of the line, every 16 m at the least.
function thinned(pts) {
 const out = [pts[0]];
 let i = 0;
 while (i < pts.length - 1) {
  let j = i + 1;
  for (let k = i + 2; k < pts.length && k - i <= 8; k++) {
   let ok = true;
   for (let m = i + 1; m < k && ok; m++) ok = segD(pts[m], pts[i], pts[k]) <= .05;
   if (ok) j = k; else break;
  }
  out.push(pts[j]);
  i = j;
 }
 return out;
}
// No fold: where the line turns back on itself (a street that overran a gate
// and came back to it) the tip goes, a little at a time, until it does not. A
// gate need not lie on the street; its lane reaches.
function unfolded(points) {
 const p = every2(points);
 for (let n = 0; n < 200; n++) {
  let at = -1;
  for (let i = 3; i + 3 < p.length && at < 0; i++) {
   const ux = p[i].x - p[i - 3].x, uz = p[i].z - p[i - 3].z, vx = p[i + 3].x - p[i].x, vz = p[i + 3].z - p[i].z;
   if (ux * vx + uz * vz < -.2 * Math.hypot(ux, uz) * Math.hypot(vx, vz)) at = i;
  }
  if (at < 0) break;
  p.splice(at - 2, 5);
 }
 return p;
}
// Corners rounded, point by point, each move kept only where `fits` says so;
// the ends stay. A point moved a hair is left, so a straight costs nothing.
function rounded(points, fits) {
 let pts = unfolded(points);
 for (let pass = 0; pass < 60 && worstTurn(pts) > STREET.turn; pass++) {
  pts = pts.map((p, i) => {
   if (i < 2 || i > pts.length - 3) return p;
   const q = {x: (pts[i - 2].x + pts[i - 1].x * 2 + p.x * 2 + pts[i + 1].x * 2 + pts[i + 2].x) / 8, z: (pts[i - 2].z + pts[i - 1].z * 2 + p.z * 2 + pts[i + 1].z * 2 + pts[i + 2].z) / 8};
   if (Math.hypot(q.x - p.x, q.z - p.z) < .02) return p;
   if (fits(pts[i - 1], q, pts[i + 1], p)) return q;
   const h = {x: (q.x + p.x) / 2, z: (q.z + p.z) / 2};
   return fits(pts[i - 1], h, pts[i + 1], p) ? h : p;
  });
 }
 return pts;
}

export function placeStreets({homes, roads, lot = null, holes, s, surface, height, halfX, halfZ, buildings = [], walls = []}) {
 const out = {streets: [], lanes: []};
 const drives = homes.filter(h => h.garage);
 if (!drives.length) return out;
 const grid = costGrid({holes, s, surface, streams: null, height, block: NO_DRIVE, dear: {}, pad: ROAD_MARGIN + 240, berth: true});
 const {nx, nz, cost} = grid;
 // The world's edge, and everything built, closed: a house 5 m round it, so
 // a street's edge clears the wall by 2.
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const p = grid.at(i, j); if (Math.abs(p.x) > halfX - 8 || Math.abs(p.z) > halfZ - 8) cost[j * nx + i] = Infinity; }
 const solid = [...homes, ...buildings], boxes = lot ? [...solid, lot] : solid;
 const eachCell = (b, r, fn) => { const [ci, cj] = grid.cellOf(b), n = Math.ceil(r / CELL); for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < nx && j < nz) fn(grid.at(i, j), j * nx + i); } };
 for (const b of boxes) eachCell(b, Math.hypot(b.width, b.depth) / 2 + 12, (p, k) => { if (inBuilding(b, p.x, p.z, 5)) cost[k] = Infinity; });
 for (const b of buildings) if (b.kind === 'clubhouse') eachCell(b, 90, (p, k) => { if (inForecourt(b, p.x, p.z, 40)) cost[k] = Infinity; });
 for (const w of walls) { const n = Math.ceil(Math.hypot(w.bx - w.ax, w.bz - w.az) / 3); for (let t = 0; t <= n; t++) { const [i, j] = grid.cellOf({x: w.ax + (w.bx - w.ax) * t / n, z: w.az + (w.bz - w.az) * t / n}); if (i >= 0 && j >= 0 && i < nx && j < nz) cost[j * nx + i] = Infinity; } }
 // The rough beside play is dear (not closed: holes can wall a row in): a
 // street goes round the end of a hole before it crosses the carry from a tee.
 for (const h of holes) for (let z = -20; z < h.length + 20; z += CELL) {
  const at = Math.max(0, Math.min(h.length, z)), half = h.width(at) + (s.semiRough ?? 6) + 18;
  for (let x = -half; x <= half; x += CELL) { const [i, j] = grid.cellOf(h.toWorld({x: h.center(at) + x, z})); if (i >= 0 && j >= 0 && i < nx && j < nz) { const k = j * nx + i; if (Number.isFinite(cost[k])) cost[k] = Math.max(cost[k], 8); } }
 }
 // What a road or lane may not touch: sampled as roadOnPlay samples, with
 // water and everything built besides.
 const hitsOf = (pts, width) => {
  const bad = [];
  for (let k = 1; k < pts.length; k++) {
   const a = pts[k - 1], b = pts[k], len = Math.hypot(b.x - a.x, b.z - a.z) || 1, n = Math.max(1, Math.ceil(len / 1.5)), ox = -(b.z - a.z) / len, oz = (b.x - a.x) / len;
   for (let i = 0; i <= n; i++) for (const o of [-width / 2, 0, width / 2]) {
    const t = i / n, x = a.x + (b.x - a.x) * t + ox * o, z = a.z + (b.z - a.z) * t + oz * o;
    if (NO_STREET.has(surface(x, z)) || solid.some(q => inBuilding(q, x, z, .5)) || walls.some(w => segDist(w, x, z) < 1)) bad.push({x, z});
   }
  }
  return bad;
 };
 const closeRound = hits => { for (const h of hits) { const [ci, cj] = grid.cellOf(h); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < nx && j < nz) cost[j * nx + i] = Infinity; } } };
 // A routed line from a to b, re-routed round anything thinner than a cell
 // it clipped (as the club's drive is), or null.
 const line = (a, b) => {
  for (let tries = 0; tries < 5; tries++) {
   const cells = grid.route(a, b);
   if (!cells?.length) return null;
   const ends = [cells[0], cells[cells.length - 1]].map(k => grid.at(k % nx, Math.floor(k / nx)));
   // The router gives up at the nearest cell it reaches: that is not b.
   if (Math.hypot(a.x - ends[0].x, a.z - ends[0].z) > 15 || Math.hypot(b.x - ends[1].x, b.z - ends[1].z) > 15) return null;
   const pts = [a, ...lineOf(grid, cells).slice(1, -1), b], hits = hitsOf(pts, STREET.width);
   if (!hits.length) return pts;
   closeRound(hits);
  }
  return null;
 };
 // A rounded point: open ground under the street's middle and edges, clear of
 // everything built (the grid's closed cells are wider than that, and a gate
 // in one could not be rounded at all), no steeper than the limit or, on ground
 // that already is, than the point it replaces.
 const fits = (a, q, b, was) => {
  if (boxes.some(o => inBuilding(o, q.x, q.z, STREET.width / 2 + .5)) || walls.some(w => segDist(w, q.x, q.z) < STREET.width / 2 + 1)) return false;
  const stepped = o => { const y = height(o.x, o.z), g = p => Math.abs(height(p.x, p.z) - y) / (Math.hypot(p.x - o.x, p.z - o.z) || 1); return Math.max(g(a), g(b)); };
  if (stepped(q) > Math.max(STREET.grade, 1.15 * stepped(was))) return false;
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1, ox = -(b.z - a.z) / l * STREET.width / 2, oz = (b.x - a.x) / l * STREET.width / 2;
  return !NO_STREET.has(surface(q.x, q.z)) && !NO_STREET.has(surface(q.x + ox, q.z + oz)) && !NO_STREET.has(surface(q.x - ox, q.z - oz));
 };
 // THE NETWORK SO FAR, a point every 4 m with its heading, for the nearest
 // join; the drive's first metres beside the lot are left out.
 const net = [];
 const joinNet = (pts, own) => {
  const fine = every2(pts);
  for (let k = 0; k < fine.length; k += 2) {
   const a = fine[Math.max(0, k - 1)], b = fine[Math.min(fine.length - 1, k + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, p = fine[k];
   if (!(lot && inBuilding(lot, p.x, p.z, 10))) net.push({x: p.x, z: p.z, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l, own});
  }
 };
 for (const r of roads) joinNet(r.points, r);
 // No road (an island with no straight dry edge): the lot's sides.
 if (!net.length && lot) {
  const rc = Math.cos(lot.rotation), rs = Math.sin(lot.rotation);
  for (const [su, sv] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const u = su * (lot.width / 2 + 1.5), v = sv * (lot.depth / 2 + 1.5); net.push({x: lot.x + u * rc + v * rs, z: lot.z - u * rs + v * rc, dx: 0, dz: 0, own: lot}); }
 }
 if (!net.length) { for (const h of drives) h.garage = false; return out; }
 const nearestNet = (p, skip = null) => {
  let best = null, d = Infinity;
  for (const q of net) { if (q.own === skip) continue; const e = Math.hypot(q.x - p.x, q.z - p.z); if (e < d) { d = e; best = q; } }
  return best && {...best, d};
 };
 // A street meets what it joins at a slant: on along the host, the way it
 // arrives, where it would otherwise meet it square. `pts` starts on the host.
 const slanted = (pts, j) => {
  if (!j.dx && !j.dz) return pts;
  const far = pts[Math.min(pts.length - 1, 3)], ax = pts[0].x - far.x, az = pts[0].z - far.z, al = Math.hypot(ax, az) || 1, cos = (ax * j.dx + az * j.dz) / al;
  if (Math.abs(cos) > Math.cos(JOIN_MERGE * Math.PI / 180)) return pts;
  const sg = cos >= 0 ? 1 : -1, on = {x: pts[0].x + j.dx * sg * STREET.merge, z: pts[0].z + j.dz * sg * STREET.merge};
  return (nearestNet(on)?.d ?? 99) < 3 && Number.isFinite(grid.costAt(on.x, on.z)) ? [on, ...pts] : pts;
 };
 // Rounded if that is clean, else the routed line as it is, which is.
 const shaped = pts => { const p = rounded(pts, fits); return hitsOf(p, STREET.width).length ? pts : thinned(p); };

 // Rows: nearest to the network first, each from its nearer end.
 const rows = new Map();
 for (const h of drives) { const k = `${h.hole}:${h.side}`; if (!rows.has(k)) rows.set(k, []); const E = driveEnd(h); rows.get(k).push({h, at: {x: E.x + E.dx * STREET.off, z: E.z + E.dz * STREET.off}}); }
 let pending = [...rows.values()].map(r => r.sort((a, b) => a.h.along - b.h.along));
 const reached = g => { const E = driveEnd(g.h); return (nearestNet(E)?.d ?? 99) < STREET.near; };
 for (let guard = 0; guard < 400 && pending.length; guard++) {
  pending = pending.map(r => r.filter(g => !reached(g))).filter(r => r.length);
  if (!pending.length) break;
  let best = null;
  for (const r of pending) for (const end of [0, r.length - 1]) { const d = nearestNet(r[end].at).d; if (!best || d < best.d) best = {r, end, d}; }
  const row = best.end ? [...best.r].reverse() : best.r;
  pending = pending.filter(r => r !== best.r);
  const j = nearestNet(row[0].at), head = line(j, row[0].at);
  if (!head) { if (row.length > 1) pending.push(row.slice(1)); continue; }
  let pts = head, i = 1;
  for (; i < row.length; i++) { const leg = line(row[i - 1].at, row[i].at); if (!leg) break; pts = pts.concat(leg.slice(1)); }
  if (i < row.length) pending.push(row.slice(i));
  const street = {kind: 'street', width: STREET.width, points: shaped(slanted(pts, j))};
  out.streets.push(street);
  joinNet(street.points, street);
 }
 // THE FAR ENDS: on to the next street where one is close and the way is
 // not a long way round, else a cul-de-sac (paths.js's teardrop), where one
 // fits within the last 30 m; else, on ground too tight to turn on, it stops.
 for (const street of out.streets) {
  const pts = every2(street.points), E = pts[pts.length - 1];
  const j = nearestNet(E, street);
  if (j && j.d < 3) continue;
  // Onward: not back the way it came (its heading turned less than 100
  // degrees), nor to where it started.
  const P = pts[Math.max(0, pts.length - 4)], S = pts[0];
  const link = j && j.d <= STREET.link && Math.hypot(j.x - S.x, j.z - S.z) > 60 && (j.x - E.x) * (E.x - P.x) + (j.z - E.z) * (E.z - P.z) > -.17 * j.d * Math.hypot(E.x - P.x, E.z - P.z) ? line(E, j) : null;
  if (link && lengthOf(link) <= 2.2 * Math.max(j.d, 30)) {
   const whole = shaped([...slanted(link.slice().reverse(), j), ...pts.slice().reverse().slice(1)]);
   street.points = whole.reverse();
   joinNet(link, street);
   continue;
  }
  let done = false;
  for (let back = 0; back <= 15 && !done && back + 4 < pts.length; back += 3) {
   const k = pts.length - 1 - back, T = pts[k], B = pts[k - 3], dl = Math.hypot(T.x - B.x, T.z - B.z) || 1, d = {x: (T.x - B.x) / dl, z: (T.z - B.z) / dl};
   for (const R of STREET.loops) for (const side of [1, -1]) {
    if (done) break;
    const n = {x: -d.z * side, z: d.x * side}, L = 2.6 * R, W = R / .65, cand = [];
    for (let i = 1; i <= 36; i++) { const t = i / 36 * Math.PI * 2, u = L * (1 - Math.cos(t)) / 2, v = W * Math.sin(t) * (1 - Math.cos(t)) / 2; cand.push({x: T.x + d.x * u + n.x * v, z: T.z + d.z * u + n.z * v}); }
    if (cand.some((p, i) => !fits(i ? cand[i - 1] : T, p, cand[Math.min(35, i + 1)], p) || (nearestNet(p, street)?.d ?? 99) < STREET.width + 2) || hitsOf([T, ...cand], STREET.width).length) continue;
    street.points = thinned([...pts.slice(0, k + 1), ...cand]);
    joinNet(cand, street);
    done = true;
   }
  }
 }
 // THE LANES: along the drive's own line to the first street it meets, else
 // straight to the nearest; no way there, no drive.
 const ways = [...roads.filter(r => r.kind !== 'lane'), ...out.streets];
 // The far ends moved some streets: the network as it now lies.
 if (out.streets.length) { net.length = 0; for (const r of ways) joinNet(r.points, r); }
 for (const h of drives) {
  const E = driveEnd(h);
  let hit = null, t = Infinity, back = 0;
  for (const r of ways) for (let k = 1; k < r.points.length; k++) {
   const a = r.points[k - 1], b = r.points[k], ex = b.x - a.x, ez = b.z - a.z, den = E.dx * ez - E.dz * ex;
   if (Math.abs(den) < 1e-9) continue;
   const u = ((a.x - E.x) * ez - (a.z - E.z) * ex) / den, v = ((a.x - E.x) * E.dz - (a.z - E.z) * E.dx) / den;
   if (u > .5 && u < t && u <= STREET.reach && v >= 0 && v <= 1) { t = u; hit = {x: E.x + E.dx * u, z: E.z + E.dz * u}; back = r.width / 2 / (Math.abs(den) / Math.hypot(ex, ez)); }
  }
  if (!hit) {
   const q = nearestNet(E);
   if (q && q.d <= STREET.reach) { hit = {x: q.x, z: q.z}; back = (q.own.kind ? q.own.width / 2 : 0) / Math.max(.3, Math.abs(((q.x - E.x) * q.dz - (q.z - E.z) * q.dx) / (q.d || 1))); }
  }
  // Checked to the street's middle, drawn to its near edge: the street's strip
  // has no middle, so a lane laid on the ground under it comes through on a
  // crown (seen in the first pictures).
  if (!hit || hitsOf([E, hit], STREET.lane).length) { h.garage = false; continue; }
  h.lane = hit;
  const len = Math.hypot(hit.x - E.x, hit.z - E.z), keep = Math.max(.5, len - Math.min(back, 12) + .25) / (len || 1);
  out.lanes.push({kind: 'lane', width: STREET.lane, points: [{x: E.x, z: E.z}, {x: E.x + (hit.x - E.x) * keep, z: E.z + (hit.z - E.z) * keep}]});
 }
 return out;
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
// Every place a road or lane runs through a house or a building: the bench's
// `roadOnHouse`, sampled as roadOnPlay is.
export function roadOnHouse({roads = [], homes = [], buildings = []}) {
 const bad = [], solid = [...homes, ...buildings];
 for (const r of roads) for (let k = 1; k < r.points.length; k++) {
  const a = r.points[k - 1], b = r.points[k], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 3)), nx = -(b.z - a.z) / (len || 1), nz = (b.x - a.x) / (len || 1);
  for (let i = 0; i <= n; i++) for (const o of [-r.width / 2, 0, r.width / 2]) {
   const t = i / n, x = a.x + (b.x - a.x) * t + nx * o, z = a.z + (b.z - a.z) * t + nz * o;
   if (solid.some(q => inBuilding(q, x, z, 0))) bad.push({kind: r.kind, x, z});
  }
 }
 return bad;
}
export {segD as roadSegmentDistance};
