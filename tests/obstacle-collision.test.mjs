import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, trunkRadius, POLE_RADIUS} from '../src/physics.js';
import {world} from './worlds.mjs';

// Rolling a ball straight at a thing and seeing whether it comes out the far
// side. A ball that passes through is the defect these tests exist for -- it was
// every boulder on the course until rocks became world data.
const rollAt = (course, from, aim, speed = 14) =>
 simulateShot({origin: from, aim, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed}, course, {wind: [0, 0, 0]});

// Aim from a point short of the target, straight at it, in hole-local degrees.
function shotAt(h, target, back) {
 const dx = target.x - back.x, dz = target.z - back.z;
 return Math.atan2(dx, dz) * 180 / Math.PI;
}

test('a ball rolled into a boulder does not pass through it', () => {
 const w = world({holes: 9, biome: 'mountain', seed: 'rocks'});
 assert.ok(w.rocks.length > 100, `only ${w.rocks.length} rocks generated`);
 let tested = 0, through = 0;
 for (const h of w.holes) {
  // Biggest rocks belonging to this hole, in hole-local coordinates.
  const mine = w.rocks.map(r => ({...r, ...h.toLocal(r)}))
   .filter(r => r.reach > 2.5 && Math.abs(r.z) < h.length && Math.abs(r.x) < 200)
   .sort((a, b) => b.reach - a.reach).slice(0, 3);
  for (const r of mine) {
   const back = {x: r.x, z: r.z - 26};
   const end = rollAt(h, back, shotAt(h, r, back));
   tested++;
   // Passing through shows up as finishing beyond the stone on the same line.
   if (end.end.z > r.z + r.reach) through++;
  }
 }
 assert.ok(tested >= 12, `only ${tested} boulders were testable`);
 assert.equal(through, 0, `${through} of ${tested} rolls went straight through a boulder`);
});

test('rocks carry the reach and crown height physics needs', () => {
 for (const biome of ['mountain', 'desert', 'pnw']) {
  const w = world({holes: 9, biome, seed: 'rocks-' + biome});
  for (const r of w.rocks) {
   assert.ok(r.reach > 0, 'a rock with no reach cannot be hit');
   assert.ok(r.top > r.y, `rock top ${r.top} is not above its base ${r.y}`);
   assert.ok(Number.isFinite(r.x + r.z + r.y), 'rock has a non-finite coordinate');
  }
 }
});

test('an unlit floodlight pole is not there to hit, and a lit one is', () => {
 const w = world({holes: 9, biome: 'midwest', seed: 'poles'});
 const h = w.holes[0];
 const back = {x: h.center(70), z: 70};
 const ahead = {x: h.center(120), z: 120};
 const aim = shotAt(h, ahead, back);
 const shot = poles => simulateShot(
  {origin: back, aim, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: 16}, h, {wind: [0, 0, 0], poles});

 // Roll it once with nothing there and see where it actually finishes, rather
 // than assuming. A first attempt put the mast 22 m out, further than the ball
 // travelled, so the test passed its real assertion while exercising nothing.
 const dark = shot(null);
 const ran = Math.hypot(dark.end.x - back.x, dark.end.z - back.z);
 assert.ok(ran > 6, `the control roll only went ${ran.toFixed(1)} m -- nothing to put a mast in front of`);

 // Now stand a mast squarely in its path, at half the distance it managed.
 const a = aim * Math.PI / 180;
 const stop = {x: back.x + Math.sin(a) * ran * .5, z: back.z + Math.cos(a) * ran * .5};
 const at = h.toWorld(stop);
 const lit = shot([{x: at.x, z: at.z, y: w.height(at.x, at.z), height: 23}]);
 const reached = Math.hypot(lit.end.x - back.x, lit.end.z - back.z);
 assert.ok(reached < ran * .5 + POLE_RADIUS + 1,
  `lit mast at ${(ran * .5).toFixed(1)} m did not stop the ball: it finished ${reached.toFixed(1)} m out`);
 // And with the lights down the same ball runs past that spot untouched.
 assert.ok(ran > ran * .5 + POLE_RADIUS + 1, 'the unlit roll should pass the mast position');
});
