// The rim, checked against the mistakes it has actually made.
//
// Every assertion here is a bug that shipped. They are grouped together because
// the same handful of errors keep coming back in new clothes: a position that
// jumps, a rotation sign, a regime that keeps hold of the ball after it should
// have let go, and a measurement filter that answers a different question than
// the one asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, rollPreview, R, CUP_RADIUS} from '../src/physics.js';
import {CUP_DEPTH} from '../src/cup.js';
import {turfConfig, rollDeceleration} from '../src/turf.js';

const G = 9.80665;

const lab = turfConfig({stimp: 10});
const green = pin => ({height: () => 0, surface: () => 'green', pin,
 trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const WALL = CUP_RADIUS - R;
// Contact means the cylinder below the lip or the rim circle at and above it.
// Filtering by distance from the pin instead sweeps up the entire approach roll
// and reports the aim rather than the ride, which has produced a wrong answer
// four separate times.
const onRim = q => q.y < 0
 ? Math.abs(Math.hypot(q.x, q.z) - WALL) < 0.0008
 : Math.abs(Math.hypot(Math.hypot(q.x, q.z) - CUP_RADIUS, q.y) - R) < 0.0008;

// Struck from ten feet and asked to finish `past` feet beyond the hole.
function putt(past, offset, feet = 10, stimp = 10) {
 const lab = turfConfig({stimp});
 const d = feet * 0.3048, target = d + past * 0.3048;
 const aim = Math.atan2(offset * 0.0254, d) * 180 / Math.PI;
 let lo = 0.05, hi = 14;
 for (let i = 0; i < 26; i++) {
  const mid = (lo + hi) / 2;
  if (rollPreview(green({x: 9e9, z: 9e9}), {x: 0, z: -d}, aim, mid, {turf: lab, seconds: 40}).distance < target) lo = mid;
  else hi = mid;
 }
 return simulateShot({origin: {x: 0, z: -d}, aim, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: (lo + hi) / 2},
  green({x: 0, z: 0}), {turf: lab});
}

// Released already rolling, so it arrives at the cup at exactly this speed. A
// Stimpmeter ball is already rolling; released AT the target speed from a metre
// out it stops long before it arrives, which once made a measurement of the
// effective hole read 100 per cent narrower at slow speeds.
function arriveAt(speed, offset = 0) {
 const run = 0.30, release = Math.sqrt(speed * speed + 2 * rollDeceleration('green', lab) * run);
 return simulateShot({origin: {x: offset, z: -run}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0,
  speed: release, roll: release}, green({x: 0, z: 0}), {turf: lab});
}

const rideArc = points => {
 let arc = 0;
 for (let i = 1; i < points.length; i++) {
  let step = Math.atan2(points[i].x, points[i].z) - Math.atan2(points[i - 1].x, points[i - 1].z);
  step = ((step + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  if (Math.abs(step) < 1.2) arc += Math.abs(step);
 }
 return arc * 180 / Math.PI;
};

test('the cup has a bottom, and the ball never goes through it', () => {
 // A ball straight down the middle touches no wall, so no regime owned it and it
 // simply fell: 143 mm down, 62 mm below the floor, still accelerating.
 const floor = -CUP_DEPTH + R;
 for (const past of [0.5, 1.4, 4, 8]) {
  const low = Math.min(...putt(past, 0).points.map(q => q.y));
  assert.ok(low >= floor - 0.0015,
   `${past} ft past reached ${(low * 1000).toFixed(0)} mm, floor is ${(floor * 1000).toFixed(0)} mm`);
 }
});

test('nothing in the cup moves upward without being pushed', () => {
 // The capture animation used to restart the drop from the height of a ball
 // sitting ON the green, so a putt that had already fallen 22 mm jumped back up
 // to the turf and sank a second time. Later the same animation ran a ball 50 mm
 // upward, because it had been allowed to fall through the floor first.
 for (const [past, offset] of [[0.5, 0], [1.4, 0], [2, 1], [1, 1.75], [2, 1.6]]) {
  const p = putt(past, offset).points;
  for (let i = 1; i < p.length; i++) {
   const rise = p[i].y - p[i - 1].y, dt = p[i].t - p[i - 1].t;
   if (rise <= 0) continue;
   const allowed = 1.5 * Math.max(p[i - 1].v ?? 0, p[i].v ?? 0) * dt + 0.006;
   assert.ok(rise <= allowed,
    `${past} ft / ${offset} in rose ${(rise * 1000).toFixed(1)} mm in ${(dt * 1000).toFixed(1)} ms`);
  }
 }
});

test('the ball never occupies the turf: one rim, with no gap between the tests', () => {
 // Two separate tests -- "has the centre reached CUP_R" for the far lip and "is
 // it below the green and past CUP_R - R" for the wall -- left a wedge between
 // them that the ball flew straight through. A putt 50 mm out with its centre
 // 2 mm above the lip is 4.6 mm from the rim circle, buried in the rim, and
 // nothing engaged until 54 mm.
 for (let offset = 0; offset <= 2.4; offset += 0.3) for (const past of [0.5, 2, 5, 9, 14]) {
  for (const q of putt(past, +offset.toFixed(2)).points) {
   const rad = Math.hypot(q.x, q.z);
   if (rad >= CUP_RADIUS) continue;
   if (q.y < -0.0005) assert.ok(rad <= WALL + 0.0015,
    `centre ${(rad * 1000).toFixed(1)} mm out at ${(q.y * 1000).toFixed(0)} mm deep: inside the cup wall`);
   else assert.ok(Math.hypot(rad - CUP_RADIUS, q.y) >= R - 0.0015,
    `centre only ${(Math.hypot(rad - CUP_RADIUS, q.y) * 1000).toFixed(1)} mm from the rim circle`);
  }
 }
});

test('a ball thrown clear of the rim lands on the green, not through it', () => {
 // "Over the cup" suppresses the landing test, because the hole is the one place
 // the ground does not hold the ball up. Keeping that flag after the rim had
 // thrown the ball clear sank it through the green 86 mm out, and the wall then
 // grabbed it back to 32.6 mm: a 53 mm teleport with the camera at its closest.
 for (const [past, offset] of [[1.8, 1.675], [2, 1.6], [2.6, 1.525], [5.9, 1.05], [20, 0]]) {
  for (const q of putt(past, offset).points) {
   if (Math.hypot(q.x, q.z) > CUP_RADIUS + R)
    assert.ok(q.y > -0.002,
     `${past} ft / ${offset} in was ${(q.y * 1000).toFixed(0)} mm below the green while clear of the hole`);
  }
 }
});

test('the rim costs the ball exactly what the green costs it', () => {
 // The rim is cut turf. The liner sits at least 25.4 mm down and a lipping ball
 // has by definition fallen less than its own radius, so the surface it runs on
 // is always turf -- and turf's rolling resistance is a thing we measure rather
 // than choose. A Stimpmeter gives mu = a/g directly, 0.056 at Stimp 10.
 //
 // What that replaced was a pair of invented constants, 7 rad/s^2 on the wall and
 // 6 on the lip, with no source. They let a ball orbit two and a half times.
 //
 // The consequence is the thing to hold: resistance is mu times the LOAD, and
 // inside the cup the load is not the ball's weight but the press of going round,
 // rho theta'^2, which is several g. So drag on a ride grows as the square of how
 // fast it circles, and a faster green -- lower mu -- must hold a longer ride.
 // Nothing about that was arranged; it follows from where the coefficient comes
 // from, and if it ever stops being true the anchor has been cut.
 const longest = stimp => {
  let best = 0;
  for (let offset = 0.5; offset <= 2.3; offset += 0.1)
   for (let past = 0.4; past <= 8; past += 0.4) {
    const r = putt(+past.toFixed(1), +offset.toFixed(2), 10, stimp);
    if (r.holed) continue;
    best = Math.max(best, rideArc(r.points.filter(onRim)));
   }
  return best;
 };
 const slow = longest(8), quick = longest(13);
 assert.ok(quick > slow * 1.2,
  `a Stimp 13 green held ${quick.toFixed(0)} degrees against Stimp 8's ${slow.toFixed(0)}: the rim is not reading the green`);
 // And the coefficient really is the green's, not a number near it.
 for (const stimp of [8, 10, 13])
  assert.ok(Math.abs(rollDeceleration('green', turfConfig({stimp})) / G - [0.0700, 0.0560, 0.0431][[8, 10, 13].indexOf(stimp)]) < 0.0005,
   `Stimp ${stimp} rolling-resistance coefficient drifted`);
});

test('a ball rolling forward climbs the wall, so long rim rides come back out', () => {
 // Spin about the outward normal is -v/R for a ball rolling forward: put +v/R
 // into the ground rolling constraint and the contact point moves at 2v rather
 // than standing still. In
 //     u' = -5g/7r - (2/7) theta' w
 // that sign decides everything. Right, and the spin term pushes the ball UP the
 // wall, the way topspin climbs a wall, and it circles and comes back out.
 // Wrong, and it merely adds to gravity: every ball that reached the wall dived
 // to the bottom of the cup and none ever came out.
 const rides = [[5.9, 1.05], [1.8, 1.675], [2, 1.6], [2.6, 1.525]].map(([past, offset]) => {
  const r = putt(past, offset), on = r.points.filter(onRim);
  return {arc: rideArc(on), holed: r.holed, on, label: `${past}/${offset}`};
 });
 assert.ok(rides.every(r => !r.holed), 'these lines are lip outs, not makes');
 assert.ok(rides.every(r => r.arc > 80), rides.map(r => `${r.label}:${r.arc.toFixed(0)}`).join(' '));
 // A full lap is the limit on a Stimp 10 green, and it should stay the limit.
 // Before the rim was given the green's resistance this reached two and a half
 // laps, which is not a thing that happens; much below a lap and the famous
 // 360-degree lip out would have stopped being possible at all.
 const longest = Math.max(...rides.map(r => r.arc));
 assert.ok(longest > 330 && longest < 480, `the longest ride is ${longest.toFixed(0)} degrees`);
 // It rides on top of the hole rather than sinking into it, which is what makes
 // it something to watch. Centre above the lip means the top half stays in view.
 for (const r of rides)
  assert.ok(Math.min(...r.on.map(q => q.y)) > -R,
   `${r.label} sank to ${(Math.min(...r.on.map(q => q.y)) * 1000).toFixed(0)} mm: out of sight`);
 // And it does it without inventing energy: 7/10 v^2 for a rolling ball against
 // g h. A few per cent is integration noise over several hundred steps.
 for (const r of rides) {
  const e = r.on.map(q => 0.7 * q.v * q.v + 9.80665 * q.y);
  assert.ok(Math.max(...e) <= e[0] + Math.abs(e[0]) * 0.06,
   `${r.label} gained ${(((Math.max(...e) - e[0]) / Math.abs(e[0])) * 100).toFixed(1)}% energy during the ride`);
  assert.ok(r.on[r.on.length - 1].v < r.on[0].v, `${r.label}: a ride should cost the ball speed`);
 }
});

test('a ball goes round the cup one way, and never turns back on itself', () => {
 // The fourth time a rotation sign has been wrong here, and the first that only
 // showed on screen. `tangential` is measured along (-u_z, u_x), which is the
 // OPPOSITE of the direction theta increases in: position is rho(sin, cos), so
 // dP/dtheta points along (cos, -sin). The edge handoff negated it and the wall
 // handoff, sitting three lines away, did not -- so a ball rode the lip one way
 // and reversed the instant it took the wall, running round the cup against its
 // own direction of travel.
 //
 // Flipping rate and spin together leaves their product alone, and that product
 // is what appears in u' = -5g/7r - (2/7) theta' w, so every other measurement
 // was unchanged: it still rimmed out, still climbed, still holed the same
 // putts. Only the direction was wrong, and only a person watching could see it.
 // Hence this test, which is the one thing the other eight could not catch.
 const sweep = [];
 for (let offset = 0; offset <= 2.5; offset += 0.25)
  for (let past = 0.4; past <= 12; past += 0.4) sweep.push([+past.toFixed(1), +offset.toFixed(2)]);
 let ridden = 0;
 for (const [past, offset] of sweep) {
  const on = putt(past, offset).points.filter(onRim);
  if (on.length < 4) continue;
  const steps = [];
  for (let i = 1; i < on.length; i++) {
   let d = Math.atan2(on[i].x, on[i].z) - Math.atan2(on[i - 1].x, on[i - 1].z);
   d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
   if (Math.abs(d) < 1.2) steps.push(d);
  }
  if (steps.length < 4) continue;
  ridden++;
  // The sense the ride starts in, then nothing of substance against it. A few
  // thousandths of a radian is the integrator settling onto the surface; a
  // reversal is a large, sustained step the other way.
  const sense = Math.sign(steps.slice(0, 4).reduce((a, b) => a + b, 0)) || 1;
  const against = steps.filter(d => Math.sign(d) !== sense && Math.abs(d) > 0.01);
  assert.equal(against.length, 0,
   `${past} ft / ${offset} in reversed ${against.length} times, worst ${(Math.max(...against.map(Math.abs), 0) * 180 / Math.PI).toFixed(1)} degrees`);
 }
 assert.ok(ridden > 40, `only ${ridden} of these lines reached the rim at all`);
});

test('every ball the hole touches is reported as touched', () => {
 // Setting the flag only on the way back out over the rim missed every ball that
 // was flung off the edge instead, which then read as an untouched putt that
 // happened to stop somewhere strange.
 for (const [past, offset] of [[1.8, 1.675], [2, 1.6], [13.8, 0.875], [12.2, 0.625]]) {
  const r = putt(past, offset);
  assert.ok(!r.holed, `${past}/${offset} should be a miss`);
  assert.ok(r.points.some(onRim), `${past}/${offset} should reach the rim at all`);
  assert.ok(r.lipped, `${past}/${offset} touched the rim but was not reported as lipped`);
 }
});

test('the hole gets harder to hit as the ball arrives faster', () => {
 // Hurrion & Sheppard measured the effective hole 4 per cent smaller at 0.23 m/s
 // and 25 per cent smaller at 0.65 m/s on a Stimp 10 green. The widest make and
 // the first miss bracket that: near the boundary a ball can ride round and drop
 // where a slightly straighter one rides round and escapes, so it is not a clean
 // edge and asserting one would be asserting a fiction.
 const band = speed => {
  let widest = -1, firstMiss = -1;
  for (let off = 0; off <= CUP_RADIUS + R; off += 0.0005) {
   if (arriveAt(speed, off).holed) widest = off;
   else if (firstMiss < 0) firstMiss = off;
  }
  return {widest, firstMiss};
 };
 const slow = band(0.23), medium = band(0.65);
 assert.ok(slow.firstMiss > CUP_RADIUS * 0.92,
  `a 0.23 m/s ball should use nearly the whole hole, but missed at ${(slow.firstMiss * 1000).toFixed(1)} mm`);
 assert.ok(medium.firstMiss < slow.firstMiss, 'arriving faster has to be harder');
 const narrowed = 1 - medium.firstMiss / CUP_RADIUS;
 assert.ok(narrowed > 0.15 && narrowed < 0.45,
  `0.65 m/s narrowed the hole ${(narrowed * 100).toFixed(1)} per cent; measured is 25`);
 assert.ok(band(1.5).widest < medium.widest, 'faster still has to be harder still');
});

test('dead centre, the cup catches about what Penner says it catches', () => {
 let holes = 0.2, misses = 6;
 for (let i = 0; i < 34; i++) {
  const mid = (holes + misses) / 2;
  if (arriveAt(mid).holed) holes = mid; else misses = mid;
 }
 // 1.63 m/s is capture by every mechanism together. This model is generous by
 // about 8 per cent, and honestly so: its rim is a perfectly sharp, perfectly
 // elastic edge, where a real lip is turf over a liner set an inch down and
 // takes something off the ball. Asserted as a band so it cannot drift quietly.
 assert.ok(holes > 1.5 && holes < 1.85,
  `dead centre capture ${holes.toFixed(3)} m/s against Penner's 1.63`);
});

test('the capture envelope only ever shrinks as the line moves off centre', () => {
 // It did not. An inch off line used to hole out to 2.8 ft past while an inch
 // and a half holed to 5.4, because the wedge in the rim tests let some lines
 // through the rim material untouched.
 //
 // Scanned rather than bisected: rim rides make the set of speeds that hole
 // genuinely patchy, and bisection on a patchy predicate returns whichever edge
 // it happened to walk into.
 const reach = offset => {
  let best = 0;
  for (let past = 0.1; past <= 16; past += 0.1) if (putt(+past.toFixed(1), offset).holed) best = past;
  return best;
 };
 const envelope = [0, 0.5, 1, 1.5, 2].map(reach);
 for (let i = 1; i < envelope.length; i++)
  assert.ok(envelope[i] <= envelope[i - 1] + 1e-9,
   `the envelope went back up: ${envelope.map(e => e.toFixed(1)).join(' ')}`);
 assert.ok(envelope[0] > 8 && envelope[0] < 11,
  `dead centre holes out to ${envelope[0].toFixed(1)} ft past`);
});
