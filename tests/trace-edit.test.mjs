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

test('layers: a fairway painted through a bunker keeps the bunker; erasing one layer leaves the rest', () => {
 const t = createTrace(grid);
 t.paint({x: 0, z: 0, radius: 4, kind: 'sand'});
 t.fill([[[-20, -10], [20, -10], [20, 10], [-20, 10]]], 'fairway');
 assert.equal(t.kindAt(0, 0), 'sand', 'the bunker stays on top');
 assert.deepEqual(t.layersPresent(), ['sand', 'fairway']);
 t.erase({x: 0, z: 0, radius: 5, kind: 'sand'});
 assert.equal(t.kindAt(0, 0), 'fairway', 'under the bunker, the fairway ran on');
 t.undo(); assert.equal(t.kindAt(0, 0), 'sand');
 t.setHidden('sand', true);
 assert.equal(PALETTE[t.state.layers.view[100 * 201 + 100]], 'fairway', 'a hidden layer is left out of the view');
 assert.equal(t.kindAt(0, 0), 'sand', 'and kept in the course');
 t.erase({x: 0, z: 0, radius: 5});
 assert.equal(t.kindAt(0, 0), 'rough', 'Erase with no layer takes every layer off');
});

test('extrapolate lays one layer round another: under it unbroken, over it only the band', () => {
 const t = createTrace(grid);
 t.fill([[[-10, -10], [10, -10], [10, 10], [-10, 10]]], 'fairway');
 t.extrapolate({from: 'fairway', to: 'semi', width: 3});
 const semi = t.state.layers.mask('semi');
 assert.equal(semi[100 * 201 + 100], 1, 'semi runs on under the fairway');
 assert.equal(t.kindAt(0, 0), 'fairway'); assert.equal(t.kindAt(12, 0), 'semi'); assert.equal(t.kindAt(14, 0), 'rough');
 t.undo(); assert.equal(t.kindAt(12, 0), 'rough', 'one undo step');
 t.extrapolate({from: 'fairway', to: 'sand', width: 2});
 assert.equal(t.state.layers.mask('sand')[100 * 201 + 100], 0, 'a layer above takes only the band');
 assert.equal(t.kindAt(0, 0), 'fairway'); assert.equal(t.kindAt(11, 0), 'sand');
});

test('outside the boundary: every layer and tree off, the landscape\'s floor laid, a wood thinning in from the line', () => {
 const t = createTrace(grid);
 t.fill([[[-40, -40], [40, -40], [40, 40], [-40, 40]]], 'fairway');
 t.addTree({x: 45, z: 45, h: 20, crown: 5});
 const ring = [[-30, -30], [30, -30], [30, 30], [-30, 30]];
 const planted = t.fillOutside(ring, {ground: 'pinestraw', density: 200, edge: 5, seed: 3});
 assert.equal(t.kindAt(0, 0), 'fairway', 'inside kept');
 assert.equal(t.kindAt(35, 0), 'pinestraw', 'outside: the floor, no fairway');
 assert.ok(planted > 20, `${planted} trees planted`);
 assert.ok(t.state.trees.every(tr => Math.abs(tr.x) > 30 || Math.abs(tr.z) > 30), 'none inside');
 assert.ok(!t.state.trees.some(tr => tr.x === 45 && tr.z === 45), 'the survey\'s own tree outside taken off too');
 t.undo(); assert.equal(t.kindAt(35, 0), 'fairway'); assert.equal(t.state.trees.length, 1, 'one undo step');
 const k = createTrace(grid); k.addTree({x: 45, z: 45, h: 20, crown: 5}); k.fillOutside(ring, {density: 200, edge: 5, seed: 3, keep: true});
 assert.ok(k.state.trees.some(tr => tr.x === 45 && tr.z === 45), 'kept when keeping what is there');
});

