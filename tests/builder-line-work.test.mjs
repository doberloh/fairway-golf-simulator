// Lines on a layer (src/builder/line-work.js, shapes.js; the owner, 23
// November 2026): the Line tool's band with round or square ends, and
// Normalize width -- thin shapes laid again at one width, meetings kept,
// areas kept. Outlines since 24 November 2026 (branch builder-outlines): the
// band is exact, and only the middle line is found on a hidden grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evenWidthSet, areaWidth, skeleton, chains} from '../src/builder/line-work.js';
import * as S from '../src/builder/shapes.js';

const has = (set, x, z) => S.contains(set, x, z);
// How wide a set is across a line at x, along z, to a tenth of a metre.
const across = (set, x, z0 = -20, z1 = 20) => { let n = 0; for (let z = z0; z <= z1; z += .1) if (has(set, x, z)) n++; return n * .1; };

test('a line is laid its width, from end to end', () => {
 const b = S.band([[-20, 0], [20, 0]], 1.25);
 assert.ok(Math.abs(across(b, 0) - 2.5) <= .15, `2.5 m across: ${across(b, 0)}`);
 assert.ok(has(b, -20, 0) && has(b, 20, 0), 'from end to end');
});

test('round ends reach past the end nodes; square ends stop at them', () => {
 const round = S.band([[-20, 0], [20, 0]], 2), square = S.band([[-20, 0], [20, 0]], 2, 'square');
 assert.ok(has(round, 21.5, 0) && has(round, -21.5, 0), 'round: half the width past each end');
 assert.ok(!has(square, 20.2, 0) && !has(square, -20.2, 0), 'square: nothing past either end');
 assert.ok(has(square, 19.9, 1.9) && has(square, -19.9, -1.9), 'square: the full width right up to the end');
 assert.ok(Math.abs(across(square, 0) - across(round, 0)) < .15, 'the same width along the line');
});

test('a square end cuts across the line\'s own direction, at a slant too', () => {
 const b = S.band([[0, 0], [10, 10]], 1.5, 'square');
 assert.ok(!has(b, 10.5, 10.5), 'nothing past the end along the line');
 assert.ok(has(b, 9, 10.8), 'the corner across the end is laid');
});

test('a square-ended line bends sharp; a round one bends round', () => {
 // An L: east 20 m, then north 20 m, 4 m wide. Its outside corner is at (22, -2).
 const L = [[0, 0], [20, 0], [20, 20]], sq = S.band(L, 2, 'square'), rd = S.band(L, 2);
 assert.ok(has(sq, 21.8, -1.8), 'square: the bend\'s outside corner is laid');
 assert.ok(!has(rd, 21.5, -1.5), 'round: the bend\'s outside is round');
 assert.ok(!has(sq, 22.2, -2.2), 'nothing past the corner');
 // As saved: the outline's own corner, exact.
 const d = Math.min(...S.toRings(sq).flat().map(([x, z]) => Math.hypot(x - 22, z + 2)));
 assert.ok(d < .02, `the saved outline's corner is ${d.toFixed(3)} m off`);
});

test('the middle line of a band is one cell wide and one piece', () => {
 const w = 200, h = 40, m = new Uint8Array(w * h);
 for (let j = 14; j < 26; j++) for (let i = 10; i < 190; i++) m[j * w + i] = 1;
 const g = skeleton(m, w, h), ch = chains(g, w, h);
 assert.ok(ch.length >= 1);
 let n = 0; for (let j = 0; j < h; j++) n += g[j * w + 100]; assert.equal(n, 1, 'one cell across at the middle');
});

// A ragged cart path: 2 to 4.5 m wide, changing every few metres, along z = 0
// from x = -40 to 40, as uneven OpenStreetMap paths come out.
const ragged = () => { let set = S.EMPTY; for (let x = -40; x <= 40; x += 2) set = S.union(set, S.band([[x, Math.sin(x) * .3], [x + 2, Math.sin(x + 2) * .3]], (2 + 2.5 * ((Math.abs(Math.round(x * 7)) % 5) / 4)) / 2)); return set; };

test('normalize: a ragged path comes out one width all along', () => {
 const set = evenWidthSet(ragged(), 1.8);
 const widths = []; for (let x = -34; x <= 34; x += 1.5) widths.push(across(set, x));
 assert.ok(Math.max(...widths) - Math.min(...widths) <= .6, `widths ${Math.min(...widths).toFixed(1)} to ${Math.max(...widths).toFixed(1)} m`);
 assert.ok(widths.every(v => v >= 1.5 && v <= 2.2), `about 1.8 m: ${widths.map(v => v.toFixed(1)).join(', ')}`);
 assert.ok(has(set, -38, 0) && has(set, 38, 0), 'the path still runs end to end');
});

test('normalize: paths that meet still meet, where they met', () => {
 // A T: a main path along z = 0 and a branch up x = 0 to z = -30, both 3.5 m.
 const set = evenWidthSet(S.union(S.band([[-40, 0], [40, 0]], 1.75), S.band([[0, 0], [0, -30]], 1.75)), 1.8);
 assert.equal(S.parts(set).length, 1, 'one piece: the branch still joins');
 assert.ok(has(set, 0, -28) && has(set, 38, 0) && has(set, -38, 0), 'the branch and both ends');
 assert.ok(has(set, 0, 0), 'the meeting is where it was');
 assert.ok(across(set, 20) <= 2.2 && across(set, -20) <= 2.2, 'the main path is narrowed');
});

test('normalize: a wide area is kept as drawn, corners and all', () => {
 // A 30 x 30 m lot with a 3.5 m path leaving it.
 const lot = S.rect([-15, -15, 15, 15]), set = evenWidthSet(S.union(lot, S.band([[15, 0], [50, 0]], 1.75)), 1.8);
 assert.ok(areaWidth(1.8) === 8 && areaWidth(6) === 18);
 assert.ok(S.areaOf(S.difference(lot, set)) < .01, 'not a scrap of the lot taken, its corners included');
 assert.ok(has(set, -14.95, -14.95) && has(set, 14.95, 14.95), 'its corners square');
 assert.ok(across(set, 40) <= 2.2, 'the path leaving it is narrowed');
});

test('normalize: an empty layer changes nothing', () => {
 assert.equal(evenWidthSet(S.EMPTY, 1.8), S.EMPTY);
});
