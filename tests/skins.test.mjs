import test from 'node:test';
import assert from 'node:assert/strict';
import {skins, decidedHoles, skinsWinner, holeSkinLine, skinsStatus, ordinal, skinsText} from '../src/skins.js';

const names = ['Alex', 'Bo', 'Cy'];

test('the lowest score alone wins, every tie carries, and the carry is paid to the next winner', () => {
 const cards = [[4, 4, 3, 5, 4], [4, 5, 4, 4, 4], [5, 4, 4, 6, 4]];
 const r = skins(cards, 5);
 assert.deepEqual(r.perHole.map(h => [h.winner, h.value]), [[null, 1], [null, 2], [0, 3], [1, 1], [null, 1]]);
 assert.deepEqual(r.won, [3, 1, 0]);
 assert.equal(r.carry, 1, 'the last hole tied');
 assert.equal(r.worth, 2);
 assert.deepEqual(r.perHole[0].tied, [0, 1], 'who tied for lowest');
});

test('one tie, all tie: two of four sharing the low score carries, however the others did', () => {
 const r = skins([[3], [3], [5], [6]], 1);
 assert.equal(r.perHole[0].winner, null);
 assert.equal(r.carry, 1);
 const four = skins([[4, 4], [4, 4], [4, 4], [4, 3]], 2);
 assert.deepEqual(four.won, [0, 0, 0, 2], 'a four-way tie carries to the next');
});

test('nothing is decided on a hole still being played', () => {
 const cards = [[4, 3], [4]];
 assert.equal(skins(cards, 1).perHole.length, 1);
 assert.equal(decidedHoles({hole: 1, holeComplete: false}), 1);
 assert.equal(decidedHoles({hole: 1, holeComplete: true}), 2);
 assert.equal(decidedHoles({hole: 0, holeComplete: false}), 0);
 assert.deepEqual(skins(cards, 0), {won: [0, 0], perHole: [], carry: 0, worth: 1});
});

// A GOLFER WHO JOINS MID-ROUND has no score on the holes before. The challenge
// version stopped counting at the first such hole, which froze every skin
// after it; now those holes are decided among the golfers who played them.
test('a golfer joining mid-round plays for skins from the hole they join', () => {
 const cards = [[4, 5, 4, 3], [5, 4, 4, 4], [, , 3, 4]];
 const r = skins(cards, 4);
 assert.deepEqual(r.perHole.map(h => h.winner), [0, 1, 2, 0]);
 assert.deepEqual(r.won, [2, 1, 1]);
});

test('decimal putting scores compare to two decimals', () => {
 assert.deepEqual(skins([[4.5], [4.75]], 1).won, [1, 0]);
 assert.equal(skins([[0.1 + 0.2 + 4], [4.3]], 1).perHole[0].winner, null, 'float noise does not split a tie');
});

test('the winner is the most skins alone; a tie on skins wins nobody', () => {
 assert.equal(skinsWinner([3, 1, 0]), 0);
 assert.equal(skinsWinner([2, 2, 1]), -1);
 assert.equal(skinsWinner([0, 0]), -1);
});

test('what the banner and the scorecard say', () => {
 const r = skins([[4, 4, 3], [4, 5, 4], [5, 4, 4]], 3);
 assert.equal(holeSkinLine(r.perHole[0], names, 0, false), 'Tied · 1 skin carries to the 2nd');
 assert.equal(holeSkinLine(r.perHole[1], names, 1, false), 'Tied · 2 skins carry to the 3rd');
 assert.equal(holeSkinLine(r.perHole[2], names, 2, true), 'Alex wins 3 skins');
 assert.equal(holeSkinLine({winner: null, value: 4, tied: [0, 1]}, names, 8, true), 'Tied · 4 skins go unclaimed');
 assert.equal(holeSkinLine({winner: null, value: 1, tied: [0, 1]}, names, 8, true), 'Tied · 1 skin goes unclaimed');
 assert.equal(holeSkinLine(undefined, names, 0, false), '');
 assert.equal(skinsStatus(names, {won: [3, 1, 0], carry: 2}), 'Skins: Alex 3 · Bo 1 · Cy 0 · 2 carried');
 assert.equal(skinsStatus(names, {won: [5, 1, 0], carry: 3}, {finished: true, holes: 9}), 'Alex wins the skins · 5 of 9 · 3 unclaimed');
 assert.equal(skinsStatus(names, {won: [4, 4, 1], carry: 0}, {finished: true, holes: 9}), 'Alex & Bo tie · 4 skins each');
 assert.equal(skinsStatus(names, {won: [0, 0, 0], carry: 9}, {finished: true, holes: 9}), 'No skins won · 9 unclaimed');
 assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd', '111th']);
 assert.equal(skinsText(1), '1 skin');
});