test('outside the boundary, keeping what is there: surfaces and houses stay, the floor goes on bare ground, no tree on a surface; removing takes houses too', () => {
 const ring = [[-30, -30], [30, -30], [30, 30], [-30, 30]];
 const make = () => { const t = createTrace(grid); t.fill([[[32, -10], [48, -10], [48, 10], [32, 10]]], 'water'); t.fill([[[-48, 32], [-32, 32], [-32, 48], [-48, 48]]], 'path'); t.addHome({x: -40, z: -40, rotation: 0, width: 12, depth: 10}); t.addHome({x: 0, z: 0, rotation: 0, width: 12, depth: 10}); return t; };
 const kept = make(), n = kept.fillOutside(ring, {ground: 'pinestraw', density: 400, edge: 2, seed: 5, keep: true});
 assert.equal(kept.kindAt(40, 0), 'water', 'the pond kept'); assert.equal(kept.kindAt(-40, 40), 'path', 'the path kept');
 assert.equal(kept.kindAt(40, 40), 'pinestraw', 'bare ground floored');
 assert.equal(kept.state.homes.length, 2, 'the houses kept');
 assert.ok(n > 20, `${n} trees`);
 assert.ok(!kept.state.trees.some(tr => kept.kindAt(tr.x, tr.z) === 'water' || kept.kindAt(tr.x, tr.z) === 'path'), 'no tree in the pond or on the path');
 assert.ok(!kept.state.trees.some(tr => Math.hypot(tr.x + 40, tr.z + 40) < 9), 'none on the house');
 const gone = make(); gone.fillOutside(ring, {ground: 'pinestraw', density: 400, edge: 2, seed: 5});
 assert.equal(gone.kindAt(40, 0), 'pinestraw', 'the pond removed');
 assert.deepEqual(gone.state.homes.map(h => [h.x, h.z]), [[0, 0]], 'the house outside removed, the one inside kept');
 gone.undo(); assert.equal(gone.state.homes.length, 2, 'one undo step');
});

test('every tree replaced at once, one undo step', () => {
 const t = createTrace(grid, {trees: [{x: 1, z: 1, h: 10, crown: 3}]});
 t.setTrees([{x: 5, z: 5, h: 12, crown: 3}, {x: 9, z: 9, h: 12, crown: 3}]);
 assert.equal(t.state.trees.length, 2); t.undo(); assert.deepEqual(t.state.trees.map(tr => tr.x), [1]);
});

test('houses: one faces the nearest fairway, a zone is lined with them on open ground only, undone at once', () => {
 const t = createTrace(grid);
 t.fill([[[-50, -8], [50, -8], [50, 8], [-50, 8]]], 'fairway');
 const h = t.homeAt({x: 0, z: 30});
 assert.ok(Math.abs(Math.atan2(Math.sin(h.rotation - Math.PI), Math.cos(h.rotation - Math.PI))) < .2, `faces north to the fairway: ${h.rotation}`);
 assert.ok(t.homeFits(h)); assert.ok(!t.homeFits(t.homeAt({x: 0, z: 0})), 'not on the fairway');
 t.addHome(h); assert.equal(t.state.homes.length, 1);
 const n = t.homeZone([[-50, -50], [50, -50], [50, 50], [-50, 50]], {spacing: 30});
 assert.ok(n >= 2, `${n} houses`);
 assert.ok(t.state.homes.every(o => Math.abs(o.z) > 12), 'none on the fairway');
 t.undo(); assert.equal(t.state.homes.length, 1, 'the zone undone at once');
 t.removeHomes({x: 0, z: 30, radius: 5}); assert.equal(t.state.homes.length, 0);
});

test('moving one shape: a green lifted off the fairway, a bunker beside it untouched, a tree and a house, each one undo step', () => {
 const t = createTrace(grid);
 t.fill([[[-30, -10], [30, -10], [30, 10], [-30, 10]]], 'fairway');
 t.paint({x: -10, z: 0, radius: 4, kind: 'green'});
 t.paint({x: 15, z: 0, radius: 3, kind: 'sand'});
 const greens = count(t, 'green'), sands = count(t, 'sand');
 // On the green: the topmost shown is the green, not the fairway under it.
 const pick = t.pickAt({x: -10, z: 1});
 assert.equal(pick.type, 'shape'); assert.equal(pick.kind, 'green'); assert.equal(pick.cells.length, greens);
 t.move(pick, 6, -20);
 assert.equal(t.kindAt(-4, -20), 'green'); assert.equal(t.kindAt(-10, 0), 'fairway', 'the fairway under it shows');
 assert.equal(count(t, 'green'), greens); assert.equal(count(t, 'sand'), sands);
 // The layer picked in the list is moved when it covers the point: the fairway, the bunker riding on top unmoved.
 const fw = t.pickAt({x: 0, z: 0, kind: 'fairway'});
 assert.equal(fw.kind, 'fairway');
 t.move(fw, 0, 30);
 assert.equal(t.kindAt(0, 35), 'fairway'); assert.equal(t.kindAt(15, 0), 'sand');
 t.undo(); assert.equal(t.kindAt(0, 35), 'rough'); t.undo(); assert.equal(t.kindAt(-10, 0), 'green');
 // A tree, then a house, ahead of the ground under them.
 t.addTree({x: 40, z: 40, h: 12, crown: 3});
 const tp = t.pickAt({x: 41, z: 41}); assert.deepEqual(tp, {type: 'tree', index: 0});
 t.move(tp, -5, 0); assert.equal(t.state.trees[0].x, 35);
 t.addHome({x: -40, z: 40, rotation: 0, width: 10, depth: 8});
 const hp = t.pickAt({x: -36, z: 43}); assert.equal(hp.type, 'home');
 t.move(hp, 0, -5); assert.equal(t.state.homes[0].z, 35);
 t.undo(); assert.equal(t.state.homes[0].z, 40);
 assert.equal(t.pickAt({x: 45, z: -45}), null, 'nothing on rough');
});

