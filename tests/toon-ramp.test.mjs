// The cartoon light's toon ramp (textures.js rampSteps; the cartoon overhaul's
// lighting rounds, docs/CARTOON_OVERHAUL.md). The renderer cannot be loaded
// here, but the ramp is a pure table, and two things about it matter in play:
// it only ever gets brighter toward the sun (or a slope would shade the wrong
// way), and a landscape's shade colour changes its hue, not how dark its
// shade side is (or a tinted landscape would read darker than a grey one).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rampSteps, GRADE, turfPalette, turfGrade} from '../src/textures.js';
import {BIOMES, biomeOf} from '../src/biomes.js';

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

// The turf as the landscape paints it (24 November 2026): no lift before the
// grade, which turned the grass neon, and every turf colour taken down by how
// green it is -- never brighter or more saturated than the landscape wrote it,
// still stepping lighter from fairway to fringe to green, and straw left alone.
test('the turf is drawn no brighter than the landscape paints it, lighter toward the green', () => {
 const sat = c => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
 for (const key of Object.keys(BIOMES)) {
  const bio = biomeOf(key), p = turfPalette(bio), l = c => lum([c.r, c.g, c.b]);
  for (const s of ['semi', 'fairway', 'fringe', 'green']) {
   const own = new T.Color(bio[s]);
   assert.ok(l(p[s]) <= l(own) + 1e-9, `${key}: ${s} drawn brighter than its own colour`);
   assert.ok(sat(p[s]) <= sat(own) + 1e-9, `${key}: ${s} drawn more saturated than its own colour`);
  }
  assert.ok(l(p.green) > l(p.fringe), `${key}: the green is no lighter than its fringe`);
  assert.ok(l(p.fringe) > l(p.fairway), `${key}: the fringe is no lighter than the fairway`);
 }
 // Straw (no green in it) is not darkened at all; a lawn green is.
 const straw = new T.Color('#b99967'), lawn = new T.Color('#599743');
 assert.equal(turfGrade(straw).getHexString(), straw.getHexString());
 assert.ok(lum([turfGrade(lawn).r, turfGrade(lawn).g, turfGrade(lawn).b]) < .9 * lum([lawn.r, lawn.g, lawn.b]));
});
