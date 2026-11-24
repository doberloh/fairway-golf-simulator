// LINES ON A LAYER (the owner, 23 November 2026). Two things door 2's trace
// does with a line rather than a shape, pure; tests/builder-line-work.test.mjs.
//
// THE LINE TOOL ("a new 'line tool' where i can paint something in a line
// similar to how the outline fill option works but not a shape, just clicking
// on points and drawing a line. with rounded or 90 degree ends"): the pen's
// curve (pen.js) laid `width` metres wide on a layer. Every cell whose middle
// lies within half the width of the line is painted -- the test a brush dab
// uses, so a 2.5 m line and a 2.5 m brush cover the same cells. Bends are
// round. The two ends are round, or cut square across the line at the first
// and last node ('square': the "90 degree ends").
//
// NORMALIZE WIDTH ("a 'normalize cart path width' and 'normalize street
// width' option ... This would make all cart paths a standard width of about
// 1.5 carts wide. Im finding the OSM data has uneven cart paths. We would still
// need to keep intersections of paths the same"): a layer's thin shapes found
// by their middle line and laid again at one width along it. Where two paths
// meet, the meeting point stays where it was and they stay joined: the middle
// lines are smoothed between meetings and ends, never at them. What is wide
// (a parking lot, a cart barn's apron) is kept as drawn -- see AREA below.
//
// Rejected: re-laying OpenStreetMap's own lines at the new width. It would
// only reach paths that came from the map, not those painted by hand or moved
// by Align map, and the owner's uneven paths are on the layer, not the map.
import * as S from './shapes.js';

// A grid as door 2's land: `nx` x `nz` cells of `cell` metres, cell (i, j)'s
// middle at x = -halfX + i * cell, z = -halfZ + j * cell.

