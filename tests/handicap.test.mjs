import test from 'node:test';
import assert from 'node:assert/strict';
import {courseRating, slopeRating, strokesReceived, courseHandicap, adjustedGross, differential, handicapIndex, simHandicap} from '../src/handicap.js';

// A plain 6,500-yard par 72: four par 3s at 180, ten par 4s at 368, four par 5s at 525.
const card = score => [...Array(4).fill({par: 3, yards: 180}), ...Array(10).fill({par: 4, yards: 368}), ...Array(4).fill({par: 5, yards: 525})]
 .map((h, i) => ({...h, score: typeof score === 'function' ? score(h, i) : h.par + score}));

test('a course is rated from its length the way the USGA yardage formula rates it', () => {
 // 6,500 / 220 + 40.9 = 70.45; the bogey gap gives a slope near the standard 113.
 assert.ok(Math.abs(courseRating(6500) - 70.45) < 0.01);
 assert.equal(slopeRating(6500), 112);
 // A longer course is harder for everyone, and harder still for a bogey golfer.
 assert.ok(courseRating(7200) > courseRating(6500));
 assert.ok(slopeRating(7200) > slopeRating(6500));
 // A nine played twice is rated as the eighteen of twice its length.
 assert.ok(Math.abs(courseRating(3250, 9) * 2 - courseRating(6500)) < 1e-9);
 assert.equal(slopeRating(3250, 9), slopeRating(6500));
 // Slope never leaves the published 55-155 range.
 assert.equal(slopeRating(30000), 155);
});

test('a first score is capped at par plus five on every hole', () => {
 const blowup = card((h, i) => i === 0 ? 12 : h.par);
 // 12 on a par 3 counts as 8.
 assert.equal(adjustedGross(blowup, null), 72 + 5);
});

test('with an index the cap is net double bogey, strokes on the hardest holes first', () => {
 const strokes = strokesReceived(card(0), 20);
 assert.equal(strokes.reduce((a, b) => a + b, 0), 20);
 // Twenty strokes over eighteen holes: everyone gets one, two holes get two,
 // and those are the longest per par stroke -- the 525-yard par 5s, at 105
 // yards a stroke against 92 for the par 4s and 60 for the par 3s.
 assert.equal(Math.max(...strokes), 2);
 assert.deepEqual([strokes[14], strokes[15], strokes[16], strokes[0]], [2, 2, 1, 1]);
 // A plus handicap gives strokes back.
 assert.equal(strokesReceived(card(0), -2).reduce((a, b) => a + b, 0), -2);
 // An 18 handicap playing a 10 on a par 4 counts it as 4 + 2 + 1 = 7.
 const one = card((h, i) => i === 4 ? 10 : h.par);
 const ch = courseHandicap(18, {yards: 6500, par: 72, holes: 18});
 assert.ok(ch >= 16 && ch <= 18);
 assert.equal(adjustedGross(one, 18), 72 + 3);
});

test('the differential is the adjusted score against the rating, on the 113 scale', () => {
 // Level par on a course rated 70.45 / 112: (72 - 70.45) x 113 / 112 = 1.6.
 assert.equal(differential(card(0)), 1.6);
 // Bogey golf.
 assert.equal(differential(card(1)), 19.7);
 // Only 9 and 18 hole rounds have one.
 assert.equal(differential(card(0).slice(0, 3)), null);
});

test('a nine is made eighteen with the expected score for the nine not played', () => {
 const nine = card(1).slice(0, 9);
 const own = differential(nine, 10);
 // 0.52 x 10 + 1.2 = 6.4 added to the nine's own differential.
 const alone = differential(nine, null) / 2;
 assert.ok(Math.abs(own - (alone + 6.4)) < 0.15);
});

test('the index follows the WHS table for fewer than twenty scores', () => {
 assert.equal(handicapIndex([10, 12]), null);
 assert.equal(handicapIndex([10, 12, 14]), 8);         // lowest 1, minus 2
 assert.equal(handicapIndex([10, 12, 14, 9]), 8);      // lowest 1, minus 1
 assert.equal(handicapIndex([10, 12, 14, 9, 20, 8]), 7.5); // lowest 2 averaged, minus 1
 const twenty = Array.from({length: 25}, (_, i) => i);
 // Only the most recent twenty (5..24), best eight of them: 5..12 averages 8.5.
 assert.equal(handicapIndex(twenty), 8.5);
 assert.equal(handicapIndex([90, 90, 90]), 54);
});

test('a history is replayed in order, each round capped by the index held at the time', () => {
 const rounds = Array.from({length: 5}, () => ({holes: card(1)}));
 const h = simHandicap(rounds);
 assert.equal(h.rounds, 5);
 assert.equal(h.index, 19.7);
 assert.equal(h.needed, 0);
 assert.equal(simHandicap(rounds.slice(0, 2)).needed, 1);
 assert.equal(simHandicap([]).index, null);
});
