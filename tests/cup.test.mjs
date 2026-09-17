import test from 'node:test';
import assert from 'node:assert/strict';
import {cupOutcome, captureSpeed, rimContact, crossingChord, crossingDrop, CUP_RADIUS, BALL_RADIUS, CAPTURE_SPEED, FREE_FALL_CAPTURE} from '../src/cup.js';

test('regulation geometry', () => {
 assert.ok(Math.abs(2 * CUP_RADIUS - 4.25 * 0.0254) < 1e-12, 'a 4.25 inch hole');
 assert.ok(Math.abs(2 * BALL_RADIUS - 0.04267) < 1e-9, 'a 42.67 mm ball');
 assert.ok(CUP_RADIUS > BALL_RADIUS * 2, 'the hole takes more than two balls across');
});

test('free fall alone is anchored to Penner’s 1.31 m/s, not to 1.63', () => {
 // 1.63 is capture by every mechanism together. Free fall is 1.31, and the far
 // wall and the lip make up the difference -- they are modelled separately in
 // rimContact, so letting free fall reach 1.63 by itself counted them twice.
 assert.ok(Math.abs(captureSpeed(0) - FREE_FALL_CAPTURE) < 0.001,
  `dead centre free fall ${captureSpeed(0).toFixed(4)} against ${FREE_FALL_CAPTURE}`);
 assert.ok(FREE_FALL_CAPTURE < CAPTURE_SPEED);
 assert.equal(cupOutcome(1.2, 0).kind, 'capture');
});

test('capture falls off as the square root of the offset', () => {
 // The chord the centre crosses goes as sqrt(1 - x^2), and the time it spends
 // over the hole goes with it, so the envelope has that shape and not a square.
 const at = x => captureSpeed(x * CUP_RADIUS);
 for (const x of [0.2, 0.4, 0.6, 0.8, 0.9]) {
  const root = FREE_FALL_CAPTURE * Math.sqrt(1 - x * x);
  assert.ok(Math.abs(at(x) - root) / root < 0.01, `at ${x}R expected ${root.toFixed(3)}, got ${at(x).toFixed(3)}`);
 }
 assert.ok(at(1) < 1e-9, 'and nothing is caught right on the rim');
});

test('the hole shrinks as the ball speeds up, in the direction measurement shows', () => {
 // Hurrion & Sheppard measured the effective hole on a Stimp 10 green: about 4%
 // smaller at 0.23 m/s entry and about 25% smaller at 0.65. This model gives
 // about 0% and 4%, so it narrows far too slowly at low speed even though it now
 // matches Penner's 1.63 dead centre to 3%. The two anchors pull apart and this
 // one is the loser; the gap is recorded rather than tuned away, because nothing
 // is left to tune that is not either geometric or already anchored.
 const width = v => {
  let lo = 0, hi = CUP_RADIUS;
  for (let i = 0; i < 44; i++) {const m = (lo + hi) / 2; if (cupOutcome(v, m).kind === 'capture') lo = m; else hi = m;}
  return 2 * lo;
 };
 const shrink = v => 1 - width(v) / (2 * CUP_RADIUS);
 assert.ok(shrink(0.23) < shrink(0.65), 'faster must mean smaller');
 assert.ok(shrink(0.65) < shrink(1.0));
 assert.ok(shrink(0.23) < 0.05, 'a dying putt uses nearly the whole hole');
 assert.ok(shrink(0.65) > 0.01 && shrink(0.65) < 0.30, `at 0.65 m/s the hole shrank ${(shrink(0.65) * 100).toFixed(0)}%`);
 assert.ok(width(FREE_FALL_CAPTURE * 1.3) < CUP_RADIUS, 'well past the free-fall speed only a sliver is left');
});

test('a ball whose line misses the opening is not touched at all', () => {
 assert.equal(cupOutcome(0.4, CUP_RADIUS).kind, 'miss');
 assert.equal(cupOutcome(0.4, CUP_RADIUS + 0.001).kind, 'miss');
 assert.equal(cupOutcome(4, CUP_RADIUS * 2).kind, 'miss');
});

