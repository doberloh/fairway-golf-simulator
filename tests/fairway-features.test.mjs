import test from 'node:test';
import assert from 'node:assert/strict';
import {measured} from './worlds.mjs';

// A specimen in a fairway is the one obstruction that is ALLOWED on the line of
// play -- that is what it is for. Everything here is about it being fair rather
// than absent: a route past it, far enough out to aim around, and not sitting on
// the green's doorstep.
//
// Thirty-six courses, built on worker threads and measured there (worlds.mjs
// `measured`; the testing audit, 31 October 2026 -- one thread, they were two
// minutes). Each test's loop over a course is in tests/measure/fairway-features.mjs.

const BIOMES = ['heartland', 'pacnw', 'seaside', 'mountains'], SEEDS = ['a', 'b', 'c'], SHARES = [0, 25, 100];
const list = SHARES.flatMap(share => BIOMES.flatMap(biome => SEEDS.map(seed => ({holes: 9, biome, seed, fairwayFeature: share}))));
const all = await measured(list, './measure/fairway-features.mjs');
const at = share => all.filter((_, i) => list[i].fairwayFeature === share);

test('the slider governs how often a hole gets one', () => {
 const rate = share => {
  const ms = at(share);
  return ms.reduce((n, m) => n + m.marked, 0) / ms.reduce((n, m) => n + m.holes, 0);
 };
 assert.equal(rate(0), 0, 'features appear with the slider at zero');
 const low = rate(25), high = rate(100);
 assert.ok(low > 0, 'the slider at 25% never places one');
 assert.ok(high > low * 2, `100% (${(100*high).toFixed(0)}%) is not clearly more than 25% (${(100*low).toFixed(0)}%)`);
});

test('every feature leaves a playable route past it', () => {
 // The difference between a feature and a wall. At least FEATURE.gap of open
 // short grass on one side, measured against the corridor it stands in.
 assert.deepEqual(at(100).flatMap(m => m.route), []);
});

test('no feature stands where a tee shot cannot get past it', () => {
 // Two ways past a specimen: round it, or over it. The gap test above
 // guarantees the first for EVERY feature; this one is about the near stretch
 // off the tee, where a tree low in the flight path is the original complaint.
 //
 // Height is the whole point. A first version of this test was purely
 // geometric and failed a feature 121 m out and 17 m off the line -- where the
 // ball is 29 m up and sails over a 25 m tree. Being 17 m to the side is
 // irrelevant when you are flying above it.
 assert.deepEqual(at(100).flatMap(m => m.tee), []);
});

test('no feature crowds the green', () => {
 // Only the hole it actually belongs to is judged; another hole's green may
 // run close by, and that is the routing's business rather than this rule's.
 assert.deepEqual(at(100).flatMap(m => m.green), []);
});

test('features are solid, like everything else that looks solid', () => {
 const m = all[list.findIndex(s => s.fairwayFeature === 100 && s.biome === 'heartland' && s.seed === 'a')];
 assert.ok(m.features > 0, 'nothing to check');
 assert.deepEqual(m.solid, []);
 // Feature trees ride in world.trees, so physics indexes them with every other
 // trunk and there is no separate path to keep working.
 assert.ok(m.featureTrees, 'feature trees are not in world.trees');
});
