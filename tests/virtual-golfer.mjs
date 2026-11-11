// A GOLFER WHO PLAYS IN NODE (16 October 2026): no browser, no graphics card.
//
// It stands where the game would put the ball, picks a club and an aim the way
// the game's turn does (main.js `setUpTurn`, `defaultAim`, `challengeClub`),
// swings the Swing Meter with the game's own functions (swing-meter.js: the
// bar zoomed to the shot, the distance tap where the target marker sits, the
// strike), and flies the ball through the real ball model on the real hole
// (physics.js `simulateShot`) -- slopes, bounces, rough, water, trees, the cup.
// What comes back is the same `ballFacts` main.js hands a challenge.
//
// What it does not do is read a green: it putts straight at the hole, so it
// misses putts that break, as a golfer who does not read them would. Its
// timing errors are seeded, so a failure replays.
//
// This file mirrors main.js's glue around those functions (which club, where it
// aims, how the target share is turned into a tap). If that glue changes, change
// this with it -- the functions it calls are the game's own.
import {simulateShot} from '../src/physics.js';
import {turfConfig, rollDecelerationAt} from '../src/turf.js';
import {bagClubs, stockBag} from '../src/clubs.js';
import {startSwing, tap, swingLaunch, targetShare, swingZoom, fullCarry, shapedLaunch, shortGame, puttRange, puttFullRoll, lieFactor, RUN_UP} from '../src/swing-meter.js';
import {fairwayAim} from '../src/course.js';
import {localWind} from '../src/shot-visuals.js';
import {ballFacts} from '../src/challenge-play.js';
import {seeded} from '../src/challenges.js';

const YARD = .9144;

