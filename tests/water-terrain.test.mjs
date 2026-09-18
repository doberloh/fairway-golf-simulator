// What water is allowed to do to the ground it sits in.
//
// Three rules: water bodies belong on land, a pond is allowed to reach into
// SPLIT FROM water-terrain.test.mjs BECAUSE THE RUNNER PARALLELISES BY FILE.
// Tests inside one file run on one thread, so a file that builds forty courses
// is a forty-course serial queue however many cores are idle. This file and
// its sibling were one 326-second file -- the single longest in the suite, and
// therefore the suite's entire wall time.
// play, and a fairway that meets water stops behind a band of semi-rough.
//
// The third is HALF testable here. This file checks the lie; the matching paint
// is in ground.js and no test can see it, which is exactly how the first attempt
// shipped a perfect measurement and zero visible change. If you change one, go
// and look at the other.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius, insideOval, fairwayWidth, NO_INLAND_WATER, BEACH_RISE} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {shoreBands} from '../src/streams.js';

test('an island has no inland water at all, whatever the settings say', () => {
 // The ocean IS the water on an island: the land is a narrow strip with sea on
 // every side, so a pond is both redundant and the hardest thing to site. The
 // controls keep their values -- switching a course to island and back returns
 // the water it had -- so this is asserted at the MAXIMUM of every one of them.
 assert.ok(NO_INLAND_WATER.has('island'));
 for (const seed of ['A', 'B', 'C']) {
  const w = buildWorld({seed, biome: 'island', holes: 9,
   water: 100, lakes: 3, rivers: 2, creeks: 3});
  assert.equal(w.holes.reduce((n, h) => n + h.ponds.length, 0), 0, 'ponds on an island');
  assert.equal((w.largeLakes || []).length, 0, 'lakes on an island');
  assert.equal(w.streams.streams.length, 0, 'channels on an island');
  // And it is still surrounded by water, which is the point of the biome.
  let wet = 0, total = 0;
  for (let x = -w.halfX; x < w.halfX; x += 30) for (let z = -w.halfZ; z < w.halfZ; z += 30) {
   total++;
   if (w.surface(x, z) === 'water') wet++;
  }
  assert.ok(wet / total > .35, `only ${(wet / total * 100).toFixed(0)}% water around an island`);
 }
});

test('no watercourse is drawn on the seabed', () => {
 // Links has a coast too, and channels are laid across a span reaching well past
 // the course while the profile only ever trimmed them for the CUT budget. On a
 // coast that put stations out at sea -- 87 to 95% of them on island seeds
 // before islands stopped carrying channels at all.
 const w = buildWorld({seed: 'SEA', biome: 'links', holes: 9, rivers: 2, creeks: 3});
 let total = 0, drowned = 0;
 for (const stream of w.streams.streams || []) for (const p of stream.points || []) {
  total++;
  if (w.land(p.x, p.z) < 0) drowned++;
 }
 assert.equal(drowned, 0, `${drowned} of ${total} stream stations at sea`);
});

test('a channel is chosen for crossing the course, not for being long', () => {
 // Once runs are trimmed at the shoreline, an attempt lying entirely off the map
 // is untrimmed and therefore longest, so length alone selected it: both channels
 // on a measured links seed came back about a kilometre outside the course.
 const w = buildWorld({seed: 'TFLCsss', biome: 'links', holes: 9,
  rivers: 1, creeks: 1, elevation: 75});
 let best = 0;
 for (const stream of w.streams.streams || []) {
  const inside = stream.points.filter(p => Math.abs(p.x) <= w.halfX && Math.abs(p.z) <= w.halfZ);
  best = Math.max(best, inside.length);
 }
 assert.ok(best > 30, `no channel has more than ${best} stations on the course`);
});

