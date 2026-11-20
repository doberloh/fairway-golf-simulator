// OPPONENTS THAT ADAPT (src/ai/adapt.js; the fairway-tour goal). The
// opponent's handicap follows the person's form toward a close game, a
// little at a time, within its bound -- and only its handicap moves: every
// shot it plays is still a real ball from its spreads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {form, adaptHandicap, STEP, BOUND} from '../src/ai/adapt.js';
import {computerGolfer} from '../src/ai/golfer.js';
import {playHole} from '../src/ai/play.js';
import {Round} from '../src/game.js';
import {STARTING_COURSE} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

const HOLES = Array.from({length: 18}, (_, i) => ({par: [4, 4, 3, 5][i % 4], yards: [390, 410, 170, 520][i % 4]}));

test('form: strokes over what the handicap expects, scaled to eighteen', () => {
 const par = HOLES.map(h => h.par);
 assert.ok(Math.abs(form({card: par, holes: HOLES, index: 0}).per18 + 3) < 1e-9, 'par golf by a scratch golfer is 3 better than expected');
 assert.ok(form({card: par.map(p => p + 2), holes: HOLES, index: 10}).per18 > 0);
 assert.equal(form({card: [], holes: HOLES, index: 10}).played, 0);
});

test('the drift: toward the person, a step a hole at most, never past its bound', () => {
 let h = 15;
 for (let hole = 1; hole <= 18; hole++) {
  const next = adaptHandicap({base: 15, now: h, personForm: {per18: 20, played: hole}, holes: 18});
  assert.ok(Math.abs(next - h) <= STEP + 1e-9, `hole ${hole}: moved ${next - h}`);
  h = next;
 }
 assert.equal(h, 15 + BOUND, 'a person playing far worse: the opponent ends at its bound, no further');
 const one = adaptHandicap({base: 12, now: 12, personForm: {per18: -30, played: 9}, holes: 9});
 assert.equal(one, 12 - STEP, 'one hole: one step');
 assert.equal(adaptHandicap({base: 12, now: one, personForm: {per18: -30, played: 9}, holes: 9}), 12 - BOUND / 2, 'over nine holes, half the bound');
 assert.equal(adaptHandicap({base: 12, now: 12, personForm: {per18: 0, played: 0}, holes: 18}), 12, 'nothing played, nothing moves');
});

test('against a person who plays better than their handicap, it plays better; worse, worse', () => {
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings);
 const holes = w.holes.map(h => ({par: h.par, yards: h.tees.white?.yards || 350}));
 const ends = {};
 for (const plays of [0, 30]) {
  // The "person" is a computer golfer playing at `plays`, under a stated
  // handicap of 15; the opponent is Adaptive from 15.
  const person = computerGolfer({handicap: plays, seed: `person${plays}`, settings});
  const r = new Round({players: [{name: 'P', team: 'A', hand: 'RH'}], mode: 'stroke', holes: 9, putting: {mode: 'holeout'}, tee: 'white', seed: `adapt${plays}`});
  let h = 15;
  for (let i = 0; i < 9; i++) {
   playHole(r, w.holes[i], [person], {roundKey: `adapt${plays}`});
   h = adaptHandicap({base: 15, now: h, personForm: form({card: r.cards[0].slice(0, i + 1), holes: holes.slice(0, i + 1), index: 15}), holes: 9});
   if (!r.finished) r.nextHole();
  }
  ends[plays] = h;
 }
 assert.ok(ends[0] < 15, `opponent of a person playing like scratch: ${ends[0]}`);
 assert.ok(ends[30] > 15, `opponent of a person playing like a 30: ${ends[30]}`);
 assert.ok(ends[0] >= 15 - BOUND / 2 && ends[30] <= 15 + BOUND / 2);
});