// A golfer: `skill` is how far a tap strays, as a share of the bar (0 is a
// robot that never misses its timing).
export function virtualGolfer({seed = 'golfer', skill = .012, settings = {}, bag = stockBag()} = {}) {
 // A chip lands this far short and runs out (a sand wedge from 10 to 40 yards
 // rolls 3 to 4 yards on the range's turf, measured 16 October 2026).
 const CHIP_ROLL = 3.5 * YARD;
 const PUTT_CLIMB = 5 / 7 * 9.80665 / rollDecelerationAt('green', turfConfig(settings.turf), .5);
 // Out of grass the ball comes out with less spin and runs further (the flyer,
 // swing-meter.js `lieSpin`): a sand wedge chip runs about a yard further from
 // semi-rough and two and a half from rough (measured 11 November 2026), and
 // a golfer lands it that much shorter, however short the chip -- though
 // never less than 40% of the way.
 const CHIP_FLYER = {semi: .9 * YARD, rough: 2.5 * YARD};
 const rnd = seeded(seed), clubs = bagClubs(bag), turf = turfConfig(settings.turf), wind = h => localWind(settings, h.rotation || 0);
 // A roughly normal stray, from two draws.
 const stray = () => (rnd() + rnd() - 1) * skill * 1.7;
 const list = Object.entries(clubs).filter(([id]) => id !== 'putter');
 let last = null, stuck = 0;
 const nearest = metres => list.sort((a, b) => Math.abs(a[1].carry - metres / YARD) - Math.abs(b[1].carry - metres / YARD))[0][0];
 // ONE SHOT. `hole` is a generated hole (or the range's), `from` where the
 // ball lies, `aimAt` what the challenge aims at (null: the pin, or the
 // fairway from a tee as the game's turn would), `call` a draw/fade/high/low,
 // `club` a kind the challenge insists on, `onRange` off the mat.
 function shot({hole, from, aimAt = null, call = null, club: wantKind = null, onRange = false, spin = 0}) {
  const lie = onRange ? 'tee' : hole.surface(from.x, from.z), pin = hole.pin, toPin = Math.hypot(pin.x - from.x, pin.z - from.z);
  // The club: the putter on the green; the challenge's; else for the distance (setUpTurn, challengeClub).
  // NO PROGRESS, MORE CLUB. A ball that lands on a steep bank rolls back down
  // it, and a golfer who then plays the same shot again does so for ever. One
  // whose last shot from here finished back where it started takes a third
  // more club each time, as a person would.
  stuck = last && !aimAt && Math.hypot(from.x - last.from.x, from.z - last.from.z) < 4 && Math.hypot(last.end.x - last.from.x, last.end.z - last.from.z) < 4 ? stuck + 1 : 0;
  const push = 1 + stuck / 3;
  let id = lie === 'green' ? 'putter' : nearest((aimAt ? Math.hypot(aimAt.x - from.x, aimAt.z - from.z) : toPin) * push);
  if (wantKind && lie !== 'green') id = list.find(([, c]) => c.kind === wantKind)?.[0] || id;
  // The putter from off the green, when asked (a golfer putting from the
  // fringe and close in on the semi-rough): `list` leaves it out.
  if (wantKind === 'putter' && clubs.putter) id = 'putter';
  const c = clubs[id], putt = c.code === 'PT';
  // The aim (defaultAim): the challenge's target, the pin with the putter, the
  // fairway at the club's carry -- and a chip landed short so it runs to the hole.
  let target = aimAt || (putt ? pin : fairwayAim(hole, from, c.carry * YARD));
  if (!aimAt && !putt && shortGame(c, toPin / YARD) && (toPin > 3 * CHIP_ROLL || CHIP_FLYER[lie])) { const k = Math.max(.4, (toPin - (toPin > 3 * CHIP_ROLL ? CHIP_ROLL : 0) - (CHIP_FLYER[lie] ?? 0)) / toPin);target = {x: from.x + (pin.x - from.x) * k, z: from.z + (pin.z - from.z) * k}; }
  if (push > 1 && !putt) target = {x: from.x + (target.x - from.x) * push, z: from.z + (target.z - from.z) * push};
  const aim = Math.atan2(target.x - from.x, target.z - from.z) * 180 / Math.PI;
  // A PUTT IS READ FOR ITS SLOPE, as any golfer reads one: uphill is hit for a
  // longer putt and downhill for a shorter. A slowing ball on a green gives up
  // about `PUTT_CLIMB` metres of roll for each metre it climbs (the pull of the
  // slope on a rolling ball against the green's own drag at walking pace), so a
  // 1 cm rise on a Stimp 10 green is worth 17 cm of putt. Without it every
  // uphill putt stopped a tenth short and nothing but a tap-in was ever holed.
  const climb = putt ? hole.height(pin.x, pin.z) - hole.height(from.x, from.z) : 0;
  const range = putt ? Math.max(.1, toPin + climb * PUTT_CLIMB) : Math.hypot(target.x - from.x, target.z - from.z);
  const shape = {...(call === 'draw' || call === 'fade' ? {curve: call} : call === 'high' || call === 'low' ? {height: call} : {}), ...(spin ? {spin} : {})};
  const short = shortGame(c, toPin / YARD);
  // The swing context (main.js swingContext) and the marker (drawTarget).
  const zoom = putt ? 1 : swingZoom(fullCarry(c, shapedLaunch(c, shape, {short})), range);
  const ctx = {club: c, shape, short, lie, difficulty: 'normal', turf, zoom, ...(putt ? {puttRange: puttRange(c, turf, range)} : {})};
  let share;
  if (putt) { const f = lieFactor(lie);share = Math.min(1, range / (ctx.puttRange * f * f)); }
  else {
   const t = targetShare({...ctx, metres: range, rise: hole.height(target.x, target.z) - hole.height(from.x, from.z), bearing: aim * Math.PI / 180,
    wind: wind(hole), altitude: hole.bio?.altitude ?? 0, temperature: hole.bio?.temperature});
   share = t ? Math.min(1, t.share / zoom) : 1;
  }
  // The taps: the distance where the marker sits, then the strike, each a little off.
  const sw = startSwing(0, {difficulty: 'normal', club: c, putt, accuracy: !putt, zoom: putt ? ctx.puttRange / puttFullRoll(c, turf) : zoom});
  // The strike comes as the marker runs back from where the distance was set,
  // so a part swing is struck sooner: its share of a bar after the first tap.
  const power = Math.max(.02, share * (1 + stray())), at = sw.rise * (RUN_UP + power);
  tap(sw, at);
  if (!putt) tap(sw, at + sw.rise * (power + stray()));
  const out = swingLaunch(sw, ctx);
  const result = simulateShot({origin: {...from}, aim, ...out.shot}, hole, {wind: wind(hole), altitude: hole.bio?.altitude ?? 0, temperature: hole.bio?.temperature, turf,
   flagsticks: {current: lie !== 'green' && !putt}});
  last = {from: {...from}, end: {x: result.end.x, z: result.end.z}};
  const rest = result.hazard ? null : hole.surface(result.end.x, result.end.z);
  return {result, club: c.kind, facts: ballFacts({origin: from, result, rest, club: c.kind})};
 }
 return {shot, clubs};
}
