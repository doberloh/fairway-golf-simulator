import test from 'node:test';
import assert from 'node:assert/strict';
import {planShotCamera, planReview, pointAt, TV} from '../src/tv-camera.js';
import {simulateShot, MPH} from '../src/physics.js';

const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: []};
const drive = simulateShot({origin: {x: 0, z: 0}, aim: 0, speed: 155 * MPH, vla: 12.5, hla: 0, spin: 2700, spinAxis: 0}, flat);
const chip = simulateShot({origin: {x: 0, z: 0}, aim: 0, speed: 40 * MPH, vla: 35, hla: 0, spin: 6000, spinAxis: 0}, flat);
const toWorld = p => ({x: p.x, z: p.z});
const ground = () => 0;

test('a full shot cuts after its apex, with the shape already shown', () => {
 const plan = planShotCamera({points: drive.points, hang: drive.hang, carry: drive.carry, toWorld, groundAt: ground, trees: []});
 let top = 0;
 for (let i = 1; i < drive.points.length; i++) if (drive.points[i].y > drive.points[top].y) top = i;
 assert.ok(plan.cutAt > drive.points[top].t, 'not before the apex');
 assert.ok(plan.cutAt < drive.hang, 'before touchdown, so the landing is seen');
 assert.ok(plan.landEye, 'a landing camera');
 // Standing near the landing, not near the tee.
 const land = pointAt(drive.points, drive.hang);
 assert.ok(Math.hypot(plan.landEye.x - land.x, plan.landEye.z - land.z) < 70);
 assert.ok(plan.landEye.y >= TV.landHeight - 1e-9);
});

test('a chip keeps the one camera', () => {
 assert.ok(chip.carry < TV.minCarry, `this chip carries ${chip.carry.toFixed(1)} m`);
 assert.equal(planShotCamera({points: chip.points, hang: chip.hang, carry: chip.carry, toWorld, groundAt: ground, trees: []}).cutAt, Infinity);
});

test('the landing camera stands where a ridge does not hide the landing', () => {
 // A wall of ground everywhere to the shot's left (+x is the golfer's left).
 const ridge = (x) => x > 5 ? 40 : 0;
 const plan = planShotCamera({points: drive.points, hang: drive.hang, carry: drive.carry, toWorld, groundAt: (x) => ridge(x), trees: []});
 assert.ok(plan.landEye.x < 0, 'it chose the open side');
});

test('the review frames the whole shot from above it', () => {
 const r = planReview({points: drive.points, toWorld, groundAt: ground, trees: []});
 assert.ok(r, 'a review pose');
 const a = drive.points[0], b = drive.points.at(-1);
 assert.ok(r.eye.y > drive.apex, 'above the apex');
 // Both ends of the shot inside a 53 degree frame at 16:9.
 const look = [r.look.x - r.eye.x, r.look.y - r.eye.y, r.look.z - r.eye.z];
 const n = Math.hypot(...look);
 for (const p of [a, b]) {
  const v = [p.x - r.eye.x, p.y - r.eye.y, p.z - r.eye.z];
  const cos = (v[0] * look[0] + v[1] * look[1] + v[2] * look[2]) / (n * Math.hypot(...v));
  assert.ok(Math.acos(cos) * 180 / Math.PI < 50, 'an end of the shot falls outside the frame');
 }
 assert.equal(planReview({points: [{x: 0, y: 0, z: 0, t: 0}, {x: 0, y: 0, z: 2, t: 1}], toWorld, groundAt: ground}), null, 'nothing to review on a tap-in');
});
