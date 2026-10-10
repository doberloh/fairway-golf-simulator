import test from 'node:test';
import assert from 'node:assert/strict';
import {LAUNCH, launchCorridors, blocksLaunch, fairwayAim} from '../src/course.js';
import {trunkRadius} from '../src/physics.js';
import {world} from './worlds.mjs';

// THE SHOT A HOLE ASKS FOR. A par three is played to the green; anything longer
// gets a drive. Firing a fixed 210 m from every tee measured trees BEHIND THE
// GREEN on par threes and called them blockers -- that mistake produced 14 false
// failures before it was caught, so the rule lives here where it can be read.
const shot = (h, tee) => {
 const local = fairwayAim(h, tee, LAUNCH.reach);
 return {local, carry: Math.hypot(local.x - tee.x, local.z - tee.z)};
};
const BALL_CLEAR = 1.2, APEX_PER = 30 / 210;

function blockers(w, h, tee) {
 const from = h.toWorld(tee), {local, carry} = shot(h, tee), tw = h.toWorld(local);
 const a = Math.atan2(tw.x - from.x, tw.z - from.z), dx = Math.sin(a), dz = Math.cos(a);
 const apex = carry * APEX_PER, ground = w.height(from.x, from.z), out = [];
 for (const t of w.trees) {
  const r = trunkRadius(t); if (!r) continue;
  const lx = t.x - from.x, lz = t.z - from.z, along = lx * dx + lz * dz;
  if (along < 8 || along > carry) continue;
  if (Math.abs(lx * dz - lz * dx) > r + BALL_CLEAR) continue;
  const s = along / carry, y = 4 * apex * s * (1 - s) + ground;
  if (y < t.y || y > t.y + t.h) continue;
  out.push({along, kind: t.kind, hole: h.hole + 1});
 }
 return out;
}

const CASES = ['pnw', 'redwood', 'midwest', 'mountain', 'links', 'autumn', 'desert', 'island', 'haunted'];

test('no tee shot has a trunk on the line the hole asks for', () => {
 // Measured at 4.5% of 648 before the launch corridor existed, the close ones
 // 8 to 20 m off the tee.
 //
 // FEATURES ARE OFF HERE ON PURPOSE. A specimen tree standing in the middle of
 // a fairway IS on this line -- that is what it is for, and you play to the
 // side of it. What makes it fair is the gap beside it, which
 // fairway-features.test.mjs asserts. Leaving them on would have this test
 // quietly forbid the thing slice 3 exists to build.
 const bad = [];
 for (const biome of CASES) {
  const w = world({holes: 9, biome, seed: 'corridor-' + biome, fairwayFeature: 0});
  for (const h of w.holes) for (const tee of Object.values(h.tees))
   for (const b of blockers(w, h, tee)) bad.push(`${biome} hole ${b.hole} ${b.kind} at ${b.along.toFixed(0)} m`);
 }
 assert.deepEqual(bad, [], `blocked tee shots:\n  ${bad.join('\n  ')}`);
});

test('the corridor only looks forward, so trees beside and behind a tee survive', () => {
 // Deliberate: trees around a tee box are wanted. They give it something to sit
 // in and they break up the basin the terracing leaves. A bubble would kill them.
 const w = world({holes: 9, biome: 'pnw', seed: 'corridor-pnw', fairwayFeature: 0});
 const corr = launchCorridors(w.holes);
 let beside = 0, behind = 0;
 for (const h of w.holes) for (const tee of Object.values(h.tees)) {
  const from = h.toWorld(tee), aim = h.toWorld(fairwayAim(h, tee, LAUNCH.reach));
  const a = Math.atan2(aim.x - from.x, aim.z - from.z), dx = Math.sin(a), dz = Math.cos(a);
  for (const t of w.trees) {
   const lx = t.x - from.x, lz = t.z - from.z;
   const along = lx * dx + lz * dz, off = Math.abs(lx * dz - lz * dx);
   if (Math.hypot(lx, lz) > 45) continue;
   if (along < 0) behind++; else if (off > LAUNCH.near) beside++;
  }
 }
 assert.ok(behind > 0, 'no tree stands behind any tee -- the keep-out is not forward-only');
 assert.ok(beside > 0, 'no tree stands beside any tee');
});

