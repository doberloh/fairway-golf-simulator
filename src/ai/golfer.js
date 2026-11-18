// A COMPUTER GOLFER (the fairway-tour goal, 17 November 2026; SPEC.md,
// section 1, local). Pure: no DOM, no three.js.
//
// It stands where the ball lies, decides what to play -- which club, at what,
// going for it or laying up -- and returns the launch it struck. The game (or
// a test) flies that launch through the real ball model, so every ball a
// computer golfer hits on screen is a real ball (PROJECT_HANDOFF *The
// simulator never invents ball data*).
//
// THE BRAIN plans with expected strokes: for each shot it could play it looks
// at where its own misses would finish (a fixed spread of points around the
// target, sized by its skill) and what each finish is worth (strokes.js),
// counting water and out of bounds; it plays the cheapest. Bold golfers
// weigh trouble less (aggression). A putt is read by rolling it first: the
// golfer finds the line and pace that hole it, then plays the share of the
// break its skill reads.
//
// THE HANDS take the intended swing through the game's own swing functions
// (swing-meter.js: the club's launch for the distance asked), then draw the
// miss from the golfer's spreads (skill.js): start line, distance, the putt's
// pace and line, and now and then a proper mishit.
//
// EVERY DRAW IS SEEDED by the golfer's seed and the shot's key (the round,
// the hole, the stroke), so a reload or a mulligan replays the same shots
// (SPEC 2, *Undo and mulligans do not reroll them*).
import {simulateShot, outOfBounds} from '../physics.js';
import {turfConfig} from '../turf.js';
import {bagClubs, stockBag} from '../clubs.js';
import {swingLaunch, targetShare, swingZoom, fullCarry, shapedLaunch, shortGame, puttSpeedFor, lieFactor, DEFAULT_SHAPE} from '../swing-meter.js';
import {fairwayAim} from '../course.js';
import {localWind} from '../shot-visuals.js';
import {seeded} from '../challenges.js';
import {skillFor} from './skill.js';
import {strokesFor, lieClass} from './strokes.js';

const YARD = .9144, DEG = Math.PI / 180;
// A ball on a green this far or more from the hole's cup is on another hole's
// green, and played as fairway (the builder's test round: Worthington's
// practice green; PLACED 45 m).
export const OWN_GREEN = 45;
export const lieAt = (h, x, z) => { const s = h.surface(x, z); return s === 'green' && Math.hypot(x - h.pin.x, z - h.pin.z) >= OWN_GREEN ? 'fairway' : s; };

// The golfer's bag: the stock clubs with every carry scaled to its drive.
export function golferBag(skill) {
 const k = skill.driveCarry / 250;
 return stockBag(Object.fromEntries(stockBag().filter(c => c.kind !== 'putter').map(c => [c.kind, Math.round(c.carry * k)])));
}

// A normal draw from two uniforms (Box-Muller), clamped at 3.5 sigma so one
// freak number cannot send a putt off the green.
const normal = rnd => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.max(-3.5, Math.min(3.5, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); };
// The median distance of a two-dimensional normal miss with spreads s and
// r*s is about 1.1774 s sqrt((1 + r^2) / 2): turns a median "fraction left"
// into the spread across the line.
const acrossFromFRL = (frl, ratio) => frl / (1.1774 * Math.sqrt((1 + ratio * ratio) / 2));
// The fixed points a plan is judged on: the centre, one and two spreads each
// way along and across, and the four diagonals at one; weights from the
// normal curve. Fixed, so a plan never uses the shot's random numbers.
const SAMPLES = (() => {
 const pts = [[0, 0]];
 for (const a of [-2, -1, 1, 2]) { pts.push([a, 0], [0, a]); }
 for (const a of [-1, 1]) for (const b of [-1, 1]) pts.push([a, b]);
 const w = pts.map(([a, b]) => Math.exp(-(a * a + b * b) / 2)), sum = w.reduce((s, x) => s + x, 0);
 return pts.map(([a, b], i) => ({a, b, w: w[i] / sum}));
})();

