// WHO PLAYS NEXT (src/play-order.js, 19 November 2026): the honour and the
// farthest-out order, alone and inside a round. The round matrix plays every
// format with both orders; these pin the rules themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {honours, nextToPlay, PLAY_ORDERS, validPlayOrder} from '../src/play-order.js';
import {Round} from '../src/game.js';

const PIN = {x: 0, z: 300};
const TEES = {blue: {x: 0, z: 0}, red: {x: 0, z: 40}};
const group = names => names.map((name, i) => ({name, team: i % 2 ? 'B' : 'A'}));
const shot = (z, more = {}) => ({end: {x: 0, z}, ...more});

test('the two orders, and nothing else, are accepted', () => {
 assert.deepEqual(PLAY_ORDERS, ['holeOut', 'farthest']);
 assert.ok(validPlayOrder('farthest') && !validPlayOrder('ready'));
 assert.throws(() => new Round({playOrder: 'ready'}), /order of play/);
});

test('the honour: lowest score first, a tie keeps the last tee, no score last', () => {
 const s = {a: 5, b: 4, c: 5, d: undefined};
 assert.deepEqual(honours(['c', 'd', 'a', 'b'], k => s[k]), ['b', 'c', 'a', 'd']);
});

test('match play: the side that won the hole has the honour, partners by score', () => {
 const side = {a: 'A', b: 'B', c: 'A', d: 'B'}, s = {a: 3, b: 4, c: 6, d: 5};
 assert.deepEqual(honours(['a', 'b', 'c', 'd'], k => s[k], {sideOf: k => side[k], leadSide: 'B'}), ['b', 'd', 'a', 'c']);
});

test('farthest-out: everyone tees off first in honour order, then the ball farthest away', () => {
 const st = {a: true, b: false, c: true}, d = {a: 100, b: 300, c: 200};
 const ask = done => nextToPlay(['a', 'b', 'c'], {done: k => done.includes(k), started: k => st[k], away: k => d[k]});
 assert.equal(ask([]), 'b', 'a golfer yet to tee off goes first, however close the others are');
 st.b = true; d.b = 150;
 assert.equal(ask([]), 'c');
 assert.equal(ask(['c']), 'b');
 assert.equal(ask(['a', 'b', 'c']), null);
 // An equal distance goes to the honour order.
 assert.equal(nextToPlay(['x', 'y'], {done: () => false, started: () => true, away: () => 50}), 'x');
});

test('stroke play, hole-out order: the golfer up plays until holed (as before)', () => {
 const r = new Round({players: group(['Al', 'Bo', 'Cy']), mode: 'stroke', playOrder: 'holeOut'});
 r.placeTee(TEES);
 r.takeShot(shot(250), PIN);
 assert.equal(r.active, 0);
});

test('stroke play, farthest-out: all three tee off, then the ball farthest out, to the cup', () => {
 const r = new Round({players: group(['Al', 'Bo', 'Cy']), mode: 'stroke', playOrder: 'farthest'});
 r.placeTee(TEES);
 r.takeShot(shot(250), PIN);   // Al: 50 out
 assert.equal(r.active, 1, 'Bo tees off next');
 r.takeShot(shot(200), PIN);   // Bo: 100 out
 assert.equal(r.active, 2, 'then Cy');
 r.takeShot(shot(270), PIN);   // Cy: 30 out
 assert.equal(r.active, 1, 'Bo is away');
 r.takeShot(shot(290), PIN);   // Bo: 10 out
 assert.equal(r.active, 0, 'now Al is away');
 r.takeShot(shot(300, {holed: true}), PIN);
 assert.equal(r.active, 2, 'Cy (30) before Bo (10)');
});

test('the honour on the next tee: lowest score first, whoever was away', () => {
 const r = new Round({players: group(['Al', 'Bo']), mode: 'stroke', playOrder: 'farthest'});
 r.placeTee(TEES);
 r.takeShot(shot(250), PIN);
 r.takeShot(shot(300, {holed: true}), PIN);   // Bo: 1
 r.takeShot(shot(300, {holed: true}), PIN);   // Al: 2
 assert.ok(r.holeComplete);
 r.nextHole();
 assert.equal(r.active, 1, 'Bo has the honour');
});

