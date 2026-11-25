// Door 2's manual trace (src/builder/trace-edit.js): brushes, outlines,
// smoothing, tidying, trees and undo on a small land. Every layer is
// outlines (shapes.js) since 24 November 2026: areas are in m², exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrace, PALETTE, CODE, tidyCodes, codesToShapes} from '../src/builder/trace-edit.js';
import {TRACE} from '../src/lidar/trace.js';
import * as S from '../src/builder/shapes.js';

const grid = {nx: 201, nz: 201, cell: .5, halfX: 50, halfZ: 50};
const count = (t, kind) => t.area(kind);
const perimeter = set => S.toRings(set).reduce((a, r) => a + r.reduce((b, p, i) => b + Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]), 0), 0);

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
 // The swept band exactly: 20 m long, 6 m wide, round ends (to the arc's 5 cm).
 assert.ok(Math.abs(n - (20 * 6 + Math.PI * 9)) < 1, `${n} m²`);
 assert.equal(t.kindAt(0, 0), 'fairway');
 t.undo(); assert.equal(count(t, 'fairway'), 0);
 t.redo(); assert.equal(count(t, 'fairway'), n);
 t.erase({x: 0, z: 0, radius: 2}); assert.equal(t.kindAt(0, 0), 'rough');
});

test('a stroke shows as it goes and is laid at once when it ends', () => {
 const t = createTrace(grid);
 t.beginStroke();
 t.paint({x: 0, z: 0, radius: 2, kind: 'green'}); t.paint({x: 5, z: 0, radius: 2, kind: 'green'});
 assert.equal(t.pending().length, 1); assert.equal(t.pending()[0].points.length, 2);
 assert.equal(t.state.shapes.has('green'), false, 'not laid yet');
 t.endStroke();
 assert.equal(t.pending().length, 0); assert.equal(t.kindAt(2.5, 1.9), 'green', 'the band between the dabs');
 // A grid comes in once as outlines.
 const codes = new Uint8Array(grid.nx * grid.nz); for (let j = 90; j < 110; j++) for (let i = 90; i < 110; i++) codes[j * grid.nx + i] = CODE.sand;
 const sh = codesToShapes(codes, grid);
 assert.deepEqual([...sh.keys()], ['sand']); assert.ok(Math.abs(S.areaOf(sh.get('sand')) - 100) < 3, `${S.areaOf(sh.get('sand'))} m²`);
 assert.equal(createTrace(grid, {codes}).kindAt(0, 0), 'sand');
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
 const edge = () => perimeter(t.shapesOf('green'));
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
 assert.equal(t.kindAt(0, 0, true), 'fairway', 'a hidden layer is left out of the view');
 assert.equal(t.kindAt(0, 0), 'sand', 'and kept in the course');
 t.erase({x: 0, z: 0, radius: 5});
 assert.equal(t.kindAt(0, 0), 'rough', 'Erase with no layer takes every layer off');
});

test('extrapolate lays one layer round another: under it unbroken, over it only the band', () => {
 const t = createTrace(grid);
 t.fill([[[-10, -10], [10, -10], [10, 10], [-10, 10]]], 'fairway');
 t.extrapolate({from: 'fairway', to: 'semi', width: 3});
 assert.ok(S.contains(t.shapesOf('semi'), 0, 0), 'semi runs on under the fairway');
 assert.equal(t.kindAt(0, 0), 'fairway'); assert.equal(t.kindAt(12, 0), 'semi'); assert.equal(t.kindAt(14, 0), 'rough');
 t.undo(); assert.equal(t.kindAt(12, 0), 'rough', 'one undo step');
 t.extrapolate({from: 'fairway', to: 'sand', width: 2});
 assert.ok(!S.contains(t.shapesOf('sand'), 0, 0), 'a layer above takes only the band');
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
 // Within two of the 32 bearings: the first to reach the fairway's exact
 // edge (z = 8) is 22.5 degrees off north at 24 m.
 assert.ok(Math.abs(Math.atan2(Math.sin(h.rotation - Math.PI), Math.cos(h.rotation - Math.PI))) < .4, `faces north to the fairway: ${h.rotation}`);
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
 assert.equal(pick.type, 'shape'); assert.equal(pick.kind, 'green'); assert.ok(Math.abs(S.areaOf(pick.set) - greens) < 1e-6);
 t.move(pick, 6, -20);
 assert.equal(t.kindAt(-4, -20), 'green'); assert.equal(t.kindAt(-10, 0), 'fairway', 'the fairway under it shows');
 assert.ok(Math.abs(count(t, 'green') - greens) < .01); assert.equal(count(t, 'sand'), sands);
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
 const t = createTrace(grid);
 t.fill([[[-10, -2], [10, -2], [10, 2], [-10, 2]]], 'sand');   // 20 x 4 m, east-west
 const n = count(t, 'sand'), pick = t.pickAt({x: 0, z: 0});
 t.turn(pick, Math.PI / 2);
 assert.ok(Math.abs(count(t, 'sand') - n) <= n * .05, `area kept: ${n} -> ${count(t, 'sand')}`);
 assert.equal(t.kindAt(0, 8), 'sand', 'now runs north-south'); assert.equal(t.kindAt(8, 0), 'rough');
 t.undo(); assert.equal(t.kindAt(8, 0), 'sand'); assert.equal(t.kindAt(0, 8), 'rough');
 t.addHome({x: 40, z: 40, rotation: 0, width: 10, depth: 8});
 t.turn(t.pickAt({x: 40, z: 40}), 1); assert.ok(Math.abs(t.state.homes[0].rotation + 1) < 1e-9, 'a facing turns the other way round');
 // A full turn gives the same outline back, to the centimetre.
 const b = t.pickAt({x: 0, z: 0}), was = count(t, 'sand');
 t.turn(b, 2 * Math.PI); assert.ok(Math.abs(count(t, 'sand') - was) < .05); assert.equal(t.kindAt(8, 0), 'sand');
});

