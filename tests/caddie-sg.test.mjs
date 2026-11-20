// A CADDIE'S SUGGESTION (src/caddie.js) and STROKES GAINED
// (src/strokes-gained.js); the fairway-tour goal, Q13.
import test from 'node:test';
import assert from 'node:assert/strict';
import {suggest, suggestSteps} from '../src/caddie.js';
import {computerGolfer, golferBag, lieAt} from '../src/ai/golfer.js';
import {skillFor} from '../src/ai/skill.js';
import {holeGained, shotValue, partOf, addGained, gainedText} from '../src/strokes-gained.js';
import {STARTING_COURSE} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

const YARD = .9144, FOOT = .3048;

test('the caddie suggests what the computer golfer of the same handicap and bag would play', () => {
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings), h = w.holes[1];
 const bag = golferBag(skillFor(12)), from = {...h.tees[Object.keys(h.tees)[0]]};
 const s = suggest({hole: h, from, bag, handicap: 12, settings});
 const own = computerGolfer({handicap: 12, bag, settings}).plan(h, from, lieAt(h, from.x, from.z));
 assert.equal(s.club, own.id);
 assert.deepEqual(s.target, own.target);
 assert.match(s.line, / yd$/);
 assert.equal(suggest({hole: h, from: {...h.pin, z: h.pin.z - 2}, bag, handicap: 12, settings}), null, 'on the green: nothing to suggest');
 // In steps (the game spreads them over frames): the same suggestion.
 const it = suggestSteps({hole: h, from, bag, handicap: 12, settings});
 let r, steps = 0;
 while (!(r = it.next()).done) steps++;
 assert.ok(steps >= 1);
 assert.deepEqual(r.value, s);
});

test('strokes gained: a scratch golfer\'s par is zero; the parts', () => {
 // A 400-yd par 4: drive to 140 yd in the fairway, iron to 20 ft, two putts.
 const shots = [
  {from: {surface: 'tee', metres: 400 * YARD}, to: {surface: 'fairway', metres: 140 * YARD}},
  {from: {surface: 'fairway', metres: 140 * YARD}, to: {surface: 'green', metres: 20 * FOOT}},
  {from: {surface: 'green', metres: 20 * FOOT}, to: {surface: 'green', metres: 2 * FOOT}},
  {from: {surface: 'green', metres: 2 * FOOT}, to: null}];
 const g = holeGained(shots, 4);
 assert.ok(Math.abs(g.total - (shots.reduce((s, x) => s + shotValue(x), 0))) < 1e-9);
 assert.equal(partOf({surface: 'tee', metres: 380 * YARD, first: true, par: 4}), 'tee');
 assert.equal(partOf({surface: 'tee', metres: 170 * YARD, first: true, par: 3}), 'approach', 'a par 3 tee shot is an approach');
 assert.equal(partOf({surface: 'sand', metres: 20 * YARD}), 'short');
 assert.equal(partOf({surface: 'green', metres: 3}), 'putting');
 // Water off the tee costs about a stroke and a half more than the fairway.
 const wet = shotValue({from: {surface: 'tee', metres: 400 * YARD}, to: {surface: 'rough', metres: 250 * YARD}, penalty: 1});
 assert.ok(wet < shotValue(shots[0]) - 1);
 assert.equal(gainedText(1.24), '+1.2'); assert.equal(gainedText(-0.86), '-0.9');
 const sum = addGained([g, g, null]);
 assert.ok(Math.abs(sum.total - 2 * g.total) < 1e-9);
});

test('a hole\'s strokes gained are kept on the profile and summed', async () => {
 const {blankProfile, syncHole, gainedSummary} = await import('../src/profile.js');
 const p = blankProfile('Alex'), meta = {id: 'r1', me: 0, mode: 'stroke', players: ['Alex'], tee: 'white', holes: 9, endless: false, course: {name: 'X', settings: {}, seed: 'X', biome: 'pacnw', generator: 1, schema: 1}};
 syncHole(p, meta, {index: 0, par: 4, yards: 400, score: 5, putts: 2, gained: {tee: -.4, approach: -.6, short: 0, putting: .1}});
 syncHole(p, meta, {index: 1, par: 4, yards: 380, score: 4, putts: 2});
 const g = gainedSummary(p);
 assert.equal(g.holes, 1, 'a hole kept without them is left out');
 assert.ok(Math.abs(g.total - (-.9)) < 1e-9);
 assert.equal(gainedSummary({rounds: []}).holes, 0);
});
