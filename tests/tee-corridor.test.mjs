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

const CASES = ['pnw', 'redwood', 'midwest', 'mountain', 'links', 'autumn', 'desert', 'island'];

test('no tee shot has a trunk on the line the hole asks for', () => {
 // Measured at 4.5% of 648 before the launch corridor existed, the close ones
 // 8 to 20 m off the tee.
 const bad = [];
 for (const biome of CASES) {
  const w = world({holes: 9, biome, seed: 'corridor-' + biome});
  for (const h of w.holes) for (const tee of Object.values(h.tees))
   for (const b of blockers(w, h, tee)) bad.push(`${biome} hole ${b.hole} ${b.kind} at ${b.along.toFixed(0)} m`);
 }
 assert.deepEqual(bad, [], `blocked tee shots:\n  ${bad.join('\n  ')}`);
});

test('the corridor only looks forward, so trees beside and behind a tee survive', () => {
 // Deliberate: trees around a tee box are wanted. They give it something to sit
 // in and they break up the basin the terracing leaves. A bubble would kill them.
 const w = world({holes: 9, biome: 'pnw', seed: 'corridor-pnw'});
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
 const w = world({holes: 9, biome: 'pnw', seed: 'corridor-pnw'});
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
  const w = world({holes: 9, biome, seed: 'corridor-' + biome});
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
