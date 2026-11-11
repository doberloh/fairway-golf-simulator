// The hole (src/cup.js): a rigid ball meeting the green, the rim, the wall, the
// floor and the flagstick. Nothing in the model decides whether a putt drops,
// so these tests are of what comes OUT of it: the published capture limits, and
// the rules a real hole obeys. Then the same hole inside a whole shot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cupSim, rollAtCup, captureSpeed, CUP, CUP_RADIUS, BALL_RADIUS, CUP_DEPTH} from '../src/cup.js';
import {simulateShot, CUP_RADIUS as PHYSICS_CUP, R, FLAGSTICK_HOLE_R, FLAGSTICK_BASE_R} from '../src/physics.js';
import {launchForDistance} from '../src/turf.js';

const G = 9.80665;
const holmes = offset => 1.63 * (1 - (offset / CUP_RADIUS) ** 2);

test('regulation geometry', () => {
 assert.ok(Math.abs(2 * CUP_RADIUS - 4.25 * 0.0254) < 1e-12, 'a 4.25 inch hole');
 assert.ok(Math.abs(2 * BALL_RADIUS - 0.04267) < 1e-9, 'a 42.67 mm ball');
 assert.ok(Math.abs(CUP_DEPTH - 4 * 0.0254) < 1e-12, 'four inches deep');
 assert.equal(PHYSICS_CUP, CUP_RADIUS);
 assert.equal(R, BALL_RADIUS);
});

test('the fastest centred putt a hole catches is Holmes\'s, give or take the rim', () => {
 // 1.31 m/s by free fall alone, 1.63 with the far rim and no bounce, up to
 // 1.97 with a lively rim (Holmes 1991); Cal Poly holed every centred putt at
 // 8 ft past and almost none at 9-12 ft past (about 1.6-1.8 m/s).
 const v = captureSpeed(0);
 assert.ok(v > 1.5 && v < 1.9, String(v));
 assert.ok(rollAtCup(1.2, 0).holed && rollAtCup(.3, 0).holed);
 assert.ok(!rollAtCup(2.6, 0).holed, 'a putt going 20 ft past does not drop');
});

test('the hole gets smaller as the putt gets faster, on Holmes and Penner\'s curve', () => {
 let last = Infinity;
 for (const frac of [0, .2, .4, .6, .8, .92]) {
  const off = frac * CUP_RADIUS, v = captureSpeed(off);
  assert.ok(v <= last + .03, `capture rises at ${frac}: ${v}`);
  assert.ok(Math.abs(v - holmes(off)) < .3, `at ${frac} of the radius: ${v.toFixed(2)} against ${holmes(off).toFixed(2)}`);
  last = v;
 }
 // Half the hole is left at about 1.23 m/s (Holmes's fig. 13).
 assert.ok(Math.abs(captureSpeed(CUP_RADIUS / 2) - 1.23) < .2);
});

test('a ball whose centre passes outside the rim is never holed; one inside at a crawl always is', () => {
 for (const v of [.2, .6, 1.2]) assert.ok(!rollAtCup(v, CUP_RADIUS + .003).holed, `${v} m/s`);
 for (const frac of [0, .3, .6, .85]) assert.ok(rollAtCup(.25, frac * CUP_RADIUS).holed, `${frac}`);
 // Both sides of the hole behave the same.
 for (const [v, off] of [[1.1, .03], [.7, .045], [1.5, .02]]) assert.equal(rollAtCup(v, off).holed, rollAtCup(v, -off).holed);
});

test('a holed ball falls to the floor of the cup and lies still there', () => {
 for (const [v, off] of [[.4, 0], [1.0, .02], [1.5, 0], [.6, .04]]) {
  const r = rollAtCup(v, off);
  assert.ok(r.holed && r.rest);
  const end = r.points.at(-1);
  assert.ok(Math.abs(end.y - (-CUP_DEPTH + BALL_RADIUS)) < .003, `rests ${end.y} at ${v} m/s`);
  assert.ok(Math.hypot(end.x, end.z) <= CUP_RADIUS - BALL_RADIUS + .001, 'inside the liner');
  assert.equal(end.v, 0);
  // It gets there by falling: every recorded point is at or below where it started.
  assert.ok(r.points.every(q => q.y < BALL_RADIUS + .012));
  assert.ok(r.t > .2 && r.t < 4, `settles in ${r.t} s`);
 }
});

