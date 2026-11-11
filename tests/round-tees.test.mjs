import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../src/game.js';

// Each golfer plays from their own tee (round 13): a golfer with `tee` starts
// every hole there; one without plays from the round's tee.
const tees = {blue: {x: 0, z: 0, yards: 400}, white: {x: 0, z: 20, yards: 380}, red: {x: 0, z: 40, yards: 350}};

test('each golfer starts the hole from their own tee', () => {
 const r = new Round({players: [{name: 'Ann', team: 'A', hand: 'RH', tee: 'blue'}, {name: 'Cal', team: 'A', hand: 'RH', tee: 'red'}, {name: 'Bo', team: 'A', hand: 'RH'}], tee: 'white'});
 r.placeTee(tees);
 assert.deepEqual(r.positions, [{x: 0, z: 0}, {x: 0, z: 40}, {x: 0, z: 20}]);
 assert.equal(r.teeOf(1), 'red');
 assert.equal(r.teeOf(2), 'white');
});

test('a tee set the course lacks falls back to the round\'s', () => {
 const r = new Round({players: [{name: 'Ann', team: 'A', hand: 'RH', tee: 'red'}], tee: 'blue'});
 r.placeTee({blue: tees.blue});
 assert.deepEqual(r.positions[0], {x: 0, z: 0});
});

test('a golfer who joins starts from their own tee, and a tee rides through the group and a save', () => {
 const r = new Round({players: [{name: 'Ann', team: 'A', hand: 'RH'}], tee: 'blue'});
 r.placeTee(tees);
 r.setPlayers([{name: 'Ann', team: 'A', hand: 'RH', seat: 0}, {name: 'Cal', team: 'A', hand: 'RH', tee: 'red'}], tees);
 assert.deepEqual(r.positions[1], {x: 0, z: 40});
 assert.equal(r.players[1].tee, 'red');
 const back = Round.restore(JSON.parse(JSON.stringify(r)));
 assert.equal(back.teeOf(1), 'red');
});

// THE SIX SETS (tees.js; the owner, 10 November 2026): any of them may be
// chosen; a course without it plays the nearest it has.
test('the six tee sets are allowed, and nothing else', () => {
 for (const tee of ['black', 'blue', 'white', 'silver', 'gold', 'red']) assert.doesNotThrow(() => new Round({players: [{name: 'Ann', team: 'A', hand: 'RH', tee}], tee}));
 assert.throws(() => new Round({players: [{name: 'Ann', team: 'A', hand: 'RH', tee: 'green'}]}), /Invalid player/);
 assert.throws(() => new Round({tee: 'purple'}), /Invalid tee/);
});

test('a golfer on a set the course lacks plays the nearest it has', () => {
 const r = new Round({players: [{name: 'Ann', team: 'A', hand: 'RH', tee: 'black'}, {name: 'Cal', team: 'A', hand: 'RH', tee: 'gold'}, {name: 'Bo', team: 'A', hand: 'RH', tee: 'silver'}], tee: 'black'});
 r.placeTee(tees);
 assert.deepEqual(r.positions, [{x: 0, z: 0}, {x: 0, z: 40}, {x: 0, z: 20}], 'black from blue, gold from red, silver from white');
 assert.equal(r.tee, 'blue', 'the round plays its nearest set');
});
