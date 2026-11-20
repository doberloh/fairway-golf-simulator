import test from 'node:test';
import assert from 'node:assert/strict';
import {playsLike} from '../src/plays-like.js';
import {MPH, YARD} from '../src/physics.js';
import {CLUBS, manualLaunch} from '../src/clubs.js';

const launch = manualLaunch(CLUBS.iron7, 1, 1);
const D = 160 * YARD;
const yards = o => playsLike({distance: D, launch, ...o}) / YARD;

test('on level ground in still air at sea level, a shot plays its length', () => {
 assert.ok(Math.abs(yards({}) - 160) < .5, `${yards({})}`);
});

test('every condition pushes the number the way a golfer expects', () => {
 const calm = yards({});
 assert.ok(yards({rise: 30 * .3048}) > calm + 4, 'uphill plays longer');
 assert.ok(yards({rise: -30 * .3048}) < calm - 4, 'downhill plays shorter');
 assert.ok(yards({wind: [0, 0, -10 * MPH]}) > calm + 8, 'into the wind plays longer');
 assert.ok(yards({wind: [0, 0, 10 * MPH]}) < calm - 4, 'downwind plays shorter');
 assert.ok(yards({altitude: 1600}) < calm - 5, 'thin air plays shorter');
 assert.ok(yards({temperature: 5}) > calm + 1, 'cold air plays longer');
});

test('the wind is read against the line to the hole, not the hole frame', () => {
 // The same headwind with the shot turned to face it plays the same.
 const b = Math.PI / 3, into = [-Math.sin(b) * 10 * MPH, 0, -Math.cos(b) * 10 * MPH];
 assert.ok(Math.abs(playsLike({distance: D, launch, bearing: b, wind: into}) / YARD - yards({wind: [0, 0, -10 * MPH]})) < .5);
});

test('nothing sensible to say gives nothing, not a number', () => {
 assert.equal(playsLike({distance: 0, launch}), null);
 assert.equal(playsLike({distance: D, launch: manualLaunch(CLUBS.putter, 1, 1)}), null, 'a putt has no carry to play like');
 assert.equal(playsLike({distance: D}), null);
});

test('a flight stopped at its first landing (untilLanding) gives the full flight\'s carry and crossing', async () => {
 // The searches that read only the flight -- the swing meter's carry and the
 // plays-like crossing -- stop it just past touchdown since 18 November 2026,
 // to keep a computer golfer's plan steps short. Nothing they read may move.
 const {crossing} = await import('../src/plays-like.js');
 const {simulateShot} = await import('../src/physics.js');
 const open = {height: (x, z) => Math.hypot(x, z) < 2 ? 0 : -120, surface: () => 'fairway', bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5}, trees: []};
 const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []};
 let checked = 0;
 for (const club of Object.values(CLUBS).filter(c => c.vla > 2)) for (const k of [.4, .7, 1, 1.15]) for (const wind of [[0, 0, 0], [3, 0, -6], [-4, 0, 5]]) {
  const shot = {origin: {x: 0, z: 0}, aim: 0, speed: club.speed * k, vla: club.vla, hla: 0, spin: club.spin * k, spinAxis: 4};
  const full = simulateShot(shot, open, {wind}), cut = simulateShot(shot, open, {wind, untilLanding: true});
  assert.ok(cut.points.length < full.points.length, 'the cut flight is shorter');
  assert.equal(cut.carry, full.carry);
  for (const level of [-60, -25, -8, 0, 4, 12, 30]) assert.equal(crossing(cut.points, level, 0), crossing(full.points, level, 0), `${club.code} ${k} at ${level} m`);
  const fFull = simulateShot(shot, flat, {dt: 1 / 120}), fCut = simulateShot(shot, flat, {dt: 1 / 120, untilLanding: true});
  assert.equal(fCut.carry, fFull.carry);
  checked++;
 }
 assert.ok(checked > 50);
});

test('the crossing is read off the flight where the ball falls through the height', async () => {
 const {crossing} = await import('../src/plays-like.js');
 // Up to 10 m over 20 m of ground and down again, along +z.
 const pts = [0, 5, 10, 15, 20, 25, 30].map(z => ({x: 0, z, y: 10 - Math.abs(z - 15) * 10 / 15}));
 assert.equal(crossing(pts, 0, 0), null, 'never falls below where it started');
 assert.ok(Math.abs(crossing(pts, 5, 0) - 22.5) < 1e-9, 'interpolated on the way DOWN, not up');
 assert.equal(crossing(pts, 11, 0), null, 'a hole above the apex has no crossing');
 // Measured along the line to the hole: the same flight seen 60 degrees off it.
 assert.ok(Math.abs(crossing(pts, 5, Math.PI / 3) - 22.5 * Math.cos(Math.PI / 3)) < 1e-9);
});
