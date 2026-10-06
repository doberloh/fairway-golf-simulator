// The driving range. Its whole value is that it is the SAME everywhere and the
// same every visit, so these assert flatness, constant width and determinism
// rather than anything about how it looks. RESEARCH.md carries the reasoning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, fairwayWidth, localSurface, greenDistance, teeBox, TEE_PAD, TEE_APRON, TEE_ROUND, TEE_APRON_SCALE} from '../src/course.js';
import {buildRange, moveRangeGreen, rangeGreenYards, RANGE_SETTINGS, RANGE_DEPTH, RANGE_WIDTH,
 GREEN_RANGE, DEFAULT_GREEN_YARDS, rangeTargets, TARGET_YARDS, TARGET_COLORS, TARGET_RADIUS,
 offlineOf, SHOT_LINE_MAX, SHOT_LINE_DEFAULT, cleanShotLines} from '../src/range.js';

const YARD = 0.9144;
const world = generateWorld(RANGE_SETTINGS);
const range = world.holes[0];

test('the range is 500 yards deep and 100 yards wide', () => {
 assert.equal(world.holes.length, 1, 'the range is one hole');
 assert.ok(Math.abs(RANGE_DEPTH / YARD - 500) < .01, `${(RANGE_DEPTH / YARD).toFixed(1)} yd deep`);
 assert.ok(Math.abs(RANGE_WIDTH / YARD - 100) < .01, `${(RANGE_WIDTH / YARD).toFixed(1)} yd wide`);
 // Constant width, not a fairway that pinches. A hole necks into an approach at
 // the green; a range must not, or long clubs land on the one narrow part.
 const widths = [];
 for (let y = 20; y <= 480; y += 20) widths.push(fairwayWidth(range, y * YARD, 0, 1));
 const min = Math.min(...widths), max = Math.max(...widths);
 assert.ok(max - min < .01, `width varies from ${min.toFixed(1)} to ${max.toFixed(1)} m down the field`);
 assert.ok(Math.abs(max - RANGE_WIDTH / 2) < .01, `half width is ${max.toFixed(1)} m, expected ${(RANGE_WIDTH / 2).toFixed(1)}`);
});

test('the range is dead flat and dead straight', () => {
 // Flat is not a preference, it is what makes the range an instrument: any tilt
 // is a variable the player did not set, silently added to every carry.
 const heights = [], centres = [];
 for (let y = 0; y <= 500; y += 10) {
  const z = y * YARD;
  heights.push(range.height(0, z));
  centres.push(Math.abs(range.center(z)));
 }
 const relief = Math.max(...heights) - Math.min(...heights);
 assert.ok(relief < .001, `${(relief * 100).toFixed(2)} cm of relief down the field`);
 assert.ok(Math.max(...centres) < .001, 'the centre line is not straight');
});

test('turf runs from behind the mats to the back of the field', () => {
 // The gap this closes: a generated hole starts its fairway where the tee shot
 // is expected to LAND, so everything short of that is unmown. On a range the
 // short clubs have to land on the same turf the long ones do.
 for (let y = 10; y <= 480; y += 10) {
  const surface = range.surface(0, y * YARD);
  assert.ok(['fairway', 'green', 'fringe'].includes(surface),
   `${y} yd down the middle is ${surface}`);
 }
 // The mats themselves, and the ground immediately behind them.
 for (const tee of Object.values(range.tees))
  assert.equal(range.surface(tee.x, tee.z), 'tee', 'a mat is not on a tee surface');
});

test('the field is the full width at every distance a ball can reach', () => {
 const half = RANGE_WIDTH / 2;
 for (const y of [25, 100, 250, 400, 475]) {
  const z = y * YARD;
  // Just inside each edge is mown; just outside is not.
  assert.ok(['fairway', 'green', 'fringe'].includes(range.surface(half - 1, z)),
   `${y} yd, 1 m inside the right edge is ${range.surface(half - 1, z)}`);
  assert.ok(['fairway', 'green', 'fringe'].includes(range.surface(-(half - 1), z)),
   `${y} yd, 1 m inside the left edge is ${range.surface(-(half - 1), z)}`);
  assert.equal(range.surface(half + 25, z), 'rough', `${y} yd, well outside the edge is not rough`);
 }
});

