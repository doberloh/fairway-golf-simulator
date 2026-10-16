// EVERY CHALLENGE WITH EVERY GROUP, like the round matrix: the owner cannot
// play 27 challenges with four golfers quickly, so this does. A seeded
// made-up golfer plays each ball -- some near the pin, some on the fairway,
// some in water, some holed -- and a referee written separately from
// challenge-play.js follows the play: whose turn it is after every ball, when
// a golfer is out, when the play ends, and each golfer's score at the end.
// What a single ball scores is pinned by hand in challenge-play.test.mjs; this
// checks everything built on top of it. Then the pay over many plays.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES, UPDOWN_GIVE_UP, medalOf, isUpAndDown} from '../src/challenges.js';
import {newPlay, turn, playBall, scoreBall, results} from '../src/challenge-play.js';
import {callsFor, seeded} from '../src/challenge-spots.js';
import {challengePay, CHALLENGE_PAY} from '../src/progression.js';

const YARD = .9144, FOOT = .3048, pin = {x: 0, z: 150};
const SURFACES = ['fairway', 'fairway', 'semi', 'rough', 'green', 'fringe', 'sand'];

// The made-up golfer: anything can happen, seeded so a failure replays.
function golfer(rnd) {
 return (t, st) => {
  const r = rnd(), from = t.spot || {x: 0, z: 0}, aimAt = t.target || pin;
  const miss = (r < .15 ? 0 : r * r * 40) * FOOT * (st.id === 'fourft' || st.id === 'world' ? .2 : 1), a = rnd() * Math.PI * 2;
  const end = {x: aimAt.x + Math.sin(a) * miss, z: aimAt.z + Math.cos(a) * miss};
  const hazard = rnd() < .06 ? (rnd() < .5 ? 'Water' : 'Out of bounds') : null;
  const holed = !hazard && rnd() < (t.strokes ? .45 : .12);
  const carry = (60 + rnd() * 200) * YARD;
  return {origin: from, end: holed ? {...pin} : end, landing: {x: end.x + (rnd() - .5) * 6, z: end.z - rnd() * 10}, rest: hazard ? null : SURFACES[Math.floor(rnd() * SURFACES.length)],
   hazard, holed, carry, apex: carry * (.14 + rnd() * .12), curve: (rnd() - .5) * 20 * YARD, club: rnd() < .8 ? CHALLENGE_CLUB[st.id] ?? 'iron7' : 'wedge'};
 };
}
const CHALLENGE_CLUB = Object.fromEntries(CHALLENGES.filter(c => c.club).map(c => [c.id, c.club]));

// The places a play needs, made up for a flat test hole.
function setup(def, seats, seed) {
 const spots = def.spot ? Array.from({length: def.balls}, (_, k) => ({x: Math.sin(k) * 20, z: pin.z - 20 - k})) : [];
 const targets = def.targets ? def.targets.map(y => ({x: 0, z: y * YARD, yards: y})) : [];
 const ctx = Array.from({length: seats}, (_, i) => ({driver: 200 + 20 * i, hand: i % 2 ? 'LH' : 'RH', zone: {x: 0, z: 190}}));
 return {seats, spots, targets, calls: callsFor(def, seed, {driver: 230}), ctx, pin, length: 160};
}

// THE REFEREE: replays the same balls with its own idea of turns, then works
// out every golfer's score from the balls it saw.
function referee(def, opts, balls) {
 const n = opts.seats, own = Array.from({length: n}, () => []), out = Array(n).fill(false), seen = [];
 let i = 0;
 if (def.order === 'spotOut') {
  for (let s = 0; s < Math.min(def.balls, opts.spots.length); s++) for (let g = 0; g < n; g++) {
   let strokes = 0;
   for (;;) { const b = balls[i++];seen.push(g); if (b.hazard) { strokes += 2;continue; } strokes++; if (b.holed || strokes >= UPDOWN_GIVE_UP) { own[g].push(b.holed ? strokes : UPDOWN_GIVE_UP);break; } }
  }
 } else {
  let g = 0;
  const finished = s => out[s] || own[s].length >= def.balls;
  while (!own.every((_, s) => finished(s))) {
   const b = balls[i++];seen.push(g);
   own[g].push(b.value);
   if (def.order === 'streak' && !b.value) out[g] = true;
   for (let k = 1; k <= n; k++) { const s = (g + k) % n; if (!finished(s)) { g = s;break; } }
  }
 }
 const scores = own.map(v => {
  const ok = v.filter(x => x != null);
  if (def.play === 'updown') return {made: v.filter(x => x <= 2).length, strokes: v.reduce((a, b) => a + b, 0)};
  if (def.play === 'max') return ok.length ? Math.max(...ok) : null;
  if (def.play === 'min') return ok.length ? Math.min(...ok) : null;
  if (def.play === 'sum') return ok.reduce((a, b) => a + b, 0);
  return ok.reduce((a, b) => a + b, 0) / v.length;
 });
 return {seen, scores, used: i};
}