test('no pond sits in the sea on a coastal course', () => {
 for (const seed of ['A', 'B', 'C', 'D']) {
  const w = buildWorld({seed, biome: 'links', holes: 9, water: 100});
  for (const h of w.holes) for (const p of h.ponds) {
   const c = h.toWorld(p);
   assert.ok(w.land(c.x, c.z) >= 0, 'a pond centre in open water');
   for (let i = 0; i < 12; i++) {
    const e = ovalRadius(p, i * Math.PI / 6, 2);
    const q = h.toWorld({x: p.x + e.x, z: p.z + e.z});
    assert.ok(w.land(q.x, q.z) >= 0, 'a pond rim reaching into open water');
   }
  }
 }
});

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
 for (const seed of ['A', 'B']) {
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

test('the beach claims rough only, never mown turf', () => {
 // Letting it take the corridor as well seemed right -- a fairway running to the
 // sea ought to have sand between it and the water -- and turned a fifth of every
 // island hole into beach, because the foreshore lowers a lot of coastal ground
 // below the sand line. Reported as "sand fairways".
 //
 // Asserted on the mown CENTRELINE, which is unambiguously fairway unless a
 // hazard is sitting on it. Lateral proxies for "this ought to be fairway" all
 // leak: the stretch between the tee and mowStart is genuinely rough, and a
 // point inside one hole's corridor can be owned by a neighbouring hole.
 for (const biome of ['island', 'links']) {
  let cells = 0;
  for (const seed of ['A', 'B', 'C']) {
   const w = buildWorld({seed, biome, holes: 9, trees: 0});
   for (const h of w.holes) for (let z = h.mowStart + 2; z < h.length - 2; z += 2) {
    const x = h.center(z);
    if (h.bunkers.some(b => insideOval(x, z, b, 0))) continue;
    if (h.ponds.some(p => insideOval(x, z, p, 0))) continue;
    cells++;
    assert.notEqual(h.surface(x, z), 'sand', `${biome} hole ${h.hole} at z=${z}`);
   }
  }
  assert.ok(cells > 500, 'not enough centreline sampled to mean anything');
 }
});

test('and there is still a beach to walk on', () => {
 // The obvious way to fix sand fairways is to stop making sand.
 const w = buildWorld({seed: 'A', biome: 'island', holes: 9, trees: 0});
 let widths = [];
 for (let z = -w.halfZ + 40; z < w.halfZ; z += 160) {
  for (let x = -w.halfX; x < w.halfX; x += 4) {
   if (w.surface(x, z) === 'water' && w.surface(x + 4, z) !== 'water') {
    let run = 0;
    for (let d = 4; d < 120; d += 2) { if (w.surface(x + d, z) === 'sand') run += 2; else break; }
    if (run > 0) widths.push(run);
    break;
   }
  }
 }
 assert.ok(widths.length > 4, 'no shoreline found to measure');
 widths.sort((a, b) => a - b);
 assert.ok(widths[Math.floor(widths.length / 2)] >= 6,
  `median beach only ${widths[Math.floor(widths.length / 2)]} m`);
 assert.ok(BEACH_RISE > 0);
});

test('a lake never lands on top of a pond', () => {
 // The separation test consulted only the lakes this pass had already placed,
 // so a lake could be dropped straight onto a pond that had existed since the
 // hole was generated: ten overlapping pairs across twelve courses. They did
 // not merely touch -- the worst pair had water surfaces 14.19 m apart, one
 // body's plane hanging over the other's basin.
 let pairs = 0, lakes = 0;
 for (const biome of ['pnw', 'mountain']) for (const seed of ['A', 'B', 'C']) {
  const w = buildWorld({seed, biome, holes: 9, water: 100, lakes: 3});
  lakes += (w.largeLakes || []).length;
  const bodies = [];
  for (const h of w.holes) for (const p of h.ponds) bodies.push({h, p});
  const hits = (a, b) => {
   for (let i = 0; i < 32; i++) {
    const v = ovalRadius(a.p, i / 32 * Math.PI * 2);
    const q = a.h.toWorld({x: a.p.x + v.x, z: a.p.z + v.z});
    const l = b.h.toLocal(q);
    if (insideOval(l.x, l.z, b.p)) return true;
   }
   return false;
  };
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++)
   if (hits(bodies[i], bodies[j]) || hits(bodies[j], bodies[i])) pairs++;
 }
 assert.equal(pairs, 0, `${pairs} overlapping water bodies`);
 // And the fix must not work by refusing to place lakes at all.
 assert.ok(lakes >= 15, `only ${lakes} lakes placed`);
});
