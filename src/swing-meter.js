// THE SWING METER (14 October 2026): how a keyboard, mouse, touch or controller
// golfer strikes the ball. Three taps, the way Hot Shots Golf and PGA 2K do it:
// one starts the swing, the second stops the marker at the distance wanted, the
// third, back at the strike line, decides how straight it goes. A putt is two.
//
// Everything here is pure: given the times of the taps, the club and the shot
// the golfer picked, it returns the numbers the ball leaves the club with --
// ball speed, launch, direction, spin and spin axis -- and nothing downstream
// changes. The flight, the bounce, the roll and the wind are the same simulator
// a launch-monitor shot goes through.
//
// THE BAR IS IN YARDS, NOT PERCENT. Half the bar is half the club's carry, so a
// golfer who needs 60 of a 100-yard wedge stops the marker at 60. It used to be
// a share of the club's SPEED, and carry is not proportional to speed, so half
// power was nowhere near half the distance. The speed is solved against the
// ball model on level ground in still air (`speedForCarry`), the same way
// `bagClubs` solves a full swing from the bag's yardage.
//
// A TAP IS JUDGED ON ITS OWN TIME, never on the frame it was drawn in. The
// marker's position is a function of the time since the first tap, so a slow
// frame, a stall or a busy machine cannot move a result: the same three times
// give the same shot at 20 frames a second or 144.
//
// Every timing, width and shape number below is PLACED -- chosen to feel right
// and to be tuned by playing -- not taken from a source. RESEARCH.md, *The Swing
// Meter*, says which is which.
import {simulateShot, YARD, R, clamp} from './physics.js';
import {spinForPower} from './clubs.js';
import {launchForDistance, rollDeceleration, struckDistance} from './turf.js';
import {playsLike} from './plays-like.js';
import {GROUNDS} from './grounds.js';

// THE LIE, as a share of ball speed kept. One table for every golfer: the Swing
// Meter takes it off the swing, and (unless the round switches it off) a launch
// monitor shot has it taken off its measured ball speed (main.js, *THE LIE*).
// Sand was 72% until 14 October 2026; the owner softened it to 80% when the rule
// was extended to monitor shots. Placed, not published -- RESEARCH.md *The lie
// costs ball speed* has the simulators it was compared with.
// The overhaul's ground types (grounds.js) add their own rows: rock, scree,
// heather and the rest each keep a share of their own.
export const LIE_SPEED = {semi: .96, rough: .9, sand: .8, ...Object.fromEntries(Object.entries(GROUNDS).map(([k, g]) => [k, g.lie]))};
export const lieFactor = surface => LIE_SPEED[surface] ?? 1;
export const LIE_NAMES = {semi: 'semi-rough', rough: 'rough', sand: 'sand', ...Object.fromEntries(Object.entries(GROUNDS).map(([k, g]) => [k, g.word]))};
// A LAUNCH MONITOR'S SHOT FROM A LIE. The measured ball speed is multiplied by
// the lie's share -- unless the round switched that off (`on`), or the ball is on
// the range's mat -- and launch, direction, spin and axis are left exactly as
// measured. The measured speed is kept beside the played one (`lie.before`,
// `lie.measured`) so it is shown and recorded as sent, with the penalty in red
// beside it (shot-data.js). Returns what to fly and what to record.
export function monitorLie(data, surface, {on = true, range = false} = {}) {
 const f = range ? 1 : lieFactor(surface);
 if (f >= 1) return {launch: data, lie: null};
 const penalise = !!on;
 return {launch: penalise ? {...data, speed: data.speed * f} : data,
  lie: {surface, factor: penalise ? f : 1, before: data.speed, measured: true}};
}

// Per golfer, kept in the profile. `rise` is the seconds the marker takes from
// the start line to the full line; it comes back at the same pace. `zone` and
// `perfect` are HALF-widths of the strike zone and the perfect band, in lengths
// of the bar (the bar from start to full is 1). (A `putRead` share of the putt
// preview drawn per difficulty went with the preview, 14 October 2026.)
export const DIFFICULTIES = {
 easy: {label: 'Easy', rise: 1.5, zone: .1, perfect: .03, wind: true},
 normal: {label: 'Normal', rise: 1.15, zone: .065, perfect: .015, wind: false},
 hard: {label: 'Hard', rise: .9, zone: .04, perfect: .008, wind: false},
};
export const DEFAULT_DIFFICULTY = 'normal';
export const difficultyOf = id => DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];

