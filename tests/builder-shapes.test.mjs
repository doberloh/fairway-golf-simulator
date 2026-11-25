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

test('smoothing: the brush rounds a corner, a whole layer keeps it; a thin path kept', () => {
 // A whole layer smoothed keeps a box's corners (a tee's), its sides straight.
 const box = square(0, 0, 20), sm = S.smoothEdges(box, {radius: 2});
 near(S.areaOf(sm), 400, .5, 'a box smoothed whole is the box');
 assert.ok(S.contains(sm, .1, .1), 'its corner kept');
 // The brush on a corner rounds it; the far corner is untouched.
 const one = S.smoothEdges(box, {radius: 2, x: 0, z: 0, reach: 6});
 assert.ok(!S.contains(one, .3, .3), 'the corner rounded off'); assert.ok(S.contains(one, 19.8, 19.8));
 assert.ok(S.contains(one, 10, .1) && S.contains(one, .1, 10), 'the sides stay');
 // A 2.5 m cart path smoothed at 1.5 m keeps its length and most of its width.
 const path = S.band([[0, 0], [15, 3], [30, 0], [45, 4]], 1.25), ps = S.smoothEdges(path, {radius: 1.5});
 assert.ok(S.areaOf(ps) > .8 * S.areaOf(path), `path kept: ${S.areaOf(ps)} of ${S.areaOf(path)}`);
 assert.ok(S.contains(ps, 44, 3.8) || S.contains(ps, 43.5, 3.7), 'its end still there');
 // A speck under the circle goes.
 assert.equal(S.smoothEdges(square(0, 0, 1), {radius: 1.5}).length, 0);
});

// 25 November 2026 (the owner: waves on the Alpine draft's straight turf, and
// "these facets that still show up from the OSM traces ... smoothing button
// doesn't take them out"): Smooth takes out a wave smaller than about a third
// of its size, and curves a mapped outline's facets.
test('smoothing takes out the old squares\' waves and a mapped outline\'s facets', () => {
 // A straight edge 60 m long waving 0.4 m every 8 m (as the Alpine draft's),
 // square at its corners.
 const top = Array.from({length: 121}, (_, q) => [q / 2, 10 + (q > 8 && q < 112 ? .4 * Math.sin(q / 2 / 8 * 2 * Math.PI) : 0)]);
 const wavy = S.fromRings([[[0, 0], [60, 0], ...top.reverse()]]);
 const flat = S.smoothEdges(wavy, {radius: 1.5});
 for (let x = 5; x <= 55; x += .5) {
  let z = 9; while (S.contains(flat, x, z + .01) && z < 11) z += .01;
  assert.ok(Math.abs(z - 10) < .12, `at ${x} m the edge is ${(z - 10).toFixed(2)} m off straight`);
 }
 // A green mapped as twelve points: its facets curved, its size kept.
 const gon = S.fromRings([Array.from({length: 12}, (_, q) => [12 * Math.cos(q / 12 * 2 * Math.PI), 12 * Math.sin(q / 12 * 2 * Math.PI)])]);
 const round = S.smoothEdges(gon, {radius: 1.5}), ring = S.toRings(round)[0];
 const worst = Math.max(...ring.map((b, q) => { const a = ring[(q - 1 + ring.length) % ring.length], c = ring[(q + 1) % ring.length], ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1]; return Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz)) * 180 / Math.PI; }));
 assert.ok(worst < 8, `a facet left: ${worst.toFixed(1)} degrees at one point (30 before)`);
 // (The curve through twelve points of a circle is that circle, 4.5% more
 // than the polygon the map drew.)
 near(S.areaOf(round), Math.PI * 144, Math.PI * 144 * .02, 'the circle its points lie on');
 // The brush does the same where it is put.
 const one = S.smoothEdges(gon, {radius: 1.5, x: 12, z: 0, reach: 6}), r1 = S.toRings(one)[0];
 assert.ok(r1.length > 20, 'the facet under the brush curved');
 assert.ok(S.contains(one, -11.5, 0) === S.contains(gon, -11.5, 0) && S.areaOf(one) > S.areaOf(gon) - 1, 'the far side as it was');
});

