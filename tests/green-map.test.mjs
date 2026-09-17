// The green read from above. The field is the thing worth pinning: the colours
// are decoration, but "which end of the green is high" is the reason to look at
// it at all, and a scale taken from the wrong sample says the opposite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {greenBounds, heatField, heatColor, contourBand, CONTOUR_STEP} from '../src/green-map.js';
import {mapLayout, mapPoint, tilePlacement, MAP_NAV_NONE} from '../src/course-map.js';
import {generateWorld, greenDistance} from '../src/course.js';
import {RANGE_SETTINGS} from '../src/range.js';

// A sloped green, deliberately: a flat one would pass every assertion about
// the scale without exercising it.
const course = generateWorld({seed: 'green-map', greenDifficulty: 80}).holes[0];

test('the bounds hold the whole putting surface, not a circle guessed around it', () => {
 // Greens are stretched by `greenAspect` and wobble with the hole seed. A square
 // fitted to the wrong radius clips the side of the green you were reading.
 const b = greenBounds(course);
 for (let i = 0; i < 128; i++) {
  const a = i * Math.PI / 64;
  // Walk out along each bearing to the last point still on the green.
  let last = null;
  for (let r = 0; r < 60; r += 0.25) {
   const x = course.green.x + Math.cos(a) * r, z = course.green.z + Math.sin(a) * r;
   if (greenDistance(course, x, z) < 0) last = {x, z};
  }
  if (!last) continue;
  assert.ok(Math.abs(last.x - b.x) <= b.rx + 1e-6 && Math.abs(last.z - b.z) <= b.rz + 1e-6,
   `a point on the green at bearing ${a.toFixed(2)} fell outside the sampled square`);
 }
});

test('the scale comes from the putting surface alone', () => {
 // The bug this exists to prevent: scaled against the whole sampled square, a
 // green in a hollow measures itself against the bank behind it, so the surface
 // occupies a sliver of the ramp and reads as uniformly flat.
 const f = heatField(course, 64);
 let lo = Infinity, hi = -Infinity, outsideExtreme = false;
 for (let k = 0; k < f.n * f.n; k++) {
  if (f.inside[k]) { lo = Math.min(lo, f.height[k]); hi = Math.max(hi, f.height[k]); }
  else if (f.height[k] < f.lo - 1e-9 || f.height[k] > f.hi + 1e-9) outsideExtreme = true;
 }
 // 1e-4 rather than exact only because the grid is stored as Float32.
 assert.ok(Math.abs(f.lo - lo) < 1e-4 && Math.abs(f.hi - hi) < 1e-4,
  'the range must be the on-green range, not the sampled square.');
 assert.ok(outsideExtreme, 'the surround should exceed the green range, or this test proves nothing');
});

test('the field is the same height the ball rolls on', () => {
 // Two views of one green that disagreed would be worse than one view. The map
 // reads `course.height`, the same function the putt does.
 const f = heatField(course, 32);
 for (let j = 0; j < f.n; j += 7) for (let i = 0; i < f.n; i += 7) {
  const x = f.bounds.x + ((i + 0.5) / f.n * 2 - 1) * f.bounds.rx;
  const z = f.bounds.z + ((j + 0.5) / f.n * 2 - 1) * f.bounds.rz;
  // Float32 storage, so exact equality is the wrong test; a metre would not be.
  assert.ok(Math.abs(f.height[j * f.n + i] - course.height(x, z)) < 1e-4);
 }
});

test('a dead flat green reports flat rather than painting one end of the ramp', () => {
 // The practice bench green is flat. A zero range divided by nothing would make
 // every pixel the same extreme colour and imply a slope that is not there.
 const bench = generateWorld(RANGE_SETTINGS).holes[0];
 const f = heatField(bench, 32);
 assert.ok(Number.isFinite(f.lo) && Number.isFinite(f.hi));
 if (f.hi - f.lo < 1e-4) assert.equal(f.flat, true);
});

