import test from 'node:test';
import assert from 'node:assert/strict';
import {isoWeek, weekIndex, weekSeed, weekKey, weeklyBiome, weeklySettings, recordWeekly, normaliseWeekly, bestEverWeekly} from '../src/weekly.js';
import {BIOME_KEYS, GENERATOR_VERSION} from '../src/settings-schema.js';
import {Round} from '../src/game.js';

const at = d => new Date(d + 'T12:00');

// ISO weeks, including the turns of the year that catch out a naive count.
test('weeks are ISO weeks, Monday to Sunday', () => {
 assert.deepEqual(isoWeek(at('2026-10-14')), {year: 2026, week: 42});
 assert.deepEqual(isoWeek(at('2026-10-18')), {year: 2026, week: 42}, 'Sunday is the same week');
 assert.deepEqual(isoWeek(at('2026-10-19')), {year: 2026, week: 43}, 'Monday turns it over');
 assert.deepEqual(isoWeek(at('2024-12-30')), {year: 2025, week: 1});
 assert.deepEqual(isoWeek(at('2021-01-03')), {year: 2020, week: 53});
 assert.equal(weekIndex(at('2024-01-01')), 0);
 assert.equal(weekIndex(at('2026-10-19')) - weekIndex(at('2026-10-18')), 1);
});

// THE SAME COURSE ON EVERY COPY: nothing but the date goes in.
test('a week has one course: its seed, its landscape, eighteen holes at the defaults', () => {
 const a = weeklySettings(at('2026-10-14')), b = weeklySettings(at('2026-10-16'));
 assert.deepEqual(a, b);
 assert.equal(a.seed, 'WEEK-2026-42');
 assert.equal(a.holes, 18);
 assert.equal(weekKey(at('2026-10-14')), `WEEK-2026-42@g${GENERATOR_VERSION}`);
 // Nine weeks running visit all nine landscapes.
 const seen = new Set(Array.from({length: 9}, (_, i) => weeklyBiome(new Date(2026, 9, 12 + 7 * i, 12))));
 assert.equal(seen.size, BIOME_KEYS.length);
 assert.equal(weekSeed({year: 2027, week: 3}), 'WEEK-2027-03');
});

test('a week\'s best is kept, and only a better round replaces it', () => {
 const prof = {};
 assert.deepEqual(recordWeekly(prof, 'WEEK-2026-42@g35', 80), {first: true, better: false});
 assert.deepEqual(recordWeekly(prof, 'WEEK-2026-42@g35', 82), {first: false, better: false});
 assert.deepEqual(recordWeekly(prof, 'WEEK-2026-42@g35', 77), {first: false, better: true});
 assert.equal(prof.weekly['WEEK-2026-42@g35'], 77);
 recordWeekly(prof, 'WEEK-2026-43@g35', 74);
 assert.equal(bestEverWeekly(prof), 74);
 assert.deepEqual(normaliseWeekly({'WEEK-2026-42@g35': 77, 'nonsense': 3, 'WEEK-2026-43@g35': -1}), {'WEEK-2026-42@g35': 77});
});

test('a round on the week\'s course keeps its week through a save', () => {
 const r = new Round({holes: 18, weekly: 'WEEK-2026-42@g35'});
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.equal(back.weekly, 'WEEK-2026-42@g35');
 assert.equal(new Round({holes: 9}).weekly, '');
 assert.throws(() => new Round({weekly: 'last week'}), /course of the week/);
});
