// Surfaces as outlines (src/builder/shapes.js): the builder's layers as sets
// of outlines, the tools exact on them, a grid only ever a hidden lookup.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/builder/shapes.js';

const square = (x0, z0, s) => S.fromRings([[[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]]]);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);

test('a ring is a set: its area, what it holds, its box', () => {
 const a = square(0, 0, 10);
 near(S.areaOf(a), 100, 1e-9, 'area');
 assert.ok(S.contains(a, 5, 5)); assert.ok(!S.contains(a, 11, 5)); assert.ok(!S.contains(a, -1, -1));
 assert.deepEqual(S.boundsOf(a), [0, 0, 10, 10]);
 // A ring that crosses itself leaves the crossed part out (even-odd).
 const bow = S.fromRings([[[0, 0], [10, 0], [10, 10], [0, 10]], [[2, 2], [8, 2], [8, 8], [2, 8]]]);
 near(S.areaOf(bow), 64, 1e-9, 'a square with a square hole');
 assert.ok(!S.contains(bow, 5, 5)); assert.ok(S.contains(bow, 1, 5));
});

test('a brush stroke is its exact swept band, added and cut', () => {
 const b = S.band([[0, 0], [20, 0]], 2);
 // Round ends a little inside the true arc (shapes.js ARC, 5 cm).
 near(S.areaOf(b), 20 * 4 + Math.PI * 4, .6, 'round-ended band');
 const sq = S.band([[0, 0], [20, 0]], 2, 'square');
 near(S.areaOf(sq), 80, 1e-6, 'square-ended band');
 // A square bend stays square: the corner's outside is filled to a point.
 const bend = S.band([[0, 0], [10, 0], [10, 10]], 1, 'square');
 assert.ok(S.contains(bend, 10.9, -.9), 'the mitred corner');
 const a = S.union(square(0, 0, 10), S.disc(10, 5, 2));
 near(S.areaOf(a), 100 + 2 * Math.PI, .3, 'a disc on an edge adds half itself');
 const c = S.difference(a, S.disc(5, 5, 1));
 near(S.areaOf(c), 100 + 2 * Math.PI - Math.PI, .1, 'a hole cut');
 assert.ok(!S.contains(c, 5, 5)); assert.ok(S.contains(c, 5, 7));
});

test('only the paths near the other set go through, and the answer is the same', () => {
 // Forty squares and a hole in one; strokes near and far.
 let set = S.EMPTY;
 for (let i = 0; i < 40; i++) set = S.union(set, square((i % 8) * 30, Math.floor(i / 8) * 30, 20));
 set = S.difference(set, square(35, 35, 6));
 let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
 let a = set, b = set;
 for (let n = 0; n < 60; n++) {
  const pts = [[rnd() * 240, rnd() * 150], [rnd() * 240, rnd() * 150]], st = S.band(pts, 1 + rnd() * 3);
  a = n % 3 ? S.union(a, st) : S.difference(a, st);
  b = S.clean(n % 3 ? S.clean([...b, ...st]) : S.clean(S.difference(S.clean(b), st)));
 }
 near(S.areaOf(a), S.areaOf(b), .1, 'area after 60 strokes');
 for (let n = 0; n < 400; n++) { const x = rnd() * 240, z = rnd() * 150; assert.equal(S.contains(a, x, z), S.contains(b, x, z), `at ${x}, ${z}`); }
 // The hole kept while its outline was cut far away.
 assert.ok(!S.contains(a, 38, 38) || S.contains(b, 38, 38));
});

test('tidy: specks go, pocks fill, the rest stays', () => {
 let a = S.union(square(0, 0, 20), square(40, 0, 2));     // a 4 m² speck
 a = S.difference(a, square(5, 5, 3));                     // a 9 m² pock
 a = S.difference(a, square(10, 10, 6));                   // a 36 m² hole: a feature
 const t = S.tidy(a, 10, 30);
 near(S.areaOf(t), 400 - 36, 1e-6, 'tidied');
 assert.ok(!S.contains(t, 41, 1)); assert.ok(S.contains(t, 6, 6)); assert.ok(!S.contains(t, 12, 12));
});

