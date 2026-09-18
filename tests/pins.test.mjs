// Hole locations, and the greens they are cut into.
import test from 'node:test';
import assert from 'node:assert/strict';
import {greenDistance, pinBandFor, pinDayOf, PIN_BANDS} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {greenContour} from '../src/course-plan.js';

const FLAT = {elevation: 0, trees: 0, water: 0, rivers: 0, creeks: 0, lakes: 0, homes: false, bunkerCount: 0};
const SEEDS = ['EVERGREEN', 'DRIFT', 'HARROW'];
// Slope read off the green's own contour, in per cent. Inside the green that is
// the surface, and it is what the cup was chosen against.
const slopeAt = (h, x, z) => {
 const e = .4;
 return Math.hypot((greenContour(h, x + e, z) - greenContour(h, x - e, z)) / (2 * e),
  (greenContour(h, x, z + e) - greenContour(h, x, z - e)) / (2 * e)) * 100;
};
const holesFor = (pinDay, greenDifficulty = 70) =>
 SEEDS.flatMap(seed => buildWorld({...FLAT, seed, holes: 9, greenDifficulty, pinDay}).holes);

test('a cup is always cut on the green, with room around it', () => {
 // Three paces is the tightest a championship setup cuts. Nothing, on any day or
 // any green, goes nearer the edge than that.
 for (const day of ['Thursday', 'Sunday']) for (const h of holesFor(day)) {
  assert.equal(h.surface(h.pin.x, h.pin.z), 'green',
   `${day} hole ${h.hole + 1}: the cup is not on the green`);
  const room = -greenDistance(h, h.pin.x, h.pin.z);
  assert.ok(room >= 2.9, `${day} hole ${h.hole + 1}: only ${room.toFixed(2)} m of green around the cup`);
 }
});

test('Thursday to Sunday cuts progressively harder, and never unplayable', () => {
 // Difficulty is SLOPE. How much green is left between the cup and an edge is a
 // safety minimum -- that is what the USGA figure is -- and not a second dial:
 // treating it as one meant scoring a location for having too much room as well
 // as too little, which pulled every cup on the course to within inches of the
 // same distance from the edge. On a severe green a Sunday pin does not need to
 // be tucked at all, because the ground under it is doing the work.
 const days = ['Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
  const holes = holesFor(day);
  const slopes = holes.map(h => slopeAt(h, h.pin.x, h.pin.z));
  return {
   day,
   slope: slopes.reduce((a, b) => a + b, 0) / slopes.length,
   worst: Math.max(...slopes),
   rooms: holes.map(h => -greenDistance(h, h.pin.x, h.pin.z)).sort((a, b) => a - b),
  };
 });
 for (let i = 1; i < days.length; i++)
  assert.ok(days[i].slope > days[i - 1].slope,
   `${days[i].day} averages ${days[i].slope.toFixed(2)}% against ${days[i - 1].day}'s ${days[i - 1].slope.toFixed(2)}%`);
 assert.ok(days[0].slope < 2, `Thursday should be gentle, not ${days[0].slope.toFixed(2)}%`);
 for (const d of days) assert.ok(d.worst < 5, `${d.day} cut a cup on ${d.worst.toFixed(2)}% of slope`);
});

test('hole locations use the whole green, not one ring around its edge', () => {
 // The bug this exists for: room to the edge was scored as a target rather than
 // a floor, so every cup on the course sat the same few inches inside the same
 // contour -- all of them about five paces in, hole after hole. A setup uses the
 // green: some cups tucked near an edge, some out in the middle of it.
 for (const day of ['Thursday', 'Sunday']) {
  const rooms = holesFor(day).map(h => -greenDistance(h, h.pin.x, h.pin.z)).sort((a, b) => a - b);
  const spread = rooms[rooms.length - 1] - rooms[0];
  assert.ok(spread > 5,
   `${day} cups all sit within ${spread.toFixed(1)} m of each other's distance from the edge`);
  // And not just one outlier pulling the range: the middle half has to move too.
  const q = f => rooms[Math.floor((rooms.length - 1) * f)];
  assert.ok(q(.75) - q(.25) > 1.5,
   `${day}: the middle half of the cups span only ${(q(.75) - q(.25)).toFixed(1)} m`);
 }
});

test('hole locations start at the front and work back, hole by hole', () => {
 assert.deepEqual(PIN_BANDS, ['front', 'middle', 'back']);
 assert.equal(pinBandFor(0), 'front', 'the first hole of a round is a front pin');
 for (let i = 0; i < 18; i++) assert.equal(pinBandFor(i), PIN_BANDS[i % 3]);
 // And the cup really is where the band says. Depth is measured from the centre
 // of the green as a fraction of its radius, so front is negative and back
 // positive whichever way the hole happens to be rotated.
 const holes = holesFor('Saturday', 50);
 const depth = h => (h.pin.z - h.green.z) / (h.greenSize ?? 17);
 const band = name => {
  const picked = holes.filter(h => pinBandFor(h.hole) === name).map(depth);
  return picked.reduce((a, b) => a + b, 0) / picked.length;
 };
 assert.ok(band('front') < -.25, `front pins average ${band('front').toFixed(2)} of the green radius`);
 assert.ok(Math.abs(band('middle')) < .12, `middle pins average ${band('middle').toFixed(2)}`);
 assert.ok(band('back') > .25, `back pins average ${band('back').toFixed(2)}`);
});