test('the range is identical every visit', () => {
 // Nothing here is drawn from a seed. Two ranges built from different seeds are
 // the same range, because a practice ground that changes between sessions
 // cannot be used to compare two shots taken on different days.
 const a = buildRange({seed: 'ONE'}), b = buildRange({seed: 'TWO'});
 assert.equal(a.length, b.length);
 assert.deepEqual(a.green, b.green);
 assert.deepEqual(Object.keys(a.tees), Object.keys(b.tees));
 for (const name of Object.keys(a.tees)) assert.deepEqual(a.tees[name], b.tees[name]);
 for (let y = 0; y <= 500; y += 25) {
  const z = y * YARD;
  assert.equal(a.surface(0, z), b.surface(0, z), `${y} yd differs between seeds`);
  assert.equal(fairwayWidth(a, z, 0, 1), fairwayWidth(b, z, 0, 1));
 }
 // And no hazards to vary.
 assert.deepEqual(a.ponds, []);
 assert.deepEqual(a.bunkers, []);
 assert.deepEqual(a.trees, []);
});

test('the green moves without shortening the field', () => {
 // The slider's whole trick: the ground shader reads the green's position from
 // the cup atlas, NOT from the hole's length, so the green can sit anywhere and
 // the field stays mown to 500 yd behind it. If this ever fails, the fairway is
 // being drawn from the green again and the slider will mow the range short.
 const h = buildRange();
 for (const yards of [GREEN_RANGE[0], 90, 150, 220, GREEN_RANGE[1]]) {
  assert.equal(Math.round(moveRangeGreen(h, yards)), yards);
  assert.ok(Math.abs(h.green.z / YARD - yards) < .01, 'the green did not move');
  assert.ok(Math.abs(h.pin.z - h.green.z) < 1e-9, 'the cup did not follow the green');
  assert.equal(h.length, RANGE_DEPTH, 'moving the green changed the depth of the field');
  assert.equal(localSurface(h, 0, 480 * YARD), 'fairway',
   `with the green at ${yards} yd the back of the field stopped being mown`);
  assert.equal(localSurface(h, 0, h.green.z), 'green', 'the green is not where it was put');
 }
 // And it cannot be driven off the property in either direction.
 assert.equal(moveRangeGreen(h, -50), GREEN_RANGE[0]);
 assert.equal(moveRangeGreen(h, 9999), GREEN_RANGE[1]);
 assert.equal(rangeGreenYards({}), DEFAULT_GREEN_YARDS);
 assert.equal(rangeGreenYards({rangeGreen: 9999}), GREEN_RANGE[1]);
});

test('a course is unaffected by the range existing', () => {
 // `noNeck` is read by fairwayWidth, which every hole calls. A generated hole
 // must still neck into its approach, or every green on every course just lost
 // its apron.
 const course = generateWorld({seed: 'NECK', holes: 9, water: 0, homes: false});
 for (const h of course.holes) {
  assert.ok(!h.noNeck, `hole ${h.hole + 1} came out flagged as a range`);
  // Measured against the WIDEST point of the mown corridor, not a fixed fraction
  // of the hole: a par three mows only a short approach, so two thirds of the way
  // down one is unmown ground and reads as zero width.
  let widest = 0;
  for (let z = h.mowStart ?? h.fairwayStart; z < h.length - 30; z += 4)
   widest = Math.max(widest, fairwayWidth(h, z, 0, 1));
  const atGreen = fairwayWidth(h, h.length - 4, 0, 1);
  assert.ok(atGreen < widest,
   `hole ${h.hole + 1} did not neck: ${widest.toFixed(1)} m at its widest, ${atGreen.toFixed(1)} m at the green`);
 }
});