test('back to the tee: a golfer playing again from it waits for the rest to tee off (Rule 6.4c)', () => {
 const r = new Round({players: group(['Al', 'Bo']), mode: 'stroke', playOrder: 'farthest'});
 r.placeTee(TEES);
 r.takeShot({...shot(200), hazard: 'Out of bounds', cross: {x: 0, z: 200}}, PIN);
 r.takeRelief({spot: {x: 0, z: 0}, penalty: 1}, PIN);
 assert.equal(r.active, 1, 'Bo tees off before Al plays again');
});

test('own tees: on the tee the honour plays first, not the ball farthest back', () => {
 const r = new Round({players: [{name: 'Al', team: 'A', tee: 'red'}, {name: 'Bo', team: 'A'}], mode: 'stroke', playOrder: 'farthest'});
 r.placeTee(TEES);
 assert.equal(r.active, 0);
 const m = new Round({players: [{name: 'Al', team: 'A', tee: 'red'}, {name: 'Bo', team: 'B'}, {name: 'Cy', team: 'A', tee: 'red'}], mode: 'match'});
 m.placeTee(TEES);
 m.takeShot(shot(250), PIN);
 assert.equal(m.active, 1, 'match play: the next to tee off, not the farthest ball');
});

test('a scramble, farthest-out: the teams alternate, the one farther away playing', () => {
 const r = new Round({players: [{name: 'Al', team: 'A'}, {name: 'Bo', team: 'A'}, {name: 'Cy', team: 'B'}, {name: 'Di', team: 'B'}], mode: 'scramble', playOrder: 'farthest'});
 r.placeTee(TEES);
 r.takeShot(shot(250), PIN); r.takeShot(shot(240), PIN);
 r.chooseScramble(0, PIN);                    // A: 50 out
 assert.equal(r.players[r.active].team, 'B', 'team B tees off');
 r.takeShot(shot(150), PIN); r.takeShot(shot(140), PIN);
 r.chooseScramble(0, PIN);                    // B: 150 out
 assert.equal(r.players[r.active].team, 'B', 'B is away and plays again');
 r.takeShot(shot(290), PIN); r.takeShot(shot(280), PIN);
 r.chooseScramble(0, PIN);                    // B: 10 out
 assert.equal(r.players[r.active].team, 'A', 'now A is away');
});

test('a save from before the choice plays hole-out, whatever the preference', () => {
 const was = Round.defaultPlayOrder;
 try {
  Round.defaultPlayOrder = 'farthest';
  const r = new Round({players: group(['Al', 'Bo'])});
  assert.equal(r.playOrder, 'farthest', 'a new round takes the preference');
  const {playOrder, ...old} = JSON.parse(JSON.stringify(r));
  assert.equal(Round.restore(old).playOrder, 'holeOut');
  assert.equal(Round.restore(JSON.parse(JSON.stringify(r))).playOrder, 'farthest', 'and a new save keeps its own');
 } finally { Round.defaultPlayOrder = was; }
});

test('match play: the side that won the hole tees off first', () => {
 const r = new Round({players: group(['Al', 'Bo', 'Cy', 'Di']), mode: 'match'});
 r.placeTee(TEES);
 // Every golfer holes out in turn: B's best 2, A's best 3.
 const play = {0: 3, 1: 2, 2: 4, 3: 4};
 let guard = 0;
 while (!r.holeComplete && guard++ < 40) {
  const i = r.active;
  r.takeShot(r.strokes[i] + 1 >= play[i] ? shot(300, {holed: true}) : shot(100 + 50 * r.strokes[i] + i), PIN);
 }
 assert.deepEqual([r.teamCards.A[0], r.teamCards.B[0]], [3, 2]);
 r.nextHole();
 assert.equal(r.players[r.order[0]].team, 'B');
 assert.equal(r.players[r.order[1]].team, 'B');
});
