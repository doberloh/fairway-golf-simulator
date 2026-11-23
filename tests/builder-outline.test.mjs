// The course's rough outline in door 2's LIDAR step (src/builder/outline-ring.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {ringPress, ringHectares} from '../src/builder/outline-ring.js';

test('drawing: a press adds a corner, and closes the outline on the first corner once there are three', () => {
 const ring = [{x: 0, z: 0}, {x: 100, z: 0}];
 assert.equal(ringPress(ring, true, {x: 2, z: 1}, 5).act, 'add', 'two corners: never closes');
 ring.push({x: 100, z: 100});
 assert.equal(ringPress(ring, true, {x: 2, z: 1}, 5).act, 'close');
 assert.equal(ringPress(ring, true, {x: 50, z: 50}, 5).act, 'add');
});

test('after: a press near a corner takes the nearest; elsewhere nothing', () => {
 const ring = [{x: 0, z: 0}, {x: 4, z: 0}, {x: 4, z: 4}];
 assert.deepEqual(ringPress(ring, false, {x: 3.5, z: .5}, 5), {act: 'take', index: 1});
 assert.equal(ringPress(ring, false, {x: 50, z: 50}, 5), null);
});

test('an outline\'s area in hectares', () => {
 const d = 100 / 111320, ring = [[0, 0], [d, 0], [d, d], [0, d]];
 assert.ok(Math.abs(ringHectares(ring) - 1) < .001);
 assert.equal(ringHectares(null), 0);
});