test('turning one shape: a long bunker turned a quarter keeps its area and lies the other way; a house turns its facing; one undo step', async () => {
 const {turnedCells} = await import('../src/builder/trace-edit.js');
 const t = createTrace(grid);
 t.fill([[[-10, -2], [10, -2], [10, 2], [-10, 2]]], 'sand');   // 20 x 4 m, east-west
 const n = count(t, 'sand'), pick = t.pickAt({x: 0, z: 0});
 t.turn(pick, Math.PI / 2);
 assert.ok(Math.abs(count(t, 'sand') - n) <= n * .05, `area kept: ${n} -> ${count(t, 'sand')}`);
 assert.equal(t.kindAt(0, 8), 'sand', 'now runs north-south'); assert.equal(t.kindAt(8, 0), 'rough');
 t.undo(); assert.equal(t.kindAt(8, 0), 'sand'); assert.equal(t.kindAt(0, 8), 'rough');
 t.addHome({x: 40, z: 40, rotation: 0, width: 10, depth: 8});
 t.turn(t.pickAt({x: 40, z: 40}), 1); assert.ok(Math.abs(t.state.homes[0].rotation + 1) < 1e-9, 'a facing turns the other way round');
 // A full turn gives the same cells back.
 const cells = [0, 1, 2, 201, 202, 203].map(k => k + 201 * 50 + 50);
 assert.deepEqual(turnedCells(cells, 2 * Math.PI, 201, 201).sort((a, b) => a - b), cells.sort((a, b) => a - b));
});

test('copying and deleting one shape, a tree and a house, each one undo step (builder-ux)', () => {
 const t = createTrace(grid);
 t.fill([[[-30, -10], [30, -10], [30, 10], [-30, 10]]], 'fairway');
 t.paint({x: -10, z: 0, radius: 4, kind: 'sand'});
 const sands = count(t, 'sand'), pick = t.pickAt({x: -10, z: 0});
 t.copy(pick, 20, 0);
 assert.equal(t.kindAt(10, 0), 'sand', 'the copy where it was put');
 assert.equal(t.kindAt(-10, 0), 'sand', 'the original kept');
 assert.equal(count(t, 'sand'), 2 * sands);
 t.remove(t.pickAt({x: 10, z: 0}));
 assert.equal(t.kindAt(10, 0), 'fairway', 'deleting a bunker shows the fairway under it');
 t.undo(); assert.equal(t.kindAt(10, 0), 'sand'); t.undo(); assert.equal(count(t, 'sand'), sands);
 t.addTree({x: 40, z: 40, h: 12, crown: 3});
 t.copy(t.pickAt({x: 40, z: 40}), 0, -10);
 assert.equal(t.state.trees.length, 2); assert.equal(t.state.trees[1].z, 30);
 t.remove({type: 'tree', index: 0}); assert.equal(t.state.trees.length, 1); assert.equal(t.state.trees[0].z, 30);
 t.addHome({x: -40, z: 40, rotation: 0, width: 10, depth: 8});
 t.copy(t.pickAt({x: -40, z: 40}), 15, 0); assert.equal(t.state.homes.length, 2); assert.equal(t.state.homes[1].x, -25);
 t.undo(); assert.equal(t.state.homes.length, 1);
});
