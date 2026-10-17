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
import {turfConfig} from '../src/turf.js';
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
 const rnd = seeded(seed), clubs = bagClubs(bag), turf = turfConfig(settings.turf), wind = h => localWind(settings, h.rotation || 0);
 // A roughly normal stray, from two draws.
 const stray = () => (rnd() + rnd() - 1) * skill * 1.7;
 const list = Object.entries(clubs).filter(([id]) => id !== 'putter');
 const nearest = metres => list.sort((a, b) => Math.abs(a[1].carry - metres / YARD) - Math.abs(b[1].carry - metres / YARD))[0][0];
 // ONE SHOT. `hole` is a generated hole (or the range's), `from` where the
 // ball lies, `aimAt` what the challenge aims at (null: the pin, or the
 // fairway from a tee as the game's turn would), `call` a draw/fade/high/low,
 // `club` a kind the challenge insists on, `onRange` off the mat.
 function shot({hole, from, aimAt = null, call = null, club: wantKind = null, onRange = false, spin = 0}) {
  const lie = onRange ? 'tee' : hole.surface(from.x, from.z), pin = hole.pin, toPin = Math.hypot(pin.x - from.x, pin.z - from.z);
  // The club: the putter on the green; the challenge's; else for the distance (setUpTurn, challengeClub).
  let id = lie === 'green' ? 'putter' : nearest(aimAt ? Math.hypot(aimAt.x - from.x, aimAt.z - from.z) : toPin);
  if (wantKind && lie !== 'green') id = list.find(([, c]) => c.kind === wantKind)?.[0] || id;
  const c = clubs[id], putt = c.code === 'PT';
  // The aim (defaultAim): the challenge's target, the pin with the putter, the
  // fairway at the club's carry -- and a chip landed short so it runs to the hole.
  let target = aimAt || (putt ? pin : fairwayAim(hole, from, c.carry * YARD));
  if (!aimAt && !putt && shortGame(c, toPin / YARD) && toPin > 3 * CHIP_ROLL) { const k = (toPin - CHIP_ROLL) / toPin;target = {x: from.x + (pin.x - from.x) * k, z: from.z + (pin.z - from.z) * k}; }
  const aim = Math.atan2(target.x - from.x, target.z - from.z) * 180 / Math.PI;
  const range = putt ? Math.max(.1, toPin) : Math.hypot(target.x - from.x, target.z - from.z);
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
  const rest = result.hazard ? null : hole.surface(result.end.x, result.end.z);
  return {result, club: c.kind, facts: ballFacts({origin: from, result, rest, club: c.kind})};
 }
 return {shot, clubs};
}
