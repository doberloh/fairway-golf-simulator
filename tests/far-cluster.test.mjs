// A MODEL'S FAR VERSION, MADE WHEN THE MODELS ARE PACKED (tools/far-cluster.mjs;
// the frame-rate goal, 9 November 2026): fewer triangles, the same box, the
// paint carried, the winding kept, and nothing made where it would not save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterSimplify, simplifyTo, outlineScore, farVersion, FAR_OUTLINE} from '../tools/far-cluster.mjs';

// A finely cut sphere-ish blob: rings of quads, painted by height.
function blob(rings = 40, segs = 60) {
 const position = [], normal = [], color = [], index = [];
 for (let r = 0; r <= rings; r++) for (let s = 0; s <= segs; s++) {
  const th = Math.PI * r / rings, ph = 2 * Math.PI * s / segs, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
  position.push(x, y + 1, z); normal.push(x, y, z); color.push(.5, .5 + y * .25, .5, (y + 1) / 2);
 }
 for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
  const a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1;
  index.push(a, c, b, b, c, d);
 }
 return {position: new Float32Array(position), normal: new Float32Array(normal), color: new Float32Array(color), index: new Uint32Array(index)};
}

test('fewer triangles, the same box', () => {
 const g = blob(), s = simplifyTo(g, 1 / 8);
 const total = g.index.length / 3, kept = s.index.length / 3;
 assert.ok(kept >= total / 8 && kept < total * .6, `${total} -> ${kept}`);
 const box = p => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i++) { lo[i % 3] = Math.min(lo[i % 3], p[i]); hi[i % 3] = Math.max(hi[i % 3], p[i]); } return [lo, hi]; };
 const [lo0, hi0] = box(g.position), [lo1, hi1] = box(s.position);
 for (let k = 0; k < 3; k++) { assert.ok(Math.abs(lo1[k] - lo0[k]) < .2); assert.ok(Math.abs(hi1[k] - hi0[k]) < .2); }
 for (const i of s.index) assert.ok(i < s.position.length / 3);
});

test('the paint and the normals are carried', () => {
 const s = simplifyTo(blob(), 1 / 8);
 assert.equal(s.color.length / 4, s.position.length / 3);
 for (let i = 0; i < s.position.length / 3; i++) {
  assert.ok(Math.abs(Math.hypot(s.normal[i * 3], s.normal[i * 3 + 1], s.normal[i * 3 + 2]) - 1) < 1e-4);
  // Flex rides in the paint's alpha and follows height, as on the model.
  assert.ok(Math.abs(s.color[i * 4 + 3] - s.position[i * 3 + 1] / 2) < .15);
 }
});

test('a face and its back face both survive, each once', () => {
 const g = {position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), index: new Uint32Array([0, 1, 2, 0, 2, 1, 0, 1, 2])};
 const s = clusterSimplify(g, 8);
 assert.equal(s.index.length / 3, 2);
});

test('nothing is made where it would not save', () => {
 const tiny = {position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), index: new Uint32Array([0, 1, 2, 1, 3, 2])};
 assert.equal(simplifyTo(tiny), null);
});

// Thin canes fanning up from one point, each a finely cut four-sided stick:
// the ocotillo's shape, which an eighth of its triangles drew as a clump.
function canes(n = 14, rings = 60) {
 const position = [], index = [];
 for (let c = 0; c < n; c++) {
  const ang = 2 * Math.PI * c / n, lean = .35 + .25 * (c % 3) / 2, w = .012;
  const base = position.length / 3;
  for (let r = 0; r <= rings; r++) {
   const t = r / rings, cx = Math.cos(ang) * lean * t, cz = Math.sin(ang) * lean * t, y = t;
   for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) position.push(cx + dx, y, cz + dz);
  }
  for (let r = 0; r < rings; r++) for (let k = 0; k < 4; k++) {
   const a = base + r * 4 + k, b = base + r * 4 + (k + 1) % 4, c2 = a + 4, d = b + 4;
   index.push(a, b, c2, b, d, c2);
  }
 }
 return {position: new Float32Array(position), index: new Uint32Array(index)};
}

test('a model scored against itself keeps its whole outline and adds none', () => {
 for (const g of [blob(), canes()]) {
  const s = outlineScore([g], [g]);
  assert.equal(s.kept, 1);
  assert.equal(s.extra, 0);
 }
});

test('an outline that loses its canes or fills in between them is scored down', () => {
 const g = canes();
 // Half the canes gone: a good part of the outline is missing.
 const half = {position: g.position, index: g.index.slice(0, g.index.length / 2)};
 assert.ok(outlineScore([g], [half]).kept < .75);
 // A solid fan where the canes were: drawn where the model is not (a clump).
 const p = g.position, top = [], pos = [0, 0, 0];
 for (let c = 0; c < 14; c++) { const i = (c * 61 * 4 + 60 * 4) * 3; pos.push(p[i], p[i + 1], p[i + 2]); }
 for (let c = 1; c < 14; c++) top.push(0, c, c + 1);
 const fan = {position: new Float32Array(pos), index: new Uint32Array(top)};
 assert.ok(outlineScore([g], [g, fan]).extra > FAR_OUTLINE.extra);
});

test('a far version keeps the outline, stepping up the share until it does', () => {
 // The round blob passes at the first share tried, an eighth, and saves.
 const b = blob(), made = farVersion([b]);
 assert.equal(made.share, 1 / 8);
 assert.ok(made.score.kept >= FAR_OUTLINE.kept && made.score.extra <= FAR_OUTLINE.extra && made.score.area >= FAR_OUTLINE.area);
 assert.ok(made.parts[0].index.length < b.index.length * .6, 'and it saves');
 // The canes lose their outline at an eighth (71% kept) and, judged on the
 // outline alone, are stepped up to a quarter (87%).
 assert.ok(outlineScore([canes()], [simplifyTo(canes(), 1 / 8)]).kept < FAR_OUTLINE.kept);
 assert.equal(farVersion([canes()], {...FAR_OUTLINE, area: 0}).share, 1 / 4);
 // But thin canes keep too little of their area at any share up to a half
 // (80% only at a half, as the ocotillo): none is made, and the model is
 // drawn in full at every distance.
 assert.equal(farVersion([canes()]), null);
});
