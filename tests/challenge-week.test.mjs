// THE CHALLENGE OF THE WEEK (weekly.js, 16 October 2026): picked from the date,
// the same on every copy; its key, its best, what it pays; and that the course
// of the week can host what it picks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyChallenge, cycleOrder, challengeWeekKey, recordChallengeWeek, normaliseChallengeWeeks, WEEKLY_POOLS, WEEKLY_CHALLENGE_XP, weekIndex, weeklySettings} from '../src/weekly.js';
import {CHALLENGES, challenge} from '../src/challenges.js';
import {chooseHole, spotsFor, holeAdapter} from '../src/challenge-spots.js';
import {GENERATOR_VERSION} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

const at = d => new Date(d + 'T12:00');

test('the pool: real challenges, none that needs a feature not every course has', () => {
 for (const pool of WEEKLY_POOLS) {
  assert.equal(new Set(pool.ids).size, pool.ids.length);
  for (const id of pool.ids) { assert.ok(challenge(id), id); assert.notEqual(challenge(id).hole, 'spots', `${id} needs water or sand`); }
 }
 // Every solo challenge but those three: the first pool before the challenges
 // across holes existed, the second with them.
 const solo = CHALLENGES.filter(c => c.hole !== 'spots' && c.where !== 'round' && c.group !== 'versus');
 assert.deepEqual([...WEEKLY_POOLS.at(-1).ids].sort(), solo.map(c => c.id).sort());
 assert.equal(WEEKLY_POOLS[0].ids.length, 24);
 assert.ok(WEEKLY_POOLS[0].ids.every(id => WEEKLY_POOLS[1].ids.includes(id)), 'a later pool keeps every earlier challenge');
 for (let i = 1; i < WEEKLY_POOLS.length; i++) assert.ok(WEEKLY_POOLS[i].from > WEEKLY_POOLS[i - 1].from, 'pools start in order');
});

test('the same date gives the same challenge, and it turns over on Monday', () => {
 assert.deepEqual(weeklyChallenge(at('2026-10-12')), weeklyChallenge(at('2026-10-18')), 'Monday to Sunday');
 assert.notEqual(weeklyChallenge(at('2026-10-18')).id, weeklyChallenge(at('2026-10-19')).id);
 // Pinned, so a change to the shuffle or the pool cannot slip through: every
 // copy would show a different challenge this week.
 assert.equal(weeklyChallenge(at('2026-10-16')).id, 'curve');
 assert.equal(weeklyChallenge(at('2026-10-23')).id, 'streak');
});

test('each cycle plays every challenge in the pool once, in a new order each time', () => {
 const week = i => new Date(2024, 0, 1 + 7 * i, 12);
 for (const [p, pool] of WEEKLY_POOLS.entries()) {
  const n = pool.ids.length, until = WEEKLY_POOLS[p + 1]?.from ?? Infinity;
  for (let c = 0; c < 3 && pool.from + (c + 1) * n <= until; c++) {
   const seen = Array.from({length: n}, (_, k) => weeklyChallenge(week(pool.from + c * n + k)).id);
   assert.deepEqual([...seen].sort(), [...pool.ids].sort(), `pool ${p}, cycle ${c}`);
  }
  assert.notDeepEqual(cycleOrder(pool, 0), cycleOrder(pool, 1));
 }
 const w = weeklyChallenge(at('2026-10-16'));
 assert.equal(w.next.length, WEEKLY_POOLS[0].ids.length - 1);
 assert.ok(!w.next.includes(w.id));
});

// A NEW POOL starts at a future week and leaves every week before it alone.
test('a pool added later changes nothing before the week it starts', () => {
 const before = Array.from({length: 60}, (_, i) => weeklyChallenge(new Date(2026, 0, 5 + 7 * i, 12)).id);
 WEEKLY_POOLS.push({from: weekIndex(new Date(2027, 0, 4, 12)), ids: [...WEEKLY_POOLS[0].ids, 'water']});
 try {
  const after = Array.from({length: 60}, (_, i) => weeklyChallenge(new Date(2026, 0, 5 + 7 * i, 12)).id);
  assert.deepEqual(after.slice(0, 51), before.slice(0, 51), 'every week of 2026 as it was');
 } finally { WEEKLY_POOLS.pop(); }
});

test('its key names the week and the challenge, and the generator for course ones', () => {
 assert.equal(challengeWeekKey('lag', at('2026-10-16')), `CHAL-2026-42:lag@g${GENERATOR_VERSION}`);
 assert.equal(challengeWeekKey('dartboard', at('2026-10-16')), 'CHAL-2026-42:dartboard', 'the range is the same on every version');
});

test('a week\'s best: the first finish, a better score once a day, a gold once a week', () => {
 const p = {}, key = 'CHAL-2026-42:closest@g36', day = new Date(2026, 9, 16, 10).getTime(), next = new Date(2026, 9, 17, 10).getTime();
 let r = recordChallengeWeek(p, key, 30, 0, day);
 assert.deepEqual(r.parts.map(x => [x.label, x.xp]), [['Challenge of the week', WEEKLY_CHALLENGE_XP.first]]);
 r = recordChallengeWeek(p, key, 20, 1, day);
 assert.deepEqual(r.parts.map(x => x.label), ['Best this week']);
 r = recordChallengeWeek(p, key, 15, 1, day);
 assert.deepEqual(r.parts, [], 'a better score pays once a day');
 assert.equal(p.challengeWeek[key].best, 15, 'but is kept');
 r = recordChallengeWeek(p, key, 8, 3, next, 1.5);
 assert.deepEqual(r.parts.map(x => [x.label, x.xp]), [['Best this week', 38], ['Gold this week', 150]]);
 r = recordChallengeWeek(p, key, 5, 3, next);
 assert.deepEqual(r.parts, [], 'the gold once a week');
 assert.equal(recordChallengeWeek({}, key, 30, 0, day, 1.5).parts[0].xp, 100, 'the first finish is never multiplied');
 // Up and down's best is made, then strokes.
 const q = {}, ud = 'CHAL-2026-43:updown@g36';
 recordChallengeWeek(q, ud, {made: 2, strokes: 14}, 2, day);
 recordChallengeWeek(q, ud, {made: 2, strokes: 12}, 2, next);
 assert.deepEqual(q.challengeWeek[ud].best, {made: 2, strokes: 12});
 const back = normaliseChallengeWeeks(JSON.parse(JSON.stringify({...p.challengeWeek, ...q.challengeWeek, 'CHAL-2026-42:ghost@g36': {best: 1}, nonsense: {best: 2}})));
 assert.deepEqual(Object.keys(back), [key, ud]);
 assert.equal(back[key].gold, true);
 assert.deepEqual(back[ud].best, {made: 2, strokes: 12});
});

// THE COURSE OF THE WEEK CAN HOST IT: the next nine weeks, one in each
// landscape. If a week's course cannot, the game plays the next one in the
// cycle (`next`) -- this says how rarely that should happen.
test('the course of the week hosts the week\'s challenge, nine weeks running', () => {
 for (let i = 0; i < 9; i++) {
  const date = new Date(2026, 9, 16 + 7 * i, 12), w = weeklyChallenge(date), def = challenge(w.id);
  if (def.where === 'range') continue;
  const s = weeklySettings(date), wd = world(s);
  const pick = chooseHole(def, wd.holes.map(h => ({par: h.par, length: h.routeLength})), k => def.spot ? spotsFor(def, holeAdapter(wd.holes[k]), `${s.seed}:${k}:${def.id}`) : []);
  assert.ok(pick, `${s.seed} (${s.biome}) cannot host ${def.id}`);
 }
});
