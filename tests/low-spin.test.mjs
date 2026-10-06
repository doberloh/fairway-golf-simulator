// A ball that is not spinning makes no lift (physics.js, AERO.liftTaper).
// Found on the owner's R50 session of 3 October: a 144 mph knuckleball with
// 346 rpm carried 111 yd in the model, where a ball with no lift at all carries
// 61-64. The taper must take lift to zero with spin and leave every real shot
// exactly as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, coefficients, AERO, MPH, YARD, R} from '../src/physics.js';

const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: []};
const rpm = (mph, s) => s * mph * MPH / R / (2 * Math.PI / 60);
const knuckle = spin => simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, vla: 4.7, spin, spinAxis: 0, speed: 143.7 * MPH}, flat,
 {altitude: 160, temperature: 22.5, wind: [0, 0, 0]});

test('no spin, no lift', () => {
 assert.equal(coefficients(64, 0).cl, 0, 'a ball that is not spinning was given lift');
 // And it rises from zero, rather than jumping.
 const w = s => s / R * 64;
 assert.ok(coefficients(64, w(.005)).cl < coefficients(64, w(.02)).cl, 'lift does not rise with spin below the taper');
});

test('a knuckleball flies like a ball with nothing holding it up', () => {
 // With no lift at all this launch carries 61-64 yd, whatever the drag; the R50
 // said 49. The model said 111 before the taper.
 const none = knuckle(0).carry / YARD, low = knuckle(346).carry / YARD;
 assert.ok(none > 58 && none < 68, `no spin carried ${none.toFixed(1)} yd`);
 assert.ok(low < 85, `346 rpm carried ${low.toFixed(1)} yd`);
 assert.ok(low >= none, 'a little spin must not carry less than none');
});

test('every spin a real shot has is untouched by the taper', () => {
 // At and above the taper the curve is exactly the fitted one: the lowest-spin
 // real shots seen sit at S 0.044 (a 1,500 rpm drive), a tour drive at 0.08.
 for (const s of [AERO.liftTaper, .044, .08, .2, .5]) {
  const speed = 60, w = s / R * speed;
  const fitted = Math.min(AERO.liftCap, Math.max(0, AERO.liftOffset + Math.sqrt(AERO.liftFloor + AERO.liftGain * s)));
  assert.equal(coefficients(speed, w).cl, fitted, `lift changed at S ${s}`);
 }
 assert.ok(rpm(170, AERO.liftTaper) < 1500, 'the taper reaches into the spin of a real drive');
});