// The cells (indices j * nx + i) the line through `points` ([[x, z], ...])
// covers at `width` metres, `caps` 'round' or 'square'. One point: a round dot.
export function lineCells(points, {width, caps = 'round', grid}) {
 const {nx, nz, cell, halfX, halfZ} = grid, r = width / 2, r2 = r * r, out = new Set();
 const pts = points.filter((q, k) => !k || Math.hypot(q[0] - points[k - 1][0], q[1] - points[k - 1][1]) > 1e-6);
 if (!pts.length || !(r > 0)) return [];
 const span = (x0, x1, z0, z1, fn) => {
  const i0 = Math.max(0, Math.floor((x0 + halfX) / cell)), i1 = Math.min(nx - 1, Math.ceil((x1 + halfX) / cell)), j0 = Math.max(0, Math.floor((z0 + halfZ) / cell)), j1 = Math.min(nz - 1, Math.ceil((z1 + halfZ) / cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, -halfX + i * cell, -halfZ + j * cell);
 };
 if (pts.length === 1) { const [x, z] = pts[0]; span(x - r, x + r, z - r, z + r, (i, j, cx, cz) => { if ((cx - x) ** 2 + (cz - z) ** 2 <= r2) out.add(j * nx + i); }); return [...out]; }
 for (let s = 1; s < pts.length; s++) {
  const [ax, az] = pts[s - 1], [bx, bz] = pts[s], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  span(Math.min(ax, bx) - r, Math.max(ax, bx) + r, Math.min(az, bz) - r, Math.max(az, bz) + r, (i, j, cx, cz) => {
   const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / L)), ex = cx - ax - t * dx, ez = cz - az - t * dz;
   if (ex * ex + ez * ez <= r2) out.add(j * nx + i);
  });
 }
 // SQUARE ENDS, SHARP BENDS (23 November 2026: a Line with Auto curve off
 // still came out rounded): each bend's outside filled out to where its two
 // edges meet, as a mitre -- or, past a turn of 150 degrees (PLACED), cut
 // square across. Round ends keep round bends, as the brush lays them.
 if (caps === 'square') for (let s = 1; s + 1 < pts.length; s++) {
  const [ax, az] = pts[s - 1], [bx, bz] = pts[s], [cx, cz] = pts[s + 1];
  let ux = bx - ax, uz = bz - az, vx = cx - bx, vz = cz - bz; const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz); ux /= lu; uz /= lu; vx /= lv; vz /= lv;
  const turn = ux * vz - uz * vx; if (Math.abs(turn) < 1e-6) continue;
  // The outside of the bend: right of the way for a left turn, and the other way.
  const o = turn > 0 ? -1 : 1, n1 = [-uz * o, ux * o], n2 = [-vz * o, vx * o], P = [bx + n1[0] * r, bz + n1[1] * r], Q = [bx + n2[0] * r, bz + n2[1] * r];
  const half = Math.acos(Math.max(-1, Math.min(1, ux * vx + uz * vz))) / 2, quad = [[bx, bz], P];
  if (half < 75 * Math.PI / 180) { const mx = n1[0] + n2[0], mz = n1[1] + n2[1], ml = Math.hypot(mx, mz), k = r / Math.cos(half); quad.push([bx + mx / ml * k, bz + mz / ml * k]); }
  quad.push(Q);
  const xs = quad.map(q => q[0]), zs = quad.map(q => q[1]);
  span(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), (i, j, x, z) => {
   let inside = true, sign = 0;
   for (let q = 0; q < quad.length && inside; q++) { const [px, pz] = quad[q], [qx, qz] = quad[(q + 1) % quad.length], cr = (qx - px) * (z - pz) - (qz - pz) * (x - px); if (Math.abs(cr) < 1e-12) continue; const sg = Math.sign(cr); if (sign && sg !== sign) inside = false; sign = sg; }
   if (inside) out.add(j * nx + i);
  });
 }
 // Square ends: what lies past the end node, across the line there, comes off
 // -- only near the end (within the width), so a line bending back on itself
 // keeps its own cells.
 if (caps === 'square') for (const [p, q] of [[pts[0], pts[1]], [pts.at(-1), pts.at(-2)]]) {
  const dx = p[0] - q[0], dz = p[1] - q[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  span(p[0] - width, p[0] + width, p[1] - width, p[1] + width, (i, j, cx, cz) => {
   const k = j * nx + i; if (!out.has(k)) return;
   if ((cx - p[0]) * ux + (cz - p[1]) * uz > 1e-9 && Math.hypot(cx - p[0], cz - p[1]) <= width) out.delete(k);
  });
 }
 return [...out];
}

// WHAT IS AN AREA, NOT A LINE (PLACED): a part of the layer wider than three
// times the width asked, and at least 8 m, is kept as drawn -- with the parts
// of the layer within that width of it, so its corners stay square and a path
// joins it where it did. At 1.8 m a cart path's own area is anything wider
// than 8 m; at 6 m a street's, wider than 18 m (a parking lot's two rows of
// spaces and the aisle between are about 16 to 20 m).
export const areaWidth = width => Math.max(3 * width, 8);

