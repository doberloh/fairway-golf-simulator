// The lab: measurement, not a mode.
//
// Greens are where a golf simulator is believed or disbelieved, and they are the
// hardest part to check: the interesting behaviour happens in the last half metre
// of a putt, on ground that is different every time, at speeds nobody can set by
// eye. Testing it by playing holes and hoping the right situation turns up is not
// testing it.
//
// This file is the arithmetic for doing it deliberately: plan a shot the way a
// golfer describes one (how far from the hole, how far past it the ball would
// finish, how far off centre the line runs), solve the launch that delivers it,
// and read the outcome back in the same terms.
//
// THE BENCH IS THE DRIVING RANGE. There used to be a lab MODE with its own world
// -- and before that its own 260-yard hole, which doglegged, so firing straight
// back from the pin wandered across rough, semi and fairway, and was too short
// for a 240-yard carry, so the driver preset started 46 m behind the tee in
// rough. None of that was visible from the readout. The range is what a practice
// ground is: straight, flat, mown end to end and the same every visit, with a
// green that moves to a stated number. So the mode is gone, `Lab tools` in the
// range sets the two turf numbers that matter, and everything here runs against
// whatever course is loaded.
//
// The twelve putt presets and four approach presets went with the mode. They
// were a menu of shots to click; `lab.batch`, `lab.drops` and `lab.scatter` ask
// the same questions as a sweep and answer them with a distribution instead of
// one ball, which is what the fitting work actually used.
//
// Nothing here is a second physics model. The shot it fires is the shot the game
// fires, on a course the generator built, and the launch speed is solved with the
// same roll preview the aim line is drawn from.

const FOOT = 0.3048, INCH = 0.0254;

// Where to put the ball and which way to aim.
//
// `bearing` is the compass direction the ball travels, in degrees, and the ball
// is placed that far back along it. With a flat green it changes nothing; with a
// slope it is the whole point, because it selects uphill, downhill or sidehill.
// `offset` is inches the line passes to the side of the cup, and on a flat green
// the path is straight so the offset asked for is the offset delivered.
export function shotPlan({feet = 10, past = 1.4, offset = 0, bearing = 0} = {}) {
 const distance = feet * FOOT, side = offset * INCH, rad = bearing * Math.PI / 180;
 return {
  distance,
  side,
  bearing,
  // Back along the travel direction from the cup.
  back: {x: -Math.sin(rad) * distance, z: -Math.cos(rad) * distance},
  aimDegrees: bearing + Math.atan2(side, distance) * 180 / Math.PI,
  target: distance + past * FOOT,
 };
}

// The slope of the green at the cup: how steep, and which way is downhill. A
// putt is only "downhill" relative to this, so it is reported rather than
// assumed -- greenDifficulty sets a magnitude, not a direction.
export function greenSlope(course, pin, step = 0.25) {
 const gx = (course.height(pin.x + step, pin.z) - course.height(pin.x - step, pin.z)) / (2 * step);
 const gz = (course.height(pin.x, pin.z + step) - course.height(pin.x, pin.z - step)) / (2 * step);
 const magnitude = Math.hypot(gx, gz);
 return {
  percent: Math.round(magnitude * 10000) / 100,
  // Downhill is the direction the surface falls, so the negated gradient.
  downhill: Math.round(Math.atan2(-gx, -gz) * 180 / Math.PI * 10) / 10,
 };
}

// Launch speed that makes the ball finish `target` metres away, found with the
// same preview the aim ring uses so the lab and the game agree by construction.
export function solveLaunch(preview, target) {
 let lo = 0.05, hi = 12;
 for (let i = 0; i < 34; i++) {
  const mid = (lo + hi) / 2;
  if (preview(mid) < target) lo = mid; else hi = mid;
 }
 return (lo + hi) / 2;
}

// The capture envelope of the cup as it stands, swept rather than reasoned
// about: for each offset, the firmest putt that still drops, reported in the
// terms a golfer uses -- how far past the hole that ball would have finished.
export function envelope(fire, {offsets = [0, 0.5, 1, 1.5, 2], decel} = {}) {
 return offsets.map(offset => {
  let holes = null, misses = 30;
  for (let past = 0.25; past <= 30; past += 0.25) {
   if (fire({offset, past})) holes = past; else {misses = past; break;}
  }
  if (holes === null) return {offset, limitFeet: 0};
  let lo = holes, hi = misses;
  for (let i = 0; i < 12; i++) {
   const mid = (lo + hi) / 2;
   if (fire({offset, past: mid})) lo = mid; else hi = mid;
  }
  return {offset, limitFeet: Math.round(lo * 10) / 10,
   entrySpeed: decel ? Math.round(Math.sqrt(2 * decel * lo * FOOT) * 1000) / 1000 : undefined};
 });
}

