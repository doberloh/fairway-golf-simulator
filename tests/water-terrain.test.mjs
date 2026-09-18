// What water is allowed to do to the ground it sits in.
//
// Three rules: water bodies belong on land, a pond is allowed to reach into
// play, and a fairway that meets water stops behind a band of semi-rough.
//
// The third is HALF testable here. This file checks the lie; the matching paint
// is in ground.js and no test can see it, which is exactly how the first attempt
// shipped a perfect measurement and zero visible change. If you change one, go
// and look at the other.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, ovalRadius, insideOval, fairwayWidth, NO_INLAND_WATER, BEACH_RISE} from '../src/course.js';
import {shoreBands} from '../src/streams.js';

test('an island has no inland water at all, whatever the settings say', () => {
 // The ocean IS the water on an island: the land is a narrow strip with sea on
 // every side, so a pond is both redundant and the hardest thing to site. The
 // controls keep their values -- switching a course to island and back returns
 // the water it had -- so this is asserted at the MAXIMUM of every one of them.
 assert.ok(NO_INLAND_WATER.has('island'));
 for (const seed of ['A', 'B', 'C']) {
  const w = generateWorld({seed, biome: 'island', holes: 9,
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
 const w = generateWorld({seed: 'SEA', biome: 'links', holes: 9, rivers: 2, creeks: 3});
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
 const w = generateWorld({seed: 'TFLCsss', biome: 'links', holes: 9,
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
  const w = generateWorld({seed, biome: 'links', holes: 9, water: 100});
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
  const w = generateWorld({seed, biome: 'pnw', holes: 9, water: 100, rivers: 1, creeks: 2});
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
  const w = generateWorld({seed, biome: 'pnw', holes: 9, water: 100, rivers: 1, creeks: 2});
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
 const w = generateWorld({seed: 'A', biome: 'pnw', holes: 9, water: 100, semiRough: 0});
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
  const w = generateWorld({seed: 'A', biome: 'pnw', holes: 9, water: 100, semiRough});
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
   const w = generateWorld({seed, biome, holes: 9, trees: 0});
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
 const w = generateWorld({seed: 'A', biome: 'island', holes: 9, trees: 0});
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
  const w = generateWorld({seed, biome, holes: 9, water: 100, lakes: 3});
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

// ---------------------------------------------------------------------------
// WHAT WATER IS NOT ALLOWED TO TOUCH.
//
// Four separate rules, all of them owner decisions and all of them measured
// before they were asked for, because every one of them was happening. They
// share a fixture: generating twenty-four courses is the expensive part, and
// asserting four things about each is nearly free.
const KEEP_OUT = (() => {
 const worlds = [];
 for (const biome of ['pnw', 'desert', 'mountain', 'links', 'midwest', 'autumn'])
  for (const seed of ['S1', 'S2', 'S3', 'S4'])
   worlds.push(generateWorld({seed, biome, holes: 9, rivers: 1, creeks: 2, water: 60, lakes: 1}));
 return worlds;
})();

test('no channel runs over a green', () => {
 // The drainage model raises greens 60 m so the ROUTE goes round them, and
 // everything applied afterwards ignored that: meander is up to 17 m of lateral
 // offset and corner cutting pulls a path across the inside of its own bends.
 // Measured before the finished polyline was pushed clear: water on 3 greens in
 // 216, as much as 16.2 m inside one.
 let worst = Infinity, holes = 0;
 for (const w of KEEP_OUT) for (const h of w.holes) {
  holes++;
  const g = h.worldGreen ?? h.worldPin, radius = h.greenSize * h.greenAspect;
  for (const st of w.streams.streams) for (const p of st.points)
   worst = Math.min(worst, Math.hypot(p.x - g.x, p.z - g.z) - p.width * .5 - radius);
 }
 assert.ok(holes > 200, `only ${holes} holes in the fixture`);
 assert.ok(worst > 0, `channel water reaches ${worst.toFixed(1)} m past a green edge`);
});

test('no channel crosses a playing corridor', () => {
 // Rivers crossing fairways was a feature, with its own blended-turf exception
 // in the ground shader, until the owner asked for it gone. Corridors are
 // raised in the drainage model the way greens are, so the route goes between
 // the holes rather than being steered across them -- and the point of doing it
 // that way is that the path stays a pure descent.
 let inside = 0, channels = 0;
 for (const w of KEEP_OUT) for (const st of w.streams.streams) {
  channels++;
  for (const p of st.points) for (const h of w.holes) {
   const q = h.toLocal(p);
   if (q.z < 0 || q.z > h.length) continue;
   const off = q.x - h.center(q.z), half = fairwayWidth(h, q.z, 0, Math.sign(off) || 1);
   if (half && Math.abs(off) < half + p.width * .5) inside++;
  }
 }
 assert.equal(inside, 0, `${inside} channel stations inside a fairway`);
 // And the rule must not be kept by refusing to place channels.
 assert.ok(channels >= 60, `only ${channels} channels placed across 24 courses`);
});

test('no channel runs into standing water it did not create', () => {
 // Two water surfaces meeting at different fitted levels is the same fault the
 // lake-on-pond check was added for. A channel is kept a clear margin outside
 // any pond or lake -- its own terminal pond excepted, which is the one body it
 // is supposed to arrive at.
 let worst = Infinity, bodies = 0;
 for (const w of KEEP_OUT) for (const h of w.holes) for (const p of h.ponds) {
  if (p.sink) continue;
  bodies++;
  const edge = Array.from({length: 48}, (_, i) => {
   const e = ovalRadius(p, i * Math.PI / 24);
   return h.toWorld({x: p.x + e.x, z: p.z + e.z});
  });
  for (const st of w.streams.streams) for (const q of st.points) for (const v of edge)
   worst = Math.min(worst, Math.hypot(q.x - v.x, q.z - v.z) - q.width * .5);
 }
 assert.ok(bodies > 100, `only ${bodies} water bodies in the fixture`);
 // Comfortably outside the shore band, which is 14 to 24 m wide, so the two
 // bodies do not share painted ground either.
 assert.ok(worst > 14, `channel water comes within ${worst.toFixed(1)} m of a pond`);
});

test('a pond bites into a fairway but never crosses one', () => {
 // A pond that reaches the far side does not pinch a hole into two landing
 // areas, it severs it -- the routing never planned a way past. The bite is the
 // part that was wanted. `reach` is bounded at 0.70 of the half width and the
 // shore is measured inward from the SEMI-ROUGH edge, so the crossing is
 // impossible by construction rather than by a rejection test.
 let crossed = 0, bit = 0, total = 0, deepest = 0;
 for (const w of KEEP_OUT) for (const h of w.holes) for (const p of h.ponds) {
  if (p.sink) continue;
  total++;
  let reach = -Infinity, far = false;
  for (let i = 0; i < 96; i++) {
   const e = ovalRadius(p, i * Math.PI / 48), x = p.x + e.x, z = p.z + e.z;
   if (z < 0 || z > h.length) continue;
   const off = x - h.center(z), side = Math.sign(off) || 1, half = fairwayWidth(h, z, 0, side);
   if (!half) continue;
   reach = Math.max(reach, half - Math.abs(off));
   if (Math.sign(off) !== Math.sign(p.x - h.center(z)) && Math.abs(off) > half * .5) far = true;
  }
  if (reach > 0) { bit++; deepest = Math.max(deepest, reach); }
  if (far) crossed++;
 }
 assert.equal(crossed, 0, `${crossed} ponds cross a fairway`);
 // A bite nobody can see from the tee is not the feature that was asked for.
 assert.ok(bit / total > .08, `only ${bit} of ${total} ponds reach into a fairway`);
 assert.ok(deepest > 6, `the deepest bite is only ${deepest.toFixed(1)} m`);
});

test('a channel that ends in a hollow ends in a real pond', () => {
 // The owner's choice over filling the sink or fading out. It has to be a real
 // pond object, because that is what makes it inherit the cut bank, the shore
 // band, the mown collar, the map outline and the overlap rules instead of
 // being a second kind of water with its own copy of all of them.
 let sinks = 0, ponds = 0;
 for (const w of KEEP_OUT) {
  const made = w.holes.flatMap(h => h.ponds.filter(p => p.sink).map(p => ({h, p})));
  ponds += made.length;
  sinks += w.streams.streams.filter(st => st.end === 'sink').length;
  for (const {h, p} of made) {
   // Everything an ordinary pond carries, because it went through the same fit.
   assert.ok(p.level !== undefined && p.shoreWidth > 0 && p.reachX > 0 && p.banks.length === 257);
   const c = h.toWorld(p);
   assert.equal(w.surface(c.x, c.z), 'water', 'a terminal pond must play as water');
   assert.ok(w.height(c.x, c.z) < p.level - .2, 'a terminal pond must have a basin under it');
   assert.ok(h.ponds.length <= 4, 'the per-hole atlas limit still holds');
  }
 }
 assert.ok(sinks > 0, 'no channel reached a hollow in the fixture');
 assert.ok(ponds > 0, `${sinks} channels ended in a hollow and none of them got a pond`);
});
