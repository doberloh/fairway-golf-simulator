// THE TWIG LAYER (the seasons, 3 November 2026; PLAN.md section 3, local): what
// a broadleaf tree's crown is in winter. A bare tree used to be the model's
// trunk and its few limbs with the leaf part left out -- a maple's bark is 216
// triangles, so a New England wood in December was a stand of forked posts.
// This grows the branches the leaves were hiding, from the model itself, so
// no new model ships and every species keeps its own outline: the attractors
// are the leaf part's own vertices, so a vase-shaped elm's twigs fill a vase
// and a bur oak's a wide flat crown (the owner's silhouette rule).
//
// SPACE COLONISATION (Runions, Lane and Prusinkiewicz, 2007; RESEARCH.md *The
// twig layer*): points scattered through the crown pull the nearest branch
// tip toward them, a point is used up when a branch reaches it, and a tip that
// nothing pulls stops. It branches by itself and it cannot leave the crown.
// Thickness comes back down the finished tree, parents from their children
// (the pipe model). Everything here is PLACED against the pictures, in units
// of the model's height (models are unit height).
//
// Pure: no DOM, no three.js (tests/twigs.test.mjs). mesh-assets.js `bareParts`
// turns the result into geometry and merges it into the bark, so a bare tree
// costs no draw call a summer tree does not, and has far fewer triangles.

const ATTRACTORS = 230, MAX_NODES = 400, MAX_ROUNDS = 60, STARTS = 16;
const TWIG = .0026, LIMB = .013, PIPE = 2.3;
// A fine spray off every twig's end: the fuzz a bare crown has against the sky.
const SPRAY = .07, SPRAY_SPREAD = .5;
// A tree seen from far off (the far twin): the stronger branches only, stouter
// so they still cover a pixel. FAR_TIPS: the least a branch must carry.
const FAR_TIPS = 2, FAR_WIDTH = 1.6;

// A seeded stream (mulberry32) so a model's twigs are the same on every copy.
function stream(seed) {
 let s = 0;
 for (let i = 0; i < seed.length; i++) s = (Math.imul(s, 31) + seed.charCodeAt(i)) | 0;
 return () => {
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 };
}

// Every stride'th vertex of a position array, as many as `count` at most.
function sampled(positions, count) {
 const n = positions.length / 3, stride = Math.max(1, Math.ceil(n / count)), out = [];
 for (let i = 0; i < n; i += stride) out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
 return out;
}

// The points of a list furthest from each other, the first the highest: a
// limb's end is an extreme, so every limb gets a start at its end. A plain
// sample left limbs stopping in mid-air where the leaves had hidden the end.
function spreadOut(points, count) {
 const n = points.length / 3, far = new Float64Array(n).fill(Infinity), out = [];
 let pick = 0;
 for (let i = 1; i < n; i++) if (points[i * 3 + 1] > points[pick * 3 + 1]) pick = i;
 for (let k = 0; k < Math.min(count, n); k++) {
  out.push(points[pick * 3], points[pick * 3 + 1], points[pick * 3 + 2]);
  let next = 0;
  for (let i = 0; i < n; i++) {
   const d = Math.hypot(points[i * 3] - points[pick * 3], points[i * 3 + 1] - points[pick * 3 + 1], points[i * 3 + 2] - points[pick * 3 + 2]);
   if (d < far[i]) far[i] = d;
   if (far[i] > far[next]) next = i;
  }
  pick = next;
 }
 return out;
}

// Where the branches start: the bark in and just under the crown, or the
// model's foot if it has none.
function startsFrom(bark, leaf) {
 let low = Infinity, sum = 0;
 const n = leaf.length / 3;
 for (let i = 0; i < n; i++) { const y = leaf[i * 3 + 1]; if (y < low) low = y; sum += y; }
 const from = low + (sum / n - low) * .25, kept = [];
 for (let i = 0; i < bark.length; i += 3) if (bark[i + 1] >= from) kept.push(bark[i], bark[i + 1], bark[i + 2]);
 if (kept.length) return spreadOut(kept, STARTS);
 // Nothing up there: the highest bark there is.
 let top = -1;
 for (let i = 0; i < bark.length; i += 3) if (top < 0 || bark[i + 1] > bark[top + 1]) top = i;
 return top < 0 ? [0, .02, 0] : [bark[top], bark[top + 1], bark[top + 2]];
}

