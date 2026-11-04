// CART PATHS (architect-courses, phase 2; the study, workstream H; absorbs the
// IDEAS entry *Cart paths*). A course's paths: down each hole on
// its bail-out side, out of play beyond the rough, round its hazards, past the
// green to a pull-off, and on to the next tee -- where a cart path at a real
// course runs (USGA: near where shots land but out of play, close to tees, a
// pull-off by greens; about 8 ft wide). A creek crossed gets a bridge.
//
// A path is world data: the lie is "Cart path" (grounds.js `path`), trees and
// houses keep off it, the renderer lays a strip along it, and a ball that
// comes to rest on it gets free relief (relief.js `pathRelief`). Every
// generated course has them since Architect was removed (2 November 2026);
// before, only an Architect course did. The range has none.
//
// Pure: no DOM, no three.js. tests/paths.test.mjs.

import {worldOf, WORLD_GENERIC} from './biomes.js';

// Width by club (PLACED within the study's 8 ft norm and the 48 in accessible
// route): a municipal course's narrower, a resort's wide enough for two carts.
const WIDTH = {municipal: 2.1, members: 2.4, resort: 3.0, championship: 2.6};
// What the path is made of, by landscape (PLACED): the study's paths table.
// Each landscape's path surface is its architect block's (biomes.js).
export const pathKind = key => worldOf(key).path || WORLD_GENERIC.path;
// Looked up by landscape through worldOf, never by the key in a table: the
// tables are the regions' (step 2 of the US landscapes goal moved them, and
// a lookup by landscape key found nothing for seven of the nine).
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

// THE NETWORK'S SHAPE (the owner, 2 November 2026: no right angles, no dead
// ends; `shape` in routePaths). PLACED: no 4 m of path turns more than
// MAX_TURN degrees (a radius of about 5 m); a join steeper than JOIN_MERGE
// slides MERGE_RUN metres along the path it meets; a turnaround loop's
// radius, tried largest first.
export const MAX_TURN = 45, JOIN_MERGE = 50, MERGE_RUN = 8, LOOP_R = [7, 6, 5, 4.5, 3.5];
// A rounded corner or a loop may climb a little steeper than a route over
// its few metres (PLACED).
export const SHAPE_GRADE = .28;
// The sharpest turn a line makes over 4 m (resampled every 2 m first).
export function worstTurn(pts) {
 let worst = 0;
 for (let i = 2; i + 2 < pts.length; i++) {
  const a = pts[i - 2], b = pts[i], c = pts[i + 2], ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
  const l = Math.hypot(ux, uz) * Math.hypot(vx, vz);
  if (l > 1e-9) worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / l))) * 180 / Math.PI);
 }
 return worst;
}
export const CELL = 6;
export const MAX_GRADE = .22, JOIN_GRADE = .28;
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

// `block`, `dear` and `pad` (the grid's reach past the holes) are the cart
// paths' unless a caller says otherwise: the roads (roads.js) block fairway and
// semi-rough outright and reach further out.
// `berth`: the margin cells are blocked too, not only dear -- a road six
// metres wide keeps its edges off what is blocked (the drive, phase 5: its
// edge clipped a dune waste's sand from the margin).
export function costGrid({holes, s, surface, streams, height, ravines = [], block = BLOCKED, dear = DEAR, pad = 140, berth = false}) {
 let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
 const greens = [], tees = [];
 for (const h of holes) {
  const g = h.worldGreen ?? h.toWorld(h.green);
  greens.push({x: g.x, z: g.z, r: (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + (s.fringe ?? 2) + (s.semiRough ?? 6)});
  for (const t of Object.values(h.tees)) { const w = h.toWorld(t); tees.push(w); }
  for (const p of [g, ...tees.slice(-3)]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
 }
 x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
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
  if (block.has(sf)) { cost[k] = Infinity; continue; }
  let c = dear[sf] ?? 1;
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
 for (const k of margin) cost[k] = berth ? Infinity : Math.max(cost[k], 15);
 const cellOf = p => [Math.round((p.x - x0) / CELL), Math.round((p.z - z0) / CELL)];
 const at = (i, j) => ({x: x0 + i * CELL, z: z0 + j * CELL});
 const costAt = (x, z) => { const [i, j] = cellOf({x, z}); return i < 0 || j < 0 || i >= nx || j >= nz ? Infinity : cost[j * nx + i]; };
 // The nearest open cell to a point, within 40 m.
 // Failing that, the nearest walkable cell at all (the owner, 31 October
 // 2026: a Midwest hole's pull-off sat in a sea of shared fairway and semi,
 // nothing cheap within 40 m, and the hole had no path -- the network came
 // in two halves).
 const snap = (p, ok = () => true, tries = [[7, 4], [7, 40]]) => {
  const [ci, cj] = cellOf(p);
  for (const [rings, dear] of tries) {
   let best = null;
   for (let r = 0; r <= rings && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= nx || j >= nz || !Number.isFinite(cost[j * nx + i]) || cost[j * nx + i] > dear || !ok(j * nx + i)) continue;
    const d = di * di + dj * dj;
    if (!best || d < best.d) best = {i, j, d};
   }
   if (best) return [best.i, best.j];
  }
  return null;
 };
 const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
 // A* from a to b; the cells, or null.
 //
 // A POCKET IS LEFT, NOT ROUTED FROM (the owner, 31 October 2026: a Midwest
 // network in two halves). A waypoint's cell can sit in a pocket a few cells
 // across, walled in by ground steeper than MAX_GRADE; the search from it
 // ran out, and the hole had no path at all. A failed search has walked
 // everything it can reach, so: when that is a pocket (under POCKET cells)
 // the leg starts again from the nearest cell outside it; when it is the
 // goal that is cut off, the leg ends at the nearest cell it does reach. One
 // retry, within 72 m; past that the land is truly split (Mountain) and the
 // leg is left out, as before.
 const POCKET = 400, ringsOut = [[12, 40]];
 const route = (a, b) => {
  const A = snap(a), B = snap(b);
  if (!A || !B) return null;
  return search(A, B, a, b, false);
 };
 const search = (A, B, a, b, retried) => {
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
  if (from[goal] < 0 && goal !== start) {
   if (retried) return null;
   let reached = 0;
   for (const d of done) reached += d;
   if (reached < POCKET) { const A2 = snap(a, k => !done[k], ringsOut); return A2 ? search(A2, B, a, b, true) : null; }
   const B2 = snap(b, k => done[k] === 1, ringsOut);
   return B2 ? search(A, B2, a, b, true) : null;
  }
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
// bridges, `connect` -- the same router, for the clubhouse's link -- and
// `block`, which closes a building's ground to the router before its link
// is laid.
//
// THE NETWORK IS WHAT IS DRAWN (the owner, 31 October 2026: pieces of path
// lying alone beside a green, a path ending in the grass short of the one it
// met). A later leg joins the network where its cells meet cells an earlier
// leg took. Those were the cells the earlier leg's search WALKED; the line
// drawn from them is pulled straight and rounded (`lineOf`) and can run
// metres off them, so a join landed on a cell the drawn path had left: a gap
// in the grass, and a jog of two or three cells drawn as a piece of its own.
// Now `used` is the cells the DRAWN line crosses, a piece's joined end is
// moved onto the nearest point of a line already drawn, and a piece joined
// at both ends that is shorter than SPUR -- a jog between two points the
// network already joins -- is not laid.
export const SPUR = 3 * CELL;
// The nearest point of a segment to `p`, and whether `p` lies on a line.
const closestOn = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), q = {x: a.x + dx * t, z: a.z + dz * t}; return {q, d: Math.hypot(q.x - p.x, q.z - p.z)}; };
const onPoints = (p, pts) => { for (let k = 1; k < pts.length; k++) if (closestOn(p, pts[k - 1], pts[k]).d < .05) return true; return false; };
// The parts of a network no cart can drive between, smallest first (the bench's
// `pathInParts`).
export const partsOf = paths => {
 const part = paths.map((_, i) => i), find = i => part[i] === i ? i : (part[i] = find(part[i]));
 paths.forEach((p, i) => [p.points[0], p.points[p.points.length - 1]].forEach(e => paths.forEach((o, j) => { if (j !== i && onPoints(e, o.points)) part[find(i)] = find(j); })));
 const groups = new Map();
 paths.forEach((p, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
 return [...groups.values()].sort((a, b) => a.length - b.length);
};
// IS THIS PIECE ALL THAT JOINS TWO PARTS OF THE NETWORK? Pieces meet where an
// end of one lies on another; without `list[skip]`, do its two ends still lie
// in one part? `line` reads a piece's points.
export function isLink(list, skip, line) {
 const onLine = onPoints;
 const part = list.map((_, i) => i), find = i => part[i] === i ? i : (part[i] = find(part[i]));
 list.forEach((piece, i) => {
  if (i === skip) return;
  const pts = line(piece);
  for (const e of [pts[0], pts[pts.length - 1]]) list.forEach((other, j) => { if (j !== i && j !== skip && onLine(e, line(other))) part[find(i)] = find(j); });
 });
 const me = line(list[skip]), touching = end => list.map((other, j) => j).filter(j => j !== skip && onLine(end, line(list[j])));
 const a = touching(me[0]), b = touching(me[me.length - 1]);
 return a.length > 0 && b.length > 0 && !a.some(i => b.some(j => find(i) === find(j)));
}
export function routePaths({holes, s, surface, streams, ravines = [], height = null}) {
 if (!holes?.length) return {paths: [], bridges: [], connect: () => null, block: () => {}};
 const width = WIDTH.members, kind = pathKind(s.biome);
 const grid = costGrid({holes, s, surface, streams, height, ravines});
 const pieces = [];
 const cellAt = p => { const [i, j] = grid.cellOf(p); return i < 0 || j < 0 || i >= grid.nx || j >= grid.nz ? -1 : j * grid.nx + i; };
 // Every cell a drawn line crosses, sampled at a third of a cell.
 const mark = line => {
  for (let k = 1; k < line.length; k++) {
   const a = line[k - 1], b = line[k], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 3)));
   for (let t = 0; t <= n; t++) { const c = cellAt({x: a.x + (b.x - a.x) * t / n, z: a.z + (b.z - a.z) * t / n}); if (c >= 0) grid.used[c] = 1; }
  }
 };
 // The nearest point of a line already drawn.
 const onNetwork = p => {
  let best = null;
  for (const line of pieces) for (let k = 1; k < line.length; k++) {
   const a = line[k - 1], b = line[k], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
   const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), q = {x: a.x + dx * t, z: a.z + dz * t}, d = Math.hypot(q.x - p.x, q.z - p.z);
   if (!best || d < best.d) best = {d, q};
  }
  return best;
 };
 // A straight line crossing only open ground; how sharply a line turns at b
