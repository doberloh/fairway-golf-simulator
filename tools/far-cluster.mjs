// A MODEL'S FAR VERSION, MADE WHEN THE MODELS ARE PACKED (the frame-rate goal,
// 9 November 2026). tools/build-meshes.mjs gives every model over
// AUTO_FAR_MIN triangles that has no far version of its own -- 126 of them,
// the Meshy remakes and most Blender packs among them -- one made here, so the
// renderer can draw it where the model is small on screen (instance-cull.js,
// the `farPainted` line). A Blender-built twin (cartoon.py `far_twin`) is
// always preferred where one ships: it rebuilds each lobe as a small solid,
// which keeps a cartoon crown's look better than any simplifier.
//
// VERTEX CLUSTERING, the oldest way to make a distant version: the model's
// box is cut into a grid, every vertex in a cell is merged into one (its
// average position, normal and paint), and a triangle whose corners land in
// fewer than three cells is dropped. It is deterministic, has no dependency,
// and keeps the paint. The grid is the coarsest that keeps at least the target
// share of the triangles (`simplifyTo`). It does NOT keep every silhouette:
// thin canes, flat mats and layered sprays collapse at an eighth (first
// assumed harmless at 5-30% of the screen's height, and seen to be wrong in
// free flight on Low), so `farVersion` steps the share up until the outline
// holds (`outlineScore`, below).
//
// Pure: arrays in, arrays out (tests/far-cluster.test.mjs).

// One part, merged on a grid of `cells` along its longest side. `g`:
// {position: Float32Array|number[], normal?, color? (4 a vertex), index}.
export function clusterSimplify(g, cells) {
 const p = g.position, n = p.length / 3;
 let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
 for (let i = 0; i < n; i++) {
  const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
  if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
 }
 const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-9) / cells, K = cells + 2;
 const cellOf = new Int32Array(n), slot = new Map(), sums = [];
 for (let i = 0; i < n; i++) {
  const key = Math.floor((p[i * 3] - minX) / size) + K * (Math.floor((p[i * 3 + 1] - minY) / size) + K * Math.floor((p[i * 3 + 2] - minZ) / size));
  let s = slot.get(key);
  if (s === undefined) { s = sums.length; slot.set(key, s); sums.push({count: 0, p: [0, 0, 0], n: [0, 0, 0], c: [0, 0, 0, 0]}); }
  cellOf[i] = s;
  const e = sums[s]; e.count++;
  for (let k = 0; k < 3; k++) { e.p[k] += p[i * 3 + k]; if (g.normal) e.n[k] += g.normal[i * 3 + k]; }
  if (g.color) for (let k = 0; k < 4; k++) e.c[k] += g.color[i * 4 + k];
 }
 // The triangles that survive, each once (two faces folded onto the same
 // three cells -- a leaf's front and back -- would draw twice).
 const seen = new Set(), tris = [];
 for (let t = 0; t < g.index.length; t += 3) {
  const a = cellOf[g.index[t]], b = cellOf[g.index[t + 1]], c = cellOf[g.index[t + 2]];
  if (a === b || b === c || a === c) continue;
  // Winding kept: the triple turned to start at its smallest cell, so the same
  // face is one key and its back face (the other way round) another.
  const key = a < b && a < c ? `${a},${b},${c}` : b < c ? `${b},${c},${a}` : `${c},${a},${b}`;
  if (seen.has(key)) continue;
  seen.add(key); tris.push(a, b, c);
 }
 // Only the cells some triangle uses, renumbered.
 const used = new Int32Array(sums.length).fill(-1), order = [];
 for (const s of tris) if (used[s] < 0) { used[s] = order.length; order.push(s); }
 const position = new Float32Array(order.length * 3), normal = g.normal ? new Float32Array(order.length * 3) : null, color = g.color ? new Float32Array(order.length * 4) : null;
 order.forEach((s, j) => {
  const e = sums[s];
  for (let k = 0; k < 3; k++) position[j * 3 + k] = e.p[k] / e.count;
  if (normal) { const l = Math.hypot(...e.n) || 1; for (let k = 0; k < 3; k++) normal[j * 3 + k] = e.n[k] / l; }
  if (color) for (let k = 0; k < 4; k++) color[j * 4 + k] = e.c[k] / e.count;
 });
 return {position, normal, color, index: Uint32Array.from(tris, s => used[s])};
}

// The coarsest grid that keeps at least `share` of the triangles (and at
// least `fewest`), searched over grid sizes. Returns null when even the
// finest grid tried saves too little to be worth shipping (under 40%).
export function simplifyTo(g, share = 1 / 8, fewest = 24) {
 const total = g.index.length / 3, want = Math.max(fewest, Math.ceil(total * share));
 let lo = 2, hi = 160, best = null;
 while (lo <= hi) {
  const cells = (lo + hi) >> 1, s = clusterSimplify(g, cells), got = s.index.length / 3;
  if (got >= want) { best = s; hi = cells - 1; } else lo = cells + 1;
 }
 if (!best || best.index.length / 3 > total * .6) return null;
 return best;
}