test('the chord the ball crosses shrinks to nothing at the rim', () => {
 assert.ok(Math.abs(crossingChord(0) - 2 * CUP_RADIUS) < 1e-12);
 assert.ok(crossingChord(CUP_RADIUS * 0.5) < crossingChord(0));
 assert.equal(crossingChord(CUP_RADIUS), 0);
 assert.equal(crossingChord(CUP_RADIUS * 2), 0);
});

test('how far it falls while crossing decides everything, and falls off with speed', () => {
 const slow = crossingDrop(0.5, 0), quick = crossingDrop(2.5, 0);
 assert.ok(slow > quick, 'a slower ball is over the hole longer and falls further');
 assert.ok(quick < BALL_RADIUS, 'a ball at 2.5 m/s barely dips in');
 // A crawling ball simply drops the full depth.
 assert.equal(crossingDrop(0, 0), crossingDrop(0.001, 0));
});

test('between dropping and sailing over there is now a lip out', () => {
 const kinds = new Set();
 for (let v = 0.2; v < 4; v += 0.05) kinds.add(cupOutcome(v, CUP_RADIUS * 0.7).kind);
 assert.ok(kinds.has('capture'), 'slow enough still drops');
 assert.ok(kinds.has('lip'), 'there is a band that catches the rim');
});

test('a lip out never leaves with more energy than it arrived with', () => {
 // The contact can turn speed into height, so horizontal speed alone is not the
 // test any more -- the whole velocity is.
 for (const offset of [0.1, 0.4, 0.7, 0.9].map(f => f * CUP_RADIUS))
  for (let v = 0.3; v < 5; v += 0.05) {
   const o = cupOutcome(v, offset);
   if (o.kind !== 'lip') continue;
   const out = Math.hypot(o.speed, o.lift);
   assert.ok(out <= v + 1e-9, `offset ${offset.toFixed(3)} at ${v.toFixed(2)} left at ${out.toFixed(3)}`);
  }
});

test('a ball that clips the far side hard is thrown upward', () => {
 // The lift does not come from the falling -- there is barely any of that at
 // speed -- it comes from the tilted contact normal redirecting part of a large
 // horizontal velocity. So faster crossings hop higher.
 const hops = [2.6, 3.2, 4, 5, 6].map(v => cupOutcome(v, 0).lift);
 assert.ok(hops.every(h => h > 0), `every fast crossing should lift: ${hops.map(h => h.toFixed(3))}`);
 for (let i = 1; i < hops.length; i++) assert.ok(hops[i] > hops[i - 1], 'faster must hop higher');
 // And it is a hop, not a launch: inches, not feet.
 const peak = hops.at(-1) ** 2 / (2 * 9.80665);
 assert.ok(peak > 0.02 && peak < 0.5, `peak hop ${(peak * 1000).toFixed(0)} mm`);
});

test('the faster it crosses, the smaller the share the hole takes', () => {
 // It does not converge to untouched as quickly as intuition suggests. Even a
 // ball that dips under a millimetre still meets the edge at a glancing angle,
 // and friction on that contact costs it real speed: a quarter of it at 8 m/s.
 // That is the impulsive treatment being pessimistic about what is mostly a ride
 // over a tiny step, and it is the known soft spot in this model. It matters
 // little in play -- 4 m/s is already a wild putt -- but it is not nothing.
 const kept = [4, 6, 8, 12, 20].map(v => cupOutcome(v, 0).speed / v);
 for (let i = 1; i < kept.length; i++)
  assert.ok(kept[i] > kept[i - 1], `keeps ${kept.map(k => k.toFixed(3))}`);
 assert.ok(kept.at(-1) > 0.9, 'and it does get there eventually');
 assert.ok(cupOutcome(8, 0).drop < 0.002, 'a ball that fast hardly falls at all');
});

test('the rim turns the ball toward the side it passed on, and not at all through the middle', () => {
 assert.ok(cupOutcome(2.2, 0).turn === 0 || cupOutcome(2.2, 0).kind !== 'lip');
 const shallow = cupOutcome(2.4, CUP_RADIUS * 0.25), deep = cupOutcome(2.4, CUP_RADIUS * 0.85);
 if (shallow.kind === 'lip' && deep.kind === 'lip')
  assert.ok(deep.turn > shallow.turn, 'a line nearer the edge is turned harder');
});

