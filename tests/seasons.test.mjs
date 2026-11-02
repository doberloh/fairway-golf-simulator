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
