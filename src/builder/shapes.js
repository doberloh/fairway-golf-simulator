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
import {penCurve, TAME} from './pen.js';

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

// SMOOTHING AN EDGE (the Smooth tool; rebuilt 25 November 2026). Where the
// brush reaches (x, z) -- or everywhere, with no (x, z) -- the edge is kept
// only at the points that shape it, any wiggle within `SMOOTH_TOL` of the
// radius dropped (Douglas-Peucker), and the pen's curve drawn through what is
// left (pen.js `penCurve`, tamed as for the map: through every point kept,
// its bends near them). So a wave of the old 1 m squares, a facet of a mapped
// outline and the scallops of a brush stroke all go, and nothing shrinks:
// the curve runs through points of the edge itself, so smoothing again moves
// nothing. Where the brush's reach ends the curve leaves the untouched edge
// in its own direction (its neighbour outside is the curve's).
// CORNERS: with no (x, z) -- Smooth edges on a whole layer -- or a `within`
// (Smooth edge on release: only edges inside that set move, the stroke's own
// band), a corner of the shape -- turning 75 degrees or more within a short
// way, outward -- is kept sharp: a tee's or a box's beside the stroke. The
// brush itself rounds what it is put on, a corner to about its radius.
// A thin path keeps its width: each edge is smoothed along itself, never
// across to the other (the owner, 23 November 2026: "smooth edges on thin
// shapes like cart paths will completely delete large sections of it").
// Shapes the circle would swallow -- under the circle's own area -- go, as
// specks did, and holes as small fill. Returns the new set (the same one when
// nothing was within reach).
// REJECTED: averaging each point with the edge round it, weighted as a bell
// half the radius wide (24 November 2026): it shrank every shape a little at
// each pass, and the cure for that -- leaving alone a point it would move
// under an eighth of the radius -- left alone exactly what needed smoothing:
// on the Alpine draft no size from 1.5 to 10 m changed a wave of the old
// squares (0.4 m every 5 to 10 m) or a mapped green's 10 m facets. Before it,
// Taubin's two steps: 32 rounds cut a square's corner by 0.2 m at a 2 m radius.
// (PLACED: 0.7 of the radius. At 0.35 it kept the crests of the Alpine
// draft's waves, 0.8 m from crest to trough, as points to curve through.)
export const SMOOTH_TOL = .7;
export function smoothEdges(set, {radius = 1.5, x = null, z = null, reach = radius * 4, within = null} = {}) {
 if (!set.length) return set;
 const R = radius * CM, X = x == null ? null : x * CM, Y = z == null ? null : z * CM, RE = reach * CM;
 const tolAll = SMOOTH_TOL * radius, step = Math.max(.05, radius / 5), keepCorners = X == null || !!within;
 const free = q => (X == null || Math.hypot(q[0] * CM - X, q[1] * CM - Y) <= RE) && (!within || contains(within, q[0], q[1]));
 let touched = false;
 // Only the paths near the brush are worked on (and cleaned together); the
 // rest are carried over, as the booleans do.
 const [near, far] = X == null ? [set, []] : split(set, [X - RE - 2 * R, Y - RE - 2 * R, X + RE + 2 * R, Y + RE + 2 * R]);
 const close = (a, b) => { if (X == null) return true; const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((X - a.x) * dx + (Y - a.y) * dy) / L)) : 0; return Math.hypot(a.x + t * dx - X, a.y + t * dy - Y) <= RE + 2 * R; };
 const out = near.map(p => {
  // In metres, points set about `step` apart along the edge where the brush
  // reaches (so a long straight piece crossing it can bend there).
  const pts = [];
  for (let i = 0; i < p.length; i++) {
   const a = p[i], b = p[(i + 1) % p.length]; pts.push([a.x / CM, a.y / CM]);
   if (!close(a, b)) continue;
   const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / CM / step);
   for (let k = 1; k < n; k++) pts.push([(a.x + (b.x - a.x) * k / n) / CM, (a.y + (b.y - a.y) * k / n) / CM]);
  }
  const N = pts.length, isFree = pts.map(free);
  if (N < 4 || !isFree.some(Boolean)) return p;
  touched = true;
  // A THIN SHAPE'S WIGGLES ARE ITS SHAPE: what is dropped is held under a
  // third of its width (twice its area over its edge: a path's width, a
  // green's radius). At 0.7 of the radius alone the 3D editor's brush (1.9 m)
  // turned a 1.8 m path's round end to a point and cut it off, and release
  // smoothing swelled a 1 m stroke 8% and lost its ends.
  let edge = 0; for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length]; edge += Math.hypot(b.x - a.x, b.y - a.y); }
  const tol = Math.min(tolAll, edge ? .35 * 2 * Math.abs(Clipper.area(p)) / edge / CM : tolAll);
  // Corners: kept sharp (a whole layer, or `within`) or, under the brush,
  // rounded -- outward ones and, under the brush, inward ones too.
  const corner = cornerPoints(pts, Clipper.area(p) > 0, Math.max(.3, radius / 3), !keepCorners);
  let ring;
  if (isFree.every(Boolean)) ring = curveRing(pts, [...corner], tol, radius, keepCorners);
  else {
   // Each run of free points between two fixed ones, curved from the fixed
   // point before it to the one after (the fixed points beyond those give the
   // curve its direction in and out).
   const s0 = isFree.findIndex(f => !f), at = i => pts[((i % N) + N) % N];
   ring = [];
   for (let i = s0; i < s0 + N;) {
    if (!isFree[i % N]) { ring.push(at(i)); i++; continue; }
    let e = i; while (e < s0 + N && isFree[e % N]) e++;
    // Points i-1 .. e: the run with its fixed ends; i-2 and e+1 beyond.
    const idx = []; for (let k = i - 1; k <= e; k++) idx.push(k);
    const keep = new Set([0, idx.length - 1]), cl = new Set();
    idx.forEach((k, q) => { if (corner.has(((k % N) + N) % N)) { keep.add(q); cl.add(q); } });
    const nodes = simplifyOpen(idx.map(at), tol, keep, cl);
    const sharpAt = nodes.map((nd, q) => q > 0 && q < nodes.length - 1 && nd.corner);
    const pts2 = keepCorners ? nodes.map(nd => nd.p) : cutCorners(nodes, radius).map(nd => nd.p);
    const sharp2 = keepCorners ? sharpAt : [];
    // (Beyond each end, the first fixed point as far from it as the curve's
    // first piece is long: the very next one, a step away, held the handle
    // at the end short and flattened the curve there -- 3% off a green.)
    const reachOut = (from, dir, want) => { let k = from + dir; for (let g = 0; g < N && Math.hypot(at(k)[0] - at(from)[0], at(k)[1] - at(from)[1]) < want; g++) k += dir; return at(k); };
    const L0 = Math.hypot(pts2[1][0] - pts2[0][0], pts2[1][1] - pts2[0][1]), L1 = Math.hypot(pts2.at(-1)[0] - pts2.at(-2)[0], pts2.at(-1)[1] - pts2.at(-2)[1]);
    const full = [reachOut(i - 1, -1, L0), ...pts2, reachOut(e, 1, L1)];
    const sh = []; sharp2.forEach((s, q) => { if (s) sh.push(q + 1); });
    const curve = penCurve(full, {closed: false, sharp: sh, step: Infinity, tame: true});
    // The part from the fixed point before the run to the one after it (the
    // curve passes through both exactly).
    const from = curve.findIndex(q => q[0] === pts2[0][0] && q[1] === pts2[0][1]);
    let to = -1; for (let q = curve.length - 1; q >= 0; q--) if (curve[q][0] === pts2.at(-1)[0] && curve[q][1] === pts2.at(-1)[1]) { to = q; break; }
    // EASED IN AT THE REACH'S EDGE: each point of the run moved toward the
    // curve (its nearest point on it), all the way within 60% of the reach
    // and less and less beyond, so the smoothed stretch meets the untouched
    // edge without a kink (laid straight in, a brush drawn along Alpine's
    // edges left bends of 20 to 56 degrees at one point where each dab's
    // reach ended, and changed a small green's size 6%).
    const C = from >= 0 && to > from ? curve.slice(from, to + 1) : null;
    for (let k = i; k < e; k++) {
     const P = at(k);
     if (!C) { ring.push(P); continue; }
     const w = X == null ? 1 : Math.max(0, Math.min(1, (1 - Math.hypot(P[0] * CM - X, P[1] * CM - Y) / RE) / .4));
     if (!w) { ring.push(P); continue; }
     let best = null, d0 = Infinity;
     for (let c = 0; c + 1 < C.length; c++) { const a = C[c], b = C[c + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dz) / L)) : 0, qx = a[0] + t * dx, qz = a[1] + t * dz, d = (qx - P[0]) ** 2 + (qz - P[1]) ** 2; if (d < d0) { d0 = d; best = [qx, qz]; } }
     ring.push([P[0] + w * (best[0] - P[0]), P[1] + w * (best[1] - P[1])]);
    }
    i = e;   // the fixed point after the run is pushed as it is
   }
  }
  const q = []; for (const [mx, mz] of ring) { const c = {x: Math.round(mx * CM), y: Math.round(mz * CM)}, l = q.at(-1); if (!l || l.x !== c.x || l.y !== c.y) q.push(c); }
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
const turnOf = (a, b, c) => { const ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1]; return Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz); };
// A shape's corners among an edge's points (metres): where the edge, looked
// at `arm` metres either way, turns 75 degrees or more outward (PLACED) -- the
// sharpest point of each such place.
// And sharp AT the point: looked at a third as far either way it turns
// nearly as much (70%) -- a round end turns as far over the arm, but
// gradually (a 1 m stroke's ends were taken for corners and cut flat).
function cornerPoints(pts, positive, arm, both = false) {
 const N = pts.length, turn = new Float64Array(N), lim = 75 * Math.PI / 180;
 const turnOver = (i, len) => {
  let a = i, b = i, d = 0;
  for (let k = 1; k < N && d < len; k++) { const p = pts[(i - k + N) % N]; d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); a = (i - k + N) % N; }
  d = 0; for (let k = 1; k < N && d < len; k++) { const p = pts[(i + k) % N]; d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); b = (i + k) % N; }
  return a === i || b === i || a === b ? 0 : turnOf(pts[a], pts[i], pts[b]);
 };
 for (let i = 0; i < N; i++) {
  const t = turnOver(i, arm);
  if (!(both || (t > 0) === positive) || Math.abs(t) < lim) continue;
  if (Math.abs(turnOver(i, arm / 3)) >= .7 * Math.abs(t)) turn[i] = Math.abs(t);
 }
 const out = new Set();
 for (let i = 0; i < N; i++) if (turn[i] >= lim && turn[i] >= turn[(i - 1 + N) % N] && turn[i] > turn[(i + 1) % N]) out.add(i);
 return out;
}
// Douglas-Peucker on an open run of points, `keep` (indices) always kept;
// each node kept as {p, corner} (`corners`: indices that are corners).
// Pieces longer than `TAME` (the curve's longest handle) are given nodes
// every TAME metres or so, each the AVERAGE of the edge round it (TAME
// along): a gentle bend kept as one long piece would come out as a straight
// with its turn bunched at the ends, a facet again, and a node on the edge
// itself could sit on a wave's crest. The average of a curve as wide as a
// fairway's sits a few centimetres inside it.
function simplifyOpen(points, tol, keep, corners = new Set()) {
 const nodes = simplifyBare(points, tol, keep, corners), out = [];
 const arc = [0]; for (let i = 1; i < points.length; i++) arc.push(arc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
 for (let q = 0; q < nodes.length; q++) {
  out.push(nodes[q]);
  if (q + 1 === nodes.length) break;
  const s = nodes[q].i, e = nodes[q + 1].i, L = arc[e] - arc[s], k = Math.ceil(L / TAME) - 1;
  for (let m = 1; m <= k; m++) {
   const at = arc[s] + L * m / (k + 1), lo = Math.max(arc[s], at - TAME / 2), hi = Math.min(arc[e], at + TAME / 2);
   let sx = 0, sz = 0, n = 0; for (let i = s; i <= e; i++) if (arc[i] >= lo && arc[i] <= hi) { sx += points[i][0]; sz += points[i][1]; n++; }
   if (n) out.push({p: [sx / n, sz / n], corner: false, i: -1});
  }
 }
 return out;
}
function simplifyBare(points, tol, keep, corners) {
 const ks = [...keep].sort((a, b) => a - b), on = new Uint8Array(points.length);
 for (const k of ks) on[k] = 1;
 for (let q = 0; q + 1 < ks.length; q++) {
  const stack = [[ks[q], ks[q + 1]]];
  while (stack.length) {
   const [s, e] = stack.pop(), [ax, az] = points[s], [bx, bz] = points[e], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
   let worst = -1, at = -1;
   for (let i = s + 1; i < e; i++) { const d = L ? Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / L : Math.hypot(points[i][0] - ax, points[i][1] - az); if (d > worst) { worst = d; at = i; } }
   if (worst > tol) { on[at] = 1; stack.push([s, at], [at, e]); }
  }
 }
 const out = []; for (let i = 0; i < points.length; i++) if (on[i]) out.push({p: points[i], corner: corners.has(i), i});
 return out;
}
// The brush rounds a corner it is put on: a corner node (`cornerPoints`)
// becomes two, `radius` back and on along its edges (at most 45% of each), so
// the curve through them turns round it instead of through its tip. (Only a
// corner: the points kept round a green are 60 degrees apart, and cutting
// those took 11% off it in five dabs.)
function cutCorners(nodes, radius, closed = false) {
 const out = [], M = nodes.length;
 for (let q = 0; q < M; q++) {
  const inner = closed || (q > 0 && q < M - 1);
  const a = nodes[(q - 1 + M) % M].p, b = nodes[q].p, c = nodes[(q + 1) % M].p;
  if (!inner || !nodes[q].corner) { out.push(nodes[q]); continue; }
  const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lb = Math.hypot(c[0] - b[0], c[1] - b[1]), da = Math.min(radius, .45 * la), db = Math.min(radius, .45 * lb);
  out.push({p: [b[0] + (a[0] - b[0]) * da / la, b[1] + (a[1] - b[1]) * da / la], corner: false}, {p: [b[0] + (c[0] - b[0]) * db / lb, b[1] + (c[1] - b[1]) * db / lb], corner: false});
 }
 return out;
}
// A LINE SMOOTHED ([[x, z], ...] metres): its wiggles within `tol` dropped and
// the curve drawn through what is left, as Smooth does to an edge; its ends
// kept where they are (closed: round to its start). Normalize width's middle
// lines, found on a hidden grid (line-work.js), laid smooth.
export function smoothLine(points, tol, closed = false) {
 if (points.length < 3) return points;
 if (closed) return curveRing(points, [], tol, tol, true);
 const nodes = simplifyOpen(points, tol, new Set([0, points.length - 1]));
 return nodes.length < 3 ? nodes.map(nd => nd.p) : penCurve(nodes.map(nd => nd.p), {step: Infinity, tame: true});
}
// A whole outline smoothed (every point within reach): thinned to the points
// that shape it, corners kept, and curved through them closed.
function curveRing(pts, corners, tol, radius, keepCorners) {
 const N = pts.length;
 let ks = [...corners].sort((a, b) => a - b);
 if (ks.length < 2) { let far = 0, d0 = -1; const s = ks[0] ?? 0; for (let i = 0; i < N; i++) { const d = Math.hypot(pts[i][0] - pts[s][0], pts[i][1] - pts[s][1]); if (d > d0) { d0 = d; far = i; } } ks = [...new Set([s, far])].sort((a, b) => a - b); }
 // Rotated to start on the first kept point, closed by repeating it.
 const r = [...pts.slice(ks[0]), ...pts.slice(0, ks[0]), pts[ks[0]]], cs = new Set(corners.map(k => (k - ks[0] + N) % N));
 const keep = new Set([0, N, ...ks.map(k => (k - ks[0] + N) % N)]);
 let nodes = simplifyOpen(r, tol, keep, cs).slice(0, -1);
 if (nodes.length < 3) return pts;
 if (!keepCorners) nodes = cutCorners(nodes, radius, true);
 const sharp = []; if (keepCorners) nodes.forEach((nd, q) => { if (nd.corner) sharp.push(q); });
 return penCurve(nodes.map(nd => nd.p), {closed: true, sharp, step: Infinity, tame: true});
}

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
