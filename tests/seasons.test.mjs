import test from 'node:test';
import assert from 'node:assert/strict';
import {hauntedInSeason, offered, offeredBiomes, markOffSeason, markedOffSeason, standIn, HAUNTED} from '../src/seasons.js';
import {endlessHole, landscapeSeed, runLandscape} from '../src/endless.js';
import {biomeForWeek, WEEKLY_ROTATION} from '../src/weekly.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {BIOMES} from '../src/biomes.js';

// Haunted Hollow is seasonal (the owner, 26 October 2026): 1 October to
// 7 November by the player's own clock, or all year with the setting.
const day = (y, m, d) => new Date(y, m - 1, d, 12);

test('the season runs from 1 October to 7 November, both days included', () => {
 assert.equal(hauntedInSeason(day(2026, 9, 30)), false);
 assert.equal(hauntedInSeason(day(2026, 10, 1)), true);
 assert.equal(hauntedInSeason(day(2026, 10, 31)), true);
 assert.equal(hauntedInSeason(day(2026, 11, 7)), true);
 assert.equal(hauntedInSeason(day(2026, 11, 8)), false);
 assert.equal(hauntedInSeason(day(2027, 3, 15)), false);
 assert.equal(hauntedInSeason(new Date(2026, 10, 7, 23, 59)), true, 'the last minute of 7 November');
 assert.equal(hauntedInSeason(new Date(2026, 9, 1, 0, 0)), true, 'the first minute of 1 October');
});

test('out of season it is not offered, unless the setting asks for it all year; every other landscape always is', () => {
 const march = day(2027, 3, 1), october = day(2026, 10, 15);
 assert.equal(offered(HAUNTED, {date: march}), false);
 assert.equal(offered(HAUNTED, {date: march, allYear: true}), true);
 assert.equal(offered(HAUNTED, {date: october}), true);
 for (const k of BIOME_KEYS.filter(k => k !== HAUNTED)) assert.equal(offered(k, {date: march}), true, k);
 assert.deepEqual(offeredBiomes(BIOME_KEYS, {date: march}), BIOME_KEYS.filter(k => k !== HAUNTED));
 // Never locked out: a picker keeps the landscape already chosen.
 assert.ok(offeredBiomes(BIOME_KEYS, {date: march, keep: HAUNTED}).includes(HAUNTED));
});

// A run whose holes roll Haunted Hollow, found by trying seeds in order.
const hauntedRun = () => {
 for (let i = 0; i < 4000; i++) {
  const seed = `SEASON-${i}`;
  for (let h = 0; h < 6; h++) if (endlessHole(seed, h).biome === HAUNTED) return {seed, h};
 }
 throw new Error('no seed rolled Haunted Hollow');
};

test('an endless run started out of season never rolls Haunted Hollow, and grows the same holes every time', () => {
 const {seed, h} = hauntedRun();
 const marked = markOffSeason(seed);
 assert.ok(markedOffSeason(marked) && !markedOffSeason(seed));
 assert.equal(markOffSeason(marked), marked, 'marking twice changes nothing');
 // The mark is part of the seed, so a marked run grows its own holes -- and
 // none of them, over thousands, is Haunted Hollow.
 let stoodIn = 0;
 for (let i = 0; i < 600; i++) for (let k = 0; k < 6; k++) {
  const run = markOffSeason(`SEASON-${i}`), hole = endlessHole(run, k);
  assert.notEqual(hole.biome, HAUNTED, `${run} hole ${k}`);
  if (hole.biome === standIn(Object.keys(BIOMES), run, k)) stoodIn++;
 }
 assert.ok(stoodIn > 0);
 assert.deepEqual(endlessHole(marked, h), endlessHole(marked, h), 'deterministic');
 // A seed without the mark -- every run before the rule, and every run started
 // in season -- grows exactly what it always did.
 assert.equal(endlessHole(seed, h).biome, HAUNTED);
 // A run pinned to a landscape keeps its pin, mark or not.
 const pinned = landscapeSeed(marked, 'links');
 assert.equal(runLandscape(pinned), 'links');
 assert.equal(endlessHole(pinned, h).biome, 'links');
});

test('the course of the week plays Autumn in Haunted Hollow\'s turn out of season, from 9 November 2026 on, and never changes a past week', () => {
 const plain = {...WEEKLY_ROTATION, season: undefined};
 let changed = 0, kept = 0;
 for (let w = 0; w < 400; w++) {
  const before = biomeForWeek(w, plain), now = biomeForWeek(w, WEEKLY_ROTATION);
  if (w < WEEKLY_ROTATION.season.from) { assert.equal(now, before, `week ${w} changed`); continue; }
  if (before !== HAUNTED) { assert.equal(now, before); continue; }
  const monday = new Date(Date.UTC(2024, 0, 1) + w * 7 * 86400000);
  const inSeason = monday.getUTCMonth() === 9 || (monday.getUTCMonth() === 10 && monday.getUTCDate() <= 7);
  if (inSeason) { assert.equal(now, HAUNTED); kept++; } else { assert.equal(now, 'autumn'); changed++; }
 }
 assert.ok(changed > 0, 'some out-of-season weeks were Haunted Hollow\'s');
 // The splash runs this function from its source text: it must not lean on
 // anything outside itself.
 const copy = new Function(`return ${biomeForWeek.toString()}`)();
 for (let w = 140; w < 300; w++) assert.equal(copy(w, WEEKLY_ROTATION), biomeForWeek(w, WEEKLY_ROTATION));
});

test('a graphics record saved before the setting existed loads with it off', async () => {
 const store = new Map([['fairway-graphics-v1', JSON.stringify({quality: 'high', distantFlags: true})]]);
 globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)};
 const {loadGraphics, saveGraphics} = await import('../src/graphics.js');
 const old = loadGraphics();
 assert.equal(old.hauntedAllYear, false);
 assert.equal(old.distantFlags, true, 'the rest of the old record is kept');
 assert.equal(saveGraphics({...old, hauntedAllYear: true}).hauntedAllYear, true);
 assert.equal(loadGraphics().hauntedAllYear, true);
 delete globalThis.localStorage;
});
