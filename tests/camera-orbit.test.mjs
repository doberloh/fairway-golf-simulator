import test from 'node:test';
import assert from 'node:assert/strict';
import {ORBIT, stepOrbit, orbitEye} from '../src/camera.js';

// The green view's own offset (renderer.js setCamera): 28 across, 21 up, 34 back.
const look = {x: 100, y: 5, z: -40}, offset = {x: 28, y: 21, z: 34};
const near = (a, b, d = 1e-9) => Math.abs(a - b) < d;
const dist = (e) => Math.hypot(e.x - look.x, e.y - look.y, e.z - look.z);
const elevation = (e) => Math.atan2(e.y - look.y, Math.hypot(e.x - look.x, e.z - look.z)) * 180 / Math.PI;

test('no turn leaves the view exactly where it was', () => {
 const e = orbitEye(look, offset, {yaw: 0, pitch: 0, zoom: 1});
 assert.ok(near(e.x, look.x + 28) && near(e.y, look.y + 21) && near(e.z, look.z + 34));
 assert.deepEqual(orbitEye(look, offset, null), orbitEye(look, offset, {}));
});

test('a drag turns round the point at the same distance and height', () => {
 const o = stepOrbit({}, offset, {yaw: Math.PI / 2});
 const e = orbitEye(look, offset, o), start = orbitEye(look, offset, {});
 assert.ok(near(dist(e), dist(start), 1e-6));
 assert.ok(near(e.y, start.y, 1e-6));
 // A quarter turn: the flat offset is now at right angles to where it was.
 assert.ok(near((e.x - look.x) * 28 + (e.z - look.z) * 34, 0, 1e-6));
});

test('tipping stops between 5 and 85 degrees above the ground', () => {
 let o = {};
 for (let i = 0; i < 50; i++) o = stepOrbit(o, offset, {pitch: .2});
 assert.ok(near(elevation(orbitEye(look, offset, o)), ORBIT.maxElevation, 1e-6));
 for (let i = 0; i < 100; i++) o = stepOrbit(o, offset, {pitch: -.2});
 assert.ok(near(elevation(orbitEye(look, offset, o)), ORBIT.minElevation, 1e-6));
 // A drag back the other way moves at once: the clamp does not store the overshoot.
 const back = stepOrbit(o, offset, {pitch: .01});
 assert.ok(elevation(orbitEye(look, offset, back)) > ORBIT.minElevation);
});

test('the wheel moves in and out between a third and two and a half times as far', () => {
 const base = dist(orbitEye(look, offset, {}));
 let o = {};
 for (let i = 0; i < 40; i++) o = stepOrbit(o, offset, {zoom: 1.12});
 assert.ok(near(dist(orbitEye(look, offset, o)), base * ORBIT.maxZoom, 1e-6));
 for (let i = 0; i < 80; i++) o = stepOrbit(o, offset, {zoom: 1 / 1.12});
 assert.ok(near(dist(orbitEye(look, offset, o)), base * ORBIT.minZoom, 1e-6));
});
