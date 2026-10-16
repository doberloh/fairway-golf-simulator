// A CHALLENGE BEING PLAYED (16 October 2026): whose turn it is, which ball,
// what each ball scored, when it is over, and the results -- a small state
// machine with no DOM and no three.js, so tests/challenge-matrix.test.mjs can
// play every challenge with every group in Node. main.js hands it what a ball
// did (`facts`, below) and does what it says: put the next ball down, show
// the bar, open the results card.
//
// THE ORDERS (challenges.js, a row's `order`):
//   turns    golfer 1's first ball, golfer 2's first ball, ... until each has
//            played them all. A golfer's k-th ball is played from the k-th
//            spot (or the tee, or the mat) at the k-th target, with the k-th
//            call.
//   streak   the same, but a golfer is out at their first ball that scores
//            nothing.
//   spotOut  a golfer plays the spot out to the hole, then the next golfer the
//            same spot, then the next spot (up and down). Water or out of
//            bounds is two strokes and the same spot again; after
//            UPDOWN_GIVE_UP strokes the spot is picked up.
//
// WHAT A BALL DID (`facts`, local hole metres; main.js builds it from the
// flight): origin, end, landing ({x, z}), rest (the surface it stopped on, or
// null), hazard ('Water', 'Out of bounds' or null), holed, carry and apex
// (metres), curve (metres the ball finished right of the line it started on;
// negative is left), club (the kind it was hit with).

import {challenge, UPDOWN_GIVE_UP, HAZARD_FEET, isUpAndDown, medalOf, scoreText} from './challenges.js';

const FOOT = .3048, YARD = .9144;
const dist = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;

// WHAT A BALL DID, from a flight (physics.js `simulateShot`'s result): where it
// first came down (the first point at or after its hang time), and how far it
// curved -- where it landed against the line of its first five metres, right
// positive (the range's `offlineOf` convention). `rest` is the surface it
// stopped on; `club` the kind it was hit with.
export function ballFacts({origin, result, rest = null, club = null}) {
 const pts = result.points || [], o = origin;
 const early = pts.find(p => Math.hypot(p.x - o.x, p.z - o.z) > 5);
 const land = (result.hang != null && pts.find(p => p.t >= result.hang)) || result.end;
 let curve = 0;
 if (early) { const b = Math.atan2(early.x - o.x, early.z - o.z), dx = land.x - o.x, dz = land.z - o.z; curve = dz * Math.sin(b) - dx * Math.cos(b); }
 return {origin: {x: o.x, z: o.z}, end: {x: result.end.x, z: result.end.z}, landing: {x: land.x, z: land.z}, rest: result.hazard ? null : rest,
  hazard: result.hazard || null, holed: !!result.holed, carry: result.carry || 0, apex: result.apex || 0, curve, club};
}

// A new play. `seats` golfers; `spots` the shared places balls are played from
// (empty: the tee or the mat); `targets` the range targets ({x, z, yards});
// `calls` (challenge-spots.js `callsFor`); `ctx` per golfer: {driver (yards),
// hand ('RH' or 'LH'), zone ({x, z}, Find the zone)}; `pin` the hole's;
// `length` the hole's, in yards.
export function newPlay(id, {seats = 1, spots = [], targets = [], calls = [], ctx = [], pin = null, length = 0} = {}) {
 const def = challenge(id);
 if (!def) throw Error(`No challenge called ${id}.`);
 if (!(seats >= 1 && seats <= 4)) throw Error('A challenge is for one to four golfers.');
 const balls = def.order === 'spotOut' ? Math.min(def.balls, spots.length) : def.balls;
 return {id, seats, balls, spots, targets, calls, ctx: Array.from({length: seats}, (_, i) => ctx[i] || {}), pin, length,
  results: Array.from({length: seats}, () => []), out: Array(seats).fill(false), active: 0, spot: 0, strokes: 0, done: balls < 1};
}
const finishedSeat = (st, s) => st.out[s] || st.results[s].length >= st.balls;

// The ball about to be played: whose, which, from where, at what.
export function turn(st) {
 const def = challenge(st.id), seat = st.active;
 const k = def.order === 'spotOut' ? st.spot : st.results[seat].length;
 const spot = st.spots.length ? st.spots[k % st.spots.length] : null;
 return {seat, k, spot, target: st.targets[k] || null, call: st.calls[k] ?? null, zone: st.ctx[seat]?.zone || null, strokes: st.strokes};
}

