import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot} from '../src/physics.js';
import {rollDeceleration, turfConfig, struckDistance, launchForDistance, releaseForDistance, skidShare, SLIDE_FRICTION} from '../src/turf.js';
import {customizeClubs} from '../src/clubs.js';

const green = (slope = 0) => ({
 height: (x, z) => z * slope,
 surface: () => 'green',
 pin: {x: 9e9, z: 9e9},
 trees: [], homes: [],
 bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6},
});
const base = {origin: {x: 0, z: 0}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0};
const struck = (speed, course = green(), turf = turfConfig({stimp: 10})) =>
 simulateShot({...base, speed}, course, {turf});
const released = (speed, course = green(), turf = turfConfig({stimp: 10})) =>
 simulateShot({...base, speed, roll: speed}, course, {turf});

test('a Stimpmeter release is untouched: it was already rolling', () => {
 // This is the calibration anchor for every green in the game. A ramp delivers a
 // rolling ball, so nothing here may skid, and 1.83 m/s must still run exactly
 // ten feet on a Stimp 10 green.
 const r = released(1.83);
 assert.equal(r.skid, 0);
 assert.ok(Math.abs(r.total - 10 * 0.3048) < 0.002, `ran ${r.total.toFixed(4)} m`);
});

test('a struck putt skids roughly a seventh of its run, as measured putts do', () => {
 for (const v of [1.5, 2.5, 3.5, 5]) {
  const r = struck(v);
  const share = r.skid / r.total;
  assert.ok(share > 0.12 && share < 0.18, `${v} m/s skidded ${(share * 100).toFixed(1)}%`);
 }
});

test('the skid costs real distance against an already-rolling ball', () => {
 // THE GAP NARROWS AS THE PUTT GETS HARDER, and that is the speed law working
 // rather than the claim weakening. A released ball starts rolling at the full
 // launch speed, so most of its run sits in the penalised zone above 1.83 m/s; a
 // struck ball starts rolling at five sevenths of that and is penalised less. So
 // the harder the strike, the more the released ball gives back. Measured:
 // 0.599 at 2 m/s, 0.648 at 3, 0.753 at 4, 0.856 at 5.
 //
 // A single flat threshold cannot say that, and the old 0.62 was the flat law's
 // number. What must hold at every speed is the direction -- a struck putt goes
 // less far than a released one of the same launch speed -- and that the ratio
 // rises monotonically rather than jumping about.
 const ratios = [2, 3, 4, 5].map(v => {
  const hit = struck(v).total, rolled = released(v).total;
  assert.ok(hit < rolled, `struck ${hit.toFixed(2)} vs released ${rolled.toFixed(2)} at ${v} m/s`);
  return hit / rolled;
 });
 // At ordinary putting speed the skid still costs a third of the run.
 assert.ok(ratios[0] < 0.62, `at 2 m/s the skid only cost ${(100 - ratios[0] * 100).toFixed(0)}%`);
 for (let i = 1; i < ratios.length; i++)
  assert.ok(ratios[i] > ratios[i - 1],
   `the gap must narrow with speed, not widen: ${ratios.map(r => r.toFixed(3)).join(', ')}`);
});

test('the simulator agrees with the closed form the aim preview uses', () => {
 // The ring on screen is drawn from struckDistance; if the two drifted apart the
 // preview would quietly stop predicting where the ball stops.
 for (const stimp of [7, 10, 13]) {
  const turf = turfConfig({stimp}), decel = rollDeceleration('green', turf);
  for (const v of [1.5, 3, 4.5]) {
   const measured = struck(v, green(), turf).total, predicted = struckDistance(v, decel);
   assert.ok(Math.abs(measured - predicted) / predicted < 0.02,
    `stimp ${stimp} at ${v} m/s: simulated ${measured.toFixed(3)} vs predicted ${predicted.toFixed(3)}`);
  }
 }
});

test('launchForDistance inverts struckDistance, so power still means distance', () => {
 for (const stimp of [6, 10, 15]) {
  const decel = rollDeceleration('green', turfConfig({stimp}));
  for (const d of [1, 5, 12, 25]) {
   const v = launchForDistance(d, decel);
   assert.ok(Math.abs(struckDistance(v, decel) - d) < 1e-9);
  }
 }
});

