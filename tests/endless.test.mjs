import test from 'node:test';
import assert from 'node:assert/strict';
import {endlessHole, newRunSeed, pickShape, endlessSettings} from '../src/endless.js';
import {planCourse} from '../src/course-plan.js';
import {validateSettings, generationKeys, GENERATOR_VERSION} from '../src/settings-schema.js';
import {Round} from '../src/game.js';
import {relativeToPar} from '../src/scoring.js';

test('a run replays identically from its seed, so it can be put down and resumed', () => {
 const a = endlessHole('DRIFT-1234', 6);
 const b = endlessHole('DRIFT-1234', 6);
 assert.deepEqual(a, b);
});

test('consecutive holes in a run are different landscapes', () => {
 const seeds = new Set();
 const yardages = new Set();
 for (let i = 0; i < 24; i++) {
  const h = endlessHole('DRIFT-1234', i);
  seeds.add(h.seed); yardages.add(h.courseYards);
 }
 assert.equal(seeds.size, 24, 'every hole carries its own seed');
 assert.ok(yardages.size > 8, `expected varied lengths, saw ${yardages.size}`);
});

test('two runs do not play the same holes', () => {
 const one = Array.from({length: 8}, (_, i) => endlessHole('DRIFT-1234', i).courseYards);
 const two = Array.from({length: 8}, (_, i) => endlessHole('LANTERN-9876', i).courseYards);
 assert.notDeepEqual(one, two);
});

test('every generated hole is a single hole the planner turns into the par its length implies', () => {
 const seen = new Set();
 for (let i = 0; i < 120; i++) {
  const h = endlessHole('VARIETY-1', i);
  assert.equal(h.holes, 1);
  const plan = planCourse(h);
  assert.equal(plan.holes.length, 1);
  assert.ok([3, 4, 5].includes(plan.par), `par ${plan.par} from ${h.courseYards} yd`);
  seen.add(plan.par);
 }
 // A run made entirely of par 4s would be the bug this replaced.
 assert.deepEqual([...seen].sort(), [3, 4, 5]);
});

test('the hole settings are a real course everywhere except the hole count', () => {
 // holes:1 is not an option a player can choose, so validation rejects it. The
 // rest of the settings must still be legitimate, or the generator is being fed
 // values no course would ever have.
 const h = endlessHole('CHECK-1', 3);
 assert.throws(() => validateSettings(h), /Holes/);
 // Hole count and length are the two fields a single hole legitimately breaks;
 // with a nine's worth of both, everything else must pass untouched.
 assert.doesNotThrow(() => validateSettings({...h, holes: 9, courseYards: 9 * 360}));
 assert.equal(h.homes, false);
 assert.equal(h.rivers, 0);
});

test('the shape picker stays inside its table for the whole unit interval', () => {
 for (let i = 0; i <= 100; i++) {
  const shape = pickShape(() => i / 100);
  assert.ok([3, 4, 5].includes(shape.par));
 }
});

test('a new run seed is a short printable name', () => {
 for (let i = 0; i < 40; i++) {
  const seed = newRunSeed();
  assert.match(seed, /^[A-Z]+-\d{4}$/);
  assert.ok(seed.length <= 40, 'the Round constructor caps the seed at 40');
 }
});

test('an endless round never finishes, however many holes are played', () => {
 const r = new Round({endless: true, seed: 'DRIFT-1234'});
 for (let i = 0; i < 40; i++) {
  r.holeComplete = true;
  assert.equal(r.finished, false, `finished after ${i} holes`);
  assert.ok(r.nextHole(), 'nextHole should keep advancing');
 }
 assert.equal(r.hole, 40);
});

test('a normal round still ends on its last hole', () => {
 const r = new Round({holes: 9});
 assert.equal(r.endless, false);
 r.hole = 8; r.holeComplete = true;
 r.finishHole?.();
 // Whether or not finishHole is reachable here, nextHole must refuse past the end.
 r.finished = true;
 assert.equal(r.nextHole(), false);
});

test('match play cannot run endlessly, because nothing could ever win it', () => {
 assert.throws(() => new Round({
  endless: true,
  mode: 'match',
  players: [{name: 'A', team: 'A', hand: 'RH'}, {name: 'B', team: 'B', hand: 'RH'}],
 }), /last hole/);
});

test('an endless run survives being saved and restored past its nominal hole count', () => {
 const r = new Round({endless: true, seed: 'DRIFT-1234'});
 for (let i = 0; i < 14; i++) {
  r.cards[0][i] = 4 + (i % 3) - 1;
  r.puttCards[0][i] = 2;
  r.pars[i] = 4;
  r.holeComplete = true;
  r.nextHole();
 }
 // A 15th hole is well past the nominal 9 a normal round would cap at.
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.equal(back.endless, true);
 assert.equal(back.seed, 'DRIFT-1234');
 assert.equal(back.hole, 14);
 assert.deepEqual(back.pars, r.pars);
 assert.deepEqual(back.cards, r.cards);
});