// (the cosine: -1 straight back).
 // Open: nothing blocked on the way, and nothing climbed steeper than
 // MAX_GRADE (2 November 2026: an end run on to the network took a 35% step
 // on Redwood ST-1 and 41% on Mountain PA-3, where only blocked ground was
 // asked; the same rule as segmentCost).
// A JOIN may climb a little more than a route (JOIN_GRADE, PLACED: a few
 // steps up to the path it meets), so an end no longer stops short of the
 // network for want of a grade.
 const open = (a, b, limit = MAX_GRADE) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2)); let prev = grid.heightAt(a.x, a.z); for (let t = 0; t <= n; t++) { const x = a.x + (b.x - a.x) * t / n, z = a.z + (b.z - a.z) * t / n; if (!Number.isFinite(grid.costAt(x, z))) return false; if (t) { const h = grid.heightAt(x, z); if (Math.abs(h - prev) / (d / n) > limit && !grid.spanAt?.(x, z)) return false; prev = h; } } return true; };
 const segDistance = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
 const turn = (a, b, c) => { const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z; return (ux * vx + uz * vz) / ((Math.hypot(ux, uz) * Math.hypot(vx, vz)) || 1); };
 const join = (line, at) => {
  const n = onNetwork(line[at]);
  if (!n || n.d >= CELL * 1.5) return;
  line[at] = n.q;
  // An end moved onto the network can land behind the point before it, and
  // the strip doubled back on itself into a spike (*NO FOLD AT AN END*,
  // below). That point goes now, while the piece is new and nothing has
  // joined it.
  while (line.length > 2) {
   const e = at ? line.length - 1 : 0, k = at ? e - 1 : 1, c = line[at ? e - 2 : 2];
   if (turn(line[e], line[k], c) >= -.17 || !open(line[e], c)) break;
   line.splice(k, 1);
  }
 };
 const length = line => line.reduce((a, p, k) => a + (k ? Math.hypot(p.x - line[k - 1].x, p.z - line[k - 1].z) : 0), 0);
 // A leg's cells become pieces: runs of cells the drawn network does not
 // cross, each with a cell of overlap at either end, joined onto the network
 // there.
 const lay = cells => {
  if (!cells?.length) return;
  const laid = [];
  let run = [], joinStart = false;
  const flush = joinEnd => {
   if (run.length >= 2) {
    const line = lineOf(grid, run);
    if (joinStart) join(line, 0);
    if (joinEnd) join(line, line.length - 1);
    if (!(joinStart && joinEnd && length(line) < SPUR)) laid.push(line);
   }
   run = []; joinStart = false;
  };
  cells.forEach((k, n) => {
   if (grid.used[k] && run.length) { run.push(k); flush(true); }
   else if (!grid.used[k]) { if (!run.length && n > 0) { run.push(cells[n - 1]); joinStart = true; } run.push(k); }
  });
  flush(false);
  for (const line of laid) { pieces.push(line); mark(line); }
 };
 const ends = holes.map(h => waypoints(h, s));
 holes.forEach((h, i) => {
  lay(grid.route(ends[i].tee, ends[i].green));
  if (ends[i + 1]) lay(grid.route(ends[i].green, ends[i + 1].tee));
 });
 // The nearest point of any other piece.
 const nearestOther = (p, own) => { let best = null; for (const line of pieces) { if (line === own) continue; for (let k = 1; k < line.length; k++) { const a = line[k - 1], b = line[k], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), q = {x: a.x + dx * t, z: a.z + dz * t}, d = Math.hypot(q.x - p.x, q.z - p.z); if (!best || d < best.d) best = {d, q}; } } return best; };
 // NO STUB PAST A JUNCTION (the owner's second review, seen in the capture
 // `rev-pulloff`: a pointed spur a few metres long stuck out where two paths
 // met -- the pull-off a leg ended at, with the network passing right by
 // it). A loose end within STUB metres, along its own piece, of a junction
 // (another piece's end lying on it) is cut back to the junction -- before
 // the loose ends are closed, or a stub whose tip lay near another piece is
 // joined back to it and kept, a fold.
 const STUB = 12;
 // Where to cut a piece's end back to: the nearest junction within STUB of
 // its tip along it -- another piece's end lying on it (only for a loose
 // tip) or a piece it crosses (the capture `rev-club-above`: two legs met at
 // a pull-off 5 m beyond the path they had both crossed, a wedge of path).
 const cutOf = (line, end, ends) => {
  const pts = end ? [...line].reverse() : line;
  let run = 0, cut = null;
  for (let k = 1; k < pts.length && run < STUB && !cut; k++) {
   const a = pts[k - 1], b = pts[k], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
   for (const o of pieces) if (o !== line) {
    if (ends) for (const e of [o[0], o[o.length - 1]]) {
     const t = Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / (l * l))), q = {x: a.x + dx * t, z: a.z + dz * t};
     if (Math.hypot(e.x - q.x, e.z - q.z) < .05 && run + t * l < STUB && (!cut || run + t * l < cut.at)) cut = {at: run + t * l, k, q};
    }
    for (let j = 1; j < o.length; j++) {
     const u = o[j - 1], v = o[j], ex = v.x - u.x, ez = v.z - u.z, den = dx * ez - dz * ex;
     if (Math.abs(den) < 1e-9) continue;
     const t = ((u.x - a.x) * ez - (u.z - a.z) * ex) / den, w = ((u.x - a.x) * dz - (u.z - a.z) * dx) / den;
     // (Not at the tip itself, where a piece that shares it "crosses".)
     if (run + t * l < .1 || t > 1 || w < 0 || w > 1 || run + t * l >= STUB || (cut && run + t * l >= cut.at)) continue;
     cut = {at: run + t * l, k, q: {x: a.x + dx * t, z: a.z + dz * t}};
    }
   }
   run += l;
  }
  return cut && {...cut, pts};
 };
 const apply = (line, end, cut) => {
  const rest = [cut.q, ...cut.pts.slice(cut.k)];
  if (rest.length >= 2 && length(rest) >= 1) line.splice(0, line.length, ...(end ? rest.reverse() : rest));
 };
 for (const line of pieces) for (const end of [0, 1]) {
  if (line.length < 2) continue;
  const tip = end ? line[line.length - 1] : line[0];
  if ((nearestOther(tip, line)?.d ?? Infinity) >= .05) { const cut = cutOf(line, end, true); if (cut) apply(line, end, cut); continue; }
  // A joined tip: cut back only where every piece at the tip ends there
  // (a pull-off where two legs meet, on nobody's line), so the network
  // keeps its joins.
  const at = pieces.filter(o => o !== line && o.length >= 2 && [o[0], o[o.length - 1]].some(e => Math.hypot(e.x - tip.x, e.z - tip.z) < .05));
  if (!at.length || pieces.some(o => o !== line && !at.includes(o) && o.some((p, k) => k && segDistance(tip, o[k - 1], p) < .05))) continue;
  const group = [[line, end], ...at.map(o => [o, Math.hypot(o[0].x - tip.x, o[0].z - tip.z) < .05 ? 0 : 1])];
  const cuts = group.map(([o, e]) => cutOf(o, e, false)), q = cuts.find(Boolean)?.q;
  // A leg that crosses nothing starts from the crossing the others are cut
  // back to, where it is close and the ground between is open.
  if (!q || Math.hypot(q.x - tip.x, q.z - tip.z) > CELL * 1.5 || !open(q, tip)) continue;
  // Its tip moves there where the ground on to its next point is open (or it
  // would fold back at the old tip), else the crossing goes before it.
  group.forEach(([o, e], i) => {
   if (cuts[i]) return apply(o, e, cuts[i]);
   const next = o[e ? o.length - 2 : 1];
   if (next && open(q, next)) o[e ? o.length - 1 : 0] = q; else if (e) o.push(q); else o.unshift(q);
  });
 }
 // LOOSE ENDS CLOSED. A leg ends at its waypoint and the next starts there;
 // where the next leg's first stretch was a jog not laid, or a waypoint fell
 // a few metres off a path already drawn, the end stopped in the grass short
 // of it (41 ends in 15 eighteen-hole courses still did, after the joins
 // above). An end within a cell and a half of another piece runs on to it,
 // where the ground between is open; then a short piece joined at both ends
 // is a jog the network no longer needs.
 for (const line of pieces) for (const at of [0, line.length - 1]) {
  const n = nearestOther(line[at], line);
  if (!n || n.d < .05 || n.d > CELL * 1.5 || !open(line[at], n.q, JOIN_GRADE)) continue;
  // Stopping at the first piece the run on crosses (the capture
  // `rev-club-above`: it ran on across one path to reach another).
  {const p = line[at], dx = n.q.x - p.x, dz = n.q.z - p.z;
   let first = 1;
   for (const o of pieces) if (o !== line) for (let j = 1; j < o.length; j++) {
    const u = o[j - 1], v = o[j], ex = v.x - u.x, ez = v.z - u.z, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((u.x - p.x) * ez - (u.z - p.z) * ex) / den, w = ((u.x - p.x) * dz - (u.z - p.z) * dx) / den;
    if (t > .001 && t < first && w >= 0 && w <= 1) first = t;
   }
   if (first < 1) n.q = {x: p.x + dx * first, z: p.z + dz * first};}
  // Run on to it -- or, where it lies back the way the line came (a fold,
  // *NO FOLD AT AN END*), end there instead, if nothing joins the stretch
  // that moves and the ground straight to it is open.
  const prev = line[at ? at - 1 : 1];
  const joinsHere = pieces.some(o => o !== line && [o[0], o[o.length - 1]].some(e => segDistance(e, prev, line[at]) < .05 && Math.hypot(e.x - prev.x, e.z - prev.z) > .05));
  if (line.length > 1 && turn(prev, line[at], n.q) < -.17 && !joinsHere && open(prev, n.q, JOIN_GRADE)) line[at] = n.q;
  else if (at) line.push(n.q); else line.unshift(n.q);
 }
 const joinedBoth = line => [line[0], line[line.length - 1]].every(p => (nearestOther(p, line)?.d ?? Infinity) < .05);
 // Not a piece that is all that holds two parts of the network together
 // (`isLink`): taking those out left 31 of 84 courses in two or more networks
 // a cart could not drive between, most with a gap of 3-15 m.
 for (let k = pieces.length - 1; k >= 0; k--) if (length(pieces[k]) < SPUR && joinedBoth(pieces[k]) && !isLink(pieces, k, p => p)) pieces.splice(k, 1);
 // NO FOLD AT AN END (the same capture: the "spur" was a fold). An end moved
 // onto the network can land behind the point before it, and the strip
 // doubled back on itself into a point -- 17 of 228 ends on four eighteens.
 // The point the line turns back at (more than 100 degrees) is dropped
 // where the line straight past it crosses only open ground.
 for (const line of pieces) for (const end of [0, 1]) {
  for (let guard = 0; guard < 4 && line.length > 2; guard++) {
   const [a, b, c] = end ? [line[line.length - 1], line[line.length - 2], line[line.length - 3]] : [line[0], line[1], line[2]];
   // Not where another piece joins the stretch that would move (it would be
   // left short of the line again).
   const onIt = (u, v) => pieces.some(o => o !== line && [o[0], o[o.length - 1]].some(e => Math.hypot(e.x - a.x, e.z - a.z) > .05 && Math.hypot(e.x - c.x, e.z - c.z) > .05 && segDistance(e, u, v) < .05));
   if (turn(a, b, c) >= -.17) break;
   if (open(a, c) && !onIt(a, b) && !onIt(b, c)) { line.splice(end ? line.length - 2 : 1, 1); continue; }
   // Or, where that stretch carries a join, the end joined afresh from the
   // point before the fold -- unless another piece's end meets this one.
   const n = nearestOther(b, line), shared = pieces.some(o => o !== line && [o[0], o[o.length - 1]].some(e => Math.hypot(e.x - a.x, e.z - a.z) < .05));
   if (!shared && !onIt(a, b) && n && n.d < CELL * 1.5 && open(b, n.q, JOIN_GRADE) && turn(n.q, b, c) >= -.17) line[end ? line.length - 1 : 0] = n.q;
   break;
  }
 }
 const paths = pieces.filter(p => p.length >= 2).map(points => ({points, width, kind}));
 // Bridges: a run of points over water -- a creek, a pond or a lake -- or a
 // ravine, on each piece. EVERY PATH OVER WATER IS A BRIDGE (the owner, 2
 // November 2026): the router keeps off ponds and lakes, but a rounded line
 // or a joined end can still pass over an edge of one, and only creeks were
 // tested; `surface` here is the ground before any path was laid, so it says
 // water wherever there is water. The bench holds it (`pathOverWater`) and
 // tests/paths.test.mjs.
 const bridges = findBridges(paths, {surface, streams, ravines, width});
 // The link ends ON the network (it ended on its last cell's centre, a few
 // metres off it), and its own drawn cells join the network after it.
 // Cut back, like the legs, to a path it crosses near its end (the capture
 // `rev-club-above`: the clubhouse's path crossed the path it met, ran on
 // 4 m and hooked back onto it -- a wedge).
 const connect = (a, b) => { const cells = grid.route(a, b); if (!cells?.length) return null; const line = lineOf(grid, cells); join(line, line.length - 1); const cut = cutOf(line, 1, false); if (cut) apply(line, 1, cut); mark(line); return line; };
 // NO RIGHT ANGLES, NO DEAD ENDS (the owner amended the goal, 2 November
 // 2026: "No right angles or dead ends. make sure all corners are rounded
 // and where a dead end would sit, make the path smoothly loop back on
 // itself"). Run once the whole network is laid, the clubhouse's link
 // included (course.js), before its bridges are found:
 //   joins     a piece meeting another steeper than JOIN_MERGE slides its end
 //             along the other, so the two merge at a shallow angle
 //   corners   every piece resampled every 2 m and smoothed (ends fixed)
 //             until no 4 m of it turns more than MAX_TURN, a pass kept
 //             only where the smoothed line still crosses open ground
 //   ends      an end that joins nothing (a pull-off by a green) runs on
 //             into a teardrop loop that comes back along itself -- sized
 //             and turned to fit the open ground; an end at a building (the
 //             clubhouse's door) stays
 // tests/paths.test.mjs and the bench (`pathSharp`, `pathDeadEnd`) hold it.
 // Open ground, and the router's 10 m berth round every green kept.
 const berth = holes.map(h => ({g: h.worldGreen ?? h.toWorld(h.green), r: (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + 10.5}));
 // The steepest 2 m step between two points, as `open` samples it.
 const gradeOf = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2)); let g = 0, prev = grid.heightAt(a.x, a.z); for (let t = 1; t <= n; t++) { const h = grid.heightAt(a.x + (b.x - a.x) * t / n, a.z + (b.z - a.z) * t / n); g = Math.max(g, Math.abs(h - prev) / (d / n || 1)); prev = h; } return g; };
 const fits = (pts, limit = JOIN_GRADE) => pts.every((p, i) => Number.isFinite(grid.costAt(p.x, p.z)) && !berth.some(b => Math.hypot(p.x - b.g.x, p.z - b.g.z) < b.r) && (i === 0 || open(pts[i - 1], p, limit)));
 // ONE NETWORK (4 November 2026: 25 of 84 courses still in two or more once no
 // link was taken out as a jog). A leg with no route, or an end cut back, leaves
 // a part no cart can reach. The smallest part is joined to the nearest of the
 // rest: straight where the ground is open, else by the router, and
 // that part's next-nearest point if that fails. No join where the router has
 // none, which is water or a wall: tests/paths.test.mjs.
 const stitch = paths => {
  for (let round = 0; round < 12; round++) {
   const parts = partsOf(paths);
   if (parts.length < 2) return;
   let joined = false;
   for (const mine of parts.slice(0, -1)) {
    const others = parts.filter(o => o !== mine).flat(), near = [];
    for (const p of mine) for (let k = 0; k < p.points.length; k += 2) {
     const a = p.points[k];
     let best = null;
     for (const o of others) for (let m = 1; m < o.points.length; m++) { const q = closestOn(a, o.points[m - 1], o.points[m]); if (!best || q.d < best.d) best = q; }
     if (best) near.push({a, q: best.q, d: best.d});
    }
    near.sort((x, y) => x.d - y.d);
    // The four nearest, spaced apart, so one blocked spot does not end it.
    const tried = [];
    for (const n of near) {
     if (tried.length >= 4) break;
     if (tried.some(t => Math.hypot(t.x - n.a.x, t.z - n.a.z) < 30)) continue;
     tried.push(n.a);
     let line = fits([n.a, n.q]) ? [n.a, n.q] : null;
     if (!line) { const cells = grid.route(n.a, n.q); if (cells?.length) { const mid = lineOf(grid, cells).slice(1, -1); if (mid.length) line = [n.a, ...mid, n.q]; } }
     if (!line) continue;
     paths.push({points: line, width, kind, link: true});
     joined = true;
     break;
    }
    if (joined) break;
   }
   if (!joined) return;
  }
 };
 const shape = (paths, buildings = []) => {
  stitch(paths);
  const nearestOn = (p, skip) => {
   let best = null;
   for (const other of paths) {
    if (other === skip) continue;
    const pts = other.points;
    for (let k = 1; k < pts.length; k++) {
     const a = pts[k - 1], b = pts[k], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
     const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), q = {x: a.x + dx * t, z: a.z + dz * t}, d = Math.hypot(q.x - p.x, q.z - p.z);
     if (!best || d < best.d) { const l = Math.sqrt(l2); best = {d, q, h: {x: dx / l, z: dz / l}, path: other, k, t}; }
    }
   }
   return best;
  };
  // A loop keeps 2.5 m off every other path (one crossed a neighbour and
  // ran on past it).
  const clearOf = (pts, self) => pts.every(p => (nearestOn(p, self)?.d ?? 99) > 2.5);
  const atBuilding = p => buildings.some(b => Math.hypot(p.x - b.x, p.z - b.z) < Math.max(b.width, b.depth) / 2 + 14);
  // 1. Joins merge at a shallow angle.
  for (const path of paths) for (const end of [0, 1]) {
   const pts = path.points;
   if (pts.length < 2) continue;
   const P = end ? pts[pts.length - 1] : pts[0], back = end ? pts[Math.max(0, pts.length - 4)] : pts[Math.min(pts.length - 1, 3)];
   const host = nearestOn(P, path);
   if (!host || host.d > 1.5) continue;
   const dx = P.x - back.x, dz = P.z - back.z, dl = Math.hypot(dx, dz) || 1, cos = (dx * host.h.x + dz * host.h.z) / dl;
   if (Math.abs(cos) > Math.cos(JOIN_MERGE * Math.PI / 180)) continue;
   const s = cos >= 0 ? 1 : -1, hp = host.path.points;
   // The point MERGE_RUN metres on along the host, the way the piece heads.
   let left = MERGE_RUN, k = host.k, at = host.q, ok = true;
   for (;;) {
    const nk = s > 0 ? k : k - 1, nxt = hp[nk];
    if (!nxt) { ok = false; break; }
    const d = Math.hypot(nxt.x - at.x, nxt.z - at.z);
    if (d >= left) { at = {x: at.x + (nxt.x - at.x) * left / d, z: at.z + (nxt.z - at.z) * left / d}; break; }
    left -= d; at = nxt; k = s > 0 ? k + 1 : k - 1;
   }
   if (!ok || !fits([P, at])) continue;
   if (end) pts.push(at); else pts.unshift(at);
  }
  const resample = pts => {
   const out = [pts[0]];
   for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 2)); for (let t = 1; t <= n; t++) out.push({x: a.x + (b.x - a.x) * t / n, z: a.z + (b.z - a.z) * t / n}); }
   return out;
  };
  // No fold: a point where the line turns back (past 120 degrees) on a
  // stretch under 1.5 m goes.
  const unfold = path => {
   const p = path.points;
   for (let again = true; again;) {
    again = false;
    for (let i = 1; i + 1 < p.length; i++) {
     const ux = p[i].x - p[i - 1].x, uz = p[i].z - p[i - 1].z, vx = p[i + 1].x - p[i].x, vz = p[i + 1].z - p[i].z, lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
     if ((lu < 1.5 || lv < 1.5) && lu * lv > 1e-12 && (ux * vx + uz * vz) / (lu * lv) < -.5) { p.splice(i, 1); again = true; break; }
    }
   }
  };
  // Corners rounded, point by point: a smoothed point is kept only where it
  // and the ground to its neighbours are open (a pass all or nothing left
  // every corner of a piece sharp for one point by a green); up to 30 passes
  // (ten left the sharpest corners).
  const round = path => {
   let pts = resample(path.points);
   for (let pass = 0; pass < 30 && worstTurn(pts) > MAX_TURN; pass++) {
    // The ends stay; the points beside them smooth on a narrower kernel.
    const next = pts.map((p, i) => (i < 1 || i > pts.length - 2 ? p : i < 2 || i > pts.length - 3 ? {x: (pts[i - 1].x + p.x * 2 + pts[i + 1].x) / 4, z: (pts[i - 1].z + p.z * 2 + pts[i + 1].z) / 4} : {x: (pts[i - 2].x + pts[i - 1].x * 2 + p.x * 2 + pts[i + 1].x * 2 + pts[i + 2].x) / 8, z: (pts[i - 2].z + pts[i - 1].z * 2 + p.z * 2 + pts[i + 1].z * 2 + pts[i + 2].z) / 8}));
    // Where the smoothed point does not fit (too steep, by a green), a
    // point halfway to it may (generator 77: the steep landscapes kept sharp
    // corners because a corner moved all the way or not at all).
    // And on ground already steeper than SHAPE_GRADE (a switchback up a
    // hillside), a rounded corner may be as steep as the corner it replaces
    // (and 15% more, the 2 m samples' own spread), never past 29% -- still
    // walkable (tests/paths.test.mjs holds every step under 30%). Held to
    // the limit alone,
    // every switchback on the Sierra's and the Rockies' slopes stayed sharp.
    pts = next.map((q, i) => {
     if (q === pts[i]) return q;
     const limit = Math.min(.29, Math.max(SHAPE_GRADE, 1.15 * gradeOf(pts[i - 1], pts[i]), 1.15 * gradeOf(pts[i], pts[i + 1])));
     if (fits([pts[i - 1], q, pts[i + 1]], limit)) return q;
     const h = {x: (q.x + pts[i].x) / 2, z: (q.z + pts[i].z) / 2};
     return fits([pts[i - 1], h, pts[i + 1]], limit) ? h : pts[i];
    });
   }
   path.points = pts;
  };
  // 2. Folds out, corners rounded.
  for (const path of paths) { unfold(path); round(path); }
  // 3. Every dead end loops back on itself: straight on from the end (a
  // loop turned off the heading would start with a kink), the largest that
  // fits, either side -- from the end, or where none fits there, from a
  // point up to 24 m back along the path (the stretch beyond it dropped).
  for (const path of paths) for (const end of [0, 1]) {
   let pts = path.points;
   if (pts.length < 3) continue;
   const tip = end ? pts[pts.length - 1] : pts[0];
   const host = nearestOn(tip, path);
   if ((host && host.d <= 1.5) || atBuilding(tip)) continue;
   let done = false;
   for (let back = 0; back <= 30 && !done && back + 4 < pts.length; back += 3) {
    const k = end ? pts.length - 1 - back : back, E = pts[k], B = pts[end ? Math.max(0, k - 3) : Math.min(pts.length - 1, k + 3)];
    const dl = Math.hypot(E.x - B.x, E.z - B.z) || 1, d = {x: (E.x - B.x) / dl, z: (E.z - B.z) / dl};
    for (const R of LOOP_R) for (const side of [1, -1]) {
     if (done) break;
     const n = {x: -d.z * side, z: d.x * side};
     // A teardrop: leaves along d and comes back along it, its far end
     // round (u = L(1 - cos t)/2, v = W sin t (1 - cos t)/2; widest about
     // 0.65 W).
     const L = 2.6 * R, W = R / .65, cand = [];
     for (let i = 1; i <= 36; i++) { const t = i / 36 * Math.PI * 2, u = L * (1 - Math.cos(t)) / 2, v = W * Math.sin(t) * (1 - Math.cos(t)) / 2; cand.push({x: E.x + d.x * u + n.x * v, z: E.z + d.z * u + n.z * v}); }
     if (!fits([E, ...cand], SHAPE_GRADE) || !clearOf(cand, path)) continue;
     if (end) path.points = [...pts.slice(0, k + 1), ...cand];
     else path.points = [...cand.reverse(), ...pts.slice(k)];
     done = true;
    }
   }
  }
  // 3a. A dead end where no loop fits anywhere along its last 60 m is cut
  // back to the junction it came from, within 80 m (a pull-off on ground too
  // steep or tight to turn on goes; no dead end stays).
  for (const path of paths) for (const end of [0, 1]) {
   const pts = path.points;
   if (pts.length < 3) continue;
   const tip = end ? pts[pts.length - 1] : pts[0];
   if (atBuilding(tip)) continue;
   const host = nearestOn(tip, path);
   if (host && host.d <= 1.5) continue;
   // Already looped: its own line comes back to it.
   const seq = end ? [...pts].reverse() : pts;
   let run = 0, looped = false;
   for (let k = 1; k < seq.length && !looped; k++) { run += Math.hypot(seq[k].x - seq[k - 1].x, seq[k].z - seq[k - 1].z); if (run >= 12 && Math.hypot(seq[k].x - tip.x, seq[k].z - tip.z) <= (path.width ?? 2.4)) looped = true; }
   if (looped) continue;
   run = 0;
   for (let k = 1; k < seq.length; k++) {
    run += Math.hypot(seq[k].x - seq[k - 1].x, seq[k].z - seq[k - 1].z);
    if (run > 80) break;
    const on = nearestOn(seq[k], path);
    if (on && on.d <= 1.5) { const kept = seq.slice(k); path.points = end ? kept.reverse() : kept; break; }
   }
  }
  // 3b. A hairpin -- a leg out to a pull-off and straight back along itself,
  // which no rounding can turn -- turns in a teardrop loop at its tip too.
  const teardrop = (E, d, prev, self) => {
   for (const R of LOOP_R) for (const side of [1, -1]) {
    const n = {x: -d.z * side, z: d.x * side}, L = 2.6 * R, W = R / .65, cand = [];
    for (let i = 1; i <= 36; i++) { const t = i / 36 * Math.PI * 2, u = L * (1 - Math.cos(t)) / 2, v = W * Math.sin(t) * (1 - Math.cos(t)) / 2; cand.push({x: E.x + d.x * u + n.x * v, z: E.z + d.z * u + n.z * v}); }
    if (fits([prev, E, ...cand], SHAPE_GRADE) && clearOf(cand, self)) return cand;
   }
   return null;
  };
  for (const path of paths) {
   let pts = resample(path.points), loops = 0;
   // At most eight a piece, each moving the scan on past it (a loop that
   // left a sharp turn behind it began another, without end: Puget Sound
   // FINGER-1 never finished).
   for (let i = 2; i + 2 < pts.length && loops < 8; i++) {
    if (worstTurn(pts.slice(i - 2, i + 3)) <= 100) continue;
    // The tip: the sharpest point near here.
    let tip = i, best = 0;
    for (let j = i; j < Math.min(pts.length - 2, i + 4); j++) { const t = worstTurn(pts.slice(j - 2, j + 3)); if (t > best) { best = t; tip = j; } }
    // At the tip, or where there is no room there, a few points before it.
    let loop = null;
    for (const back of [0, 2, 4, 6]) {
     if (tip - back < 2) break;
     const E = pts[tip - back], A = pts[tip - back - 2], dl = Math.hypot(E.x - A.x, E.z - A.z) || 1;
     loop = teardrop(E, {x: (E.x - A.x) / dl, z: (E.z - A.z) / dl}, A, path);
     if (loop) { tip -= back; break; }
    }
    if (loop) { pts = [...pts.slice(0, tip + 1), ...loop, ...pts.slice(tip + 1)]; i = Math.max(i, tip) + loop.length + 8; loops++; }
   }
   path.points = pts;
  }
  // 4. And once more: folds out, corners rounded.
  for (const path of paths) { unfold(path); round(path); }
  // 5. Ends settled (tests/paths.test.mjs): an end that runs along the path
  // it joined is cut back to where the two first touch (2 m apart); an end
  // within 2.5 m
  // of another path lands exactly on it; one within 8 m runs on to it where
  // the ground is open.
  // A crossing within an end's last 8 m: where its segment meets another
  // path's, the end is cut there (no stub past a crossing).
  const crossing = (a, b, self, tMax = 1) => {
   for (const o of paths) { if (o === self) continue; const q = o.points; for (let k = 1; k < q.length; k++) {
    const c = q[k - 1], d = q[k], den = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x); if (Math.abs(den) < 1e-9) continue;
    const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den;
    if (t > 1e-6 && t <= tMax && u >= 0 && u <= 1) return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t};
   } }
   return null;
  };
  for (let settle = 0; settle < 4; settle++) for (const path of paths) for (const end of [0, 1]) {
   let pts = path.points;
   if (pts.length < 3) continue;
   const at = i => (end ? pts[pts.length - 1 - i] : pts[i]);
   // Cut at a crossing in the last 8 m.
   { let run = 0; for (let k = 1; k < pts.length - 1 && run < 8; k++) { const a = at(k), b = at(k - 1); const x = crossing(a, b, path); if (x) { pts = end ? [...pts.slice(0, pts.length - k), x] : [x, ...pts.slice(k)]; path.points = pts; break; } run += Math.hypot(b.x - a.x, b.z - a.z); } }
   let n = 0;
   while (n + 3 < pts.length) { const h = nearestOn(at(n + 1), path); if (!h || h.d > 2) break; n++; }
   if (n > 0) { pts = end ? pts.slice(0, pts.length - n) : pts.slice(n); path.points = pts; }
   const E = at(0), h = nearestOn(E, path);
   if (!h || h.d < .05 || h.d > 8) continue;
   if (h.d <= 2.5) { if (end) pts[pts.length - 1] = h.q; else pts[0] = h.q; }
   else if (fits([E, h.q]) && !crossing(E, h.q, path, .98)) { if (end) pts.push(h.q); else pts.unshift(h.q); }
  }
  // A short piece joined at both ends is a jog the network does not need
  // (as the router's own rule).
  for (let i = paths.length - 1; i >= 0; i--) {
   const p = paths[i], pts = p.points;
   if (p.door || pts.length < 2) continue;
   let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
   const a = nearestOn(pts[0], p), b = nearestOn(pts[pts.length - 1], p);
   if (len < SPUR && a && b && a.d < .05 && b.d < .05 && !isLink(paths, i, q => q.points)) paths.splice(i, 1);
   else if (len < SPUR && a && b && a.d < .05 && b.d < .05) p.link = true;
  }
  stitch(paths);
 };
 // A building's ground closed to the router, `pad` metres round it, with
 // the cell-wide dear margin everything blocked has (the owner, 31 October
 // 2026: the clubhouse's own path was routed straight under it, the router
 // never having been told it was there).
 const block = (b, pad = 1.5) => {
  const r = Math.hypot(b.width, b.depth) / 2 + pad + CELL, [ci, cj] = grid.cellOf(b), n = Math.ceil(r / CELL);
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
   const i = ci + di, j = cj + dj;
   if (i < 0 || j < 0 || i >= grid.nx || j >= grid.nz) continue;
   const p = grid.at(i, j), k = j * grid.nx + i;
   if (inBox(b, p.x, p.z, pad + CELL / 2)) grid.cost[k] = Infinity;
   else if (inBox(b, p.x, p.z, pad + CELL * 1.5)) grid.cost[k] = Math.max(grid.cost[k], 15);
  }
 };
 return {paths, bridges, connect, block, shape};
}

