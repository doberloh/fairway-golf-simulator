import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SEASONS, DRAWN, seasonOf, roundSeason, validSeasonChoice, seasonLook, seasonPalette, UNDER_SNOW, dullInWinter} from '../src/seasons.js';
import {BIOMES} from '../src/biomes.js';
import {grassLook} from '../src/vegetation.js';

test('a date falls in its meteorological season, flipped south of the equator', () => {
 const on = (m, d = 15) => new Date(2026, m, d);
 assert.equal(seasonOf(on(0)), 'winter');
 assert.equal(seasonOf(on(2, 1)), 'spring');
 assert.equal(seasonOf(on(5)), 'summer');
 assert.equal(seasonOf(on(8)), 'autumn');
 assert.equal(seasonOf(on(10, 30)), 'autumn');
 assert.equal(seasonOf(on(11, 1)), 'winter');
 assert.equal(seasonOf(on(5), {south: true}), 'winter');
 assert.equal(seasonOf(on(0), {south: true}), 'summer');
 // Every month has a season, and all four occur.
 assert.deepEqual(new Set(Array.from({length: 12}, (_, m) => seasonOf(on(m)))), new Set(SEASONS));
});

test('a round\'s season is today\'s or the one picked, never one the game cannot draw', () => {
 const july = new Date(2026, 6, 4), dec = new Date(2026, 11, 25);
 assert.equal(roundSeason('today', {date: july}), 'summer');
 assert.equal(roundSeason('nonsense', {date: july}), 'summer');
 for (const s of SEASONS) {
  const got = roundSeason(s, {date: july});
  assert.ok(DRAWN.includes(got), `${s} -> ${got}`);
  if (DRAWN.includes(s)) assert.equal(got, s);
 }
 assert.ok(DRAWN.includes(roundSeason('today', {date: dec})));
 // A tropical landscape is always its one green look.
 assert.equal(roundSeason('winter', {date: dec, tropical: true}), 'summer');
});

test('a choice is today or a season; a season\'s look is the record\'s own table', () => {
 assert.ok(validSeasonChoice('today'));
 for (const s of SEASONS) assert.ok(validSeasonChoice(s));
 assert.ok(!validSeasonChoice('fall'));
 assert.ok(!validSeasonChoice(undefined));
 const rec = {rough: '#111111', seasons: {autumn: {rough: '#aa6633'}}};
 assert.deepEqual(seasonLook(rec, 'summer'), {});
 assert.deepEqual(seasonLook(rec, 'autumn'), {rough: '#aa6633'});
 assert.deepEqual(seasonLook(rec, 'winter'), {});
 assert.deepEqual(seasonLook({}, 'autumn'), {});
});

test('every region has its winter; a season moves the turf, never the greens, and summer nothing', async () => {
 const {WINTER, seasonPalette, bareInWinter} = await import('../src/seasons.js');
 const {REGIONS} = await import('../src/regions.js');
 for (const r of Object.keys(REGIONS)) assert.ok(['snow', 'frost', 'dormant', 'green'].includes(WINTER[r]), `${r} has no winter`);
 const bio = {rough: '#6e7a3c', semi: '#4f8a3e', fairway: '#549a44', green: '#a0be6a', bank: '#697348'};
 assert.deepEqual(seasonPalette(bio, 'summer', 'midwest'), {});
 const snow = seasonPalette(bio, 'winter', 'midwest');
 assert.ok(!('green' in snow), 'a green is kept clear');
 const lum = h => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0);
 assert.ok(lum(snow.rough) > lum(bio.rough) + 300, 'snow whitens the rough');
 assert.deepEqual(seasonPalette(bio, 'winter', 'hawaii'), {}, 'a green winter changes nothing');
 for (const s of ['spring', 'autumn']) assert.ok(seasonPalette(bio, s, 'south').rough !== bio.rough, `${s} moves the rough`);
 const sets = {evergreen: new Set(['pine']), palms: new Set(['palm']), ground: new Set(['shrub'])};
 assert.ok(bareInWinter('oak', sets) && !bareInWinter('pine', sets) && !bareInWinter('palm', sets) && !bareInWinter('shrub', sets));
});

