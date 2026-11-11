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

// The names the game used before the three conditions, read as these.
const OLD_NAMES = {burnt: 'firm', normal: 'medium'};
const nameOf = input => { const k = String(input ?? '').toLowerCase(); return OLD_NAMES[k] ?? k; };
export function firmnessValue(input) {
 if (typeof input === 'number' && Number.isFinite(input)) return clamp(input, -1, 1);
 return FIRMNESS[nameOf(input)] ?? 0;
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
  else { p[k] = nameOf(p[k]); if (!(p[k] in FIRMNESS)) throw Error('Firmness must be soft, medium or firm.'); }
 }
 return p;
}
// COURSES A PLAYER RECOGNISES, as the three conditions. Not everyone wants a
// tour green: an everyday public course is slower and more receptive, and a
// tournament set-up is quick and firm everywhere. A round starts from one of
// these and any of the three can then be moved on its own.
export const CONDITION_PRESETS = Object.freeze({
 everyday: Object.freeze({label: 'Everyday course', line: 'slower greens that hold a shot', stimp: 8.5, greenFirmness: 'soft', courseFirmness: 'medium'}),
 club: Object.freeze({label: 'Club course', line: 'medium speed, medium firmness', stimp: 10, greenFirmness: 'medium', courseFirmness: 'medium'}),
 tournament: Object.freeze({label: 'Tournament', line: 'quick and firm everywhere', stimp: 12, greenFirmness: 'firm', courseFirmness: 'firm'}),
});
// Which preset a set of conditions is, or null for a mix of the player's own.
export function presetOf(conditions) {
 let c; try { c = turfConfig(conditions); } catch { return null; }
 for (const [k, p] of Object.entries(CONDITION_PRESETS))
  if (p.stimp === c.stimp && p.greenFirmness === firmnessName(c.greenFirmness) && firmnessValue(c.greenFirmness) === FIRMNESS[p.greenFirmness]
   && p.courseFirmness === firmnessName(c.courseFirmness) && firmnessValue(c.courseFirmness) === FIRMNESS[p.courseFirmness]) return k;
 return null;
}
// A Stimp reading in a word: the number means little on its own. The USGA's
// guide for ordinary play is slow 8, medium 10, fast 12; a major is 13 to 14.
export const stimpWord = stimp => stimp < 7.5 ? 'very slow' : stimp < 9.5 ? 'everyday' : stimp < 11 ? 'medium' : stimp < 12.5 ? 'fast' : stimp < 13.5 ? 'tournament' : 'a major, on Sunday';
// What each firmness means on the ground, for a control's second line.
export const FIRMNESS_LINES = Object.freeze({
 green: Object.freeze({soft: 'holds almost anything', medium: 'a good shot holds', firm: 'bounces on and releases'}),
 course: Object.freeze({soft: 'little bounce or run', medium: 'a few bounces and some run', firm: 'bounces high and runs out'}),
});

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
// One row per surface. A column written [soft, medium, firm] moves with the
// surface's firmness condition; a single number does not. The columns:
//
//   e0, eHi   restitution of a slow bounce (e0) and of a fast one (eHi, at
//             `E_FAST` m/s into the ground and above). Turf gives a soft landing
//             to a hard impact -- the ball craters it -- and a livelier one to
//             a gentle hop, which is why a ball bounces three or four times and
//             does not just thud. Penner (2001) measured the curve on a lawn and
//             Haake's drop tests on greens agree with it.
//   tilt      degrees the ground is effectively tilted back toward an arriving
//             ball at the reference impact (Haake's 5 iron: 18.6 m/s, 44.4
//             degrees from the vertical): the front wall of the pitch mark it is
//             digging (Penner 2002). Grows with the speed into the ground and
//             with how glancing the arrival is.
//   mu        friction the turf can exert on the ball during the bounce, as a
//             share of how hard the ball is pressed in. Decides whether a
//             spinning ball GRIPS (spin spent in one bite: Haake's "rolling"
//             greens, soft and wet) or SKIDS (keeps backspin for the next
//             bounce: his "slipping" greens, firm and sandy).
//   shear     the most the turf can hold a sliding ball back in one bounce
//             (m/s of the ball's speed) before it tears: turf is strong
//             against a ball coming down on it and weak sideways (Haake). It
//             is why the USGA measured the SAME 4,690 rpm taken off every full
//             shot whatever its speed and angle, where plain friction would
//             take more off a harder landing.
//   arm       how much of that friction turns the ball, against a hard floor's
//             1. Turf pushes back on a ball a little ahead of its centre (Haake's
//             film: 2-5 mm), so a ball leaves a bounce short of rolling and a
//             skidding one keeps more backspin than its lost speed would say.
//             This is what brings a spun wedge back on a firm green.
//   grab      share of the ball's travel the grass itself swallows at every
//             contact, beyond friction: nothing on a green, a third in rough.
//   dig       the further share a hard landing loses in its own pitch mark,
//             at the reference impact; a gentle hop loses none of it.
//   slide     friction while the ball is skidding along the ground.
//   stimp     how far a Stimpmeter would roll a ball on it, feet. A green's is
//             the player's setting; a good fairway measured 5 ft 8 in and a
//             dense tee 3 ft 4 in (USGA 2018).
//   firm      which condition moves this surface: 'green', 'course' or none.
//   mown      tight, mown turf, whose rolling resistance follows the speed law
//             below. Long grass, sand and bare ground slow a ball the same at
//             any speed, and hold one on a far steeper bank than a green can.
const SURFACES = {
 green:   {e0: [.44, .50, .56], eHi: [.07, .10, .14], tilt: [18.5, 16.0, 11.6], mu: [.55, .45, .40], shear: [10, 6.5, 4.9], arm: [1, .92, .85], grab: 0, dig: [.27, .095, 0], slide: .42, stimp: null, firm: 'green', mown: true},
 fringe:  {e0: [.42, .48, .54], eHi: [.07, .10, .135], tilt: [19.0, 16.5, 12.5], mu: [.52, .34, .26], arm: [1, .92, .85], grab: .03, dig: [.26, .10, .02], slide: .45, stimp: 6.5, firm: 'green', mown: true},
 fairway: {e0: [.42, .48, .54], eHi: [.08, .105, .13], tilt: [15.0, 13.0, 11.6], mu: [.50, .40, .30], arm: [1, .95, .9], grab: .02, dig: [.36, .19, .095], slide: .45, stimp: [3.9, 4.9, 6.2], firm: 'course', mown: true},
 tee:     {e0: [.42, .48, .54], eHi: [.08, .105, .13], tilt: [15.0, 13.0, 11.6], mu: [.50, .40, .30], arm: [1, .95, .9], grab: .02, dig: [.36, .19, .095], slide: .45, stimp: [3.3, 4.0, 5.0], firm: 'course', mown: true},
 semi:    {e0: [.34, .40, .46], eHi: [.06, .09, .12],  tilt: [15.0, 13.5, 12.0], mu: [.60, .48, .38], grab: .12, dig: [.24, .18, .11], slide: .55, stimp: [2.3, 2.8, 3.4], firm: 'course'},
 rough:   {e0: [.26, .30, .35], eHi: [.05, .07, .09],  tilt: [15.0, 14.0, 13.0], mu: [.65, .55, .47], grab: .36, dig: [.27, .22, .18], slide: .70, stimp: [1.3, 1.6, 1.9], firm: 'course'},
 sand:    {e0: .12, eHi: .02, tilt: 6.0, mu: .70, grab: .80, slide: .90, stimp: .8, firm: null, killsSpin: true},
 water:   {e0: 0, eHi: 0, tilt: 0, mu: 1, grab: 1, slide: 1, stimp: .5, firm: null, killsSpin: true},
};
for (const [k, g] of Object.entries(GROUNDS)) SURFACES[k] = {...g.turf, firm: null, killsSpin: !!g.killsSpin};
export const E_FAST = 20;
// The reference impact Penner's tilt was measured at (Haake's 5 iron).
export const TILT_SPEED = 18.6, TILT_ANGLE = 44.4;

