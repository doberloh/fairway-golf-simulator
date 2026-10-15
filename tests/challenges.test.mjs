import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES, challenge, pickHole, closestFeet, driveYards, upDownSpots, isUpAndDown, skins, recordChallenge, normaliseRecords, feetText} from '../src/challenges.js';
import {rewardsOf} from '../src/rewards.js';

test('four challenges, opened at the levels the reward table names', () => {
 assert.deepEqual(CHALLENGES.map(c => [c.id, c.level]), [['closest', 3], ['long', 6], ['updown', 12], ['skins', 18]]);
 const table = Object.fromEntries(rewardsOf('challenge').map(r => [r.id, r.level]));
 assert.equal(table.closest, 3); assert.equal(table['long-drive'], 6); assert.equal(table['up-and-down'], 12); assert.equal(table.skins, 18);
});

test('each challenge finds its hole, or says there is none', () => {
 const holes = [{par: 4, length: 380}, {par: 5, length: 520}, {par: 3, length: 160}, {par: 5, length: 560}];
 assert.equal(pickHole(holes, 'closest'), 2);
 assert.equal(pickHole(holes, 'long'), 3, 'the longest par 5');
 assert.equal(pickHole([{par: 4, length: 380}, {par: 4, length: 440}], 'long'), 1, 'no par 5: the longest par 4');
 assert.equal(pickHole(holes, 'updown'), 0);
 assert.equal(pickHole([{par: 4}, {par: 5}], 'closest'), -1);
});

test('a ball is scored by where it stopped', () => {
 assert.equal(Math.round(closestFeet({x: 3.048, z: 0}, {x: 0, z: 0}, null)), 10);
 assert.equal(closestFeet({x: 1, z: 0}, {x: 0, z: 0}, 'Water'), null);
 assert.equal(Math.round(driveYards({x: 0, z: 0}, {x: 0, z: 274.32}, 'fairway', null)), 300);
 assert.equal(driveYards({x: 0, z: 0}, {x: 0, z: 274.32}, 'rough', null), null, 'off the fairway does not count');
 assert.equal(feetText(14.25), '14 ft 3 in');
 assert.equal(feetText(.5), '6 in');
 assert.equal(feetText(null), 'missed');
 assert.equal(isUpAndDown(2), true); assert.equal(isUpAndDown(3), false);
});

// THE DROPS: the same five for the same seed, off the green, on playable ground.
test('up-and-down drops are seeded, off the green and on ground a chip is played from', () => {
 const pin = {x: 0, z: 100}, edge = (x, z) => Math.hypot(x - pin.x, z - pin.z) - 12;
 const surface = (x, z) => x > 20 ? 'water' : 'rough';
 const a = upDownSpots({pin, surface, edge}, 'WEEK-2026-42:1'), b = upDownSpots({pin, surface, edge}, 'WEEK-2026-42:1');
 assert.equal(a.length, 5);
 assert.deepEqual(a, b);
 assert.notDeepEqual(a, upDownSpots({pin, surface, edge}, 'other'));
 for (const p of a) { const e = edge(p.x, p.z); assert.ok(e >= 2.7 && e <= 16.5, `edge ${e}`); assert.ok(p.x <= 20, 'never in the water'); }
});

test('skins: the lowest score alone wins, ties carry, and what is left over is unclaimed', () => {
 const cards = [[4, 4, 3, 5, 4], [4, 5, 4, 4, 4], [5, 4, 4, 6, 4]];
 const r = skins(cards, 5);
 assert.deepEqual(r.perHole.map(h => [h.winner, h.value]), [[null, 1], [null, 2], [0, 3], [1, 1], [null, 1]]);
 assert.deepEqual(r.won, [3, 1, 0]);
 assert.equal(r.carry, 1);
 assert.deepEqual(skins([[4, 3], [4]], 2).perHole.length, 1, 'an unfinished hole stops the count');
});

test('records keep the best, and skins add up', () => {
 const prof = {};
 assert.equal(recordChallenge(prof, 'closest', 12.3), true);
 assert.equal(recordChallenge(prof, 'closest', 15), false);
 assert.equal(recordChallenge(prof, 'closest', null), false);
 assert.equal(recordChallenge(prof, 'long', 280), true);
 assert.equal(recordChallenge(prof, 'long', 279), false);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 14}), true);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 15}), false);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 13}), true, 'fewer strokes breaks a tie');
 recordChallenge(prof, 'skins', 3); recordChallenge(prof, 'skins', 2);
 assert.deepEqual(prof.challenges.skins, {won: 5, games: 2});
 const back = normaliseRecords(JSON.parse(JSON.stringify(prof.challenges)));
 assert.equal(back.closest.feet, 12.3); assert.equal(back.updown.strokes, 13);
 assert.deepEqual(normaliseRecords({closest: {feet: -1}, long: 'x'}), {});
 assert.equal(challenge('skins').name, 'Skins game');
});

// A SKINS GAME IS A STROKE ROUND THAT SAYS SO, through a save; never for one
// golfer or another format.
test('a skins round keeps its label through a save and refuses what is not skins', async () => {
 const {Round} = await import('../src/game.js');
 const two = [{name: 'A', team: 'A'}, {name: 'B', team: 'B'}];
 const r = new Round({players: two, holes: 9, challenge: 'skins'});
 assert.equal(Round.restore(JSON.parse(JSON.stringify(r.toJSON()))).challenge, 'skins');
 assert.throws(() => new Round({holes: 9, challenge: 'skins'}), /two to four/);
 assert.throws(() => new Round({players: two, mode: 'match', holes: 9, challenge: 'skins'}), /stroke play/);
 assert.throws(() => new Round({players: two, holes: 9, challenge: 'closest'}), /skins/);
 assert.equal(new Round({holes: 9}).challenge, '');
});