// Inside a footprint {x, z, rotation, width, depth}, padded (clubhouse.js
// `inBuilding`'s frame).
const inBox = (b, x, z, pad = 0) => { const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = x - b.x, dz = z - b.z; return Math.abs(dx * cs - dz * sn) <= b.width / 2 + pad && Math.abs(dx * sn + dz * cs) <= b.depth / 2 + pad; };

// NOTHING BUILT ON A PATH (the owner, 31 October 2026: a path running under
// the clubhouse). The paths are laid first; the clubhouse, the story's
// buildings, the tournament's stands and the houses are sited after, and
// each asked only a few points of its footprint -- a 2.4 m path passes
// between corners 20 m apart. These test the whole footprint.
//
// Whether any path comes within `pad` metres of a footprint: each segment,
// in the footprint's frame, clipped against the box grown by the pad and
// half the path's width (Liang-Barsky).
export function pathTouches(paths, b, pad = 0) {
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation);
 const local = p => { const dx = p.x - b.x, dz = p.z - b.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
 for (const path of paths || []) {
  const hx = b.width / 2 + pad + path.width / 2, hz = b.depth / 2 + pad + path.width / 2;
  let prev = local(path.points[0]);
  for (let k = 1; k < path.points.length; k++) {
   const next = local(path.points[k]), [ax, az] = prev, dx = next[0] - ax, dz = next[1] - az;
   prev = next;
   let t0 = 0, t1 = 1, hit = true;
   for (const [p, q] of [[-dx, ax + hx], [dx, hx - ax], [-dz, az + hz], [dz, hz - az]]) {
    if (p === 0) { if (q < 0) { hit = false; break; } continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) { hit = false; break; } if (r > t0) t0 = r; }
    else { if (r < t0) { hit = false; break; } if (r < t1) t1 = r; }
   }
   if (hit) return true;
  }
 }
 return false;
}

