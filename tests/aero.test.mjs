// The air (src/aero.js): drag, lift, spin decay, density, wind. The fitted
// numbers are held to published flights by tools/ball-bench.mjs; this file
// holds the rules, and a few public flights that must not drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import {flyBall, coefficients, airDensity, airViscosity, windAt, spinDecay, makeAir, airAcceleration, AERO, MPH, YARD, G} from '../src/aero.js';
import {simulateShot} from '../src/physics.js';
import {NORMALISED, DRIVER_CHART, TOUR, USGA_EXAMPLE} from '../tools/flight-targets.mjs';

const fly = (mph, vla, spin, o = {}, axis = 0) => flyBall({speed: mph * MPH, vla, spin, spinAxis: axis}, {temperature: 25, ...o});

test('no spin, no lift; more spin, more lift, up to a ceiling', () => {
 assert.equal(coefficients(60, 0).cl, 0);
 let last = 0;
 for (const rpm of [500, 1500, 3000, 6000, 10000]) { const cl = coefficients(50, rpm * Math.PI / 30).cl; assert.ok(cl > last); last = cl; }
 assert.ok(coefficients(8, 12000 * Math.PI / 30).cl <= AERO.liftMax);
 // A ball with no spin falls well short of one with a drive's spin.
 assert.ok(fly(144, 12, 0).carry < fly(144, 12, 2600).carry * .7);
});

test('drag is lowest for a drive, rises through the irons and flattens for wedges', () => {
 const cd = (mph, rpm) => coefficients(mph * MPH, rpm * Math.PI / 30).cd;
 const drive = cd(170, 2600), iron = cd(120, 7000), wedge = cd(90, 9500);
 assert.ok(drive < iron && iron < wedge);
 assert.ok(wedge - iron < iron - drive, 'the rise slows');
 // The wind-tunnel figures for a production ball (Acushnet, US 6,913,550).
 assert.ok(Math.abs(cd(176, 3000) - .222) < .02, String(cd(176, 3000)));
 assert.ok(Math.abs(coefficients(176 * MPH, 3000 * Math.PI / 30).cl - .152) < .02);
 // A slow ball is below the dimples' critical Reynolds number and drags more.
 assert.ok(coefficients(8, 0).cd > coefficients(50, 0).cd);
});

test('air: thinner when warm and when high', () => {
 assert.ok(Math.abs(airDensity(0, 15) - 1.225) < .005);
 assert.ok(airDensity(0, 30) < airDensity(0, 10));
 assert.ok(airDensity(1500, 20) < airDensity(0, 20) * .86);
 assert.ok(airViscosity(30) > airViscosity(0));
 // A mile up, a drive carries about 6% further; 10 F warmer is worth a yard or two.
 const sea = fly(160, 11, 2600).carry, high = fly(160, 11, 2600, {altitude: 1609}).carry;
 assert.ok(high / sea > 1.035 && high / sea < 1.085, String(high / sea));
 const warm = fly(160, 11, 2600, {temperature: 30.6}).carry;
 assert.ok((warm - sea) / YARD > .5 && (warm - sea) / YARD < 4);
});

test('wind is slower near the ground and full at its reference height', () => {
 const w = [3, 0, -5];
 assert.deepEqual(windAt(w, AERO.windHeight).map(x => +x.toFixed(9)), w);
 const low = windAt(w, 1), high = windAt(w, 30);
 assert.ok(Math.abs(low[2]) < 5 && Math.abs(high[2]) > 5);
 assert.deepEqual(windAt(w, 0), windAt(w, AERO.windFloor), 'no wind singularity at the ground');
 assert.deepEqual(windAt(w, 1, [0, 0, 0], true), w, 'a uniform wind is the same at every height');
 // Still air needs no wind at all.
 assert.equal(makeAir({wind: [0, 0, 0]}).wind, null);
});

test('a headwind hurts more than a tailwind helps, and a crosswind pushes the ball downwind', () => {
 const calm = fly(130, 14.7, 6088).carry;
 const head = fly(130, 14.7, 6088, {wind: [0, 0, -20 * MPH]}), tail = fly(130, 14.7, 6088, {wind: [0, 0, 20 * MPH]});
 assert.ok(calm - head.carry > (tail.carry - calm) * 1.4);
 assert.ok(head.descent > tail.descent + 20, 'into the wind it falls much more steeply');
 // +x is the player's left, and `side` is reported positive to the RIGHT.
 const cross = fly(130, 14.7, 6088, {wind: [10 * MPH, 0, 0]});
 assert.ok(cross.side < -3 * YARD, 'a wind toward the left moves the ball left');
});

test('spin dies away in the air, faster the faster the ball', () => {
 assert.ok(spinDecay(70, 1) < spinDecay(30, 1) && spinDecay(30, 1) < 1);
 assert.equal(spinDecay(0, 1), 1);
 // About 4% a second on average (TrackMan); a drive lands with about three quarters.
 const d = fly(171, 10.4, 2545);
 assert.ok(d.spin / 2545 > .7 && d.spin / 2545 < .86);
 const w = fly(104, 23.7, 9316);
 assert.ok(w.spin / 9316 > d.spin / 2545, 'a wedge keeps more of its spin than a drive');
});

