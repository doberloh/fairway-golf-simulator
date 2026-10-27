import test from 'node:test';
import assert from 'node:assert/strict';
import {isoWeek, weekIndex, weekSeed, weekKey, weeklyBiome, weeklySettings, recordWeekly, normaliseWeekly, bestEverWeekly, biomeForWeek, WEEKLY_ROTATION} from '../src/weekly.js';
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
 // Before Lakeshore Dunes' debut, nine weeks running visit the nine.
 const seen = new Set(Array.from({length: 9}, (_, i) => weeklyBiome(new Date(2026, 6, 6 + 7 * i, 12))));
 assert.equal(seen.size, 9);
 // From it, ten weeks running visit every landscape but Haunted Hollow, whose
 // turn falls out of its season (seasons.js) and goes to Autumn.
 const after = Array.from({length: 10}, (_, i) => weeklyBiome(new Date(2026, 10, 9 + 7 * i, 12)));
 assert.equal(new Set(after).size, BIOME_KEYS.length - 1);
 assert.ok(!after.includes('haunted'));
 assert.equal(after.filter(b => b === 'autumn').length, 2);
 assert.equal(weekSeed({year: 2027, week: 3}), 'WEEK-2027-03');
});

// A NEW LANDSCAPE NEVER RESHUFFLES THE PAST (weekly.js WEEKLY_ROTATION): every
// week before its debut has exactly the landscape it had when there were
// nine, the debut week is the newcomer's, and the week after shows what the
// debut week would have shown.
test('the tenth landscape joins on its own week and moves no earlier week', () => {
 const old = w => ['pnw', 'desert', 'mountain', 'links', 'midwest', 'island', 'redwood', 'autumn', 'haunted'][((w % 9) + 9) % 9];
 assert.deepEqual(WEEKLY_ROTATION.nine, BIOME_KEYS.slice(0, 9), 'the old rotation is the first nine keys, in order');
 for (let w = -60; w < 149; w++) assert.equal(biomeForWeek(w, WEEKLY_ROTATION), old(w), `week ${w}`);
 assert.equal(weekIndex(at('2026-11-09')), 149);
 assert.equal(weeklyBiome(at('2026-11-09')), 'lakeshore');
 assert.equal(weeklyBiome(at('2026-11-08')), old(148), 'the Sunday before is still the old rotation');
 assert.equal(weeklyBiome(at('2026-11-16')), old(149), 'the week after shows what the debut week would have');
 // Then a ten-week cycle, each landscape once.
 for (let w = 149; w < 189; w++) assert.equal(biomeForWeek(w + 10, WEEKLY_ROTATION), biomeForWeek(w, WEEKLY_ROTATION));
 // The splash runs the same function from its source text (vite.config.js).
 const copy = new Function(`return ${biomeForWeek.toString()}`)();
 for (let w = 100; w < 200; w++) assert.equal(copy(w, JSON.parse(JSON.stringify(WEEKLY_ROTATION))), biomeForWeek(w, WEEKLY_ROTATION));
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