// What one ball scores, by the row's `ball`. `t` is the turn it was played on.
export function scoreBall(def, f, t, st) {
 const pin = st.pin, ft = pin ? dist(f.end, pin) / FOOT : Infinity;
 const landed = t.target ? dist(f.landing, t.target) / YARD : Infinity;
 const fairway = !f.hazard && f.rest === 'fairway', green = !f.hazard && f.rest === 'green';
 const wrongClub = def.club && f.club && f.club !== def.club;
 // The way the golfer calls a draw: right to left for a right-hander.
 const drawSign = (st.ctx[t.seat]?.hand === 'LH') ? 1 : -1;
 const curvedAsCalled = minYards => {
  const c = (f.curve || 0) / YARD, way = t.call === 'draw' ? drawSign : -drawSign;
  return c * way >= minYards;
 };
 switch (def.ball) {
  case 'driveFairway': return fairway ? dist(f.origin, f.end) / YARD : null;
  case 'driveInPlay': return !f.hazard && (f.rest === 'fairway' || f.rest === 'semi') ? dist(f.origin, f.end) / YARD : 0;
  case 'fairway': return fairway ? 1 : 0;
  case 'shapeFairway': return fairway && curvedAsCalled(5) ? 1 : 0;
  case 'zone': return !f.hazard && t.zone && dist(f.end, t.zone) <= 15 * YARD ? 3 : fairway ? 1 : 0;
  case 'pinFeet': return f.hazard ? null : f.holed ? 0 : ft;
  case 'feetLeft': return f.hazard ? HAZARD_FEET : f.holed ? 0 : Math.min(HAZARD_FEET, ft);
  case 'acePoints': return f.hazard ? 0 : f.holed ? 25 : ft <= 3 ? 5 : ft <= 10 ? 2 : green ? 1 : 0;
  case 'chipPoints': return f.hazard ? 0 : f.holed ? 5 : ft <= 3 ? 2 : ft <= 6 ? 1 : 0;
  case 'ringShare': {
   if (f.hazard) return 0;
   const from = dist(t.spot || f.origin, pin), miss = dist(f.end, pin);
   return f.holed || miss <= def.rings[0] * from ? 3 : miss <= def.rings[1] * from ? 2 : green ? 1 : 0;
  }
  case 'onGreen': return green ? 1 : 0;
  case 'holdGreen': return green && dist(f.landing, f.end) <= 5 * YARD ? 1 : 0;
  case 'dart': return wrongClub ? 0 : landed <= 3 ? 10 : landed <= 6 ? 5 : landed <= 9 / YARD ? 3 : landed <= 15 ? 1 : 0;
  case 'clock': {
   if (wrongClub || !t.target) return 0;
   const share = landed / t.target.yards;
   return share <= .02 ? 10 : share <= .04 ? 5 : share <= .06 ? 3 : share <= .1 ? 1 : 0;
  }
  case 'carryMiss': return Math.abs((f.carry || 0) / YARD - (t.call || 0));
  case 'height': {
   if (wrongClub || landed > 15 || !(f.carry > 0)) return 0;
   const r = (f.apex || 0) / f.carry;
   return (t.call === 'high' ? r >= HIGH_SHARE : r <= LOW_SHARE) ? 1 : 0;
  }
  case 'curveTarget': return !wrongClub && landed <= 15 && curvedAsCalled(4) ? 1 : 0;
  case 'holed': return f.holed ? 1 : 0;
  case 'holedFeet': return f.holed ? Math.round(dist(t.spot, pin) / FOOT) : 0;
  default: throw Error(`No ball scoring called ${def.ball}.`);
 }
}
// HIGH AND LOW: how high a ball peaks as a share of its carry. Through the
// ball model a stock 7-iron off the Swing Meter peaks at 0.206 of its carry,
// 0.237 with High and 0.164 with Low (measured 16 October 2026); the lines sit
// halfway between, so a normal flight is neither and both calls can be made.
// PLACED; tests/challenge-play.test.mjs flies all three to keep it so.
export const HIGH_SHARE = .222, LOW_SHARE = .185;