test('lip-outs come out of the contact, some of them back toward the player', () => {
 let lips = 0, back = 0, held = 0;
 for (let off = .024; off < .054; off += .003) for (let v = .7; v < 2.1; v += .1) {
  const r = rollAtCup(v, off);
  if (r.holed) held++;
  if (r.lipped) { lips++; if (r.points.at(-1).z < 0) back++; assert.ok(!r.holed); }
 }
 assert.ok(lips > 20 && held > 10 && back >= 1, `${lips} lip-outs, ${back} horseshoes, ${held} holed`);
});

test('the hole never adds energy: nothing leaves faster than it arrived', () => {
 for (const v of [.5, 1, 1.6, 2.2, 3]) for (const off of [0, .02, .04, .05]) {
  const r = rollAtCup(v, off);
  if (!r.holed) assert.ok(r.points.at(-1).v <= v + 1e-6, `${v} at ${off}: left at ${r.points.at(-1).v}`);
 }
});

test('slope barely moves the capture speed, and uphill is the easier way in', () => {
 const up = captureSpeed(0, {slope: .05}), down = captureSpeed(0, {slope: -.05}), level = captureSpeed(0);
 assert.ok(up >= down - .02);
 assert.ok(Math.abs(up - level) < .25 && Math.abs(down - level) < .25);
});

test('the flagstick: no difference at dying pace, and it saves a centred putt far too fast for the hole', () => {
 const pin = {pin: FLAGSTICK_HOLE_R};
 for (const off of [0, .02, .04]) assert.equal(rollAtCup(.5, off, pin).holed, rollAtCup(.5, off).holed);
 assert.ok(captureSpeed(0, pin) > captureSpeed(0) + .5);
 assert.ok(rollAtCup(2.6, 0, pin).holed && rollAtCup(2.6, 0, pin).pinHits > 0);
 // A glancing blow on the stick is no help (Mase: off-centre putts at 4.5 ft
 // past, 90% holed with the stick out against 45% in).
 assert.ok(captureSpeed(.02, pin) <= captureSpeed(.02) + .1);
 // A ball must fit beside the stick or nothing is ever holed with it in.
 assert.ok(CUP_RADIUS - FLAGSTICK_HOLE_R > 2 * BALL_RADIUS);
 assert.ok(FLAGSTICK_HOLE_R < FLAGSTICK_BASE_R);
});

test('a ball dropped straight into the hole stays in; a ball slammed in can bounce out', () => {
 const drop = speed => { const p = [0, .3, 0], v = [0, -speed, 0], w = [0, 0, 0]; return cupSim({p, v, w}, {x: 0, z: 0, y: 0, gx: 0, gz: 0}, {}); };
 assert.ok(drop(1).holed);
 assert.ok(drop(3).holed);
 // 20 m/s onto the cup floor comes back up over the lip.
 const dunk = drop(20);
 assert.ok(dunk.points.some(q => q.y > BALL_RADIUS), 'a dunk at full speed bounces back out of the cup');
});

test('the constants are a hole\'s: nothing bounces like a superball, nothing is frictionless', () => {
 for (const k of ['rimE', 'wallE', 'floorE', 'pinE']) assert.ok(CUP[k] >= 0 && CUP[k] < .6, k);
 for (const k of ['rimMu', 'wallMu', 'floorMu', 'pinMu']) assert.ok(CUP[k] > 0 && CUP[k] < 1, k);
 assert.ok(CUP.dt <= 1 / 2000);
});

// ---- the same hole, inside a whole shot --------------------------------------
const green = (slope = 0, side = 0, pin = {x: 0, z: 3}) => ({height: (x, z) => slope * z + side * x, surface: () => 'green', pin,
 bounds: {x: 1e4, minZ: -1e4, maxZ: 1e4}, trees: []});
const putt = (speed, course, aim = 0, options = {}) => simulateShot({origin: {x: 0, z: 0}, aim, hla: 0, spinAxis: 0, speed, vla: 0, spin: 0}, course, {turf: {stimp: 10}, ...options});

