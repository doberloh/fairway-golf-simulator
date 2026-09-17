import test from 'node:test';
import assert from 'node:assert/strict';
import {shotPlan, solveLaunch, outcome, greenSlope, envelope, dropOutcome, jitterStream, groupStats} from '../src/lab.js';
import {generateWorld} from '../src/course.js';
import {RANGE_SETTINGS} from '../src/range.js';
import {simulateShot, rollPreview, R, CUP_RADIUS} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';

test('the lab green is flat, which is the entire point of it', () => {
 const h = generateWorld(RANGE_SETTINGS).holes[0];
 let worst = 0, n = 0;
 for (let dx = -8; dx <= 8; dx += 0.5) for (let dz = -8; dz <= 8; dz += 0.5) {
  const x = h.pin.x + dx, z = h.pin.z + dz, e = 0.25;
  if (h.surface(x, z) !== 'green') continue;
  const gx = (h.height(x + e, z) - h.height(x - e, z)) / (2 * e);
  const gz = (h.height(x, z + e) - h.height(x, z - e)) / (2 * e);
  worst = Math.max(worst, Math.hypot(gx, gz)); n++;
 }
 assert.ok(n > 500, `expected a green worth testing on, sampled ${n} points`);
 assert.ok(worst < 1e-6, `steepest gradient on the lab green was ${(worst * 100).toFixed(4)}%`);
});


test('a shot plan puts the line exactly where it was asked to go', () => {
 for (const feet of [4, 10, 40]) for (const offset of [0, 1, 2]) {
  const plan = shotPlan({feet, offset, past: 1.4});
  // Fire the planned aim from the planned spot and check the perpendicular miss.
  const d = plan.distance, a = plan.aimDegrees * Math.PI / 180;
  const atCup = Math.tan(a) * d;
  assert.ok(Math.abs(atCup - offset * 0.0254) < 1e-9,
   `${feet} ft with ${offset} in asked for ${(offset * 0.0254).toFixed(4)} and lines up ${atCup.toFixed(4)}`);
 }
});


test('the launch solver hits the distance it was asked for', () => {
 const h = generateWorld(RANGE_SETTINGS).holes[0], turf = turfConfig({stimp: 10});
 const origin = {x: h.pin.x, z: h.pin.z - 3};
 for (const target of [1, 3, 6, 12]) {
  const speed = solveLaunch(v => rollPreview(h, origin, 0, v, {turf, seconds: 30}).distance, target);
  const ran = rollPreview(h, origin, 0, speed, {turf, seconds: 30}).distance;
  assert.ok(Math.abs(ran - target) < 0.01, `asked ${target} m, solved to ${ran.toFixed(3)}`);
 }
});

test('the solved launch is the launch the real shot uses', () => {
 // The lab is only worth anything if firing its number reproduces its prediction.
 const h = generateWorld(RANGE_SETTINGS).holes[0], turf = turfConfig({stimp: 10});
 const plan = shotPlan({feet: 10, past: 1.4, offset: 0});
 const origin = {x: h.pin.x, z: h.pin.z - plan.distance};
 const speed = solveLaunch(v => rollPreview(h, origin, plan.aimDegrees, v, {turf, seconds: 30}).distance, plan.target);
 const open = {...h, pin: {x: 9e9, z: 9e9}};
 const fired = simulateShot({origin, aim: plan.aimDegrees, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed}, open, {turf});
 assert.ok(Math.abs(fired.total - plan.target) < 0.02,
  `planned ${plan.target.toFixed(3)} m, the shot ran ${fired.total.toFixed(3)}`);
});

test('the readout measures height above the turf, not above sea level', () => {
 // The green sits wherever the generator put it. Reading raw y reported a 12 m
 // hop for a putt that never left the ground.
 const pin = {x: 0, z: 0};
 const ground = () => 12;
 const flat = {end: {x: 0, z: 1}, total: 1, holed: false, lipped: true,
  points: [{x: 0, z: 0.5, y: 12 + R}, {x: 0, z: 1, y: 12 + R}]};
 assert.equal(outcome(flat, pin, ground, R).hopMm, 0);
 const hopped = {...flat, points: [{x: 0, z: 0.5, y: 12 + R + 0.09}]};
 assert.equal(outcome(hopped, pin, ground, R).hopMm, 90);
});