// The bar runs from MISS_AT (past the strike line, where an untapped swing runs
// out) through 0 (the strike line) and 1 (full) to 1 + OVERSWING. Overswing is
// worth up to 5% more carry -- the only way past the bag -- and narrows the
// strike zone the deeper the marker is stopped in it.
export const OVERSWING = .12, OVERSWING_CARRY = .05, MISS_AT = -.3;
// Below this share of the bar the strike zone widens: a chip is about distance.
export const SHORT_SHOT = .4;

export const CURVES = ['draw', 'straight', 'fade'];
export const HEIGHTS = ['low', 'normal', 'high'];
// The spin dial: one step off, the club's own, or up to three added.
export const SPIN_STEPS = [-1, 0, 1, 2, 3];
export const DEFAULT_SHAPE = Object.freeze({curve: 'straight', height: 'normal', spin: 0});
export function validShape(s = {}) {
 return {
  curve: CURVES.includes(s.curve) ? s.curve : 'straight',
  height: HEIGHTS.includes(s.height) ? s.height : 'normal',
  spin: SPIN_STEPS.includes(s.spin) ? s.spin : 0,
 };
}
// Wedges get Bump & run and Flop near the green, in place of Low and High.
const SHORT_GAME_KINDS = new Set(['wedge', 'gap', 'sand', 'lob']);
export const SHORT_GAME_YARDS = 60;
export const shortGame = (club, yardsToPin) => !!club && SHORT_GAME_KINDS.has(club.kind) && yardsToPin <= SHORT_GAME_YARDS;
export function heightName(height, short) {
 if (short && height === 'low') return 'Bump & run';
 if (short && height === 'high') return 'Flop';
 return {low: 'Low', normal: 'Normal', high: 'High'}[height];
}
export const curveName = c => ({draw: 'Draw', straight: 'Straight', fade: 'Fade'}[c]);
export const spinName = s => s === 0 ? 'Club spin' : s < 0 ? 'Less spin' : `Spin +${s}`;

// What a chosen shape does to a club's full swing. Spin axis in degrees,
// positive curves right (a fade), as a launch monitor reports it.
const CURVE_AXIS = {draw: -8, straight: 0, fade: 8};
// Each added step is another tenth of the club's spin; a step off is a quarter
// less. Three steps on a full pitching wedge is about 11,100 rpm -- enough, on a
// soft or normal green and a steep landing, to bring it back, which is the
// golfer's choice to make.
const SPIN_SCALE = {'-1': .75, 0: 1, 1: 1.1, 2: 1.2, 3: 1.3};
// THE CLUB'S OWN SPIN NEVER BRINGS A BALL BACK. Dial at 0 or -1, no ball may
// finish behind where it first landed, from any club, height, firmness or
// landing slope (tests/swing-meter.test.mjs sweeps it). Stock spin already only
// checks on level ground; a steep landing comes back sooner, so the High and
// Flop heights carry a little less of the club's spin. Worked out against the
// ball model, with a margin, not chosen by eye.
const HEIGHT_SPIN = {low: 1, normal: 1, high: .85, bump: .5, flop: .8};
// Found by sweeping every club x height x power (30% to full overswing) x
// firmness x level and 2% slopes (14 October 2026): at the club's own spin only
// the pitching and lob wedges came back, by at most half a yard on a soft green
// landing into a 2% rise. They carry this much of their stock spin on the
// Swing Meter. Steeper slopes roll any ball back by gravity, spin or not; that
// is the course, not the strike, and is not what this guards.
const KIND_SPIN = {wedge: .95, lob: .85};
export function shapedLaunch(club, shape, {short = false} = {}) {
 const s = validShape(shape);
 if (club.code === 'PT') return {vla: 0, spin: 0, axis: 0, zone: 1, flop: false};
 const kind = short && s.height === 'low' ? 'bump' : short && s.height === 'high' ? 'flop' : s.height;
 const vla = kind === 'bump' ? club.vla * .55 : kind === 'flop' ? club.vla + 10
  : kind === 'low' ? club.vla - 4 : kind === 'high' ? club.vla + 4 : club.vla;
 return {
  vla: clamp(vla, 3, 60),
  spin: club.spin * HEIGHT_SPIN[kind] * (KIND_SPIN[club.kind] ?? 1) * SPIN_SCALE[s.spin],
  axis: CURVE_AXIS[s.curve],
  // The strike zone's width, as a share of the difficulty's: a flop is harder to
  // hit cleanly, and every step of added spin narrows it.
  zone: (kind === 'flop' ? .8 : 1) * Math.pow(.85, Math.max(0, s.spin)),
  flop: kind === 'flop', bump: kind === 'bump',
 };
}

