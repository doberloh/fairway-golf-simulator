// THE GROUND DRAWN COARSER WITH DISTANCE (the frame-rate goal, 9 November
// 2026). A large built course's ground is one mesh of 20.5 million triangles
// (Dinosaur Mountain: 3,114 by 2,859 m of LIDAR, refined to half a metre
// nearly everywhere because real land is rough), drawn whole into the picture
// and again into every shadow map -- the largest single thing in its frame.
//
// RENDERING ONLY. The ball, the lie and every surface query read the ground
// grid itself (terrain-grid.js `groundHeight`); nothing here touches it. What
// is drawn is a quadtree of squares: near the camera the grid's own triangles,
// further off the 3 m grid without its refinement, further still every
// second, fourth, eighth corner of it. A square is drawn coarser only while
// the most it can be wrong by, seen from the camera, is under `tolerance`
// pixels (`select`) -- so what is drawn differs from the ground the ball
// meets by less than a pixel or two wherever it is looked at. Seams between
// squares drawn at different detail are hidden by skirts: a strip hung down
// from every square's edge, below the ground, where a gap would show.
//
// Pure: arrays in, arrays out, no three.js (tests/ground-lod.test.mjs). The
// renderer (renderer.js `buildGroundLod`) turns each square's triangles into
// a mesh sharing the ground's attributes and switches them each frame.

export const GROUND_LOD = Object.freeze({
 leafCells: 64,     // a leaf square's side in grid cells (192 m at 3 m): the most drawn at full detail
                    // in one piece (384 m leaves drew millions of sub-pixel triangles far off)
 gridCells: 128,    // a square's grid: 128 x 128 cells of its own spacing, so a 384 m
                    // square of plain 3 m ground is one draw (64 drew too many squares)
 skirtMin: 2,       // metres a skirt hangs below its edge at least
 // Only a ground this big is drawn in squares (PLACED): a generated course's is
 // 1.6-2.3 M triangles, one draw, and its squares cost Ultra 7-9% in draws
 // (Redwood Coast, Pacific Northwest) for nothing; Dinosaur Mountain's is 20.5 M.
 minTriangles: 4e6,
});

const MAX = 0x7fffffff;

// The ground grid's vertex at corner (i, j): the coarse corners come first in
// every grid terrain-grid.js makes, refined or not.
const corner = (g, i, j) => j * (g.nx + 1) + i;

// The grid's own triangles (a plain grid has none stored: two a cell).
function fullIndices(g) {
 if (g.indices) return g.indices;
 const out = new Uint32Array(g.nx * g.nz * 6);
 let k = 0;
 for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
  const a = corner(g, i, j), b = a + 1, c = a + g.nx + 1, d = c + 1;
  out[k++] = a; out[k++] = c; out[k++] = b; out[k++] = b; out[k++] = c; out[k++] = d;
 }
 return out;
}
const positionsOf = g => g.positions ?? (() => {
 const p = new Float32Array(g.values.length * 3);
 for (let j = 0; j <= g.nz; j++) for (let i = 0; i <= g.nx; i++) { const n = corner(g, i, j); p[n * 3] = -g.halfX + i * g.dx; p[n * 3 + 1] = g.values[n]; p[n * 3 + 2] = -g.halfZ + j * g.dz; }
 return p;
})();

// The coarse grid's height between its corners, as its two triangles a cell
// draw it (a, c, b and b, c, d: the split from the cell's corner b to c).
function coarseHeight(g, x, z) {
 const u = Math.max(0, Math.min(g.nx - 1e-6, (x + g.halfX) / g.dx)), v = Math.max(0, Math.min(g.nz - 1e-6, (z + g.halfZ) / g.dz));
 const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, w = g.nx + 1, V = g.values;
 const A = V[j * w + i], B = V[j * w + i + 1], C = V[(j + 1) * w + i], D = V[(j + 1) * w + i + 1];
 return a + b <= 1 ? A + (B - A) * a + (C - A) * b : D + (C - D) * (1 - a) + (B - D) * (1 - b);
}

