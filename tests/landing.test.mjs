// What a ball does after it lands: the three defects found on 2 October, each
// asserted as the behaviour that should hold rather than the number it gave.
// RESEARCH.md *After the ball lands* has the measurements.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, R, MPH, CUP_RADIUS} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';
import {customizeClubs, manualLaunch} from '../src/clubs.js';

const turf = turfConfig({});
const clubs = customizeClubs();
const ground = (surface, pin = {x: 9e9, z: 9e9}, height = () => 0) => ({height, surface: () => surface,
 pin, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const keyboard = (id, power) => ({...manualLaunch(clubs[id], power, 1), origin: {x: 0, z: 0}, aim: 0});

test('a keyboard chip is not spun harder, per mph, than the full shot', () => {
 // Spin used to fall with the square root of power, so a 10% wedge left at 337
 // rpm per mph -- three times a full swing -- and spun back behind its mark.
 for (const id of ['wedge', 'sand', 'iron9', 'iron7']) {
  const full = keyboard(id, 1), perMph = s => s.spin / (s.speed / MPH);
  for (const power of [.1, .2, .3]) {
   const chip = keyboard(id, power);
   assert.ok(perMph(chip) <= perMph(full) * 1.001,
    `${id} at ${power * 100}%: ${perMph(chip).toFixed(0)} rpm/mph against the full shot's ${perMph(full).toFixed(0)}`);
  }
 }
});

test('keyboard spin sits on Trackman: chips under 3,750 rpm, a 50 yard wedge near 6,500', () => {
 // "The Chip Shot Code": chips carrying up to 24 yards average 1,500-3,000 rpm
 // and stay under 3,750. A 54 degree wedge hit 50 yards: 6,501-7,259 rpm.
 for (const power of [.1, .2, .3]) {
  const shot = keyboard('wedge', power), r = simulateShot(shot, ground('green'), {turf});
  if (r.carry / .9144 <= 24) assert.ok(shot.spin < 3750, `a ${(r.carry / .9144).toFixed(0)} yd chip at ${shot.spin.toFixed(0)} rpm`);
 }
 const pitch = keyboard('wedge', .62), carry = simulateShot(pitch, ground('green'), {turf}).carry / .9144;
 assert.ok(carry > 40 && carry < 55, `the 62% wedge carries ${carry.toFixed(0)} yd, not a 50 yard pitch`);
 assert.ok(pitch.spin > 6000 && pitch.spin < 7600, `a ${carry.toFixed(0)} yd wedge at ${pitch.spin.toFixed(0)} rpm`);
});

test('no keyboard chip finishes behind its own pitch mark on a flat green', () => {
 for (const id of ['wedge', 'sand']) for (const power of [.1, .2, .3]) {
  const r = simulateShot(keyboard(id, power), ground('green'), {turf});
  assert.ok(r.end.z >= r.carry - .01, `${id} at ${power * 100}% finished ${((r.carry - r.end.z) * 100).toFixed(0)} cm behind its mark`);
 }
});

test('sand takes the spin: a ball landing in a bunker keeps none of it', () => {
 // A wedge used to leave its first sand contact with a third of its backspin,
 // which dragged it back up to 2 m on the faces of real bunkers.
 for (const [id, power] of [['wedge', 1], ['iron9', 1], ['sand', .4]]) {
  const r = simulateShot(keyboard(id, power), ground('sand'), {turf});
  const landed = r.points.findIndex(q => q.z > 1 && q.y <= R + .004);
  for (const q of r.points.slice(landed + 1, -1))
   assert.equal(q.w, 0, `${id}: ${q.w.toFixed(0)} rpm left in the sand`);
 }
});

test('a ball that drops into the cup falls to the bottom inside a lap', () => {
 // Rolling round the wall with unlimited grip, a slow ball dived to 10 mm off
 // the floor, climbed back up and went round 2.4 times before it was caught.
 // The wall can only grip as hard as the ball presses into it.
 const pin = {x: 0, z: 1};
 for (const [speed, offset] of [[1.2, .045], [1.6, .02], [1.2, .035], [1.2, .02]]) {
  const r = simulateShot({aim: Math.atan2(offset, 1) * 180 / Math.PI, hla: 0, vla: 0, spin: 0, spinAxis: 0,
   speed, roll: speed * .9, origin: {x: 0, z: 0}}, ground('green', pin), {turf});
  assert.ok(r.holed, `${speed} m/s, ${offset * 1000} mm off line: no longer holed`);
  let swept = 0, last = null;
  for (const q of r.points.slice(0, -26)) {
   if (Math.hypot(q.x - pin.x, q.z - pin.z) < CUP_RADIUS && q.y < -.002) {
    const a = Math.atan2(q.x - pin.x, q.z - pin.z);
    if (last !== null) { let d = a - last; d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; swept += Math.abs(d); }
    last = a;
   } else last = null;
  }
  assert.ok(swept < 2 * Math.PI, `${speed} m/s, ${offset * 1000} mm off line: ${(swept * 180 / Math.PI).toFixed(0)} degrees round the inside of the cup`);
 }
});