// HOW WIDE THE STRIKE ZONE IS for this swing, in bar lengths. Everything that
// narrows or widens it, in one place, so the meter draws exactly what judges.
const LIE_ZONE = {rough: .8, sand: .7};
export function strikeZone({difficulty, shape = 1, lie, putt = false, power = 1, share = power}) {
 const d = difficultyOf(difficulty);
 let k = shape * (LIE_ZONE[lie] ?? 1);
 if (putt) k *= 2;
 else {
  if (power > 1) k *= 1 - .5 * clamp((power - 1) / OVERSWING, 0, 1);
  else if (share < SHORT_SHOT) k *= 1.5;
 }
 return {zone: d.zone * k, perfect: Math.min(d.perfect * k, d.zone * k * .5)};
}
// A PUTT IS TWO TAPS on every difficulty (the owner's call, 14 October 2026):
// start, and stop at the length. Hard had a third, accuracy tap until then.
export const puttAccuracy = () => false;

// THE BAR ZOOMS FOR A SHORT SHOT, as it already did for a putt (the owner's
// call, 14 October 2026). When the circle is well inside the club's carry the
// full line becomes a half or a quarter swing -- the shortest that holds the
// shot with a quarter to spare -- so a 30 yd chip with a 100 yd wedge is three
// fifths of a quarter-swing bar instead of a sliver of a full one. The ticks
// relabel; overswing is still 5% more, of the zoomed swing. Placed.
export const SWING_RANGES = [.25, .5, 1];
export function swingZoom(fullMetres, aimMetres) {
 for (const k of SWING_RANGES) if (aimMetres * 1.25 <= fullMetres * k) return k;
 return 1;
}
// The share of the club's carry a stop on the bar is worth.
export const carryShare = power => power <= 1 ? Math.max(0, power) : 1 + OVERSWING_CARRY * clamp((power - 1) / OVERSWING, 0, 1);