test('a ball stopped dead on the lip falls in rather than perching', () => {
 // Below the rim with nothing left to carry it clear, it goes back down the hole.
 const offset = CUP_RADIUS * 0.3, boundary = captureSpeed(offset);
 assert.equal(cupOutcome(boundary - 0.001, offset).kind, 'capture');
 assert.equal(cupOutcome(boundary + 0.001, offset).kind, 'capture');
});

test('a ball riding high over the lip is never asked to climb out of anything', () => {
 // It was, once, and the cup swallowed balls at 2.8 m/s because of it.
 const hit = rimContact(3.5, 0, crossingDrop(3.5, 0));
 assert.equal(hit.inside, false, 'at 3.5 m/s the centre is still above the rim plane');
 assert.equal(cupOutcome(3.5, 0).kind, 'lip');
});

// --- the hole does not care about the slope it is cut into -----------------
//
// This is the regression guard on a cancellation that is easy to break by
// "improving" it. A hole in a sloping green has its far rim lower by chord.theta
// going downhill, which looks like it should make capture harder. But a ball
// rolling downhill is already descending at v.theta as it leaves the near rim,
// and over the crossing it falls exactly that much extra. The two terms cancel
// and the criterion has no theta in it. Add one without the other -- the natural
// mistake, since the geometry is visible and the head start is not -- and the
// capture speed picks up a ~20% slope error at 4%.

import {simulateShot} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';

const turf = turfConfig({stimp: 10});
const sloped = slope => ({
 height: (x, z) => -z * slope, surface: () => 'green', pin: {x: 0, z: 0},
 trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6},
});
const from = -1.2;
const roll = (course, speed) => simulateShot(
 {origin: {x: 0, z: from}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed}, course, {turf});

// The fastest launch that still drops, found on the upper branch: above the
// boundary nothing holes, below it everything that reaches does.
function boundaryLaunch(course) {
 // A slow putt does not miss the hole, it fails to reach it -- struck at 0.5 m/s
 // a ball runs 0.13 m against a cup 1.2 m away -- so the bracket has to be found
 // rather than assumed, then closed from above.
 let holes = null;
 for (let s = 0.6; s <= 5 && holes === null; s += 0.02) if (roll(course, s).holed) holes = s;
 if (holes === null) throw Error('no launch speed holed this putt at all');
 let misses = 5;
 for (let i = 0; i < 30; i++) {
  const mid = (holes + misses) / 2;
  if (roll(course, mid).holed) holes = mid; else misses = mid;
 }
 return holes;
}
// How fast it is going as its centre reaches the cup, with the hole moved away
// so nothing catches it first.
function arrivalSpeed(course, speed) {
 const open = {...course, pin: {x: 9e9, z: 9e9}};
 const r = roll(open, speed);
 for (let i = 1; i < r.points.length; i++) {
  const a = r.points[i - 1], b = r.points[i];
  if (a.z < 0 && b.z >= 0) return Math.hypot(b.x - a.x, b.z - a.z) / ((b.t - a.t) || 1e-9);
 }
 return 0;
}

test('the launch that holes changes a lot with slope, because the ball arrives differently', () => {
 const downhill = boundaryLaunch(sloped(0.06)), flat = boundaryLaunch(sloped(0));
 assert.ok(downhill < flat * 0.92, `downhill boundary ${downhill.toFixed(3)} vs flat ${flat.toFixed(3)}`);
});

test('but the speed it can arrive at and still be caught does not', () => {
 const arrivals = [-0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06]
  .map(slope => {const c = sloped(slope); return arrivalSpeed(c, boundaryLaunch(c));});
 const low = Math.min(...arrivals), high = Math.max(...arrivals);
 assert.ok(arrivals.every(a => a > 1.3 && a < 1.9), `arrivals ${arrivals.map(a => a.toFixed(3))}`);
 assert.ok((high - low) / low < 0.05,
  `capture speed moved ${((high - low) / low * 100).toFixed(1)}% across the slope range: ${arrivals.map(a => a.toFixed(3))}`);
});

test('cupOutcome is a function of speed and offset alone', () => {
 // If a slope term is ever added here, it has to be added as a pair or not at
 // all. This asserts the signature stays honest about that.
 assert.equal(cupOutcome.length, 2);
 assert.equal(captureSpeed.length, 1);
});