test('the ramp runs blue low to red high, the way the 3D overlay does', () => {
 const hue = s => Number(s.match(/hsl\(([-\d.]+)/)[1]);
 assert.ok(Math.abs(hue(heatColor(0)) - 0.64 * 360) < 1e-6, 'low must be blue');
 assert.equal(hue(heatColor(1)), 0, 'high must be red');
 assert.ok(hue(heatColor(0.5)) < hue(heatColor(0.2)), 'hue must fall as height rises');
 // Out-of-range input clamps rather than wrapping the colour wheel back to red.
 assert.equal(heatColor(-5), heatColor(0));
 assert.equal(heatColor(5), heatColor(1));
});

test('contour bands are ten centimetres apart and change only at a step', () => {
 assert.equal(CONTOUR_STEP, 0.1);
 assert.equal(contourBand(10, 10), contourBand(10.09, 10), 'within a band');
 assert.equal(contourBand(10.11, 10) - contourBand(10, 10), 1, 'one step, one band');
 assert.equal(contourBand(10.55, 10) - contourBand(10.05, 10), 5);
});

test('focusing the map on the green frames the green and nothing else', () => {
 // The reason the focus exists: on the hole map the twenty yards that matter are
 // a smudge at one end of four hundred yards you have finished with.
 const W = 440, H = 580;
 const hole = mapLayout(course, W, H, false, course.tee, MAP_NAV_NONE);
 const green = mapLayout(course, W, H, false, course.tee, MAP_NAV_NONE, 'green');
 const b = greenBounds(course);
 assert.equal(green.focus, 'green');
 assert.ok(green.scale > hole.scale * 2, `green focus only magnified ${(green.scale / hole.scale).toFixed(1)}x`);
 assert.ok(Math.abs(green.cx - b.x) < 1e-9 && Math.abs(green.cz - b.z) < 1e-9,
  'the frame must centre on the green, not on the ball or the pin');
 // Both extremes of the green land inside the canvas.
 assert.ok(b.rx * 2 * green.scale <= W + 1e-6 && b.rz * 2 * green.scale <= H + 1e-6);
});

test('no focus is the hole map exactly as it was', () => {
 const W = 440, H = 580;
 const bare = mapLayout(course, W, H, false, course.tee, MAP_NAV_NONE);
 const nulled = mapLayout(course, W, H, false, course.tee, MAP_NAV_NONE, null);
 for (const k of ['cx', 'cz', 'scale']) assert.equal(bare[k], nulled[k]);
 assert.ok(!bare.focus);
});

test('the tile lands on the ground it describes, not 180 degrees out', () => {
 // THE BUG THIS EXISTS FOR. `mapPoint` negates both axes, so the map is the
 // world turned through half a turn. Fitted into a normalised destination
 // rectangle the tile came out the right size in the right place and upside
 // down, which painted the high side of the green over the low side -- a green
 // reading tool that reads exactly backwards, and looks plausible while it does.
 const W = 440, H = 580, n = 96;
 const m = mapLayout(course, W, H, false, course.tee, MAP_NAV_NONE, 'green');
 const f = heatField(course, n);
 const place = tilePlacement(m, f.bounds, n, n);
 for (const [i, j] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1], [12, 71], [63, 8]]) {
  // Where the sample at (i, j) came from in the world...
  const x = f.bounds.x + ((i + 0.5) / n * 2 - 1) * f.bounds.rx;
  const z = f.bounds.z + ((j + 0.5) / n * 2 - 1) * f.bounds.rz;
  const [wantX, wantY] = mapPoint(m, {x, z});
  // ...against where the drawn tile puts that texel's centre.
  const gotX = place.x + place.sx * (i + 0.5);
  const gotY = place.y + place.sy * (j + 0.5);
  assert.ok(Math.hypot(gotX - wantX, gotY - wantY) < 1e-6,
   `texel ${i},${j} drew at ${gotX.toFixed(2)},${gotY.toFixed(2)} for ground at ${wantX.toFixed(2)},${wantY.toFixed(2)}`);
 }
});

test('the tile stays registered through a pan and a zoom', () => {
 // The placement is derived from `mapPoint`, so it has to follow the map rather
 // than be recomputed against the fitted frame.
 const W = 440, H = 580, n = 48;
 for (const nav of [{zoom: 2.5, x: 9, z: -14}, {zoom: 6, x: -20, z: 30}]) {
  const m = mapLayout(course, W, H, false, course.tee, nav, 'green');
  const f = heatField(course, n);
  const place = tilePlacement(m, f.bounds, n, n);
  const i = 30, j = 17;
  const x = f.bounds.x + ((i + 0.5) / n * 2 - 1) * f.bounds.rx;
  const z = f.bounds.z + ((j + 0.5) / n * 2 - 1) * f.bounds.rz;
  const [wantX, wantY] = mapPoint(m, {x, z});
  assert.ok(Math.abs(place.x + place.sx * (i + 0.5) - wantX) < 1e-6
   && Math.abs(place.y + place.sy * (j + 0.5) - wantY) < 1e-6);
 }
});

test('the flip is real, so the scales are negative', () => {
 // Stated on its own: if this ever comes out positive the map has stopped
 // negating its axes and the placement above is silently doing nothing.
 const m = mapLayout(course, 440, 580, false, course.tee, MAP_NAV_NONE, 'green');
 const place = tilePlacement(m, greenBounds(course), 96, 96);
 assert.ok(place.sx < 0 && place.sy < 0, `placement scales were ${place.sx}, ${place.sy}`);
});