// A layer's mask (a Uint8Array over the grid) with every thin shape laid again
// `width` metres wide along its middle line. Returns {add, remove}: the cells
// to paint and to take off. Pure; works on the box round the layer only.
export function evenWidth(mask, grid, width) {
 const {nx, nz, cell} = grid, r = width / 2;
 let i0 = nx, i1 = -1, j0 = nz, j1 = -1;
 for (let k = 0; k < mask.length; k++) if (mask[k]) { const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
 if (i1 < 0) return {add: [], remove: []};
 const pad = Math.ceil(areaWidth(width) / cell) + 2;
 i0 = Math.max(0, i0 - pad); i1 = Math.min(nx - 1, i1 + pad); j0 = Math.max(0, j0 - pad); j1 = Math.min(nz - 1, j1 + pad);
 const w = i1 - i0 + 1, h = j1 - j0 + 1, W = w * h, m = new Uint8Array(W), not = new Uint8Array(W);
 for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = mask[(j + j0) * nx + i + i0] ? 1 : 0; m[j * w + i] = v; not[j * w + i] = 1 - v; }
 // How far inside the layer each cell lies, metres (to the nearest cell off it).
 const inside = chamfer(not, w, h, cell);
 // The areas: where a circle `areaWidth` across fits, and the layer within that width of it.
 const T = areaWidth(width) / 2, core = new Uint8Array(W);
 let any = false; for (let c = 0; c < W; c++) if (m[c] && inside[c] - cell / 2 >= T) { core[c] = 1; any = true; }
 const area = new Uint8Array(W);
 if (any) { const near = chamfer(core, w, h, cell); for (let c = 0; c < W; c++) if (m[c] && near[c] <= 2 * T) area[c] = 1; }
 // The thin part's middle line, one cell wide.
 const thin = new Uint8Array(W); for (let c = 0; c < W; c++) thin[c] = m[c] && !area[c] ? 1 : 0;
 const skel = skeleton(thin, w, h);
 // Spurs off a ragged edge go: a branch from a free end to a meeting point
 // shorter than the width asked, or than the layer is wide at the meeting.
 for (let pass = 0; pass < 2; pass++) for (const ch of chains(skel, w, h)) {
  if (ch.closed) continue;
  const free = ch.ends.map(e => e === 1), len = chainLength(ch.cells, w) * cell;
  if (free[0] !== free[1]) { const meet = ch.cells[free[0] ? ch.cells.length - 1 : 0]; if (len < Math.max(width, 1.2 * inside[meet])) for (const c of ch.cells) if (c !== meet) skel[c] = 0; }
 }
 // Each middle line smoothed between its ends, then laid at the width; the
 // ends -- the meetings and the free ends -- stay where they were.
 // THE WIDTH IN WHOLE CELLS (found when the builder journey ran, 23 November
 // 2026: 1.8 m on a 1 m land came out 1 m). The middle line runs through cell
 // middles, so half the width as a reach covers 2 * floor(r / cell) + 1 cells
 // across -- one cell at 1.8 m on 1 m cells. Instead the width is rounded to
 // a whole number of cells, and an even number is laid on a line moved half a
 // cell, between two rows: 1.8 m is 2 cells on 1 m land, 4 on half-metre land.
 const across = Math.max(1, Math.round(width / cell)), even = across % 2 === 0, shift = even ? cell / 2 : 0;
 const lay = 2 * ((even ? across / 2 - .5 : (across - 1) / 2) + .05) * cell;
 const local = {nx: w, nz: h, cell, halfX: 0, halfZ: 0}, out = new Uint8Array(W), reach = Math.max(2, Math.round(width / cell));
 for (const ch of chains(skel, w, h)) {
  const P = ch.cells.map(c => [(c % w) * cell + shift, Math.floor(c / w) * cell + shift]), n = P.length, S = P.map(p => [...p]);
  for (let q = 1; q < n - 1; q++) {
   const k = ch.closed ? reach : Math.min(reach, q, n - 1 - q); let sx = 0, sz = 0;
   for (let d = -k; d <= k; d++) { const p = P[ch.closed ? (q + d + n) % n : q + d]; sx += p[0]; sz += p[1]; }
   S[q] = [sx / (2 * k + 1), sz / (2 * k + 1)];
  }
  for (const c of lineCells(ch.closed ? [...S, S[0]] : S, {width: lay, grid: local})) out[c] = 1;
 }
 for (let c = 0; c < W; c++) if (area[c]) out[c] = 1;
 const add = [], remove = [];
 for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = j * w + i, k = (j + j0) * nx + i + i0; if (out[c] && !m[c]) add.push(k); else if (!out[c] && m[c]) remove.push(k); }
 return {add, remove};
}

