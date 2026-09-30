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

import {streamFrame} from '../src/water-bodies.js';
test('a channel flows along its own bends, downhill, whichever way its stations were stored', () => {
 // An L: east for 50 m, then north for 50 m, falling all the way.
 const path = [];
 for (let x = 0; x <= 50; x += 5) path.push({x, z: 0, level: 10 - x * .01});
 for (let z = 5; z <= 50; z += 5) path.push({x: 50, z, level: 9.5 - z * .01});
 const f = streamFrame(path);
 assert.ok(f[2].tx > .99 && Math.abs(f[2].tz) < .01, 'the first leg flows east');
 assert.ok(f[path.length - 3].tz > .99 && Math.abs(f[path.length - 3].tx) < .01, 'the second leg flows north');
 for (let i = 1; i < path.length; i++) assert.ok(f[i].s > f[i - 1].s, 'distance grows downstream');
 // The same channel stored the other way round still flows downhill.
 const back = streamFrame(path.slice().reverse());
 assert.ok(back[path.length - 3].tx > .99, 'reversed storage: the east leg still flows east');
 assert.ok(back[0].s > back[path.length - 1].s, 'and distance still grows downstream');
});
