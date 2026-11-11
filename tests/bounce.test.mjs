// One bounce of a spinning ball (src/bounce.js): the rules that must hold
// whatever the fitted numbers are. The numbers themselves are held to
// measurements by tools/ball-bench.mjs (tests/ball-bench.test.mjs runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import {bounce, TILT, SEVERITY} from '../src/bounce.js';
import {turfOf, FIRMNESS_NAMES} from '../src/turf.js';
import {GROUND_KINDS} from '../src/grounds.js';

const R = 0.021335, RAD = Math.PI / 180, UP = [0, 1, 0];
const row = (s, f = 'medium') => turfOf(s, {stimp: 10, greenFirmness: f, courseFirmness: f});
// A ball arriving along +z: speed m/s, degrees below horizontal, backspin rpm.
const arrive = (speed, angle, rpm) => ({v: [0, -speed * Math.sin(angle * RAD), speed * Math.cos(angle * RAD)], w: [-rpm * Math.PI / 30, 0, 0]});
const hit = (speed, angle, rpm, surface = 'green', firm = 'medium') => { const a = arrive(speed, angle, rpm); return {...bounce(a.v, a.w, UP, row(surface, firm)), a}; };
const energy = (v, w) => .5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) + .2 * R * R * (w[0] ** 2 + w[1] ** 2 + w[2] ** 2);
const backspin = w => -w[0] * 30 / Math.PI;
const SURFACES = ['green', 'fringe', 'fairway', 'tee', 'semi', 'rough', 'sand', ...GROUND_KINDS];

test('a bounce never adds energy, and never leaves into the ground', () => {
 for (const s of SURFACES) for (const f of FIRMNESS_NAMES) for (const speed of [1, 4, 10, 20, 30]) for (const angle of [5, 20, 40, 55, 80, 90]) for (const rpm of [-3000, 0, 2500, 6000, 11000]) {
  const b = hit(speed, angle, rpm, s, f);
  assert.ok(energy(b.v, b.w) <= energy(b.a.v, b.a.w) * (1 + 1e-9), `${s} ${f} ${speed} m/s ${angle} deg ${rpm} rpm gained energy`);
  assert.ok(b.v[1] >= -1e-9, `${s} ${f} left into the ground`);
  assert.ok(b.v.every(Number.isFinite) && b.w.every(Number.isFinite));
 }
});

test('a ball dropped straight down bounces straight up', () => {
 for (const s of SURFACES) {
  const b = hit(8, 90, 0, s);
  assert.ok(Math.abs(b.v[0]) < 1e-9 && Math.abs(b.v[2]) < 1e-9, s);
  assert.equal(b.tilt, 0, s);
 }
});

test('a gentle hop keeps more of its speed than a hard landing', () => {
 for (const s of ['green', 'fairway', 'rough']) {
  const slow = hit(1.5, 90, 0, s), fast = hit(20, 90, 0, s);
  assert.ok(slow.v[1] / 1.5 > fast.v[1] / 20 * 2, s);
  assert.ok(slow.e > .25 && fast.e < .16, `${s}: ${slow.e} then ${fast.e}`);
 }
});

test('the pitch mark tilts the bounce: a full shot kicks up far more than its restitution alone', () => {
 const b = hit(25, 44, 4400, 'green', 'firm');
 // Vertical speed out over vertical speed in: measured 0.25-0.32 on greens.
 const ratio = b.v[1] / (25 * Math.sin(44 * RAD));
 assert.ok(ratio > .2 && ratio < .36, String(ratio));
 assert.ok(b.tilt > 8 && b.tilt < 25);
 assert.ok(ratio > b.e * 1.5, 'the kick is more than the restitution');
});

test('the tilt dies away for a ball skimming in, so a rolling ball is not kicked into the air', () => {
 const steep = hit(10, 45, 0), skim = hit(10, 88, 0);
 assert.ok(skim.tilt < steep.tilt * .1);
 // Rolling at 5 m/s and touching down at 0.2 m/s: what comes back up is a hop
 // of a few millimetres, not a bounce.
 const b = bounce([0, -.2, 5], [5 / R, 0, 0], UP, row('green'));
 assert.ok(b.v[1] < .3, String(b.v[1]));
 assert.ok(TILT.fade > 0 && TILT.power > 0 && TILT.power <= 1);
});

test('backspin slows the ball; enough of it on a steep landing sends it back', () => {
 const none = hit(21, 52, 0), some = hit(21, 52, 6000), lots = hit(21, 56, 13000, 'green', 'soft');
 assert.ok(some.v[2] < none.v[2]);
 assert.ok(lots.v[2] < 0, 'a 13,000 rpm ball landing at 56 degrees on a soft green comes back off its first bounce');
 // And topspin runs on.
 assert.ok(hit(21, 52, -2000).v[2] > none.v[2]);
});

test('grip or skid: a soft green takes all the spin in one bite, a firm one leaves some for the next bounce', () => {
 const soft = hit(21.9, 51, 9100, 'green', 'soft'), firm = hit(21.9, 51, 9100, 'green', 'firm');
 assert.equal(soft.gripped, true);
 assert.equal(firm.gripped, false);
 assert.ok(backspin(firm.w) > 2500, `firm keeps backspin: ${backspin(firm.w)}`);
 assert.ok(backspin(soft.w) < 500, `soft does not: ${backspin(soft.w)}`);
 // The firm green sends it on faster and flatter.
 assert.ok(Math.hypot(...firm.v) > Math.hypot(...soft.v));
});

