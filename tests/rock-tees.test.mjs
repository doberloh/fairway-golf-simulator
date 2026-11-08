// Tees up on the rock (course.js, *Tees up on the rock*; the owner, 7 November 2026): on Desert
// Mountain about 1.5 holes in 18 tee off a rock outcrop -- the tee on its flat top, well above the
// start of the fairway, its flanks painted rock -- and no other landscape grows one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';

test('Desert Mountain tees some holes off a rock outcrop, above the fairway', () => {
 let holes = 0, rock = 0;
 for (const seed of ['TROON', 'BOULDERS']) {
  const w = world({seed, biome: 'dmountain', holes: 18});
  for (const h of w.holes.filter(q => q.rockTee)) {
   holes++;
   const t = h.toWorld(h.tees.blue), z = h.mowStart ?? h.fairwayStart, f = h.toWorld({x: h.center(z), z});
   assert.equal(w.surface(t.x, t.z), 'tee', `${seed} hole ${h.hole + 1}: the back tee stands on its pad`);
   assert.ok(w.height(t.x, t.z) - w.height(f.x, f.z) > 6, `${seed} hole ${h.hole + 1}: the back tee is up on the rock`);
   // The fairway itself is untouched: mown from where it always started.
   assert.notEqual(w.surface(f.x, f.z), 'rock');
   // Not blind (the owner, round 3: rock left between the tees, "make sure we don't introduce
   // blind shots"): from eye height on the back tee, the line to the start of the fairway and on
   // 60 m clears the ground, the rock on the outcrop included.
   const eye = w.height(t.x, t.z) + 1.7, end = h.toWorld({x: h.center(z + 60), z: z + 60}), yEnd = w.height(end.x, end.z);
   for (let k = 1; k < 60; k++) {
    const a = k / 60, x = t.x + (end.x - t.x) * a, zz = t.z + (end.z - t.z) * a;
    assert.ok(w.height(x, zz) < eye + (yEnd - eye) * a + .3, `${seed} hole ${h.hole + 1}: the drive is blind ${(a * 100).toFixed(0)}% of the way`);
   }
  }
  for (const p of w.perches) for (let a = 0; a < 24; a++) {
   const x = p.cx + Math.cos(a * Math.PI / 12) * p.L * .85 * p.ux - Math.sin(a * Math.PI / 12) * p.r * .85 * p.uz;
   const z = p.cz + Math.cos(a * Math.PI / 12) * p.L * .85 * p.uz + Math.sin(a * Math.PI / 12) * p.r * .85 * p.ux;
   if (w.surface(x, z) === 'rock') rock++;
  }
 }
 assert.ok(holes >= 2 && holes <= 4, `about 1.5 holes in 18 (${holes} in two eighteens)`);
 assert.ok(rock > 6, `the outcrops' flanks are rock (${rock} of the points round them)`);
});

test('no other landscape grows a rock tee', () => {
 for (const biome of ['dresort', 'mountains', 'seaside']) {
  const w = world({seed: 'TROON', biome, holes: 9});
  assert.equal(w.holes.filter(h => h.rockTee).length, 0, biome);
  assert.equal(w.perches.length, 0, biome);
 }
});
