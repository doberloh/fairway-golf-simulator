import test from 'node:test';
import assert from 'node:assert/strict';
import {softField, fieldMean} from '../src/country.js';
import {generateWorld} from '../src/course.js';
import {validateSettings} from '../src/settings-schema.js';

// The owner, 4 November 2026: "each hole exists in sort of a bowl with a
// creased rise of land between them".

test('a soft field keeps a tilted plane and takes the point off a crease', () => {
 const plane = softField(-200, -200, 200, 200, 10, (x, z) => 2 + x * .1 - z * .05, 30);
 assert.ok(Math.abs(plane(40, -30) - (2 + 4 + 1.5)) < .05, 'a plane stays a plane away from the edges');
 const crease = softField(-200, -200, 200, 200, 10, x => -Math.abs(x), 30);
 const kink = f => f(10, 0) - 2 * f(0, 0) + f(-10, 0);
 assert.ok(Math.abs(kink(crease)) < 3, `the point is 20 m of bend, softened: ${kink(crease)}`);
 assert.ok(Math.abs(fieldMean(-100, -100, 100, 100, 20, () => 3) - 3) < 1e-9);
});

test('no hole lies in a trough: the ground beside a corridor is level with it on average', () => {
 for (const biome of ['mountains', 'pacnw', 'prairie']) {
  const w = generateWorld(validateSettings({biome, holes: 9, seed: 'COUNTRY'}));
  let on = 0, onN = 0, off = 0, offN = 0;
  for (let x = -w.halfX; x < w.halfX; x += 16) for (let z = -w.halfZ; z < w.halfZ; z += 16) {
   const d = w.nearest(x, z).d, y = w.height(x, z);
   if (d < 10) { on += y; onN++; }
   if (d > 60 && d < 100) { off += y; offN++; }
  }
  assert.ok(Math.abs(off / offN - on / onN) < 6, `${biome}: ${(off / offN - on / onN).toFixed(1)} m`);
 }
});