test('a firm green takes the same spin off a full shot whatever its speed and angle', () => {
 // The USGA measured 4,690 rpm off every ball: the turf tears before friction's limit.
 const lost = [[20, 35], [23, 45], [26, 50], [26, 55]].map(([v, a]) => 9000 - backspin(hit(v, a, 9000, 'green', 'firm').w));
 for (const x of lost) assert.ok(Math.abs(x - 4690) < 250, String(x));
 assert.ok(Math.max(...lost) - Math.min(...lost) < 200, 'spread ' + lost.map(Math.round));
});

test('firmness only counts when there is a pitch mark: a chip bounces much alike on medium and firm', () => {
 const gap = (speed, angle, rpm) => { const m = hit(speed, angle, rpm, 'green', 'medium'), f = hit(speed, angle, rpm, 'green', 'firm'); return Math.abs(f.v[2] - m.v[2]) / f.v[2]; };
 assert.ok(gap(24, 46, 5000) > gap(6, 30, 2500) * 1.5, `full shot ${gap(24, 46, 5000)} against chip ${gap(6, 30, 2500)}`);
 assert.ok(hit(2, 40, 0).severity < .2 && hit(22, 50, 0).severity === 1);
 assert.ok(SEVERITY.power > 0 && SEVERITY.digMax >= 1);
});

test('firmer never bounces lower or slower from the same landing', () => {
 for (const s of ['green', 'fairway']) for (const [v, a, w] of [[25, 44, 4400], [29, 36, 2000], [22, 51, 9000], [9, 30, 2500]]) {
  const [soft, med, firm] = FIRMNESS_NAMES.map(f => hit(v, a, w, s, f));
  assert.ok(soft.v[1] <= med.v[1] + 1e-9 && med.v[1] <= firm.v[1] + 1e-9, `${s} ${v} up`);
  assert.ok(Math.hypot(...soft.v) <= Math.hypot(...med.v) + 1e-9 && Math.hypot(...med.v) <= Math.hypot(...firm.v) + 1e-9, `${s} ${v} speed`);
 }
});

test('long grass swallows travel; sand swallows nearly all of it and every bit of spin', () => {
 const fairway = hit(28, 38, 2500, 'fairway'), semi = hit(28, 38, 2500, 'semi'), rough = hit(28, 38, 2500, 'rough'), sand = hit(28, 38, 2500, 'sand');
 assert.ok(fairway.v[2] > semi.v[2] && semi.v[2] > rough.v[2] && rough.v[2] > sand.v[2]);
 assert.ok(sand.v[2] < 28 * Math.cos(38 * RAD) * .25);
 assert.deepEqual(sand.w, [0, 0, 0]);
 assert.deepEqual(hit(20, 45, 6000, 'waste').w, [0, 0, 0]);
});

test('a cart path is hard: no pitch mark, and most of the speed comes back', () => {
 const b = hit(20, 45, 3000, 'path');
 assert.equal(b.tilt, 0);
 assert.ok(b.v[1] > 20 * Math.sin(45 * RAD) * .6);
 assert.ok(hit(20, 45, 3000, 'rock').v[1] > hit(20, 45, 3000, 'fairway').v[1] * 2);
});

test('side spin about the vertical does not kick the ball sideways off level ground', () => {
 const b = bounce([0, -15, 15], [-500, 300, 0], UP, row('green'));
 assert.ok(Math.abs(b.v[0]) < 1e-9);
 // Friction takes none of it: what goes is the share the pitch mark swallows
 // of ALL the ball's spin (`dig`), so a firm green, which takes no mark, keeps
 // every turn.
 assert.ok(b.w[1] > 200 && b.w[1] <= 300, 'spin about the normal is not what a bounce on a green works on');
 const firm = bounce([0, -15, 15], [-500, 300, 0], UP, row('green', 'firm'));
 assert.ok(Math.abs(firm.w[1] - 300) < 1e-6, String(firm.w[1]));
});

test('a slope turns the bounce: landing into a rise stands the ball up, onto a fall sends it on', () => {
 const l = Math.hypot(.06, 1), up = [0, 1 / l, -.06 / l], down = [0, 1 / l, .06 / l];
 const a = arrive(22, 48, 6000), r = row('green');
 const into = bounce(a.v, a.w, up, r), level = bounce(a.v, a.w, UP, r), away = bounce(a.v, a.w, down, r);
 assert.ok(into.v[2] < level.v[2] && level.v[2] < away.v[2]);
});

test('the same call gives the same bounce, and the inputs are not touched', () => {
 const a = arrive(23, 47, 6500), v = [...a.v], w = [...a.w];
 const one = bounce(a.v, a.w, UP, row('green')), two = bounce(a.v, a.w, UP, row('green'));
 assert.deepEqual(one.v, two.v); assert.deepEqual(one.w, two.w);
 assert.deepEqual(a.v, v); assert.deepEqual(a.w, w);
});