// `bag`: a bag to play with instead of the stock bag scaled to the golfer's
// drive (the caddie plans with the person's own clubs).
export function computerGolfer({handicap = 15, traits = {}, seed = 'golfer', settings = {}, name = '', bag: ownBag = null} = {}) {
 const skill = skillFor(handicap, traits), bag = ownBag || golferBag(skill), clubs = bagClubs(bag);
 const turf = turfConfig(settings.turf), wind = h => localWind(settings, h.rotation || 0);
 const list = Object.entries(clubs).filter(([id]) => id !== 'putter');
 const putter = clubs.putter;
 const air = h => ({wind: wind(h), altitude: h.bio?.altitude ?? 0, temperature: h.bio?.temperature});
 const E = (surface, metres) => strokesFor(skill.handicap, surface, metres);

 // The spread of a full shot with a club, as fractions of the distance:
 // across from the start-line angle, along from the distance error. An iron
 // keeps the approach's spread as a share of its distance at any length (a
 // pro's proximity is about the same share from 100 and 200 yd); the driver
 // has the tee shot's measured spread, the woods and hybrids part of the way
 // there, the long irons a little (PLACED: 1, .6, .25).
 const WOODINESS = {driver: 1, wood: .6, wood5: .6, wood7: .5, hybrid: .45, iron3: .25, iron4: .2};
 function fullSpread(c) {
  const ironAcross = acrossFromFRL(skill.approachFRL, skill.longWide);
  const driveAcross = Math.tan(skill.driveDir * DEG);
  const t = WOODINESS[c.kind] ?? 0;
  const across = ironAcross + t * (driveAcross - ironAcross);
  return {across, along: ironAcross * skill.longWide};
 }
 function shortSpread(sand) {
  const frl = sand ? skill.sandFRL : skill.shortFRL;
  const across = acrossFromFRL(frl, skill.shortRatio);
  return {across, along: across * skill.shortRatio};
 }

 // What a finish here is worth, in strokes from the shot just played.
 function worth(h, p, from) {
  if (outOfBounds(h, p.x, p.z)) return 2 + E(lieAt(h, from.x, from.z), Math.hypot(h.pin.x - from.x, h.pin.z - from.z));
  const s = lieAt(h, p.x, p.z), d = Math.hypot(h.pin.x - p.x, h.pin.z - p.z);
  if (s === 'water') return 2 + E('rough', d + 15);
  return 1 + E(s, d);
 }
 // A plan's expected strokes: its finishes, weighted, with trouble counted
 // more by a careful golfer and less by a bold one (aggression; PLACED, a
 // fifth either way).
 function judge(h, from, finish, spread) {
  const dx = finish.x - from.x, dz = finish.z - from.z, dist = Math.hypot(dx, dz) || 1, ux = dx / dist, uz = dz / dist;
  const care = 1.2 - .4 * skill.aggression;
  let total = 0;
  for (const {a, b, w} of SAMPLES) {
   const along = dist * (1 + b * spread.along), across = dist * a * spread.across;
   const p = {x: from.x + ux * along - uz * across, z: from.z + uz * along + ux * across};
   const v = worth(h, p, from), base = 1 + E(lieAt(h, p.x, p.z) === 'water' ? 'rough' : 'fairway', Math.hypot(h.pin.x - p.x, h.pin.z - p.z));
   total += w * (v > base + .5 ? base + (v - base) * care : v);
  }
  return total;
 }
 const reach = (c, h, from, to, lie) => targetShare({club: c, shape: DEFAULT_SHAPE, lie, difficulty: 'normal', metres: Math.hypot(to.x - from.x, to.z - from.z),
  rise: h.height(to.x, to.z) - h.height(from.x, from.z), bearing: Math.atan2(to.x - from.x, to.z - from.z), ...air(h)});

 // THE PLAN for a shot off the green: {club id, target (where it should
 // finish), expected strokes}. Candidates are screened by the club's carry
 // and the climb (cheap); only the chosen one is asked of the ball model
 // whether it reaches (targetShare flies the ball), the next best if not.
 // Rules a golfer keeps (PLACED): within 60 yd only the wedges; never more
 // than a third over the distance with a long club (no half 5-irons); out of
 // sand nothing longer than a 7-iron, and from a greenside bunker the sand
 // wedge; from a lie that did not let the last shot out, a wedge back to the
 // fairway.
 function plan(h, from, lie, {avoid = 0, stuck = 0} = {}) {
  const pin = h.pin, toPin = Math.hypot(pin.x - from.x, pin.z - from.z), yds = toPin / YARD;
  const rise = h.height(pin.x, pin.z) - h.height(from.x, from.z), sand = lieClass(lie) === 'sand';
  const options = [];
  const consider = (id, target, spread) => {
   options.push({id, target, ev: judge(h, from, target, spread) + avoid * (lieAt(h, target.x, target.z) === 'water' ? 1 : 0)});
  };
  const wedges = list.filter(([, c]) => shortGame(c, yds));
  if (stuck >= 1) {
   // Out sideways to the fairway, short of the hole (a golfer who could not
   // get out takes the safe way).
   const [id] = wedges.length ? wedges[wedges.length - 1] : list[list.length - 1];
   const carry = Math.min(clubs[id].carry * YARD * .8, toPin * .7);
   return {id, target: fairwayAim(h, from, Math.max(10, carry)), ev: 0};
  }
  if (yds <= 60 && wedges.length) {
   const pick = sand ? wedges.filter(([, c]) => c.kind === 'sand' || c.kind === 'lob') : wedges;
   for (const [id] of pick.length ? pick : wedges) consider(id, {...pin}, shortSpread(sand));
  } else {
   for (const [id, c] of list) {
    if (sand && c.carry > (clubs.iron7?.carry ?? 155)) continue;
    const carry = c.carry * YARD, need = toPin + Math.max(0, rise) * 1.2;
    if (carry >= need * .92 && carry <= need * 1.35 + 15) {
     consider(id, {...pin}, fullSpread(c));
     if (h.green && Math.hypot(h.green.x - pin.x, h.green.z - pin.z) > 4) consider(id, {...h.green}, fullSpread(c));
    } else if (carry < need * .92 && toPin - carry > 25) {
     consider(id, fairwayAim(h, from, carry), fullSpread(c));
    }
   }
  }
  options.sort((a, b) => a.ev - b.ev);
  for (const o of options) {
   const t = reach(clubs[o.id], h, from, o.target, lie);
   if (t && !t.out) return o;
  }
  // Nothing reaches by the ball model (uphill into wind): the longest club
  // allowed from here, down the line.
  const [id] = sand ? list.filter(([, c]) => c.carry <= (clubs.iron7?.carry ?? 155))[0] || list[list.length - 1] : list[0];
  return {id, target: fairwayAim(h, from, clubs[id].carry * YARD), ev: Infinity};
 }

 // A PUTT READ: the aim and roll that hole it, found by rolling it (three
 // tries at most, each correcting line and pace from where it went).
 function readPutt(h, from, lie) {
  const pin = h.pin, d = Math.hypot(pin.x - from.x, pin.z - from.z), straight = Math.atan2(pin.x - from.x, pin.z - from.z) / DEG;
  let aim = straight, roll = d + .43; // Pelz: 17 in past (PLACED as the aim)
  for (let i = 0; i < 3; i++) {
   const speed = puttSpeedFor(putter, turf, Math.max(.1, roll));
   const r = simulateShot({origin: {...from}, aim, speed, vla: 0, hla: 0, spin: 0, spinAxis: 0}, h, {...air(h), turf, flagsticks: {current: false}});
   if (r.holed) break;
   // The closest the ball came to the cup, and which side.
   let best = null;
   for (const q of r.points || []) { const k = Math.hypot(q.x - pin.x, q.z - pin.z); if (!best || k < best.k) best = {k, x: q.x, z: q.z}; }
   const ux = (pin.x - from.x) / d, uz = (pin.z - from.z) / d;
   const side = best ? (best.x - pin.x) * uz - (best.z - pin.z) * ux : 0;
   aim -= Math.atan2(side, d) / DEG;
   const past = (r.end.x - pin.x) * ux + (r.end.z - pin.z) * uz;
   roll = Math.max(.1, roll - (past - .43));
  }
  return {aim, roll, straight};
 }

 // ONE SHOT. `key` names the shot (round, hole, stroke) for its random
 // numbers; `pressure` is 0..1 (the last holes in contention); `avoid` is
 // how many penalties this golfer has taken from this spot already.
 // A SHOT THAT WENT NOWHERE: the last one from (almost) here, if it finished
 // within 4 m of where it started, makes the next a way out.
 let last = null, stuck = 0;
 // The putter from off the green (PLACED): from the fringe within 25 m, and
 // from the fairway within 12 m, as most golfers would.
 const putts = (lie, toPin) => lie === 'green' || lie === 'fringe' && toPin < 25 || (lie === 'fairway' || lie === 'apron') && toPin < 12;
 // `fly: false` returns the struck shot without flying it: the game flies it
 // itself (main.js takeShot), and tells the golfer where it finished with
 // `landed`, so a shot that went nowhere is still noticed.
 function shot({hole: h, from, key = '', pressure = 0, avoid = 0, fly = true}) {
  const rnd = seeded(`${seed}|${key}`), lie = lieAt(h, from.x, from.z);
  const nerves = 1 + .25 * (1 - skill.nerve) * Math.min(1, Math.max(0, pressure));
  stuck = last && last.h === h && Math.hypot(from.x - last.from.x, from.z - last.from.z) < 1 && last.end && Math.hypot(last.end.x - last.from.x, last.end.z - last.from.z) < 4 ? stuck + 1 : 0;
  const out = shotFrom(h, from, lie, rnd, nerves, avoid, fly);
  last = {h, from: {...from}, end: out.result ? {x: out.result.end.x, z: out.result.end.z} : null};
  return out;
 }
 function landed(h, from, end) { if (last && last.h === h && Math.hypot(last.from.x - from.x, last.from.z - from.z) < .01) last.end = {x: end.x, z: end.z}; }
 function shotFrom(h, from, lie, rnd, nerves, avoid, fly) {
  if (putts(lie, Math.hypot(h.pin.x - from.x, h.pin.z - from.z)) && !stuck) {
   const read = readPutt(h, from, lie);
   const aim = read.straight + (read.aim - read.straight) * skill.read + normal(rnd) * skill.puttLine * nerves;
   const roll = read.roll * Math.max(.2, 1 + normal(rnd) * skill.puttPace * nerves);
   const speed = puttSpeedFor(putter, turf, Math.max(.05, roll));
   const launch = {speed, vla: 0, hla: 0, spin: 0, spinAxis: 0};
   const result = fly ? simulateShot({origin: {...from}, aim, ...launch}, h, {...air(h), turf, flagsticks: {current: false}}) : null;
   return {result, club: 'putter', kind: 'putter', launch, before: launch.speed, aim, target: {...h.pin}, plan: 'putt'};
  }
  const p = plan(h, from, lie, {avoid, stuck});
  const c = clubs[p.id], toPin = Math.hypot(h.pin.x - from.x, h.pin.z - from.z);
  const short = shortGame(c, toPin / YARD), sand = lieClass(lie) === 'sand';
  // The swing's carry: a full shot is asked for the target; a short shot is
  // landed short so it runs to it (the virtual golfer's chip, measured 16
  // October 2026: 3.5 yd of run from 10 to 40 yd).
  let target = p.target;
  if (short) { const k = Math.max(.4, (toPin - 3.5 * YARD) / toPin); target = {x: from.x + (p.target.x - from.x) * k, z: from.z + (p.target.z - from.z) * k}; }
  // A target on top of the ball (a lay-up short of nothing) is moved 10 m
  // toward the hole.
  if (!(Math.hypot(target.x - from.x, target.z - from.z) > 2)) { const k = Math.min(1, 10 / Math.max(1, toPin)); target = {x: from.x + (h.pin.x - from.x) * k, z: from.z + (h.pin.z - from.z) * k}; }
  const range = Math.hypot(target.x - from.x, target.z - from.z);
  const zoom = swingZoom(fullCarry(c, shapedLaunch(c, DEFAULT_SHAPE, {short})), range);
  const t = reach(c, h, from, target, lie);
  const share = t && Number.isFinite(t.share / zoom) ? Math.min(1, t.share / zoom) : 1;
  const out = swingLaunch({power: share, error: 0, done: true}, {club: c, shape: DEFAULT_SHAPE, short, lie, difficulty: 'normal', turf, zoom});
  const launch = {...out.shot};
  let aim = Math.atan2(target.x - from.x, target.z - from.z) / DEG;
  // The miss.
  const spread = short || sand && toPin < 50 * YARD ? shortSpread(sand) : fullSpread(c);
  aim += Math.atan(normal(rnd) * spread.across * nerves) / DEG;
  // A sand shot's spread along the line can pass the whole distance; the
  // worst is a ball that barely moves, never one struck backwards.
  launch.speed *= Math.max(.15, 1 + normal(rnd) * spread.along * skill.speed * nerves);
  let mishit = null;
  if (rnd() < skill.mishit * nerves) {
   const kind = rnd();
   if (kind < .35) { mishit = 'thin'; launch.speed *= .75; launch.vla *= .6; launch.spin *= .6; }
   else if (kind < .65) { mishit = 'fat'; launch.speed *= .6; }
   else if (kind < .95) { mishit = 'wide'; aim += (rnd() < .5 ? -1 : 1) * (3 + 2 * rnd()) * Math.atan(spread.across) / DEG; }
   else { mishit = 'shank'; aim += 35; launch.speed *= .5; launch.vla *= .8; }
  }
  // A natural draw or fade: a little curve, started the other way to land on
  // the line (PLACED: 3 degrees of spin axis on full shots).
  if (!short && skill.shape !== 'straight') { const s = skill.shape === 'draw' ? -3 : 3; launch.spinAxis += s; aim += s * .25; }
  for (const k of ['speed', 'vla', 'hla', 'spin', 'spinAxis']) if (!Number.isFinite(launch[k])) throw Error(`computer golfer: ${k} is ${launch[k]} (club ${c.kind}, ${toPin.toFixed(1)} m out, share ${share}, zoom ${zoom})`);
  if (!Number.isFinite(aim)) throw Error(`computer golfer: aim is ${aim} (club ${c.kind}, target ${JSON.stringify(target)})`);
  let result = null;
  if (fly) {
   try { result = simulateShot({origin: {...from}, aim, ...launch}, h, {...air(h), turf, flagsticks: {current: true}}); }
   catch (e) { throw Error(`computer golfer's shot failed in the ball model: ${e.message}; from ${JSON.stringify(from)} (${lie}), aim ${aim}, launch ${JSON.stringify(launch)}, club ${c.kind}, mishit ${mishit}`); }
  }
  return {result, before: out.before * Math.max(.15, launch.speed / Math.max(1e-6, out.shot.speed)), club: p.id, kind: c.kind, launch, aim, target: p.target, plan: short ? 'short' : p.target.x === h.pin.x && p.target.z === h.pin.z ? 'pin' : 'layup', mishit};
 }

 // THE BEST RELIEF from the options relief.js offers (each {spot, penalty}):
 // the fewest strokes from there, penalty included.
 function relief(h, options) {
  let best = null;
  for (const o of options) {
   const v = o.penalty + E(lieAt(h, o.spot.x, o.spot.z), Math.hypot(h.pin.x - o.spot.x, h.pin.z - o.spot.z));
   if (!best || v < best.v) best = {...o, v};
  }
  return best;
 }

 return {name, handicap: skill.handicap, skill, clubs, bag, shot, landed, plan, relief};
}