test('a putt hit to die at the hole drops, ends in the cup and says so', () => {
 const course = green(), speed = launchForDistance(3 + .35, {stimp: 10});
 const r = putt(speed, course);
 assert.ok(r.holed && !r.lipped && r.onGreen);
 assert.ok(Math.hypot(r.end.x - 0, r.end.z - 3) < CUP_RADIUS);
 assert.ok(Math.abs(r.end.y - (-CUP_DEPTH + R)) < .004, `ball ${r.end.y}`);
 // The recorded path really goes down into the hole, point by point.
 const inHole = r.points.filter(q => q.y < 0);
 assert.ok(inHole.length > 10);
 const near = r.points.filter(q => Math.hypot(q.x, q.z - 3) < .3);
 for (let i = 1; i < near.length; i++) assert.ok(Math.hypot(near[i].x - near[i - 1].x, near[i].y - near[i - 1].y, near[i].z - near[i - 1].z) < .03, 'no jump in the path at the hole');
});

test('too hard goes over the hole; wide of it rolls past untouched; short stops short', () => {
 const course = green();
 const hard = putt(launchForDistance(3 + 9, {stimp: 10}), course);
 assert.ok(!hard.holed && hard.end.z > 4);
 const wide = putt(launchForDistance(3.4, {stimp: 10}), course, 2.2);   // 11.5 cm left of centre
 assert.ok(!wide.holed && !wide.lipped);
 const short = putt(launchForDistance(2.2, {stimp: 10}), course);
 assert.ok(!short.holed && short.end.z < 2.6);
});

test('a putt that catches the edge at pace lips out and is reported as lipped', () => {
 const course = green();
 let lipped = 0, holed = 0;
 for (let mm = 30; mm <= 52; mm += 2) {
  const aim = Math.atan2(mm / 1000, 3) * 180 / Math.PI;
  const r = putt(launchForDistance(3 + 1.6, {stimp: 10}), course, aim);
  if (r.lipped) { lipped++; assert.ok(!r.holed); assert.ok(Math.hypot(r.end.x, r.end.z - 3) > CUP_RADIUS); }
  if (r.holed) holed++;
 }
 assert.ok(lipped >= 2, `${lipped} lipped, ${holed} holed`);
});

test('holing works on a slope, both ways and across', () => {
 for (const [slope, side] of [[.03, 0], [-.03, 0], [0, .025], [.02, -.02]]) {
  const course = green(slope, side);
  // Find the line and pace by trying: a few aims, a few speeds.
  let made = 0;
  for (let aim = -6; aim <= 6 && !made; aim += .5) for (const past of [.2, .5, .9]) {
   const r = putt(launchForDistance(3 + past, {stimp: 10}) * (1 + slope * 4.5), course, aim);
   if (r.holed) { made++; assert.ok(r.end.y < course.height(0, 3) - CUP_DEPTH + R + .01); break; }
  }
  assert.ok(made, `no putt found on slope ${slope}, ${side}`);
 }
});

test('with no pin on the course there is no hole to fall in', () => {
 const course = {...green(), pin: null};
 const r = putt(launchForDistance(3.3, {stimp: 10}), course);
 assert.ok(!r.holed && r.end.z > 3);
});

test('a chip can run into the hole, and one landing short of it bounces rather than vanishing', () => {
 const course = green(0, 0, {x: 0, z: 14});
 let made = 0;
 for (let mph = 20; mph <= 32 && !made; mph += .25) {
  const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: mph * 0.44704, vla: 24, spin: 2500}, course, {turf: {stimp: 10}});
  assert.ok(Number.isFinite(r.end.z));
  if (r.holed) made++;
 }
 assert.ok(made, 'some chip between 20 and 32 mph holes out from 14 m');
});

test('a ball already rolling slowly toward the hole from a foot away drops', () => {
 const course = green(0, 0, {x: 0, z: .3});
 const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: .75, vla: 0, spin: 0, roll: .75}, course, {turf: {stimp: 10}});
 assert.ok(r.holed);
 assert.ok(r.time < 6);
});