// Every square of the quadtree, built once with the course.
// Returns {nodes, root, extra}: `nodes` [{i0, j0, cells, level, fine, coarse,
// error, fineError, minY, maxY, children}], each square's triangles as
// indices into the ground's vertices followed by `extra` -- the skirts'
// vertices, each a copy of a ground vertex (`extra.from`) lowered by
// `extra.drop` metres.
export function buildGroundLod(g, rules = GROUND_LOD) {
 const P = positionsOf(g), I = fullIndices(g), L = rules.leafCells, G = rules.gridCells;
 const leavesX = Math.ceil(g.nx / L), leavesZ = Math.ceil(g.nz / L);
 let levels = 0; while (L << levels < Math.max(g.nx, g.nz)) levels++;
 const leafOf = (x, z) => {
  const li = Math.min(leavesX - 1, Math.max(0, Math.floor((x + g.halfX) / g.dx / L))), lj = Math.min(leavesZ - 1, Math.max(0, Math.floor((z + g.halfZ) / g.dz / L)));
  return lj * leavesX + li;
 };
 // The grid's triangles, each to the leaf its middle stands in.
 const count = new Int32Array(leavesX * leavesZ);
 const tri = I.length / 3, home = new Int32Array(tri);
 for (let t = 0; t < tri; t++) {
  const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
  home[t] = leafOf((P[a * 3] + P[b * 3] + P[c * 3]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3);
  count[home[t]]++;
 }
 const leafTris = Array.from(count, n => new Uint32Array(n * 3)), fill = new Int32Array(count.length);
 for (let t = 0; t < tri; t++) { const l = home[t], at = fill[l]++ * 3; leafTris[l][at] = I[t * 3]; leafTris[l][at + 1] = I[t * 3 + 1]; leafTris[l][at + 2] = I[t * 3 + 2]; }
 // Each leaf's refinement: how far its own triangles stand off the plain
 // 3 m grid -- what drawing it on that grid would lose.
 const fineError = new Float32Array(count.length), minY = new Float32Array(count.length).fill(Infinity), maxY = new Float32Array(count.length).fill(-Infinity);
 // Each vertex once (a vertex on a leaf's border counts for both sides).
 const corners = (g.nx + 1) * (g.nz + 1), nv = P.length / 3;
 for (let v = 0; v < nv; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  const e = v >= corners ? Math.abs(y - coarseHeight(g, x, z)) : 0;
  const u = (x + g.halfX) / g.dx / L, w = (z + g.halfZ) / g.dz / L;
  for (const li of [Math.floor(u), Math.ceil(u) - 1]) for (const lj of [Math.floor(w), Math.ceil(w) - 1]) {
   if (li < 0 || lj < 0 || li >= leavesX || lj >= leavesZ) continue;
   const l = lj * leavesX + li;
   if (y < minY[l]) minY[l] = y; if (y > maxY[l]) maxY[l] = y; if (e > fineError[l]) fineError[l] = e;
  }
 }
 const extraFrom = [], extraDrop = [], base = P.length / 3;
 // A skirt along every edge of a triangle set used by only one of its
 // triangles: both faces, so it shows from either side, hung `drop` metres.
 // Every triangle of the grid lies inside one 3 m cell and squares are whole
 // cells, so a square's open edges are exactly its triangles' edges lying on
 // its border -- found by position, with no table of every edge (which, on
 // Dinosaur Mountain's 20 million triangles, cost seconds of the course's load).
 const skirt = (tris, drop, b) => {
  const eps = 1e-3, onLine = (v, w) => (Math.abs(P[v * 3] - b.x0) < eps && Math.abs(P[w * 3] - b.x0) < eps) || (Math.abs(P[v * 3] - b.x1) < eps && Math.abs(P[w * 3] - b.x1) < eps)
   || (Math.abs(P[v * 3 + 2] - b.z0) < eps && Math.abs(P[w * 3 + 2] - b.z0) < eps) || (Math.abs(P[v * 3 + 2] - b.z1) < eps && Math.abs(P[w * 3 + 2] - b.z1) < eps);
  const low = new Map(), out = [];
  const lowered = v => { let n = low.get(v); if (n === undefined) { n = base + extraFrom.length; extraFrom.push(v); extraDrop.push(drop); low.set(v, n); } return n; };
  for (let k = 0; k < tris.length; k += 3) for (let e = 0; e < 3; e++) {
   const a = tris[k + e], c = tris[k + (e + 1) % 3];
   if (!onLine(a, c)) continue;
   const a2 = lowered(a), c2 = lowered(c);
   out.push(a, c, c2, a, c2, a2, c, a, a2, c, a2, c2);
  }
  return out;
 };
 const nodes = [];
 const make = (i0, j0, level) => {
  const cells = L << level;
  if (i0 >= g.nx || j0 >= g.nz) return null;
  const node = {i0, j0, cells, level, children: [], fine: null, coarse: null, error: 0, fineError: 0, minY: Infinity, maxY: -Infinity};
  if (level === 0) {
   const l = Math.floor(j0 / L) * leavesX + Math.floor(i0 / L);
   node.fineError = fineError[l]; node.minY = minY[l]; node.maxY = maxY[l];
  } else {
   for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const c = make(i0 + di * (cells >> 1), j0 + dj * (cells >> 1), level - 1);
    if (c) { node.children.push(c); node.fineError = Math.max(node.fineError, c.fineError, c.error); node.minY = Math.min(node.minY, c.minY); node.maxY = Math.max(node.maxY, c.maxY); }
   }
  }
  // Its coarse grid: every `step`-th corner of the 3 m grid, the last row and
  // column at the grid's edge. A leaf's coarse grid is the 3 m grid itself.
  const step = Math.max(1, cells / G), tris = [];
  const is = [], js = [];
  for (let i = i0; i < Math.min(i0 + cells, g.nx); i += step) is.push(i); is.push(Math.min(i0 + cells, g.nx));
  for (let j = j0; j < Math.min(j0 + cells, g.nz); j += step) js.push(j); js.push(Math.min(j0 + cells, g.nz));
  for (let b = 0; b + 1 < js.length; b++) for (let a = 0; a + 1 < is.length; a++) {
   const A = corner(g, is[a], js[b]), B = corner(g, is[a + 1], js[b]), C = corner(g, is[a], js[b + 1]), D = corner(g, is[a + 1], js[b + 1]);
   tris.push(A, C, B, B, C, D);
  }
  // How far that grid stands off the 3 m grid, at every 3 m corner inside.
  let err = 0;
  if (step > 1) for (let b = 0; b + 1 < js.length; b++) for (let a = 0; a + 1 < is.length; a++) {
   const x0 = is[a], x1 = is[a + 1], z0 = js[b], z1 = js[b + 1], w = g.nx + 1, V = g.values;
   const hA = V[z0 * w + x0], hB = V[z0 * w + x1], hC = V[z1 * w + x0], hD = V[z1 * w + x1];
   for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
    const u = (i - x0) / Math.max(1, x1 - x0), v = (j - z0) / Math.max(1, z1 - z0);
    const h = u + v <= 1 ? hA + (hB - hA) * u + (hC - hA) * v : hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
    const e = Math.abs(V[j * w + i] - h); if (e > err) err = e;
   }
  }
  // The coarse grid is wrong by its own error plus whatever refinement it drops.
  node.error = Math.max(err + node.fineError, level ? Math.max(...node.children.map(c => c.error)) : 0);
  const drop = Math.max(rules.skirtMin, node.error * 2);
  const box = nodeBox(g, node);
  node.coarse = Uint32Array.from([...tris, ...skirt(tris, drop, box)]);
  if (level === 0) {
   const l = Math.floor(j0 / L) * leavesX + Math.floor(i0 / L), own = leafTris[l];
   const sk = skirt(own, Math.max(rules.skirtMin, node.fineError * 2 + rules.skirtMin), box);
   const all = new Uint32Array(own.length + sk.length); all.set(own); all.set(sk, own.length); node.fine = all;
   const m = g.mid5 ? middle(g, i0, j0, Math.min(i0 + L, g.nx), Math.min(j0 + L, g.nz)) : null;
   if (m) {
    node.midError = m.error;
    node.mid = Uint32Array.from([...m.tris, ...skirt(m.tris, Math.max(rules.skirtMin, node.fineError * 2 + rules.skirtMin), box)]);
   }
  }
  if (!Number.isFinite(node.minY)) { node.minY = 0; node.maxY = 0; }
  nodes.push(node);
  return node;
 };
 const root = make(0, 0, levels);
 return {nodes, root, extra: {from: Uint32Array.from(extraFrom), drop: Float32Array.from(extraDrop)}, box: (n) => nodeBox(g, n)};
}

