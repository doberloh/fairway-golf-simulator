import test from 'node:test';
import assert from 'node:assert/strict';
import {SEASONS, DRAWN, seasonOf, roundSeason, validSeasonChoice, seasonLook} from '../src/seasons.js';

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
