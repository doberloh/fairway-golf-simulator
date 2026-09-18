// What water is forbidden to touch: greens, playing corridors, other water,
// and a fairway a pond may bite but not cross. Plus the pond a channel makes
// for itself where it ends in a hollow.
//
// SPLIT FROM water-terrain.test.mjs BECAUSE THE RUNNER PARALLELISES BY FILE.
// Tests inside one file run on one thread, so a file that builds forty courses
// is a forty-course serial queue however many cores are idle. This file and
// its sibling were one 326-second file -- the single longest in the suite, and
// therefore the suite's entire wall time.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius, fairwayWidth} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
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
   worlds.push(buildWorld({seed, biome, holes: 9, rivers: 1, creeks: 2, water: 60, lakes: 1}));
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