// What actually happened, in the terms the behaviour is argued about.
//
// `groundAt(x, z)` gives the height of the turf under a point. Height has to be
// measured against that and not against zero: the green sits wherever the
// generator put it, and reading the raw y of a point reported a 12 m hop for a
// putt that never left the ground.
export function outcome(result, pin, groundAt, ballRadius) {
 const end = Math.hypot(result.end.x - pin.x, result.end.z - pin.z);
 // Only the part of the roll beyond the hole can hop, and a holed ball drops
 // below the turf on its way into the cup, which is not a hop either.
 const after = result.holed ? [] : result.points.filter(p =>
  Math.hypot(p.x - pin.x, p.z - pin.z) > 0.05);
 const hop = after.reduce((best, p) =>
  Math.max(best, p.y - groundAt(p.x, p.z) - ballRadius), 0);
 return {
  holed: !!result.holed,
  lipped: !!result.lipped,
  hopMm: Math.round(Math.max(0, hop) * 1000),
  finishedFeet: Math.round(end / FOOT * 10) / 10,
  rolled: Math.round(result.total / FOOT * 10) / 10,
 };
}

// Dropping a ball onto the green.
//
// An approach shot is described by how steeply it comes down, how fast, and how
// much it is spinning -- the three numbers a launch monitor reports for a ball
// arriving at a green. Firing one from a tee and hoping it turns up that way is
// not a controlled test, so the ball is started in the air instead, and the
// simulator grew a `height` for it.
//
// `feet` is where it should LAND relative to the cup, not where it starts: the
// start is solved backwards from the flight so the landing lands where asked.
export function dropPlan({height = 12, descent = 45, speed = 25, spin = 6000, bearing = 0, feet = 0} = {}) {
 return {height, descent, speed, spin, bearing, landing: feet * FOOT,
  shot: {aim: bearing, hla: 0, vla: -Math.abs(descent), spin, spinAxis: 0, speed, height}};
}

// Where it first touched, how far it ran after that, and how many times it
// bounced. Rollout is signed: a ball with enough backspin finishes behind its
// pitch mark, and reporting that as a positive number would hide the check.
export function dropOutcome(result, groundAt, ballRadius, landingFromCup = 0) {
 const carry = result.carry ?? 0;
 let bounces = 0, airborne = false;
 for (const p of result.points) {
  const up = p.y - groundAt(p.x, p.z) - ballRadius > 0.02;
  if (up && !airborne) airborne = true;
  else if (!up && airborne) {airborne = false; bounces++;}
 }
 return {
  landedFeet: Math.round(landingFromCup / FOOT * 10) / 10,
  rolloutFeet: Math.round((result.total - carry) / FOOT * 10) / 10,
  totalFeet: Math.round(result.total / FOOT * 10) / 10,
  bounces,
  hazard: result.hazard || null,
 };
}

// Jitter, so a group can be looked at instead of a single shot.
//
// Seeded on purpose: a dispersion pattern nobody can reproduce is an anecdote.
// The spread is applied to launch speed and to aim, which are the two things a
// golfer actually varies, and it is Gaussian rather than uniform because a
// player's misses cluster around their intention.
export function jitterStream(seed = 'JITTER') {
 let a = 2166136261;
 for (const c of String(seed)) { a ^= c.charCodeAt(0); a = Math.imul(a, 16777619); }
 const next = () => {
  a += 0x6D2B79F5;
  let t = Math.imul(a ^ a >>> 15, a | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
 };
 // Box-Muller, clamped so one freak sample cannot throw a ball off the green.
 return () => {
  const u = Math.max(1e-9, next()), v = next();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-3, Math.min(3, g));
 };
}

// What a group of shots did, which is the point of firing a group.
export function groupStats(results, pin) {
 const holed = results.filter(r => r.holed).length;
 const spread = results.map(r => Math.hypot(r.end.x - pin.x, r.end.z - pin.z));
 const mean = spread.reduce((a, b) => a + b, 0) / (spread.length || 1);
 const sorted = [...spread].sort((a, b) => a - b);
 return {
  shots: results.length,
  holed,
  holedPercent: Math.round(holed / (results.length || 1) * 1000) / 10,
  meanFeet: Math.round(mean / FOOT * 10) / 10,
  medianFeet: Math.round((sorted[Math.floor(sorted.length / 2)] || 0) / FOOT * 10) / 10,
  worstFeet: Math.round((sorted.at(-1) || 0) / FOOT * 10) / 10,
 };
}
