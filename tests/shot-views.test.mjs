// The 2D shot views. Only the arithmetic is tested -- turning a trajectory into
// down-the-line and across-the-line numbers -- because that is the part that can
// be silently wrong. A plot with the axes swapped looks like a plot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {shotProfile, profileBounds, distanceTicks, drawPlanView} from '../src/shot-views.js';
import {offlineOf} from '../src/range.js';
import {simulateShot} from '../src/physics.js';
import {customizeClubs, manualLaunch} from '../src/clubs.js';

const YARD = 0.9144;
const at = (x, y, z, t = 0) => ({x, y, z, t});

test('the plan view and the OFFLINE column cannot disagree', () => {
 // Both reduce the same shot to the same number, so they are checked against
 // each other rather than against a hand-worked example that could share a bug.
 const origin = {x: 0, z: 0};
 for (const aim of [0, 30, -45, 90, 179]) {
  for (const end of [{x: 12, z: 40}, {x: -8, z: 120}, {x: 0, z: 90}]) {
   const [p] = shotProfile([at(end.x, 0, end.z)], origin, aim);
   assert.ok(Math.abs(p.off - offlineOf(origin, end, aim)) < 1e-9,
    `aim ${aim}: plan view says ${p.off.toFixed(4)}, the shot list says ${offlineOf(origin, end, aim).toFixed(4)}`);
  }
 }
});

test('a shot hit straight down the aim reads as straight, whatever the aim', () => {
 for (const aim of [0, 37, -37, 90, -140]) {
  const rad = aim * Math.PI / 180;
  const points = [1, 60, 180].map(d => at(Math.sin(rad) * d, 5, Math.cos(rad) * d));
  const profile = shotProfile(points, {x: 0, z: 0}, aim);
  for (const p of profile) assert.ok(Math.abs(p.off) < 1e-9, `aim ${aim} bent by ${p.off}`);
  assert.ok(Math.abs(profile[2].along - 180) < 1e-9,
   `180 m down the line read as ${profile[2].along}`);
 }
});

test('right of the aim is positive, which is what the R/L label depends on', () => {
 // Aim due north (0 deg is +z). The golfer's right is local -x (renderer.js,
 // *Which side is right*), so a ball at -x finished right of the line.
 const [right] = shotProfile([at(-9, 0, 100)], {x: 0, z: 0}, 0);
 const [left] = shotProfile([at(9, 0, 100)], {x: 0, z: 0}, 0);
 assert.ok(right.off > 0, 'a ball right of the aim must read positive');
 assert.ok(left.off < 0, 'a ball left of the aim must read negative');
});

test('height is measured as if the ground were flat at the strike', () => {
 // A hill under the middle of the flight must not dent the curve: the owner's
 // complaint of 11 October 2026 was a height plot that followed the terrain.
 const points = [at(0, 20, 0), at(0, 45, 60), at(0, 20, 120)];
 assert.deepEqual(shotProfile(points, {x: 0, z: 0}, 0).map(p => Math.round(p.height)), [0, 25, 0]);
 // A ball that finishes below the tee is drawn below the line, not on it.
 const [, , below] = shotProfile([at(0, 20, 0), at(0, 40, 60), at(0, 12, 140)], {x: 0, z: 0}, 0);
 assert.equal(below.height, -8);
});

test('the plotted apex is the APEX the shot reports, over rolling ground', () => {
 // Checked against the physics rather than a worked example: the old turf
 // reference labelled a different apex from the readout on any course.
 const ground = {height: (x, z) => 4 * Math.sin(z / 9) + 2 * Math.cos(x / 5),
  surface: () => 'fairway', pin: {x: 9e9, z: 9e9}, trees: [], homes: [],
  bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}};
 const clubs = customizeClubs();
 for (const club of ['driver', 'iron7', 'wedge']) {
  const shot = {...manualLaunch(clubs[club], 1, 1), origin: {x: 0, z: 0}, aim: 0};
  const r = simulateShot(shot, ground, {});
  const top = Math.max(...shotProfile(r.points, shot.origin, 0).map(p => p.height));
  // The profile sees every fourth step, so it can fall a hair short of the
  // physics' own running maximum, never past it.
  assert.ok(top <= r.apex + 1e-9 && r.apex - top < 0.1,
   `${club}: plot apex ${top.toFixed(2)} m, readout ${r.apex.toFixed(2)} m`);
 }
});

