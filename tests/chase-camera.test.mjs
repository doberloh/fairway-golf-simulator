// FOLLOW THE FLIGHT ON A LINE FIXED AT THE STRIKE (the owner, 19 November
// 2026): the camera trails a full shot or a putt along one bearing and never
// circles the ball; a putt's camera starts where the aim view stood and stops
// near the cup. camera.js chasePose, puttChasePose, shotBearing; the setting
// in camera-prefs.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chasePose, puttChasePose, shotBearing, puttAimPose, PUTT_STOP, PUTT_RIG} from '../src/camera.js';
import {validateCamera, DEFAULT_CAMERA} from '../src/camera-prefs.js';

// A flat hole, the cup at the origin, toWorld the identity.
const hole = {pin: {x: 0, z: 0}, rotation: 0, height: () => 0, toWorld: p => ({x: p.x, y: p.y, z: p.z})};
const bearingFrom = (pose, p) => Math.atan2(p.x - pose.eye.x, p.z - pose.eye.z);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('the bearing is the line from the strike to where the ball stops', () => {
 assert.ok(near(shotBearing([{x: 0, z: 0}, {x: 5, z: 50}, {x: 10, z: 100}]), Math.atan2(10, 100)));
 assert.equal(shotBearing([{x: 1, z: 1}]), 0, 'a ball that does not move keeps the hole\'s own line');
 assert.equal(shotBearing(null), 0);
});

test('a full shot: the camera keeps the same angle to the ball wherever the ball is, so it never circles it', () => {
 // A ball running past and beside the pin is where the old chase swung round.
 const bearing = 0.1, angles = [];
 for (const p of [{x: 0, z: -150, y: 30}, {x: 2, z: -5, y: 0}, {x: -1, z: 0.5, y: 0}, {x: 3, z: 6, y: 0}])
  angles.push(bearingFrom(chasePose(hole, p, bearing), p));
 for (const a of angles) assert.ok(near(a, angles[0], 1e-6), `the camera turned: ${angles.map(v => v.toFixed(3)).join(', ')}`);
});

test('a full shot is watched from behind and above, closer as it nears the pin', () => {
 const far = chasePose(hole, {x: 0, z: -200, y: 20}, 0), close = chasePose(hole, {x: 0, z: -20, y: 2}, 0);
 const back = (pose, p) => Math.hypot(pose.eye.x - p.x, pose.eye.z - p.z);
 assert.ok(far.eye.z < -200 && far.eye.y > 20, 'behind and above the ball');
 assert.ok(back(close, {x: 0, z: -20}) < back(far, {x: 0, z: -200}));
});

test('a putt starts exactly where the aim view stood, so nothing jumps', () => {
 const ball = {x: 0, z: -9, y: 0.021}, aim = 0;
 const a = puttAimPose(hole, ball, aim), c = puttChasePose(hole, ball, aim * Math.PI / 180);
 for (const k of ['x', 'y', 'z']) {
  assert.ok(near(a.eye[k], c.eye[k], 1e-9), `eye ${k}`);
  assert.ok(near(a.target[k], c.target[k], 1e-9), `look ${k}`);
 }
});

test('a putt is followed straight from behind, and stops near the cup', () => {
 const b = 0;
 const on = puttChasePose(hole, {x: 0, z: -6, y: 0.021}, b);
 assert.equal(on.stopped, false);
 assert.ok(near(on.eye.z, -6 - PUTT_RIG.distance) && near(on.eye.x, 0), 'straight behind on the line');
 const close = puttChasePose(hole, {x: 0.3, z: -(PUTT_STOP - 0.1), y: 0.021}, b);
 assert.equal(close.stopped, true, 'inside PUTT_STOP the camera stops');
 const at = {x: 1, y: 2, z: -9};
 const held = puttChasePose(hole, {x: 0.8, z: 1.5, y: 0.021}, b, at);
 assert.deepEqual(held.eye, at, 'once stopped it stays put, wherever the ball goes');
 assert.ok(held.target.z > 1.5, 'and still looks along the line past the ball');
});

test('the shot camera is a camera setting: follow by default, television kept', () => {
 assert.equal(DEFAULT_CAMERA.shotCamera, 'follow');
 assert.equal(validateCamera({shotCamera: 'tv'}).shotCamera, 'tv');
 assert.equal(validateCamera({shotCamera: 'drone'}).shotCamera, 'follow');
 assert.equal(validateCamera({}).shotCamera, 'follow', 'a camera saved before the setting follows the flight');
});