test('a holed ball does not report its drop into the cup as a hop', () => {
 const holed = {end: {x: 0, z: 0}, total: 3, holed: true, lipped: false,
  points: [{x: 0, z: 0.5, y: 12 + R}, {x: 0, z: 0, y: 12 - 0.1}]};
 assert.equal(outcome(holed, {x: 0, z: 0}, () => 12, R).hopMm, 0);
 assert.equal(outcome(holed, {x: 0, z: 0}, () => 12, R).holed, true);
});

test('a bearing places the ball on that side of the hole and aims back at it', () => {
 // Flat greens do not care, sloped ones care about nothing else: bearing is what
 // selects uphill, downhill or sidehill.
 for (const bearing of [0, 90, 180, -90, 45]) {
  const plan = shotPlan({feet: 10, bearing});
  const rad = bearing * Math.PI / 180;
  // The ball sits back along the travel direction...
  assert.ok(Math.abs(plan.back.x + Math.sin(rad) * plan.distance) < 1e-9);
  assert.ok(Math.abs(plan.back.z + Math.cos(rad) * plan.distance) < 1e-9);
  // ...and a centred shot aims straight down it.
  assert.ok(Math.abs(plan.aimDegrees - bearing) < 1e-9);
 }
});

test('an offset still lands on the right side whichever way the putt runs', () => {
 for (const bearing of [0, 90, -137]) {
  const plan = shotPlan({feet: 10, offset: 2, bearing});
  const turned = (plan.aimDegrees - bearing) * Math.PI / 180;
  assert.ok(Math.abs(Math.tan(turned) * plan.distance - 2 * 0.0254) < 1e-9);
 }
});

test('the slope readout names a real direction and a real steepness', () => {
 const flat = {height: () => 5, pin: {x: 0, z: 0}};
 assert.equal(greenSlope(flat, flat.pin).percent, 0);
 // Falling toward +z: downhill should point that way, which is bearing 0.
 const tilted = {height: (x, z) => -z * 0.04, pin: {x: 0, z: 0}};
 const read = greenSlope(tilted, tilted.pin);
 assert.ok(Math.abs(read.percent - 4) < 0.01, `read ${read.percent}%`);
 assert.ok(Math.abs(read.downhill) < 0.5, `downhill read as ${read.downhill}`);
 // Falling toward +x is bearing 90.
 const across = {height: (x) => -x * 0.04, pin: {x: 0, z: 0}};
 assert.ok(Math.abs(greenSlope(across, across.pin).downhill - 90) < 0.5);
});

test('greenDifficulty gives a green that reads, rather than a field of bumps', () => {
 // This used to assert the slope near the cup was near-UNIFORM -- spread smaller
 // than the mean -- and that is no longer something to want. A green is shelves,
 // spines, a dish and a tier; a surface with one slope everywhere is a ramp, and
 // the whole point of putting on it is that the slope changes as you cross it.
 //
 // What still has to hold is that it changes SMOOTHLY. Break is only readable if
 // the ground moves under the ball gradually, so the test is now about the rate
 // of change rather than the amount of it: over a metre -- about three feet, a
 // short putt -- the slope may not jump by more than a per cent or two. That is
 // what separates a contoured green from a noisy one.
 let previous = 0;
 for (const difficulty of [15, 35, 70, 100]) {
  const h = generateWorld({...RANGE_SETTINGS, greenDifficulty: difficulty}).holes[0];
  const slope = (x, z) => {
   const e = 0.25;
   return Math.hypot((h.height(x + e, z) - h.height(x - e, z)) / (2 * e),
    (h.height(x, z + e) - h.height(x, z - e)) / (2 * e));
  };
  const grads = [], jumps = [];
  for (let dx = -6; dx <= 6; dx += 1) for (let dz = -6; dz <= 6; dz += 1) {
   const x = h.pin.x + dx, z = h.pin.z + dz;
   if (h.surface(x, z) !== 'green') continue;
   const here = slope(x, z);
   grads.push(here);
   jumps.push(Math.abs(slope(x + 1, z) - here), Math.abs(slope(x, z + 1) - here));
  }
  const mean = grads.reduce((a, b) => a + b, 0) / grads.length;
  assert.ok(mean > 0.002, `difficulty ${difficulty} produced no slope at all`);
  // The knob has to mean something: every step up is a steeper green.
  assert.ok(mean > previous * 1.25,
   `difficulty ${difficulty} averages ${(mean * 100).toFixed(2)}% against ${(previous * 100).toFixed(2)}% below it`);
  previous = mean;
  // Smooth, not noisy. A metre of green may not change the slope under the ball
  // by more than about a twentieth of a gradient.
  assert.ok(Math.max(...jumps) < 0.05,
   `difficulty ${difficulty} jumps ${(Math.max(...jumps) * 100).toFixed(2)}% of slope in one metre`);
 }
});

