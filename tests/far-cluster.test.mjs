// A MODEL'S FAR VERSION, MADE WHEN THE MODELS ARE PACKED (tools/far-cluster.mjs;
// the frame-rate goal, 9 November 2026): fewer triangles, the same box, the
// paint carried, the winding kept, and nothing made where it would not save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterSimplify, simplifyTo} from '../tools/far-cluster.mjs';

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