test('snow covers the natural grounds and greys the far broadleaf woods', async () => {
 // New England's winter showed orange leaf litter and autumn far woods
 // through the snow (3 November 2026).
 const {seasonPalette} = await import('../src/seasons.js');
 const bright = h => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0) / 3;
 const bio = {rough: '#4a7a3a', groundTints: {native: '#b3a35a'}, farForest: {colors: ['#b8482c', '#d67c34', '#cfa443']}};
 const snow = seasonPalette(bio, 'winter', 'northeast');
 assert.ok(bright(snow.groundTints.litter) > 200, `litter under snow is ${snow.groundTints.litter}`);
 assert.ok(bright(snow.groundTints.native) > 200, `native grass under snow is ${snow.groundTints.native}`);
 // New England's own autumn woods: at least four fifths of the orange gone.
 const warmth = h => parseInt(h.slice(1, 3), 16) - parseInt(h.slice(5, 7), 16);
 bio.farForest.colors.forEach((c, i) => assert.ok(warmth(snow.farForest.colors[i]) <= warmth(c) * .2 + 24,
  `the far woods in winter are still orange: ${c} became ${snow.farForest.colors[i]}`));
 assert.equal(seasonPalette(bio, 'winter', 'south').groundTints, undefined, 'a dormant winter keeps its grounds');
});

test('every landscape\'s rough has its green for three seasons, and spring is its own', async () => {
 const {GREEN, roughGreen, RICH} = await import('../src/seasons.js');
 const {seasonPalette} = await import('../src/seasons.js');
 const {biomeOf} = await import('../src/biomes.js');
 const {BIOME_KEYS} = await import('../src/settings-schema.js');
 const {regionOf} = await import('../src/regions.js');
 const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
 const far = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
 const greenness = h => { const [r, g, b] = rgb(h); return g - (r + b) / 2; };
 for (const key of BIOME_KEYS) {
  assert.ok(GREEN[key], `${key} has no green`);
  const bio = biomeOf(key), region = regionOf(key), [sp, su, au] = GREEN[key];
  assert.ok(sp >= au && su >= au, `${key}: autumn is never the greenest`);
  assert.equal(roughGreen(key, 'winter'), 0);
  if (bio.tropical) continue;
  const spring = seasonPalette(bio, 'spring', region), summer = {...bio, ...seasonPalette(bio, 'summer', region)};
  assert.ok(far(spring.rough, summer.rough) >= 14, `${key}: spring's rough ${spring.rough} too near summer's ${summer.rough}`);
  assert.ok(greenness(spring.rough) > greenness(bio.rough), `${key}: spring is greener than the record`);
 }
 const wine = biomeOf('calcoast');
 for (const season of ['spring', 'summer']) assert.ok(greenness(seasonPalette(wine, season, 'california').rough) > 15, `wine country's rough is green in ${season}`);
 assert.ok(greenness(seasonPalette(biomeOf('mojave'), 'spring', 'desert').rough) < 30, 'a desert stays a desert');
 assert.deepEqual(seasonPalette(biomeOf('mojave'), 'summer', 'desert'), {}, 'its summer is its record');
 assert.ok(far(seasonPalette(biomeOf('hawaii'), 'summer', 'hawaii').rough, RICH) < far(biomeOf('hawaii').rough, RICH));
});

