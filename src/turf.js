// THE TURF. What the ground does to a ball: how it bounces, how it grips a
// spinning ball, how it lets go of a rolling one -- for every surface a ball can
// meet, under the three course conditions a player sets:
//
//   stimp            green speed, in feet on a Stimpmeter (true to life)
//   greenFirmness    how hard the greens and their collars are
//   courseFirmness   how hard everything else is: tees, fairways, rough
//
// Pure: no DOM, no three.js. physics.js asks `turfOf(surface, conditions)` for
// one row and plays the ball off it; nothing else decides how ground behaves.
// docs/BALL_PHYSICS.md, *The ground*, has every number's source.
import {GROUNDS} from './grounds.js';

const G = 9.80665;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---- the three conditions ----------------------------------------------------
// Firmness is a number from -1 (soft) through 0 (medium) to +1 (firm). The three
// names are what a player picks; anything between is allowed, so the lab and a
// future slider can be continuous.
export const FIRMNESS = Object.freeze({soft: -1, medium: 0, firm: 1});
export const FIRMNESS_NAMES = Object.freeze(['soft', 'medium', 'firm']);
export const FIRMNESS_LABELS = Object.freeze({soft: 'Soft', medium: 'Medium', firm: 'Firm'});
export const STIMP_RANGE = Object.freeze({min: 6, max: 15, step: .5});
export const DEFAULT_TURF = Object.freeze({stimp: 10, greenFirmness: 'medium', courseFirmness: 'medium'});

export function firmnessValue(input) {
 if (typeof input === 'number' && Number.isFinite(input)) return clamp(input, -1, 1);
 return FIRMNESS[String(input ?? '').toLowerCase()] ?? 0;
}
export function firmnessName(input) {
 const v = firmnessValue(input);
 return v < -.5 ? 'soft' : v > .5 ? 'firm' : 'medium';
}
// A conditions object checked and completed. Accepts what older saves and
// challenge codes carried -- one `firmness` (a name, or the old instrument depth
// in inches) and roll percentages -- and reads them as the three conditions.
export function turfConfig(input = {}) {
 const src = input || {};
 const p = {stimp: src.stimp ?? DEFAULT_TURF.stimp,
  greenFirmness: src.greenFirmness ?? legacyFirmness(src.firmness) ?? DEFAULT_TURF.greenFirmness,
  courseFirmness: src.courseFirmness ?? legacyCourse(src.fairway) ?? DEFAULT_TURF.courseFirmness};
 if (!Number.isFinite(p.stimp) || p.stimp < STIMP_RANGE.min || p.stimp > STIMP_RANGE.max)
  throw Error(`Green speed must be ${STIMP_RANGE.min}–${STIMP_RANGE.max} ft on the Stimpmeter.`);
 for (const k of ['greenFirmness', 'courseFirmness']) {
  if (typeof p[k] === 'number') { if (!Number.isFinite(p[k])) throw Error('Firmness must be soft, medium or firm.'); p[k] = clamp(p[k], -1, 1); }
  else { p[k] = String(p[k]).toLowerCase(); if (!(p[k] in FIRMNESS)) throw Error('Firmness must be soft, medium or firm.'); }
 }
 return p;
}
// The old single firmness: Burnt, Firm, Normal, Soft, or inches of penetration
// on the USGA's firmness meter (0.30 burnt to 0.60 soft).
function legacyFirmness(f) {
 if (f == null) return null;
 if (typeof f === 'number') return f <= .40 ? 'firm' : f >= .53 ? 'soft' : 'medium';
 return {burnt: 'firm', firm: 'firm', normal: 'medium', soft: 'soft'}[String(f).toLowerCase()] ?? null;
}
// The old fairway roll percentage: 100 was the default.
const legacyCourse = pct => !Number.isFinite(pct) ? null : pct >= 125 ? 'firm' : pct <= 80 ? 'soft' : 'medium';

// ---- the Stimpmeter ----------------------------------------------------------
// A Stimpmeter releases a ball already rolling at 1.83 m/s (6.00 ft/s) and the
// reading is how many feet it runs on the level. So the green's rolling
// deceleration is fixed by the reading and nothing else: a = v^2 / (2 d).
export const STIMP_RELEASE_SPEED = 1.83;
export const FOOT = .3048;
export const stimpDeceleration = stimp => STIMP_RELEASE_SPEED ** 2 / (2 * stimp * FOOT);