// Thin shapes under the sizes the builder passes: a 1.8 m path (Normalize's
// width) under the whole-layer Smooth (1.5 m) and the 3D editor's brush
// (radius 2.7 m, reach 8 m) at its end; a 1 m stroke smoothed on release.
// Before the wiggles dropped were held to a third of a shape's width, the
// editor's brush cut such a path's end off and release smoothing lost a thin
// stroke's ends.
test('smoothing keeps a thin path\'s end and width, and a thin stroke\'s round ends', () => {
 const wig = Array.from({length: 61}, (_, q) => [q, 6 * Math.sin(q / 9)]), path = S.band(wig, .9);
 for (const out of [S.smoothEdges(path, {radius: 1.5}), S.smoothEdges(path, {radius: 8 / 3, x: 60, z: wig[60][1], reach: 8})]) {
  assert.ok(S.contains(out, .2, wig[0][1]) && S.contains(out, 59.8, wig[60][1]), 'both ends there');
  near(S.areaOf(out), S.areaOf(path), S.areaOf(path) * .03, 'its area');
  for (let x = 3; x <= 57; x += 3) { const z = 6 * Math.sin(x / 9); assert.ok(S.contains(out, x, z + .7) && S.contains(out, x, z - .7), `at ${x} m it is still about 1.8 m wide`); }
 }
 const stroke = S.band(Array.from({length: 31}, (_, q) => [q * .5, .4 * Math.sin(q)]), .5);
 const rel = S.smoothEdges(stroke, {radius: 1.5, x: 7.5, z: 0, reach: 12, within: S.grow(stroke, 1.5)});
 assert.equal(S.parts(rel).length, 1);
 assert.ok(S.contains(rel, .05, 0) && S.contains(rel, -.35, 0) && S.contains(rel, 14.95, .4 * Math.sin(29)), 'its round ends there');
});

test('smoothing settles: the same place again changes nothing, a hole near an edge stays a hole', () => {
 // Fifty dabs on one spot of a small green: it keeps its size. (Since 25
 // November 2026 the curve goes through points of the edge, so nothing
 // shrinks; the first dabs take it out to the true circle the outline's
 // points lie just inside, and 45 more move its edge about 2 cm in all.)
 let g = S.disc(0, 0, 6); const a0 = S.areaOf(g);
 for (let n = 0; n < 5; n++) g = S.smoothEdges(g, {radius: 1.5, x: 5, z: 0, reach: 6});
 const a5 = S.areaOf(g);
 for (let n = 0; n < 45; n++) g = S.smoothEdges(g, {radius: 1.5, x: 5, z: 0, reach: 6});
 assert.ok(Math.abs(S.areaOf(g) - a5) < a0 * .01 && Math.abs(a5 - a0) < a0 * .02, `${a0.toFixed(2)} -> ${a5.toFixed(2)} -> ${S.areaOf(g).toFixed(2)} m²`);
 // A box smoothed once rounds its corners; again, it stays as it is.
 const once = S.smoothEdges(square(0, 0, 20), {radius: 2}), twice = S.smoothEdges(once, {radius: 2});
 assert.ok(Math.abs(S.areaOf(twice) - S.areaOf(once)) < .5, `${S.areaOf(once)} then ${S.areaOf(twice)}`);
 // Only inside `within`: a box beside the stroke keeps its corner.
 const box = square(0, 0, 10), stroke = S.band([[12, -5], [12, 15]], 1.5), lay = S.union(box, stroke);
 const sm = S.smoothEdges(lay, {radius: 1.5, x: 12, z: 5, reach: 14, within: S.grow(stroke, 1.5)});
 assert.ok(S.contains(sm, .1, .1), 'the box\'s far corner untouched');
 // A hole 30 cm inside its outline's edge: still a hole, the outline whole.
 const ring = S.difference(square(0, 0, 10), square(.3, 3, 3)), r2 = S.smoothEdges(ring, {radius: 1.5});
 assert.ok(!S.contains(r2, 1.8, 4.5), 'the hole stays open'); assert.ok(S.contains(r2, 5, 5));
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
