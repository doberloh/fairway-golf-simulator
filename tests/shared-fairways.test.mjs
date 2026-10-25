// SHARED LINKS FAIRWAYS (the cartoon overhaul; course.js shareFairways,
// routing.js `routeParallel`): a links routes holes out and back side by side
// and their fairways meet. These hold that it happens, that it happens only
// where asked, and that a merged strip is fairway on the ground the game reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, shareFairways} from '../src/course.js';
import {BIOMES} from '../src/biomes.js';

const links = seed => generateWorld({seed, biome: 'links', holes: 18, trees: 60, homes: true});

test('an 18-hole links shares fairways between holes running side by side', () => {
 let total = 0;
 for (const seed of ['overhaul', 'S1', 'S3']) {
  const w = links(seed), shared = w.holes.filter(h => h.sharedFairway);
  assert.ok(shared.length >= 2, `${seed}: ${shared.length} holes share a fairway`);
  total += shared.length;
  for (const h of shared) assert.ok(h.length >= 250, `${seed}: a par 3 was widened`);
 }
 assert.ok(total >= 10, `only ${total} holes shared across three courses`);
});

test('only a biome that asks for it shares fairways or routes side by side', () => {
 for (const [key, bio] of Object.entries(BIOMES)) if (key !== 'links') {
  assert.ok(!bio.sharedFairways && !bio.routeParallel && !bio.fairwayScale, `${key} shares`);
 }
 const w = generateWorld({seed: 'overhaul', biome: 'pnw', holes: 18, trees: 60, homes: true});
 assert.equal(w.holes.filter(h => h.sharedFairway).length, 0);
});

test('a shared strip is fairway in the world, midway between the two holes', () => {
 const w = links('S3');
 let checked = 0;
 for (const h of w.holes.filter(h => h.sharedFairway)) {
  for (let z = h.length * .3; z < h.length * .7; z += 10) {
   for (const side of [-1, 1]) {
    const reach = side < 0 ? h.leftWidth(z) : h.rightWidth(z);
    if (reach < 40) continue;
    // Just inside the widened edge: fairway, not rough.
    const p = h.toWorld({x: h.center(z) + side * (reach - 3), z});
    const s = w.surface(p.x, p.z);
    assert.ok(['fairway', 'bunker', 'sand', 'water'].includes(s) || s === 'green', `hole ${w.holes.indexOf(h) + 1} at ${z | 0} m: ${s}`);
    checked++;
   }
  }
 }
 assert.ok(checked > 5, `only ${checked} widened stations found`);
});

test('sharing is reproducible and leaves a lone hole alone', () => {
 assert.deepEqual(links('S1').holes.map(h => !!h.sharedFairway), links('S1').holes.map(h => !!h.sharedFairway));
 // A single hole has nobody to share with.
 const w = generateWorld({seed: 'S1', biome: 'links', holes: 18, trees: 60, homes: true});
 const h = w.holes[0], before = h.leftWidth(h.length / 2);
 shareFairways([h], BIOMES.links.sharedFairways);
 assert.equal(h.leftWidth(h.length / 2), before);
});
