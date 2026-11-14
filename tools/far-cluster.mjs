// A MODEL'S FAR VERSION, MADE WHEN THE MODELS ARE PACKED (the frame-rate goal,
// 9 November 2026). tools/build-meshes.mjs gives every model over
// AUTO_FAR_MIN triangles that has no far version of its own -- 126 of them,
// the Meshy remakes and most Blender packs among them -- one made here, so the
// renderer can draw it where the model is small on screen (instance-cull.js,
// the `farPainted` line). A Blender-built twin (cartoon.py `far_twin`) is
// always preferred where one ships: it rebuilds each lobe as a small solid,
// which keeps a cartoon crown's look better than any simplifier.
//
// (The simplifier itself -- clusterSimplify, simplifyTo -- lives in
// src/mesh-simplify.js since 13 November 2026: the game makes a tree's middle
// version with it too.)
import {clusterSimplify, simplifyTo} from '../src/mesh-simplify.js';
export {clusterSimplify, simplifyTo};

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
