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
import {newPlay, turn, playBall, scoreBall, results, HOLES_GIVE_UP} from '../src/challenge-play.js';
import {callsFor, seeded} from '../src/challenge-spots.js';
import {challengePay, CHALLENGE_PAY} from '../src/progression.js';

const YARD = .9144, FOOT = .3048, pin = {x: 0, z: 150};
const SURFACES = ['fairway', 'fairway', 'semi', 'rough', 'green', 'fringe', 'sand'];

// The made-up golfer: anything can happen, seeded so a failure replays.
function golfer(rnd) {
 return (t, st) => {
  const r = rnd(), from = t.spot || {x: 0, z: 0}, aimAt = t.target || t.pin || pin;
  const miss = (r < .15 ? 0 : r * r * 40) * FOOT * (st.id === 'fourft' || st.id === 'world' ? .2 : 1), a = rnd() * Math.PI * 2;
  const end = {x: aimAt.x + Math.sin(a) * miss, z: aimAt.z + Math.cos(a) * miss};
  const hazard = rnd() < .06 ? (rnd() < .5 ? 'Water' : 'Out of bounds') : null;
  const holed = !hazard && rnd() < (t.strokes ? .45 : .12);
  const carry = (60 + rnd() * 200) * YARD;
  return {origin: from, end: holed ? {...(t.pin || pin)} : end, landing: {x: end.x + (rnd() - .5) * 6, z: end.z - rnd() * 10}, rest: hazard ? null : SURFACES[Math.floor(rnd() * SURFACES.length)],
   hazard, holed, carry, apex: carry * (.14 + rnd() * .12), curve: (rnd() - .5) * 20 * YARD, club: rnd() < .8 ? CHALLENGE_CLUB[st.id] ?? 'iron7' : 'wedge'};
 };
}
const CHALLENGE_CLUB = Object.fromEntries(CHALLENGES.filter(c => c.club).map(c => [c.id, c.club]));

// The places a play needs, made up for flat test holes: one, or three for a
// challenge across holes (its spots carry their hole; tees for Bingo Bango
// Bongo).
const PINS = [pin, {x: 6, z: 130}, {x: -6, z: 170}], LENGTHS = [160, 140, 185];
function setup(def, seats, seed) {
 const n = def.balls || 4, across = def.hole === 'course';
 const spots = def.order === 'holes' ? PINS.map((_, h) => ({x: 0, z: 0, hole: h}))
  : def.spot ? Array.from({length: n}, (_, k) => ({x: Math.sin(k) * 20, z: (across ? PINS[k % 3] : pin).z - 20 - k, ...(across ? {hole: k % 3} : {})})) : [];
 const targets = def.targets ? def.targets.map(y => ({x: 0, z: y * YARD, yards: y})) : [];
 const ctx = Array.from({length: seats}, (_, i) => ({driver: 200 + 20 * i, hand: i % 2 ? 'LH' : 'RH', zone: {x: 0, z: 190}}));
 return {seats, spots, targets, calls: callsFor(def, seed, {driver: 230}), ctx, pin, length: 160, pins: PINS, lengths: LENGTHS};
}

