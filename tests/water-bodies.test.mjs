// What the renderer needs to know about a body of water beyond its geometry.
//
// The reflector-choice tests that used to live here are gone with the thing
// they tested: there is no single planar mirror to hand between ponds any more,
// so there is nothing to choose and nothing that can change under the camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hideForProbe,restoreAfterProbe,flowFor,STREAM_FLOW} from '../src/water-bodies.js';

// THE PROBE PASS HAS TO GIVE THE WATER BACK.
//
// Reported as ponds being covered by a texture: the restore wrote `visible` on
// the body wrapper rather than on its mesh, so every pond stayed hidden after
// the capture and the water-coloured ground underneath showed through.
test('every body hidden for a probe is visible again afterwards', () => {
 const bodies = [0, 1, 2, 3].map(() => ({mesh: {visible: true}}));
 const hidden = hideForProbe(bodies);
 assert.equal(hidden.length, 4);
 assert.ok(bodies.every(b => !b.mesh.visible), 'a probe must not photograph other water');
 assert.equal(restoreAfterProbe(hidden), 4);
 assert.ok(bodies.every(b => b.mesh.visible), 'the ponds have to come back');
});

test('a body already hidden stays hidden', () => {
 // The reflector stands in for one body, whose own mesh is deliberately off.
 // Restoring it would draw two surfaces in the same place.
 const stood = {mesh: {visible: false}}, other = {mesh: {visible: true}};
 restoreAfterProbe(hideForProbe([stood, other]));
 assert.equal(stood.mesh.visible, false);
 assert.equal(other.mesh.visible, true);
});

test('hiding and restoring survive a course with no water', () => {
 assert.deepEqual(hideForProbe([]), []);
 assert.equal(restoreAfterProbe([]), 0);
 assert.deepEqual(hideForProbe(), []);
 assert.equal(restoreAfterProbe(), 0);
});

// FLOW IS A PROPERTY OF THE BODY, NOT A SETTING.

test('still water does not travel', () => {
 // A pond's ripples move; the field they move through does not. Zero here is
 // also what puts the shader on its cheap single-sample path, which most of
 // the water on most courses takes.
 assert.deepEqual(flowFor({center: {x: 10, z: 10}}), {x: 0, y: 0});
 assert.deepEqual(flowFor({ocean: true}), {x: 0, y: 0});
 assert.deepEqual(flowFor({}), {x: 0, y: 0});
 assert.deepEqual(flowFor(), {x: 0, y: 0});
});

test('a creek travels along its own channel at a fixed speed', () => {
 const east = flowFor({stream: [{x: 0, z: 0}, {x: 50, z: 0}]});
 assert.ok(Math.abs(east.x - STREAM_FLOW) < 1e-9, 'due east');
 assert.ok(Math.abs(east.y) < 1e-9);
 // The direction is the channel's, whatever its length.
 const north = flowFor({stream: [{x: 0, z: 0}, {x: 0, z: 400}]});
 assert.ok(Math.abs(north.y - STREAM_FLOW) < 1e-9);
 // Speed is the same for every channel: it is the surface, not the current.
 assert.ok(Math.abs(Math.hypot(north.x, north.y) - STREAM_FLOW) < 1e-9);
});

test('a channel with nowhere to go has no direction', () => {
 // A one-station channel, or one that ends where it began, would otherwise
 // divide by zero and push NaN into a uniform, which silently blanks the body.
 assert.deepEqual(flowFor({stream: [{x: 5, z: 5}]}), {x: 0, y: 0});
 assert.deepEqual(flowFor({stream: [{x: 5, z: 5}, {x: 5, z: 5}]}), {x: 0, y: 0});
 for (const v of Object.values(flowFor({stream: [{x: 5, z: 5}, {x: 5, z: 5}]})))
  assert.ok(Number.isFinite(v));
});
