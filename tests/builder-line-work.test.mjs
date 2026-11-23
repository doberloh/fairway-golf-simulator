// Lines on a layer (src/builder/line-work.js; the owner, 23 November 2026):
// the line tool's cells with round or square ends, and Normalize width --
// thin shapes laid again at one width, meetings kept, areas kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lineCells, evenWidth, areaWidth, skeleton, chains} from '../src/builder/line-work.js';

// A 200 x 200 m grid at half a metre, its middle at (0, 0).
const grid = {nx: 400, nz: 400, cell: .5, halfX: 100, halfZ: 100};
const at = (x, z) => Math.round((z + grid.halfZ) / grid.cell) * grid.nx + Math.round((x + grid.halfX) / grid.cell);
const maskOf = cells => { const m = new Uint8Array(grid.nx * grid.nz); for (const k of cells) m[k] = 1; return m; };
const has = (m, x, z) => !!m[at(x, z)];
// How wide the layer is across a line at x, along z: cells set in that column.
const across = (m, x, z0 = -20, z1 = 20) => { let n = 0; for (let z = z0; z <= z1; z += grid.cell) if (has(m, x, z)) n++; return n * grid.cell; };

test('a line is painted its width, every cell within half of it', () => {
 const cells = maskOf(lineCells([[-20, 0], [20, 0]], {width: 2.5, grid}));
 assert.equal(across(cells, 0), 2.5, 'a 2.5 m line across is 5 half-metre cells, as a 2.5 m brush');
 assert.ok(has(cells, -20, 0) && has(cells, 20, 0), 'from end to end');
});

test('round ends reach past the end nodes; square ends stop at them', () => {
 const round = maskOf(lineCells([[-20, 0], [20, 0]], {width: 4, grid})), square = maskOf(lineCells([[-20, 0], [20, 0]], {width: 4, grid, caps: 'square'}));
 assert.ok(has(round, 21.5, 0) && has(round, -21.5, 0), 'round: half the width past each end');
 assert.ok(!has(square, 20.5, 0) && !has(square, -20.5, 0), 'square: nothing past either end');
 assert.ok(has(square, 20, 1.5) && has(square, -20, -1.5), 'square: the full width right up to the end');
 assert.equal(across(square, 0), across(round, 0), 'the same width along the line');
});

test('a square end cuts across the line\'s own direction, at a slant too', () => {
 const cells = maskOf(lineCells([[0, 0], [10, 10]], {width: 3, grid, caps: 'square'}));
 assert.ok(!has(cells, 11, 11), 'nothing past the end along the line');
 assert.ok(has(cells, 10 - 1, 10 + 1), 'the corner across the end is painted');
});

test('the middle line of a band is one cell wide and one piece', () => {
 const band = maskOf(lineCells([[-30, 0], [30, 0]], {width: 3, grid}));
 const crop = {w: grid.nx, h: grid.nz}, g = skeleton(band, crop.w, crop.h);
 const ch = chains(g, crop.w, crop.h);
 assert.ok(ch.length >= 1);
 // At x = 0 only one cell of the middle line.
 assert.equal(across(g, 0), grid.cell);
});

// A ragged cart path: 2 to 4.5 m wide, changing every few metres, along z = 0
// from x = -40 to 40, as uneven OpenStreetMap paths come out.
const ragged = () => { const cells = new Set(); for (let x = -40; x <= 40; x += 2) for (const k of lineCells([[x, Math.sin(x) * .3], [x + 2, Math.sin(x + 2) * .3]], {width: 2 + 2.5 * ((Math.abs(Math.round(x * 7)) % 5) / 4), grid})) cells.add(k); return cells; };

test('normalize: a ragged path comes out one width all along', () => {
 const m = maskOf(ragged()), {add, remove} = evenWidth(m, grid, 1.8);
 for (const k of remove) m[k] = 0; for (const k of add) m[k] = 1;
 const widths = []; for (let x = -34; x <= 34; x += 1.5) widths.push(across(m, x));
 assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `widths ${Math.min(...widths)} to ${Math.max(...widths)} m`);
 assert.ok(widths.every(v => v >= 1.5 && v <= 2.5), `about 1.8 m: ${widths.join(', ')}`);
 assert.ok(has(m, -38, 0) && has(m, 38, 0), 'the path still runs end to end');
});

test('normalize: paths that meet still meet, where they met', () => {
 // A T: a main path along z = 0 and a branch up x = 0 to z = -30, both 3.5 m.
 const cells = new Set([...lineCells([[-40, 0], [40, 0]], {width: 3.5, grid}), ...lineCells([[0, 0], [0, -30]], {width: 3.5, grid})]);
 const m = maskOf(cells), {add, remove} = evenWidth(m, grid, 1.8);
 for (const k of remove) m[k] = 0; for (const k of add) m[k] = 1;
 // Joined: walk the cells from the main path's west end and reach the branch's far end.
 const seen = new Uint8Array(m.length), q = [at(-38, 0)]; seen[q[0]] = 1;
 while (q.length) { const k = q.pop(), i = k % grid.nx; for (const n of [k - 1, k + 1, k - grid.nx, k + grid.nx]) if (n >= 0 && n < m.length && m[n] && !seen[n] && Math.abs(n % grid.nx - i) <= 1) { seen[n] = 1; q.push(n); } }
 assert.ok(seen[at(0, -28)] && seen[at(38, 0)], 'the branch and the far end are reached');
 assert.ok(has(m, 0, 0), 'the meeting is where it was');
 assert.ok(across(m, 20) <= 2.5 && across(m, -20) <= 2.5, 'the main path is narrowed');
});

test('normalize: a wide area is kept as drawn, corners and all', () => {
 // A 30 x 30 m lot with a 3.5 m path leaving it.
 const lot = []; for (let z = -15; z <= 15; z += .5) for (let x = -15; x <= 15; x += .5) lot.push(at(x, z));
 const m = maskOf([...lot, ...lineCells([[15, 0], [50, 0]], {width: 3.5, grid})]), {add, remove} = evenWidth(m, grid, 1.8);
 assert.ok(areaWidth(1.8) === 8 && areaWidth(6) === 18);
 const gone = new Set(remove);
 assert.ok(lot.every(k => !gone.has(k)), 'not one cell of the lot is taken, its corners included');
 for (const k of remove) m[k] = 0; for (const k of add) m[k] = 1;
 assert.ok(across(m, 40) <= 2.5, 'the path leaving it is narrowed');
});

test('normalize: an empty layer changes nothing', () => {
 const {add, remove} = evenWidth(new Uint8Array(grid.nx * grid.nz), grid, 1.8);
 assert.equal(add.length + remove.length, 0);
});