// ---- every surface -----------------------------------------------------------
// One row per surface. The columns:
//
//   e0, eHi   restitution of a slow bounce (e0) and of a fast one (eHi, at
//             `E_FAST` m/s into the ground and above). Turf gives a soft landing
//             to a hard impact -- the ball craters it -- and a livelier one to
//             a gentle hop, which is why a ball bounces three or four times and
//             does not just thud. Penner (2002) fitted the curve on a green.
//   tilt      degrees the ground is effectively tilted back toward an arriving
//             ball at the reference impact (18.6 m/s, 44.4 degrees from the
//             vertical): the front wall of the pitch mark it is digging. Grows
//             with speed and with how glancing the impact is. Penner (2002).
//   mu        friction the turf can exert on the ball during the bounce, as a
//             share of how hard the ball is pressed in. Decides whether a
//             spinning ball GRIPS (spin is spent in one bite) or SKIDS (it keeps
//             some backspin for the next bounce).
//   grab      share of the ball's travel the grass itself swallows on contact,
//             beyond friction: nothing on a green, most of it in heavy rough.
//   slide     friction while the ball is skidding along the ground.
//   roll      rolling deceleration, m/s^2, on the level. A green's comes from
//             the Stimp reading instead.
//   firm      which condition moves this surface: 'green', 'course' or none.
//
// `like` rows (the wild ground types in grounds.js) are written from their own
// table below.
const SURFACES = {
 green:   {e0: .51, eHi: .12, tilt: 15.4, mu: .40, grab: 0,   slide: .30, roll: null, firm: 'green'},
 fringe:  {e0: .48, eHi: .12, tilt: 16.0, mu: .43, grab: .03, slide: .34, roll: 1.05, firm: 'green'},
 fairway: {e0: .50, eHi: .13, tilt: 16.5, mu: .42, grab: .04, slide: .38, roll: 1.45, firm: 'course'},
 tee:     {e0: .50, eHi: .13, tilt: 16.5, mu: .42, grab: .04, slide: .38, roll: 1.45, firm: 'course'},
 semi:    {e0: .42, eHi: .11, tilt: 17.5, mu: .48, grab: .14, slide: .50, roll: 2.6,  firm: 'course'},
 rough:   {e0: .32, eHi: .09, tilt: 18.5, mu: .55, grab: .32, slide: .65, roll: 4.6,  firm: 'course'},
 sand:    {e0: .12, eHi: .03, tilt: 6.0,  mu: .70, grab: .65, slide: .90, roll: 9.0,  firm: null, killsSpin: true},
 water:   {e0: 0,   eHi: 0,   tilt: 0,    mu: 1,   grab: 1,   slide: 1,   roll: 12,   firm: null, killsSpin: true},
};
for (const [k, g] of Object.entries(GROUNDS)) SURFACES[k] = {...g.turf, firm: null, killsSpin: !!g.killsSpin};
export const E_FAST = 20;
// The reference impact Penner's tilt was measured at (Haake's 5 iron).
export const TILT_SPEED = 18.6, TILT_ANGLE = 44.4;

// WHAT FIRMNESS DOES, per step from medium (-1 soft, +1 firm). Firm ground gives
// more back, is dug into less and holds the ball less; soft ground does the
// opposite of all three. Rolling on anything but a green is quicker when it is
// firm (dry, tight turf) and slower when it is soft.
export const FIRM_EFFECT = {e: .22, tilt: -.25, mu: -.16, roll: -.22, grab: -.25};