test('smoothing rounds a corner, keeps the size, and keeps a thin path', () => {
 const box = square(0, 0, 20), sm = S.smoothEdges(box, {radius: 2});
 near(S.areaOf(sm), 400, 400 * .06, 'area kept within 6%');
 assert.ok(!S.contains(sm, .3, .3), 'the corner rounded off');
 assert.ok(S.contains(sm, 10, .3), 'the side stays');
 // Only near the point: the far corner is untouched.
 const one = S.smoothEdges(box, {radius: 2, x: 0, z: 0, reach: 6});
 assert.ok(!S.contains(one, .3, .3)); assert.ok(S.contains(one, 19.8, 19.8));
 // A 2.5 m cart path smoothed at 1.5 m keeps its length and most of its width.
 const path = S.band([[0, 0], [15, 3], [30, 0], [45, 4]], 1.25), ps = S.smoothEdges(path, {radius: 1.5});
 assert.ok(S.areaOf(ps) > .8 * S.areaOf(path), `path kept: ${S.areaOf(ps)} of ${S.areaOf(path)}`);
 assert.ok(S.contains(ps, 44, 3.8) || S.contains(ps, 43.5, 3.7), 'its end still there');
 // A speck under the circle goes.
 assert.equal(S.smoothEdges(square(0, 0, 1), {radius: 1.5}).length, 0);
});

test('grown and shrunk round, turned and moved exactly', () => {
 const g = S.grow(square(0, 0, 10), 2);
 near(S.areaOf(g), 100 + 4 * 10 * 2 + Math.PI * 4, .6, 'grown 2 m round');
 near(S.areaOf(S.moved(square(0, 0, 10), 3.5, -2.25)), 100, 1e-9, 'moved');
 assert.ok(S.contains(S.moved(square(0, 0, 10), 3.5, -2.25), 13, -2));
 const t = S.turned(square(0, 0, 10), Math.PI / 4, 5, 5);
 near(S.areaOf(t), 100, .05, 'turned keeps area (corners to the centimetre)');
 assert.ok(S.contains(t, 5, -1.5) && !S.contains(t, .5, .5), 'a diamond');
 assert.deepEqual(S.middleOf(square(0, 0, 10)).map(v => Math.round(v * 1e6) / 1e6), [5, 5]);
});

test('parts: each outline with its own holes, and the one at a point', () => {
 const a = S.union(S.difference(square(0, 0, 20), square(5, 5, 10)), square(8, 8, 4));
 const ps = S.parts(a);
 assert.equal(ps.length, 2);
 const big = S.partAt(a, 1, 1), island = S.partAt(a, 10, 10);
 assert.equal(big.holes.length, 1); assert.equal(island.holes.length, 0);
 assert.equal(S.partAt(a, 6, 6), null);
});

test('a grid turned into outlines once, and the hidden lookup agrees', () => {
 const grid = {nx: 60, nz: 40, cell: 1, halfX: 30, halfZ: 20}, m = new Uint8Array(60 * 40);
 for (let j = 0; j < 40; j++) for (let i = 0; i < 60; i++) if (Math.hypot(i - 30, j - 20) <= 12) m[j * 60 + i] = 1;
 const set = S.fromMask(m, grid);
 near(S.areaOf(set), Math.PI * 144, 20, 'a disc of cells as an outline');
 const back = S.rasterize(set, grid);
 let differ = 0; for (let k = 0; k < m.length; k++) if (back[k] !== m[k]) differ++;
 assert.ok(differ <= 12, `${differ} cells differ on the rim`);
});

test('a set packed for a draft comes back the same', () => {
 const a = S.difference(square(0, 0, 10), S.disc(5, 5, 2));
 const b = S.unpackSet(JSON.parse(JSON.stringify(S.packSet(a))));
 assert.deepEqual(b, a.map(p => p.map(q => ({x: q.x, y: q.y}))));
});
