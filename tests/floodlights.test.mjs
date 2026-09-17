// Course floodlighting. The figures and their sources are in RESEARCH.md; these
// assert that the placement actually follows them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, fairwayWidth} from '../src/course.js';
import {polesFor, activePoles, orderPoles, POLE_HEIGHT, POLE_SPACING, POLE_REACH} from '../src/floodlights.js';
import {loadDaylight, MENU_HOURS, showcaseHour} from '../src/daylight.js';

const world = generateWorld({seed: 'LIGHTS', holes: 9, water: 0, homes: false});

test('poles follow published sports-lighting spacing and height', () => {
 // Two published bands bracket this: driving ranges and golf practice run
 // 30-60 ft poles, ball fields 70-100 ft. Fairway sits at 75 ft, the bottom of
 // the ball-field band -- it began in the golf band and was raised on the look
 // of it, a fairway being a far wider target than a range bay. The assertion is
 // the union of the two, because leaving either is a departure from practice and
 // should have to be argued rather than typed.
 assert.ok(POLE_HEIGHT >= 9 && POLE_HEIGHT <= 30.5,
  `${POLE_HEIGHT} m is outside both published bands (30-100 ft)`);
 // The governing uniformity rule: spacing stays within three times the mounting
 // height, so it has to be derived from the height and not set beside it.
 assert.equal(POLE_SPACING, POLE_HEIGHT * 3);
 // Reach scales with the mast too. Pinning it while raising the poles leaves
 // gaps between the pools, and a single mast is quoted at 50-200 m anyway.
 assert.ok(POLE_REACH >= 50 && POLE_REACH <= 200, `${POLE_REACH} m is outside the quoted high-mast range`);
 for (const hole of world.holes) {
  const run = polesFor(hole).filter(p => !p.green).sort((a, b) => a.z - b.z);
  for (let i = 1; i < run.length; i++)
   assert.ok(run[i].z - run[i - 1].z <= POLE_SPACING + 1e-6,
    `hole ${hole.hole + 1}: ${(run[i].z - run[i - 1].z).toFixed(1)} m between poles exceeds three times the height`);
 }
});

test('poles alternate sides down the hole', () => {
 // One side lights the far rough and leaves the near tree line in shadow, and on
 // a curved hole every pole ends up inside the dogleg.
 for (const hole of world.holes) {
  const run = polesFor(hole).filter(p => !p.green).sort((a, b) => a.z - b.z);
  assert.ok(run.length >= 2, `hole ${hole.hole + 1} has no run of poles`);
  for (let i = 1; i < run.length; i++)
   assert.equal(run[i].side, -run[i - 1].side, `hole ${hole.hole + 1} put two poles on the same side in a row`);
 }
});

test('no pole stands close enough to the mown corridor to be in play', () => {
 // A pole is an obstacle. This is a playability floor, not a lighting one -- the
 // lighting would rather they were closer in.
 for (const hole of world.holes) for (const pole of polesFor(hole)) {
  if (pole.green) continue;
  const half = Math.max(fairwayWidth(hole, pole.z, 0, pole.side), hole.width(pole.z));
  const clear = Math.abs(pole.x - hole.center(pole.z)) - half;
  // Beyond the semi rough, and then a clear margin on top of it.
  assert.ok((clear - hole.settings.semiRough) / 0.9144 >= 17.9,
   `hole ${hole.hole + 1}: a pole is only ${((clear - hole.settings.semiRough) / 0.9144).toFixed(1)} yd past the semi rough`);
 }
});

