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

import {ARCHITECT, ARCHITECT_GENERIC} from './biomes.js';

// Width by club (PLACED within the study's 8 ft norm and the 48 in accessible
// route): a municipal course's narrower, a resort's wide enough for two carts.
const WIDTH = {municipal: 2.1, members: 2.4, resort: 3.0, championship: 2.6};
// What the path is made of, by landscape (PLACED): the study's paths table.
// Each landscape's path surface is its architect block's (biomes.js).
export const PATH_KINDS = Object.fromEntries(Object.entries(ARCHITECT).map(([k, a]) => [k, a.path]));
// THE PATH NETWORK, ROUTED (the owner's review, 30 October 2026: "spaghetti",
// paths across greens, tees and fairways, unnatural turns, unwalkable
// slopes). A cost grid over the course, CELL metres a side, and A* across it:
//
//   blocked   greens, fringes, tees, sand, ponds, ground steeper than MAX_GRADE
//   dear      fairway (x9) and semi-rough (x5) -- crossed only where a leg
//             must, and then the short way; a creek (x30, bridged); the 22 m
//             round every green's collar (up to +8) and the 10 m round a tee
//   cheap     ground a path already takes (x0.3), so later legs join the
//             network rather than lay a second line beside it
//   slope     every step pays for its grade above 8%
//
// Then the cells become a line: pulled straight wherever a straight segment
// is no dearer than the cells it replaces, rounded (Chaikin), and checked
// again -- a rounding that touches anything blocked keeps the pulled line.
// All weights PLACED.

export const CELL = 6;
export const MAX_GRADE = .22;
const BLOCKED = new Set(['green', 'fringe', 'tee', 'sand']);
const DEAR = {fairway: 9, semi: 5};

// A binary heap on f, over cell indices.
function heap() {
 const idx = [], f = [];
 return {
  size: () => idx.length,
  push(i, v) { idx.push(i); f.push(v); let k = idx.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (f[p] <= f[k]) break; [idx[p], idx[k]] = [idx[k], idx[p]]; [f[p], f[k]] = [f[k], f[p]]; k = p; } },
  pop() { const top = idx[0], li = idx.pop(), lf = f.pop(); if (idx.length) { idx[0] = li; f[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < idx.length && f[l] < f[m]) m = l; if (r < idx.length && f[r] < f[m]) m = r; if (m === k) break; [idx[m], idx[k]] = [idx[k], idx[m]]; [f[m], f[k]] = [f[k], f[m]]; k = m; } } return top; },
 };
}

