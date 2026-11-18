// HANDICAP ROUNDS AND STABLEFORD (src/net.js, src/stableford.js; the
// fairway-tour goal, 17 November 2026). The allowances are the WHS's
// (RESEARCH *Allowances, Stableford*); the strokes fall where handicap.js's
// stroke index puts them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {roundStrokes, courseHandicapOn, netCard, total, ALLOWANCE} from '../src/net.js';
import {points, pointsTotal, noPointsLeft} from '../src/stableford.js';
import {courseHandicap} from '../src/handicap.js';
import {Round} from '../src/game.js';

const HOLES = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5].map((par, i) => ({par, yards: par === 3 ? 170 + i : par === 5 ? 520 + i : 390 + i * 3}));
const sum = a => a.reduce((s, v) => s + v, 0);

test('stroke play: 95% of each Course Handicap, a stroke a hole up to 18 and two after', () => {
 const r = roundStrokes({mode: 'stroke', players: [{index: 10, team: 'A'}, {index: 27, team: 'A'}, {index: null, team: 'A'}], holes: HOLES});
 const ch = [10, 27].map(i => courseHandicap(i, {yards: sum(HOLES.map(h => h.yards)), par: sum(HOLES.map(h => h.par)), holes: 18}));
 assert.deepEqual(r.playing, [Math.round(ch[0] * .95), Math.round(ch[1] * .95), 0]);
 assert.equal(sum(r.strokes[0]), r.playing[0]);
 assert.equal(sum(r.strokes[1]), r.playing[1]);
 assert.ok(r.strokes[1].every(v => v >= 1), 'over 18: a stroke on every hole');
 assert.deepEqual(r.strokes[2], HOLES.map(() => 0), 'no index: scratch');
});

test('match play: the lowest plays off zero; four-ball takes 90% first', () => {
 const singles = roundStrokes({mode: 'match', players: [{index: 4, team: 'A'}, {index: 18, team: 'B'}], holes: HOLES});
 assert.equal(singles.playing[0], 0);
 assert.ok(singles.playing[1] > 10);
 const four = roundStrokes({mode: 'match', players: [{index: 4, team: 'A'}, {index: 18, team: 'A'}, {index: 8, team: 'B'}, {index: 12, team: 'B'}], holes: HOLES});
 assert.equal(Math.min(...four.playing), 0);
 const ch = [4, 18, 8, 12].map(i => courseHandicapOn(i, HOLES)).map(c => Math.round(c * ALLOWANCE.fourBallMatch));
 assert.deepEqual(four.playing, ch.map(c => c - Math.min(...ch)));
});

test('scramble: the team\'s share from the lowest handicap up', () => {
 const r = roundStrokes({mode: 'scramble', players: [{index: 20, team: 'A'}, {index: 2, team: 'A'}, {index: 30, team: 'B'}, {index: 10, team: 'B'}], holes: HOLES});
 const c = i => courseHandicapOn(i, HOLES);
 assert.equal(r.teamHandicap.A, Math.round(c(2) * .35 + c(20) * .15));
 assert.equal(r.teamHandicap.B, Math.round(c(10) * .35 + c(30) * .15));
 assert.deepEqual(r.strokes[0], r.team.A);
});

test('a course rated by the computer golfers changes the strokes', () => {
 const easy = courseHandicapOn(15, HOLES), hard = courseHandicapOn(15, HOLES, {course: 76.5, slope: 145});
 assert.ok(hard > easy + 4, `${hard} against ${easy}`);
});

test('net cards, and Stableford points', () => {
 assert.deepEqual(netCard([5, 4, undefined, 6], [1, 0, 1, 2]), [4, 4, undefined, 4]);
 assert.equal(total([5, 4, undefined, 6]), 15);
 assert.equal(points(4, 4), 2); assert.equal(points(3, 4), 3); assert.equal(points(5, 4), 1);
 assert.equal(points(6, 4), 0); assert.equal(points(9, 4), 0); assert.equal(points(1, 3), 4);
 assert.equal(points(5, 4, 1), 2, 'a stroke makes a bogey a net par');
 assert.equal(points(undefined, 4), null);
 assert.equal(pointsTotal([4, 5, 3, 7], [4, 4, 4, 4], [0, 1, 0, 0]), 2 + 2 + 3 + 0);
 assert.ok(noPointsLeft(6, 4) && !noPointsLeft(5, 4) && !noPointsLeft(6, 4, 1));
});

test('net match play decides a hole on net scores, and the strokes ride through a save', () => {
 const r = new Round({mode: 'match', holes: 9, players: [{name: 'Low', team: 'A'}, {name: 'High', team: 'B'}], net: {strokes: [[0, 0], [1, 0]]}});
 const PIN = {x: 0, z: 100}, tees = {blue: {x: 0, z: 0}};
 r.pars[0] = 4; r.placeTee(tees);
 // Both make 4 gross: the stroke wins the hole for High.
 const play = (seat, n) => { for (let k = 1; k < n; k++) { r.active = seat; r.takeShot({end: {x: 0, z: 20 * k}, holed: false, onGreen: false}, PIN); } r.active = seat; r.takeShot({end: {...PIN}, holed: true, onGreen: false}, PIN); };
 play(0, 4); play(1, 4);
 assert.ok(r.holeComplete);
 assert.deepEqual(r.match, {A: 0, B: 1});
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.equal(back.strokesOn(1, 0), 1);
 assert.equal(back.strokesOn(0, 0), 0);
 // A gross round is every round before: no strokes anywhere.
 assert.equal(new Round().net, null);
 assert.equal(new Round().strokesOn(0, 0), 0);
});
