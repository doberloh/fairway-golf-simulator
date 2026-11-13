import test from 'node:test';
import assert from 'node:assert/strict';
import {isoWeek, weekIndex, weekSeed, weekKey, weeklyBiome, weeklySettings, weeklyYards, WEEKLY_LENGTH, recordWeekly, normaliseWeekly, bestEverWeekly, biomeForWeek, WEEKLY_ROTATION} from '../src/weekly.js';
import {BIOME_KEYS, GENERATOR_VERSION, DEFAULT_COURSE} from '../src/settings-schema.js';
import {planScorecard} from '../src/course-plan.js';
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
 // Before Lakeshore Dunes' debut, nine weeks running visit eight landscapes:
 // Haunted Hollow's turn (removed 2 November 2026) goes to Autumn.
 const seen = Array.from({length: 9}, (_, i) => weeklyBiome(new Date(2026, 6, 6 + 7 * i, 12)));
 // (Seven since 6 November 2026: the Heartland's and New England's turns are Classic Parkland's.)
 assert.equal(new Set(seen).size, 7);
 assert.equal(seen.filter(b => b === 'parkland').length, 3);
 // From it, ten weeks running visit the ten landscapes, Autumn twice.
 const after = Array.from({length: 10}, (_, i) => weeklyBiome(new Date(2026, 10, 9 + 7 * i, 12)));
 // (Seven since 8 November 2026: Lakeshore Dunes' and the Links' turns are both Seaside Links'.)
 assert.equal(new Set(after).size, 7);
 assert.ok(!after.includes('haunted'));
 assert.equal(after.filter(b => b === 'parkland').length, 3);
 // After the last debut (week 191, 30 August 2027) a rotation visits every
 // landscape.
 // (A retired landscape's weeks are Classic Parkland's, so a cycle is longer than the list.)
 const later = Array.from({length: 60}, (_, i) => weeklyBiome(new Date(2027, 7, 30 + 7 * i, 12)));
 for (const k of BIOME_KEYS) assert.ok(later.includes(k), k);
 assert.ok(!later.includes('haunted'));
 assert.equal(weekSeed({year: 2027, week: 3}), 'WEEK-2027-03');
});

// A NEW LANDSCAPE NEVER RESHUFFLES THE PAST (weekly.js WEEKLY_ROTATION): every
// week before its debut has exactly the landscape it had when there were
// nine, the debut week is the newcomer's, and the week after shows what the
// debut week would have shown.
test('the tenth landscape joins on its own week and moves no earlier week', () => {
 // (The keys are the landscapes' new ones since 2 November 2026; the rotation
 // is the same landscapes in the same order; since 8 November 2026 Puget Sound's weeks are the Pacific
 // Northwest's and the Links' Seaside Links'.)
 const old = w => ['pacnw', 'dmountain', 'mountains', 'seaside', 'parkland', 'flpalms', 'redwood', 'parkland', 'parkland'][((w % 9) + 9) % 9];
 for (let w = -60; w < 149; w++) assert.equal(biomeForWeek(w, WEEKLY_ROTATION), old(w), `week ${w}`);
 assert.equal(weekIndex(at('2026-11-09')), 149);
 assert.equal(weeklyBiome(at('2026-11-09')), 'seaside');
 assert.equal(weeklyBiome(at('2026-11-08')), old(148), 'the Sunday before is still the old rotation');
 assert.equal(weeklyBiome(at('2026-11-16')), old(149), 'the week after shows what the debut week would have');
 // Then a ten-week cycle, each landscape once, until the next debut
 // (week 160, the US landscapes goal's phase 3), and after the last debut a
 // cycle of the nine's eight, the Lake Dunes and every debut since -- worked
 // out from the rotation, so each phase's debuts need no edit here.
 for (let w = 149; w + 10 < 160; w++) assert.equal(biomeForWeek(w + 10, WEEKLY_ROTATION), biomeForWeek(w, WEEKLY_ROTATION));
 const last = Math.max(...WEEKLY_ROTATION.eras.map(e => e.debut)), cycle = 9 + WEEKLY_ROTATION.eras.length;
 for (let w = last; w < last + 60; w++) assert.equal(biomeForWeek(w + cycle, WEEKLY_ROTATION), biomeForWeek(w, WEEKLY_ROTATION));
 // The splash runs the same function from its source text (vite.config.js).
 const copy = new Function(`return ${biomeForWeek.toString()}`)();
 for (let w = 100; w < 200; w++) assert.equal(copy(w, JSON.parse(JSON.stringify(WEEKLY_ROTATION))), biomeForWeek(w, WEEKLY_ROTATION));
});

// THE WEEK'S LENGTH (weekly.js WEEKLY_LENGTH): eighteen holes used to keep the
// default length for nine, 3,240 yards, and every hole came out at its
// shortest. From its first week the length is drawn from the week's seed,
// 6,400 to 6,850 yards from the blue tees; no earlier week moves.
test('the week\'s course is a full-length eighteen from its first week, and no earlier week moves', () => {
 const monday = w => new Date(2024, 0, 1 + 7 * w, 12), {from, lo, hi, step} = WEEKLY_LENGTH;
 assert.equal(weekIndex(at('2026-11-16')), from, 'the first week is Monday 16 November 2026');
 // Every earlier week keeps the course its bests were made on.
 for (let w = from - 60; w < from; w++) assert.equal(weeklySettings(monday(w)).courseYards, DEFAULT_COURSE.courseYards, `week ${w}`);
 assert.equal(weeklySettings(at('2026-11-15')).courseYards, DEFAULT_COURSE.courseYards, 'the Sunday before is still the old length');
 const seen = new Set();
 for (let w = from; w < from + 208; w++) {
  const d = monday(w), yards = weeklyYards(d);
  assert.ok(yards >= lo && yards <= hi && (yards - lo) % step === 0, `week ${w}: ${yards}`);
  assert.equal(weeklySettings(d).courseYards, yards);
  // The same on every day of the week, so on every copy.
  assert.equal(weeklyYards(new Date(d.getTime() + 6 * 86400000)), yards, `week ${w} holds to its Sunday`);
  seen.add(yards);
 }
 // A range, not one number: four years of weeks reach both ends of it.
 assert.ok(seen.size > 30, `only ${seen.size} lengths in four years`);
 assert.ok(Math.min(...seen) < lo + 50 && Math.max(...seen) > hi - 50);
 // And the course that comes out is that length: a year of weeks, each
 // within a few yards of what was asked, par 71 or 72, the white tees
 // between 5,700 and 6,300 yards.
 for (let w = from; w < from + 52; w++) {
  const s = weeklySettings(monday(w)), card = planScorecard(s);
  assert.ok(Math.abs(card.yards - s.courseYards) <= 10, `week ${w}: asked ${s.courseYards}, built ${card.yards}`);
  assert.ok(card.par === 71 || card.par === 72, `week ${w}: par ${card.par}`);
  assert.ok(card.teeTotals.white.total > 5700 && card.teeTotals.white.total < 6300, `week ${w}: white tees ${card.teeTotals.white.total}`);
 }
 // The week this was found (week 149, 9 to 15 November 2026) is unchanged:
 // every hole at its shortest, as it was played.
 const short = planScorecard(weeklySettings(at('2026-11-12')));
 assert.equal(short.par, 68);
 assert.ok(short.yards < 4700);
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