test('copying and deleting one shape, a tree and a house, each one undo step (builder-ux)', () => {
 const t = createTrace(grid);
 t.fill([[[-30, -10], [30, -10], [30, 10], [-30, 10]]], 'fairway');
 t.paint({x: -10, z: 0, radius: 4, kind: 'sand'});
 const sands = count(t, 'sand'), pick = t.pickAt({x: -10, z: 0});
 t.copy(pick, 20, 0);
 assert.equal(t.kindAt(10, 0), 'sand', 'the copy where it was put');
 assert.equal(t.kindAt(-10, 0), 'sand', 'the original kept');
 assert.ok(Math.abs(count(t, 'sand') - 2 * sands) < .01);
 t.remove(t.pickAt({x: 10, z: 0}));
 assert.equal(t.kindAt(10, 0), 'fairway', 'deleting a bunker shows the fairway under it');
 t.undo(); assert.equal(t.kindAt(10, 0), 'sand'); t.undo(); assert.ok(Math.abs(count(t, 'sand') - sands) < .01);
 t.addTree({x: 40, z: 40, h: 12, crown: 3});
 t.copy(t.pickAt({x: 40, z: 40}), 0, -10);
 assert.equal(t.state.trees.length, 2); assert.equal(t.state.trees[1].z, 30);
 t.remove({type: 'tree', index: 0}); assert.equal(t.state.trees.length, 1); assert.equal(t.state.trees[0].z, 30);
 t.addHome({x: -40, z: 40, rotation: 0, width: 10, depth: 8});
 t.copy(t.pickAt({x: -40, z: 40}), 15, 0); assert.equal(t.state.homes.length, 2); assert.equal(t.state.homes[1].x, -25);
 t.undo(); assert.equal(t.state.homes.length, 1);
});

test('a creek line is picked near its line and deleted, one undo (builder-ux)', () => {
 const t = createTrace(grid);
 t.addCreekLine({points: [[-40, 0], [0, 5], [40, 0]], width: 4});
 assert.deepEqual(t.pickAt({x: 0, z: 6}), {type: 'creek', index: 0});
 t.copy({type: 'creek', index: 0}, 10, 0); assert.equal(t.state.creekLines.length, 1, 'a creek is not copied');
 t.remove({type: 'creek', index: 0}); assert.equal(t.state.creekLines.length, 0);
 t.undo(); assert.equal(t.state.creekLines.length, 1);
});

// THIN SHAPES KEPT (the owner, 23 November 2026: "smooth edges on thin shapes
// like cart paths will completely delete large sections of it"), specks still not.
test('smoothing every layer keeps a cart path whole and still clears a speck', () => {
 const t = createTrace(grid);
 t.line([[-40, -20], [0, 0], [40, -10]], {kind: 'path', width: 2.5});
 t.paint({x: 25, z: 20, radius: .4, kind: 'sand'});
 const before = count(t, 'path');
 t.smooth({radius: 1.5});
 assert.ok(count(t, 'path') >= before * .95, `${before} -> ${count(t, 'path')} m² of path`);
 assert.equal(t.kindAt(25, 20), 'rough', 'the speck of sand goes');
});

// The owner, 23 November 2026: the line tool, Normalize width, a house of any size.
test('a line is laid on its layer at its width, one undo; rough takes every layer off along it', () => {
 const t = createTrace(grid);
 t.line([[-30, 0], [30, 0]], {kind: 'path', width: 2.5});
 assert.equal(t.kindAt(0, 0), 'path'); assert.equal(t.kindAt(0, 1), 'path'); assert.equal(t.kindAt(0, 2), 'rough');
 assert.equal(t.kindAt(31, 0), 'path', 'round ends');
 t.undo(); assert.equal(count(t, 'path'), 0);
 t.line([[-30, 0], [30, 0]], {kind: 'path', width: 2.5, caps: 'square'});
 assert.equal(t.kindAt(31, 0), 'rough', 'square ends');
 t.line([[0, -10], [0, 10]], {kind: 'rough', width: 3});
 assert.equal(t.kindAt(0, 0), 'rough', 'rough clears the path where it crosses');
});

test('normalize width lays a path again at one width, one undo; a layer with none changes nothing', () => {
 const t = createTrace(grid);
 t.line([[-40, 0], [0, 0]], {kind: 'path', width: 4}); t.line([[0, 0], [40, 0]], {kind: 'path', width: 2});
 const before = count(t, 'path');
 assert.ok(t.evenWidth({kind: 'path', width: 2.5}) > 0);
 const across = x => { let n = 0; for (let z = -5; z <= 5; z += .5) if (t.kindAt(x, z) === 'path') n++; return n * .5; };
 assert.ok(Math.abs(across(-20) - across(20)) <= .5, `one width both sides: ${across(-20)} and ${across(20)} m`);
 t.undo(); assert.equal(count(t, 'path'), before);
 assert.equal(t.evenWidth({kind: 'road', width: 6}), 0);
});

test('a house is sized whole, where it stands and facing as it was, one undo', () => {
 const t = createTrace(grid);
 t.addHome({x: 0, z: 0, rotation: 1, width: 20, depth: 15});
 t.sizeHome(0, {width: 34, depth: 9});
 assert.deepEqual(t.state.homes[0], {x: 0, z: 0, rotation: 1, width: 34, depth: 9});
 t.undo(); assert.equal(t.state.homes[0].width, 20);
});
