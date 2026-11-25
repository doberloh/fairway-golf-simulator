// SURFACES AS OUTLINES (branch builder-outlines; the owner, 24 November 2026:
// "I want these pixellated views gone from the builder entirely. No 're
// processing on a 1m square' or anything like that ... The game doesnt render
// in blocks, why does the builder."). A layer is a set of outlines and every
// tool works on them exactly: a brush stroke is its own swept outline added
// or cut, a fill is the outline drawn, a line its band, Add layer around the
// layer grown. Nothing is laid on a grid and traced back. What comes in as a
// grid (the LIDAR's auto trace, Paint rock on slopes, a draft saved before)
// is turned into outlines once, on the way in (`fromMask`).
//
// The geometry is Clipper2 (Angus Johnson, Boost licence; the TypeScript port
// @countertype/clipper2-ts), in whole centimetres: a SET is Clipper's own
// Paths64 -- outlines with their holes as separate paths, read non-zero --
// never changed in place, so an undo step keeps the set it replaced. Why
// this library, and how fast on a 2.2 x 3.1 km course: RESEARCH, *The builder
// on outlines*. Pure (no DOM); tests/builder-shapes.test.mjs.
import {Clipper, FillRule, JoinType, EndType, ClipType, PolyTree64} from '@countertype/clipper2-ts';
import {maskRings, fitRing, cellArea, ringArea} from '../contour.js';

// Centimetres a metre: a set's points are whole centimetres.
export const CM = 100;
// How far a round end or bend may stray from a true arc, centimetres (PLACED:
// a 3 m brush's edge within 5 cm, about 70 points round; at 1 cm a long
// stroke's two rounded ends and every bend took four times the points).
export const ARC = 5;
// Bends sharper than this cut square across (a mitre past it would reach far
// out): the Line tool's square bends, as line-work.js laid them in cells
// (past a turn of 150 degrees, PLACED there): 1 / cos(75 degrees).
const MITRE = 1 / Math.cos(75 * Math.PI / 180);
export const EMPTY = Object.freeze([]);

const pt = (x, z) => ({x: Math.round(x * CM), y: Math.round(z * CM)});
const NZ = FillRule.NonZero;

// A set from rings in metres ([[x, z], ...]), read even-odd by default (a pen
// outline that crosses itself leaves the crossed part out, as its fill always
// did) or 'nonzero'.
export function fromRings(rings, rule = 'evenodd') {
 const ps = rings.filter(r => r.length >= 3).map(r => r.map(([x, z]) => pt(x, z)));
 return ps.length ? Clipper.union(ps, rule === 'nonzero' ? NZ : FillRule.EvenOdd) : EMPTY;
}
// Rings in metres (outlines and holes, each its own ring).
export const toRings = set => set.map(p => p.map(q => [q.x / CM, q.y / CM]));
export const pointsOf = set => set.reduce((a, p) => a + p.length, 0);

// A path's box, kept with the path (a set's paths never change).
const BOX = new WeakMap();
export function boxOf(path) {
 let b = BOX.get(path);
 if (!b) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of path) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; } b = [x0, y0, x1, y1]; BOX.set(path, b); }
 return b;
}
const boxOfSet = set => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of set) { const b = boxOf(p); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); } return [x0, y0, x1, y1]; };
// A set's box in metres [x0, z0, x1, z1], or null when it is empty.
export const boundsOf = set => { if (!set.length) return null; const b = boxOfSet(set); return b.map(v => v / CM); };

// THE BOOLEANS, ON THE PART THAT CAN CHANGE. Only the paths whose box meets
// the other set's box go through Clipper; the rest are carried over as they
// are. A set's paths never overlap (only holes lie inside their outlines, and
// islands inside holes), and an operation changes nothing outside the other
// set's box, so the carried paths still read right, non-zero: a hole carried
// on its own still cuts the outline that went through. On the biggest layer
// of the owner's Alpine Lake (36,000 points) a brush stroke took 8 ms this
// way at the median, 32 ms through the whole layer.
function split(a, box) {
 const near = [], far = [];
 for (const p of a) { const b = boxOf(p); (b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3] ? far : near).push(p); }
 return [near, far];
}
function op(type, a, b) {
 if (!b.length) return type === ClipType.Intersection ? EMPTY : a;
 if (!a.length) return type === ClipType.Union ? Clipper.union(b, NZ) : EMPTY;
 if (type === ClipType.Intersection) return Clipper.booleanOp(type, a, b, NZ);
 const [near, far] = split(a, boxOfSet(b));
 if (!near.length && type === ClipType.Difference) return a;
 const got = Clipper.booleanOp(type, near, b, NZ);
 return far.length ? far.concat(got) : got;
}
export const union = (a, b) => op(ClipType.Union, a, b);
export const difference = (a, b) => op(ClipType.Difference, a, b);
export const intersect = (a, b) => op(ClipType.Intersection, a, b);
// The set cleaned into Clipper's own form (after paths were carried over).
export const clean = set => set.length ? Clipper.union(set, NZ) : EMPTY;

