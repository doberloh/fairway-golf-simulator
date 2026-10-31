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
import {measured} from './worlds.mjs';
// ---------------------------------------------------------------------------
// WHAT WATER IS NOT ALLOWED TO TOUCH.
//
// Four separate rules, all of them owner decisions and all of them measured
// before they were asked for, because every one of them was happening. They
// share a fixture: generating twenty-four courses is the expensive part, and
// asserting four things about each is nearly free.
// Built on worker threads and measured there (worlds.mjs `measured`; the
// testing audit, 31 October 2026): one thread, these were three minutes and
// the whole suite's wall. Each test's loop is in tests/measure/water-keep-out.mjs.
const SETTINGS = [];
for (const biome of ['pnw', 'desert', 'mountain', 'links', 'midwest', 'autumn'])
 // EIGHT SEEDS, NOT FOUR. Several assertions here are rates across the whole
 // fixture -- what fraction of ponds bite into a fairway, whether a channel
 // terminating in a hollow turns up at all -- and four seeds was too small a
 // sample to measure them stably. Changing hole lengths moved the pond bite
 // rate from just over the 8% floor to just under it, with the invariant that
 // actually matters (no pond crosses a fairway) untouched at zero. Measured
 // over eight seeds it is 9.2%.
 for (const seed of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'])
  SETTINGS.push({seed, biome, holes: 9, rivers: 1, creeks: 2, water: 60, lakes: 1});
const KEEP_OUT = await measured(SETTINGS, './measure/water-keep-out.mjs');
const sum = key => KEEP_OUT.reduce((n, m) => n + m[key], 0);
const least = key => Math.min(...KEEP_OUT.map(m => m[key]));

test('no channel runs over a green', () => {
 // The drainage model raises greens 60 m so the ROUTE goes round them, and
 // everything applied afterwards ignored that: meander is up to 17 m of lateral
 // offset and corner cutting pulls a path across the inside of its own bends.
 // Measured before the finished polyline was pushed clear: water on 3 greens in
 // 216, as much as 16.2 m inside one.
 const holes = sum('holes'), worst = least('greenWorst');
 assert.ok(holes > 200, `only ${holes} holes in the fixture`);
 assert.ok(worst > 0, `channel water reaches ${worst.toFixed(1)} m past a green edge`);
});

test('no channel crosses a playing corridor', () => {
 // Rivers crossing fairways was a feature, with its own blended-turf exception
 // in the ground shader, until the owner asked for it gone. Corridors are
 // raised in the drainage model the way greens are, so the route goes between
 // the holes rather than being steered across them -- and the point of doing it
 // that way is that the path stays a pure descent.
 // And the rule must not be kept by refusing to place channels.
 const inside = sum('inside'), channels = sum('channels');
 assert.equal(inside, 0, `${inside} channel stations inside a fairway`);
 assert.ok(channels >= 60, `only ${channels} channels placed across 24 courses`);
});

test('no channel runs into standing water it did not create', () => {
 // Two water surfaces meeting at different fitted levels is the same fault the
 // lake-on-pond check was added for. A channel is kept a clear margin outside
 // any pond or lake -- its own terminal pond excepted, which is the one body it
 // is supposed to arrive at.
 // Comfortably outside the shore band, which is 14 to 24 m wide, so the two
 // bodies do not share painted ground either.
 const bodies = sum('bodies'), worst = least('pondWorst');
 assert.ok(bodies > 100, `only ${bodies} water bodies in the fixture`);
 assert.ok(worst > 14, `channel water comes within ${worst.toFixed(1)} m of a pond`);
});

test('a pond bites into a fairway but never crosses one', () => {
 // A pond that reaches the far side does not pinch a hole into two landing
 // areas, it severs it -- the routing never planned a way past. The bite is the
 // part that was wanted. `reach` is bounded at 0.70 of the half width and the
 // shore is measured inward from the SEMI-ROUGH edge, so the crossing is
 // impossible by construction rather than by a rejection test.
 // A bite nobody can see from the tee is not the feature that was asked for.
 // PLACED floor. Greens at real size (generator 36, 15 October 2026) took it
 // from 32 of 348 (9.2%) to 26 of 331 (7.9%): a par three's fairway now starts
 // later, leaving a pond less of it to bite. The floor moved from 8% to 7%.
 const crossed = sum('crossed'), bit = sum('bit'), total = sum('total'), deepest = Math.max(...KEEP_OUT.map(m => m.deepest));
 assert.equal(crossed, 0, `${crossed} ponds cross a fairway`);
 assert.ok(bit / total > .07, `only ${bit} of ${total} ponds reach into a fairway`);
 assert.ok(deepest > 6, `the deepest bite is only ${deepest.toFixed(1)} m`);
});

test('a channel that ends in a hollow ends in a real pond', () => {
 // The owner's choice over filling the sink or fading out. It has to be a real
 // pond object, because that is what makes it inherit the cut bank, the shore
 // band, the mown collar, the map outline and the overlap rules instead of
 // being a second kind of water with its own copy of all of them.
   // Everything an ordinary pond carries, because it went through the same fit.
 const sinks = sum('sinks'), ponds = sum('made'), faults = KEEP_OUT.flatMap(m => m.terminalFaults);
 assert.deepEqual(faults, [], 'a terminal pond is not an ordinary pond');
 assert.ok(sinks > 0, 'no channel reached a hollow in the fixture');
 assert.ok(ponds > 0, `${sinks} channels ended in a hollow and none of them got a pond`);
});