export function costGrid({holes, s, surface, streams, height, ravines = []}) {
 let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
 const greens = [], tees = [];
 for (const h of holes) {
  const g = h.worldGreen ?? h.toWorld(h.green);
  greens.push({x: g.x, z: g.z, r: (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + (s.fringe ?? 2) + (s.semiRough ?? 6)});
  for (const t of Object.values(h.tees)) { const w = h.toWorld(t); tees.push(w); }
  for (const p of [g, ...tees.slice(-3)]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
 }
 x0 -= 140; x1 += 140; z0 -= 140; z1 += 140;
 const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
 const cost = new Float32Array(nx * nz), y = new Float32Array(nx * nz), used = new Uint8Array(nx * nz);
 const inRavine = (x, z) => ravines.some(r => { const dx = r.bx - r.ax, dz = r.bz - r.az, t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) < r.r; });
 // Cells a bridge spans: the whole width of a ravine, wall to wall. The
 // grade rule does not apply there -- the deck is level (the template test:
 // the walls are steeper than MAX_GRADE, so the path always walked round the
 // ravine's end and no bridge was ever built).
 const span = new Uint8Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i, x = x0 + i * CELL, z = z0 + j * CELL, sf = surface(x, z);
  y[k] = height ? height(x, z) : 0;
  if (BLOCKED.has(sf)) { cost[k] = Infinity; continue; }
  let c = DEAR[sf] ?? 1;
  if (sf === 'water') { const st = streams?.at?.(x, z); c = st ? 30 : Infinity; }
  else if (inRavine(x, z)) { c = Math.max(c, 30); span[k] = 1; }
  for (const g of greens) { const d = Math.hypot(x - g.x, z - g.z) - g.r; if (d < 22) c += 8 * (1 - Math.max(0, d) / 22); }
  for (const t of tees) { const d = Math.hypot(x - t.x, z - t.z); if (d < 10) c += 4 * (1 - d / 10); }
  cost[k] = c;
 }
 // A margin a cell wide round everything blocked (iteration 4: a cell knows
 // only its centre, and a line between two open cells clipped a bunker edge).
 const margin = [];
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  if (Number.isFinite(cost[j * nx + i])) continue;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && Number.isFinite(cost[jj * nx + ii])) margin.push(jj * nx + ii); }
 }
 for (const k of margin) cost[k] = Math.max(cost[k], 15);
 const cellOf = p => [Math.round((p.x - x0) / CELL), Math.round((p.z - z0) / CELL)];
 const at = (i, j) => ({x: x0 + i * CELL, z: z0 + j * CELL});
 const costAt = (x, z) => { const [i, j] = cellOf({x, z}); return i < 0 || j < 0 || i >= nx || j >= nz ? Infinity : cost[j * nx + i]; };
 // The nearest open cell to a point, within 40 m.
 const snap = p => {
  const [ci, cj] = cellOf(p);
  let best = null;
  for (let r = 0; r <= 7 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
   if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
   const i = ci + di, j = cj + dj;
   if (i < 0 || j < 0 || i >= nx || j >= nz || !Number.isFinite(cost[j * nx + i]) || cost[j * nx + i] > 4) continue;
   const d = di * di + dj * dj;
   if (!best || d < best.d) best = {i, j, d};
  }
  return best && [best.i, best.j];
 };
 const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
 // A* from a to b; the cells, or null.
 const route = (a, b) => {
  const A = snap(a), B = snap(b);
  if (!A || !B) return null;
  const start = A[1] * nx + A[0], goal = B[1] * nx + B[0];
  const g = new Float32Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
  const H = k => Math.hypot((k % nx) - B[0], Math.floor(k / nx) - B[1]) * CELL * .3;
  const open = heap();
  g[start] = 0; open.push(start, H(start));
  while (open.size()) {
   const k = open.pop();
   if (done[k]) continue;
   if (k === goal) break;
   done[k] = 1;
   const i = k % nx, j = Math.floor(k / nx);
   for (const [di, dj] of N8) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
    const n = jj * nx + ii;
    if (done[n] || !Number.isFinite(cost[n])) continue;
    const step = Math.hypot(di, dj) * CELL;
    // The grade end to end and through the midpoint (iteration 5: a crag edge
    // between two cell centres put a 30% step on a Redwood path).
    let grade = Math.abs(y[n] - y[k]) / step;
    if (height) { const mx = x0 + (i + di / 2) * CELL, mz = z0 + (j + dj / 2) * CELL, ym = height(mx, mz); grade = Math.max(grade, Math.abs(ym - y[k]) / (step / 2), Math.abs(y[n] - ym) / (step / 2)); }
    if (grade > MAX_GRADE && !span[k] && !span[n]) continue;
    const c = ((used[k] ? .3 : cost[k]) + (used[n] ? .3 : cost[n])) / 2 * (span[k] || span[n] ? 1 : 1 + 25 * Math.max(0, grade - .08));
    const v = g[k] + step * c;
    if (v < g[n]) { g[n] = v; from[n] = k; open.push(n, v + H(n)); }
   }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const cells = [];
  for (let k = goal; k >= 0; k = from[k]) { cells.push(k); if (k === start) break; }
  return cells.reverse();
 };
 // The ground between cells, bilinear, for the grade a straightened line climbs.
 const heightAt = height || ((x, z) => { const u = (x - x0) / CELL, v = (z - z0) / CELL, i = Math.max(0, Math.min(nx - 2, Math.floor(u))), j = Math.max(0, Math.min(nz - 2, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j)); const k = j * nx + i; return (y[k] * (1 - fu) + y[k + 1] * fu) * (1 - fv) + (y[k + nx] * (1 - fu) + y[k + nx + 1] * fu) * fv; });
 const spanAt = (x, z) => { const [i, j] = cellOf({x, z}); return i >= 0 && j >= 0 && i < nx && j < nz && span[j * nx + i] === 1; };
 return {nx, nz, cost, used, route, at, costAt, cellOf, x0, z0, heightAt, spanAt};
}

