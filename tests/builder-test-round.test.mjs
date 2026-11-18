// THE BUILDER'S TEST ROUND (src/builder/test-round.js), on the computer
// golfers since 18 November 2026: a scratch golfer and a bogey golfer play a
// built course (here a generated nine frozen into one, freeze.js) and report
// every hole.
import test from 'node:test';
import assert from 'node:assert/strict';
import {testRound, GOLFERS} from '../src/builder/test-round.js';
import {freezeWorld} from '../src/freeze.js';
import {STARTING_COURSE} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

test('a scratch and a bogey golfer play every hole of a built nine', async () => {
 const w = world({...STARTING_COURSE, holes: 9, seed: 'AI-TEST'});
 const doc = freezeWorld(w);
 const seen = [];
 const r = await testRound(doc, {onHole: h => seen.push(h.number)});
 assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
 assert.deepEqual(r.golfers, GOLFERS.map(g => g.name));
 for (const h of r.holes) {
  assert.equal(h.strokes.length, 2);
  assert.ok(h.strokes.every(s => s >= 1 && s <= 40), `hole ${h.number}: ${h.strokes}`);
 }
 const sum = k => r.holes.reduce((s, h) => s + h.strokes[k], 0);
 assert.ok(sum(0) <= sum(1) + 2, `scratch ${sum(0)} against the bogey golfer's ${sum(1)}`);
 assert.ok(r.total > r.par - 9 && r.total < r.par + 30, `${r.total} against par ${r.par}`);
});
