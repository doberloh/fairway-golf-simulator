// Which survey pieces to fetch: every depth inside the outline, a thin layer
// outside (src/lidar/detail.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseNodes, ringMeetsBox, inRing, depthOf} from '../src/lidar/detail.js';
import {nodeBox} from '../src/lidar/ept.js';

test('a ring and a box meet when one holds a corner of the other or their edges cross', () => {
 const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
 assert.ok(ringMeetsBox(sq, [5, 5, 20, 20]), 'a corner of the ring inside the box');
 assert.ok(ringMeetsBox(sq, [2, 2, 3, 3]), 'the box inside the ring');
 assert.ok(ringMeetsBox(sq, [-5, 4, 15, 6]), 'edges crossing, no corner inside either');
 assert.ok(!ringMeetsBox(sq, [11, 11, 20, 20]));
 assert.ok(!ringMeetsBox([[0, 0], [10, 0], [0, 10]], [7, 7, 9, 9]), 'beside a triangle\'s long side, in its bounding box but outside it');
 assert.ok(inRing(sq, 5, 5) && !inRing(sq, 15, 5));
});

// A survey over a 1,024-unit cube: four depths, each node 256 points (a
// quarter more density each depth down, as Entwine keeps it).
function survey() {
 const cube = [0, 0, 0, 1024, 1024, 1024], nodes = [];
 for (let d = 0; d <= 3; d++) { const n = 2 ** d; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) nodes.push({key: `${d}-${x}-${y}-0`, points: 256}); }
 return {cube, nodes, boxOf: k => nodeBox(k, cube)};
}

test('no outline: every node', () => {
 const {nodes, boxOf} = survey(), got = chooseNodes(nodes, boxOf, [0, 0, 1024, 1024]);
 assert.equal(got.nodes.length, nodes.length); assert.equal(got.depth, null);
});

test('outside the outline only the depths that give the density asked; inside it every depth', () => {
 const {nodes, boxOf} = survey(), box = [0, 0, 1024, 1024];
 // Density each depth: 256 * 4^d points over 1,048,576 units: depth 0 gives
 // 0.000244, 1 adds 0.000977 (0.00122 together), 2 adds 0.0039 (0.0051), 3 0.0156.
 const ring = [[10, 10], [100, 10], [100, 100], [10, 100]];
 const got = chooseNodes(nodes, boxOf, box, {ring, perM2: .004, buffer: 0});
 assert.equal(got.depth, 2);
 const deep = got.nodes.filter(n => depthOf(n.key) === 3);
 assert.deepEqual(deep.map(n => n.key), ['3-0-0-0'], 'only the deepest node under the outline');
 assert.equal(got.nodes.filter(n => depthOf(n.key) <= 2).length, 1 + 4 + 16, 'every node down to the depth outside');
 // The buffer reaches the next node over.
 const wide = chooseNodes(nodes, boxOf, box, {ring, perM2: .004, buffer: 40});
 assert.deepEqual(wide.nodes.filter(n => depthOf(n.key) === 3).map(n => n.key).sort(), ['3-0-0-0', '3-0-1-0', '3-1-0-0', '3-1-1-0']);
 // Ground metres per unit: at half a metre a unit the same nodes are a quarter the area, four times the density.
 assert.equal(chooseNodes(nodes, boxOf, box, {ring, perM2: .004 * 4, metres: .5, buffer: 0}).depth, 2);
});

test('a density the survey never reaches: every node, as without an outline', () => {
 const {nodes, boxOf} = survey(), got = chooseNodes(nodes, boxOf, [0, 0, 1024, 1024], {ring: [[0, 0], [5, 0], [5, 5]], perM2: 1});
 assert.equal(got.nodes.length, nodes.length); assert.equal(got.depth, null);
});
