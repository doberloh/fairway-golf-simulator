// The cosmetic skip of a rolling ball (roll-hop.js). Visual only, so what is
// pinned is that it stays small, stays random, stays switchable, and replays.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLL_HOP, createRollHop} from '../src/roll-hop.js';

// Ten seconds of rolling at a steady speed on one surface, sampled at 60 fps,
// with the feature switched ON for the run: it ships off by default (6 October)
// and these test what it does when someone turns it back on.
const run = (seed, surface, speed = 6, rolling = true, on = true) => {
 const was = ROLL_HOP.enabled;
 ROLL_HOP.enabled = on;
 try {
  const h = createRollHop(seed), lifts = [];
  for (let i = 0; i < 600; i++) lifts.push(h.step(1 / 60, speed, surface, rolling));
  return lifts;
 } finally { ROLL_HOP.enabled = was; }
};

test('it ships switched off', () => {
 assert.equal(ROLL_HOP.enabled, false, 'the roll hop is on by default; the owner asked for it off');
});
// When each hop starts, in frames.
const starts = lifts => lifts.flatMap((v, i) => v > 0 && !(lifts[i - 1] > 0) ? [i] : []);

test('it never lifts the ball higher than its surface allows', () => {
 for (const s of ['rough', 'semi', 'fairway', 'fringe', 'green'])
  assert.ok(Math.max(...run(7, s)) <= ROLL_HOP.height[s] + 1e-12, `${s} hopped too high`);
 // The heights are the owner's to tune (roll-hop.js); what holds whatever they
 // are is that a green skips least of the grass surfaces.
 for (const s of ['rough', 'semi', 'fairway', 'fringe'])
  assert.ok(Math.max(...run(7, 'green')) < Math.max(...run(7, s)), `a green skipped as much as ${s}`);
 assert.equal(Math.max(...run(7, 'sand')), 0, 'sand does not skip');
});

test('nothing in the air, nothing when slow, nothing when switched off', () => {
 assert.equal(Math.max(...run(3, 'rough', 6, false)), 0, 'a ball in the air was lifted');
 assert.equal(Math.max(...run(3, 'rough', .2)), 0, 'a ball barely moving skipped');
 assert.equal(Math.max(...run(3, 'rough', 6, true, false)), 0, 'switched off, it still skipped');
});

test('random, not a rhythm, and the same shot replays the same', () => {
 const a = run(11, 'fairway'), gaps = starts(a).slice(1).map((s, i) => s - starts(a)[i]);
 assert.ok(gaps.length > 10, `only ${gaps.length + 1} hops in ten seconds`);
 // Random arrivals spread about as widely as their mean (exponential gaps: a
 // spread-to-mean ratio near 1); a rhythm has almost none. Counting distinct
 // gap lengths was tried first and is wrong at five hops a second, where honest
 // random gaps of 10-14 frames repeat.
 const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length, sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
 assert.ok(sd / mean > .5, `the gaps between hops are too regular (spread ${(sd / mean).toFixed(2)} of the mean)`);
 assert.deepEqual(run(11, 'fairway'), a, 'the same seed skipped differently');
 assert.notDeepEqual(run(12, 'fairway'), a, 'two shots skipped identically');
});
