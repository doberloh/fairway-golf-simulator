import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES, challenge, pickHole, closestFeet, driveYards, upDownSpots, isUpAndDown, recordChallenge, normaliseRecords, feetText} from '../src/challenges.js';
import {rewardsOf} from '../src/rewards.js';

// ALL OPEN FROM THE START (the owner, 15 October 2026), and the reward table
// agrees, so no level-up banner announces one.
test('three challenges, all open at level 1, as the reward table says', () => {
 assert.deepEqual(CHALLENGES.map(c => [c.id, c.level]), [['closest', 1], ['long', 1], ['updown', 1]]);
 const table = Object.fromEntries(rewardsOf('challenge').map(r => [r.id, r.level]));
 assert.equal(table.closest, 1); assert.equal(table['long-drive'], 1); assert.equal(table['up-and-down'], 1); assert.equal(table.skins, undefined);
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

// Skins is a round format now; its rule is tested in skins.test.mjs. Its
// record is still kept here, with the challenges'.
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
 assert.equal(back.skins.won, 5, 'the skins record survives a reload');
 assert.deepEqual(normaliseRecords({closest: {feet: -1}, long: 'x'}), {});
 assert.equal(challenge('skins'), null, 'skins is a round format, not a challenge');
});