// THE REFEREE: replays the same balls with its own idea of turns, then works
// out every golfer's score from the balls it saw.
function referee(def, opts, balls) {
 const n = opts.seats, own = Array.from({length: n}, () => []), out = Array(n).fill(false), seen = [];
 let i = 0;
 // A knockout: a ball each among those still in, then the round judged --
 // off the green or fairway is out unless everyone is, else the one worst alone.
 if (def.order === 'knockout') {
  let alive = [...Array(n).keys()], rounds = 0, last = {};
  while (alive.length > 1 && rounds < def.balls) {
   const vals = {};
   for (const g of alive) { const b = balls[i++];seen.push(g);vals[g] = b.value;own[g].push(b.value); }
   const miss = alive.filter(g => vals[g] == null), hit = alive.filter(g => vals[g] != null);
   let gone = [];
   if (miss.length && hit.length) gone = miss;
   else if (hit.length > 1) { const v = hit.map(g => vals[g]), worst = def.better === 'low' ? Math.max(...v) : Math.min(...v), w = hit.filter(g => vals[g] === worst); if (w.length === 1) gone = w; }
   alive = alive.filter(g => !gone.includes(g));rounds++;last = vals;
  }
  let winners = alive;
  if (alive.length > 1) { const ok = alive.filter(g => last[g] != null); if (ok.length) { const v = ok.map(g => last[g]), b = def.better === 'low' ? Math.min(...v) : Math.max(...v); winners = ok.filter(g => last[g] === b); } }
  return {seen, winners, used: i};
 }
 if (def.order === 'spotOut') {
  for (let s = 0; s < Math.min(def.balls, opts.spots.length); s++) for (let g = 0; g < n; g++) {
   let strokes = 0;
   for (;;) { const b = balls[i++];seen.push(g); if (b.hazard) { strokes += 2;continue; } strokes++; if (b.holed || strokes >= UPDOWN_GIVE_UP) { own[g].push(b.holed ? strokes : UPDOWN_GIVE_UP);break; } }
  }
 } else {
  let g = 0;
  // A row with no ball count (Every par 3) plays a ball a spot.
  const finished = s => out[s] || own[s].length >= (def.balls || opts.spots.length);
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
 let want = 0;
 for (const def of CHALLENGES.filter(c => c.where !== 'round')) for (let seats = def.who === 'group' ? 2 : 1; seats <= 4; seats++) for (let rep = 0; rep < 6; rep++) {
  want++;
  const seed = `${def.id}:${seats}:${rep}`, rnd = seeded(seed), opts = setup(def, seats, seed), st = newPlay(def.id, opts), play = golfer(rnd);
  const log = [], tag = `${def.id}, ${seats} golfer(s), seed ${seed}`;
  for (let guard = 0; !st.done; guard++) {
   assert.ok(guard < 2000, `${tag}: never ends`);
   const t = turn(st), f = play(t, st);
   const value = def.order === 'spotOut' || def.order === 'holes' ? null : scoreBall(def, f, t, st);
   log.push({...f, value, seat: t.seat});
   const e = playBall(st, f);
   if (def.order !== 'spotOut' && def.order !== 'holes') assert.deepEqual(e.value, value, `${tag}: the ball's value`);
   if (t.hole != null) assert.deepEqual(t.pin, PINS[t.hole], `${tag}: the pin of hole ${t.hole + 1}`);
   if (e.again) assert.equal(turn(st).seat, t.seat, `${tag}: the same golfer plays on`);
   shots++;
  }
  if (def.order === 'holes') { checkHoles(st, log, tag);plays++;continue; }
  const ref = referee(def, opts, log);
  if (def.order === 'knockout') {
   assert.equal(ref.used, log.length, `${tag}: the knockout ended when the referee says`);
   assert.deepEqual(log.map(b => b.seat), ref.seen, `${tag}: whose turn it was`);
   assert.deepEqual([...st.winners].sort(), [...ref.winners].sort(), `${tag}: who won`);
   const res = results(st);
   assert.ok(res.slice(0, ref.winners.length).every(r => r.score.won), `${tag}: the winners first`);
   plays++;continue;
  }
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
  if (def.order === 'turns') for (let s = 0; s < seats; s++) assert.equal(st.results[s].length, st.balls, `${tag}: everyone plays every ball`);
  plays++;
 }
 assert.equal(plays, want);
 assert.equal(want, (CHALLENGES.filter(c => c.where !== 'round').length * 4 - CHALLENGES.filter(c => c.who === 'group').length) * 6);
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

// BINGO BANGO BONGO, checked by what must be true of any hole played out: each
// hole starts with the first golfer on the tee (all are as far away); a golfer
// gets at most a point of each kind a hole, so at most three, and the hole's
// points add to no more than three; bongo goes to the first ball holed, and
// to nobody only when every ball was picked up; the most points win.
function checkHoles(st, log, tag) {
 let k = 0;
 const firsts = [];
 for (let h = 0; h < st.balls; h++) {
  firsts.push(log[k].seat);
  const holed = new Set(), up = new Set(), strokes = Array(st.seats).fill(0), pos = Array(st.seats).fill(null);
  let firstIn = null;
  while (holed.size + up.size < st.seats) {
   const b = log[k++];
   assert.ok(b, `${tag}: hole ${h + 1} ran out of balls`);
   // The farthest from the hole plays, a tie to the lower seat.
   const far = [...Array(st.seats).keys()].filter(g => !holed.has(g) && !up.has(g)).map(g => [g, Math.hypot((pos[g]?.x ?? 0) - PINS[h].x, (pos[g]?.z ?? 0) - PINS[h].z)])
    .sort((a, c) => c[1] - a[1] || a[0] - c[0])[0][0];
   assert.equal(b.seat, far, `${tag}: hole ${h + 1}: the farthest plays`);
   if (!b.hazard) pos[b.seat] = b.end;
   assert.ok(!holed.has(b.seat) && !up.has(b.seat), `${tag}: golfer ${b.seat} played after holing out`);
   strokes[b.seat] += b.hazard ? 2 : 1;
   if (!b.hazard && b.holed) { holed.add(b.seat);if (firstIn == null) firstIn = b.seat; }
   else if (strokes[b.seat] >= HOLES_GIVE_UP) up.add(b.seat);
  }
  const pts = st.results.map(r => r[h]);
  assert.ok(pts.every(p => p >= 0 && p <= 3), `${tag}: hole ${h + 1}: ${pts}`);
  assert.ok(pts.reduce((a, b) => a + b, 0) <= 3, `${tag}: hole ${h + 1} gave more than three points`);
  if (firstIn != null) assert.ok(pts[firstIn] >= 1, `${tag}: hole ${h + 1}: the first in has bongo`);
 }
 assert.equal(k, log.length, `${tag}: every ball belongs to a hole`);
 assert.ok(firsts.every(s => s === 0), `${tag}: each hole starts with golfer 1, all being as far away`);
 const total = st.results.map(r => r.reduce((a, b) => a + b, 0)), top = Math.max(...total);
 assert.deepEqual(st.winners, total.map((t, s) => t === top ? s : -1).filter(s => s >= 0), `${tag}: the most points win`);
}