test('every challenge, every group of one to four, played to the end', () => {
 let plays = 0, shots = 0;
 for (const def of CHALLENGES) for (let seats = 1; seats <= 4; seats++) for (let rep = 0; rep < 6; rep++) {
  const seed = `${def.id}:${seats}:${rep}`, rnd = seeded(seed), opts = setup(def, seats, seed), st = newPlay(def.id, opts), play = golfer(rnd);
  const log = [], tag = `${def.id}, ${seats} golfer(s), seed ${seed}`;
  for (let guard = 0; !st.done; guard++) {
   assert.ok(guard < 2000, `${tag}: never ends`);
   const t = turn(st), f = play(t, st);
   const value = def.order === 'spotOut' ? null : scoreBall(def, f, t, st);
   log.push({...f, value, seat: t.seat});
   const e = playBall(st, f);
   if (def.order !== 'spotOut') assert.deepEqual(e.value, value, `${tag}: the ball's value`);
   if (e.again) assert.equal(turn(st).seat, t.seat, `${tag}: the same golfer plays on`);
   shots++;
  }
  const ref = referee(def, opts, log);
  assert.equal(ref.used, log.length, `${tag}: the play ended when the referee says`);
  assert.deepEqual(log.map(b => b.seat), ref.seen, `${tag}: whose turn it was`);
  const res = results(st);
  assert.equal(res.length, seats);
  for (const r of res) {
   const want = ref.scores[r.seat];
   if (typeof want === 'number') assert.ok(Math.abs(r.score - want) < 1e-9, `${tag}: golfer ${r.seat} scored ${r.score}, the referee ${want}`);
   else assert.deepEqual(r.score, want, `${tag}: golfer ${r.seat}`);
   assert.equal(r.medal, medalOf(def, want, {driver: opts.ctx[r.seat].driver, length: 160}), `${tag}: golfer ${r.seat}'s medal`);
  }
  // Best first.
  for (let k = 1; k < res.length; k++) {
   const a = res[k - 1].score, b = res[k].score;
   if (a == null || b == null) { assert.ok(b == null || a != null, `${tag}: no score sorts last`);continue; }
   if (def.play === 'updown') assert.ok(a.made > b.made || (a.made === b.made && a.strokes <= b.strokes), tag);
   else assert.ok(def.better === 'low' ? a <= b : a >= b, `${tag}: ranked`);
  }
  if (def.order === 'turns') for (let s = 0; s < seats; s++) assert.equal(st.results[s].length, def.balls, `${tag}: everyone plays every ball`);
  plays++;
 }
 assert.equal(plays, CHALLENGES.length * 4 * 6);
 assert.ok(shots > 5000, `${shots} balls`);
});

// THE PAY OVER MANY PLAYS: a golfer who plays all evening earns each first
// medal once, never more than the day's allowance from repeats, and a new best
// once a challenge a day -- whatever order things come in. (Six hundred plays
// twenty seconds apart, all before midnight.)
test('a whole evening of challenges cannot be farmed', () => {
 const rnd = seeded('evening');
 for (const mult of [.75, 1, 1.5]) {
  const p = {};let firsts = 0, bests = 0, other = 0;
  const day = new Date(2026, 9, 16, 18).getTime(), firstSeen = {};
  for (let i = 0; i < 600; i++) {
   const def = CHALLENGES[Math.floor(rnd() * CHALLENGES.length)], medal = Math.floor(rnd() * 4), best = rnd() < .3;
   const before = p.medals?.[def.id] || 0;
   const r = challengePay(p, {id: def.id, medal, best, mult}, day + i * 20000);
   for (const part of r.parts) {
    if (part.label.startsWith('First')) firsts += part.xp;
    else if (part.label === 'New best') bests += part.xp;
    else other += part.xp;
   }
   assert.equal(p.medals?.[def.id] || 0, Math.max(before, medal), 'a medal only ever goes up');
   if (medal) firstSeen[def.id] = Math.max(firstSeen[def.id] || 0, medal);
  }
  const owed = Object.values(firstSeen).reduce((a, m) => a + [0, 25, 75, 175][m] * mult, 0);
  assert.ok(Math.abs(firsts - owed) <= Object.keys(firstSeen).length * 3, `first medals paid ${firsts}, owed about ${owed}`);
  assert.ok(other <= CHALLENGE_PAY.dayCap, `repeat pay ${other} is inside the day's ${CHALLENGE_PAY.dayCap}`);
  assert.ok(bests <= CHALLENGES.length * Math.round(CHALLENGE_PAY.best * mult), 'a new best at most once a challenge');
 }
});
