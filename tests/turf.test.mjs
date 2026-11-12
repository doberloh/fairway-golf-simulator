// The turf: the three course conditions, every surface's row, and rolling.
// What the numbers ARE is tools/ball-bench.mjs's business (it holds them to
// measurements); this file holds the rules that must stay true whatever they are.
import test from 'node:test';
import assert from 'node:assert/strict';
import {turfConfig, DEFAULT_TURF, turfOf, firmnessValue, firmnessName, FIRMNESS_NAMES, CONDITION_PRESETS, presetOf, stimpWord, STIMP_RANGE,
 stimpDeceleration, rollDecelerationAt, rollOut, struckDistance, launchForDistance, releasedDistance, restitution, STIMP_RELEASE_SPEED, FOOT, ROLL} from '../src/turf.js';
import {simulateShot} from '../src/physics.js';
import {GROUND_KINDS} from '../src/grounds.js';

const SURFACES = ['green', 'fringe', 'fairway', 'tee', 'semi', 'rough', 'sand'];
const flat = s => ({height: () => 0, surface: () => s, bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5}, trees: []});

test('there are three conditions, and a default for each', () => {
 assert.deepEqual(Object.keys(DEFAULT_TURF).sort(), ['courseFirmness', 'greenFirmness', 'stimp']);
 assert.deepEqual(turfConfig(), {stimp: 10, greenFirmness: 'medium', courseFirmness: 'medium'});
 assert.deepEqual(turfConfig({stimp: 12, greenFirmness: 'Firm', courseFirmness: 'SOFT'}), {stimp: 12, greenFirmness: 'firm', courseFirmness: 'soft'});
});

test('bad conditions are refused, in words', () => {
 assert.throws(() => turfConfig({stimp: 5}), /Green speed/);
 assert.throws(() => turfConfig({stimp: 16}), /Green speed/);
 assert.throws(() => turfConfig({stimp: NaN}), /Green speed/);
 assert.throws(() => turfConfig({greenFirmness: 'spongy'}), /soft, medium or firm/);
 assert.throws(() => turfConfig({courseFirmness: NaN}), /soft, medium or firm/);
});

test('a save from before the three conditions still loads', () => {
 // One firmness (a name, or inches on the old instrument) and roll percentages.
 assert.deepEqual(turfConfig({stimp: 11, fairway: 100, semi: 100, rough: 100, firmness: 0.45}), {stimp: 11, greenFirmness: 'medium', courseFirmness: 'medium'});
 assert.equal(turfConfig({firmness: 'Burnt'}).greenFirmness, 'firm');
 assert.equal(turfConfig({firmness: 'Normal'}).greenFirmness, 'medium');
 assert.equal(turfConfig({firmness: 0.60}).greenFirmness, 'soft');
 assert.equal(turfConfig({firmness: 0.30}).greenFirmness, 'firm');
 assert.equal(turfConfig({fairway: 150}).courseFirmness, 'firm');
 assert.equal(turfConfig({fairway: 60}).courseFirmness, 'soft');
 // And the new keys win over the old ones.
 assert.equal(turfConfig({firmness: 'Soft', greenFirmness: 'firm'}).greenFirmness, 'firm');
});

test('firmness is a number between soft and firm, with a name', () => {
 assert.deepEqual(FIRMNESS_NAMES.map(firmnessValue), [-1, 0, 1]);
 assert.equal(firmnessValue(.4), .4);
 assert.equal(firmnessValue(7), 1);
 assert.equal(firmnessValue('nonsense'), 0);
 assert.deepEqual([-1, -.6, -.4, 0, .4, .6, 1].map(firmnessName), ['soft', 'soft', 'medium', 'medium', 'medium', 'firm', 'firm']);
 assert.equal(turfConfig({greenFirmness: .25}).greenFirmness, .25);
});