// (A landscape whose record IS its autumn ended with New England, 6 November 2026.)
test('every landscape with a spring has a bloom, its months real and its colours hex', async () => {
 const {BLOOM} = await import('../src/seasons.js');
 const {LANDSCAPES} = await import('../src/regions.js');
 for (const [key, l] of Object.entries(LANDSCAPES)) {
  if (l.tropical) { assert.equal(BLOOM[key], undefined, `${key} has no spring`); continue; }
  const [first, last, ...colours] = BLOOM[key] ?? [];
  assert.ok(first >= 1 && last <= 12 && first <= last, `${key}: months ${first}-${last}`);
  assert.ok(colours.length >= 2 && colours.every(c => /^#[0-9a-f]{6}$/.test(c)), `${key}: ${colours}`);
 }
});

test('a bloom falls in the spring it falls in, and only there', async () => {
 const {bloomIn} = await import('../src/seasons.js');
 assert.equal(bloomIn('sonoran', 'spring').amount, 1);
 assert.equal(bloomIn('newengland', 'spring').amount, .5, 'half of it is in June');
 assert.equal(bloomIn('rockies', 'spring'), null, 'the Rockies bloom in summer');
 assert.equal(bloomIn('alaska', 'spring'), null);
 assert.equal(bloomIn('keys', 'spring'), null, 'the tropics have no spring');
 for (const s of ['summer', 'autumn', 'winter']) assert.equal(bloomIn('sonoran', s), null);
 assert.equal(bloomIn('nowhere', 'spring'), null);
});

test('the wild ground takes the bloom in spring, and no other season, and not the greens', async () => {
 const {seasonPalette} = await import('../src/seasons.js');
 const {biomeOf} = await import('../src/biomes.js');
 const blue = h => parseInt(h.slice(5, 7), 16) - parseInt(h.slice(1, 3), 16);
 const bio = biomeOf('hillcountry'), spring = seasonPalette(bio, 'spring', 'texas');
 assert.ok(blue(spring.groundTints.native) > blue(bio.groundTints?.native ?? '#b3a35a'), 'bluebonnets blue the native ground');
 assert.ok(!('green' in spring));
 assert.equal(seasonPalette(biomeOf('rockies'), 'spring', 'mountain').groundTints, undefined, 'no bloom, no tint');
 assert.equal(seasonPalette(bio, 'autumn', 'texas').groundTints, undefined);
 const summer = seasonPalette(bio, 'summer', 'texas');
 assert.equal(summer.bloom, undefined); assert.equal(summer.groundTints, undefined);
});

test('a snowy winter leaves no bracken or flowers on the snow, and a leaf-fall record no cream', () => {
 assert.ok(UNDER_SNOW.has('bracken') && UNDER_SNOW.has('fern'));
 const orange = '#c8702a', dull = dullInWinter(orange);
 const chroma = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
 assert.ok(chroma(dull) < chroma(orange) / 2, dull);
 const bio = {rough: '#b08a3a', semi: '#8a7a3a', bank: '#8a7a3a', fairway: '#4a7a3a'};
 const plain = seasonPalette(bio, 'winter', 'northeast'), fall = seasonPalette({...bio, leafFall: true}, 'winter', 'northeast');
 assert.ok(chroma(fall.rough) < chroma(plain.rough) / 2, fall.rough);
});

test('a prairie grass wears its own colours through the year, and a field in bloom keeps its own', () => {
 // Seen 3 November 2026: every long grass took the landscape's one colour, so
 // tall fescue was New England's autumn orange in a Kentucky July and no
 // prairie turned.
 const rec = BIOMES.badlands.longGrass, hue = c => c.getHSL({}).h * 360;
 assert.ok(hue(grassLook(rec, 'grasslittlebluestem', 'summer').leaf) > 120, 'little bluestem is blue-green in summer');
 assert.ok(hue(grassLook(rec, 'grasslittlebluestem', 'autumn').leaf) < 40, 'and copper in autumn');
 assert.ok(hue(grassLook(BIOMES.parkland.longGrass, 'grasstallfescue', 'summer').leaf) > 70, 'tall fescue is green in summer');
 const hex = c => `#${c.getHexString(T.SRGBColorSpace)}`;
 assert.equal(hex(grassLook(rec, 'grassbluestem', 'autumn').leaf), rec.leaf, 'an older family keeps the landscape\'s');
 assert.equal(hex(grassLook(BIOMES.bluebonnet.longGrass, 'grassindian', 'summer').accent), BIOMES.bluebonnet.longGrass.accent, 'the bluebonnets stay blue');
 for (const k of ['parkland', 'blueridge']) assert.ok(hue(grassLook(BIOMES[k].longGrass, 'grassbluestem', 'summer').leaf) > 60, `${k}: no autumn orange in summer`);
});

// The owner, 5 November 2026, of Puget Sound in autumn: "The evergreen trees change
// color". `cedar` was not on the list. The three conifers that do drop their needles
// have their own tints.
test('no evergreen turns in autumn: every conifer and palm is on the list or has its own colours', async () => {
 const [{EVERGREEN}, {CONIFERS, PALMS}, {SEASON_TINTS}] = await Promise.all([import('../src/species.js'), import('../src/built-world.js'), import('../src/season-tints.js')]);
 const shed = new Set(['baldcypress', 'westernlarch', 'tamarack']);
 for (const k of [...CONIFERS, ...PALMS]) {
  if (shed.has(k)) { assert.ok(SEASON_TINTS[k]?.autumn, `${k} turns by its own colours`); continue; }
  assert.ok(EVERGREEN.has(k) || SEASON_TINTS[k]?.autumn, `${k} would turn orange in autumn`);
 }
 for (const k of ['cedar', 'tanoak', 'seedling', 'swordfern']) assert.ok(EVERGREEN.has(k), k);
});