test('the envelope sweep finds the firmest putt that still drops', () => {
 // Driven with a stub so the search itself is what is under test: everything
 // finishing up to 6 ft past holes, nothing beyond.
 const rows = envelope(({past}) => past <= 6, {offsets: [0, 1]});
 for (const row of rows) assert.ok(Math.abs(row.limitFeet - 6) < 0.1, `found ${row.limitFeet}`);
 // A line that never drops reports zero rather than guessing.
 assert.deepEqual(envelope(() => false, {offsets: [2]}), [{offset: 2, limitFeet: 0}]);
});

test('a ball can be started in the air, which is how an approach is put on a green', () => {
 const flat = {height: () => 0, surface: () => 'green', pin: {x: 9e9, z: 9e9},
  trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}};
 const turf = turfConfig({stimp: 10});
 const dropped = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, vla: -45, spin: 6000,
  spinAxis: 0, speed: 25, height: 12}, flat, {turf});
 assert.ok(dropped.carry > 5, 'it has to fly before it lands');
 assert.ok(dropped.points.some(p => p.y > 5), 'and it has to have been up there');
});

test('steeper and spinnier means less rollout, which is the whole test', () => {
 const flat = {height: () => 0, surface: () => 'green', pin: {x: 9e9, z: 9e9},
  trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}};
 const turf = turfConfig({stimp: 10});
 const run = (descent, spin) => {
  const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, vla: -descent, spin,
   spinAxis: 0, speed: 25, height: 12}, flat, {turf});
  return dropOutcome(r, () => 0, R).rolloutFeet;
 };
 for (const spin of [0, 6000]) {
  assert.ok(run(55, spin) < run(45, spin), `steeper should run less at ${spin} rpm`);
  assert.ok(run(45, spin) < run(35, spin), `steeper should run less at ${spin} rpm`);
 }
 for (const descent of [35, 45, 55]) assert.ok(run(descent, 9000) < run(descent, 0));
 // Enough spin off a steep descent walks the ball back behind its pitch mark, and
 // reporting that as a positive number would hide the check entirely.
 assert.ok(run(55, 9000) < 0, `steep and spinny should zip back, got ${run(55, 9000)} ft`);
});

test('jitter is seeded, bounded and centred', () => {
 const a = jitterStream('SEED'), b = jitterStream('SEED'), c = jitterStream('OTHER');
 const first = Array.from({length: 200}, a), second = Array.from({length: 200}, b);
 assert.deepEqual(first, second, 'the same seed has to give the same group');
 assert.notDeepEqual(first, Array.from({length: 200}, c));
 assert.ok(first.every(v => v >= -3 && v <= 3), 'one freak sample must not throw a ball off the green');
 const mean = first.reduce((x, y) => x + y, 0) / first.length;
 assert.ok(Math.abs(mean) < 0.25, `misses should cluster around the intention, mean was ${mean.toFixed(3)}`);
 assert.ok(first.some(v => Math.abs(v) > 1), 'and it has to actually vary');
});

test('group statistics describe the group, not the last ball in it', () => {
 const pin = {x: 0, z: 0};
 const at = (d, holed = false) => ({end: {x: 0, z: d}, holed});
 const stats = groupStats([at(0, true), at(0, true), at(0.3048), at(0.6096), at(3.048)], pin);
 assert.equal(stats.shots, 5);
 assert.equal(stats.holed, 2);
 assert.equal(stats.holedPercent, 40);
 assert.equal(stats.medianFeet, 1);
 assert.equal(stats.worstFeet, 10);
 assert.equal(groupStats([], pin).shots, 0, 'an empty group must not divide by zero');
});
