// THE RINGS ON THE GREEN, BOLD AND LIT (the owner, 19 November 2026): which
// ring the ball is inside, and the colours the renderer is given.
import test from 'node:test';
import assert from 'node:assert/strict';
import {puttingRings, litRing, RING_INSIDE, RING_WIDTH, FOOT} from '../src/putting.js';

test('the gimme circle lights when the ball is inside it, edge included', () => {
 const rings = puttingRings({mode: 'gimme', gimme: 3});
 assert.equal(litRing(rings, 2 * FOOT), 0);
 assert.equal(litRing(rings, 3 * FOOT), 0, 'on the edge is inside, as the gimme is given');
 assert.equal(litRing(rings, 3.1 * FOOT), -1);
});

test('dartboard: only the innermost ring round the ball lights', () => {
 const rings = puttingRings({mode: 'dartboard', one: 2, two: 8, three: 16});
 const yd = .9144;
 assert.equal(litRing(rings, 1 * yd), 0);
 assert.equal(litRing(rings, 5 * yd), 1);
 assert.equal(litRing(rings, 12 * yd), 2);
 assert.equal(litRing(rings, 20 * yd), -1);
 assert.equal(litRing([], 0), -1, 'hole out has no rings');
});

test('the first ring is white, the lit colour stands apart, and the lines are bold', () => {
 assert.equal(puttingRings({mode: 'gimme', gimme: 3})[0].colour, '#ffffff');
 const all = puttingRings({mode: 'dartboard', one: 2, two: 8, three: 16}).map(r => r.colour);
 assert.ok(!all.includes(RING_INSIDE));
 assert.ok(RING_WIDTH >= 4);
});
