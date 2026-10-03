import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius} from '../src/course.js';
import {worlds} from './worlds.mjs';

// A BUNKER SITS WHOLLY ON ITS OWN HOLE'S GROUND (generator 34).
//
// The ground shader paints only the hazards of the hole that owns a patch of
// ground, by the owner atlas's rule: a large lake's hole within 7 m of it, else
// the nearest hole. A bunker reaching onto ground a neighbour owns was dug out
// there but painted and played as the neighbour's rough -- a grassed-over bowl
// with a white sliver along a staircase edge. These two courses each had two
// such bunkers before the rule existed (`node tools/bench.mjs bunkers`).
// The ring is the excavation's reach, 1.15 of the outline.
test('every bunker, sand and lip, is on ground its own hole owns', () => {
 const fixture = {holes: 9, trees: 0, rivers: 1, creeks: 2, water: 60, lakes: 1};
 let checked = 0;
 for (const w of worlds([{...fixture, seed: 'S1', biome: 'pnw'}, {...fixture, seed: 'S1', biome: 'desert'}]))
  for (const h of w.holes) for (const b of h.bunkers) {
   checked++;
   for (let i = 0; i < 96; i++) {
    const e = ovalRadius(b, i * Math.PI / 48), q = h.toWorld({x: b.x + e.x * 1.15, z: b.z + e.z * 1.15});
    const owner = w.lakeOwner(q.x, q.z, 7) || w.nearest(q.x, q.z).h;
    assert.equal(owner.hole, h.hole, `${w.settings.biome}/${w.settings.seed} hole ${h.hole + 1}: a bunker reaches onto hole ${owner.hole + 1}'s ground`);
   }
  }
 assert(checked > 20, `only ${checked} bunkers checked`);
});
