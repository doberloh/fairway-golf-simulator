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
 // The polish goal (26 October 2026) joins fewer, longer overlaps -- the
 // owner: "it shouldn't look forced" -- and counts only joins that really
 // touch (several earlier "shared" holes were bulges facing each other across
 // rough), so two to four holes a course share, not four to six; was
 // `total >= 10`.
 assert.ok(total >= 6, `only ${total} holes shared across three courses`);
});

// THE POLISH GOAL'S RULES FOR A SHARED FAIRWAY: never one-sided (a bulge
// toward a fairway that did not come to meet it), and never a sliver of rough
// between two fairways that nearly touch -- a join, or a clear strip.
test('a shared fairway always has a partner, and near fairways leave a strip or join', () => {
 for (const seed of ['overhaul', 'S1', 'S3']) {
  const w = links(seed), H = w.holes;
  const touches = (a, b) => {
   let slivers = 0, touch = 0;
   for (let z = (a.mowStart ?? 22); z < a.length - 10; z += 6) for (const side of [-1, 1]) {
    const wd = side < 0 ? a.leftWidth(z) : a.rightWidth(z);
    for (let t = wd + .5; t < wd + 12; t += .5) {
     const p = b.toLocal(a.toWorld({x: a.center(z) + side * t, z}));
     if (p.z < 0 || p.z > b.length) continue;
     const off = p.x - b.center(p.z);
     if (Math.abs(off) <= (off < 0 ? b.leftWidth(p.z) : b.rightWidth(p.z))) { if (t - wd < 1.5) touch++; else if (t - wd < 8) slivers++; break; }
    }
   }
   return {slivers, touch};
  };
  for (const h of H.filter(h => h.sharedFairway))
   assert.ok(H.some(o => o !== h && o.sharedFairway && touches(h, o).touch > 0), `${seed}: hole ${h.hole + 1} shares alone`);
  for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
   const {slivers} = touches(H[i], H[j]);
   assert.ok(slivers <= 3, `${seed}: holes ${i + 1} and ${j + 1} leave a sliver of rough at ${slivers} places`);
  }
 }
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