// ROLLING RESISTANCE RISES GENTLY WITH SPEED. A Stimp reading is one number --
// how far a ball released at 1.83 m/s runs -- and it fixes the AVERAGE
// deceleration over that run, not its shape. Four independent things say the
// shape is not flat (docs/BALL_PHYSICS.md, *Rolling resistance and speed*):
// Ping's overhead-camera study (Burritt and Henrikson 2024) measured friction
// falling as the ball slowed on three surfaces of four; Quintic's last foot of
// roll is 12 in where a flat deceleration gives 7; a TrackMan-measured 12.1 mph
// putt that skidded 70 in ran 38 ft 10 in, which a flat deceleration can only
// reach on an impossible green; and the USGA's championship-green launcher
// tests run out far shorter than a flat deceleration allows.
//
// So deceleration goes as speed to the power ROLL.power above ROLL.floor m/s
// and is flat below it, scaled so that a Stimpmeter release still runs EXACTLY
// the Stimp reading. A flat floor is what lets a ball come to rest on a slope
// at all: with none, it could not stop on any slope, and with this one it will
// not stop above about three quarters of the textbook limit -- which is where
// the architects' "critical slope" charts put it.
export const ROLL = {power: .42, floor: .5};
// The constant c in a(v) = c x max(v, floor)^power for a surface that rolls
// `stimp` feet on a Stimpmeter. Off mown turf the power is 0 and c is simply
// the deceleration.
function rollConstant(stimp, mown) {
 if (!mown) return stimpDeceleration(stimp);
 const p = ROLL.power, vf = ROLL.floor, vs = STIMP_RELEASE_SPEED, q = 2 - p;
 return (Math.pow(vf, q) / 2 + (Math.pow(vs, q) - Math.pow(vf, q)) / q) / (stimp * FOOT);
}
// How far a ball already rolling at `speed` runs on the level.
export function rollOut(row, speed) {
 const p = row.power, vf = ROLL.floor, q = 2 - p, v = Math.max(0, speed);
 if (!p) return v * v / (2 * row.c);
 if (v <= vf) return v * v / (2 * row.c * Math.pow(vf, p));
 return (Math.pow(vf, q) / 2 + (Math.pow(v, q) - Math.pow(vf, q)) / q) / row.c;
}