// A SWING IN PROGRESS. Times are milliseconds on the input's own clock
// (`event.timeStamp`, which shares `performance.now()`'s origin).
export function startSwing(t, {difficulty, club = null, putt = false, accuracy = !putt, zoom = 1}) {
 const d = difficultyOf(difficulty);
 // Woods run the marker a little faster, wedges a little slower. A bar zoomed
 // to a half swing runs 12% slower and to a quarter 25% slower (putts too), so
 // a short shot is both a bigger target and a slower one. Placed.
 const pace = (putt ? 1.15 : ({driver: .9, wood: .92, wood5: .94, wood7: .95}[club?.kind] ?? (SHORT_GAME_KINDS.has(club?.kind) ? 1.1 : 1)))
  * (zoom <= .25 ? 1.25 : zoom < 1 ? 1.12 : 1);
 return {start: t, rise: d.rise * pace * 1000, power: null, powerAt: null, accuracy, done: false, error: null};
}
// OVERSWING IS SLOW, AND WAITS (the owner's call, 14 October 2026). Past the
// full line the marker runs at a quarter of its speed, the meter flashes, and at
// the end of the overswing zone it stops and holds there, still flashing, until
// the second tap -- it no longer goes off on its own. Slower means the depth is
// the golfer's to choose; the strike zone still narrows the deeper it is.
// Coming back from overswing runs at the normal speed. PLACED.
export const OVERSWING_SLOW = 4;
// THE SWEEP STARTS FROM THE FAR LEFT (the owner's call, 14 October 2026). The
// marker used to start on the strike line, a fifth of the way along the bar, so
// a short shot's stop was a sliver from where it began. It now starts at the
// bar's left edge and runs up to the strike line first -- a run-up the length
// of the miss area (`RUN_UP` bar lengths, 0.35 s at Normal) -- and a tap during
// the run-up is ignored rather than taken as a swing of nothing.
export const RUN_UP = -MISS_AT;
function riseAt(sw, t) {
 const e = (t - sw.start) / sw.rise - RUN_UP;
 return e <= 1 ? Math.max(MISS_AT, e) : Math.min(1 + OVERSWING, 1 + (e - 1) / OVERSWING_SLOW);
}
// Is the marker in the overswing zone, still climbing or holding at its end?
export const inOverswing = (sw, t) => sw.power == null && riseAt(sw, t) > 1;
// Where the marker is at time t, in bar lengths.
export function markerAt(sw, t) {
 if (sw.power == null) return riseAt(sw, t);
 return Math.max(MISS_AT, sw.power - (t - sw.powerAt) / sw.rise);
}
// Anything owed by the clock alone: running out past the strike zone is a
// miss. (Until 14 October 2026 the end of overswing set the power on its own.)
export function advance(sw, t) {
 if (sw.done) return sw;
 if (sw.power != null && !sw.done && markerAt(sw, t) <= MISS_AT) { sw.done = true; sw.error = MISS_AT; sw.duff = true; }
 return sw;
}
function setPower(sw, t) {
 sw.power = riseAt(sw, t);sw.powerAt = t;
 if (!sw.accuracy) { sw.done = true; sw.error = 0; }
}
// A tap. Returns which tap it was: 'power' or 'strike' (or null if over).
export function tap(sw, t) {
 advance(sw, t);
 if (sw.done) return null;
 if (sw.power == null) { if (riseAt(sw, t) <= 0) return null; setPower(sw, t); return 'power'; }
 sw.error = markerAt(sw, t);sw.done = true;
 return 'strike';
}

// WHAT THE STRIKE DOES TO THE BALL. `error` is where the marker was when the
// third tap came: positive is EARLY (before the strike line), negative LATE.
// The owner's rule (14 October 2026): early sends the ball RIGHT and late sends
// it LEFT, for every golfer -- the meter has no handedness. Inside the perfect
// band the ball goes where it was aimed; from there to the zone's edge it
// starts a degree and a quarter off line with five degrees of curve; outside
// the zone it keeps growing, to four times that. A swing that ran out is the
// worst miss there is, a smothered hook at three quarters of the speed.
export function strikeEffect(error, {zone, perfect}, {putt = false, duff = false} = {}) {
 if (duff) return putt ? {hla: -4, axis: 0, speed: .85, miss: 5, perfect: false} : {hla: -7, axis: -25, speed: .75, miss: 5, perfect: false};
 const a = Math.abs(error);
 if (a <= perfect) return {hla: 0, axis: 0, speed: 1, miss: 0, perfect: true};
 const m = Math.min(4, (a - perfect) / Math.max(1e-6, zone - perfect)), side = error > 0 ? 1 : -1;
 return putt ? {hla: side * m * .5, axis: 0, speed: 1, miss: m, perfect: false}
  : {hla: side * m * 1.25, axis: side * m * 5, speed: 1, miss: m, perfect: false};
}

