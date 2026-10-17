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
//   knockout every golfer still in plays one ball a round; then anyone whose
//            ball scored nothing (off the green, off the fairway) is out --
//            unless everyone's did -- and otherwise the one worst ball alone
//            (a tie for last keeps them all). Until one is left, or `balls`
//            rounds, when the best ball of the last round wins.
//   holes    Bingo Bango Bongo: each hole played out from the tee, the
//            golfer farthest from the hole first. A point for the first ball
//            on the green (bingo), the nearest to the pin once every ball is
//            on (bango) and the first in (bongo). Water or out of bounds is
//            two strokes from where it was played; a ball is picked up after
//            HOLES_GIVE_UP strokes.
//
// A spot may carry `hole` -- the challenges that go from hole to hole (Every
// par 3, Greens in regulation, Scrambler, Putting tour, Bingo Bango Bongo) --
// and then its pin is `pins[hole]` and its length `lengths[hole]`; main.js
// changes hole when the turn's does.
//
// WHAT A BALL DID (`facts`, local hole metres; main.js builds it from the
// flight): origin, end, landing ({x, z}), rest (the surface it stopped on, or
// null), hazard ('Water', 'Out of bounds' or null), holed, carry and apex
// (metres), curve (metres the ball finished right of the line it started on;
// negative is left), club (the kind it was hit with).

import {challenge, UPDOWN_GIVE_UP, HAZARD_FEET, isUpAndDown, medalOf, scoreText} from './challenges.js';

// Bingo Bango Bongo picks a ball up after this many strokes on a hole, and a
// ball in a hazard scores this share of the hole's length in Every par 3. PLACED.
export const HOLES_GIVE_UP = 10, HAZARD_SHARE = .2;

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
// `length` the hole's, in yards; `pins` and `lengths` by hole, for a
// challenge across holes.
export function newPlay(id, {seats = 1, spots = [], targets = [], calls = [], ctx = [], pin = null, length = 0, pins = [], lengths = []} = {}) {
 const def = challenge(id);
 if (!def) throw Error(`No challenge called ${id}.`);
 if (def.where === 'round') throw Error(`${def.name} is a round, not a play.`);
 if (!(seats >= 1 && seats <= 4)) throw Error('A challenge is for one to four golfers.');
 if (def.who === 'group' && seats < 2) throw Error(`${def.name} is for two to four golfers.`);
 const balls = def.order === 'spotOut' || def.order === 'holes' || !def.balls ? Math.min(def.balls || spots.length, spots.length) : def.balls;
 const st = {id, seats, balls, spots, targets, calls, ctx: Array.from({length: seats}, (_, i) => ctx[i] || {}), pin, length, pins, lengths,
  results: Array.from({length: seats}, () => []), out: Array(seats).fill(false), active: 0, spot: 0, strokes: 0, done: balls < 1};
 if (def.order === 'knockout') Object.assign(st, {round: 0, vals: {}, last: {}, outRound: Array(seats).fill(0), winners: []});
 if (def.order === 'holes') { Object.assign(st, {h: 0, winners: []});beginHole(st); }
 return st;
}
function beginHole(st) {
 Object.assign(st, {pos: Array(st.seats).fill(null), hs: Array(st.seats).fill(0), on: Array(st.seats).fill(false), holed: Array(st.seats).fill(false), up: Array(st.seats).fill(false), bingo: null, bango: null, bongo: null});
}
const pinOf = (st, hole) => (hole != null && st.pins?.[hole]) || st.pin;
// Bingo Bango Bongo: the golfer farthest from the hole, among those still
// playing it; a ball on the tee is as far as the tee.
function away(st) {
 const tee = st.spots[st.h], pin = pinOf(st, tee?.hole);
 let best = -1, far = -1;
 for (let s = 0; s < st.seats; s++) { if (st.holed[s] || st.up[s]) continue; const d = dist(st.pos[s] || tee, pin); if (d > far + 1e-9) { far = d;best = s; } }
 return best;
}
const finishedSeat = (st, s) => st.out[s] || st.results[s].length >= st.balls;