const at = (x, f) => !Array.isArray(x) ? x : f <= 0 ? x[1] + (x[1] - x[0]) * f : x[1] + (x[2] - x[1]) * f;
const cache = new Map();
// One surface's row under the given conditions. Cached: the same few rows are
// asked for at every bounce and every step of a roll.
export function turfOf(surface, conditions) {
 const c = conditions || DEFAULT_TURF;
 const key = surface + '|' + (c.stimp ?? 10) + '|' + (c.greenFirmness ?? 0) + '|' + (c.courseFirmness ?? 0) + '|' + ROLL.power + '|' + ROLL.floor;
 let row = cache.get(key);
 if (row) return row;
 const base = SURFACES[surface] || SURFACES.rough;
 const f = base.firm === 'green' ? firmnessValue(c.greenFirmness) : base.firm === 'course' ? firmnessValue(c.courseFirmness) : 0;
 const stimp = surface === 'green' ? (c.stimp ?? DEFAULT_TURF.stimp) : at(base.stimp, f);
 row = {
  surface, firmness: f,
  e0: at(base.e0, f), eHi: at(base.eHi, f), tilt: at(base.tilt, f), mu: at(base.mu, f), shear: at(base.shear ?? 0, f), grab: at(base.grab ?? 0, f), dig: at(base.dig ?? 0, f),
  slide: base.slide, arm: at(base.arm ?? 1, f), stimp,
  // `roll` is the Stimp's own average deceleration; `c` the constant of the
  // speed law the ball is actually slowed by.
  roll: stimpDeceleration(stimp), c: rollConstant(stimp, base.mown), power: base.mown ? ROLL.power : 0,
  hard: !!base.hard, killsSpin: !!base.killsSpin,
  // The same surface at its firmest, which a gentle bounce is played off
  // (bounce.js, SEVERITY).
  firmer: base.firm && f < 1 ? turfOf(surface, {...c, [base.firm === 'green' ? 'greenFirmness' : 'courseFirmness']: 1}) : null,
 };
 if (cache.size > 4000) cache.clear();
 cache.set(key, row);
 return row;
}
// Forget cached rows: after a tool has changed SURFACES or ROLL.
export const clearTurfCache = () => cache.clear();
// The table itself, for tools that fit it (tools/ball-fit.mjs). Not for the game.
export const SURFACE_TABLE = SURFACES;
// Restitution of a bounce arriving at `speed` m/s into the surface.
export function restitution(row, speed) {
 if (row.hard) return row.e0;
 const u = clamp(Math.abs(speed) / E_FAST, 0, 1);
 return row.eHi + (row.e0 - row.eHi) * (1 - u) * (1 - u);
}

// ---- rolling -----------------------------------------------------------------
// The Stimp-average rolling deceleration of a surface, m/s^2.
export const rollDeceleration = (surface, conditions) => turfOf(surface, conditions).roll;
// The deceleration a ball rolling at `speed` actually feels.
export function rollDecelerationAt(surface, conditions, speed = STIMP_RELEASE_SPEED) {
 const row = turfOf(surface, conditions);
 return row.power ? row.c * Math.pow(Math.max(speed, ROLL.floor), row.power) : row.c;
}
export const slideFriction = (surface, conditions) => turfOf(surface, conditions).slide;

// ---- putts on a level green, in closed form ----------------------------------
// A struck putt leaves the face sliding. The green drags the centre back and
// spins the ball up until it is rolling, which for a ball struck with no spin
// is at 5/7 of its launch speed; from there it runs out at the Stimp's
// deceleration. These are the same two phases physics.js integrates over real
// ground, written as arithmetic for the swing meter's bar and the putt lengths.
const skidRun = (speed, mu) => 12 * speed * speed / (49 * mu * G);
const rollRun = (speed, surface, conditions) => rollOut(turfOf(surface, conditions), speed);
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