// NORMALIZE WIDTH ON OUTLINES (branch builder-outlines, 24 November 2026:
// the builder's layers are outlines, shapes.js). The same rule as
// `evenWidth`, and what it lays is outlines: the wide areas are the layer's
// own outline where a circle `areaWidth` across fits, with the layer within
// that width of it (grown and cut exactly, no cells), and each thin part's
// middle line is laid again as a band `width` wide, round at its ends and
// bends, so two paths that met still meet. Only FINDING the middle line uses
// a grid, hidden and never drawn or traced: the thin part laid on cells a
// quarter of the width across (at least 25 cm, at most 1 m, PLACED), thinned
// to its middle, and the line read off as points. Returns the new set, or
// the same set when it has nothing thin.
export function evenWidthSet(set, width) {
 if (!set.length) return set;
 const T = areaWidth(width) / 2, core = S.grow(set, -T), area = core.length ? S.intersect(set, S.grow(core, 2 * T)) : S.EMPTY;
 const thin = S.difference(set, area); if (!thin.length) return set;
 const [bx0, bz0, bx1, bz1] = S.boundsOf(thin), cell = Math.max(.25, Math.min(1, width / 4)), pad = 2;
 const w = Math.ceil((bx1 - bx0) / cell) + 2 * pad + 1, h = Math.ceil((bz1 - bz0) / cell) + 2 * pad + 1, x0 = bx0 - pad * cell, z0 = bz0 - pad * cell;
 const grid = {nx: w, nz: h, cell, x0, z0}, m = S.rasterize(thin, grid), whole = S.rasterize(set, grid), not = new Uint8Array(w * h);
 for (let c = 0; c < w * h; c++) not[c] = whole[c] ? 0 : 1;
 const inside = chamfer(not, w, h, cell), skel = skeleton(m, w, h);
 for (let pass = 0; pass < 2; pass++) for (const ch of chains(skel, w, h)) {
  if (ch.closed) continue;
  const free = ch.ends.map(e => e === 1), len = chainLength(ch.cells, w) * cell;
  if (free[0] !== free[1]) { const meet = ch.cells[free[0] ? ch.cells.length - 1 : 0]; if (len < Math.max(width, 1.2 * inside[meet])) for (const c of ch.cells) if (c !== meet) skel[c] = 0; }
 }
 // Each middle line smoothed between its ends over about a width, the ends kept.
 const reach = Math.max(2, Math.round(width / cell));
 // Every band gathered and joined at once (one at a time into the whole took
 // 7.3 s on the owner's Alpine Lake roads; together, below).
 const out = [...area];
 for (const ch of chains(skel, w, h)) {
  const P = ch.cells.map(c => [x0 + (c % w) * cell, z0 + Math.floor(c / w) * cell]), n = P.length, Q = P.map(p => [...p]);
  for (let q = 1; q < n - 1; q++) {
   const k = ch.closed ? reach : Math.min(reach, q, n - 1 - q); let sx = 0, sz = 0;
   for (let d = -k; d <= k; d++) { const p = P[ch.closed ? (q + d + n) % n : q + d]; sx += p[0]; sz += p[1]; }
   Q[q] = [sx / (2 * k + 1), sz / (2 * k + 1)];
  }
  out.push(...S.band(ch.closed ? [...Q, Q[0]] : Q, width / 2));
 }
 return S.clean(out);
}

// Distance to the nearest set cell, metres (8-neighbour chamfer, as
// lidar/trace.js distanceFrom; here on a crop).
function chamfer(src, w, h, cell) {
 const N = w * h, d = new Float32Array(N).fill(Infinity), a = cell, b = cell * Math.SQRT2;
 for (let k = 0; k < N; k++) if (src[k]) d[k] = 0;
 for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; let v = d[k];
  if (i > 0) v = Math.min(v, d[k - 1] + a); if (j > 0) { v = Math.min(v, d[k - w] + a); if (i > 0) v = Math.min(v, d[k - w - 1] + b); if (i < w - 1) v = Math.min(v, d[k - w + 1] + b); } d[k] = v; }
 for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) { const k = j * w + i; let v = d[k];
  if (i < w - 1) v = Math.min(v, d[k + 1] + a); if (j < h - 1) { v = Math.min(v, d[k + w] + a); if (i < w - 1) v = Math.min(v, d[k + w + 1] + b); if (i > 0) v = Math.min(v, d[k + w - 1] + b); } d[k] = v; }
 return d;
}