test('every green is lit from two directions, flanking the line of play', () => {
 // The reason a ball field carries four poles and not one tall one: uniformity
 // guidance asks for no more than 2:1 across the target, and a single direction
 // cannot do it -- every contour and the flag itself throws a shadow with nothing
 // to fill it. A pair at 45 degrees either side of the line of play throws its
 // two shadows in opposite directions, so each fills the other's. Asserted per
 // green, because an average would hide a dark one.
 for (const hole of world.holes) {
  const green = hole.green;
  const pair = polesFor(hole).filter(p => p.green);
  assert.equal(pair.length, 2, `hole ${hole.hole + 1} has ${pair.length} greenside poles`);
  const bearings = pair.map(p => Math.atan2(p.x - green.x, p.z - green.z)).sort((a, b) => a - b);
  for (const b of bearings)
   assert.ok(Math.abs(Math.abs(b) - Math.PI / 4) < 1e-6,
    `hole ${hole.hole + 1}: a greenside pole sits ${(b * 180 / Math.PI).toFixed(0)} deg off the line of play`);
  // Behind the green, never between it and the fairway: a pole in the line of
  // play shines straight back at the player standing in it.
  for (const p of pair)
   assert.ok(p.z > green.z, `hole ${hole.hole + 1}: a greenside pole stands in front of the green`);
  assert.ok(bearings[1] - bearings[0] > 1, 'the pair is bunched on one side');
  // Clear of the whole complex -- surface, fringe and semi rough -- and then ten
  // yards further, so a missed approach cannot finish against one.
  const collar = (hole.greenSize * hole.greenAspect) + hole.settings.fringe + hole.settings.semiRough;
  for (const p of pair) {
   const clear = (Math.hypot(p.x - green.x, p.z - green.z) - collar) / 0.9144;
   assert.ok(clear >= 9.9, `hole ${hole.hole + 1}: a greenside pole is only ${clear.toFixed(1)} yd past the semi rough`);
  }
  // And they actually light it.
  for (const p of pair)
   assert.ok(Math.hypot(p.x - green.x, p.z - green.z) < POLE_REACH, 'a greenside pole is out of its own reach');
 }
});

test('no pole is planted on the putting surface it lights', () => {
 for (const hole of world.holes) for (const pole of polesFor(hole)) {
  const green = hole.green;
  assert.ok(Math.hypot(pole.x - green.x, pole.z - green.z) > hole.greenSize,
   `hole ${hole.hole + 1}: a pole stands on the green`);
 }
});

test('the nearest-first fallback picks the near poles, for a course past the cap', () => {
 // Every pole is a live light in practice -- lighting all of them was measured
 // at no cost, because none casts a shadow and shadow maps are the expensive
 // part. This selector is the fallback for a course that outgrows the cap, and
 // it is tested because it is the path that will not be exercised by hand.
 const hole = world.holes[0], poles = polesFor(hole);
 const focus = {x: hole.center(hole.length * .4), z: hole.length * .4};
 const live = activePoles(poles, focus, 4);
 assert.ok(live.length > 0 && live.length <= 4, `${live.length} live lights`);
 const chosen = new Set(live);
 const nearest = [...poles].sort((a, b) =>
  Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z)).slice(0, live.length);
 for (const p of nearest) assert.ok(chosen.has(p), 'a nearer pole was passed over for a further one');
 // Nothing far away holds a light: it contributes nothing a player can see and
 // costs the same as one that does. This is what makes the fallback a fallback
 // and not just a shorter list.
 for (const p of live)
  assert.ok(Math.hypot(p.x - focus.x, p.z - focus.z) < POLE_REACH * 2.5, 'a light was given to a pole out of reach');
 assert.deepEqual(activePoles([], focus), []);
 assert.deepEqual(activePoles(poles, null), []);
});

test('floodlights are off until asked for; fog is on unless turned off', () => {
 // Floodlit golf is a deliberate thing to ask for. Nothing is built into the
 // skyline and nothing is lit until the box is ticked.
 assert.equal(loadDaylight().floodlights, false);
 // Fog is the other way round: the haze is what gives distance its depth, and a
 // course without it reads as a diorama. It is the first weather control rather
 // than a lighting one.
 assert.equal(loadDaylight().fog, true);
});