// A round dab, `r` metres round (x, z).
export const disc = (x, z, r) => r > 0 ? Clipper.inflatePaths([[pt(x, z)]], r * CM, JoinType.Round, EndType.Round, 2, ARC) : EMPTY;
// A rectangle [x0, z0, x1, z1] in metres.
export const rect = ([x0, z0, x1, z1]) => fromRings([[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]]);

// A BAND `r` metres either side of a line through `points` ([[x, z], ...]):
// a brush stroke, the Line tool. `caps` 'round' (round ends and bends, as a
// brush lays them) or 'square' (cut square across at the first and last
// node, bends mitred and cut square past 150 degrees: the "90 degree ends").
export function band(points, r, caps = 'round') {
 const ps = points.map(([x, z]) => pt(x, z)).filter((q, k, a) => !k || q.x !== a[k - 1].x || q.y !== a[k - 1].y);
 if (!ps.length || !(r > 0)) return EMPTY;
 if (ps.length === 1 || caps === 'round') return Clipper.inflatePaths([ps], r * CM, JoinType.Round, EndType.Round, 2, ARC);
 return Clipper.inflatePaths([ps], r * CM, JoinType.Miter, EndType.Butt, MITRE, ARC);
}
// The set grown (`d` > 0) or shrunk (`d` < 0) by `d` metres, round.
export const grow = (set, d) => set.length && d ? Clipper.inflatePaths(set, d * CM, JoinType.Round, EndType.Polygon, 2, ARC) : set;

// Area, square metres.
export const areaOf = set => set.reduce((a, p) => a + Clipper.area(p), 0) / (CM * CM);

// THE SHAPES OF A SET: each outline with its holes ({outer, holes}, paths).
export function parts(set) {
 if (!set.length) return [];
 const tree = new PolyTree64(), out = [];
 Clipper.booleanOpWithPolyTree(ClipType.Union, set, null, tree, NZ);
 const walk = node => { for (let i = 0; i < node.count; i++) { const o = node.child(i), holes = []; for (let j = 0; j < o.count; j++) { const h = o.child(j); holes.push(h.poly); walk(h); } out.push({outer: o.poly, holes}); } };
 walk(tree);
 return out;
}
const join = ps => ps.flatMap(p => [p.outer, ...p.holes]);
export const setOf = part => [part.outer, ...part.holes];
// TIDY: shapes under `speck` m² go and holes under `pock` m² fill.
export function tidy(set, speck, pock) {
 const ps = parts(set);
 const kept = ps.filter(p => Clipper.area(p.outer) / (CM * CM) >= speck).map(p => ({outer: p.outer, holes: p.holes.filter(h => Math.abs(Clipper.area(h)) / (CM * CM) >= pock)}));
 return kept.length === ps.length && kept.every((p, i) => p.holes.length === ps[i].holes.length) ? set : join(kept);
}

// IS (x, z) INSIDE? The winding round it, non-zero. A long path keeps its
// edges in bands of height, so asking a 36,000-point road is a few hundred
// edges, not all of them.
const BANDS = new WeakMap(), NB = 64;
function bandsOf(path) {
 let e = BANDS.get(path); if (e) return e;
 const [, y0, , y1] = boxOf(path), h = (y1 - y0) / NB || 1, rows = Array.from({length: NB}, () => []);
 for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
  const a = path[j], b = path[i], lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
  for (let r = Math.max(0, Math.floor((lo - y0) / h)); r <= Math.min(NB - 1, Math.floor((hi - y0) / h)); r++) rows[r].push(j, i);
 }
 e = {y0, h, rows}; BANDS.set(path, e); return e;
}
function winding(path, x, y) {
 const [x0, y0, x1, y1] = boxOf(path); if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
 let w = 0;
 const edge = (a, b) => { if (a.y <= y) { if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++; } else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--; };
 if (path.length < 256) { for (let i = 0, j = path.length - 1; i < path.length; j = i++) edge(path[j], path[i]); return w; }
 const B = bandsOf(path), row = B.rows[Math.max(0, Math.min(NB - 1, Math.floor((y - B.y0) / B.h)))];
 for (let k = 0; k < row.length; k += 2) edge(path[row[k]], path[row[k + 1]]);
 return w;
}
export function contains(set, x, z) {
 const X = x * CM, Y = z * CM; let w = 0;
 for (const p of set) w += winding(p, X, Y);
 return w !== 0;
}
// The shape of a set that holds (x, z), or null.
export function partAt(set, x, z) {
 const X = x * CM, Y = z * CM;
 for (const p of parts(set)) if (winding(p.outer, X, Y) && !p.holes.some(h => winding(h, X, Y))) return p;
 return null;
}