const cache = new Map();
// One surface's row under the given conditions. Cached: the same few rows are
// asked for at every bounce and every step of a roll.
export function turfOf(surface, conditions) {
 const c = conditions || DEFAULT_TURF;
 const key = surface + '|' + (c.stimp ?? 10) + '|' + (c.greenFirmness ?? 0) + '|' + (c.courseFirmness ?? 0);
 let row = cache.get(key);
 if (row) return row;
 const base = SURFACES[surface] || SURFACES.rough;
 const f = base.firm === 'green' ? firmnessValue(c.greenFirmness) : base.firm === 'course' ? firmnessValue(c.courseFirmness) : 0;
 row = {
  surface, firmness: f,
  e0: clamp(base.e0 * (1 + FIRM_EFFECT.e * f), 0, .9), eHi: clamp(base.eHi * (1 + FIRM_EFFECT.e * f), 0, .9),
  tilt: base.tilt * (1 + FIRM_EFFECT.tilt * f),
  mu: base.mu * (1 + FIRM_EFFECT.mu * f),
  grab: clamp(base.grab * (1 + FIRM_EFFECT.grab * f), 0, 1),
  slide: base.slide,
  roll: surface === 'green' ? stimpDeceleration(c.stimp ?? DEFAULT_TURF.stimp) : base.roll * (base.firm === 'course' ? 1 + FIRM_EFFECT.roll * f : 1),
  hard: !!base.hard, killsSpin: !!base.killsSpin,
 };
 if (cache.size > 4000) cache.clear();
 cache.set(key, row);
 return row;
}
// Restitution of a bounce arriving at `speed` m/s into the surface.
export function restitution(row, speed) {
 if (row.hard) return row.e0;
 const u = clamp(Math.abs(speed) / E_FAST, 0, 1);
 return row.eHi + (row.e0 - row.eHi) * (1 - u) * (1 - u);
}

// ---- rolling -----------------------------------------------------------------
// Rolling deceleration on the level, m/s^2, at a given speed. ROLL_SPEED says
// how much harder grass resists a ball rolling faster than a Stimpmeter's
// release; see docs/BALL_PHYSICS.md, *Rolling resistance and speed*.
export const ROLL_SPEED = {gain: 0};
export const rollDeceleration = (surface, conditions) => turfOf(surface, conditions).roll;
export function rollDecelerationAt(surface, conditions, speed = STIMP_RELEASE_SPEED) {
 const a = turfOf(surface, conditions).roll;
 if (!(ROLL_SPEED.gain > 0)) return a;
 return a * (1 + ROLL_SPEED.gain * Math.max(0, speed / STIMP_RELEASE_SPEED - 1));
}
export const slideFriction = (surface, conditions) => turfOf(surface, conditions).slide;

// ---- putts on a level green, in closed form ----------------------------------
// A struck putt leaves the face sliding. The green drags the centre back and
// spins the ball up until it is rolling, which for a ball struck with no spin
// is at 5/7 of its launch speed; from there it runs out at the Stimp's
// deceleration. These are the same two phases physics.js integrates over real
// ground, written as arithmetic for the swing meter's bar and the putt lengths.
const skidRun = (speed, mu) => 12 * speed * speed / (49 * mu * G);
const rollRun = (speed, surface, conditions) => {
 const a = rollDeceleration(surface, conditions), k = ROLL_SPEED.gain, vs = STIMP_RELEASE_SPEED;
 if (!(k > 0) || speed <= vs) return speed * speed / (2 * a);
 // Above the release speed the resistance grows, so the run is integrated.
 let d = vs * vs / (2 * a);
 const n = 48, h = (speed - vs) / n;
 for (let i = 0; i < n; i++) { const u = vs + (i + .5) * h; d += u / (a * (1 + k * (u / vs - 1))) * h; }
 return d;
};
// How far a putt struck at `speed` runs on a level green.
export function struckDistance(speed, conditions, surface = 'green') {
 const v = Math.max(0, speed);
 return skidRun(v, slideFriction(surface, conditions)) + rollRun(5 * v / 7, surface, conditions);
}
// How far a ball released already rolling runs: a Stimpmeter's own measurement.
export const releasedDistance = (speed, conditions, surface = 'green') => rollRun(Math.max(0, speed), surface, conditions);
// The launch speed that runs a struck putt `distance` metres on the level.
export function launchForDistance(distance, conditions, surface = 'green') {
 const want = Math.max(0, distance);
 if (want === 0) return 0;
 let lo = 0, hi = 1;
 while (struckDistance(hi, conditions, surface) < want && hi < 1e3) hi *= 2;
 for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (struckDistance(mid, conditions, surface) < want) lo = mid; else hi = mid; }
 return (lo + hi) / 2;
}
// The share of a struck putt's length it spends skidding.
export const skidShare = (conditions, speed = 2) =>
 skidRun(speed, slideFriction('green', conditions)) / Math.max(1e-12, struckDistance(speed, conditions));
