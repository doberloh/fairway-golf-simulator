import test from 'node:test';
import assert from 'node:assert/strict';
import {reliefShade, reliefOverlay, RELIEF} from '../src/map-relief.js';

// RELIEF SHADING (the owner, 8 November 2026): light from the top left of the screen.
test('flat ground keeps its colour; a slope facing the light brightens, one facing away darkens', () => {
 assert.equal(reliefShade(10, 10, 10, 5), 1);
 // Rising to the right: the slope faces left, toward the light.
 assert.ok(reliefShade(0, 3, 0, 5) > 1);
 // Falling to the right: faces away.
 assert.ok(reliefShade(3, 0, 0, 5) < 1);
 // Rising toward the bottom faces the top: lit. Falling toward the bottom: shaded.
 assert.ok(reliefShade(0, 0, 3, 5) > 1);
 assert.ok(reliefShade(3, 3, 0, 5) < 1);
});

test('the shade stays within its bounds, and nonsense gives no shade', () => {
 for (const [a, b, c] of [[0, 500, 0], [500, 0, 0], [0, 0, 500], [0, -500, -500]]) {
  const m = reliefShade(a, b, c, 1);
  assert.ok(m >= RELIEF.min && m <= RELIEF.max, `${m}`);
 }
 assert.equal(reliefShade(0, NaN, 0, 5), 1);
 assert.equal(reliefShade(0, 1, 0, 0), 1);
});

test('steeper is stronger, until the bound', () => {
 const a = reliefShade(1, 0, 1, 10), b = reliefShade(2, 0, 2, 10);
 assert.ok(b < a && a < 1);
});

test('the overlay darkens with black and lightens with white', () => {
 assert.deepEqual(reliefOverlay(1), [255, 255, 255, 0]);
 const dark = reliefOverlay(.7);
 assert.deepEqual(dark.slice(0, 3), [0, 0, 0]);
 assert.ok(Math.abs(dark[3] - .3) < 1e-9);
 assert.deepEqual(reliefOverlay(1.2).slice(0, 3), [255, 255, 255]);
});