// How far (x, z) is from the nearest path's edge (negative on one), or
// Infinity with no paths.
export function pathClearance(paths, x, z) {
 let best = Infinity;
 for (const path of paths || []) for (let k = 1; k < path.points.length; k++) {
  const a = path.points[k - 1], b = path.points[k], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - path.width / 2);
 }
 return best;
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
export function linkBuilding(paths, b, connect, height = null) {
 // Walkable: no step steeper than MAX_GRADE along it, every 2 m (true where no
 // height is given).
 const walkable = (p, q, limit = MAX_GRADE) => { if (!height) return true; const d = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(d / 2)); let prev = height(p.x, p.z); for (let t = 1; t <= n; t++) { const h = height(p.x + (q.x - p.x) * t / n, p.z + (q.z - p.z) * t / n); if (Math.abs(h - prev) / (d / n) > limit) return false; prev = h; } return true; };
 const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), out = b.depth / 2 + 6;
 // The front is the building's local -z (clubhouse.js faces it to the tee).
 const door = {x: b.x - sn * out, z: b.z - cs * out};
 // The nearest point of the network, along its segments (a straightened
 // run's corners can be a hundred metres apart).
 let near = null;
 for (const p of paths) for (let k = 1; k < p.points.length; k++) {
  const u = p.points[k - 1], v = p.points[k], dx = v.x - u.x, dz = v.z - u.z, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((door.x - u.x) * dx + (door.z - u.z) * dz) / l2)), q = {x: u.x + dx * t, z: u.z + dz * t}, d = Math.hypot(q.x - door.x, q.z - door.z);
  if (!near || d < near.d) near = {d, q};
 }
 if (!near) return null;
 // Routed round the building (routePaths `block`). A straight line only
 // where the router found nothing and the line misses the building.
 let line = connect?.(door, near.q);
 // The straight fallback only where it is short and walkable (Mountain
 // overhaul, 2 November 2026: a 150 m line straight down a 46% slope).
 if (!line) { line = [door, near.q]; if (pathTouches([{points: line, width: paths[0].width}], b, .5) || near.d > 40 || !walkable(door, near.q)) return null; }
 // Up to the front itself (the capture `arch-club`: it stopped 6 m short,
 // in the grass), then out to the routed line.
 const face = {x: b.x - sn * (b.depth / 2 + .3), z: b.z - cs * (b.depth / 2 + .3)};
 let pts = [face, door, ...line.slice(1)];
 // THE LINK ENDS WHERE IT FIRST MEETS THE NETWORK (2 November 2026: on a
 // generated course, where the clubhouse stands among the first and last
 // holes' paths, the routed link crossed a path and ran on to join another
 // -- Autumn PATHS-T crossed four, each a few metres short of its end). Cut
 // at the first crossing, walking out from the door.
 const crossing = (a, c) => { let best = null; for (const p of paths) for (let k = 1; k < p.points.length; k++) { const u = p.points[k - 1], v = p.points[k], dx = c.x - a.x, dz = c.z - a.z, ex = v.x - u.x, ez = v.z - u.z, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((u.x - a.x) * ez - (u.z - a.z) * ex) / den, w = ((u.x - a.x) * dz - (u.z - a.z) * dx) / den; if (t > 1e-3 && t <= 1 && w >= 0 && w <= 1 && (!best || t < best)) best = t; } return best; };
 for (let k = 2; k < pts.length; k++) { const t = crossing(pts[k - 1], pts[k]); if (t !== null) { const a = pts[k - 1], c = pts[k]; pts = [...pts.slice(0, k), {x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t}]; break; } }
 // Where it meets a piece within 12 m of that piece's loose end, the end
 // past the junction is a stub to nowhere (Autumn PATHS-T, 10 m): cut off.
 {const j = pts[pts.length - 1];
  for (const o of paths) for (let k = 1; k < o.points.length; k++) {
   const u = o.points[k - 1], v = o.points[k], dx = v.x - u.x, dz = v.z - u.z, l = Math.hypot(dx, dz) || 1, t = ((j.x - u.x) * dx + (j.z - u.z) * dz) / (l * l);
   if (t < -1e-6 || t > 1 + 1e-6 || Math.abs((j.x - u.x) * dz - (j.z - u.z) * dx) / l > .05) continue;
   const loose = e => { for (const p of paths) if (p !== o) for (let m = 1; m < p.points.length; m++) { const a = p.points[m - 1], c = p.points[m], ex = c.x - a.x, ez = c.z - a.z, l2 = ex * ex + ez * ez || 1, s = Math.max(0, Math.min(1, ((e.x - a.x) * ex + (e.z - a.z) * ez) / l2)); if (Math.hypot(e.x - a.x - ex * s, e.z - a.z - ez * s) < .05) return false; } return true; };
   let before = t * l; for (let m = 1; m < k; m++) before += Math.hypot(o.points[m].x - o.points[m - 1].x, o.points[m].z - o.points[m - 1].z);
   let after = (1 - t) * l; for (let m = k + 1; m < o.points.length; m++) after += Math.hypot(o.points[m].x - o.points[m - 1].x, o.points[m].z - o.points[m - 1].z);
   const q = {x: j.x, z: j.z};
   if (before < 12 && before > .05 && loose(o.points[0])) o.points.splice(0, k, q);
   else if (after < 12 && after > .05 && loose(o.points[o.points.length - 1])) o.points.splice(k, o.points.length - k, q);
   break;
  }}
 const piece = {points: pts, width: paths[0].width, kind: paths[0].kind, door};
 // And a loose end the link now passes close by (an end that stopped in the
 // open, 0.3-8 m from the new line) runs on to it, as the router's own ends
 // do (*NO STUB PAST A JUNCTION*), stopping at any path on the way.
 const segDist = (p, a, c) => { const dx = c.x - a.x, dz = c.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return {d: Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t), q: {x: a.x + dx * t, z: a.z + dz * t}}; };
 const toNetwork = (e, self) => { let d = Infinity; for (const o of paths) if (o.points !== self) for (let k = 1; k < o.points.length; k++) d = Math.min(d, segDist(e, o.points[k - 1], o.points[k]).d); return d; };
 for (const o of paths) for (const at of [0, o.points.length - 1]) {
  const e = o.points[at];
  if (toNetwork(e, o.points) < .05) continue;
  let near = null; for (let k = 1; k < pts.length; k++) { const s2 = segDist(e, pts[k - 1], pts[k]); if (!near || s2.d < near.d) near = s2; }
  if (!near || near.d > 8 || near.d < .05 || crossing(e, near.q) !== null && crossing(e, near.q) < .999 || !walkable(e, near.q, JOIN_GRADE)) continue;
  if (at) o.points.push(near.q); else o.points.unshift(near.q);
 }
 paths.push(piece);
 return piece;
}