test('the menu shows its hole at a variety of hours, mostly daylight', () => {
 // The menu used to inherit the player's clock. Somebody who had been putting at
 // one in the morning saw nothing but dark holes from then on -- and once
 // floodlights existed, nothing but dark FLOODLIT holes, which is how this was
 // found. It borrows its own hour now and gives the clock back untouched.
 assert.ok(MENU_HOURS.length >= 8, 'too few hours to read as variety');
 const hours = MENU_HOURS.map(([h]) => h);
 assert.equal(new Set(hours).size, hours.length, 'an hour is offered twice');
 for (const [h, dark] of MENU_HOURS) {
  assert.ok(h >= 0 && h < 24, `${h} is not an hour`);
  assert.equal(typeof dark, 'boolean');
 }
 // Weighted to daylight: a golf course in the sun is what a shop window shows,
 // with night in the rotation rather than dominating it.
 const dark = MENU_HOURS.filter(([, d]) => d).length / MENU_HOURS.length;
 assert.ok(dark > .1 && dark < .45, `${(dark * 100).toFixed(0)}% of menu visits would be dark`);
 // Every slot is reachable, and the top of the range cannot fall off the end.
 const picked = new Set();
 for (let i = 0; i < 2000; i++) picked.add(showcaseHour(i / 2000)[0]);
 assert.equal(picked.size, MENU_HOURS.length, 'some hours are never chosen');
 assert.deepEqual(showcaseHour(0.999999), MENU_HOURS[MENU_HOURS.length - 1]);
 assert.deepEqual(showcaseHour(0), MENU_HOURS[0]);
});


// Which poles get the shadow-casting lamps. The casters are a fixed few at the
// front of the pool, so this ordering IS the shadow policy.
const at = (hole, x, z) => ({hole, x, z});

test('the hole being played is handed the shadow-casting lamps first', () => {
 // A pole on the next fairway throwing a shadow across a tree line nobody is
 // looking at costs exactly as much as one on the hole in play.
 const poles = [at(3, 0, 0), at(1, 80, 0), at(1, 10, 0), at(2, 5, 5), at(1, 300, 0)];
 const order = orderPoles(poles, 1, {x: 0, z: 0});
 assert.deepEqual(order.slice(0, 3).map(p => p.hole), [1, 1, 1], 'this hole comes first');
 assert.deepEqual(order.slice(0, 3).map(p => p.x), [10, 80, 300], 'and nearest the ball first within it');
});

test('poles on other holes still get lamps, just not the casting ones', () => {
 const poles = [at(2, 0, 0), at(1, 50, 0)];
 const order = orderPoles(poles, 1, {x: 0, z: 0});
 assert.equal(order.length, 2, 'nothing is dropped; the rest light the course');
 assert.equal(order[0].hole, 1);
 assert.equal(order[1].hole, 2);
});

test('a hole with no poles of its own does not lose its lighting', () => {
 const poles = [at(2, 0, 0), at(3, 9, 0)];
 const order = orderPoles(poles, 7, {x: 0, z: 0});
 assert.deepEqual(order.map(p => p.hole), [2, 3], 'nearest first, since none are this hole’s');
});

test('the limit is the number of lamps, and it keeps the important ones', () => {
 const poles = [at(2, 1, 0), at(2, 2, 0), at(1, 90, 0), at(1, 95, 0)];
 const order = orderPoles(poles, 1, {x: 0, z: 0}, 2);
 assert.deepEqual(order.map(p => p.hole), [1, 1], 'a short pool is spent on the hole in play');
});

test('ordering survives a missing focus and an empty course', () => {
 assert.deepEqual(orderPoles([], 0, {x: 0, z: 0}), []);
 const poles = [at(1, 5, 0), at(0, 1, 0)];
 assert.equal(orderPoles(poles, 1, null).length, 2, 'no focus is not a reason to go dark');
 assert.equal(orderPoles(poles, 1, null)[0].hole, 1);
});