// Grows the branches of one model. `leaf` and `bark` are position arrays. A
// node is {x, y, z, parent, dx, dy, dz}: where it is, the node before it (-1
// at a start, which sits on the bark) and the way it was heading. Returns the
// nodes with `width` (a radius) and `tips` (the ends it carries).
export function growTwigs({leaf, bark = [], seed = 'twigs'}) {
 const rng = stream(seed);
 const pull = sampled(leaf, ATTRACTORS), A = pull.length / 3;
 // The step and the reach go by the crown's width: fixed, a birch's whole
 // narrow crown lay inside one reach of its trunk and grew nothing.
 let wide = 0;
 for (let i = 0; i < leaf.length; i += 3) wide = Math.max(wide, Math.hypot(leaf[i], leaf[i + 2]));
 const STEP = Math.min(.055, Math.max(.025, wide * .13)), KILL = STEP * 1.4;
 const nodes = [], starts = startsFrom(bark, leaf);
 for (let i = 0; i < starts.length; i += 3) nodes.push({x: starts[i], y: starts[i + 1], z: starts[i + 2], parent: -1, dx: 0, dy: 1, dz: 0, kids: []});
 // Each point's nearest node, updated for new nodes only.
 const best = new Float64Array(A).fill(Infinity), near = new Int32Array(A).fill(-1), used = new Uint8Array(A);
 const look = from => {
  for (let a = 0; a < A; a++) {
   if (used[a]) continue;
   for (let k = from; k < nodes.length; k++) {
    const n = nodes[k], dx = pull[a * 3] - n.x, dy = pull[a * 3 + 1] - n.y, dz = pull[a * 3 + 2] - n.z, d = dx * dx + dy * dy + dz * dz;
    if (d < best[a]) { best[a] = d; near[a] = k; }
   }
   // Not from the starts: the bark runs up through the crown, and a point
   // beside it still wants a branch.
   if (from && best[a] < KILL * KILL) used[a] = 1;
  }
 };
 look(0);
 for (let round = 0; round < MAX_ROUNDS && nodes.length < MAX_NODES; round++) {
  const pulls = new Map();
  for (let a = 0; a < A; a++) {
   if (used[a]) continue;
   const n = nodes[near[a]], d = Math.sqrt(best[a]);
   // A point sitting exactly on a node is reached already. Dividing by its zero distance turned a
   // branch to NaN, and the browser refused the winter tree (8 November 2026: the last batch's
   // aspen, cottonwood, hackberry and paper birch, "Computed radius is NaN").
   if (!(d > 1e-9)) { used[a] = 1; continue; }
   const to = pulls.get(near[a]) || [0, 0, 0];
   to[0] += (pull[a * 3] - n.x) / d; to[1] += (pull[a * 3 + 1] - n.y) / d; to[2] += (pull[a * 3 + 2] - n.z) / d;
   pulls.set(near[a], to);
  }
  if (!pulls.size) break;
  const from = nodes.length;
  for (const [k, to] of pulls) {
   const n = nodes[k];
   // The pull, the way it was already going -- a branch curves, it does not
   // zig-zag (.5 at first, and the first crowns were all elbows) -- with a
   // little wander and a little lift.
   // And a lean away from the trunk: the points lie on the crown's skin, and
   // a branch left to follow them ran round it in rings.
   const pullLength = Math.hypot(...to) || 1, carry = n.parent < 0 ? 0 : .8, axis = Math.hypot(n.x, n.z) || 1;
   let x = to[0] / pullLength + n.dx * carry + (rng() - .5) * .3 + n.x / axis * .35, y = to[1] / pullLength + n.dy * carry + (rng() - .5) * .3 + .1, z = to[2] / pullLength + n.dz * carry + (rng() - .5) * .3 + n.z / axis * .35;
   const len = Math.hypot(x, y, z);
   if (len < 1e-3) continue;
   x /= len; y /= len; z /= len;
   // A point on each side of a node can ask for the same child twice.
   if (n.kids.some(c => { const m = nodes[c]; return m.dx * x + m.dy * y + m.dz * z > .92; })) continue;
   n.kids.push(nodes.length);
   nodes.push({x: n.x + x * STEP, y: n.y + y * STEP, z: n.z + z * STEP, parent: k, dx: x, dy: y, dz: z, kids: []});
   if (nodes.length >= MAX_NODES) break;
  }
  if (nodes.length === from) break;
  look(from);
 }
 // Thickness, from the ends back down (the pipe model). Children always come
 // after their parent, so one pass from the end sees every child first.
 for (let k = nodes.length - 1; k >= 0; k--) {
  const n = nodes[k];
  if (!n.kids.length) { n.width = TWIG; n.tips = 1; continue; }
  let sum = 0, tips = 0;
  for (const c of n.kids) { sum += nodes[c].width ** PIPE; tips += nodes[c].tips; }
  n.width = Math.min(LIMB, sum ** (1 / PIPE));
  n.tips = tips;
 }
 return nodes;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Tubes of three faces round the nodes: {position, normal, shade, flex, index}.
// `far`: the twin's, the stronger branches only, stouter, with no spray.
// `width` multiplies every thickness, for a small tree whose metres are few
// (a shrub's twig is thicker for its height). `shade` runs from `shade` at a
// branch to `tip` at its end -- a multiplier on the bark's colour, so the fine
// wood reads darker than the trunk.
export function twigMesh(nodes, {far = false, width = 1, shade = .82, tip = .6, seed = 'spray'} = {}) {
 const rng = stream(seed), position = [], normal = [], tone = [], flex = [], index = [];
 const ring = (x, y, z, d, r, s, sway) => {
  // The ring's first corner is the one most nearly up, so a limb's snow lies
  // along its top (vegetation.js snowTopped reads the normal).
  const side = unit(cross(d, Math.abs(d[1]) > .97 ? [1, 0, 0] : [0, 1, 0])), up = unit(cross(side, d));
  const at = position.length / 3;
  for (let i = 0; i < 3; i++) {
   const a = i * 2.0944, c = Math.cos(a), sn = Math.sin(a), n = [up[0] * c + side[0] * sn, up[1] * c + side[1] * sn, up[2] * c + side[2] * sn];
   position.push(x + n[0] * r, y + n[1] * r, z + n[2] * r); normal.push(...n); tone.push(s); flex.push(sway);
  }
  return at;
 };
 const wall = (a, b) => { for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; index.push(a + i, a + j, b + j, a + i, b + j, b + i); } };
 const point = (a, x, y, z, s, sway, d) => {
  const at = position.length / 3;
  position.push(x, y, z); normal.push(...d); tone.push(s); flex.push(sway);
  for (let i = 0; i < 3; i++) index.push(a + i, a + (i + 1) % 3, at);
 };
 const toneOf = n => shade + (tip - shade) * (1 - Math.min(1, (n.width - TWIG) / (LIMB - TWIG)));
 const keep = n => !far || n.tips >= FAR_TIPS, stout = far ? FAR_WIDTH * width : width;
 const rings = new Int32Array(nodes.length).fill(-1);
 nodes.forEach((n, k) => {
  if (n.parent < 0 || !keep(n)) return;
  const p = nodes[n.parent], d = [n.dx, n.dy, n.dz], r = n.width * stout, sway = Math.min(1, .35 + .6 * (1 - n.width / LIMB));
  // The first child goes on from its parent's ring; another starts its own
  // at its own width, or a thin twig would flare out of a thick limb.
  const first = p.kids.find(c => keep(nodes[c])) === k && rings[n.parent] >= 0;
  const base = first ? rings[n.parent] : ring(p.x, p.y, p.z, d, r * 1.15, toneOf(p), sway);
  const top = ring(n.x, n.y, n.z, d, r, toneOf(n), sway);
  wall(base, top);
  rings[k] = top;
 });
 // Ends: a point, and near to, the spray.
 nodes.forEach((n, k) => {
  if (rings[k] < 0) return;
  const d = [n.dx, n.dy, n.dz], kids = n.kids.filter(c => rings[c] >= 0);
  if (kids.length) return;
  const sway = 1, s = toneOf(n) * .9;
  const reach = far ? .03 : .022;
  point(rings[k], n.x + d[0] * reach, n.y + d[1] * reach, n.z + d[2] * reach, s, sway, d);
  if (far) return;
  const side = unit(cross(d, Math.abs(d[1]) > .97 ? [1, 0, 0] : [0, 1, 0])), up = unit(cross(side, d));
  for (let i = 0; i < 2; i++) {
   const a = rng() * 6.283, spread = SPRAY_SPREAD * (.6 + rng() * .4) * (i ? 1 : -1), c = Math.cos(a) * spread, sn = Math.sin(a) * spread;
   const dir = unit([d[0] + side[0] * c + up[0] * sn, d[1] + side[1] * c + up[1] * sn + .1, d[2] + side[2] * c + up[2] * sn]);
   const len = SPRAY * (.7 + rng() * .6);
   const foot = ring(n.x, n.y, n.z, dir, n.width * stout * .6, s, sway);
   point(foot, n.x + dir[0] * len, n.y + dir[1] * len, n.z + dir[2] * len, s * .95, sway, dir);
  }
 });
 return {position: new Float32Array(position), normal: new Float32Array(normal), shade: new Float32Array(tone), flex: new Float32Array(flex), index};
}