// PLAY ONE BALL. Returns what happened: `value` (what the ball scored, when it
// finished a ball), `again` (the same golfer plays on, from `from`), `text`
// (one line for the toast), `done` (the play is over).
export function playBall(st, f) {
 if (st.done) throw Error('That challenge is over.');
 const def = challenge(st.id), t = turn(st), seat = t.seat;
 if (def.order === 'spotOut') {
  if (f.hazard) { st.strokes += 2; return {again: true, from: t.spot, text: `${f.hazard}: two strokes, and play it again from the drop.`}; }
  st.strokes++;
  if (!f.holed && st.strokes < UPDOWN_GIVE_UP) return {again: true, from: f.end, text: ''};
  const n = f.holed ? st.strokes : UPDOWN_GIVE_UP;
  st.results[seat].push(n);st.strokes = 0;
  if (seat < st.seats - 1) st.active = seat + 1;
  else { st.active = 0;st.spot++; }
  st.done = st.spot >= st.balls;
  return {value: n, done: st.done, text: f.holed ? (isUpAndDown(n) ? `Up and down in ${n}.` : `Down in ${n}.`) : `Picked up: that one counts as ${UPDOWN_GIVE_UP}.`};
 }
 const value = scoreBall(def, f, t, st);
 st.results[seat].push(value);
 if (def.order === 'streak' && !value) st.out[seat] = true;
 st.done = st.results.every((_, s) => finishedSeat(st, s));
 if (!st.done) for (let i = 1; i <= st.seats; i++) { const s = (seat + i) % st.seats; if (!finishedSeat(st, s)) { st.active = s; break; } }
 return {value, done: st.done, text: ballText(def, value, f)};
}
function ballText(def, v, f) {
 if (def.club && f.club && f.club !== def.club) return 'Wrong club: that ball scores nothing.';
 if (def.ball === 'driveFairway') return v == null ? 'Off the fairway: it does not count.' : `${Math.round(v)} yards, in play.`;
 if (def.ball === 'pinFeet') return v == null ? `${f.hazard}: no score for that ball.` : v === 0 ? 'In the hole!' : `${Math.round(v * 10) / 10} ft from the pin.`;
 if (def.ball === 'feetLeft') return f.hazard ? `${f.hazard}: that counts as ${HAZARD_FEET} feet.` : v === 0 ? 'In the hole!' : `${Math.round(v * 10) / 10} ft left.`;
 if (def.ball === 'carryMiss') return `${Math.round(v)} yards off the number.`;
 if (def.ball === 'driveInPlay') return v ? `${Math.round(v)} yards, in play.` : 'Out of play: nothing for that one.';
 if (def.show === 'points') return `${v} point${v === 1 ? '' : 's'}.`;
 if (def.ball === 'holedFeet') return v ? `Holed from ${v} feet.` : 'Missed.';
 return v ? 'That counts.' : 'That one does not count.';
}

// A golfer's SCORE so far, by the row's `play`.
export function scoreOf(def, balls) {
 const ok = balls.filter(v => v != null);
 if (def.play === 'updown') return {made: balls.filter(isUpAndDown).length, strokes: balls.reduce((a, b) => a + b, 0)};
 if (def.play === 'max') return ok.length ? Math.max(...ok) : null;
 if (def.play === 'min') return ok.length ? Math.min(...ok) : null;
 if (def.play === 'sum') return balls.length ? ok.reduce((a, b) => a + b, 0) : null;
 if (def.play === 'mean') return balls.length ? ok.reduce((a, b) => a + b, 0) / balls.length : null;
 throw Error(`No play scoring called ${def.play}.`);
}
// THE RESULTS: each golfer's score, its text and medal, best first.
export function results(st) {
 const def = challenge(st.id);
 const rows = st.results.map((balls, seat) => {
  const score = scoreOf(def, balls), ctx = {driver: st.ctx[seat]?.driver ?? 250, length: st.length};
  return {seat, balls, score, text: scoreText(def, score), medal: medalOf(def, score, ctx)};
 });
 const cmp = (a, b) => {
  if (a.score == null || b.score == null) return (a.score == null) - (b.score == null);
  if (def.play === 'updown') return b.score.made - a.score.made || a.score.strokes - b.score.strokes;
  return def.better === 'low' ? a.score - b.score : b.score - a.score;
 };
 return [...rows].sort((a, b) => cmp(a, b) || a.seat - b.seat);
}
// The bar's line: which ball, and the score so far.
export function progressText(st) {
 const def = challenge(st.id), t = turn(st), r = st.results[t.seat];
 if (st.done) return 'Finished';
 const which = def.order === 'spotOut' ? `Drop ${Math.min(st.spot + 1, st.balls)} of ${st.balls}${st.strokes ? ` · ${st.strokes} played` : ''}`
  : def.order === 'streak' ? `Ball ${r.length + 1}` : `Ball ${Math.min(r.length + 1, st.balls)} of ${st.balls}`;
 const call = t.call == null ? '' : typeof t.call === 'number' ? ` · carry ${t.call} yd` : ` · ${t.call}`;
 return `${which}${call}${r.length ? ` · ${scoreText(def, scoreOf(def, r))}` : ''}`;
}
