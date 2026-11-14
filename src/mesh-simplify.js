// A MODEL MADE COARSER (moved here from tools/far-cluster.mjs on 13 November
// 2026, word for word: the frame-rate pass makes a tree's middle version from
// its full model when a course is built -- mesh-assets.js midParts -- so the
// game needs what until then only the model packer did. tools/far-cluster.mjs
// takes both functions from here.)
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
export function simplifyTo(g, share = 1 / 8, fewest = 24) { return simplifyCells(g, share, fewest)?.part ?? null; }
// The same, with the grid it settled on: {cells, part}. The search is seven or
// eight simplifications; a caller that knows the grid (the game, from
// src/mid-cells.js) makes one with clusterSimplify.
export function simplifyCells(g, share = 1 / 8, fewest = 24) {
 const total = g.index.length / 3, want = Math.max(fewest, Math.ceil(total * share));
 let lo = 2, hi = 160, best = null, at = 0;
 while (lo <= hi) {
  const cells = (lo + hi) >> 1, s = clusterSimplify(g, cells), got = s.index.length / 3;
  if (got >= want) { best = s; at = cells; hi = cells - 1; } else lo = cells + 1;
 }
 if (!best || best.index.length / 3 > total * .6) return null;
 return {cells: at, part: best};
}