test('the painted ground and the lie the ball gets are the same surface', () => {
 // The ground shader in ground.js classifies turf itself, in GLSL, from data
 // textures built out of center(z), fairwayWidth and the green. localSurface
 // classifies the LIE. Nothing forces them to agree, so this re-implements the
 // shader's ordering from the same inputs and checks that it does.
 //
 // It did not. localSurface tested the green's semi collar BEFORE the fairway,
 // while the shader paints the corridor over that collar -- so the apron short of
 // every green was drawn as fairway and played as semi-rough. Half a percent of a
 // hole, invisible until the range put a green inside a full-width corridor.
 const shaderKind = (h, x, z) => {
  const s = h.settings, side = x - h.center(z), gd = greenDistance(h, x, z);
  const fw = Math.abs(x - h.center(z)) - fairwayWidth(h, z, 0, side);
  const outer = fairwayWidth(h, z, s.semiRough, side), ms = h.mowStart ?? h.fairwayStart;
  let kind = 'rough';
  if ((z > ms - s.semiRough && z < h.length + 8 + s.semiRough && Math.abs(x - h.center(z)) < outer)
   || gd < s.fringe + s.semiRough) kind = 'semi';
  if (z > ms && z < h.length + 8 && fw < 0) kind = 'fairway';
  if (gd < s.fringe) kind = 'fringe';
  if (gd <= 0) kind = 'green';
  for (const t of Object.values(h.tees)) {
   if (kind === 'rough' && teeBox(x - t.x, z - t.z, TEE_APRON.x, TEE_APRON.z, TEE_ROUND * TEE_APRON_SCALE) < 0) kind = 'semi';
   if (teeBox(x - t.x, z - t.z, TEE_PAD.x, TEE_PAD.z, TEE_ROUND) < 0) kind = 'tee';
  }
  return kind;
 };
 let bad = 0, total = 0, example = null;
 for (let z = -20; z < range.length + 20; z += 2) for (let x = -70; x <= 70; x += 2) {
  total++;
  const lie = range.surface(x, z), painted = shaderKind(range, x, z);
  if (lie !== painted) { bad++; example ??= `x=${x} z=${z.toFixed(0)}: lie ${lie}, painted ${painted}`; }
 }
 // The range has no hazards and no necking, so it is the one surface where the
 // two can be required to agree exactly. A course still differs by a fraction of
 // a percent behind the green, where the shader mows 8 m past the hole and
 // fairwayWidth stops at it -- recorded in RESEARCH.md, not fixed here.
 assert.equal(bad, 0, `${(100 * bad / total).toFixed(2)}% of the range disagrees — ${example}`);
});

test('the targets read as an ordered ladder down the field', () => {
 const targets = rangeTargets();
 assert.equal(targets.length, TARGET_YARDS.length);
 for (let i = 1; i < targets.length; i++) {
  assert.ok(targets[i].yards > targets[i - 1].yards, 'the targets are not in distance order');
  assert.equal(targets[i].side, -targets[i - 1].side, 'two targets in a row on the same side');
 }
 // A colour each, all different, and none of them blue or cyan. A flat green
 // already paints as a blue disc under the slope-reading overlay, so a blue
 // target would read as that same fault or as water.
 const colours = new Set(targets.map(t => t.color));
 assert.equal(colours.size, targets.length, 'two targets share a colour');
 // Tested by HUE, not by "is blue biggest". The first version of this check
 // rejected any colour whose blue channel led, which failed the purple at 250 yd
 // -- a purple is blue AND red. What actually has to be kept out is the cyan and
 // azure band, because that is the band water and the slope overlay occupy. A
 // blue-violet is nothing like either.
 const hueOf = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
 };
 for (const t of targets) {
  const hue = hueOf(t.color);
  assert.ok(hue < 160 || hue > 215,
   `${t.yards} yd sits in the cyan band at ${hue.toFixed(0)} deg (${t.color}) and will read as water`);
 }
 // And every one of them is actually reachable: a target past the back of the
 // field is a number nobody can hit.
 for (const t of targets) assert.ok(t.z < RANGE_DEPTH, `the ${t.yards} yd target is off the back`);
});

test('no target hangs off the field, and none overlaps another', () => {
 const half = RANGE_WIDTH / 2, targets = rangeTargets();
 for (const t of targets) {
  assert.ok(Math.abs(t.x) + t.radius < half,
   `the ${t.yards} yd target reaches ${(Math.abs(t.x) + t.radius).toFixed(1)} m, past the ${half.toFixed(1)} m edge`);
  // Sitting on mown turf, not in the rough alongside it.
  assert.equal(range.surface(t.x, t.z), 'fairway', `the ${t.yards} yd target is on ${range.surface(t.x, t.z)}`);
 }
 for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
  const a = targets[i], b = targets[j];
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius,
   `the ${a.yards} and ${b.yards} yd targets overlap`);
 }
});

