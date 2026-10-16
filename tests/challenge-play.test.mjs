// A challenge being played (challenge-play.js): what each ball scores, by
// hand-written balls, the three turn orders, what a flight says a ball did,
// and what a play pays (progression.js `challengePay`). Every challenge with
// every group is challenge-matrix.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlay, turn, playBall, scoreBall, results, ballFacts, progressText, HIGH_SHARE, LOW_SHARE} from '../src/challenge-play.js';
import {challenge, UPDOWN_GIVE_UP, HAZARD_FEET} from '../src/challenges.js';
import {challengePay, CHALLENGE_PAY, normaliseChallengeDay} from '../src/progression.js';
import {simulateShot} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';
import {bagClubs, stockBag} from '../src/clubs.js';
import {startSwing, tap, swingLaunch, RUN_UP} from '../src/swing-meter.js';

const FOOT = .3048, YARD = .9144;
const pin = {x: 0, z: 150};
const ball = (extra = {}) => ({origin: {x: 0, z: 0}, end: {x: 0, z: 0}, landing: {x: 0, z: 0}, rest: 'fairway', hazard: null, holed: false, carry: 0, apex: 0, curve: 0, club: null, ...extra});
const at = (feet, angle = 0) => ({x: pin.x + Math.sin(angle) * feet * FOOT, z: pin.z + Math.cos(angle) * feet * FOOT});
const score = (id, f, t = {}, st = {}) => scoreBall(challenge(id), ball(f), {seat: 0, k: 0, spot: null, target: null, call: null, zone: null, ...t}, {pin, ctx: [{}], ...st});

test('each kind of ball is scored as its card says', () => {
 // Drives: only the fairway counts for distance; the first cut counts for Long and straight.
 assert.equal(Math.round(score('long', {end: {x: 0, z: 274.32}})), 300);
 assert.equal(score('long', {end: {x: 0, z: 274.32}, rest: 'semi'}), null);
 assert.equal(Math.round(score('straight', {end: {x: 0, z: 182.88}, rest: 'semi'})), 200);
 assert.equal(score('straight', {end: {x: 0, z: 182.88}, rest: 'rough'}), 0);
 assert.equal(score('fairway', {rest: 'fairway'}), 1);
 assert.equal(score('fairway', {rest: 'fairway', hazard: 'Water'}), 0);
 // Draw and fade: a right-hander's draw curves left (negative), a left-hander's right.
 assert.equal(score('shape', {curve: -6 * YARD}, {call: 'draw'}), 1);
 assert.equal(score('shape', {curve: -6 * YARD}, {call: 'fade'}), 0);
 assert.equal(score('shape', {curve: -4 * YARD}, {call: 'draw'}), 0, 'five yards of curve at least');
 assert.equal(score('shape', {curve: 6 * YARD}, {call: 'draw'}, {ctx: [{hand: 'LH'}]}), 1);
 assert.equal(score('shape', {curve: -6 * YARD, rest: 'rough'}, {call: 'draw'}), 0, 'and on the fairway');
 // The zone: 3 inside its 15-yard radius, 1 elsewhere on the fairway.
 const zone = {x: 0, z: 200};
 assert.equal(score('zone', {end: {x: 10, z: 200}, rest: 'rough'}, {zone}), 3);
 assert.equal(score('zone', {end: {x: 20, z: 200}}, {zone}), 1);
 assert.equal(score('zone', {end: {x: 20, z: 200}, rest: 'rough'}, {zone}), 0);
 // Pin distances.
 assert.equal(Math.round(score('closest', {end: at(10)})), 10);
 assert.equal(score('closest', {end: at(10), hazard: 'Water'}), null);
 assert.equal(score('closest', {end: at(0), holed: true}), 0);
 assert.equal(score('lag', {end: at(10), hazard: 'Water'}), HAZARD_FEET);
 assert.equal(score('chipclose', {end: at(500)}), HAZARD_FEET, 'never more than a ball in the water');
 assert.equal(score('ace', {holed: true}), 25);
 assert.equal(score('ace', {end: at(2.5)}), 5);
 assert.equal(score('ace', {end: at(8)}), 2);
 assert.equal(score('ace', {end: at(30), rest: 'green'}), 1);
 assert.equal(score('ace', {end: at(30), rest: 'fringe'}), 0);
 assert.equal(score('chipin', {holed: true}), 5);
 assert.equal(score('chipin', {end: at(5)}), 1);
 // Ladders: a share of the distance played.
 const spot = {x: 0, z: 150 - 100 * YARD};
 assert.equal(score('ladder', {end: at(8)}, {spot}), 3, '8 ft from 100 yd is under 3%');
 assert.equal(score('ladder', {end: at(15)}, {spot}), 2);
 assert.equal(score('ladder', {end: at(40), rest: 'green'}, {spot}), 1);
 assert.equal(score('pitch', {end: at(12)}, {spot: {x: 0, z: 150 - 50 * YARD}}), 2, '12 ft from 50 yd is 8%, inside 10%');
 assert.equal(score('pitch', {end: at(20)}, {spot: {x: 0, z: 150 - 50 * YARD}}), 0, '20 ft is 13%, and not on the green');
 assert.equal(score('hold', {rest: 'green', landing: at(30), end: at(18)}), 1);
 assert.equal(score('hold', {rest: 'green', landing: at(30), end: at(0, Math.PI)}), 0, 'ran 30 ft past where it landed');
 assert.equal(score('water', {rest: 'green'}), 1);
 // The range: where it lands.
 const target = {x: 0, z: 150 * YARD, yards: 150};
 assert.equal(score('dartboard', {landing: {x: 2 * YARD, z: 150 * YARD}}, {target}), 10);
 assert.equal(score('dartboard', {landing: {x: 8 * YARD, z: 150 * YARD}}, {target}), 3, 'on the 9 m target');
 assert.equal(score('dartboard', {landing: {x: 20 * YARD, z: 150 * YARD}}, {target}), 0);
 assert.equal(score('clock', {landing: {x: 0, z: 155 * YARD}}, {target}), 5, '5 yd from 150 is 3.3%');
 assert.equal(score('oneclub', {landing: {x: 0, z: 150 * YARD}, club: 'iron8'}, {target}), 10);
 assert.equal(score('oneclub', {landing: {x: 0, z: 150 * YARD}, club: 'iron9'}, {target}), 0, 'any other club scores nothing');
 assert.equal(score('number', {carry: 143 * YARD}, {call: 140}), 3);
 const highBall = {landing: {x: 0, z: 150 * YARD}, carry: 150 * YARD, apex: 150 * YARD * (HIGH_SHARE + .01), club: 'iron7'};
 assert.equal(score('highlow', highBall, {target, call: 'high'}), 1);
 assert.equal(score('highlow', highBall, {target, call: 'low'}), 0);
 assert.equal(score('highlow', {...highBall, apex: 150 * YARD * (LOW_SHARE - .01)}, {target, call: 'low'}), 1);
 assert.equal(score('curve', {landing: {x: 0, z: 150 * YARD}, curve: 5 * YARD, club: 'iron7'}, {target, call: 'fade'}), 1);
 // Putts.
 assert.equal(score('fourft', {holed: true}), 1);
 assert.equal(score('puttladder', {holed: true}, {spot: at(12)}), 12);
 assert.equal(score('puttladder', {holed: false}, {spot: at(12)}), 0);
});

