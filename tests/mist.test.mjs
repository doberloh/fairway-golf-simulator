import test from 'node:test';
import assert from 'node:assert/strict';
import {mistAmount, SUNRISE, SUNSET} from '../src/daylight.js';
import {profileFor, hasOwnProfile, mistDensities, visibilityOf, SHEET_GAP, SHEET_BANK, bakeWaterField, WATER_FIELD_SIZE} from '../src/mist.js';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

test('mist forms overnight, peaks at first light and burns off', () => {
 // Keyed off the clock rather than sun elevation, unlike the rest of the
 // daylight model: mist is a story about heat, not light. The ground radiates
 // warmth away through the night, the air over it reaches dew point before
 // dawn, and the first hours of sun clear it.
 assert.ok(mistAmount(SUNRISE) > .95, 'thickest at sunrise');
 assert.ok(mistAmount(4) > .95, 'and through the small hours');
 assert.ok(mistAmount(SUNRISE + 1) > .7, 'still heavy an hour after sunrise');
 assert.ok(mistAmount(SUNRISE + 4) < .01, 'gone four hours later');
 assert.equal(mistAmount(12), 0, 'nothing at midday');
 assert.equal(mistAmount(16), 0, 'nothing in the afternoon');

 // Nothing at sunset: fog does not appear the moment the sun goes, it builds
 // as the ground gives up its heat.
 assert.ok(mistAmount(SUNSET) < .01, 'clear at sunset');
 assert.ok(mistAmount(SUNSET + 1) < .2, 'barely forming an hour later');
 assert.ok(mistAmount(SUNSET + 4) > .3, 'building by late evening');

 // Monotonic through the night: mist that thinned and returned would read as
 // flicker rather than as weather.
 let previous = 0;
 for (let h = SUNSET; h <= SUNSET + 10; h += .1) {
  const now = mistAmount(h);
  assert.ok(now >= previous - 1e-9, `mist never thins overnight (${h.toFixed(1)})`);
  previous = now;
 }
 // And monotonic down through the morning.
 previous = Infinity;
 for (let h = SUNRISE; h <= SUNRISE + 4; h += .1) {
  const now = mistAmount(h);
  assert.ok(now <= previous + 1e-9, `mist never thickens after sunrise (${h.toFixed(1)})`);
  previous = now;
 }
});

test('every biome has a mist profile and the desert stays dry', () => {
 // Redwood is the one biome on the Midwest fallback, found on 9 October when
 // this assertion was made able to fail. Whether the grove should get fog of
 // its own is a look decision for the owner (TODO.md); until then it is named
 // here rather than hidden by a check that cannot say no.
 const BORROWS = ['redwood'];
 for (const biome of BIOME_KEYS) {
  const p = profileFor(biome);
  assert.equal(hasOwnProfile(biome), !BORROWS.includes(biome),
   `${biome} ${hasOwnProfile(biome) ? 'has a profile but is listed as borrowing' : 'has no mist profile and silently takes the Midwest fog'}`);
  assert.ok(p.haze >= 0 && p.haze <= 1, `${biome} haze is in range`);
  assert.ok(p.sheet >= 0 && p.sheet <= 1, `${biome} sheet is in range`);
 }
 // Pooled fog over a saguaro would read as a mistake, not as weather. A little
 // distance haze is fine and gives the dunes depth; a ground sheet is not.
 assert.equal(profileFor('desert').sheet, 0, 'the desert gets no ground mist');
 assert.ok(profileFor('desert').haze > 0, 'but keeps some dry distance haze');

 // The wet coastal biomes should hold the most.
 assert.ok(profileFor('pnw').sheet > profileFor('island').sheet, 'the Sound holds more than the tropics');
 assert.ok(profileFor('mountain').haze >= profileFor('midwest').haze, 'valleys hold more than prairie');

 assert.deepEqual(profileFor('nonsense'), profileFor('midwest'), 'an unknown biome falls back rather than throwing');
});