test('the presets are valid conditions and are recognised', () => {
 for (const [k, p] of Object.entries(CONDITION_PRESETS)) {
  const c = turfConfig(p);
  assert.equal(presetOf(c), k);
  assert.ok(p.label && p.line);
 }
 assert.equal(presetOf(DEFAULT_TURF), 'club');
 assert.equal(presetOf({stimp: 9}), null);
 assert.equal(presetOf({stimp: 8.5, greenFirmness: -.5}), null, 'a firmness between the names is the player\'s own mix');
 // An everyday course is slower and softer than a tournament one.
 assert.ok(CONDITION_PRESETS.everyday.stimp < CONDITION_PRESETS.club.stimp && CONDITION_PRESETS.club.stimp < CONDITION_PRESETS.tournament.stimp);
 assert.ok(firmnessValue(CONDITION_PRESETS.everyday.greenFirmness) < firmnessValue(CONDITION_PRESETS.tournament.greenFirmness));
});

test('every Stimp step has a word', () => {
 for (let s = STIMP_RANGE.min; s <= STIMP_RANGE.max; s += STIMP_RANGE.step) assert.ok(stimpWord(s).length > 2);
 assert.equal(stimpWord(8.5), 'everyday');
 assert.equal(stimpWord(10), 'medium');
});

test('a Stimpmeter release runs exactly the Stimp reading', () => {
 for (const stimp of [6, 8.5, 10, 12, 15]) {
  const c = {stimp};
  assert.ok(Math.abs(releasedDistance(STIMP_RELEASE_SPEED, c) / FOOT - stimp) < 1e-9, `closed form, Stimp ${stimp}`);
  const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: STIMP_RELEASE_SPEED, vla: 0, spin: 0, roll: STIMP_RELEASE_SPEED}, flat('green'), {turf: c});
  assert.ok(Math.abs(r.total / FOOT - stimp) < stimp * .01, `integrated, Stimp ${stimp}: ${(r.total / FOOT).toFixed(2)}`);
  // And the reading's own average deceleration is v^2 / 2d.
  assert.ok(Math.abs(stimpDeceleration(stimp) - STIMP_RELEASE_SPEED ** 2 / (2 * stimp * FOOT)) < 1e-12);
 }
});

test('a green\'s speed does not depend on its firmness, nor a fairway\'s on the Stimp', () => {
 const g = f => turfOf('green', {stimp: 10, greenFirmness: f, courseFirmness: 'medium'});
 assert.equal(g('soft').c, g('firm').c);
 assert.equal(turfOf('fairway', {stimp: 8}).c, turfOf('fairway', {stimp: 13}).c);
 // Green firmness moves greens and collars; course firmness moves the rest.
 const base = {stimp: 10, greenFirmness: 'medium', courseFirmness: 'medium'};
 for (const s of ['fairway', 'tee', 'semi', 'rough']) assert.equal(turfOf(s, {...base, greenFirmness: 'firm'}).eHi, turfOf(s, base).eHi, s);
 for (const s of ['green', 'fringe']) assert.equal(turfOf(s, {...base, courseFirmness: 'firm'}).eHi, turfOf(s, base).eHi, s);
 for (const s of ['sand', 'rock', 'path']) assert.deepEqual({...turfOf(s, {...base, greenFirmness: 'firm', courseFirmness: 'firm'}), firmer: null}, {...turfOf(s, base), firmer: null}, s);
});

test('rolling resistance rises with speed, and is flat below the floor', () => {
 const c = {stimp: 10};
 const a = v => rollDecelerationAt('green', c, v);
 assert.equal(a(0), a(ROLL.floor));
 assert.ok(a(1) < a(2) && a(2) < a(4));
 // The release speed is slowed harder than the Stimp average, and a crawl less.
 assert.ok(a(STIMP_RELEASE_SPEED) > stimpDeceleration(10) && a(.3) < stimpDeceleration(10));
});

test('faster greens roll further; slower surfaces roll less', () => {
 let last = 0;
 for (const stimp of [7, 9, 11, 13]) { const d = releasedDistance(2, {stimp}); assert.ok(d > last); last = d; }
 const run = s => rollOut(turfOf(s, DEFAULT_TURF), 2);
 assert.ok(run('green') > run('fringe') && run('fringe') > run('fairway') && run('fairway') > run('semi') && run('semi') > run('rough') && run('rough') > run('sand'));
 // A firm fairway runs further than a soft one.
 assert.ok(rollOut(turfOf('fairway', {courseFirmness: 'firm'}), 3) > rollOut(turfOf('fairway', {courseFirmness: 'soft'}), 3));
});