// LEVEL GROUND, STILL AIR: the reference every number on the bar is drawn in.
const FLAT = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []};
const FLAT_OPTIONS = {dt: 1 / 120};
function fly(club, launch, speed, hla = 0) {
 const spin = launch.spin * spinForPower(clamp(speed / club.speed, 0, 1.2));
 return simulateShot({origin: {x: 0, z: 0}, aim: 0, speed, vla: launch.vla, hla, spin, spinAxis: launch.axis}, FLAT, FLAT_OPTIONS);
}
// Where the ball first comes down, in the aim-0 frame: the last airborne sample.
function landing(r) {
 const pts = r.points;let apex = 0;
 for (let i = 1; i < pts.length; i++) if (pts[i].y > pts[apex].y) apex = i;
 for (let i = apex; i < pts.length; i++) if (pts[i].y <= R + .02) return {i, x: pts[i].x, z: pts[i].z};
 const last = pts.at(-1);return {i: pts.length - 1, x: last.x, z: last.z};
}
const cache = new Map();
const keyOf = (club, launch) => [club.speed.toFixed(4), launch.vla.toFixed(3), launch.spin.toFixed(1), launch.axis].join(':');
// The carry, in metres, of this club and shape at a full swing.
export function fullCarry(club, launch) {
 const key = 'full:' + keyOf(club, launch);
 if (!cache.has(key)) cache.set(key, fly(club, launch, club.speed).carry);
 return cache.get(key);
}
// How far this club and shape carries at a given ball speed.
export function carryAtSpeed(club, launch, speed) {
 const key = 'at:' + keyOf(club, launch) + ':' + speed.toFixed(3);
 if (!cache.has(key)) cache.set(key, fly(club, launch, speed).carry);
 return cache.get(key);
}
// The ball speed that carries `metres` with this club and shape. Bisected
// against the ball model; cached per club, shape and yard.
export function speedForCarry(club, launch, metres) {
 if (metres <= 0) return 0;
 const key = keyOf(club, launch) + ':' + Math.round(metres / YARD * 4);
 if (cache.has(key)) return cache.get(key);
 let lo = 0, hi = club.speed * 1.25;
 for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fly(club, launch, mid).carry < metres) lo = mid; else hi = mid; }
 const speed = (lo + hi) / 2;
 if (cache.size > 4000) cache.clear();
 cache.set(key, speed);
 return speed;
}
// The start direction that brings a curved shot down on the aim line: fly it
// once straight down the line and start it as far the other way as it bent.
export function curveCompensation(club, launch, speed) {
 if (!launch.axis || speed <= 0) return 0;
 const key = 'comp:' + keyOf(club, launch) + ':' + speed.toFixed(2);
 if (!cache.has(key)) { const l = landing(fly(club, launch, speed)); cache.set(key, Math.atan2(l.x, Math.max(1, l.z)) * 180 / Math.PI); }
 return cache.get(key);
}
// The flight's ground track to where it lands, in the aim-0 frame, for drawing
// the shape on the course before the swing.
export function previewTrack(club, launch, speed) {
 const r = fly(club, launch, speed, curveCompensation(club, launch, speed)), l = landing(r);
 return r.points.slice(0, l.i + 1).filter((_, i, a) => i % 4 === 0 || i === a.length - 1).map(p => ({x: p.x, z: p.z}));
}

// A PUTT'S BAR IS IN DISTANCE OF ROLL on a flat green at today's Stimp: full is
// as far as the putter's full stroke rolls today.
export function puttFullRoll(putter, turf) { return struckDistance(putter.speed, rollDeceleration('green', turf)); }
// THE PUTTING BAR ZOOMS TO THE PUTT. Spread over the putter's whole roll, a
// nine-foot putt is a tenth of the bar and a tenth of a second to stop in, which
// is not a putt anyone could make on purpose. So the bar's full line is a
// quarter, a half or all of the putter's roll -- the shortest that holds this
// putt with a quarter to spare. The putter itself is unchanged: its full stroke
// still rolls the bag's distance, and the label on the full line says how far
// this bar reaches. Added in building, not in the spec; placed.
//
// AND IT REACHES ACROSS ANY GREEN (the owner's call, 14 October 2026). Past the
// putter's full roll it goes on in steps to six times it: the widest green a
// course grows is about 80 yd across, and on the slowest Stimp (6) the putter's
// own roll is about 18 yd, so six times holds that with room to spare. On the
// green, and only for a putt, the bar is not held to the bag.
export const PUTT_RANGES = [.25, .5, 1, 1.5, 2, 3, 4, 6];
export function puttRange(putter, turf, aimMetres) {
 const full = puttFullRoll(putter, turf);
 for (const k of PUTT_RANGES) if (aimMetres * 1.25 <= full * k) return full * k;
 return full * PUTT_RANGES.at(-1);
}
export function puttSpeedFor(putter, turf, metres) { return Math.min(putter.speed * 3, launchForDistance(metres, rollDeceleration('green', turf))); }

