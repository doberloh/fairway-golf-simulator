import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCameraFlight, FLIGHT_MIN, FLIGHT_MAX, FLIGHT_FLOOR} from '../src/camera-tours.js';

// A pose is an eye and a point it is looking at, which is exactly what the
// renderer carries in `camera.position` and `look`.
const pose = (ex, ey, ez, lx = 0, ly = 0, lz = 0) =>
 ({eye: {x: ex, y: ey, z: ez}, look: {x: lx, y: ly, z: lz}});
const flat = {height: () => 0};
// A ridge across the middle of the route, which is the case the straight line
// between two low poses walks directly through.
const ridge = (top = 40, at = 0, width = 60) =>
 ({height: (x, z) => top * Math.exp(-((z - at) ** 2) / (2 * width ** 2))});
const walk = (f, steps = 160) =>
 Array.from({length: steps + 1}, (_, i) => f.pose(f.duration * i / steps));

test('a flight starts and ends exactly on the poses it was given', () => {
 const from = pose(0, 60, -300, 0, 0, 0), to = pose(12, 1.7, 40, 12, .7, 130);
 const f = makeCameraFlight(from, to, flat);
 const a = f.pose(0), b = f.pose(f.duration);
 for (const [axis, want] of [['x', from.eye.x], ['y', from.eye.y], ['z', from.eye.z]])
  assert.ok(Math.abs(a.eye[axis] - want) < 1e-6, `start ${axis} was ${a.eye[axis]}, wanted ${want}`);
 for (const [axis, want] of [['x', to.eye.x], ['y', to.eye.y], ['z', to.eye.z]])
  assert.ok(Math.abs(b.eye[axis] - want) < 1e-6, `end ${axis} was ${b.eye[axis]}, wanted ${want}`);
 // The look point has to arrive too, or the camera lands aimed somewhere else
 // and the damping snaps it round after the flight hands back.
 assert.ok(Math.abs(b.look.z - to.look.z) < 1e-6, `look ended at ${b.look.z}`);
 assert.ok(b.done, 'a flight at its full duration reports done');
});

test('a flight clears a ridge instead of driving through it', () => {
 // Both ends sit low and the ground between them stands 40 m up: on a straight
 // line the camera would be twenty-odd metres underground at the crest.
 const world = ridge(40);
 const f = makeCameraFlight(pose(0, 3, -260, 0, 0, 0), pose(0, 3, 260, 0, 0, 0), world);
 let worst = Infinity, at = 0;
 for (const q of walk(f)) {
  const above = q.eye.y - world.height(q.eye.x, q.eye.z);
  if (above < worst) {worst = above; at = q.eye.z;}
 }
 // Not the full canopy clearance -- the taper at each end deliberately gives
 // that up so the flight can start and finish on a real player camera. What
 // must hold is that it never goes into the hill.
 assert.ok(worst > 0, `flight reached ${worst.toFixed(1)} m above ground at z=${at.toFixed(0)}`);
});

test('the rise has no corner in it', () => {
 // The flyover learned this one: clamping height per sample clears the ground
 // and still looks wrong, because the path kinks wherever terrain crosses it.
 const world = ridge(55, 0, 40);
 const f = makeCameraFlight(pose(0, 4, -300, 0, 0, 0), pose(0, 4, 300, 0, 0, 0), world);
 const ys = walk(f, 200).map(q => q.eye.y);
 // Second difference, as a fraction of the whole climb: a smooth arc keeps this
 // tiny, a kink spikes it. An unsmoothed max() profile fails this.
 const climb = Math.max(...ys) - Math.min(...ys);
 let worst = 0;
 for (let i = 1; i < ys.length - 1; i++)
  worst = Math.max(worst, Math.abs(ys[i - 1] - 2 * ys[i] + ys[i + 1]) / climb);
 assert.ok(worst < .02, `worst kink was ${(worst * 100).toFixed(2)}% of the climb`);
});

