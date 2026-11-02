import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, PIN_FLAGS, pinBandOf, choosePin} from '../src/course.js';
import {holeNames} from '../src/hole-names.js';
import {crestSvg, monogram} from '../src/crest.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// PEOPLE'S TOUCHES THAT MOVE NOTHING GENERATED (architect-courses, phase 2):
// hole names and the crest, and flags coloured by where the cup is cut (an
// Architect course's founding went with the designer). None of it is in the world, so
// none of it is fingerprinted; these pin what it says.

const holes = (s, n) => Array.from({length: n}, (_, i) => generateCourse(s, i));

test('every hole is named, differently, the same way every time, Home last', () => {
 for (const biome of BIOME_KEYS) {
  const s = {seed: `N-${biome}`, holes: 18, biome}, hs = holes(s, 18);
  const names = holeNames(hs, s);
  assert.equal(names.length, 18);
  assert.equal(new Set(names).size, 18, `${biome}: every name different -- ${names.join(', ')}`);
  assert.equal(names[17], 'Home');
  assert.deepEqual(holeNames(hs, s), names, 'seeded');
  for (const n of names) assert.ok(n.length >= 3 && n.length <= 18, `"${n}" fits the slab`);
 }
});

test('names hold no famous single hole\'s nickname', () => {
 const famous = /postage stamp|amen corner|road hole|hell bunker|church pews|island green/i;
 for (const biome of BIOME_KEYS) {
  const s = {seed: `F-${biome}`, holes: 18, biome};
  for (const n of holeNames(holes(s, 18), s)) assert.doesNotMatch(n, famous);
 }
});

test('the crest is an SVG of the course', () => {
 const svg = crestSvg({name: 'Copper <Hollow> & Co', settings: {biome: 'newengland', seed: 'C'}});
 assert.match(svg, /^<svg[^>]*viewBox="0 0 100 106"/);
 assert.ok(!svg.includes('<Hollow>'), 'the name is escaped');
 assert.equal(monogram('The Copper Hollow'), 'CH');
 assert.doesNotMatch(svg, /EST\./, 'no founding year (it went with Architect)');
});

test('the flag says where the cup is cut: red front, white middle, blue back', () => {
 assert.deepEqual(Object.keys(PIN_FLAGS), ['front', 'middle', 'back']);
 const s = {seed: 'FLAG', holes: 9, biome: 'heartland'};
 for (let i = 0; i < 6; i++) {
  const h = generateCourse(s, i), band = pinBandOf(h);
  // The cup's place along the green agrees with its band.
  const along = (h.pin.z - h.green.z) / (h.greenSize ?? 17);
  if (band === 'front') assert.ok(along < 0, `hole ${i + 1}: front cup at ${along.toFixed(2)}`);
  if (band === 'back') assert.ok(along > 0, `hole ${i + 1}: back cup at ${along.toFixed(2)}`);
 }
 assert.equal(pinBandOf({settings: {pinBand: 'centre'}, hole: 0}), 'middle');
});
