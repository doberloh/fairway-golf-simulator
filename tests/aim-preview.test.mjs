import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, rollPreview, YARD} from '../src/physics.js';
import {rollDeceleration, turfConfig, struckDistance} from '../src/turf.js';

const turf = turfConfig({stimp: 10});
// height is called as height(x, z). Single-argument arrows here silently bind x,
// which is how a "downhill" fixture in this file was quietly a cross-slope.
const green = (height = () => 0, surface = () => 'green') => ({
 height, surface, pin: {x: 9e9, z: 9e9}, trees: [], homes: [],
 bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6},
});
const origin = {x: 0, z: 0};
const shoot = (course, aim, speed) =>
 simulateShot({origin, aim, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed}, course, {turf});

test('the preview lands where the ball lands, on flat ground', () => {
 const course = green();
 for (const speed of [1.5, 3, 4.5]) {
  const predicted = rollPreview(course, origin, 0, speed, {turf});
  const actual = shoot(course, 0, speed);
  assert.ok(Math.abs(predicted.end.z - actual.end.z) < 0.02,
   `at ${speed} m/s preview said ${predicted.end.z.toFixed(3)}, ball reached ${actual.end.z.toFixed(3)}`);
 }
});

test('the preview lands where the ball lands across a slope, break and all', () => {
 // This is the case the old closed form could not see at all: it assumed flat
 // ground and drew a straight line, so it was wrong about both where the ball
 // stops and which way it goes.
 const course = green((x, z) => x * 0.04);
 for (const speed of [2, 3, 4]) {
  const predicted = rollPreview(course, origin, 0, speed, {turf});
  const actual = shoot(course, 0, speed);
  const miss = Math.hypot(predicted.end.x - actual.end.x, predicted.end.z - actual.end.z);
  assert.ok(miss < 0.05, `at ${speed} m/s the preview missed the ball by ${miss.toFixed(3)} m`);
  assert.ok(Math.abs(predicted.end.x) > 0.1, 'and it has to show the break, not a straight line');
 }
});

test('a downhill putt is predicted to run away, an uphill one to stop short', () => {
 const down = rollPreview(green((x, z) => -z * 0.03), origin, 0, 3, {turf});
 const flat = rollPreview(green(), origin, 0, 3, {turf});
 const up = rollPreview(green((x, z) => z * 0.03), origin, 0, 3, {turf});
 assert.ok(down.distance > flat.distance * 1.2, `downhill ${down.distance.toFixed(2)} vs flat ${flat.distance.toFixed(2)}`);
 assert.ok(up.distance < flat.distance * 0.85, `uphill ${up.distance.toFixed(2)} vs flat ${flat.distance.toFixed(2)}`);
 // The old preview could not tell these three apart -- it returned one number.
 const blind = struckDistance(3, rollDeceleration('green', turf));
 assert.ok(Math.abs(flat.distance - blind) / blind < 0.02, 'and on the flat it still agrees with the closed form');
});

test('running off the green is seen, and shortens the putt', () => {
 // Green out to 4 m, then rough. A ball hit to reach 8 m on green stops well
 // short of that, and the preview has to say so rather than promising 8.
 const patchy = green(() => 0, (x, z) => Math.hypot(x, z) < 4 ? 'green' : 'rough');
 const speed = 4;
 const onGreen = rollPreview(green(), origin, 0, speed, {turf});
 const offGreen = rollPreview(patchy, origin, 0, speed, {turf});
 assert.ok(onGreen.distance > 4, 'this test needs a putt that would leave the green');
 assert.ok(offGreen.distance < onGreen.distance * 0.75,
  `rough should bite: ${offGreen.distance.toFixed(2)} vs ${onGreen.distance.toFixed(2)}`);
 assert.equal(offGreen.surface, 'rough', 'and the preview reports what it stopped on');
 // Still agrees with the ball itself.
 const actual = shoot(patchy, 0, speed);
 assert.ok(Math.abs(offGreen.distance - actual.total) < 0.05);
});

test('the preview path is the path, not just its endpoint', () => {
 const course = green((x, z) => x * 0.05);
 const preview = rollPreview(course, origin, 0, 3, {turf});
 assert.ok(preview.points.length > 8, 'a path needs enough points to draw a curve');
 assert.deepEqual(preview.points[0], {x: 0, z: 0}, 'it starts at the ball');
 const last = preview.points.at(-1);
 assert.ok(Math.hypot(last.x - preview.end.x, last.z - preview.end.z) < 1e-9, 'and ends where the ball does');
 // The curve must actually bend: a straight line would have constant bearing.
 const bearing = i => Math.atan2(preview.points[i + 1].x - preview.points[i].x, preview.points[i + 1].z - preview.points[i].z);
 assert.ok(Math.abs(bearing(preview.points.length - 2) - bearing(0)) > 0.05, 'the line has to curve with the break');
});

test('a preview never runs forever, however steep the ground', () => {
 // Past about 8% gravity beats rolling resistance on a green and the ball never
 // stops. The preview has to return anyway rather than hanging the aim update.
 const preview = rollPreview(green((x, z) => -z * 0.5), origin, 0, 3, {turf, seconds: 20});
 assert.ok(Number.isFinite(preview.distance));
 assert.ok(preview.points.length > 2);
});

test('a released ball previews the rolling distance, a struck one the shorter skid-and-roll', () => {
 const course = green();
 const struck = rollPreview(course, origin, 0, 3, {turf});
 const released = rollPreview(course, origin, 0, 3, {turf, roll: 3});
 assert.ok(released.distance > struck.distance * 1.5);
});