test('the corridor asks about height, not just distance', () => {
 const w = world({holes: 9, biome: 'pnw', seed: 'corridor-pnw', fairwayFeature: 0});
 const h = w.holes[0], tee = h.tees.blue, corr = launchCorridors(w.holes, w.height);
 const from = h.toWorld(tee), aim = h.toWorld(fairwayAim(h, tee, LAUNCH.reach));
 const a = Math.atan2(aim.x - from.x, aim.z - from.z), dx = Math.sin(a), dz = Math.cos(a);
 const at = d => [from.x + dx * d, from.z + dz * d];
 const ground = d => w.height(...at(d));
 // A full-height tree on the line is refused wherever it stands.
 assert.ok(blocksLaunch(corr, ...at(30), ground(30), ground(30) + 25), '30 m out, a tall tree is allowed');
 assert.ok(blocksLaunch(corr, ...at(120), ground(120), ground(120) + 80),
  '120 m out, an 80 m tree is allowed -- this is the redwood fir that got through a fixed-length wedge');
 // A knee-high thing far out is under the ball and may stay.
 assert.ok(!blocksLaunch(corr, ...at(150), ground(150), ground(150) + 1.5),
  '150 m out, a boulder is refused -- the ball is thirty metres over it');
 // Behind the tee is never protected: that is the whole point of a wedge.
 assert.ok(!blocksLaunch(corr, ...at(-25), ground(-25), ground(-25) + 25),
  'ground behind the tee is being protected');
});

test('the corridor rejects candidates without thinning the forest', () => {
 // The placement loop has attempts in hand, so a rejection should cost an
 // attempt and not a tree.
 //
 // ISLAND IS THE EXCEPTION AND IT IS NOT THIS CHANGE'S DOING. It is mostly sea,
 // so it runs out of rough to plant in and falls short of target on its own:
 // measured at 1233 of 1638 before the launch corridor existed and 1227 after,
 // a cost of six trees. Asserting "equals target" there would be blaming the
 // corridor for the ocean.
 const SEA_LIMITED = {island: 1200};
 for (const biome of CASES) {
  const w = world({holes: 9, biome, seed: 'corridor-' + biome, fairwayFeature: 0});
  const {trees: perHole, holes} = w.settings;
  const target = Math.round(perHole * holes * w.bio.treeDensity);
  const floor = SEA_LIMITED[biome];
  if (floor === undefined)
   assert.equal(w.trees.length, target, `${biome} placed ${w.trees.length} of ${target}`);
  else
   assert.ok(w.trees.length >= floor,
    `${biome} placed ${w.trees.length}, below its ${floor} floor -- the corridor is now costing real trees`);
 }
});

test('trees encroach on a tee instead of standing back from it in a ring', () => {
 // The tee surround used to run at 19-50% of the course average and it read as
 // a clear-cut. The cause was `nearest().d`, which is SIGNED: it measures
 // distance outside a hole's corridor ENVELOPE, and near a tee that envelope is
 // far wider than the mown turf -- 99% of the rough around a tee sits at a
 // negative d, as deep as -34 m. "At least 10 m outside" therefore banned the
 // whole surround while the surface classifier called that same ground rough.
 //
 // MEASURED OVER SEVERAL SEEDS, because one seed says very little here: the
 // same biome ranges 65% to 88% across seeds, and a single-seed threshold would
 // be pinned to whichever one it was written against. Density is per hectare of
 // ROUGH, not of ground -- mown turf can never hold a tree, so counting it in
 // the denominator would understate the rest.
 const SEEDS = ['a', 'b', 'c', 'd'];
 for (const biome of ['midwest', 'pnw', 'redwood']) {
  const each = SEEDS.map(seed => {
   const w = world({holes: 9, biome, seed});
   const tees = w.holes.flatMap(h => Object.values(h.tees).map(t => h.toWorld(t)));
   let s2 = 5;
   const rnd = () => (s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
   let n = 0, rough = 0;
   for (let i = 0; i < 30000; i++) {
    const x = (rnd() - .5) * w.halfX * 2, z = (rnd() - .5) * w.halfZ * 2;
    n++; if (w.surface(x, z) === 'rough') rough++;
   }
   const overall = w.trees.length / ((w.halfX * 2) * (w.halfZ * 2) * (rough / n) / 1e4);
   let rr = 0, rn = 0;
   for (const t of tees) for (let i = 0; i < 700; i++) {
    const ang = rnd() * 6.283, r = Math.sqrt(rnd()) * 20;
    rn++; if (w.surface(t.x + Math.cos(ang) * r, t.z + Math.sin(ang) * r) === 'rough') rr++;
   }
   const near = new Set();
   for (const t of tees) for (let i = 0; i < w.trees.length; i++)
    if (Math.hypot(w.trees[i].x - t.x, w.trees[i].z - t.z) < 20) near.add(i);
   return (near.size / (tees.length * Math.PI * 400 / 1e4 * (rr / rn))) / overall;
  });
  const mean = each.reduce((x, y) => x + y, 0) / each.length;
  const show = each.map(v => (v * 100).toFixed(0) + '%').join(', ');
  assert.ok(mean > .6,
   `${biome}: tee surrounds average ${(mean * 100).toFixed(0)}% of course density (${show}) -- the moat is back`);
  assert.ok(mean < 1.6,
   `${biome}: tee surrounds average ${(mean * 100).toFixed(0)}% (${show}) -- that is a thicket, not a frame`);
 }
});
