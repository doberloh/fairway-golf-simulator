// Door 2's manual trace (src/builder/trace-edit.js): brushes, outlines,
// smoothing, tidying, trees and undo on a small land.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrace, PALETTE, CODE, tidyCodes} from '../src/builder/trace-edit.js';
import {TRACE} from '../src/lidar/trace.js';

const grid = {nx: 201, nz: 201, cell: .5, halfX: 50, halfZ: 50};
const count = (t, kind) => t.state.codes.reduce((n, c) => n + (c === CODE[kind] ? 1 : 0), 0);

test('the palette starts with the auto trace\'s codes, then every other ground type', () => {
 assert.deepEqual(PALETTE.slice(0, TRACE.length), TRACE);
 for (const k of ['rock', 'scree', 'hardpan', 'waste', 'pinestraw', 'heather', 'native']) assert.ok(CODE[k] != null, k);
});

test('a brush paints a disc; a drag is one undo step; redo puts it back', () => {
 const t = createTrace(grid);
 t.beginStroke();
 for (let x = -10; x <= 10; x += 1) t.paint({x, z: 0, radius: 3, kind: 'fairway'});
 t.endStroke();
 const n = count(t, 'fairway');
 assert.ok(Math.abs(n * .25 - (20 * 6 + Math.PI * 9)) < 12, `${n * .25} m²`);
 assert.equal(t.kindAt(0, 0), 'fairway');
 t.undo(); assert.equal(count(t, 'fairway'), 0);
 t.redo(); assert.equal(count(t, 'fairway'), n);
 t.erase({x: 0, z: 0, radius: 2}); assert.equal(t.kindAt(0, 0), 'rough');
});

test('an outline fills its inside, an island stays out', () => {
 const t = createTrace(grid);
 t.fill([[[-20, -20], [20, -20], [20, 20], [-20, 20]], [[-5, -5], [5, -5], [5, 5], [-5, 5]]], 'water');
 assert.equal(t.kindAt(10, 10), 'water');
 assert.equal(t.kindAt(0, 0), 'rough');
 assert.throws(() => t.fill([[[0, 0], [1, 0], [1, 1]]], 'lava'), /No such surface/);
});

test('smoothing rounds a jagged edge and takes away specks and pocks', () => {
 const t = createTrace(grid);
 // A green with a sawtooth edge, a pock in it and a speck of sand beside it.
 t.fill([Array.from({length: 40}, (_, q) => { const a = q / 40 * Math.PI * 2, r = 12 + (q % 2 ? 2 : -2); return [r * Math.cos(a), r * Math.sin(a)]; })], 'green');
 t.paint({x: 3, z: 3, radius: .4, kind: 'rough'});
 t.paint({x: 25, z: 0, radius: .4, kind: 'sand'});
 const edge = () => { let e = 0; const c = t.state.codes; for (let k = 0; k < c.length - 1; k++) if ((c[k] === CODE.green) !== (c[k + 1] === CODE.green)) e++; return e; };
 const before = edge();
 t.smooth({radius: 2});
 assert.ok(edge() < before * .9, `${before} -> ${edge()} edges`);
 assert.equal(t.kindAt(3, 3), 'green');
 assert.equal(t.kindAt(25, 0), 'rough');
 t.undo(); assert.equal(t.kindAt(25, 0), 'sand');
 // Smoothing one kind moves only that kind's edges.
 t.paint({x: -30, z: -30, radius: 4, kind: 'fairway'});
 t.smooth({radius: 2, kind: 'green'});
 assert.equal(t.kindAt(-30, -30), 'fairway');
});

test('tidy merges specks and fills pocks under the size, keeps what is bigger', () => {
 const t = createTrace(grid);
 t.fill([[[-20, -20], [20, -20], [20, 20], [-20, 20]]], 'fairway');
 t.paint({x: 0, z: 0, radius: .6, kind: 'rough'});
 t.paint({x: 30, z: 30, radius: .6, kind: 'sand'});
 t.paint({x: 10, z: 10, radius: 3, kind: 'sand'});
 t.tidy();
 assert.equal(t.kindAt(0, 0), 'fairway');
 assert.equal(t.kindAt(30, 30), 'rough');
 assert.equal(t.kindAt(10, 10), 'sand');
 const raw = new Uint8Array(9).fill(1); raw[4] = 0;
 tidyCodes(raw, 3, 3, 1, 2); assert.equal(raw[4], 1);
});

test('trees: one placed, a zone scattered off the mown ground, removed, undone', () => {
 const t = createTrace(grid);
 t.addTree({x: 0, z: 0, h: 20, crown: 5});
 assert.equal(t.state.trees.length, 1);
 t.fill([[[-40, 0], [40, 0], [40, 10], [-40, 10]]], 'fairway');
 t.treeZone([[-40, -40], [40, -40], [40, 40], [-40, 40]], {density: 100, seed: 7});
 const n = t.state.trees.length;
 assert.ok(n > 40 && n < 80, `${n} trees`);
 assert.ok(t.state.trees.slice(1).every(tr => t.kindAt(tr.x, tr.z) !== 'fairway'));
 t.removeTrees({x: 0, z: 0, radius: 100});
 assert.equal(t.state.trees.length, 0);
 t.undo(); assert.equal(t.state.trees.length, n);
});