// A LEAF AT 1.5 m (the frame-rate goal, 9 November 2026): the grid's own
// cells, each refined one drawn from its corners, the middles of its edges and
// its centre (terrain-grid.js `mid5`, vertices the grid already made) -- 8
// triangles where the grid draws 72 -- a cell beside a refined one as a fan
// round its centre through the middles of its edges that border refined cells,
// as the grid's own fan does through every half-metre point, and a plain cell
// as its two triangles. Every edge is cut at the same points from both sides,
// so the level has no cracks of its own. `error`: the most any half-metre
// point of the grid stands off it.
function middle(g, i0, j0, i1, j1) {
 const tris = [], w = g.nx + 1, M = g.mid5, P = g.positions;
 let error = 0;
 const lerp3 = (h00, h10, h01, h11, fx, fz) => fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
 for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
  const key = j * g.nx + i, m = key * 5, a = j * w + i, b = a + 1, c = a + w, d = c + 1, cell = g.cells?.get(key);
  if (cell?.heights) {
   const mb = M[m], mr = M[m + 1], mt = M[m + 2], ml = M[m + 3], e = M[m + 4];
   tris.push(a, ml, mb, mb, ml, e, mb, e, b, b, e, mr, ml, c, e, e, c, mt, e, mt, mr, mr, mt, d);
   // The half-metre heights against the 3 x 3 they are drawn from.
   const n = cell.n, h = cell.heights, H = n / 2, at = (x, z) => h[z * (n + 1) + x];
   for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const sx = Math.min(1, Math.floor(x / H)), sz = Math.min(1, Math.floor(z / H)), fx = (x - sx * H) / H, fz = (z - sz * H) / H;
    const v = lerp3(at(sx * H, sz * H), at(sx * H + H, sz * H), at(sx * H, sz * H + H), at(sx * H + H, sz * H + H), fx, fz);
    const off = Math.abs(at(x, z) - v); if (off > error) error = off;
   }
  } else if (cell?.ring) {
   const ring = [a, M[m + 3], c, M[m + 2], d, M[m + 1], b, M[m]].filter(v => v >= 0), e = M[m + 4];
   for (let k = 0; k < ring.length; k++) tris.push(e, ring[k], ring[(k + 1) % ring.length]);
   // A dropped ring point against the line between the points either side of it.
   const kept = new Set(ring), rs = cell.ring;
   for (let k = 0; k < rs.length; k++) {
    if (kept.has(rs[k].id)) continue;
    let p = k, q = k; while (!kept.has(rs[p].id)) p = (p + rs.length - 1) % rs.length; while (!kept.has(rs[q].id)) q = (q + 1) % rs.length;
    const span = (q - p + rs.length) % rs.length || 1, f = ((k - p + rs.length) % rs.length) / span;
    const off = Math.abs(rs[k].y - (rs[p].y + (rs[q].y - rs[p].y) * f)); if (off > error) error = off;
   }
  } else tris.push(a, c, b, b, c, d);
 }
 void P;
 return {tris, error};
}

