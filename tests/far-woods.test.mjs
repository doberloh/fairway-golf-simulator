import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {farWoodSites} from '../src/far-woods.js';
import {tierOf} from '../src/graphics.js';

// The far woods (the polish goal): scenery crowns from the property line out
// past the ground's edge, closing the bare band before the painted forest.
test('far woods stand outside the course, out of the water, the same every time', () => {
 const w = generateWorld({seed: 'FARWOODS', biome: 'autumn', holes: 9});
 const a = farWoodSites(w), b = farWoodSites(w);
 assert.ok(a.length > 2000, `${a.length} crowns`);
 assert.deepEqual(a, b, 'deterministic');
 for (const s of a) {
  assert.ok(Math.abs(s.x) > w.halfX || Math.abs(s.z) > w.halfZ, 'never inside the property, where the real stands are');
  assert.ok(s.y >= .5, 'never in water');
 }
 // The band right outside the property line is wooded, not bare.
 const band = a.filter(s => Math.abs(s.x) > w.halfX && Math.abs(s.x) < w.halfX + 60 && Math.abs(s.z) < w.halfZ * .8);
 assert.ok(band.length > 20, `${band.length} crowns in the first 60 m past the property line`);
 // And the woods run out to the landscape's edge (the owner: never bare
 // ground), coarser with distance: every kilometre band out to 12 km holds
 // crowns, each band's spacing wider than the one before.
 const out = s => Math.hypot(Math.max(0, Math.abs(s.x) - w.halfX), Math.max(0, Math.abs(s.z) - w.halfZ));
 let last = 0;
 for (let km = 0; km < 12; km++) {
  const ring = a.filter(s => out(s) >= km * 1000 && out(s) < (km + 1) * 1000);
  assert.ok(ring.length > 0, `no woods ${km}-${km + 1} km out`);
  const r = ring.reduce((m, s) => m + s.r, 0) / ring.length;
  assert.ok(r >= last, `crowns shrink with distance at ${km} km`);
  last = r;
 }
});

test('a landscape with no far forest grows no far woods; Low and Medium draw them as groves, never not at all', () => {
 assert.equal(farWoodSites(generateWorld({seed: 'FARWOODS', biome: 'island', holes: 9})).length, 0);
 assert.equal(tierOf('low').farWoods, 'groves');
 assert.equal(tierOf('medium').farWoods, 'groves');
 for (const t of ['high', 'ultra']) assert.equal(tierOf(t).farWoods ?? true, true);
});