// The ball about to be played: whose, which, from where, at what, on which
// hole (null: the play's one hole) and that hole's pin.
export function turn(st) {
 const def = challenge(st.id), seat = st.active;
 if (def.order === 'holes') {
  const tee = st.spots[Math.min(st.h, st.spots.length - 1)], spot = st.pos[seat] || tee;
  return {seat, k: st.h, spot: {x: spot.x, z: spot.z, hole: tee.hole}, hole: tee.hole, pin: pinOf(st, tee.hole), target: null, call: null, zone: null, strokes: st.hs[seat]};
 }
 const k = def.order === 'spotOut' ? st.spot : def.order === 'knockout' ? st.round : st.results[seat].length;
 const spot = def.order === 'knockout' ? null : st.spots.length ? st.spots[k % st.spots.length] : null, hole = spot?.hole ?? null;
 return {seat, k, spot, hole, pin: pinOf(st, hole), target: st.targets[k] || null, call: st.calls[k] ?? null, zone: st.ctx[seat]?.zone || null, strokes: st.strokes};
}

// What one ball scores, by the row's `ball`. `t` is the turn it was played on.
export function scoreBall(def, f, t, st) {
 const pin = t.pin || st.pin, ft = pin ? dist(f.end, pin) / FOOT : Infinity;
 const landed = t.target ? dist(f.landing, t.target) / YARD : Infinity;
 const fairway = !f.hazard && f.rest === 'fairway', green = !f.hazard && f.rest === 'green';
 // The club asked of this golfer: the row's, or the nearest their bag holds.
 const asked = st.ctx[t.seat]?.club || def.club, wrongClub = def.club && f.club && f.club !== asked;
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
  case 'greenFeet': return f.hazard ? null : f.holed ? 0 : green ? ft : null;
  case 'pinShare': { const len = (st.lengths?.[t.hole] || st.length || 160) * 3; return f.hazard ? HAZARD_SHARE : f.holed ? 0 : Math.min(1, ft / len); }
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
 if (def.order === 'knockout') return knockoutBall(st, def, f, t);
 if (def.order === 'holes') return holesBall(st, f, t);
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
 return {value, done: st.done, text: ballText(def, value, f, st.ctx[seat]?.club || def.club)};
}
// KNOCKOUT: a ball each, in seat order, among those still in; then the round
// is judged.
function knockoutBall(st, def, f, t) {
 const seat = t.seat, value = scoreBall(def, f, t, st);
 st.results[seat].push(value);st.vals[seat] = value;
 const alive = [...Array(st.seats).keys()].filter(s => !st.out[s]);
 const next = alive.find(s => s > seat && !(s in st.vals)) ?? alive.find(s => !(s in st.vals));
 if (next != null) { st.active = next;return {value, done: false, text: ballText(def, value, f)}; }
 const missed = alive.filter(s => st.vals[s] == null), scored = alive.filter(s => st.vals[s] != null);
 let outs = [];
 if (missed.length && scored.length) outs = missed;
 else if (scored.length > 1) {
  const worst = def.better === 'low' ? Math.max(...scored.map(s => st.vals[s])) : Math.min(...scored.map(s => st.vals[s]));
  const last = scored.filter(s => st.vals[s] === worst);
  if (last.length === 1) outs = last;
 }
 st.round++;
 for (const s of outs) { st.out[s] = true;st.outRound[s] = st.round; }
 st.last = st.vals;st.vals = {};
 const left = alive.filter(s => !st.out[s]);
 st.done = left.length <= 1 || st.round >= st.balls;
 if (st.done) {
  if (left.length === 1) st.winners = left;
  else { const ok = left.filter(s => st.last[s] != null), best = ok.length ? (def.better === 'low' ? Math.min : Math.max)(...ok.map(s => st.last[s])) : null; st.winners = best == null ? left : ok.filter(s => st.last[s] === best); }
 } else st.active = left[0];
 return {value, done: st.done, round: st.round, outs, text: ballText(def, value, f)};
}
// BINGO BANGO BONGO: one stroke at a time, the farthest first.
function holesBall(st, f, t) {
 const seat = t.seat, pin = t.pin;
 let text = '';
 if (f.hazard) { st.hs[seat] += 2;text = `${f.hazard}: two strokes, and play it again.`; }
 else {
  st.hs[seat]++;st.pos[seat] = {x: f.end.x, z: f.end.z};
  const on = f.holed || f.rest === 'green';
  if (on) st.on[seat] = true;
  if (on && st.bingo == null) { st.bingo = seat;text = 'Bingo: first on the green.'; }
  if (f.holed) { st.holed[seat] = true;if (st.bongo == null) { st.bongo = seat;text = 'Bongo: first in the hole.'; } else text = 'In the hole.'; }
 }
 if (!st.holed[seat] && st.hs[seat] >= HOLES_GIVE_UP) { st.up[seat] = true;text = `Picked up after ${HOLES_GIVE_UP}.`; }
 // Bango: the nearest the moment every ball still playing is on the green.
 const playing = [...Array(st.seats).keys()].filter(s => !st.up[s]);
 if (st.bango == null && playing.length && playing.every(s => st.on[s] || st.holed[s])) {
  let near = Infinity;
  for (const s of playing) { const d = st.holed[s] ? 0 : dist(st.pos[s], pin); if (d < near - 1e-9) { near = d;st.bango = s; } }
 }
 if ([...Array(st.seats).keys()].every(s => st.holed[s] || st.up[s])) {
  for (let s = 0; s < st.seats; s++) st.results[s].push((st.bingo === s) + (st.bango === s) + (st.bongo === s));
  st.h++;
  st.done = st.h >= st.balls;
  if (st.done) { const pts = st.results.map(r => r.reduce((a, b) => a + b, 0)), top = Math.max(...pts);st.winners = pts.map((p, s) => p === top ? s : -1).filter(s => s >= 0); }
  else beginHole(st);
  text = text || 'Everyone is down.';
 }
 if (!st.done) st.active = away(st);
 return {value: null, done: st.done, text};
}
function ballText(def, v, f, asked = def.club) {
 if (def.club && f.club && f.club !== asked) return 'Wrong club: that ball scores nothing.';
 if (def.ball === 'driveFairway') return v == null ? 'Off the fairway: it does not count.' : `${Math.round(v)} yards, in play.`;
 if (def.ball === 'pinFeet') return v == null ? `${f.hazard}: no score for that ball.` : v === 0 ? 'In the hole!' : `${Math.round(v * 10) / 10} ft from the pin.`;
 if (def.ball === 'greenFeet') return v == null ? 'Off the green.' : v === 0 ? 'In the hole!' : `${Math.round(v * 10) / 10} ft from the pin.`;
 if (def.ball === 'pinShare') return f.hazard ? `${f.hazard}: that counts as a fifth of the hole.` : v === 0 ? 'In the hole!' : `${Math.round(v * 1000) / 10}% of the hole's length from the pin.`;
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
 if (def.play === 'points') return balls.reduce((a, b) => a + (b || 0), 0);
 throw Error(`No play scoring called ${def.play}.`);
}
// THE RESULTS: each golfer's score, its text and medal, best first.
export function results(st) {
 const def = challenge(st.id);
 if (def.group === 'versus') {
  const rows = st.results.map((balls, seat) => {
   const won = st.winners.includes(seat), points = def.play === 'points' ? scoreOf(def, balls) : null;
   const text = def.play === 'points' ? `${points} point${points === 1 ? '' : 's'}${won ? (st.winners.length > 1 ? ' · shared the win' : ' · won') : ''}`
    : won ? (st.winners.length > 1 ? `Shared the win after ${st.round} rounds` : 'Won') : `Out in round ${st.outRound[seat]}`;
   return {seat, balls, score: {won, points, rounds: st.out[seat] ? st.outRound[seat] : st.round + 1, text}, text, medal: 0};
  });
  const rank = r => (r.score.won ? 1e6 : 0) + (r.score.points ?? 0) * 100 + r.score.rounds;
  return [...rows].sort((a, b) => rank(b) - rank(a) || a.seat - b.seat);
 }
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
 if (def.order === 'knockout') return `Round ${st.round + 1} · ${st.out.filter(o => !o).length} left`;
 if (def.order === 'holes') { const pts = st.results.map(r => r.reduce((a, b) => a + b, 0)); return `Hole ${st.h + 1} of ${st.balls}${t.strokes ? ` · ${t.strokes} played` : ''} · points ${pts.join('-')}`; }
 const which = def.order === 'spotOut' ? `Drop ${Math.min(st.spot + 1, st.balls)} of ${st.balls}${st.strokes ? ` · ${st.strokes} played` : ''}`
  : def.order === 'streak' ? `Ball ${r.length + 1}` : `Ball ${Math.min(r.length + 1, st.balls)} of ${st.balls}`;
 const call = t.call == null ? '' : typeof t.call === 'number' ? ` · carry ${t.call} yd` : ` · ${t.call}`;
 return `${which}${call}${r.length ? ` · ${scoreText(def, scoreOf(def, r))}` : ''}`;
}
