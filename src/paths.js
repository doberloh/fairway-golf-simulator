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
 const half = z => side > 0 ? h.leftWidth(z) : h.rightWidth(z);
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
export function routePaths({holes, s, surface, streams}) {
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
  for (const k of [0, 3, -3, 6, -6, 10, -10, 15, -15, 20, -20]) {
   const x = p.x + nx * k, z = p.z + nz * k, s0 = surface(x, z);
   if (!KEEP_OFF.has(s0) || (s0 === 'water' && streams?.at?.(x, z))) { found = {x, z}; break; }
  }
  if (found) kept.push(found);
 }
 const points = smoothLine(kept, 2);
 // Bridges: a run of points over a creek or river becomes one bridge.
 const bridges = [];
 let start = -1;
 const wet = p => { const st = streams?.at?.(p.x, p.z); return !!st && st.edge <= 1.2; };
 for (let i = 0; i <= points.length; i++) {
  const w = i < points.length && wet(points[i]);
  if (w && start < 0) start = i;
  if (!w && start >= 0) {
   const a = points[Math.max(0, start - 1)], b = points[Math.min(points.length - 1, i)];
   bridges.push({x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, angle: Math.atan2(b.x - a.x, b.z - a.z), span: Math.hypot(b.x - a.x, b.z - a.z) + 4, width: width + 1});
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