test('turns: a ball each in turn, every golfer the same number', () => {
 const st = newPlay('closest', {seats: 3, pin});
 const seats = [];
 while (!st.done) { seats.push(turn(st).seat); playBall(st, ball({end: at(10 + seats.length)})); }
 assert.deepEqual(seats, [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]);
 const r = results(st);
 assert.equal(r[0].seat, 0, 'the nearest ball wins');
 assert.equal(Math.round(r[0].score), 11);
 assert.throws(() => playBall(st, ball()), /over/);
});

test('streak: in turn, and a golfer is out at their first miss', () => {
 const st = newPlay('streak', {seats: 2});
 const seq = [];
 // Golfer 0 misses their third; golfer 1 hits every one to the twenty.
 while (!st.done) { const t = turn(st);seq.push(t.seat);playBall(st, ball({rest: t.seat === 0 && t.k === 2 ? 'rough' : 'fairway'})); }
 assert.deepEqual(seq.slice(0, 6), [0, 1, 0, 1, 0, 1]);
 assert.equal(seq.filter(s => s === 0).length, 3);
 assert.equal(seq.filter(s => s === 1).length, 20);
 assert.deepEqual(results(st).map(r => [r.seat, r.score]), [[1, 20], [0, 2]]);
});

test('spot out: each golfer plays the drop out, two strokes for water, picked up at eight', () => {
 const spots = [at(40), at(40, 1), at(40, 2)];
 const st = newPlay('updown', {seats: 2, spots, pin});
 assert.equal(st.balls, 3, 'one ball a spot');
 // Golfer 0: chip, putt in (2). Golfer 1: water (2), chip, putt (4).
 let e = playBall(st, ball());assert.equal(e.again, true);assert.equal(turn(st).seat, 0);assert.equal(turn(st).strokes, 1);
 e = playBall(st, ball({holed: true}));assert.equal(e.value, 2);assert.equal(turn(st).seat, 1);
 e = playBall(st, ball({hazard: 'Water'}));assert.equal(e.again, true);assert.deepEqual(e.from, spots[0], 'again from the drop');
 playBall(st, ball());e = playBall(st, ball({holed: true}));assert.equal(e.value, 4);
 assert.equal(turn(st).seat, 0);assert.equal(turn(st).k, 1, 'the next drop');
 for (let i = 0; i < UPDOWN_GIVE_UP - 1; i++) playBall(st, ball());
 e = playBall(st, ball());assert.equal(e.value, UPDOWN_GIVE_UP, 'picked up');
 while (!st.done) playBall(st, ball({holed: true}));
 const r = results(st);
 assert.deepEqual(r.map(x => [x.seat, x.score.made, x.score.strokes]), [[1, 2, 6], [0, 2, 11]]);
 assert.match(progressText(newPlay('updown', {seats: 1, spots, pin})), /Drop 1 of 3/);
});