// A square's box in metres.
export function nodeBox(g, n) {
 return {x0: -g.halfX + n.i0 * g.dx, x1: -g.halfX + Math.min(n.i0 + n.cells, g.nx) * g.dx,
  z0: -g.halfZ + n.j0 * g.dz, z1: -g.halfZ + Math.min(n.j0 + n.cells, g.nz) * g.dz, y0: n.minY, y1: n.maxY};
}

// Which squares to draw, and how: [{node, fine, mid}] covering the ground once.
// `camera` {x, y, z}; `focal`: the screen's height in pixels over twice the
// tangent of half the field of view; `tolerance`: pixels. A square is split
// while its error, at its nearest point's distance, would show as more than
// `tolerance` pixels; a leaf is drawn fine while its refinement would.
export function select(lod, g, camera, focal, tolerance) {
 const out = [];
 const dist = n => {
  const b = nodeBox(g, n);
  const dx = Math.max(b.x0 - camera.x, 0, camera.x - b.x1), dy = Math.max(b.y0 - camera.y, 0, camera.y - b.y1), dz = Math.max(b.z0 - camera.z, 0, camera.z - b.z1);
  return Math.max(1, Math.hypot(dx, dy, dz));
 };
 const walk = n => {
  const d = dist(n);
  // A leaf: the 3 m grid while its refinement is under the tolerance, then the
  // 1.5 m level while that is, then the grid's own triangles.
  if (n.level === 0) {
   const coarse = n.fineError * focal / d <= tolerance, mid = !coarse && n.mid && n.midError * focal / d <= tolerance;
   out.push({node: n, fine: !coarse && !mid, mid: !!mid}); return;
  }
  if (n.error * focal / d > tolerance && n.children.length) { for (const c of n.children) walk(c); return; }
  out.push({node: n, fine: false, mid: false});
 };
 if (lod.root) walk(lod.root);
 return out;
}
