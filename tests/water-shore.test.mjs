// Where water meets play: a pond may reach into a fairway and leave the carry
// a golf shot, and a fairway that meets water stops behind a band of
// semi-rough -- the lie here; the matching paint is in ground.js, which no
// test can see, so change one and look at the other. Split from
// water-terrain.test.mjs (the testing audit, 31 October 2026); these tests
// read the same Pacific Northwest courses, so they stay together.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius, insideOval, fairwayWidth, NO_INLAND_WATER, BEACH_RISE} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {shoreBands} from '../src/streams.js';

test('a pond may reach into play, and the carry stays a golf shot', () => {
 // Ponds used to be anchored outside the semi-rough with no way back in, so a
 // hole could never be split. Now it can -- but a split that needs a 300 yard
 // carry is a broken hole, not a design.
 let splits = 0, holes = 0, longest = 0;
 for (const seed of ['A', 'B', 'C', 'D', 'E', 'F']) {
  const w = buildWorld({seed, biome: 'pnw', holes: 9, water: 100, rivers: 1, creeks: 2});
  for (const h of w.holes) {
   holes++;
   let run = null, best = 0;
   for (let z = 6; z < h.length - 6; z += 2) {
    const half = h.width(z);
    let across = 0, cells = 0;
    for (let x = -half; x <= half; x += 1.5) { cells++; if (h.surface(x, z) === 'water') across++; }
    if (cells && across >= cells * 0.92) { if (run === null) run = z; }
    else if (run !== null) { best = Math.max(best, z - run); run = null; }
   }
   if (best > 0) { splits++; longest = Math.max(longest, best); }
  }
 }
 assert.ok(splits > 0, 'water should be able to span a corridor');
 assert.ok(splits < holes * 0.4, `${splits} of ${holes} holes split is too many`);
 // 200 m is about 219 yards -- beyond any forced carry a course should ask for.
 assert.ok(longest < 200, `longest carry across water was ${longest.toFixed(0)} m`);
});

test('a fairway stops behind semi-rough where it meets water', () => {
 // Ponds, lakes and channels only. A coastline is not mown around -- the rough
 // runs to the dunes -- so this is asserted inland.
 let fairwayTouching = 0, semiTouching = 0;
 // Enough seeds that the band being measured actually turns up. The invariant
 // under test is `fairwayTouching === 0`, which more courses only strengthen.
 for (const seed of ['A', 'B', 'C', 'D', 'E', 'F']) {
  const w = buildWorld({seed, biome: 'pnw', holes: 9, water: 100, rivers: 1, creeks: 2});
  for (const h of w.holes) for (let z = 10; z < h.length - 10; z += 3) {
   const half = h.width(z);
   for (let x = -half; x <= half; x += 2) {
    const here = h.surface(x, z);
    if (here !== 'fairway' && here !== 'semi') continue;
    const touches = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]
     .some(([dx, dz]) => h.surface(x + dx, z + dz) === 'water');
    if (!touches) continue;
    if (here === 'fairway') fairwayTouching++; else semiTouching++;
   }
  }
 }
 assert.equal(fairwayTouching, 0, 'mown fairway running straight into water');
 assert.ok(semiTouching > 0, 'the band has to exist to be measured');
});

test('the band is switched off by a zero semi-rough setting, not floored', () => {
 // An earlier version floored it at two metres, which grew a semi-rough band
 // around water on a hole set to have none at all. The setting wins.
 //
 // Only the band is asserted: a green's fringe collar and a tee apron are both
 // reported as semi whatever this setting says, so a blanket "no semi anywhere"
 // check fails on ground that has nothing to do with water.
 const w = buildWorld({seed: 'A', biome: 'pnw', holes: 9, water: 100, semiRough: 0});
 let besideWater = 0;
 for (const h of w.holes) for (let z = 10; z < h.length - 10; z += 3) {
  const half = h.width(z);
  for (let x = -half; x <= half; x += 2) {
   if (h.surface(x, z) !== 'semi') continue;
   if ([[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]
    .some(([dx, dz]) => h.surface(x + dx, z + dz) === 'water')) besideWater++;
  }
 }
 assert.equal(besideWater, 0, 'a band appeared on a hole that asked for none');
});

test('the band sits outside the painted shore, and scales with the setting', () => {
 // Two faults in one: measured from the WATER edge the band was buried under the
 // wet and damp soil painted over it -- at a 6 m semi-rough the soil already
 // reached 7.14 m, so none of it was visible and the turf read as fairway
 // running to the shore. It is measured from the shore's outer stop now, and the
 // visible width is the hole's own semi-rough at every setting.
 for (const semiRough of [2, 6, 10, 15]) {
  const w = buildWorld({seed: 'A', biome: 'pnw', holes: 9, water: 100, semiRough});
  const reach = shoreBands(10, true, 16).outer + semiRough;
  let widest = 0;
  for (const h of w.holes) for (const p of h.ponds) for (const dir of [-1, 1]) {
   let run = 0, started = false;
   for (let d = 0; d < 40; d += .25) {
    const surface = h.surface(p.x + dir * (p.rx + d), p.z);
    if (surface === 'semi') { started = true; run += .25; }
    else if (started) break;
   }
   widest = Math.max(widest, run);
  }
  // The run outward from the water covers the shore band and then the semi.
  assert.ok(Math.abs(widest - reach) < 1.5,
   `semiRough ${semiRough}: band ran ${widest.toFixed(2)} m against ${reach.toFixed(2)} expected`);
 }
});

test('the JS shore bands still match the shader formula', () => {
 // ground.js carries its own copy in GLSL and the two drifted apart once: 0.6
 // on the wet stop and 0.25 on the damp increment here against a single 0.32
 // there. The mown band is placed from `outer`, so a drift puts green turf
 // under brown soil. These are the CUT-EDGE widths -- a lip at the waterline
 // rather than the metres-wide beach the bands used to paint.
 const k = .32, width = 10;
 const wet = (.35 + width * .05) * k, damp = wet + (.7 + width * .09) * k;
 const outer = Math.min(damp + Math.max(.4, (.8 + width * .1) * k), Math.max(damp + .4, 16));
 const js = shoreBands(width, true, 16);
 assert.ok(Math.abs(js.wet - wet) < 1e-9, 'wet stop');
 assert.ok(Math.abs(js.damp - damp) < 1e-9, 'damp stop');
 assert.ok(Math.abs(js.outer - outer) < 1e-9, 'outer stop');
 // Unmown ground keeps the full-width bank.
 assert.ok(shoreBands(width, false, 16).damp > js.damp);
});
