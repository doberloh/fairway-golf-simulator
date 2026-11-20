// THE SWING'S RULES (the Swing Meter, 14 October 2026; its three-tap bar went on
// 16 November 2026 for the pull and push, swing-stroke.js). What a golfer's
// swing does to the ball: the club and the shape picked, the lie, how far the
// swing was pulled (a share of the club's full carry) and how clean the strike
// was. The name stays: the profile's `meter` field and every caller use it.
//
// Everything here is pure: given the struck swing, the club and the shot
// the golfer picked, it returns the numbers the ball leaves the club with --
// ball speed, launch, direction, spin and spin axis -- and nothing downstream
// changes. The flight, the bounce, the roll and the wind are the same simulator
// a launch-monitor shot goes through.
//
// THE PULL IS IN YARDS, NOT PERCENT. Half a full pull is half the club's carry,
// so a golfer who needs 60 of a 100-yard wedge pulls to 60. It was once a share
// of the club's SPEED, and carry is not proportional to speed, so half power
// was nowhere near half the distance. The speed is solved against the ball
// model on level ground in still air (`speedForCarry`), the same way
// `bagClubs` solves a full swing from the bag's yardage.
//
// Every width and shape number below is PLACED -- chosen to feel right
// and to be tuned by playing -- not taken from a source. RESEARCH.md, *The Swing
// Meter*, says which is which.
import {simulateShot, YARD, R, clamp} from './physics.js';
import {spinForPower} from './clubs.js';
import {launchForDistance, struckDistance} from './turf.js';
import {playsLikeSteps} from './plays-like.js';
import {GROUNDS} from './grounds.js';

// THE LIE costs a shot ball speed and, out of grass, spin. One rule for every
// golfer: the Swing Meter takes it off the swing, and (unless the round
// switches it off) a launch monitor's shot has it taken off what it measured.
//
// SPEED, as the share kept. PLACED: nobody publishes ball speed by lie. Semi
// rough 96% and rough 90% sit inside what other simulators take (5 to 15% from
// rough) and the USGA's light-rough landings, which arrive within 5% of the
// fairway's. Sand keeps 85%: a ball picked clean off a fairway bunker loses
// about 5%, a heavy one 30%, and one table has to serve both.
// The ground types (grounds.js) add their own rows: rock, scree, heather and
// the rest each keep a share of their own.
export const LIE_SPEED = {semi: .96, rough: .9, sand: .85, ...Object.fromEntries(Object.entries(GROUNDS).map(([k, g]) => [k, g.lie]))};
// SPIN: THE FLYER. Grass caught between the face and the ball takes away the
// friction a lofted face needs to spin it; a strong-lofted face barely needs
// any, so it loses nothing. MEASURED (the USGA's 2006 groove study, modern
// grooves, light rough): a sand wedge launched at 29 degrees lands with 4,800
// rpm out of the rough against 9,100 off the fairway, while a 5 iron launched
// at 16 degrees keeps all of its spin. So the loss is keyed to the LAUNCH
// ANGLE, which a Swing Meter shot and a launch monitor's both have: nothing at
// `from` degrees or under, the whole `loss` at `full` and over. Semi rough's
// loss is PLACED at under half of rough's, for grass half as long. Sand is not
// grass, and a clean strike from it spins as usual. The ground types are not
// given a loss yet.
export const LIE_SPIN = {from: 16, full: 28, loss: {semi: .2, rough: .45}};
export const lieSpin = (surface, launch) => {
 const loss = LIE_SPIN.loss[surface];
 return loss && launch > LIE_SPIN.from ? 1 - loss * Math.min(1, (launch - LIE_SPIN.from) / (LIE_SPIN.full - LIE_SPIN.from)) : 1;
};
export const lieFactor = surface => LIE_SPEED[surface] ?? 1;
export const LIE_NAMES = {semi: 'semi-rough', rough: 'rough', sand: 'sand', ...Object.fromEntries(Object.entries(GROUNDS).map(([k, g]) => [k, g.word]))};
// A LAUNCH MONITOR'S SHOT FROM A LIE. The measured ball speed is multiplied by
// the lie's share and the measured spin by the flyer's -- unless the round
// switched that off (`on`), or the ball is on the range's mat -- and launch,
// direction and axis are left exactly as measured. The measured speed is kept
// beside the played one (`lie.before`, `lie.measured`) so it is shown and
// recorded as sent, with the penalty in red beside it (shot-data.js); `lie.spin`
// is the share of spin kept. Returns what to fly and what to record.
export function monitorLie(data, surface, {on = true, range = false} = {}) {
 const f = range ? 1 : lieFactor(surface);
 if (f >= 1) return {launch: data, lie: null};
 const penalise = !!on, spin = penalise ? lieSpin(surface, data.vla) : 1;
 return {launch: penalise ? {...data, speed: data.speed * f, spin: data.spin * spin} : data,
  lie: {surface, factor: penalise ? f : 1, spin, before: data.speed, measured: true}};
}

