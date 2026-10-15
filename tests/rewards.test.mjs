import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS, KINDS, WEARABLE, DEFAULT_WORN, unlocksAt, isUnlocked, wornItem, rewardsOf, TRACERS, tracerStyle, summaryStyle, stopColour, MAX_UNLOCK_LEVEL} from '../src/rewards.js';
import {FINISH_IDS, finishColour, finishTexels, ballPixels, finishAverage, finishSurface} from '../src/ball-finishes.js';

// THE TABLE IS THE SPEC'S (7.1): its counts, nothing past 50, a starting look
// for each kind at level 1, and no id twice within a kind.
test('the reward table holds the spec\'s counts, all by level 50', () => {
 const count = k => rewardsOf(k).length;
 assert.equal(count('badge'), 11);
 assert.equal(count('tracer'), 15);
 assert.equal(count('ball'), 16);
 assert.equal(count('flourish'), 7);
 assert.equal(count('title'), 10);
 assert.equal(count('skin'), 10);
 assert.equal(count('challenge') - 2, 4, 'four challenges besides the course of the week and achievements');
 for (const r of REWARDS) {
  assert.ok(KINDS.includes(r.kind), r.kind);
  assert.ok(r.level >= 1 && r.level <= MAX_UNLOCK_LEVEL, `${r.id} at ${r.level}`);
 }
 for (const k of KINDS) {
  const ids = rewardsOf(k).map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, `${k} ids repeat`);
 }
 for (const k of ['badge', 'tracer', 'ball', 'skin']) assert.ok(rewardsOf(k).some(r => r.level === 1), `${k} has no starting look`);
 assert.deepEqual(unlocksAt(51), []);
 assert.ok(unlocksAt(50).length >= 6, 'level 50 brings the rainbow set');
});

test('every tracer and every ball finish in the table has a look, and nothing else does', () => {
 assert.deepEqual(rewardsOf('tracer').map(r => r.id).sort(), Object.keys(TRACERS).sort());
 assert.deepEqual(rewardsOf('ball').map(r => r.id).sort(), [...FINISH_IDS].sort());
});

test('a golfer wears what they have earned, and the starting look otherwise', () => {
 assert.equal(isUnlocked('tracer', 'sky', 1), false);
 assert.equal(isUnlocked('tracer', 'sky', 2), true);
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 2), 'sky');
 // XP taken back by a mulligan: the choice is kept but not worn.
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 1), 'classic');
 assert.equal(wornItem({ball: 'nonsense'}, 'ball', 50), 'classic');
 assert.equal(wornItem({}, 'title', 50), '', 'no title unless one is chosen');
 assert.equal(wornItem({title: 'legend'}, 'title', 44), '');
 assert.equal(wornItem({title: 'legend'}, 'title', 45), 'legend');
 assert.deepEqual(WEARABLE, ['ball', 'tracer', 'title']);
});

test('the summary keeps a tracer\'s shape and drops its colour', () => {
 assert.deepEqual(summaryStyle('dashed'), {dash: TRACERS.dashed.dash});
 assert.deepEqual(summaryStyle('lightning'), {jag: TRACERS.lightning.jag});
 assert.deepEqual(summaryStyle('sunset'), {});
 assert.equal(tracerStyle('nonsense'), TRACERS.classic);
 assert.deepEqual(stopColour(['#000000', '#ffffff'], .5).map(v => +v.toFixed(3)), [.5, .5, .5]);
 assert.deepEqual(stopColour(['#ff0000', '#0000ff'], 2), [0, 0, 1]);
});

// ONE SOURCE: the texture the ball wears and the picture are drawn from the
// same rule, so the colour at the middle of the picture is the colour of the
// texel looking the same way.
test('a finish paints the texture and the picture from the same rule', () => {
 for (const id of FINISH_IDS) {
  const tex = finishTexels(id, 64, 32);
  assert.equal(tex.length, 64 * 32 * 4);
  // The texel on the equator that faces +z (three's sphere: phi = pi/2 ->
  // column w/4) against the finish's own colour there.
  const k = (16 * 64 + 16) * 4, c = finishColour(id, [-Math.cos((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI), Math.cos((1 - 16.5 / 32) * Math.PI), Math.sin((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI)]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(tex[k + i] - Math.round(Math.min(1, Math.max(0, c[i])) * 255)) <= 1, `${id} texel and rule disagree`);
  const px = ballPixels(id, 40);
  assert.equal(px[3], 0, `${id}: the corner of the picture is not transparent`);
  assert.ok(px[(20 * 40 + 20) * 4 + 3] === 255, `${id}: the middle of the picture is not solid`);
  for (const v of finishAverage(id)) assert.ok(v >= 0 && v <= 1);
  assert.ok(finishSurface(id).rough > 0 && finishSurface(id).rough <= 1);
 }
});

test('the finishes look different from each other', () => {
 const avg = Object.fromEntries(FINISH_IDS.map(id => [id, finishAverage(id)]));
 const far = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
 assert.ok(far(avg.classic, avg.gold) > .3);
 assert.ok(far(avg.classic, avg['black-pearl']) > .5);
 assert.ok(far(avg.pumpkin, avg.galaxy) > .4);
 // A turned close-up shows a different side.
 const a = ballPixels('two-tone', 24, 0), b = ballPixels('two-tone', 24, .25);
 assert.notDeepEqual(a, b);
});
