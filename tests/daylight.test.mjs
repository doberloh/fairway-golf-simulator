import test from 'node:test';
import assert from 'node:assert/strict';
import {
 solarState, solarPhase, advance, wrapHour, formatClock, phaseName,
 defaultHour, legacyElevation, peakElevation, hourForElevation,
 SUNRISE, SUNSET, TIME_RATES, PRESETS, starRotation, STAR_AXIS,
} from '../src/daylight.js';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import * as T from 'three';

const BIOME_SUN = {pnw: 28, desert: 24, mountain: 36, links: 23, midwest: 39, island: 47, autumn: 19};

test('the sun rises, peaks near midday and sets', () => {
 const sun = BIOME_SUN.pnw;
 const at = h => solarState(h, sun).elevation;

 assert.ok(at(SUNRISE) < .5, 'sun is on the horizon at sunrise');
 assert.ok(at(SUNSET) < .5, 'sun is on the horizon at sunset');
 assert.ok(at(3) < 0, 'sun is down at three in the morning');
 assert.ok(at(23) < 0, 'sun is down at eleven at night');

 const noon = (SUNRISE + SUNSET) / 2;
 assert.ok(Math.abs(at(noon) - peakElevation(sun)) < .01, 'peaks at its biome peak midway through the day');
 assert.ok(at(9) > at(7), 'still climbing at nine');
 assert.ok(at(17) < at(15), 'already falling at five');

 // Continuous across every join, including midnight: a jump here would show as
 // the light snapping rather than moving.
 for (const edge of [SUNRISE, SUNSET, 0, 24]) {
  const before = at(edge - 1e-4), after = at(edge + 1e-4);
  assert.ok(Math.abs(after - before) < .05, `elevation is continuous at ${edge}`);
 }
});

test('shadows sweep because the azimuth moves', () => {
 const sun = BIOME_SUN.midwest;
 const morning = solarState(8, sun).direction, evening = solarState(17, sun).direction;
 assert.ok(morning.x * evening.x < 0, 'the sun crosses from one side of the sky to the other');
 // The old renderer froze the azimuth, so every shadow on a course pointed the
 // same way all day. This is the assertion that it no longer does.
 assert.ok(morning.angleTo(evening) > 1, 'the light direction genuinely swings across the day');
});

test('light warms at the horizon and is neutral overhead', () => {
 const sun = BIOME_SUN.pnw;
 const noon = solarState((SUNRISE + SUNSET) / 2, sun), dusk = solarState(SUNSET - .3, sun);

 assert.equal(noon.keyTintAmount, 0, 'midday takes no tint, so a biome keeps its own sun colour');
 assert.ok(dusk.keyTintAmount > .8, 'the low sun is strongly tinted');
 assert.ok(dusk.keyTint.r > dusk.keyTint.b, 'and it is tinted warm, not cool');
 assert.ok(noon.tintAmount < .01, 'the air is untinted at midday');
 assert.ok(dusk.tintAmount > .2, 'and warms as the sun drops');
});

test('the default hour reproduces the light each biome already had', () => {
 // The promise made when this shipped: nothing changes until you move the
 // slider. Each biome opens at the hour that puts its sun where it always was.
 for (const [biome, sun] of Object.entries(BIOME_SUN)) {
  const state = solarState(defaultHour(sun), sun);
  assert.ok(Math.abs(state.elevation - legacyElevation(sun)) < .01, `${biome} opens at its original sun height`);
  assert.equal(state.keyScale, 1, `${biome} opens at full strength`);
  assert.equal(state.hemiScale, 1, `${biome} opens at its original ambient`);
  assert.ok(defaultHour(sun) > (SUNRISE + SUNSET) / 2, `${biome} opens in the afternoon`);
 }
});