// THE OUTLINE KEPT (9 November 2026). An eighth of the triangles was right for
// most crowns and wrong for thin and flat things: the ocotillo's canes merged
// into a leafy clump, the lake juniper's low mat into a line, the Pacific
// dogwood's tiers of leaves into a few slivers -- and Low and Medium swap to a
// far version from tens of metres. So every far version is drawn beside its
// model from the front and the side, level and from 35 degrees above, `size`
// pixels tall (Low's swap size: 15% of a 675-pixel screen is about 100), and
// scored: `kept`, the share of the model's outline the far version still
// covers, each outline grown by a pixel first so a one-pixel shift costs
// nothing; `extra`, the share of the far version drawn where the model is not
// (a clump); and `area`, the far version's drawn pixels over the model's, with
// no allowance -- the sassafras's layered leaves thinned to dashes kept 0.88 of
// the grown outline but only 0.58 of the area. The worst view counts.
// Measured on the far versions shipped by hand in Blender (253, which the
// owner has seen for weeks), with these four views: kept 0.95 at the median,
// 0.88 at the tenth percentile; extra 0.08 at the ninetieth; area 0.91 at the
// median, 0.82 at the fifth percentile. FAR_OUTLINE sits a little below that:
// PLACED.
export const FAR_OUTLINE = {kept: .85, extra: .10, area: .80, size: 100, shares: [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2]};

function boxOf(parts) {
 const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
 for (const g of parts) for (let i = 0; i < g.position.length; i++) { const k = i % 3; if (g.position[i] < lo[k]) lo[k] = g.position[i]; if (g.position[i] > hi[k]) hi[k] = g.position[i]; }
 return {lo, hi};
}

// One view's outline: across is x (or z, from the side), up is y, seen from
// `elev` radians above level; framed by `frame` (the model's box) so the model
// and its far version line up.
function mask(parts, frame, side, size, elev = 0) {
 const scale = size / Math.max(frame.hi[1] - frame.lo[1], 1e-9), a = side ? 2 : 0, d = side ? 0 : 2;
 const ce = Math.cos(elev), se = Math.sin(elev), depth = frame.hi[d] - frame.lo[d], dmid = (frame.lo[d] + frame.hi[d]) / 2;
 const mid = (frame.lo[a] + frame.hi[a]) / 2, W = Math.max(8, Math.ceil((frame.hi[a] - frame.lo[a]) * scale * 1.1) + 4);
 const H = Math.ceil(((frame.hi[1] - frame.lo[1]) * ce + depth * se) * scale) + 4;
 const m = new Uint8Array(W * H);
 for (const g of parts) {
  const p = g.position, idx = g.index;
  const X = i => W / 2 + (p[i * 3 + a] - mid) * scale;
  const Y = i => H - 2 - ((p[i * 3 + 1] - frame.lo[1]) * ce + (p[i * 3 + d] - dmid + depth / 2) * se) * scale;
  for (let t = 0; t < idx.length; t += 3) {
   const x0 = X(idx[t]), y0 = Y(idx[t]), x1 = X(idx[t + 1]), y1 = Y(idx[t + 1]), x2 = X(idx[t + 2]), y2 = Y(idx[t + 2]);
   const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
   if (Math.abs(area) < 1e-12) continue;
   const xa = Math.max(0, Math.floor(Math.min(x0, x1, x2))), xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
   const ya = Math.max(0, Math.floor(Math.min(y0, y1, y2))), yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
   for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + .5, py = y + .5;
    const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
    if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) m[y * W + x] = 1;
   }
  }
 }
 return {m, W, H};
}

function grown({m, W, H}) {
 const g = new Uint8Array(W * H);
 for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x])
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy * W + xx] = 1; }
 return g;
}

// The views scored: front and side, level and from 35 degrees above (the tee
// cameras and free flight look down on trees, and a level view sees a layered
// spray edge-on -- the sassafras's tiers thinned to dashes scored 0.88 level).
const VIEWS = [[false, 0], [true, 0], [false, 35 * Math.PI / 180], [true, 35 * Math.PI / 180]];

// `near` and `far`: arrays of parts ({position, index}). The worst view counts.
export function outlineScore(near, far, size = FAR_OUTLINE.size) {
 const frame = boxOf(near);
 let kept = 1, extra = 0, area = Infinity;
 for (const [side, elev] of VIEWS) {
  const a = mask(near, frame, side, size, elev), b = mask(far, frame, side, size, elev), ga = grown(a), gb = grown(b);
  let na = 0, nb = 0, aInB = 0, bInA = 0;
  for (let k = 0; k < a.m.length; k++) { na += a.m[k]; nb += b.m[k]; if (a.m[k] && gb[k]) aInB++; if (b.m[k] && ga[k]) bInA++; }
  kept = Math.min(kept, na ? aInB / na : 1);
  area = Math.min(area, na ? nb / na : 1);
  extra = Math.max(extra, nb ? 1 - bInA / nb : 0);
 }
 return {kept, extra, area};
}

// A model's far version: its parts each simplified to the smallest share in
// FAR_OUTLINE.shares whose outline passes, a part that would not save kept
// whole. Null when no share passes -- the model is then drawn in full at
// every distance, as before the far versions.
export function farVersion(parts, opts = FAR_OUTLINE) {
 for (const share of opts.shares) {
  const far = parts.map(g => simplifyTo(g, share) || g);
  const score = outlineScore(parts, far, opts.size);
  if (score.kept >= opts.kept && score.extra <= opts.extra && score.area >= (opts.area ?? 0)) return {share, parts: far, score};
 }
 return null;
}