test('recutting the hole locations does not rebuild the course', () => {
 // It did. Routing packs each hole's corridor against a disc standing for the
 // green, and that disc was centred on the CUP -- so moving a pin moved the
 // collision volume, which moved the next hole, which rerouted everything and
 // changed the terrain under all of it. A pin is a pin. It moves nothing.
 const layout = pinDay => buildWorld({...FLAT, seed: 'SHOULDERS', holes: 9, greenDifficulty: 70, pinDay})
  .holes.map(h => `${JSON.stringify(h.origin)}@${h.rotation.toFixed(6)}|${h.green.x.toFixed(4)},${h.green.z.toFixed(4)}`).join('|');
 const thursday = layout('Thursday');
 for (const day of ['Friday', 'Saturday', 'Sunday'])
  assert.equal(layout(day), thursday, `${day} pins moved the course`);
});

test('the green slider reaches from level to genuinely severe', () => {
 // Anchored in RESEARCH.md. The low and middle of the range are where they have
 // always been; the top is the point of the exercise, and it has to land in the
 // band a championship green actually occupies -- several feet of relief, tier
 // faces well past ten per cent, and still somewhere flat enough to cut a hole.
 const survey = greenDifficulty => {
  const slopes = [], heights = [];
  for (const h of buildWorld({...FLAT, seed: 'EVERGREEN', holes: 9, greenDifficulty}).holes) {
   for (let dx = -20; dx <= 20; dx += 1.5) for (let dz = -20; dz <= 20; dz += 1.5) {
    const x = h.green.x + dx, z = h.green.z + dz;
    if (greenDistance(h, x, z) > -.5) continue;
    slopes.push(slopeAt(h, x, z));
    heights.push(greenContour(h, x, z));
   }
  }
  slopes.sort((a, b) => a - b);
  return {
   mean: slopes.reduce((a, b) => a + b, 0) / slopes.length,
   max: slopes[slopes.length - 1],
   relief: Math.max(...heights) - Math.min(...heights),
   pinnable: slopes.filter(s => s <= 2.5).length / slopes.length,
  };
 };
 const level = survey(0), mid = survey(35), severe = survey(100);
 assert.equal(level.mean, 0, 'zero means level');
 assert.ok(mid.mean > .8 && mid.mean < 2.2, `the default green averages ${mid.mean.toFixed(2)}%`);
 assert.ok(severe.mean > mid.mean * 2.5, 'the top of the slider has to be a different green');
 assert.ok(severe.relief / .3048 > 4, `a severe green has only ${(severe.relief / .3048).toFixed(1)} ft of relief`);
 assert.ok(severe.max > 12, `a severe green's steepest ground is ${severe.max.toFixed(1)}%`);
 // The one that keeps it a golf green rather than a hillside: somewhere on it, a
 // ball can still be left beside a hole.
 assert.ok(severe.pinnable > .06,
  `only ${(severe.pinnable * 100).toFixed(1)}% of a severe green is flat enough for a cup`);
});

test('the pin day is reported as itself, and anything unrecognised reads as Thursday', () => {
 assert.equal(pinDayOf({pinDay: 'Sunday'}), 'Sunday');
 assert.equal(pinDayOf({pinDay: 'Tuesday'}), 'Thursday');
 assert.equal(pinDayOf({}), 'Thursday');
 assert.equal(pinDayOf(undefined), 'Thursday');
});

// The ground shader punches the cup by discarding fragments inside CUP_RADIUS of
// a point it reads from the green atlas. That atlas carried ONE vec4 per hole --
// the green's centre, size and aspect -- and the discard used its xy, so the hole
// was cut through the middle of every green instead of at the pin. It is now two
// texels per hole, green in one and pin in the other.
//
// This asserts the thing that made the bug visible: the two points are far
// enough apart that cutting at the wrong one is obvious, on every hole and every
// pin day. If a change ever collapses them back together, the shader's two
// columns become indistinguishable and the bug returns unnoticed.
test('the cup and the green centre are far enough apart to tell apart', () => {
 const CUP_RADIUS = 0.053975;
 for (const day of ['thursday', 'friday', 'saturday', 'sunday']) {
  const world = buildWorld({seed: 'CUPCUT', holes: 9, pinDay: day});
  let moved = 0;
  for (const h of world.holes) {
   const gap = Math.hypot(h.pin.x - h.green.x, h.pin.z - h.green.z);
   assert.ok(Number.isFinite(gap), `${day} hole ${h.hole + 1} has no measurable pin offset`);
   // A cup cut within its own radius of the green's centre would make the two
   // indistinguishable on screen; anything beyond that is a visible difference.
   if (gap > CUP_RADIUS * 4) moved++;
  }
  assert.ok(moved >= world.holes.length - 1,
   `${day}: only ${moved} of ${world.holes.length} pins sit clear of the green's centre`);
 }
});
