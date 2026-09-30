import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, greenDistance} from '../src/course.js';
import {greenContour} from '../src/course-plan.js';

// Raised greens, punchbowl greens and false fronts (GENERATOR_VERSION 33), and
// the per-green characters that replaced one recipe for every green.

const BASE = {seed: 'GREENTYPES', holes: 9, trees: 0, water: 0, bunkerCount: 0, elevation: 0, landform: 0};
// Height of the green itself against the ground a few metres beyond its collar,
// along the line back toward the tee.
const standing = (w, h) => {
 const on = h.height(h.green.x, h.green.z);
 const reach = h.greenSize ?? 17;
 let z = h.green.z - reach;
 while (greenDistance(h, h.green.x, z) < w.settings.fringe + 9) z -= .5;
 return on - h.height(h.green.x, z);
};

test('at 100% every green is raised, and stands clear of the ground around it', () => {
 const w = generateWorld({...BASE, raisedGreens: 100, sunkenGreens: 0, falseFronts: 0, greenDifficulty: 0});
 for (const h of w.holes) assert.ok(standing(w, h) > .6, `hole ${h.hole + 1} stands only ${standing(w, h).toFixed(2)} m proud`);
});

test('at 100% every green is a punchbowl, set down into the ground', () => {
 const w = generateWorld({...BASE, raisedGreens: 0, sunkenGreens: 100, falseFronts: 0, greenDifficulty: 0});
 for (const h of w.holes) assert.ok(standing(w, h) < -.4, `hole ${h.hole + 1} sits only ${standing(w, h).toFixed(2)} m down`);
});

test('at 0% no green is raised or sunk, and the putting surface is untouched either way', () => {
 const flat = generateWorld({...BASE, raisedGreens: 0, sunkenGreens: 0, falseFronts: 0, greenDifficulty: 0});
 for (const h of flat.holes) assert.ok(Math.abs(standing(flat, h)) < .05);
 // A pedestal lifts the green as one piece: level greens stay level on top.
 const raised = generateWorld({...BASE, raisedGreens: 100, sunkenGreens: 0, falseFronts: 0, greenDifficulty: 0});
 for (const h of raised.holes) {
  const c = h.height(h.green.x, h.green.z);
  for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
   if (greenDistance(h, h.green.x + dx, h.green.z + dz) > -1) continue;
   assert.ok(Math.abs(h.height(h.green.x + dx, h.green.z + dz) - c) < .01, 'a raised level green is not level');
  }
 }
});

test('a false front falls away toward the fairway, and only at the front', () => {
 const on = generateWorld({...BASE, raisedGreens: 0, sunkenGreens: 0, falseFronts: 100, greenDifficulty: 50});
 const off = generateWorld({...BASE, raisedGreens: 0, sunkenGreens: 0, falseFronts: 0, greenDifficulty: 50});
 for (let i = 0; i < on.holes.length; i++) {
  const h = on.holes[i], o = off.holes[i], reach = h.greenSize ?? 17;
  // The very front of the green is lower with the false front than without it.
  const front = {x: h.green.x, z: h.green.z - reach * .92};
  if (greenDistance(h, front.x, front.z) > 0) continue;
  const drop = greenContour(o, front.x, front.z) - greenContour(h, front.x, front.z);
  assert.ok(drop > .2, `hole ${i + 1}: the front drops only ${drop.toFixed(2)} m`);
  // The back of the green is not touched.
  const back = {x: h.green.x, z: h.green.z + reach * .5};
  assert.ok(Math.abs(greenContour(o, back.x, back.z) - greenContour(h, back.x, back.z)) < 1e-9);
 }
});

test('greens have characters of their own, not one recipe', () => {
 // The shape of each green's surface, sampled on a grid and reduced to a
 // signature; across 27 greens there have to be many distinct ones, and
 // tiered greens -- the look that used to be on nearly every green -- are a
 // minority.
 const sigs = new Set();
 let stepped = 0, total = 0;
 for (const seed of ['VAR1', 'VAR2', 'VAR3']) {
  const w = generateWorld({...BASE, seed, raisedGreens: 0, sunkenGreens: 0, falseFronts: 0, greenDifficulty: 60});
  for (const h of w.holes) {
   total++;
   const row = [];
   let steepest = 0;
   for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
    const x = h.green.x + dx, z = h.green.z + dz, e = .5;
    row.push(Math.round(greenContour(h, x, z) * 20));
    steepest = Math.max(steepest, Math.hypot(greenContour(h, x + e, z) - greenContour(h, x - e, z), greenContour(h, x, z + e) - greenContour(h, x, z - e)) / (2 * e));
   }
   sigs.add(row.join(','));
   if (steepest > .08) stepped++;
  }
 }
 assert.equal(sigs.size, total, 'two greens came out the same shape');
 assert.ok(stepped / total < .5, `${stepped} of ${total} greens carry a face over 8% at 60% difficulty`);
});