// THE TARGET MARKER (Phase 2): where on the bar to stop for the ball to come
// down in the aim circle. Found by flying the ball, not by a rule of thumb: the
// circle's distance is turned into the carry it plays like on level ground in
// still air by `playsLike` (the club and shape at a full swing, flown to the
// circle's height in today's air and against a level reference), then the bar
// share for that carry is read off the same ball model the bar is drawn from,
// with the lie's lost speed made up.
//
// WHAT IT ALLOWS FOR (the owner's call, 14 October 2026): the slope and the lie
// always; the WIND only on Easy -- on Normal and Hard judging the wind is the
// golfer's job, and the wind dial is on screen. Altitude and temperature are
// always in: they are the air, not something a golfer reads.
//
// Returns {share, out}: `share` in bar lengths (0 to 1; the overswing zone is
// never suggested), `out` when even a full swing falls short, or the circle is
// above where this shot can climb.
export function targetShare({club, shape, short = false, lie, difficulty, metres, rise = 0, bearing = 0, wind = [0, 0, 0], altitude = 0, temperature}) {
 if (!club || club.code === 'PT' || !(metres > 0)) return null;
 const launch = shapedLaunch(club, shape, {short});
 const full = fullCarry(club, launch);
 const level = playsLike({distance: metres, rise, bearing, wind: difficultyOf(difficulty).wind ? wind : [0, 0, 0], altitude, temperature,
  launch: {speed: club.speed, vla: launch.vla, spin: launch.spin, spinAxis: 0}});
 if (level == null) return {share: 1, out: true};
 const f = lieFactor(lie);
 // The carry the bar must ask for: on a clean lie the level carry itself; from
 // the rough, the carry of the speed that the lie will cut down to the right one.
 const asked = f < 1 ? carryAtSpeed(club, launch, Math.min(club.speed * 1.3, speedForCarry(club, launch, level) / f)) : level;
 const share = asked / full;
 return share > 1 + 1e-6 ? {share: 1, out: true} : {share: Math.max(0, share), out: false};
}

// THE LONGEST AIM A CLUB REACHES (UI/UX pass V2, 21 October 2026: a turn
// started aimed at a pin the club cannot carry to -- a short par 4 uphill
// with the driver -- and the meter said "Out of reach: take more club" before
// anything had been chosen). `fits(metres)` says whether a full swing reaches
// an aim that far; the answer is the longest one that does, by halving the gap
// `steps` times between `floor` and `max`, or `max` itself when it fits. It
// assumes a longer aim never fits where a shorter one does not. When not even
// `floor` fits -- the ball model has no answer for this club here (audit 4: an
// uphill Endless hole into a 10 mph wind put the aim 5 m in front of the tee) --
// the answer is null, and the caller keeps its aim. Pure.
export function longestReach(fits, max, {floor = 5, steps = 10} = {}) {
 if (!(max > floor) || fits(max)) return max;
 if (!fits(floor)) return null;
 let lo = floor, hi = max;
 for (let i = 0; i < steps; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
 return lo;
}

// THE WHOLE STRIKE: a finished swing, the club, the shot chosen and the lie,
// into the numbers the ball leaves with. `lie` is the surface the ball sits on;
// its speed share is taken off the speed the bar asked for.
export function swingLaunch(sw, {club, shape, short = false, lie, difficulty, turf, puttRange: range = null, zoom = 1}) {
 const putt = club.code === 'PT';
 const launch = shapedLaunch(club, shape, {short});
 const power = sw.power ?? 0, share = (putt ? 1 : zoom) * carryShare(power);
 const zones = strikeZone({difficulty, shape: launch.zone, lie, putt, power, share: putt ? power : zoom * power});
 const fx = strikeEffect(sw.error ?? 0, zones, {putt, duff: !!sw.duff});
 const factor = lieFactor(lie);
 if (putt) {
  const speed = puttSpeedFor(club, turf, share * (range ?? puttFullRoll(club, turf)));
  return {shot: {speed: speed * fx.speed * factor, vla: 0, hla: fx.hla, spin: 0, spinAxis: 0}, before: speed * fx.speed, factor, power, share, strike: fx, zones};
 }
 const speed = speedForCarry(club, launch, share * fullCarry(club, launch)) * fx.speed;
 const comp = curveCompensation(club, launch, speed);
 const spin = launch.spin * spinForPower(clamp(speed / club.speed, 0, 1.2));
 return {shot: {speed: speed * factor, vla: launch.vla, hla: comp + fx.hla, spin, spinAxis: launch.axis + fx.axis}, before: speed, factor, power, share, strike: fx, zones};
}