// Cells to a line: pulled straight where it is no dearer, then rounded.
export function lineOf(grid, cells) {
 const pts = cells.map(k => grid.at(k % grid.nx, Math.floor(k / grid.nx)));
 if (pts.length < 3) return pts;
 // Its dearest ground, or Infinity where it climbs steeper than MAX_GRADE
 // (iteration 2: a straightened line checked only the ground it crossed, and
 // took a few steps steeper than 25%).
 const segmentCost = (a, b) => { let worst = 0; const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2)); let prev = grid.heightAt(a.x, a.z); for (let t = 0; t <= n; t++) { const x = a.x + (b.x - a.x) * t / n, z = a.z + (b.z - a.z) * t / n, c = grid.costAt(x, z); worst = Math.max(worst, c); if (t) { const h = grid.heightAt(x, z); if (Math.abs(h - prev) / (d / n) > MAX_GRADE && !grid.spanAt?.(x, z)) return Infinity; prev = h; } } return worst; };
 const pulled = [pts[0]];
 let i = 0;
 while (i < pts.length - 1) {
  let j = i + 1, own = 0;
  for (let k = i + 1; k < pts.length; k++) {
   own = Math.max(own, grid.costAt(pts[k].x, pts[k].z));
   // Up to 24 cells, and a little dearer than the cells it replaces
   // (iteration 6: at +0.5 and 12 cells, a straight run was refused for
   // brushing a green's wider berth, and the line jogged round it).
   if (k - i > 24) break;
   if (segmentCost(pts[i], pts[k]) <= own + 2) j = k;
  }
  pulled.push(pts[j]);
  i = j;
 }
 // Rounded corner by corner (Chaikin, three passes): a corner is cut only
 // where both new segments touch nothing blocked and climb nothing too steep,
 // and kept sharp otherwise (iteration 3: rounding the whole line or none
 // left whole lines with stair-step corners).
 let round = pulled;
 for (let pass = 0; pass < 3; pass++) {
  if (round.length < 3) break;
  const out = [round[0]];
  for (let k = 1; k < round.length - 1; k++) {
   const o = round[k - 1], p = round[k], n = round[k + 1];
   const c1 = {x: o.x * .25 + p.x * .75, z: o.z * .25 + p.z * .75}, c2 = {x: p.x * .75 + n.x * .25, z: p.z * .75 + n.z * .25};
   if (Number.isFinite(segmentCost(out[out.length - 1], c1)) && Number.isFinite(segmentCost(c1, c2)) && Number.isFinite(segmentCost(c2, n))) out.push(c1, c2);
   else out.push(p);
  }
  out.push(round[round.length - 1]);
  round = out;
 }
 return round;
}