test('scales reach exactly one by day and never fall to zero at night', () => {
 const sun = BIOME_SUN.island;
 const noon = solarState(12.75, sun), midnight = solarState(1, sun);

 assert.equal(noon.keyScale, 1);
 assert.equal(noon.hemiScale, 1);
 assert.equal(noon.moonIntensity, 0, 'no moon while the sun is up');

 assert.equal(midnight.keyScale, 0, 'the sun contributes nothing at night');
 assert.ok(midnight.moonIntensity > 0, 'the moon is up instead');
 assert.ok(!midnight.sunUp);
 assert.ok(midnight.direction.y > 0, 'and the key light comes from above, not below the ground');
 // A course you cannot read is a bug, not a mood.
 assert.ok(midnight.hemiScale > .25, 'ambient keeps a floor after dark');
 assert.ok(midnight.starness > .9, 'and it is fully night for the things that key off it');
});

test('the clock advances at its rate and wraps', () => {
 assert.equal(advance(10, 0, 3600), 10, 'a frozen clock holds');
 assert.ok(Math.abs(advance(10, 1, 3600) - 11) < 1e-9, 'real time moves an hour in an hour');
 assert.ok(Math.abs(advance(10, 10, 3600) - 20) < 1e-9, 'ten times moves ten');
 assert.ok(Math.abs(advance(23.5, 1, 3600) - .5) < 1e-9, 'and wraps past midnight');
 assert.equal(wrapHour(-1), 23);
 assert.ok(TIME_RATES.includes(1) && TIME_RATES.includes(0), 'real time and frozen are both offered');
});

test('the clock reads the way a clock reads', () => {
 assert.equal(formatClock(0), '12:00 AM');
 assert.equal(formatClock(12), '12:00 PM');
 assert.equal(formatClock(13.5), '1:30 PM');
 assert.equal(formatClock(6.15), '6:09 AM');
 assert.equal(formatClock(24), '12:00 AM');
 for (const [label, hour] of PRESETS) assert.ok(hour >= 0 && hour < 24, `${label} is a real hour`);
});

test('each preset lands in the phase its label claims', () => {
 const sun = BIOME_SUN.pnw, at = h => phaseName(solarState(h, sun));
 assert.equal(at(12.75), 'day');
 assert.equal(at(8.5), 'day');
 assert.equal(at(23), 'night');
 assert.equal(at(6.15), 'dawn');
 assert.equal(at(19.45), 'dusk');
 assert.equal(at(18.9), 'dusk', 'golden hour wears the sunset icon');
});

test('hourForElevation inverts the sun path', () => {
 const peak = peakElevation(BIOME_SUN.mountain);
 for (const target of [5, 20, 40]) {
  const hour = hourForElevation(target, peak);
  assert.ok(Math.abs(solarState(hour, BIOME_SUN.mountain).elevation - target) < .01);
  assert.ok(hour > SUNRISE && hour < SUNSET, 'and stays inside daylight');
 }
 assert.ok(solarPhase(12) > 0 && solarPhase(12) < Math.PI, 'midday is in the day half of the arc');
});

test('the clock never reaches the generator', () => {
 // The whole reason time of day stays out of courseSettings. If the hour could
 // move ground, GENERATOR_VERSION would have to change for a lighting control
 // and every saved course would be invalidated by a sunset.
 const settings = {...DEFAULT_COURSE, seed: 'daylight-guard', holes: 3};
 const dawn = generateWorld(settings), dusk = generateWorld(settings);

 const sample = w => {
  const heights = [];
  for (let x = -300; x <= 300; x += 60) for (let z = -300; z <= 300; z += 60) heights.push(w.height(x, z));
  return heights;
 };
 assert.deepEqual(sample(dusk), sample(dawn), 'terrain is identical');
 assert.deepEqual(
  dusk.trees.map(t => [t.x.toFixed(4), t.z.toFixed(4), t.kind]),
  dawn.trees.map(t => [t.x.toFixed(4), t.z.toFixed(4), t.kind]),
  'planting is identical');
 assert.deepEqual(
  dusk.holes.map(h => h.bunkers.length + ':' + h.ponds.length),
  dawn.holes.map(h => h.bunkers.length + ':' + h.ponds.length),
  'hazards are identical');
 // And the settings object itself never gains a time field.
 assert.ok(!('timeOfDay' in settings), 'time of day is not a course setting');
});