// Whether (x, z) is on a bridge's deck: within its span along its line and its
// width across (the bench's `pathOverWater`, tests/paths.test.mjs).
export function onBridge(bridges, x, z, pad = 0) {
 for (const b of bridges || []) {
  const ax = Math.sin(b.angle), az = Math.cos(b.angle), dx = x - b.x, dz = z - b.z;
  if (Math.abs(dx * ax + dz * az) <= b.span / 2 + pad && Math.abs(dx * az - dz * ax) <= b.width / 2 + pad) return true;
 }
 return false;
}

// Every point of every path, every 2 m, that stands on water and on no bridge:
// none should (the owner, 2 November 2026: every path over water is a bridge).
// `water(x, z)` is the world's own test: its surface says water.
export function unbridgedWater(paths, bridges, water) {
 const out = [];
 for (const path of paths || []) for (let k = 1; k < path.points.length; k++) {
  const o = path.points[k - 1], p = path.points[k], n = Math.max(1, Math.ceil(Math.hypot(p.x - o.x, p.z - o.z) / 2));
  for (let t = 0; t <= n; t++) { const x = o.x + (p.x - o.x) * t / n, z = o.z + (p.z - o.z) * t / n; if (water(x, z) && !onBridge(bridges, x, z, 1)) out.push({x, z}); }
 }
 return out;
}