// Where a hole's leg starts and ends, in the world: beside its tees on its
// preferred side, out past the tee boxes' collar; and a pull-off beside the
// green, well off its collar, a little short of its middle.
function waypoints(h, s) {
 const side = h.design?.preferred === 'left' ? -1 : 1, semi = s.semiRough ?? 6;
 const tees = Object.values(h.tees), zt = tees.reduce((a, t) => a + t.z, 0) / tees.length;
 const half = Math.max(h.leftWidth(Math.max(0, zt)), h.rightWidth(Math.max(0, zt)), 12);
 const gr = (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + (s.fringe ?? 2) + semi;
 return {
  tee: h.toWorld({x: h.center(Math.max(0, zt)) + side * (half * .6 + 16), z: zt}),
  green: h.toWorld({x: h.green.x + side * (gr + 18), z: h.green.z - gr * .4}),
 };
}

// The paths of a course. `holes` are routed (they have `toWorld`); `surface`
// is the world's surface without paths; `streams` its creeks and rivers;
// `height` the ground. Returns the network as pieces (each a path), the
// bridges, and `connect` -- the same router, for the clubhouse's link.
export function routePaths({holes, s, surface, streams, ravines = [], height = null}) {
 if (!holes?.length) return {paths: [], bridges: [], connect: () => null};
 const width = WIDTH[s.archClub] ?? WIDTH.members, kind = PATH_KINDS[s.biome] || ARCHITECT_GENERIC.path;
 const grid = costGrid({holes, s, surface, streams, height, ravines});
 const pieces = [];
 // A leg's cells become pieces: runs of cells no earlier leg took, each with
 // a cell of overlap at either end so the network stays joined.
 const lay = cells => {
  if (!cells?.length) return;
  let run = [];
  const flush = () => { if (run.length >= 2) pieces.push(lineOf(grid, run)); run = []; };
  cells.forEach((k, n) => {
   if (grid.used[k] && run.length) { run.push(k); flush(); }
   else if (!grid.used[k]) { if (!run.length && n > 0) run.push(cells[n - 1]); run.push(k); }
  });
  flush();
  for (const k of cells) grid.used[k] = 1;
 };
 const ends = holes.map(h => waypoints(h, s));
 holes.forEach((h, i) => {
  lay(grid.route(ends[i].tee, ends[i].green));
  if (ends[i + 1]) lay(grid.route(ends[i].green, ends[i + 1].tee));
 });
 const paths = pieces.filter(p => p.length >= 2).map(points => ({points, width, kind}));
 // Bridges: a run of points over a creek or a ravine, on each piece.
 const inRavine = p => ravines.some(r => { const dx = r.bx - r.ax, dz = r.bz - r.az, t = Math.max(0, Math.min(1, ((p.x - r.ax) * dx + (p.z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - r.ax - dx * t, p.z - r.az - dz * t) < r.r; });
 const wet = p => { const st = streams?.at?.(p.x, p.z); return (!!st && st.edge <= 0) || inRavine(p); };
 const bridges = [];
 for (const path of paths) {
  // Resampled every 2 m so a narrow creek between two points is not missed.
  const pts = [];
  path.points.forEach((p, k) => { if (k) { const o = path.points[k - 1], n = Math.max(1, Math.ceil(Math.hypot(p.x - o.x, p.z - o.z) / 2)); for (let t = 1; t <= n; t++) pts.push({x: o.x + (p.x - o.x) * t / n, z: o.z + (p.z - o.z) * t / n}); } else pts.push(p); });
  let start = -1;
  for (let i = 0; i <= pts.length; i++) {
   const w = i < pts.length && wet(pts[i]);
   if (w && start < 0) start = i;
   if (!w && start >= 0) {
    const a = pts[Math.max(0, start - 1)], b = pts[Math.min(pts.length - 1, i)];
    bridges.push({x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, angle: Math.atan2(b.x - a.x, b.z - a.z), span: Math.hypot(b.x - a.x, b.z - a.z) + 6, width: width + 1});
    start = -1;
   }
  }
 }
 const connect = (a, b) => { const cells = grid.route(a, b); if (!cells?.length) return null; const line = lineOf(grid, cells); for (const k of cells) grid.used[k] = 1; return line; };
 return {paths, bridges, connect};
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
// front, a few metres out -- to the nearest point of the network, routed like
// the rest (a straight line from the door crossed whatever lay between). A
// piece of its own; `door` marks it.
export function linkBuilding(paths, b, connect) {
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), out = b.depth / 2 + 5;
 // The front is the building's local -z (clubhouse.js faces it to the tee).
 const door = {x: b.x - sn * out, z: b.z - cs * out};
 let near = null;
 for (const p of paths) for (const q of p.points) { const d = Math.hypot(q.x - door.x, q.z - door.z); if (!near || d < near.d) near = {d, q}; }
 if (!near) return null;
 const line = connect?.(door, near.q) || [door, near.q];
 const piece = {points: [door, ...line.slice(1)], width: paths[0].width, kind: paths[0].kind, door};
 paths.push(piece);
 return piece;
}
