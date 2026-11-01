// Entwine point tiles (src/lidar/ept.js): the nodes over a box found through
// a hierarchy split over files; Web Mercator both ways.
import test from 'node:test';
import assert from 'node:assert/strict';
import {nodesFor, nodeBox, mercToLonLat, lonLatToMerc} from '../src/lidar/ept.js';

test('every node meeting the box, the tree followed into its further files, nothing else', async () => {
 const cube = [0, 0, 0, 800, 800, 800];
 // Depth 1 splits the 800 m cube into 400 m quarters; 1-1-1-0 goes on in its own file.
 const files = {
  '0-0-0-0': {'0-0-0-0': 50, '1-0-0-0': 40, '1-1-0-0': 30, '1-0-1-0': 20, '1-1-1-0': -1},
  '1-1-1-0': {'2-2-2-0': 10, '2-3-3-0': 5, '2-2-3-0': 0},
 };
 const asked = [];
 const {nodes, parts} = await nodesFor(cube, [450, 450, 500, 500], async k => { asked.push(k); return files[k]; });
 assert.deepEqual(nodes.map(n => n.key), ['0-0-0-0', '2-2-2-0'], 'the root and the one leaf over the box (empty nodes skipped)');
 assert.deepEqual(parts, ['0-0-0-0', '1-1-1-0']); assert.deepEqual(asked, parts);
 // A box in the first quarter never reads the further file.
 const far = await nodesFor(cube, [10, 10, 20, 20], async k => files[k]);
 assert.deepEqual(far.nodes.map(n => n.key), ['0-0-0-0', '1-0-0-0']); assert.deepEqual(far.parts, ['0-0-0-0']);
 assert.deepEqual(nodeBox('2-3-1-0', cube), [600, 200, 800, 400]);
});

test('Web Mercator to degrees and back; its metres stretch with latitude', () => {
 const m = lonLatToMerc(-95.63, 43.63), g = mercToLonLat(m.x, m.y);
 assert.ok(Math.abs(g.lon + 95.63) < 1e-9 && Math.abs(g.lat - 43.63) < 1e-9);
 // A ground kilometre east at 43.63 N is about 1/cos(43.63) = 1.38 km of Web Mercator.
 const a = lonLatToMerc(0, 43.63), b = lonLatToMerc(1000 / (111320 * Math.cos(43.63 * Math.PI / 180)), 43.63);
 assert.ok(Math.abs((b.x - a.x) / 1000 - 1 / Math.cos(43.63 * Math.PI / 180)) < .01);
});