test('a play with no spots that needs them, or a group of five, is refused', () => {
 assert.equal(newPlay('updown', {seats: 1, spots: []}).done, true);
 assert.throws(() => newPlay('closest', {seats: 5}), /one to four/);
 assert.throws(() => newPlay('ghost', {seats: 1}), /No challenge/);
});

// WHAT A FLIGHT SAYS: the landing, and the curve against the first five metres,
// flown through the real ball model off the Swing Meter -- the same path the
// game takes, so High and low and Curve it can be reached.
const clubs = bagClubs(stockBag()), turf = turfConfig({});
const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []};
function fly(club, shape) {
 const sw = startSwing(0, {difficulty: 'normal', club: clubs[club]});
 tap(sw, sw.rise * (RUN_UP + 1));tap(sw, sw.rise * (RUN_UP + 1) + sw.rise);
 const out = swingLaunch(sw, {club: clubs[club], shape, short: false, lie: 'fairway', difficulty: 'normal', turf});
 const origin = {x: 0, z: 0};
 return ballFacts({origin, result: simulateShot({origin, aim: 0, ...out.shot}, flat, {turf}), rest: 'fairway', club});
}
test('a flight gives where the ball landed and which way it curved', () => {
 const straight = fly('iron7', {}), draw = fly('iron7', {curve: 'draw'}), fade = fly('iron7', {curve: 'fade'});
 assert.ok(Math.abs(straight.curve) < .5);
 assert.ok(draw.curve < -4 * YARD, `a draw curves left: ${(draw.curve / YARD).toFixed(1)} yd`);
 assert.ok(fade.curve > 4 * YARD, `a fade curves right: ${(fade.curve / YARD).toFixed(1)} yd`);
 assert.ok(Math.hypot(straight.landing.x, straight.landing.z) < Math.hypot(straight.end.x, straight.end.z), 'it lands before it stops');
 assert.ok(Math.abs(Math.hypot(straight.landing.x, straight.landing.z) - straight.carry) < 1.5, 'it lands at its carry');
 // High and low: a normal 7-iron is neither, and the meter's High and Low each make their call.
 const share = f => f.apex / f.carry, high = fly('iron7', {height: 'high'}), low = fly('iron7', {height: 'low'});
 assert.ok(share(straight) < HIGH_SHARE && share(straight) > LOW_SHARE, `normal ${share(straight).toFixed(3)}`);
 assert.ok(share(high) >= HIGH_SHARE, `high ${share(high).toFixed(3)}`);
 assert.ok(share(low) <= LOW_SHARE, `low ${share(low).toFixed(3)}`);
});

// THE PAY: first medals once each, ever; a play's pay until 250 a day; a new
// best once a challenge a day; the multiplier on all of it.
test('a play pays first medals once, then only a capped trickle', () => {
 const p = {}, day1 = new Date(2026, 9, 16, 10).getTime(), day2 = new Date(2026, 9, 17, 10).getTime();
 let r = challengePay(p, {id: 'closest', medal: 2, best: true}, day1);
 assert.deepEqual(r.parts.map(x => [x.label, x.xp]), [['First bronze', 25], ['First silver', 50], ['New best', 20], ['Silver play', 15]]);
 assert.equal(p.medals.closest, 2);
 r = challengePay(p, {id: 'closest', medal: 3, best: true}, day1);
 assert.deepEqual(r.parts.map(x => [x.label, x.xp]), [['First gold', 100], ['Gold play', 25]], 'a new best pays once a day');
 r = challengePay(p, {id: 'closest', medal: 3}, day1);
 assert.deepEqual(r.parts.map(x => x.label), ['Gold play'], 'gold again pays only the play');
 // The allowance: 250 of play pay a day, across every challenge.
 let total = 0;
 for (let i = 0; i < 40; i++) total += challengePay(p, {id: 'fairway', medal: 3}, day1).xp;
 assert.equal(p.xpChallenge.xp, CHALLENGE_PAY.dayCap);
 assert.equal(challengePay(p, {id: 'lag', medal: 0}, day1).capped, true);
 r = challengePay(p, {id: 'lag', medal: 1}, day1);
 assert.deepEqual(r.parts.map(x => x.label), ['First bronze'], 'a first medal is never held back by the allowance');
 r = challengePay(p, {id: 'lag', medal: 1}, day2);
 assert.deepEqual(r.parts.map(x => [x.label, x.xp]), [['Bronze play', 10]], 'a new day, a new allowance');
 // Hard pays half as much again; a long challenge's medals pay double.
 const q = {};
 assert.equal(challengePay(q, {id: 'zone', medal: 1, mult: 1.5}, day1).xp, Math.round(25 * 1.5) + 15);
 assert.equal(challengePay({}, {id: 'zone', medal: 1, long: true}, day1).parts[0].xp, 50);
 assert.deepEqual(normaliseChallengeDay({day: '2026-10-16', xp: 40, bests: ['lag', 7]}), {day: '2026-10-16', xp: 40, bests: ['lag']});
 assert.equal(normaliseChallengeDay({day: 'today'}), null);
});
