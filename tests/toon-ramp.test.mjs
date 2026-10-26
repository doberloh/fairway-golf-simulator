// The cartoon light's toon ramp (textures.js rampSteps; the cartoon overhaul's
// lighting rounds, docs/CARTOON_OVERHAUL.md). The renderer cannot be loaded
// here, but the ramp is a pure table, and two things about it matter in play:
// it only ever gets brighter toward the sun (or a slope would shade the wrong
// way), and a landscape's shade colour changes its hue, not how dark its
// shade side is (or a tinted landscape would read darker than a grey one).
import test from 'node:test';
import assert from 'node:assert/strict';
import {rampSteps, GRADE} from '../src/textures.js';
import {BIOMES} from '../src/biomes.js';

const steps = data => Array.from({length: data.length / 4}, (_, i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
const lum = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;

test('a landscape with no shade colour has a grey ramp', () => {
 for (const s of steps(rampSteps(null))) assert.ok(s[0] === s[1] && s[1] === s[2], `grey step ${s}`);
});

test('every ramp brightens step by step toward the sun', () => {
 for (const [name, bio] of Object.entries(BIOMES)) {
  const l = steps(rampSteps(bio.light?.shade)).map(lum);
  for (let i = 1; i < l.length; i++) assert.ok(l[i] > l[i - 1], `${name}: step ${i} is no brighter than step ${i - 1}`);
 }
});

test('a shade colour leans the hue, not the brightness', () => {
 const grey = steps(rampSteps(null)).map(lum);
 for (const [name, bio] of Object.entries(BIOMES)) {
  if (!bio.light?.shade) continue;
  const tinted = steps(rampSteps(bio.light.shade));
  tinted.forEach((s, i) => assert.ok(Math.abs(lum(s) - grey[i]) <= 4, `${name}: step ${i} moved ${(lum(s) - grey[i]).toFixed(1)} in brightness`));
  // ...and it does lean: the darkest step is visibly not grey.
  const [r, g, b] = tinted[0];
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) >= 8, `${name}: the shade side is still grey`);
 }
});

test('the grade gives colour back without inverting it', () => {
 assert.ok(GRADE >= 1 && GRADE < 1.3, `GRADE ${GRADE}`);
});