test('a flight eases in and out rather than starting at full speed', () => {
 const f = makeCameraFlight(pose(0, 20, -200, 0, 0, 0), pose(0, 20, 200, 0, 0, 0), flat);
 const step = f.duration / 100;
 const speed = t => Math.abs(f.pose(t + step).eye.z - f.pose(t).eye.z) / step;
 const mid = speed(f.duration / 2);
 assert.ok(speed(0) < mid * .15, `left at ${speed(0).toFixed(1)} against ${mid.toFixed(1)} m/s at the middle`);
 assert.ok(speed(f.duration - step) < mid * .15, 'arrives at rest');
});

test('duration stays inside its bounds and grows with the distance', () => {
 const short = makeCameraFlight(pose(0, 2, 0), pose(0, 2, 30), flat);
 const long = makeCameraFlight(pose(0, 2, 0), pose(0, 2, 1400), flat);
 assert.ok(short.duration >= FLIGHT_MIN, `short flight ran ${short.duration}s`);
 assert.ok(long.duration <= FLIGHT_MAX, `long flight ran ${long.duration}s`);
 assert.ok(long.duration > short.duration, 'a longer move takes longer');
});

test('a short hop is left to the damping, not flown', () => {
 // The renderer refuses anything under FLIGHT_FLOOR. Pinned here because the
 // number is what keeps an aim nudge -- setCamera runs on every arrow press --
 // from rebuilding a path forty samples long, sixty times a second.
 assert.ok(FLIGHT_FLOOR >= 15 && FLIGHT_FLOOR <= 40, `FLIGHT_FLOOR is ${FLIGHT_FLOOR}`);
});

test('a flight over flat ground between two low poses stays low', () => {
 // The lift is scaled by the distance, so a move across a green must not climb
 // the full canopy clearance on its way.
 const f = makeCameraFlight(pose(0, 1.7, 0), pose(0, 1.7, 40), flat);
 const top = Math.max(...walk(f).map(q => q.eye.y));
 assert.ok(top < 8, `a 40 m hop climbed to ${top.toFixed(1)} m`);
});

test('a flight clears the trees standing under it, not just the dirt', () => {
 // A belt of full-height redwoods across flat ground between two low poses. On
 // ground clearance alone the camera flies straight through the canopy, which is
 // the failure the hole flyover was measured against once already.
 const trees = [];
 for (let z = -60; z <= 60; z += 12)
  for (let x = -24; x <= 24; x += 12) trees.push({x, z, y: 0, h: 26, r: 4});
 const world = {height: () => 0, trees};
 const f = makeCameraFlight(pose(0, 2, -240, 0, 0, 0), pose(0, 2, 240, 0, 0, 0), world);
 const top = t => Math.max(0, ...trees
  .filter(t2 => Math.hypot(t.eye.x - t2.x, t.eye.z - t2.z) < t2.r * 1.9 + 4)
  .map(t2 => t2.y + t2.h * 1.18));
 for (const q of walk(f)) {
  const canopy = top(q);
  if (canopy > 0) assert.ok(q.eye.y > canopy,
   `flew at ${q.eye.y.toFixed(1)} m through canopy at ${canopy.toFixed(1)} m (z=${q.eye.z.toFixed(0)})`);
 }
});

test('trees nowhere near the route do not lift the flight', () => {
 // The filter is a bounding box around the route. A forest on the far side of
 // the property must not be what decides how high this flight goes.
 const trees = Array.from({length: 400}, (_, i) => ({x: 900 + i, z: 900, y: 0, h: 29, r: 4}));
 const near = makeCameraFlight(pose(0, 1.7, 0), pose(0, 1.7, 40), {height: () => 0, trees});
 const bare = makeCameraFlight(pose(0, 1.7, 0), pose(0, 1.7, 40), flat);
 const top = f => Math.max(...walk(f).map(q => q.eye.y));
 assert.ok(Math.abs(top(near) - top(bare)) < 1e-9,
  `distant trees changed the path: ${top(near).toFixed(2)} against ${top(bare).toFixed(2)}`);
});