test('a struck putt: closed form and integration agree, and launch speed inverts it', () => {
 for (const stimp of [8, 10, 13]) for (const speed of [1.2, 2.4, 4, 6.5]) {
  const c = {stimp};
  const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed, vla: 0, spin: 0}, flat('green'), {turf: c});
  const closed = struckDistance(speed, c);
  assert.ok(Math.abs(closed / r.total - 1) < .03, `Stimp ${stimp}, ${speed} m/s: closed ${closed.toFixed(2)} against ${r.total.toFixed(2)}`);
  assert.ok(Math.abs(launchForDistance(closed, c) - speed) < 1e-6);
 }
 assert.equal(launchForDistance(0, DEFAULT_TURF), 0);
 // A struck putt runs shorter than a ball released rolling at the same speed:
 // it has to skid up to a roll first, and loses about two sevenths of its speed.
 const ratio = struckDistance(2.4, DEFAULT_TURF) / releasedDistance(2.4, DEFAULT_TURF);
 assert.ok(ratio > .55 && ratio < .75, String(ratio));
});

test('every surface has a complete, sane row at every firmness', () => {
 for (const s of [...SURFACES, ...GROUND_KINDS]) for (const g of FIRMNESS_NAMES) {
  const row = turfOf(s, {stimp: 10, greenFirmness: g, courseFirmness: g});
  for (const k of ['e0', 'eHi', 'tilt', 'mu', 'grab', 'dig', 'slide', 'c', 'roll', 'stimp']) assert.ok(Number.isFinite(row[k]), `${s} ${g} ${k}`);
  assert.ok(row.e0 >= row.eHi - 1e-9 && row.e0 < .9 && row.eHi >= 0, `${s} ${g} restitution`);
  assert.ok(row.mu > 0 && row.slide > 0 && row.c > 0 && row.grab >= 0 && row.grab < 1 && row.dig >= 0 && row.dig < .6);
  // Restitution falls from a gentle hop to a hard landing, never rises.
  assert.ok(restitution(row, .5) >= restitution(row, 10) - 1e-9 && restitution(row, 10) >= restitution(row, 25) - 1e-9);
 }
 // An unknown surface plays as rough rather than throwing.
 assert.equal(turfOf('lava', DEFAULT_TURF).eHi, turfOf('rough', DEFAULT_TURF).eHi);
});

test('firmer ground gives more back, holds the ball less and is dug into less', () => {
 for (const s of ['green', 'fringe', 'fairway', 'tee', 'semi', 'rough']) {
  const [soft, medium, firm] = FIRMNESS_NAMES.map(g => turfOf(s, {stimp: 10, greenFirmness: g, courseFirmness: g}));
  assert.ok(soft.eHi <= medium.eHi && medium.eHi <= firm.eHi, s + ' eHi');
  assert.ok(soft.e0 <= medium.e0 && medium.e0 <= firm.e0, s + ' e0');
  assert.ok(soft.tilt >= medium.tilt && medium.tilt >= firm.tilt, s + ' tilt');
  assert.ok(soft.mu >= medium.mu && medium.mu >= firm.mu, s + ' mu');
  assert.ok(soft.dig >= medium.dig && medium.dig >= firm.dig, s + ' dig');
  // A row below firm knows its firm self; the firm row has none.
  assert.equal(firm.firmer, null);
  assert.equal(medium.firmer.eHi, firm.eHi);
 }
 // Between the names it is a blend, not a step.
 const half = turfOf('green', {stimp: 10, greenFirmness: .5}), firm = turfOf('green', {stimp: 10, greenFirmness: 1}), med = turfOf('green', {stimp: 10, greenFirmness: 0});
 assert.ok(half.mu < med.mu && half.mu > firm.mu);
});
