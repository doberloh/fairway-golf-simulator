import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, PIN_FLAGS, pinBandOf, choosePin} from '../src/course.js';
import {holeNames} from '../src/hole-names.js';
import {crestSvg, courseIdentity, monogram} from '../src/crest.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// PEOPLE'S TOUCHES THAT MOVE NOTHING GENERATED (architect-courses, phase 2):
// hole names and the crest for both designers, an Architect course's founding,
// and flags coloured by where the cup is cut. None of it is in the world, so
// none of it is fingerprinted; these pin what it says.

const holes = (s, n) => Array.from({length: n}, (_, i) => generateCourse(s, i));

test('every hole is named, differently, the same way every time, Home last', () => {
 for (const biome of BIOME_KEYS) for (const designer of ['classic', 'architect']) {
  const s = {seed: `N-${biome}`, holes: 18, biome, designer}, hs = holes(s, 18);
  const names = holeNames(hs, s);
  assert.equal(names.length, 18);
  assert.equal(new Set(names).size, 18, `${biome} ${designer}: every name different -- ${names.join(', ')}`);
  assert.equal(names[17], 'Home');
  assert.deepEqual(holeNames(hs, s), names, 'seeded');
  for (const n of names) assert.ok(n.length >= 3 && n.length <= 18, `"${n}" fits the slab`);
 }
});

test('a template hole is named for its template', () => {
 for (let k = 0; k < 30; k++) {
  const s = {seed: `TPL-${k}`, holes: 18, biome: 'autumn', designer: 'architect', archStyle: 'raynor'}, hs = holes(s, 18), names = holeNames(hs, s);
  const i = hs.findIndex((h, j) => h.design.template === 'redan' && j !== 17);
  if (i >= 0) { assert.match(names[i], /Redan/); return; }
 }
 assert.fail('no Redan found in thirty Raynor courses');
});

test('names hold no famous single hole\'s nickname', () => {
 const famous = /postage stamp|amen corner|road hole|hell bunker|church pews|island green/i;
 for (const biome of BIOME_KEYS) {
  const s = {seed: `F-${biome}`, holes: 18, biome, designer: 'architect'};
  for (const n of holeNames(holes(s, 18), s)) assert.doesNotMatch(n, famous);
 }
});

test('the crest is an SVG of the course, and only Architect knows its founding', () => {
 const svg = crestSvg({name: 'Copper <Hollow> & Co', settings: {biome: 'autumn', seed: 'C'}});
 assert.match(svg, /^<svg[^>]*viewBox="0 0 100 106"/);
 assert.ok(!svg.includes('<Hollow>'), 'the name is escaped');
 assert.equal(monogram('The Copper Hollow'), 'CH');
 assert.deepEqual(courseIdentity({seed: 'X'}), {year: null, architect: null}, 'Classic has no founding');
 for (const [age, lo, hi] of [['new', 2005, 2024], ['mature', 1955, 1995], ['old', 1895, 1932], ['restored', 1898, 1930]]) {
  const id = courseIdentity({designer: 'architect', seed: `Y-${age}`, biome: 'links', archAge: age});
  assert.ok(id.year >= lo && id.year <= hi, `${age}: ${id.year}`);
  assert.ok(id.architect && id.architect.length > 5);
 }
 assert.match(crestSvg({name: 'A B', settings: {designer: 'architect', seed: 'Z', biome: 'links', archAge: 'old'}}), /EST\. 1[89]\d\d/);
});

test('the flag says where the cup is cut: red front, white middle, blue back', () => {
 assert.deepEqual(Object.keys(PIN_FLAGS), ['front', 'middle', 'back']);
 const s = {seed: 'FLAG', holes: 9, biome: 'midwest'};
 for (let i = 0; i < 6; i++) {
  const h = generateCourse(s, i), band = pinBandOf(h);
  // The cup's place along the green agrees with its band.
  const along = (h.pin.z - h.green.z) / (h.greenSize ?? 17);
  if (band === 'front') assert.ok(along < 0, `hole ${i + 1}: front cup at ${along.toFixed(2)}`);
  if (band === 'back') assert.ok(along > 0, `hole ${i + 1}: back cup at ${along.toFixed(2)}`);
 }
 assert.equal(pinBandOf({settings: {pinBand: 'centre'}, hole: 0}), 'middle');
});