// Per golfer, kept in the profile. `zone` and `perfect` are HALF-widths of the
// strike zone and the perfect band, in lengths of a full swing; the pull and
// push turns them into degrees (swing-stroke.js `STROKE.degPerBar`). (The
// bar's `rise`, the marker's seconds to full, went with the bar on 16
// November 2026; a `putRead` share went with the putt preview, 14 October.)
export const DIFFICULTIES = {
 easy: {label: 'Easy', zone: .1, perfect: .03, wind: true},
 normal: {label: 'Normal', zone: .065, perfect: .015, wind: false},
 hard: {label: 'Hard', zone: .04, perfect: .008, wind: false},
};
export const DEFAULT_DIFFICULTY = 'normal';
export const difficultyOf = id => DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];

// A pull runs from 0 to 1 (full) and on to 1 + OVERSWING. Overswing is worth
// up to 5% more carry -- the only way past the bag -- and narrows the strike
// zone the deeper the pull goes into it.
export const OVERSWING = .12, OVERSWING_CARRY = .05;
// Below this share of the bar the strike zone widens: a chip is about distance.
export const SHORT_SHOT = .4;

export const CURVES = ['draw', 'straight', 'fade'];
export const HEIGHTS = ['low', 'normal', 'high'];
// The spin dial: one step off, the club's own, or up to three added.
export const SPIN_STEPS = [-1, 0, 1, 2, 3];
export const DEFAULT_SHAPE = Object.freeze({curve: 'straight', height: 'normal', spin: 0});
// THE SPIN DOT (branch pull-push-swing, 16 November 2026; the owner: "give the
// user a golf ball icon with a dot they can drag around. The dot would change
// the backspin as well as the spin axis"). `dot` is where on the ball face the
// golfer strikes, x right and y DOWN, inside the unit circle. Below the middle
// adds backspin (to `more` at the bottom), above takes it off (to `less` at
// the top); right of the middle tilts the spin axis right, up to `axis`
// degrees, curving the ball right (a right-hander's fade), and left curves it
// left (a draw). That tilt is what curves a ball, so since the owner's third
// try at the swing (16 November 2026: "What impacts draw and fade is the ball
// spin correct? So our spin meter should expose that") it is THE draw and
// fade; the swing picks where the ball starts (swing-stroke.js, Push and
// Pull; `pushStart`). The side spin is NOT started the other way to land on
// the aim: a Push with a full draw does that. Every step away from the middle narrows the strike's
// allowance as added spin did (`zone` per third of the way down, per half of
// the way across). The dot replaces the spin steps for the game; a shape with
// no dot still reads `spin` steps (tests, older records). All PLACED.
export const SPIN_DOT = {more: .3, less: .25, axis: 10, zone: .85};
export function clampDot(d) {
 const x = Number.isFinite(d?.x) ? d.x : 0, y = Number.isFinite(d?.y) ? d.y : 0, r = Math.hypot(x, y);
 return r > 1 ? {x: x / r, y: y / r} : {x, y};
}
export const dotSpin = d => d.y >= 0 ? 1 + SPIN_DOT.more * d.y : 1 + SPIN_DOT.less * d.y;
export function validShape(s = {}) {
 return {
  curve: CURVES.includes(s.curve) ? s.curve : 'straight',
  height: HEIGHTS.includes(s.height) ? s.height : 'normal',
  spin: SPIN_STEPS.includes(s.spin) ? s.spin : 0,
  ...(s.dot ? {dot: clampDot(s.dot)} : {}),
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
// HOW MUCH SPIN THE DIAL ADDS OR TAKES OFF: each added step is another tenth
// of the club's spin; a step off is a quarter less.
const SPIN_SCALE = {'-1': .75, 0: 1, 1: 1.1, 2: 1.2, 3: 1.3};
// WHAT A HEIGHT DOES TO THE SPIN. Spin follows the loft the face presents to
// the swing's path. Hit low, the face is turned down (launch 4 degrees lower)
// and the ball spins about 8% less; hit high, the opposite. A bump-and-run
// halves the launch and so about halves the spin. A flop adds 10 degrees to a
// face already past the loft where spin stops rising (about 50 degrees: the
// ball slides up the face instead of gripping it), so it spins a little LESS
// than a stock shot, not more. PLACED from that geometry; nothing here is
// tuned to make a ball stop or come back -- what a shot does on the green is
// the ball model's business (docs/BALL_PHYSICS.md).
const HEIGHT_SPIN = {low: .92, normal: 1, high: 1.08, bump: .5, flop: .85};
export function shapedLaunch(club, shape, {short = false} = {}) {
 const s = validShape(shape);
 if (club.code === 'PT') return {vla: 0, spin: 0, axis: 0, side: 0, zone: 1, flop: false};
 const kind = short && s.height === 'low' ? 'bump' : short && s.height === 'high' ? 'flop' : s.height;
 const vla = kind === 'bump' ? club.vla * .55 : kind === 'flop' ? club.vla + 10
  : kind === 'low' ? club.vla - 4 : kind === 'high' ? club.vla + 4 : club.vla;
 const d = s.dot;
 return {
  vla: clamp(vla, 3, 60),
  spin: club.spin * HEIGHT_SPIN[kind] * (d ? dotSpin(d) : SPIN_SCALE[s.spin]),
  axis: CURVE_AXIS[s.curve],
  // The spin dot's side spin, kept apart from the curve's axis: the curve is
  // started the other way to land on the aim (`curveCompensation`), this is not.
  side: d ? d.x * SPIN_DOT.axis : 0,
  // The strike zone's width, as a share of the difficulty's: a flop is harder to
  // hit cleanly, and every step of added spin -- or the dot away from the
  // middle -- narrows it.
  zone: (kind === 'flop' ? .8 : 1) * (d ? Math.pow(SPIN_DOT.zone, 3 * Math.max(0, d.y) + 2 * Math.abs(d.x)) : Math.pow(.85, Math.max(0, s.spin))),
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

// THE THREE-TAP BAR'S TIMING -- startSwing, tap, advance, markerAt, the run-up
// and the slow overswing -- went with the bar on 16 November 2026 (branch
// pull-push-swing; the owner: "remove the bar entirely"). A swing is now a
// pull and push (swing-stroke.js), which hands `swingLaunch` its pull as
// `power` and its strike already judged as `fx`.

// WHAT A STRIKE OFF THE LINE DOES TO THE BALL. `error` is how far off, in
// lengths of a full swing: positive sends the ball RIGHT and negative LEFT,
// for every golfer -- the swing has no handedness (the owner's rule, 14
// October 2026, from the bar's early and late). Inside the perfect band the
// ball goes where it was aimed; from there to the zone's edge it starts a
// degree and a quarter off line with five degrees of curve; outside the zone
// it keeps growing, to four times that. The pull and push's line costs the
// same (swing-stroke.js `strokeEffect`).
export function strikeEffect(error, {zone, perfect}, {putt = false} = {}) {
 const a = Math.abs(error);
 if (a <= perfect) return {hla: 0, axis: 0, speed: 1, miss: 0, perfect: true};
 const m = Math.min(4, (a - perfect) / Math.max(1e-6, zone - perfect)), side = error > 0 ? 1 : -1;
 return putt ? {hla: side * m * .5, axis: 0, speed: 1, miss: m, perfect: false}
  : {hla: side * m * 1.25, axis: side * m * 5, speed: 1, miss: m, perfect: false};
}

// LEVEL GROUND, STILL AIR: the reference every number on the bar is drawn in.
const FLAT = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []};
const FLAT_OPTIONS = {dt: 1 / 120}, CARRY_OPTIONS = {dt: 1 / 120, untilLanding: true};
function fly(club, launch, speed, hla = 0, options = FLAT_OPTIONS) {
 const spin = launch.spin * spinForPower(clamp(speed / club.speed, 0, 1.2));
 return simulateShot({origin: {x: 0, z: 0}, aim: 0, speed, vla: launch.vla, hla, spin, spinAxis: launch.axis}, FLAT, options);
}
// The carry alone: flown only to its first touchdown, where the carry is taken
// (physics.js `untilLanding`), so the same number for a fraction of the steps.
const flyCarry = (club, launch, speed) => fly(club, launch, speed, 0, CARRY_OPTIONS).carry;
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
 if (!cache.has(key)) cache.set(key, flyCarry(club, launch, club.speed));
 return cache.get(key);
}
// How far this club and shape carries at a given ball speed.
export function carryAtSpeed(club, launch, speed) {
 const key = 'at:' + keyOf(club, launch) + ':' + speed.toFixed(3);
 if (!cache.has(key)) cache.set(key, flyCarry(club, launch, speed));
 return cache.get(key);
}
// The ball speed that carries `metres` with this club and shape. Bisected
// against the ball model; cached per club, shape and yard.
// Run a stepped search (a generator) to its end at once: its answer.
const whole = it => { let r; while (!(r = it.next()).done); return r.value; };
export function speedForCarry(club, launch, metres) { return whole(speedForCarrySteps(club, launch, metres)); }
// The same, a pause after every third flight (a computer golfer's plan,
// spread over frames; golfer.js `planSteps`).
export function* speedForCarrySteps(club, launch, metres) {
 if (metres <= 0) return 0;
 const key = keyOf(club, launch) + ':' + Math.round(metres / YARD * 4);
 if (cache.has(key)) return cache.get(key);
 let lo = 0, hi = club.speed * 1.25;
 for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (flyCarry(club, launch, mid) < metres) lo = mid; else hi = mid; if (i % 3 === 2) yield; }
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
// HOW FAR OFF THE AIM A PUSH OR PULL STARTS (swing-stroke.js), in degrees:
// as far as the spin dot's full side spin bends this club at this speed, so a
// Push with the dot all the way to the draw side comes down on the aim line,
// and a Push with none finishes right of it. About 4.6 degrees for a driver,
// 4.9 for a 7-iron and 2.5 for a sand wedge at full speed. PLACED.
export function pushStart(club, launch, speed) {
 return Math.abs(curveCompensation(club, {...launch, axis: SPIN_DOT.axis}, speed));
}
// The flight's ground track to where it lands, in the aim-0 frame, for drawing
// the shape on the course before the swing.
export function previewTrack(club, launch, speed) {
 const r = fly(club, launch, speed, curveCompensation(club, launch, speed)), l = landing(r);
 return r.points.slice(0, l.i + 1).filter((_, i, a) => i % 4 === 0 || i === a.length - 1).map(p => ({x: p.x, z: p.z}));
}

// A PUTT'S BAR IS IN DISTANCE OF ROLL on a flat green at today's Stimp: full is
// as far as the putter's full stroke rolls today.
export function puttFullRoll(putter, turf) { return struckDistance(putter.speed, turf); }
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
//
// AND IN TO A TAP-IN (pull-push-swing, 16 November 2026). A pull shorter than
// 4% of a full pull is no swing (swing-stroke.js `minShare`), and a half-foot
// putt on a quarter of the putter's roll was 2% -- it could not be struck (the
// smoke run's tap-ins, "waited 5s for the putt to start"). So the pull also
// zooms to an eighth, a sixteenth and a thirty-second of the putter's roll:
// about 3.4 m, 1.7 m and 0.85 m at Stimp 10, which takes a putt down to a few
// centimetres. The putt's length is the pull's share of the range either way,
// so nothing else moves. PLACED.
export const PUTT_RANGES = [1 / 32, 1 / 16, 1 / 8, .25, .5, 1, 1.5, 2, 3, 4, 6];
export function puttRange(putter, turf, aimMetres) {
 const full = puttFullRoll(putter, turf);
 for (const k of PUTT_RANGES) if (aimMetres * 1.25 <= full * k) return full * k;
 return full * PUTT_RANGES.at(-1);
}
export function puttSpeedFor(putter, turf, metres) { return Math.min(putter.speed * 3, launchForDistance(metres, turf)); }

// THE TARGET MARKER (Phase 2): where on the bar to stop for the ball to come
// down in the aim circle. Found by flying the ball, not by a rule of thumb: the
// circle's distance is turned into the carry it plays like on level ground in
// still air by `playsLike` (the club and shape at a full swing, flown to the
// circle's height in today's air and against a level reference), then the bar
// share for that carry is read off the same ball model the bar is drawn from,
// with the lie's lost speed made up.
//
// WHAT IT ALLOWS FOR: the slope and the lie
// always; the WIND only on Easy -- on Normal and Hard judging the wind is the
// golfer's job, and the wind dial is on screen. Altitude and temperature are
// always in: they are the air, not something a golfer reads.
//
// Returns {share, out}: `share` in bar lengths (0 to 1; the overswing zone is
// never suggested), `out` when even a full swing falls short, or the circle is
// above where this shot can climb.
export function targetShare(o) { return whole(targetShareSteps(o)); }
// The same in steps: a pause after each flight or few (`playsLikeSteps`,
// `speedForCarrySteps`), for a computer golfer's plan spread over frames.
export function* targetShareSteps({club, shape, short = false, lie, difficulty, metres, rise = 0, bearing = 0, wind = [0, 0, 0], altitude = 0, temperature}) {
 if (!club || club.code === 'PT' || !(metres > 0)) return null;
 const launch = shapedLaunch(club, shape, {short});
 const full = fullCarry(club, launch);
 const level = yield* playsLikeSteps({distance: metres, rise, bearing, wind: difficultyOf(difficulty).wind ? wind : [0, 0, 0], altitude, temperature,
  launch: {speed: club.speed, vla: launch.vla, spin: launch.spin, spinAxis: 0}});
 yield;
 if (level == null) return {share: 1, out: true};
 const f = lieFactor(lie);
 // The carry the bar must ask for: on a clean lie the level carry itself; from
 // the rough, the carry of the speed that the lie will cut down to the right one.
 // The grass takes spin as well, so the speed is the one that carries the
 // distance with the spin the lie leaves.
 const lying = {...launch, spin: launch.spin * lieSpin(lie, launch.vla)};
 const asked = f < 1 ? carryAtSpeed(club, launch, Math.min(club.speed * 1.3, (yield* speedForCarrySteps(club, lying, level)) / f)) : level;
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
export function swingLaunch(sw, o) { return whole(swingLaunchSteps(sw, o)); }
// The same in steps: a pause after every few flights of the speed search and
// before the aim correction's flight, for a computer golfer's plan spread over
// frames (golfer.js `shotSteps`). Run whole, the same numbers.
export function* swingLaunchSteps(sw, {club, shape, short = false, lie, difficulty, turf, puttRange: range = null, zoom = 1}) {
 const putt = club.code === 'PT';
 const launch = shapedLaunch(club, shape, {short});
 const power = sw.power ?? 0, share = (putt ? 1 : zoom) * carryShare(power);
 const zones = strikeZone({difficulty, shape: launch.zone, lie, putt, power, share: putt ? power : zoom * power});
 // A pull-and-push swing (swing-stroke.js) arrives already judged, in the same
 // terms, with a launch change of its own (a rushed push flies lower).
 const fx = sw.fx ?? strikeEffect(sw.error ?? 0, zones, {putt});
 const factor = lieFactor(lie);
 if (putt) {
  const speed = puttSpeedFor(club, turf, share * (range ?? puttFullRoll(club, turf)));
  return {shot: {speed: speed * fx.speed * factor, vla: 0, hla: fx.hla, spin: 0, spinAxis: 0}, before: speed * fx.speed, factor, power, share, strike: fx, zones};
 }
 const speed = (yield* speedForCarrySteps(club, launch, share * fullCarry(club, launch))) * fx.speed;
 // A chosen Push or Pull starts the ball off the aim by the club's own angle.
 const side = fx.start === 'push' ? 1 : fx.start === 'pull' ? -1 : 0;
 yield;
 const comp = curveCompensation(club, launch, speed) + (side ? side * pushStart(club, launch, speed) : 0);
 const spin = launch.spin * lieSpin(lie, launch.vla) * spinForPower(clamp(speed / club.speed, 0, 1.2));
 return {shot: {speed: speed * factor, vla: clamp(launch.vla + (fx.vla ?? 0), 3, 60), hla: comp + fx.hla, spin, spinAxis: launch.axis + (launch.side ?? 0) + fx.axis}, before: speed, factor, power, share, strike: fx, zones};
}
