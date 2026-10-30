// CART PATHS (architect-courses, phase 2; the study, workstream H; absorbs the
// IDEAS entry *Cart paths*). An Architect course's paths: down each hole on
// its bail-out side, out of play beyond the rough, round its hazards, past the
// green to a pull-off, and on to the next tee -- where a cart path at a real
// course runs (USGA: near where shots land but out of play, close to tees, a
// pull-off by greens; about 8 ft wide). A creek crossed gets a bridge.
//
// A path is world data: the lie is "Cart path" (grounds.js `path`), trees and
// houses keep off it, the renderer lays a strip along it, and a ball that
// comes to rest on it gets free relief (relief.js `pathRelief`). Classic has
// none -- generation only builds paths for an Architect course.
//
// Pure: no DOM, no three.js. tests/paths.test.mjs.

const STEP = 8;           // metres between path points, before smoothing
// Width by club (PLACED within the study's 8 ft norm and the 48 in accessible
// route): a municipal course's narrower, a resort's wide enough for two carts.
const WIDTH = {municipal: 2.1, members: 2.4, resort: 3.0, championship: 2.6};
// What the path is made of, by landscape (PLACED): the study's paths table.
export const PATH_KINDS = {
 pnw: 'bark', redwood: 'bark', desert: 'granite', island: 'shell', links: 'gravel', lakeshore: 'boardwalk',
 midwest: 'asphalt', autumn: 'asphalt', mountain: 'gravel', haunted: 'gravel',
};
// Surfaces a path may never take (it bends round them): greens, tees, sand,
// water and the fringe round a green.
const KEEP_OFF = new Set(['green', 'fringe', 'tee', 'sand', 'water']);

// Chaikin's corner cutting: smooth the polyline, keeping its ends.
function smoothLine(points, passes = 2) {
 let p = points;
 for (let k = 0; k < passes; k++) {
  if (p.length < 3) return p;
  const out = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
   const a = p[i], b = p[i + 1];
   out.push({x: a.x * .75 + b.x * .25, z: a.z * .75 + b.z * .25}, {x: a.x * .25 + b.x * .75, z: a.z * .25 + b.z * .75});
  }
  out.push(p[p.length - 1]);
  p = out;
 }
 return p;
}

// One hole's run, in its own local frame: tee to green on `side`, then the
// pull-off and round the back of the green.
function holeRun(h, side, semi, clear) {
 const pts = [], tees = Object.values(h.tees), minTee = Math.min(...tees.map(t => t.z));
 const half = z => side < 0 ? h.leftWidth(z) : h.rightWidth(z);
 const gr = (h.greenSize ?? 15) * (h.greenAspect ?? 1.1);
 const end = h.length - gr - 18;
 for (let z = minTee - 10; z <= end; z += STEP) {
  let off = Math.max(half(Math.max(0, z)), 9) + semi + 14;
  // Out of play round the hole's own hazards: step outward until clear.
  for (let k = 0; k < 8 && !clear(h, h.center(Math.max(0, z)) + side * off, z); k++) off += 4;
  pts.push({x: h.center(Math.max(0, Math.min(h.length, z))) + side * off, z});
 }
 const g = h.green;
 pts.push({x: g.x + side * (gr + 13), z: h.length - gr * .3});
 pts.push({x: g.x + side * (gr + 11), z: h.length + gr * .6});
 pts.push({x: g.x + side * (gr * .4), z: h.length + gr + 13});
 return pts;
}
const hazardClear = (h, x, z) => !h.ponds.some(p => Math.hypot(x - p.x, z - p.z) < Math.max(p.rx, p.rz) + 10)
 && !h.bunkers.some(b => Math.hypot(x - b.x, z - b.z) < Math.max(b.rx, b.rz) + 6);