// THE FORMAT IN THE ROUND (game.js): two to four golfers, played like stroke
// play, and a save from the Skins challenge resumes as a skins round.
const PIN = {x: 0, z: 200};
const shot = (x, z) => ({end: {x, z}, holed: false, onGreen: false});
const holeOut = {end: {...PIN}, holed: true, onGreen: false};
const two = [{name: 'Alex', team: 'A'}, {name: 'Bo', team: 'A'}];
function holeOutIn(r, strokes) { for (let s = 1; s < strokes; s++) r.takeShot(shot(0, s * 10), PIN); return r.takeShot(holeOut, PIN); }

test('a skins round is two to four golfers, and never drops below two', async () => {
 const {Round} = await import('../src/game.js');
 assert.throws(() => new Round({holes: 9, mode: 'skins'}), /two to four/);
 const r = new Round({players: two, holes: 9, mode: 'skins'});
 assert.equal(r.mode, 'skins');
 assert.throws(() => r.setPlayers([{...two[0], seat: 0}]), /two to four/);
 assert.equal(new Round({players: two, holes: 9, mode: 'skins', endless: true}).endless, true, 'an endless run can be skins');
 assert.equal(Round.restore(JSON.parse(JSON.stringify(r.toJSON()))).mode, 'skins');
});

test('skins is played like stroke play: each golfer holes out, honours to the lowest', async () => {
 const {Round} = await import('../src/game.js');
 const r = new Round({players: two, holes: 9, mode: 'skins'});
 r.takeShot(shot(0, 100), PIN);
 assert.equal(r.active, 0, 'the same golfer plays on');
 holeOutIn(r, 4);
 assert.equal(r.active, 1);
 holeOutIn(r, 3);
 assert.ok(r.holeComplete && !r.finished);
 assert.equal(decidedHoles(r), 1);
 assert.deepEqual(skins(r.cards, decidedHoles(r)).won, [0, 1]);
 r.nextHole();
 assert.equal(r.active, 1, 'Bo has honours');
});

// A SAVE FROM BEFORE: stroke play with `challenge: 'skins'`, in the Continue
// slot, the saved rounds or an export, its mulligan snapshots the same.
test('a Skins challenge save resumes as a skins round with the same skins, mulligans too', async () => {
 const {Round} = await import('../src/game.js');
 const r = new Round({players: two, holes: 9});
 holeOutIn(r, 4); holeOutIn(r, 5); r.nextHole();
 r.takeShot(shot(0, 50), PIN);
 const old = JSON.parse(JSON.stringify({...r.toJSON(), challenge: 'skins', history: r.history.map(h => ({...h, challenge: 'skins'}))}));
 const back = Round.restore(old);
 assert.equal(back.mode, 'skins');
 assert.equal('challenge' in back.toJSON(), false, 'the old label is gone once upgraded');
 assert.deepEqual(skins(back.cards, decidedHoles(back)).won, [1, 0]);
 assert.equal(back.mulligan(), true);
 assert.equal(back.mode, 'skins', 'a mulligan snapshot comes back as skins too');
 assert.equal(Round.restore({...JSON.parse(JSON.stringify(r.toJSON())), challenge: ''}).mode, 'stroke', 'every other old save is stroke as it was');
 assert.throws(() => Round.restore({...JSON.parse(JSON.stringify(r.toJSON())), mode: 'match', challenge: 'skins'}), /skins/);
});
