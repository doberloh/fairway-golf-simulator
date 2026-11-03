import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {lifeSet} from '../src/life.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// LIFE ON THE COURSE (architect-courses, phase 6; life.js): every landscape's
// own animals, out of play, on every generated course (an Architect course's
// alone until the designer was removed, 2 November 2026; its people and its
// age dial's hollows and stumps went with it).

const PLAYED = ['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water'];
const course = biome => world({seed: 'LIFE-1', holes: 9, biome});

test('every landscape has its own animals', () => {
 for (const biome of BIOME_KEYS) {
  const w = course(biome), kinds = new Set(w.life.map(l => l.kind)), set = lifeSet(biome);
  if (set.grazers) assert.ok(kinds.has(set.grazers[0]), `${biome}: no ${set.grazers[0]}`);
  if (set.fliers) assert.ok(kinds.has(set.fliers[0]), `${biome}: no ${set.fliers[0]}`);
  assert.ok(!kinds.has('walker') && !kinds.has('mower'), `${biome}: a person on the course`);
 }
});

test('the animals stay out of play and out of the trees', () => {
 for (const biome of ['links', 'heartland', 'redwood', 'puget']) {
  const w = course(biome);
  for (const l of w.life) {
   if (l.r !== undefined) { assert.ok(l.up >= 25, 'a bird low over play'); continue; }
   const [x, z] = [l.x, l.z];
   assert.ok(!PLAYED.includes(w.surface(x, z)), `${biome}: a ${l.kind} on ${w.surface(x, z)}`);
   if (l.kind !== 'goose' && l.kind !== 'heron') assert.ok(w.nearest(x, z).d > 20, `${biome}: a ${l.kind} ${w.nearest(x, z).d.toFixed(0)} m from play`);
   for (const t of w.trees) if (!t.under) assert.ok(Math.hypot(t.x - x, t.z - z) > .6, `${biome}: a ${l.kind} inside a ${t.kind}`);
  }
 }
});