test('the star field turns once a day, the way the sun travels', () => {
 const turn = Math.PI * 2;
 // Tolerance rather than equality: the expression yields -0 at midnight, which
 // is the same rotation but not strictly equal to 0.
 assert.ok(Math.abs(starRotation(0)) < 1e-12, 'midnight is the zero point');
 assert.ok(Math.abs(starRotation(12) + turn / 2) < 1e-9, 'half a turn by midday');
 assert.ok(Math.abs(starRotation(6) + turn / 4) < 1e-9, 'a quarter turn by six');

 // Negative, so the sky wheels the same way the sun crosses it. Stars drifting
 // backwards against a setting sun is the sort of thing you notice without
 // being able to say why.
 assert.ok(starRotation(4) < 0 && starRotation(20) < starRotation(4), 'it only ever turns one way');

 // Midnight has to be a seam, not a jump: 23.999 and 0 differ by a whole turn,
 // which is the same orientation.
 const before = starRotation(23.9999), after = starRotation(0);
 assert.ok(Math.abs((before - after + turn) % turn) < 1e-3, 'the wrap at midnight is invisible');

 // A night is long enough for the movement to actually read.
 const across = Math.abs(starRotation(5) - starRotation(20)) * 180 / Math.PI;
 assert.ok(across > 100, `a night sweeps ${across.toFixed(0)} degrees`);

 const [x, y, z] = STAR_AXIS;
 assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-3, 'the pole axis is unit length');
 assert.ok(y > .3 && y < .95, 'and is tilted, not straight up: stars must not spin about the zenith');
 assert.ok(z > 0, 'leaning toward north, which is +Z in the sun path');
});

test('the glow ball comes up before the stars do', () => {
 const sun = 28, at = h => solarState(h, sun);

 assert.equal(at(12.75).lamplight, 0, 'nothing is lit at midday');
 assert.ok(at(23).lamplight > .99, 'and it is full after dark');

 // You reach for a light while there is still colour in the sky. If the ball
 // only lit when the first star showed, there would be a stretch of dusk where
 // it had already gone grey against the turf and nothing had come on yet.
 const dusk = at(19.45);
 assert.ok(dusk.lamplight > dusk.starness, 'the ball lights before the stars appear');
 // Easing in, not on. With the sun still 7 degrees up a ball that already read
 // as lit would look wrong; what matters is that it is no longer zero, so there
 // is no step when it does arrive.
 const golden = at(18.9).lamplight;
 assert.ok(golden > .05 && golden < .3, `golden hour is a pre-glow, not a lamp (${golden.toFixed(2)})`);

 // Monotonic through the evening: a glow that dipped and recovered would read
 // as a flicker.
 let previous = 0;
 for (let h = 17; h <= 23; h += .25) {
  const now = at(h).lamplight;
  assert.ok(now >= previous - 1e-9, `lamplight never falls back at ${h}`);
  previous = now;
 }
});

