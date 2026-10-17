// EVERY CHALLENGE, PLAYED (16 October 2026): not with made-up balls (that is
// challenge-matrix.test.mjs) but with a golfer swinging the Swing Meter and
// the ball flying through the real ball model on the real Challenge Course and
// the real range -- in Node, with no browser and no graphics card.
//
// It is set up as the game sets it up (challenge-spots.js `planChallenge` and
// `playContext`, which main.js calls too), each ball is put down where the
// game puts it (main.js `placeForTurn`: the turn's spot, the tee or the mat,
// or where a spot being played out stopped), aimed where the game aims it, and
// what the flight did goes to the same play engine. So a challenge that cannot
// be finished, a spot a ball cannot be played from, a call no swing can make,
// or a score the engine cannot add up shows here first.
//
// The rounds with a goal (Sudden death, Bogey-free nine) are played as real
// rounds (game.js), hole after hole, relief taken as stroke and distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {virtualGolfer} from './virtual-golfer.mjs';
import {CHALLENGES, challengeCourseSettings, challenge, medalOf, MEDALS} from '../src/challenges.js';
import {newPlay, turn, playBall, results} from '../src/challenge-play.js';
import {planChallenge, playContext, holeAdapter} from '../src/challenge-spots.js';
import {RANGE_SETTINGS, rangeTargets} from '../src/range.js';
import {Round} from '../src/game.js';
import {goalStatus} from '../src/round-goals.js';
import {endlessHole, endlessSettings} from '../src/endless.js';

const YARD = .9144;
const courseSettings = challengeCourseSettings(), course = world(courseSettings), range = world(RANGE_SETTINGS);
const TEE = 'blue';
const adapters = course.holes.map(h => holeAdapter(h, TEE));

// One play of a challenge by `seats` golfers, as the game runs it. Returns the
// play and every ball's facts.
function play(def, seats, seed, skill = .012) {
 const onRange = def.where === 'range', holes = onRange ? range.holes : course.holes, settings = onRange ? RANGE_SETTINGS : courseSettings;
 const golfers = Array.from({length: seats}, (_, i) => virtualGolfer({seed: `${seed}:${i}`, skill, settings}));
 const tee = h => h.tees[onRange ? 'white' : TEE] || Object.values(h.tees)[0];
 const mat = tee(range.holes[0]);
 const plan = onRange ? planChallenge(def, {range: {mat, marks: rangeTargets()}}) : planChallenge(def, {holes: adapters, seed: courseSettings.seed, driver: 250});
 assert.ok(plan, `${def.id}: the Challenge Course hosts it`);
 const first = onRange ? range.holes[0] : course.holes[plan.hole];
 const pc = playContext(def, {hole: holeAdapter(first, onRange ? 'white' : TEE), callSeed: plan.callSeed, players: golfers.map(g => ({driver: 250, hand: 'RH', clubs: Object.values(g.clubs).map(c => ({kind: c.kind, carry: c.carry}))}))});
 assert.ok(pc, `${def.id}: every golfer has a zone`);
 const st = newPlay(def.id, {seats, spots: plan.spots, targets: plan.targets, calls: pc.calls, ctx: pc.ctx, pin: first.pin, length: first.routeLength / YARD, pins: plan.pins, lengths: plan.lengths});
 const balls = [];
 let from = null;
 for (let guard = 0; !st.done; guard++) {
  assert.ok(guard < 900, `${def.id}: still going after 900 strokes`);
  const t = turn(st), h = t.hole != null ? holes[t.hole] : first;
  // Where the ball is (placeForTurn): the last stop when playing on, the turn's spot, the tee or the mat.
  const at = from || t.spot || tee(h);
  const aimAt = t.target ? {x: t.target.x, z: t.target.z} : t.zone ? t.zone : typeof t.call === 'number' ? {x: at.x, z: at.z + t.call * YARD} : null;
  // The club the play settled for this golfer; spin added to hold a green, as a golfer would.
  const s = golfers[t.seat].shot({hole: h, from: {x: at.x, z: at.z}, aimAt, call: typeof t.call === 'string' ? t.call : null, club: st.ctx[t.seat].club || null, onRange, spin: def.id === 'hold' ? 3 : 0});
  balls.push({seat: t.seat, hole: t.hole, from: at, ...s.facts});
  const e = playBall(st, s.facts);
  from = e.again ? e.from : null;
 }
 return {st, balls};
}

const playable = CHALLENGES.filter(c => c.where !== 'round');
const summary = [];

for (const def of playable) {
 test(`${def.name}: played to its end through the ball model`, () => {
  for (const seats of def.who === 'group' ? [2, 3] : [1, 3]) {
   const {st, balls} = play(def, seats, `${def.id}:${seats}`);
   const res = results(st);
   assert.equal(res.length, seats);
   // A streak (the putting ladder) can end on its first ball.
   assert.ok(balls.length >= (def.who === 'group' || def.order === 'streak' ? seats : st.balls), `${def.id}: ${balls.length} balls`);
   for (const b of balls) for (const k of ['x', 'z']) assert.ok(Number.isFinite(b.end[k]) && Number.isFinite(b.landing[k]), `${def.id}: a ball that went nowhere`);
   // Putting challenges are played from the green, with the putter.
   if (def.putts) for (const b of balls.filter(b => b.club !== 'putter')) assert.fail(`${def.id}: a putt with the ${b.club}`);
   // A required club is the one used.
   if (def.club) assert.ok(balls.every(b => b.club === st.ctx[b.seat].club), `${def.id}: every ball with the club asked`);
   if (def.club === 'iron8') assert.equal(st.ctx[0].club, 'iron7', 'the stock bag has no 8-iron: the nearest is the 7');
   // Across holes: the balls visit every hole the play names, in order.
   if (def.hole === 'course' && def.order !== 'holes') assert.deepEqual([...new Set(balls.map(b => b.hole))], [...new Set(st.spots.map(s => s.hole))], `${def.id}: the holes in order`);
   if (def.group === 'versus') assert.ok(st.winners.length >= 1, `${def.id}: somebody won`);
   else for (const r of res) assert.equal(r.medal, medalOf(def, r.score, {driver: 250, length: st.length}), def.id);
   if (seats === 1 || def.who === 'group' && seats === 2) summary.push(`${def.id}: ${res.map(r => `${r.text}${r.medal ? ` (${MEDALS[r.medal]})` : ''}`).join(' / ')} in ${balls.length} balls`);
  }
 });
}