// THE BRIDGES OF A NETWORK: a run of points over water or a ravine, on each
// piece (routePaths, above, and again once the clubhouse's link is laid --
// course.js -- which a creek between the door and the network once crossed
// dry-shod: Mountain W-3, 2 November 2026). `surface` must be the ground
// before any path was laid.
export function findBridges(paths, {surface, streams, ravines = [], width}) {
 const inRavine = p => ravines.some(r => { const dx = r.bx - r.ax, dz = r.bz - r.az, t = Math.max(0, Math.min(1, ((p.x - r.ax) * dx + (p.z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - r.ax - dx * t, p.z - r.az - dz * t) < r.r; });
 const wet = p => { const st = streams?.at?.(p.x, p.z); return (!!st && st.edge <= 0) || surface(p.x, p.z) === 'water' || inRavine(p); };
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
    // One straight deck from the last dry point to the next; a run that bends
    // off it (a path along a winding creek, Bluebonnet Prairie S1, phase 6:
    // 78 m of deck with the path beside it) is split where it strays furthest
    // until every point is on a deck. A run the one deck covers is as before.
    const deck = (j0, j1) => {
     const a = pts[j0], b = pts[j1], br = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, angle: Math.atan2(b.x - a.x, b.z - a.z), span: Math.hypot(b.x - a.x, b.z - a.z) + 6, width: width + 1};
     let worst = -1, far = 0;
     if (j1 - j0 > 2) for (let j = j0 + 1; j < j1; j++) {
      if (onBridge([br], pts[j].x, pts[j].z, 1)) continue;
      const ax = Math.sin(br.angle), az = Math.cos(br.angle), off = Math.abs((pts[j].x - br.x) * az - (pts[j].z - br.z) * ax);
      if (off > far) { far = off; worst = j; }
     }
     if (worst < 0) bridges.push(br);
     else { deck(j0, worst); deck(worst, j1); }
    };
    deck(Math.max(0, start - 1), Math.min(pts.length - 1, i));
    start = -1;
   }
  }
 }
 return bridges;
}