test('the green slider can never drive the green through a target', () => {
 // This is the reason TARGET_OFFSET is derived from the green's own reach
 // rather than chosen by eye. The green runs the whole centre line, so a
 // clearance that holds at 150 yd and fails at 300 would be a bug nobody found
 // until they dragged the slider to the end.
 const h = buildRange();
 for (let yards = GREEN_RANGE[0]; yards <= GREEN_RANGE[1]; yards += 5) {
  moveRangeGreen(h, yards);
  for (const t of rangeTargets()) {
   // Walk the target's rim and require every point of it to be off the green.
   for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2;
    const x = t.x + Math.cos(a) * t.radius, z = t.z + Math.sin(a) * t.radius;
    assert.ok(greenDistance(h, x, z) > 0,
     `green at ${yards} yd overlaps the ${t.yards} yd target`);
   }
  }
 }
});

test('moving the green refreshes the coordinates the scene actually reads', () => {
 // routeHoles CACHES worldPin and worldGreen at generation time rather than
 // deriving them on read, and it replaces the identity toWorld the builder
 // writes with a real translation. Half the scene reads those cached values --
 // the flagstick, the cup, the green-reading mesh, the overview camera -- so a
 // green moved without refreshing them leaves the flag standing in an empty
 // fairway where the green used to be. Built through generateWorld on purpose:
 // a bare buildRange hole has an identity transform and would pass either way.
 const w = generateWorld(RANGE_SETTINGS), h = w.holes[0];
 assert.notEqual(h.toWorld({x: 0, z: 0}).z, 0, 'the routed transform is identity — this test proves nothing');
 for (const yards of [30, 90, 150, 240, 300]) {
  moveRangeGreen(h, yards);
  const expected = h.toWorld(h.pin);
  assert.ok(Math.hypot(h.worldPin.x - expected.x, h.worldPin.z - expected.z) < 1e-9,
   `worldPin is stale with the green at ${yards} yd`);
  assert.ok(Math.hypot(h.worldGreen.x - expected.x, h.worldGreen.z - expected.z) < 1e-9,
   `worldGreen is stale with the green at ${yards} yd`);
  // The card reads its number off the tee, so every mat has to learn the new one.
  for (const [name, tee] of Object.entries(h.tees))
   assert.ok(Math.abs(tee.yards - yards) < .01, `the ${name} mat still reads ${tee.yards.toFixed(0)} yd`);
 }
});

test('offline is measured across the aim line, and right is positive', () => {
 // A shot-direction sign error has shipped four separate times in this project.
 // It is invisible in isolation -- the number looks plausible either way -- and
 // only shows up as a fade being reported as a draw. So the rotation is pinned
 // here rather than trusted.
 const origin = {x: 0, z: 0};
 // Aiming straight down the field (+z). A ball finishing right of the line is a
 // positive offline; left is negative; dead straight is zero at any distance.
 // The golfer's right is local -x (renderer.js, *Which side is right*): this
 // test pinned the mirror image until 5 October, which is the fifth time.
 assert.ok(Math.abs(offlineOf(origin, {x: 0, z: 140}, 0)) < 1e-9, 'a straight shot is not zero');
 assert.ok(offlineOf(origin, {x: -12, z: 140}, 0) > 0, '-x down a 0 deg aim is not reported right');
 assert.ok(offlineOf(origin, {x: 12, z: 140}, 0) < 0, '+x down a 0 deg aim is not reported left');
 assert.ok(Math.abs(offlineOf(origin, {x: -12, z: 140}, 0) - 12) < 1e-9, 'offline is not in metres');

 // The whole point of measuring across the AIM line: the same finishing spot is
 // a straight shot when you aimed there and a miss when you did not.
 const aimed = 25 * Math.PI / 180;
 const onTheAimedLine = {x: Math.sin(aimed) * 140, z: Math.cos(aimed) * 140};
 assert.ok(Math.abs(offlineOf(origin, onTheAimedLine, 25)) < 1e-9,
  'a ball on the line it was aimed down is not being read as straight');
 // A +25 deg aim turns toward local +x, which is the golfer's left.
 assert.ok(offlineOf(origin, onTheAimedLine, 0) < -50,
  'the same ball judged against a 0 deg aim should be a long way left');

 // Symmetric about the aim, whichever way the aim points.
 for (const heading of [-140, -35, 0, 35, 140]) {
  const rad = heading * Math.PI / 180;
  // The golfer's right of a bearing (sin a, cos a) is (-cos a, sin a).
  const across = {x: -Math.cos(rad) * 8, z: Math.sin(rad) * 8};
  assert.ok(Math.abs(offlineOf(origin, across, heading) - 8) < 1e-9,
   `8 m right of a ${heading} deg aim did not read as 8 m right`);
 }
});