// A GOOD GOLFER CAN DO THEM. Not a promise of a medal each time -- a
// challenge is meant to be hard -- but a robot with steady timing should
// medal in most, and score something in nearly all; when the ball model or a
// spot rule moves so that one becomes impossible, this says so.
test('a steady golfer medals in most challenges and scores in nearly all', t => {
 let medalled = 0, scored = 0, n = 0;
 const none = [];
 for (const def of playable.filter(c => c.medals)) {
  const {st} = play(def, 1, `${def.id}:steady`, .006), r = results(st)[0];
  n++;
  if (r.medal) medalled++;
  const something = r.score != null && (def.play === 'updown' ? r.score.made > 0 : def.better === 'low' ? true : r.score > 0);
  if (something) scored++; else none.push(def.id);
 }
 t.diagnostic(summary.join('\n'));
 t.diagnostic(`steady golfer: a medal in ${medalled} of ${n}, a score in ${scored} of ${n}${none.length ? ` (nothing in ${none.join(', ')})` : ''}`);
 assert.ok(medalled >= n / 2, `a medal in only ${medalled} of ${n}`);
 assert.ok(scored >= n - 4, `nothing scored in ${none.join(', ')}`);
});

// THE ROUNDS WITH A GOAL, played as rounds: every stroke through the round's
// own rules, relief as stroke and distance, the pars as main.js sets them.
function playHole(r, holeObj, golfers) {
 r.pars[r.hole] = holeObj.par;
 if (!r.teePlaced) r.placeTee(holeObj.tees);
 for (let guard = 0; !r.holeComplete; guard++) {
  assert.ok(guard < 80, `hole ${r.hole + 1}: still going after 80 strokes`);
  if (r.relief) { r.takeRelief({spot: {...r.relief.from}, penalty: 1}, holeObj.pin);continue; }
  const s = golfers[r.active].shot({hole: holeObj, from: {...r.position}});
  const lie = holeObj.surface(r.position.x, r.position.z);
  r.takeShot({...s.result, puttStroke: lie === 'green', onGreen: s.result.onGreen}, holeObj.pin);
 }
}
test('Sudden death: an endless run played until everyone is out', () => {
 const players = [{name: 'Alex', team: 'A'}, {name: 'Bo', team: 'A'}];
 const r = new Round({players, mode: 'stroke', endless: true, seed: 'SUDDEN', goal: 'suddendeath', putting: {mode: 'holeout'}, tee: TEE});
 const golfers = players.map((_, i) => virtualGolfer({seed: `sd:${i}`}));
 let holes = 0;
 for (; holes < 4 && !goalStatus(r.goal, r).over; holes++) {
  const s = endlessSettings(endlessHole(r.seed, r.hole)), hole = world(s).holes[0];
  playHole(r, hole, golfers);
  const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
  assert.equal(back.goal, 'suddendeath', 'the goal rides through a save');
  if (!goalStatus(r.goal, r).over) r.nextHole();
 }
 const st = goalStatus(r.goal, r);
 st.seats.forEach((x, seat) => {
  const card = r.cards[seat], first = card.findIndex((v, h) => Number.isFinite(v) && Math.round(v) > r.pars[h]);
  assert.equal(x.out, first >= 0, `golfer ${seat + 1}: out exactly when they made a bogey`);
  if (x.out) assert.equal(x.score, first, `golfer ${seat + 1}: the holes before it`);
 });
 assert.equal(r.finished, false, 'an endless run is never finished');
});
test('Bogey-free nine: nine holes of the Challenge Course\'s nine, bogeys counted', () => {
 const s = {...challengeCourseSettings(), holes: 9}, nine = world(s);
 const players = [{name: 'Alex', team: 'A'}];
 const r = new Round({players, mode: 'stroke', holes: 9, goal: 'bogeyfree', putting: {mode: 'holeout'}, tee: TEE});
 const golfers = [virtualGolfer({seed: 'bf'})];
 for (let h = 0; h < 9; h++) { playHole(r, nine.holes[h], golfers); if (!r.finished) r.nextHole(); }
 assert.ok(r.finished);
 const st = goalStatus(r.goal, r), bogeys = r.cards[0].filter((v, h) => Math.round(v) > r.pars[h]).length;
 assert.deepEqual(st.seats[0], {score: bogeys, out: true});
 assert.equal(st.over, true);
 assert.equal(medalOf(challenge('bogeyfree'), bogeys, {}), bogeys <= 0 ? 3 : bogeys <= 1 ? 2 : bogeys <= 2 ? 1 : 0);
});