// THE SHAPE THE OWNER ASKED FOR, MEASURED (tests/paths.test.mjs, the bench's
// `pathSharp` and `pathDeadEnd`): each piece resampled every 2 m; a sharp
// corner is a 4 m stretch turning more than MAX_TURN (and a little, for the
// resampling); a loose end is an end on no other piece (1.5 m) and not back
// on its own line 12 m or more behind it, within the path's width (a
// turnaround loop, whose rounding may ease its join a metre off), and not at a
// building (the clubhouse's door).
export function pathShape(paths, buildings = []) {
 const resample = pts => {
  const out = [pts[0]];
  for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 2)); for (let t = 1; t <= n; t++) out.push({x: a.x + (b.x - a.x) * t / n, z: a.z + (b.z - a.z) * t / n}); }
  return out;
 };
 const segD = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
 const sharp = [], looseEnds = [];
 let worst = 0;
 for (const path of paths) {
  if ((path.points?.length ?? 0) < 2) continue;
  const pts = resample(path.points), t = worstTurn(pts);
  worst = Math.max(worst, t);
  if (t > MAX_TURN + 5) sharp.push({turn: Math.round(t), at: pts[0]});
  for (const end of [0, 1]) {
   const E = end ? path.points[path.points.length - 1] : path.points[0];
   if (buildings.some(b => Math.hypot(E.x - b.x, E.z - b.z) < Math.max(b.width, b.depth) / 2 + 14)) continue;
   let joined = false;
   for (const other of paths) {
    const op = other.points;
    if (other === path) {
     // Its own line, 20 m or more behind this end.
     let run = 0;
     const seq = end ? [...op].reverse() : op;
     for (let k = 1; k < seq.length && !joined; k++) { run += Math.hypot(seq[k].x - seq[k - 1].x, seq[k].z - seq[k - 1].z); if (run >= 12 && segD(E, seq[k - 1], seq[k]) <= (path.width ?? 2.4)) joined = true; }
    } else for (let k = 1; k < op.length && !joined; k++) if (segD(E, op[k - 1], op[k]) <= 1.5) joined = true;
    if (joined) break;
   }
   if (!joined) looseEnds.push(E);
  }
 }
 return {sharp, looseEnds, worstTurn: worst};
}