test('distance is quadratic in launch speed up to the Stimpmeter speed, and falls away above it', () => {
 // IT IS NO LONGER QUADRATIC EVERYWHERE, and that is the one real consequence of
 // rolling resistance rising with speed. The skid still goes as v^2; the roll
 // stops doing so once the ball is moving faster than the Stimpmeter's 1.83 m/s,
 // because a faster ball meets more resistance.
 //
 // Below that it is untouched. A struck putt rolls from five sevenths of its
 // launch speed, so everything up to about 2.5 m/s stays exactly quadratic --
 // which is the whole range an ordinary putt lives in, and why the power slider
 // still feels the way it did.
 const slow = struck(1).total, twice = struck(2).total;
 assert.ok(Math.abs(twice / slow - 4) < 0.01,
  `inside the flat region, doubling gave ${(twice / slow).toFixed(3)}x, not 4x`);
 // Above it, the same doubling must fall SHORT of four times, and monotonically.
 const one = struck(2).total, two = struck(4).total;
 const ratio = two / one;
 assert.ok(ratio > 3.5 && ratio < 4,
  `above the flat region, doubling gave ${ratio.toFixed(3)}x; want between 3.5 and 4`);
});

test('a faster green is a smaller share of skid, and a shaggy one more', () => {
 const shares = [6, 10, 15].map(stimp => skidShare(rollDeceleration('green', turfConfig({stimp}))));
 assert.ok(shares[0] > shares[1] && shares[1] > shares[2], `shares ${shares.map(s => s.toFixed(3))}`);
 assert.ok(Math.abs(shares[1] - 0.15) < 0.005, 'a Stimp 10 green is the 15% the literature reports');
 // And every green stays inside the 10-20% band measured for real putts.
 for (const stimp of [8, 10, 12, 14]) {
  const s = skidShare(rollDeceleration('green', turfConfig({stimp})));
  assert.ok(s > 0.10 && s < 0.20, `stimp ${stimp} skidded ${(s * 100).toFixed(1)}%`);
 }
});

test('the putter is calibrated through the whole model, not just the rolling half', () => {
 const clubs = customizeClubs();
 const r = struck(clubs.putter.speed);
 assert.ok(Math.abs(r.total / 0.9144 - clubs.putter.carry) / clubs.putter.carry < 0.01,
  `full power ran ${(r.total / 0.9144).toFixed(2)} yd against a ${clubs.putter.carry} yd setting`);
 // A custom setting has to hold too, or the bag lies about itself.
 const short = customizeClubs({putter: 12});
 const s = struck(short.putter.speed);
 assert.ok(Math.abs(s.total / 0.9144 - 12) / 12 < 0.01, `ran ${(s.total / 0.9144).toFixed(2)} yd against 12`);
});

test('adding the skid did not disturb how much a putt breaks', () => {
 // Sliding, the ball is not held by the rolling constraint, so gravity acts on
 // it in full rather than at 5/7. The tempting conclusion is that a skidding
 // putt breaks more. It does not: the skid sheds speed about five times faster
 // than rolling, so it lasts far less time than its share of the distance, and
 // break is a time integral. Measured over a matched run the struck ball breaks
 // about 1.5% LESS. What matters is that the difference stayed small -- greens
 // that read correctly before still read correctly.
 const turf = turfConfig({stimp: 10}), decel = rollDeceleration('green', turf);
 for (const slope of [0.02, 0.05])
  for (const distance of [3, 6]) {
   const across = {
    height: (x) => x * slope, surface: () => 'green', pin: {x: 9e9, z: 9e9},
    trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6},
   };
   const hit = simulateShot({...base, speed: launchForDistance(distance, decel)}, across, {turf});
   // Must be the inverse of the CURRENT roll law. sqrt(2 a d) is the flat-law
   // answer, and using it here had the released ball covering a different
   // distance from the struck one, so the comparison stopped being like for like.
   const rollSpeed = releaseForDistance(distance, decel);
   const rolled = simulateShot({...base, speed: rollSpeed, roll: rollSpeed}, across, {turf});
   assert.ok(Math.abs(hit.end.x) > 0.05, 'a putt across a slope has to break at all');
   const difference = Math.abs(Math.abs(hit.end.x) - Math.abs(rolled.end.x)) / Math.abs(rolled.end.x);
   assert.ok(difference < 0.05,
    `on ${slope} over ${distance} m the break moved ${(difference * 100).toFixed(1)}%: struck ${hit.end.x.toFixed(3)}, rolled ${rolled.end.x.toFixed(3)}`);
   assert.ok(Math.abs(hit.end.x) < Math.abs(rolled.end.x), 'and the shorter clock means slightly less break, not more');
  }
});

test('sliding friction is bounded and longer grass grabs a sliding ball harder', () => {
 assert.ok(SLIDE_FRICTION > 0.25 && SLIDE_FRICTION < 0.8, 'inside the quoted ball-on-turf range');
 const runs = ['green', 'fairway', 'semi', 'rough'].map(s => {
  const course = {...green(), surface: () => s};
  return simulateShot({...base, speed: 4}, course).skid;
 });
 for (let i = 1; i < runs.length; i++)
  assert.ok(runs[i] < runs[i - 1], `skid did not shorten into ${['green', 'fairway', 'semi', 'rough'][i]}`);
});