// Every point moved by `fn([x, z]) -> [x, z]` (metres): a shape moved or turned.
export const mapPoints = (set, fn) => set.map(p => p.map(q => { const [x, z] = fn([q.x / CM, q.y / CM]); return pt(x, z); }));
export const moved = (set, dx, dz) => set.length ? Clipper.translatePaths(set, Math.round(dx * CM), Math.round(dz * CM)) : set;
// Turned `angle` radians about (cx, cz), as the trace turns a shape (+angle
// takes +x toward +z).
export function turned(set, angle, cx, cz) {
 const c = Math.cos(angle), s = Math.sin(angle);
 return mapPoints(set, ([x, z]) => [cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c]);
}
// Where a set's area balances, metres.
export function middleOf(set) {
 let a = 0, cx = 0, cz = 0;
 for (const p of set) for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j].x * p[i].y - p[i].x * p[j].y; a += f; cx += (p[j].x + p[i].x) * f; cz += (p[j].y + p[i].y) * f; }
 return a ? [cx / (3 * a) / CM, cz / (3 * a) / CM] : [0, 0];
}

// SMOOTHING AN EDGE (the Smooth tool). Each outline is set out in points
// about a tenth of the radius apart along its edge, and each point near
// (x, z) -- or every point, with no (x, z) -- takes the average of the edge
// round it, weighted as a bell half the radius wide (so a corner rounds to
// about the radius, a notch narrower than that fills, a wobble goes), eased
// to nothing at the reach's edge. A thin path keeps its width: each edge is
// smoothed along itself, never across to the other (the owner, 23 November
// 2026: "smooth edges on thin shapes like cart paths will completely delete
// large sections of it"). Shapes the circle would swallow -- under the
// circle's own area -- go, as specks did. Returns the new set (the same one
// when nothing was within reach). Rejected: easing each point toward its two
// neighbours and back (Taubin's two steps): 32 rounds of it cut a square's
// corner by 0.2 m at a 2 m radius -- a radius barely seen.
// IT SETTLES (24 November 2026): a point the bell would move less than an
// eighth of the radius stays where it is, and one it would move a quarter or
// more moves all the way (in between, part of it). A bell this wide moves a
// point on an edge curving round a radius of r by about radius² / (8 r), so
// an edge already rounder than the radius never moves: smoothing the same
// place again changes nothing, where an untouched bell shrank every shape a
// little at each pass (a green 2 cm a dab) and rounded a box's corners
// further with every stroke beside it. `within`: a set; only points inside
// it move (a stroke's own band, for Smooth edge on release).
export function smoothEdges(set, {radius = 1.5, x = null, z = null, reach = radius * 4, within = null} = {}) {
 if (!set.length) return set;
 const R = radius * CM, step = Math.max(5, R / 10), X = x == null ? null : x * CM, Y = z == null ? null : z * CM, RE = reach * CM, SETTLE = R / 8;
 const weight = q => (X == null ? 1 : Math.max(0, 1 - Math.hypot(q.x - X, q.y - Y) / RE)) * (within && !contains(within, q.x / CM, q.y / CM) ? 0 : 1);
 const sigma = R / 2 / step, half = Math.ceil(3 * sigma), bell = Array.from({length: 2 * half + 1}, (_, k) => Math.exp(-((k - half) ** 2) / (2 * sigma * sigma)));
 let touched = false;
 // Only the paths near the brush are worked on (and cleaned together); the
 // rest are carried over, as the booleans do.
 // (Set out evenly two radii past the reach, so no point the brush moves
 // averages over a far corner: the bell reaches a radius and a half.)
 const [near, far] = X == null ? [set, []] : split(set, [X - RE - 2 * R, Y - RE - 2 * R, X + RE + 2 * R, Y + RE + 2 * R]);
 const close = (a, b) => { if (X == null) return true; const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((X - a.x) * dx + (Y - a.y) * dy) / L)) : 0; return Math.hypot(a.x + t * dx - X, a.y + t * dy - Y) <= RE + 2 * R; };
 const out = near.map(p => {
  // Points set about `step` apart along the edge where the brush reaches.
  const pts = [];
  for (let i = 0; i < p.length; i++) {
   const a = p[i], b = p[(i + 1) % p.length]; pts.push({x: a.x, y: a.y});
   if (!close(a, b)) continue;
   const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / step);
   for (let k = 1; k < n; k++) pts.push({x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n});
  }
  const w = pts.map(weight); if (!w.some(v => v > 0)) return p;
  touched = true;
  const n = pts.length, q = [];
  for (let i = 0; i < n; i++) {
   if (!w[i]) { q.push(pts[i]); continue; }
   let sx = 0, sy = 0, sw = 0;
   for (let k = -half; k <= half; k++) { const o = pts[((i + k) % n + n) % n], g = bell[k + half]; sx += o.x * g; sy += o.y * g; sw += g; }
   const dx = sx / sw - pts[i].x, dy = sy / sw - pts[i].y, f = w[i] * Math.max(0, Math.min(1, (Math.hypot(dx, dy) - SETTLE) / SETTLE));
   q.push({x: Math.round(pts[i].x + f * dx), y: Math.round(pts[i].y + f * dy)});
  }
  return Clipper.simplifyPath(q, 1, true);
 });
 if (!touched) return set;
 // Cleaned (an eased thin shape may cross itself) counting only the ground
 // inside an outline more than inside its holes ("positive"), so a hole eased
 // out past its outline's edge does not fill; and the specks dropped.
 const speck = Math.PI * radius * radius, cleaned = Clipper.union(out.filter(p => p.length >= 3), FillRule.Positive);
 // (Holes under the circle's area -- pocks -- fill, as specks go.)
 const reached = path => X == null || inReach(path, X, Y, RE), small = path => Math.abs(Clipper.area(path)) / (CM * CM) < speck;
 const kept = join(parts(cleaned).filter(p => !small(p.outer) || !reached(p.outer)).map(p => ({outer: p.outer, holes: p.holes.filter(h => !small(h) || !reached(h))})));
 return far.length ? far.concat(kept) : kept;
}
const inReach = (path, X, Y, RE) => path.some(q => Math.hypot(q.x - X, q.y - Y) <= RE);