test('a tilted spin axis curves the ball, the same amount either way', () => {
 const fade = fly(113, 18, 7000, {}, 10), draw = fly(113, 18, 7000, {}, -10), straight = fly(113, 18, 7000);
 assert.ok(fade.side > 5 * YARD && draw.side < -5 * YARD);
 assert.ok(Math.abs(fade.side + draw.side) < 1e-6);
 assert.ok(Math.abs(straight.side) < 1e-9);
 assert.ok(fade.carry < straight.carry + .5);
 // A launch to the right starts right.
 assert.ok(flyBall({speed: 60, vla: 12, hla: 3, spin: 3000}).side > 5);
});

test('TrackMan\'s normalised 6 iron, calm and in wind', () => {
 for (const c of NORMALISED) {
  const at = w => flyBall({speed: c.mph * MPH, vla: c.vla, spin: c.spin}, {temperature: 25, wind: [0, 0, w * MPH], uniformWind: true});
  const calm = at(0), row = c.rows[0];
  assert.ok(Math.abs(calm.carry / YARD - row.carry) < row.carry * .02, `${c.club} carry ${(calm.carry / YARD).toFixed(1)} against ${row.carry}`);
  assert.ok(Math.abs(calm.apex / YARD - row.apex) < row.apex * .05, `${c.club} apex`);
  assert.ok(Math.abs(calm.descent - row.land) < 2, `${c.club} landing angle ${calm.descent.toFixed(1)} against ${row.land}`);
  for (const r of c.rows.slice(1)) assert.ok(Math.abs((at(r.wind).carry - calm.carry) / YARD - (r.carry - row.carry)) < 4, `${c.club} in ${r.wind} mph`);
 }
});

test('TrackMan\'s driver chart, the tour averages and the USGA\'s worked example', () => {
 const miss = DRIVER_CHART.map(([mph, vla, spin, carry]) => (fly(mph, vla, spin).carry / YARD - carry) / carry * 100);
 const mean = miss.reduce((a, b) => a + b, 0) / miss.length, typical = miss.reduce((a, b) => a + Math.abs(b), 0) / miss.length;
 assert.ok(Math.abs(mean) < 2 && typical < 2.6, `driver chart: mean ${mean.toFixed(2)}%, typical ${typical.toFixed(2)}%`);
 for (const [tour, rows] of Object.entries(TOUR)) for (const [club, mph, vla, spin, apex, land, carry] of rows) {
  const m = fly(mph, vla, spin);
  assert.ok(Math.abs(m.carry / YARD - carry) < carry * .07, `${tour} ${club} carry ${(m.carry / YARD).toFixed(0)} against ${carry}`);
  assert.ok(Math.abs(m.descent - land) < 8, `${tour} ${club} landing angle`);
 }
 const u = flyBall({speed: USGA_EXAMPLE.mph * MPH, vla: USGA_EXAMPLE.vla, spin: USGA_EXAMPLE.spin}, {temperature: USGA_EXAMPLE.tempC});
 assert.ok(Math.abs(u.carry / YARD - USGA_EXAMPLE.carry) < 9 && Math.abs(u.hang - USGA_EXAMPLE.hang) < .5, `USGA: ${(u.carry / YARD).toFixed(1)} yd in ${u.hang.toFixed(2)} s`);
});

test('every tour club peaks at about the same height, as TrackMan remarks', () => {
 const tops = TOUR.PGA.map(([, mph, vla, spin]) => fly(mph, vla, spin).apex / YARD);
 assert.ok(Math.max(...tops) - Math.min(...tops) < 9, tops.map(t => t.toFixed(0)).join(' '));
});

test('the game flies a ball exactly as flyBall does', () => {
 const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5}, trees: []};
 for (const [mph, vla, spin, axis] of [[167, 10.9, 2686, 0], [120, 16.3, 7097, 6], [60, 30, 6000, -4]]) {
  const a = flyBall({speed: mph * MPH, vla, spin, spinAxis: axis}, {temperature: 18});
  const b = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, speed: mph * MPH, vla, spin, spinAxis: axis}, flat, {});
  assert.ok(Math.abs(a.carry - b.carry) < .25, `${mph} mph: ${a.carry.toFixed(2)} against ${b.carry.toFixed(2)}`);
  assert.ok(Math.abs(a.apex - b.apex) < .05 && Math.abs(a.descent - b.descentAngle) < .5 && Math.abs(a.hang - b.hang) < .02);
  assert.ok(Math.abs(a.spin - b.landingSpin) < 30);
 }
});

test('a ball at rest in still air just falls', () => {
 const a = airAcceleration([0, 0, 0], [0, 0, 0], makeAir(), 1);
 assert.deepEqual(a, [0, -G, 0]);
});