// The paths of a course. `holes` are routed (they have `toWorld`); `surface`
// is the world's surface without paths; `streams` its creeks and rivers.
export function routePaths({holes, s, surface, streams, ravines = []}) {
 if (!holes?.length) return {paths: [], bridges: []};
 const width = WIDTH[s.archClub] ?? WIDTH.members, semi = s.semiRough ?? 6;
 const sideOf = h => h.design?.preferred === 'left' ? -1 : 1;
 const runs = holes.map(h => holeRun(h, sideOf(h), semi, hazardClear).map(p => h.toWorld(p)));
 const raw = [];
 runs.forEach((run, i) => {
  raw.push(...run);
  const next = runs[i + 1];
  if (!next) return;
  // The connector to the next tee: straight, sampled every STEP.
  const a = run[run.length - 1], b = next[0], d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(d / STEP));
  for (let k = 1; k < n; k++) raw.push({x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n});
 });
 // Off greens, tees, sand and water: push a point sideways, across the line,
 // until it is clear, or drop it.
 const kept = [];
 for (let i = 0; i < raw.length; i++) {
  const p = raw[i], q = raw[Math.min(raw.length - 1, i + 1)], o = raw[Math.max(0, i - 1)];
  const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
  let found = null;
  // Dry ground first. A creek's water is taken only when none lies across
  // the line within 20 m -- where the path really crosses it. Taking it as
  // readily as dry ground ran paths, and their bridges, 30 m along creek
  // banks (phase 5's first bridge capture).
  const OFFSETS = [0, 3, -3, 6, -6, 10, -10, 15, -15, 20, -20];
  for (const k of OFFSETS) {
   const x = p.x + nx * k, z = p.z + nz * k;
   if (!KEEP_OFF.has(surface(x, z))) { found = {x, z}; break; }
  }
  if (!found && surface(p.x, p.z) === 'water' && streams?.at?.(p.x, p.z)) found = {x: p.x, z: p.z};
  if (found) kept.push(found);
 }
 // Smoothing can carry a point back over the edge it was pushed off (a
 // bunker's lobe reaching toward the path: phase 3), so the same push runs
 // again on the smoothed line.
 const points = smoothLine(kept, 2).map((p, i, all) => {
  if (!KEEP_OFF.has(surface(p.x, p.z)) || (surface(p.x, p.z) === 'water' && streams?.at?.(p.x, p.z))) return p;
  const q = all[Math.min(all.length - 1, i + 1)], o = all[Math.max(0, i - 1)], dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
  for (const k of [2, -2, 4, -4, 7, -7, 11, -11]) { const x = p.x - dz / l * k, z = p.z + dx / l * k; if (!KEEP_OFF.has(surface(x, z))) return {x, z}; }
  return p;
 });
 // Bridges: a run of points over a creek or river becomes one bridge.
 const bridges = [];
 let start = -1;
 // In the water itself; the deck runs 3 m onto each bank (iteration 6: a
 // bank within 1.2 m counted as wet, and bridges ran along creeks).
 // A barranca's ravine (phase 6) is bridged the same way, where it is more
 // than about a metre and a half deep.
 const inRavine = p => ravines.some(r => { const dx = r.bx - r.ax, dz = r.bz - r.az, t = Math.max(0, Math.min(1, ((p.x - r.ax) * dx + (p.z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - r.ax - dx * t, p.z - r.az - dz * t) < r.r * .62; });
 const wet = p => { const st = streams?.at?.(p.x, p.z); return (!!st && st.edge <= 0) || inRavine(p); };
 for (let i = 0; i <= points.length; i++) {
  const w = i < points.length && wet(points[i]);
  if (w && start < 0) start = i;
  if (!w && start >= 0) {
   const a = points[Math.max(0, start - 1)], b = points[Math.min(points.length - 1, i)];
   bridges.push({x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, angle: Math.atan2(b.x - a.x, b.z - a.z), span: Math.hypot(b.x - a.x, b.z - a.z) + 6, width: width + 1});
   start = -1;
  }
 }
 return {paths: [{points, width, kind: PATH_KINDS[s.biome] || 'asphalt'}], bridges};
}

// Nearest-path queries on a grid of segments, as quick as the lie needs.
export function pathIndex(paths, cell = 16) {
 const grid = new Map(), key = (i, j) => i + ',' + j;
 const segs = [];
 for (const path of paths) for (let i = 0; i + 1 < path.points.length; i++) {
  const a = path.points[i], b = path.points[i + 1], seg = {a, b, path};
  segs.push(seg);
  const i0 = Math.floor(Math.min(a.x, b.x) / cell) - 1, i1 = Math.floor(Math.max(a.x, b.x) / cell) + 1;
  const j0 = Math.floor(Math.min(a.z, b.z) / cell) - 1, j1 = Math.floor(Math.max(a.z, b.z) / cell) + 1;
  for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) { const k = key(ii, jj); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(seg); }
 }
 // Distance from (x, z) to the nearest path's centre line, and that path.
 const at = (x, z) => {
  const list = grid.get(key(Math.floor(x / cell), Math.floor(z / cell)));
  if (!list) return null;
  let best = null;
  for (const s of list) {
   const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, l2 = dx * dx + dz * dz || 1;
   const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / l2));
   const d = Math.hypot(x - (s.a.x + dx * t), z - (s.a.z + dz * t));
   if (!best || d < best.d) best = {d, path: s.path};
  }
  return best;
 };
 return {at, onPath: (x, z) => { const q = at(x, z); return !!q && q.d <= q.path.width / 2; }, segments: segs.length};
}

// THE PATH TO THE CLUBHOUSE (clubhouse.js): from its door -- the middle of its
// front, a few metres out -- to where the course's path begins at the first
// tee, and back from the last green to the door. Straight, sampled every STEP
// and softened where it meets the course's path.
export function linkBuilding(path, b) {
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), out = b.depth / 2 + 5;
 // The front is the building's local -z (clubhouse.js faces it to the tee).
 const door = {x: b.x - sn * out, z: b.z - cs * out};
 const run = (a, c) => {
  const d = Math.hypot(c.x - a.x, c.z - a.z), n = Math.max(1, Math.round(d / STEP)), pts = [];
  for (let k = 0; k <= n; k++) pts.push({x: a.x + (c.x - a.x) * k / n, z: a.z + (c.z - a.z) * k / n});
  return pts;
 };
 const p = path.points;
 if (!p.length) return path;
 const head = smoothLine(run(door, p[0]).slice(0, -1), 1), tail = smoothLine(run(p[p.length - 1], door).slice(1), 1);
 path.points = [...head, ...p, ...tail];
 path.door = door;
 return path;
}