// The eight neighbours, round from east: E, NE, N, NW, W, SW, S, SE (z down
// the grid, so "north" is j - 1; only the order round matters).
const RING = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
const around = (g, w, h, c) => { const i = c % w, j = (c - i) / w; return RING.map(([di, dj]) => { const x = i + di, y = j + dj; return x >= 0 && y >= 0 && x < w && y < h && g[y * w + x] ? 1 : 0; }); };

// THE MIDDLE LINE: Zhang and Suen's thinning (1984) to a line of cells, then
// every cell taken off whose going leaves the line joined just as it was and
// is not an end (Yokoi's connectivity number is 1) -- the corner cells of a
// stair-step, which would otherwise read as meetings. Returns a new mask.
export function skeleton(src, w, h) {
 const g = Uint8Array.from(src); let list = []; for (let c = 0; c < g.length; c++) if (g[c]) list.push(c);
 for (let changed = true; changed;) {
  changed = false;
  for (const sub of [0, 1]) {
   const gone = [];
   for (const c of list) {
    if (!g[c]) continue;
    const [E, NE, N, NW, W, SW, S, SE] = around(g, w, h, c), seq = [N, NE, E, SE, S, SW, W, NW];
    const B = seq.reduce((a, v) => a + v, 0); if (B < 2 || B > 6) continue;
    let A = 0; for (let q = 0; q < 8; q++) if (!seq[q] && seq[(q + 1) % 8]) A++;
    if (A !== 1) continue;
    if (sub === 0 ? (N * E * S || E * S * W) : (N * E * W || N * S * W)) continue;
    gone.push(c);
   }
   for (const c of gone) g[c] = 0;
   if (gone.length) changed = true;
  }
  list = list.filter(c => g[c]);
 }
 for (const c of list) {
  const x = around(g, w, h, c), n = x.reduce((a, v) => a + v, 0); if (n < 2) continue;
  const y = x.map(v => 1 - v); let yokoi = 0; for (const k of [0, 2, 4, 6]) yokoi += y[k] - y[k] * y[k + 1] * y[(k + 2) % 8];
  if (yokoi === 1) g[c] = 0;
 }
 return g;
}

// THE MIDDLE LINE AS CHAINS: from every end and meeting (a cell with other
// than two neighbours) along the line to the next; loops with neither are
// closed chains. Each: {cells, ends: [neighbours at the first, at the last],
// closed}. A lone cell is a chain of one.
export function chains(g, w, h) {
 const N = g.length, deg = new Uint8Array(N), nb = c => { const i = c % w, j = (c - i) / w, out = []; for (const [di, dj] of RING) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < w && y < h && g[y * w + x]) out.push(y * w + x); } return out; };
 const cells = []; for (let c = 0; c < N; c++) if (g[c]) { cells.push(c); deg[c] = nb(c).length; }
 const node = c => deg[c] !== 2, used = new Set(), key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`, out = [];
 const walk = (start, next) => {
  const path = [start]; let prev = start, at = next;
  for (;;) { used.add(key(prev, at)); path.push(at); if (node(at) || at === start) break; const go = nb(at).find(q => q !== prev && !used.has(key(at, q))); if (go == null) break; prev = at; at = go; }
  return path;
 };
 for (const c of cells) if (node(c)) {
  if (deg[c] === 0) { out.push({cells: [c], ends: [0, 0], closed: false}); continue; }
  for (const q of nb(c)) if (!used.has(key(c, q))) { const p = walk(c, q); out.push({cells: p, ends: [deg[p[0]], deg[p.at(-1)]], closed: false}); }
 }
 for (const c of cells) if (!node(c) && nb(c).some(q => !used.has(key(c, q)))) { const p = walk(c, nb(c).find(q => !used.has(key(c, q)))); out.push({cells: p, ends: [2, 2], closed: p.at(-1) === c}); }
 return out;
}

const chainLength = (cells, w) => { let L = 0; for (let q = 1; q < cells.length; q++) { const a = cells[q - 1], b = cells[q]; L += Math.hypot(a % w - b % w, Math.floor(a / w) - Math.floor(b / w)); } return L; };