// A GRID TURNED INTO OUTLINES, ONCE, AS IT COMES IN: the LIDAR's auto trace,
// Paint rock on slopes, a draft saved before outlines. Traced round its
// cells and fitted (contour.js `fitRing`: straight where the cells ran
// straight, sharp where they turned a corner, curved elsewhere, grown back to
// the cells' own area), scraps under `speck` m² dropped. `grid` as door 2's
// land: cell (i, j)'s middle at (x0 + i * cell, z0 + j * cell), x0 = -halfX.
export function maskOutlines(m, {nx, nz, cell, halfX, halfZ, x0 = -halfX, z0 = -halfZ}, speck = 0) {
 return maskRings((i, j) => m[j * nx + i] === 1, nx, nz, x0, z0, cell)
  .map(r => fitRing(r, cell, {area: cellArea(r, x0, cell)})).filter(r => r.length >= 3 && ringArea(r) > speck);
}
export const fromMask = (m, grid, speck = 0) => fromRings(maskOutlines(m, grid, speck));

// A HIDDEN LOOKUP, NEVER DRAWN: the cells of `grid` whose middle a set
// covers, written into `mask` as `v` (for what still asks by cell -- the
// ground smoothed under a green, a hole's green found by its blob).
// Each edge is handed to the rows it crosses only (a road of 36,000 points
// over 3,000 rows asked every edge on every row: a third of a second).
export function rasterize(set, {nx, nz, cell, halfX, halfZ, x0 = -halfX, z0 = -halfZ}, mask = new Uint8Array(nx * nz), v = 1) {
 if (!set.length) return mask;
 const rows = new Map(), row = y => (y / CM - z0) / cell;
 for (const p of set) for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
  const a = p[k], c = p[i]; if (a.y === c.y) continue;
  const lo = Math.max(0, Math.ceil(row(Math.min(a.y, c.y)))), hi = Math.min(nz - 1, Math.floor(row(Math.max(a.y, c.y))));
  for (let j = lo; j <= hi; j++) {
   const Y = (z0 + j * cell) * CM; if ((a.y > Y) === (c.y > Y)) continue;
   let xs = rows.get(j); if (!xs) rows.set(j, xs = []);
   xs.push((a.x + (Y - a.y) / (c.y - a.y) * (c.x - a.x)) / CM);
  }
 }
 for (const [j, xs] of rows) {
  xs.sort((a, b) => a - b);
  for (let q = 0; q + 1 < xs.length; q += 2) { const i0 = Math.max(0, Math.ceil((xs[q] - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / cell)); if (i1 >= i0) mask.fill(v, j * nx + i0, j * nx + i1 + 1); }
 }
 return mask;
}

// A set as JSON-able numbers (a draft's): each path a flat [x, z, x, z, ...]
// of whole centimetres. And back.
export const packSet = set => set.map(p => p.flatMap(q => [q.x, q.y]));
export const unpackSet = list => (list ?? []).filter(a => a.length >= 6).map(a => { const p = []; for (let i = 0; i + 1 < a.length; i += 2) p.push({x: a[i] | 0, y: a[i + 1] | 0}); return p; });