test('the sheet is thick in banks and clear between them', () => {
 // Rewritten deliberately. The first version asserted a single visibility floor
 // of 700 m, which is the wrong shape: it treats fog as an even depth of grey.
 // Reference photographs of PNW courses at dawn show the opposite -- a fairway
 // you can see across running into a treeline you cannot -- so what matters is
 // that the fog is genuinely thick in a bank AND genuinely clear in a gap.
 const worst = ['pnw', 'mountain', 'autumn', 'links', 'midwest', 'island', 'haunted'];

 for (const biome of worst) {
  const d = mistDensities(profileFor(biome), 1, 1);
  const bank = visibilityOf(d.sheet * SHEET_BANK);
  const gap = visibilityOf(d.sheet * SHEET_GAP);

  assert.ok(bank < 900, `${biome}: a bank should actually obscure (${Math.round(bank)}m)`);
  // Never pea soup. Even at its worst you can see the ball land.
  assert.ok(bank > 90, `${biome}: a bank is too thick to play in (${Math.round(bank)}m)`);
  // And there has to be somewhere to see from, or it is just a grey screen.
  assert.ok(gap > 800, `${biome}: the gaps are not clear enough (${Math.round(gap)}m)`);
  // The contrast IS the feature. A low ratio reads as a wash, not as weather.
  assert.ok(gap / bank > 8, `${biome}: too even to read as patches (${(gap / bank).toFixed(1)}x)`);
 }

 // Midday is clear: the sheet is gone entirely and the haze is only depth cue.
 const noon = mistDensities(profileFor('pnw'), 0, 1);
 assert.equal(noon.sheet, 0, 'no ground sheet at midday');
 assert.ok(visibilityOf(noon.haze) > 12000, 'and the air is clear to the horizon');

 // Haze stays gentle at every dampness -- it is aerial perspective, not fog.
 for (const biome of worst) {
  for (const damp of [0, .5, 1]) {
   const d = mistDensities(profileFor(biome), damp, 1);
   assert.ok(visibilityOf(d.haze) > 3000,
    `${biome} at damp ${damp}: haze visibility ${Math.round(visibilityOf(d.haze))}m is too short`);
  }
 }

 // Mist thickens with damp, monotonically, and never inverts.
 let previousHaze = 0;
 for (let damp = 0; damp <= 1; damp += .05) {
  const d = mistDensities(profileFor('pnw'), damp, 1);
  assert.ok(d.haze >= previousHaze - 1e-12, 'haze only thickens as the air dampens');
  previousHaze = d.haze;
 }

 // The tier strength scales it, so low and medium switch it off completely.
 assert.equal(mistDensities(profileFor('pnw'), 1, 0).haze, 0, 'strength 0 means no mist at all');
 assert.equal(mistDensities(profileFor('pnw'), 1, 0).sheet, 0);

 // Desert stays dry however damp the clock says it is.
 for (const damp of [0, .5, 1]) assert.equal(mistDensities(profileFor('desert'), damp, 1).sheet, 0);
});

test('fog gathers on water, and only where there is water', () => {
 // Mist over a pond has to fog a tree standing BEHIND the pond, not just the
 // water surface, which is why this is a field sampled at the fragment rather
 // than anything living in the ground shader.
 const wet = generateWorld({...DEFAULT_COURSE, seed: 'mist-water', holes: 9, water: 45});
 const field = bakeWaterField(wet);
 assert.ok(field, 'a course with ponds bakes a field');
 assert.equal(field.size, WATER_FIELD_SIZE);
 assert.deepEqual(field.extent, [wet.halfX, wet.halfZ], 'the field covers the course');

 const sample = (x, z) => {
  const i = Math.round((x / field.extent[0] * .5 + .5) * (field.size - 1));
  const j = Math.round((z / field.extent[1] * .5 + .5) * (field.size - 1));
  if (i < 0 || j < 0 || i >= field.size || j >= field.size) return null;
  return field.data[j * field.size + i];
 };

 const hole = wet.holes.find(h => h.ponds.length);
 const pond = hole.ponds[0];
 const centre = hole.toWorld({x: pond.x, z: pond.z});
 assert.equal(sample(centre.x, centre.z), 255, 'the field is full over open water');

 // It has to actually fall off, or it is just a global dampness.
 let sum = 0;
 for (const v of field.data) sum += v;
 const mean = sum / field.data.length;
 assert.ok(mean < 160, `the field should not cover the whole course (mean ${mean.toFixed(0)}/255)`);

 // A course with no water bakes nothing at all, rather than an empty texture
 // and a sampler nobody needs.
 const dry = generateWorld({...DEFAULT_COURSE, seed: 'mist-dry', holes: 9, water: 0, rivers: 0, creeks: 0});
 const dryPonds = dry.holes.reduce((n, h) => n + h.ponds.length, 0);
 const drySegments = dry.streams?.segments?.length || 0;
 assert.equal(dryPonds + drySegments, 0, 'the dry course really has no water to bake');
 assert.equal(bakeWaterField(dry), null, 'and so it bakes no field');
});

test('water mist follows the biome and skips the desert', () => {
 for (const biome of ['pnw', 'autumn', 'links', 'midwest', 'mountain', 'island']) {
  const d = mistDensities(profileFor(biome), 1, 1);
  assert.ok(d.water > 0, `${biome} gets fog on its water`);
  assert.ok(visibilityOf(d.water) > 100, `${biome} water fog is not a wall (${Math.round(visibilityOf(d.water))}m)`);
 }
 // Dry air. Fog sitting on a desert pond would read as a mistake.
 assert.equal(mistDensities(profileFor('desert'), 1, 1).water, 0);
 // And none of it at midday, whatever the biome.
 for (const biome of ['pnw', 'links']) assert.equal(mistDensities(profileFor(biome), 0, 1).water, 0);
 // Tier strength switches it off with everything else.
 assert.equal(mistDensities(profileFor('pnw'), 1, 0).water, 0);
});
