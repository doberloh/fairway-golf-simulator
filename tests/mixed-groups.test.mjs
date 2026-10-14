// Phase 3, mixed groups (14 October 2026): each golfer plays off the launch
// monitor or on the Swing Meter, and the round and the profile remember which.
// What the play screen does with it (main.js `syncArmed`) is checked by the
// smoke journey `mixed-group`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Round, playsWith, INPUTS} from '../src/game.js';
import {blankProfile, normaliseProfile, setProfilePlay} from '../src/profile.js';

test('a golfer plays off the monitor unless set to the Swing Meter, as everyone did before', () => {
 assert.deepEqual(INPUTS, ['monitor', 'meter']);
 assert.equal(playsWith({input: 'meter'}), 'meter');
 assert.equal(playsWith({input: 'monitor'}), 'monitor');
 assert.equal(playsWith({}), 'monitor', 'a golfer from before mixed groups follows the Armed switch');
 assert.equal(playsWith(undefined), 'monitor');
});

test('the round keeps each golfer\'s way of playing, through a save and a group change', () => {
 const r = new Round({players: [{name: 'Alex', team: 'A', hand: 'RH', input: 'monitor'}, {name: 'Sam', team: 'B', hand: 'LH', input: 'meter'}], mode: 'stroke'});
 assert.deepEqual(r.players.map(playsWith), ['monitor', 'meter']);
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.deepEqual(back.players.map(playsWith), ['monitor', 'meter'], 'saved and resumed');
 assert.equal(back.players[1].hand, 'LH');
 // Mid-round: Sam switches to the monitor, a third golfer joins on the meter.
 r.setPlayers([{name: 'Alex', team: 'A', hand: 'RH', input: 'monitor', seat: 0}, {name: 'Sam', team: 'B', hand: 'LH', input: 'monitor', seat: 1}, {name: 'Kim', team: 'A', hand: 'RH', input: 'meter'}]);
 assert.deepEqual(r.players.map(playsWith), ['monitor', 'monitor', 'meter']);
 // Nonsense is dropped, not kept: the golfer follows the switch.
 r.setPlayers([{name: 'Alex', team: 'A', hand: 'RH', input: 'joystick', seat: 0}]);
 assert.equal(r.players[0].input, undefined);
});

test('an old round loads with every golfer following the Armed switch', () => {
 const old = new Round({players: [{name: 'Alex', team: 'A', hand: 'RH'}, {name: 'Sam', team: 'B', hand: 'RH'}], mode: 'stroke'}).toJSON();
 for (const p of old.players) delete p.input;
 const r = Round.restore(JSON.parse(JSON.stringify(old)));
 assert.deepEqual(r.players.map(playsWith), ['monitor', 'monitor']);
});

test('the profile remembers a golfer\'s hand and way of playing', () => {
 const p = blankProfile('Sam', 1, 'p1');
 const store = {version: 2, main: 'p1', profiles: [p]};
 setProfilePlay(store, 'p1', {hand: 'LH', input: 'meter'});
 const back = normaliseProfile(JSON.parse(JSON.stringify(store.profiles[0])));
 assert.equal(back.hand, 'LH');assert.equal(back.input, 'meter');
 // An older profile has neither, and nonsense is dropped.
 const old = normaliseProfile({id: 'p2', name: 'Kim', counters: {}, bests: {}, rounds: [], hand: 'XL', input: 'joystick'});
 assert.equal(old.hand, undefined);assert.equal(old.input, undefined);
});
