import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURE, LAUNCH, launchCorridors, fairwayWidth} from '../src/course.js';
import {world} from './worlds.mjs';

// A specimen in a fairway is the one obstruction that is ALLOWED on the line of
// play -- that is what it is for. Everything here is about it being fair rather
// than absent: a route past it, far enough out to aim around, and not sitting on
// the green's doorstep.

const BIOMES = ['midwest', 'pnw', 'links', 'mountain'];
const at = (share, biome, seed) => world({holes: 9, biome, seed, fairwayFeature: share});
const featuresOf = w => [
 ...w.trees.filter(t => t.feature).map(t => ({...t, reach: t.r})),
 ...w.rocks.filter(r => r.feature),
];

test('the slider governs how often a hole gets one', () => {
 const rate = share => {
  let holes = 0, marked = 0;
  for (const biome of BIOMES) for (const seed of ['a', 'b', 'c']) {
   const w = at(share, biome, seed);
   holes += w.holes.length;
   // Count HOLES touched, not objects: a rock cluster is several stones.
   const hit = new Set();
   for (const f of featuresOf(w)) {
    const near = w.holes.map((h, i) => [i, h.toLocal(f)])
     .sort((p, q) => Math.abs(p[1].x) - Math.abs(q[1].x))[0];
    hit.add(near[0]);
   }
   marked += hit.size;
  }
  return marked / holes;
 };
 assert.equal(rate(0), 0, 'features appear with the slider at zero');
 const low = rate(25), high = rate(100);
 assert.ok(low > 0, 'the slider at 25% never places one');
 assert.ok(high > low * 2, `100% (${(100*high).toFixed(0)}%) is not clearly more than 25% (${(100*low).toFixed(0)}%)`);
});

test('every feature leaves a playable route past it', () => {
 // The difference between a feature and a wall. At least FEATURE.gap of open
 // short grass on one side, measured against the corridor it stands in.
 for (const biome of BIOMES) for (const seed of ['a', 'b', 'c']) {
  const w = at(100, biome, seed);
  for (const f of featuresOf(w)) {
   // Which hole owns it, and where it sits across that hole.
   const owner = w.holes
    .map(h => ({h, p: h.toLocal(f)}))
    .filter(({p, h}) => p.z > 0 && p.z < h.length)
    .sort((a, b) => Math.abs(a.p.x) - Math.abs(b.p.x))[0];
   if (!owner) continue;
   const {h, p} = owner;
   const half = fairwayWidth(h, p.z);
   if (half <= 0) continue;
   const centre = h.center(p.z);
   const left = (centre + half) - (p.x + f.reach);
   const right = (p.x - f.reach) - (centre - half);
   assert.ok(Math.max(left, right) >= FEATURE.gap - 1.5,
    `${biome}/${seed} hole ${h.hole + 1}: only ${Math.max(left, right).toFixed(1)} m of room either side ` +
    `(left ${left.toFixed(1)}, right ${right.toFixed(1)}, corridor half-width ${half.toFixed(1)})`);
  }
 }
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
 const APEX_PER = 30 / 210;
 for (const biome of BIOMES) for (const seed of ['a', 'b', 'c']) {
  const w = at(100, biome, seed);
  const corr = launchCorridors(w.holes, w.height);
  for (const f of featuresOf(w)) {
   const top = f.top ?? (f.y + f.h);
   for (const c of corr) {
    const lx = f.x - c.x, lz = f.z - c.z;
    const along = lx * c.dx + lz * c.dz;
    if (along < 0 || along > Math.min(c.carry, FEATURE.standoff)) continue;
    const off = Math.abs(lx * c.dz - lz * c.dx);
    if (off > Math.max(LAUNCH.near, along * Math.tan(LAUNCH.angle)) + f.reach) continue;
    const t = along / c.carry;
    const ballY = c.groundY + 4 * (c.carry * APEX_PER) * t * (1 - t);
    assert.ok(ballY < f.y || ballY > top,
     `${biome}/${seed}: a feature ${f.y.toFixed(0)}-${top.toFixed(0)} m tall stands ${along.toFixed(0)} m ` +
     `off a tee, ${off.toFixed(1)} m off the line, with the ball at ${ballY.toFixed(1)} m`);
   }
  }
 }
});

test('no feature crowds the green', () => {
 for (const biome of BIOMES) for (const seed of ['a', 'b', 'c']) {
  const w = at(100, biome, seed);
  for (const f of featuresOf(w)) {
   for (const h of w.holes) {
    const g = h.worldGreen, d = Math.hypot(f.x - g.x, f.z - g.z);
    // Only judge the hole it actually belongs to; another hole's green may run
    // close by, and that is the routing's business rather than this rule's.
    const p = h.toLocal(f);
    if (p.z < 0 || p.z > h.length || Math.abs(p.x) > 60) continue;
    assert.ok(d > FEATURE.greenKeep - 25,
     `${biome}/${seed} hole ${h.hole + 1}: a feature sits ${d.toFixed(0)} m from the green`);
   }
  }
 }
});

test('features are solid, like everything else that looks solid', () => {
 const w = at(100, 'midwest', 'a');
 const fs = featuresOf(w);
 assert.ok(fs.length > 0, 'nothing to check');
 for (const f of fs) {
  assert.ok(f.reach > 0, 'a feature with no reach cannot be hit');
  assert.ok(Number.isFinite(f.x + f.z + f.y), 'a feature has a non-finite coordinate');
 }
 // Feature trees ride in world.trees, so physics indexes them with every other
 // trunk and there is no separate path to keep working.
 assert.ok(w.trees.some(t => t.feature), 'feature trees are not in world.trees');
});