// The shot-line preference. A session leaves one tracer per shot and the field
// has to stay readable, so the setting is bounded at both ends and anything the
// browser hands back -- including a key that was never written -- has to land on
// a number the renderer can use.
test('shot line count is clamped, rounded, and defaults when there is nothing stored', () => {
 for (const absent of [null, undefined, '', 'abc', NaN, {}]) {
  assert.equal(cleanShotLines(absent), SHOT_LINE_DEFAULT,
   `${String(absent)} should fall back to the default rather than to zero`);
 }
 assert.equal(cleanShotLines(-5), 0, 'a negative count is a clear field, not an error');
 assert.equal(cleanShotLines(SHOT_LINE_MAX + 500), SHOT_LINE_MAX, 'the ceiling holds');
 assert.equal(cleanShotLines(12.6), 13, 'a fractional count is rounded, not truncated');
 assert.equal(cleanShotLines('25'), 25, 'a slider hands back a string');
 assert.equal(cleanShotLines(0), 0, 'zero is a real choice and must survive');
 assert.ok(SHOT_LINE_DEFAULT > 0 && SHOT_LINE_DEFAULT <= SHOT_LINE_MAX,
  'the default has to be inside the range the control offers');
});

// The trail store is capped at the CEILING, not at the current setting: raising
// the slider has to show lines that were already hit. This is the rule main.js
// applies in `pushTrail`, asserted here so the two cannot drift apart.
test('a capped trail store keeps the ceiling, and the tail is what gets drawn', () => {
 const trails = [];
 const push = p => {
  trails.push(p);
  if (trails.length > SHOT_LINE_MAX) trails.splice(0, trails.length - SHOT_LINE_MAX);
 };
 for (let i = 0; i < SHOT_LINE_MAX * 3; i++) push(i);
 assert.equal(trails.length, SHOT_LINE_MAX, 'the store never grows past the ceiling');
 assert.equal(trails.at(-1), SHOT_LINE_MAX * 3 - 1, 'the newest shot is kept');
 assert.equal(trails[0], SHOT_LINE_MAX * 2, 'the oldest shots are the ones dropped');

 const visible = n => (n ? trails.slice(-n) : []);
 assert.deepEqual(visible(0), [], 'zero draws nothing');
 assert.equal(visible(5).length, 5, 'five draws five');
 assert.equal(visible(5).at(-1), trails.at(-1), 'and they are the LAST five, not the first');
 assert.equal(visible(SHOT_LINE_MAX).length, SHOT_LINE_MAX,
  'the whole store is reachable once the setting is raised again');
});

// WHY `setRangeGreen` has two paths. A flat green is four floats in the cup
// atlas and slides in place; a contoured one cannot be slid at all, because its
// shape is baked into the world's height field. Sliding one leaves the cup on
// ground that is flat while the contours stay where the green used to be -- and
// nothing complains, which is exactly how this got shipped broken once.
test('a contoured green cannot be slid, only regrown', () => {
 const shaped = {...RANGE_SETTINGS, greenDifficulty: 70, rangeGreen: 150};
 const slopeAt = (h, p) => {
  const e = 0.25;
  return Math.hypot((h.height(p.x + e, p.z) - h.height(p.x - e, p.z)) / (2 * e),
   (h.height(p.x, p.z + e) - h.height(p.x, p.z - e)) / (2 * e));
 };
 const built = generateWorld(shaped).holes[0];
 assert.ok(slopeAt(built, built.pin) > 0.01,
  'a difficulty-70 green should have a real slope under the pin to begin with');

 // The cheap path, applied to a green that cannot take it.
 const slid = generateWorld(shaped).holes[0];
 moveRangeGreen(slid, 250);
 const after = slopeAt(slid, slid.pin);

 // The honest path: regrow at the new distance.
 const regrown = generateWorld({...shaped, rangeGreen: 250}).holes[0];
 assert.ok(slopeAt(regrown, regrown.pin) > 0.01,
  'a regrown contoured green keeps its slope under the pin');
 assert.ok(after < slopeAt(regrown, regrown.pin) / 4,
  `sliding a contoured green left ${(after * 100).toFixed(2)}% under the cup where regrowing gives `
  + `${(slopeAt(regrown, regrown.pin) * 100).toFixed(2)}% -- if these ever match, the slide is safe `
  + 'and the two-path branch in setRangeGreen can go');
});