test('there is no lit shelf just below the horizon', () => {
 // The bug this pins: the ambient tint used to run off dayness, which only
 // bottomed out five degrees under the horizon. That left a band where the sun
 // contributed nothing but the air was still at dusk brightness AND dusk colour.
 // Flat ground went dark on cue. Anything upright did not, because a vertical
 // surface takes roughly half its hemisphere light from the ground colour, and
 // that colour was still a lit warm brown -- measured at #695242 while the
 // correct-looking frame three degrees later read #2c3137.
 const sun = 23; // links, where a field of tall grass made it impossible to miss
 const at = h => solarState(h, sun);

 // Everything from sunset upward is untouched: this was a fix below the horizon
 // only, and the dusk above it was already right.
 assert.ok(Math.abs(at(18.9).tintAmount - .475) < .01, 'golden hour is unchanged');
 assert.ok(Math.abs(at(19.5).tintAmount - .55) < .01, 'sunset is unchanged');
 assert.equal(at(12).nightness, 0, 'midday is not night at all');

 // Below the horizon it has to actually arrive, and stay arrived.
 const band = [19.733, 19.85, 19.933, 20.5, 5.717];
 for (const h of band) {
  const s = at(h);
  assert.ok(s.elevation < 0, `${h} is below the horizon`);
  assert.ok(s.nightness > .99, `${h} is fully night (${s.nightness.toFixed(3)})`);
  assert.ok(s.tintAmount > .99, `${h} is fully tinted (${s.tintAmount.toFixed(3)})`);
 }

 // And the two frames that disagreed on screen now agree in the model.
 const bad = at(19.733), good = at(19.933);
 assert.ok(Math.abs(bad.tintAmount - good.tintAmount) < .01, 'the two frames match');
 // Channel tolerance rather than exact hex: nightness is .999 at the first of
 // these, not a clean 1, and the point is that the eye cannot tell them apart.
 const near = (a, b, what) => {
  for (const c of ['r', 'g', 'b']) assert.ok(Math.abs(a[c] - b[c]) < .01, `${what} matches on ${c}`);
 };
 near(bad.tint, good.tint, 'the air tint');
 // The ground colour is the one upright surfaces drink from, so it matters most.
 near(bad.groundTint, good.groundTint, 'the hemisphere ground tint');

 // Monotonic through the descent: a tint that recovered would read as the sky
 // briefly brightening again after sunset.
 let last = 0;
 for (let h = 19.5; h <= 21; h += .05) {
  const n = at(h).nightness;
  assert.ok(n >= last - 1e-9, `nightness never falls back at ${h.toFixed(2)}`);
  last = n;
 }
});

test('ground bounce only ever dims as the sun goes down', () => {
 // The invariant that was violated, and the reason tall grass glowed at dusk.
 //
 // Sky and ground do not share a dusk colour. DUSK is a lit sky at luminance
 // .385 -- more than twice the daytime hemisphere ground colour #777855 at .180
 // -- so mixing the ground toward it made bounce light BRIGHTER as the sun set,
 // peaking 62% above its noon value just before sunset.
 //
 // It was invisible on flat ground, which takes its hemisphere light entirely
 // from the sky colour, and glaring on anything upright, which takes about half
 // from the ground colour. Short grass fine, tall grass beside it on fire, same
 // material and same light: that pattern means this and nothing else.
 const GROUND_BASE = new T.Color('#777855');
 const lum = c => .2126 * c.r + .7152 * c.g + .0722 * c.b;
 const bounceAt = h => {
  const s = solarState(h, 23);
  return lum(GROUND_BASE.clone().lerp(s.groundTint, s.tintAmount));
 };

 const noon = bounceAt(12);
 assert.ok(Math.abs(noon - lum(GROUND_BASE)) < 1e-6, 'midday leaves the ground colour exactly alone');

 let previous = Infinity;
 for (let h = 12; h <= 21.5; h += .05) {
  const now = bounceAt(h);
  assert.ok(now <= previous + 1e-6, `bounce brightens at ${h.toFixed(2)} (${previous.toFixed(4)} -> ${now.toFixed(4)})`);
  assert.ok(now <= noon + 1e-6, `bounce exceeds its midday value at ${h.toFixed(2)}`);
  previous = now;
 }

 assert.ok(bounceAt(21) < noon * .2, 'and it is far below midday once night has fallen');

 // The sky may stay bright through dusk -- that half is a lit sky and is allowed
 // to be. Only the ground half is bounce.
 const SKY_BASE = new T.Color('#cce5ff');
 const skyAt = h => { const s = solarState(h, 23); return lum(SKY_BASE.clone().lerp(s.tint, s.tintAmount)); };
 assert.ok(skyAt(19.3) > skyAt(20), 'the sky still darkens into night');
});