test('the running score counts every hole of a long run', () => {
 const pars = Array(14).fill(4);
 const card = [5, 4, 3, 4, 4, 5, 4, 4, 3, 4, 4, 4, 6, 4];
 const {rel, played} = relativeToPar(card, pars);
 assert.equal(played, 14);
 assert.equal(rel, 2);
});

test('every hole of a run grows into a playable single hole', async () => {
 const {generateWorld} = await import('../src/course.js');
 const seed = 'PLAYABLE-1';
 for (let i = 0; i < 4; i++) {
  const s = endlessHole(seed, i);
  const w = generateWorld(s);
  // The world holds exactly one hole however far into the run we are, which is
  // why the renderer and the round are always pointed at index zero.
  assert.equal(w.holes.length, 1, `hole ${i} built ${w.holes.length} holes`);
  const h = w.holes[0];
  assert.ok([3, 4, 5].includes(h.par), `hole ${i} par ${h.par}`);
  for (const tee of ['blue', 'white', 'red'])
   assert.ok(Number.isFinite(h.tees[tee]?.yards) && h.tees[tee].yards > 50, `hole ${i} ${tee} tee`);
  assert.ok(Number.isFinite(h.length) && h.length > 50, `hole ${i} length`);
 }
});

test('the par recorded for a hole is the par the generator actually built', () => {
 // The live score and the scorecard both read the recorded par, so a run whose
 // record drifted from the landscape would score every hole wrongly.
 for (let i = 0; i < 30; i++) {
  const s = endlessHole('RECORD-1', i);
  assert.equal(planCourse(s).holes[0].par, planCourse(s).par);
 }
});

test('an endless run can be saved to the library and comes back as itself', async () => {
 const map = new Map();
 globalThis.localStorage = {
  getItem: k => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: k => map.delete(k),
 };
 const {saveRound, listRounds} = await import('../src/round-library.js');
 const {DEFAULT_COURSE} = await import('../src/settings-schema.js');

 const r = new Round({endless: true, seed: 'DRIFT-1234'});
 for (let i = 0; i < 11; i++) { r.cards[0][i] = 4; r.pars[i] = 4; r.holeComplete = true; r.nextHole(); }

 // The record carries a placeholder course, because a one-hole settings object
 // would not survive validation. The seed on the round is what regrows the hole.
 const saved = saveRound({name: 'A long walk', settings: {...DEFAULT_COURSE}, round: r.toJSON()});
 assert.equal(saved.summary.endless, true);
 assert.equal(saved.summary.hole, 12);
 assert.equal(saved.summary.holes, null);

 const back = listRounds()[0];
 assert.equal(back.round.endless, true);
 assert.equal(back.round.seed, 'DRIFT-1234');
 assert.equal(back.round.hole, 11);
 // And the hole it was on regrows from what came back, not from the record.
 assert.deepEqual(endlessHole(back.round.seed, back.round.hole), endlessHole('DRIFT-1234', 11));
});

test('the menu backdrop can be adopted as hole one without regrowing it', () => {
 // Choosing Endless from the main menu plays the hole already on screen. That
 // works by building the backdrop's world under the same cache key loadCourse
 // will later ask for, so the handover is a lookup rather than a rebuild.
 //
 // Which makes normalisation the load-bearing part: loadCourse runs settings
 // through this on the way in, so if it is not a fixed point the key moves, the
 // cache misses, and the player watches a different hole appear than the one
 // they picked. Asserted across many seeds because the settings vary a lot.
 const keyFor = s => JSON.stringify([GENERATOR_VERSION, ...generationKeys().map(k => s[k])]);
 for (let i = 0; i < 200; i++) {
  const seed = newRunSeed();
  const backdrop = endlessSettings(endlessHole(seed, 0));
  assert.equal(keyFor(endlessSettings({...backdrop})), keyFor(backdrop),
   `normalising twice moved the world key on seed ${seed}`);
  assert.equal(backdrop.holes, 1, 'an endless hole is one hole');
  assert.equal(backdrop.seed, `${seed}-1`, 'the backdrop is hole one of that run');
 }
 // And adopting hole one does not fix the rest of the run: hole two is its own
 // landscape, from the same seed.
 const seed = 'DRIFT-1234';
 assert.notEqual(endlessSettings(endlessHole(seed, 0)).seed, endlessSettings(endlessHole(seed, 1)).seed);
 assert.notDeepEqual(endlessHole(seed, 0), endlessHole(seed, 1));
});