test('the plan view draws a ball that finished right BELOW the aim line', () => {
 // The ball runs left to right across the plot, so the golfer's right is down
 // the canvas. Until 12 October 2026 it was drawn up, and every slice looked
 // like a hook beside a label saying R.
 const calls = [];
 const ctx = new Proxy({}, {
  get: (_, k) => (...a) => calls.push([k, ...a]),
  set: () => true,
 });
 const canvas = {width: 300, height: 120, getContext: () => ctx};
 const ends = {};
 for (const [name, x] of [['right', -15], ['left', 15]]) {
  calls.length = 0;
  drawPlanView(canvas, shotProfile([at(0, 0, 0), at(x / 2, 0, 80), at(x, 0, 160)], {x: 0, z: 0}, 0));
  // The aim line is the first horizontal line drawn across the full width;
  // the finish is the white dot (`arc`).
  const aim = calls.findIndex(c => c[0] === 'lineTo' && c[1] === canvas.width - 8);
  const aimY = calls[aim][2];
  const dot = calls.find(c => c[0] === 'arc');
  ends[name] = dot[2] - aimY;
 }
 assert.ok(ends.right > 0, `a ball right of the aim plotted ${ends.right.toFixed(1)} px from the line (want below, +)`);
 assert.ok(ends.left < 0, `a ball left of the aim plotted ${ends.left.toFixed(1)} px from the line (want above, -)`);
});

test('a dead straight shot is not drawn as a slice', () => {
 // The plan view forces a symmetric cross-axis. Without the floor on the width,
 // a shot that never left the line gets a span of ~0 and any rounding wobble
 // fills the plot.
 const profile = shotProfile([at(0, 0, 0), at(0, 0, 100), at(0, 0, 200)], {x: 0, z: 0}, 0);
 const b = profileBounds(profile, {symmetric: true});
 assert.ok(b.min < -1 && b.max > 1, `straight shot got a ${(b.max - b.min).toFixed(3)} m wide plot`);
 assert.ok(Math.abs(b.min + b.max) < 1e-9, 'the aim line must sit down the middle');
});

test('an offline shot still centres the aim line', () => {
 const profile = shotProfile([at(0, 0, 0), at(25, 0, 200)], {x: 0, z: 0}, 0);
 const b = profileBounds(profile, {symmetric: true});
 assert.ok(Math.abs(b.min + b.max) < 1e-9, 'symmetric bounds must stay symmetric');
 assert.ok(b.max > 25, 'the finish has to be inside the plot');
});

test('distance ticks suit the shot instead of a fixed grid', () => {
 const spacing = m => {
  const t = distanceTicks(m);
  return t.length > 1 ? t[1] - t[0] : t[0];
 };
 // A four-yard putt once got NO gridlines at all, because the step was larger
 // than the whole shot. A bare axis reads as a broken plot, not a short one.
 assert.ok(distanceTicks(12 * 0.3048).length >= 2,
  'a 12 ft putt must still get a distance reference');
 assert.ok(spacing(12 * 0.3048) <= 4, 'and the step has to fit inside the shot');
 assert.equal(spacing(280 * YARD), 50, 'a drive needs coarse ones');
 for (const yards of [3, 12, 45, 120, 260, 500]) {
  const t = distanceTicks(yards * YARD);
  assert.ok(t.length <= 12, `${yards} yd produced ${t.length} gridlines`);
  assert.ok(t.every(v => v <= yards + 1e-9), `${yards} yd ticked past the end of the shot`);
 }
});

test('an empty trajectory produces usable bounds rather than NaN', () => {
 const b = profileBounds([]);
 assert.ok(Number.isFinite(b.min) && Number.isFinite(b.max) && b.alongMax > 0);
});
