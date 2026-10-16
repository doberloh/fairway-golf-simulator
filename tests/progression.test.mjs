// XP and levels (Phase 4, 14 October 2026). The amounts are the agreed spec's,
// placed; RESEARCH.md *XP and levels*.
import test from 'node:test';
import assert from 'node:assert/strict';
import {XP, XP_MULT, levelCost, levelOf, holeXp, shotXp, onTheNumber, roundXp, withMult, award, takeBack, hasOnNumber,
 dailyXp, rangeXp, LEVEL_CAP_COST, LEDGER_SIZE} from '../src/progression.js';
import {normalise, PROFILE_VERSION, blankProfile} from '../src/profile.js';

test('the amounts are the owner\'s: albatross 250, hole in one 300, daily 100', () => {
 assert.equal(XP.albatross, 250);assert.equal(XP.ace, 300);assert.equal(XP.daily, 100);
 assert.deepEqual(XP_MULT, {easy: .75, normal: 1, hard: 1.5, monitor: 1});
});

test('levels: 400 to level 2, 50 more each, then 2,850 for ever from level 50', () => {
 assert.equal(levelCost(1), 400);assert.equal(levelCost(2), 450);assert.equal(levelCost(49), 2800);
 assert.equal(levelCost(50), LEVEL_CAP_COST);assert.equal(levelCost(500), LEVEL_CAP_COST);
 assert.deepEqual(levelOf(0), {level: 1, into: 0, need: 400});
 assert.deepEqual(levelOf(400), {level: 2, into: 0, need: 450});
 assert.equal(levelOf(78399).level, 49);
 assert.deepEqual(levelOf(78400), {level: 50, into: 0, need: 2850});
 assert.equal(levelOf(78400 + 2850 * 100).level, 150, 'levels never end');
 assert.equal(levelOf(-5).level, 1);
});

test('a hole: 10, the score, a fairway and a green; an ace replaces the rest', () => {
 assert.equal(holeXp({strokes: 4, par: 4}), 20);
 assert.equal(holeXp({strokes: 3, par: 4, fairway: true, gir: true}), 50);
 assert.equal(holeXp({strokes: 3, par: 5}), 90, 'eagle');
 assert.equal(holeXp({strokes: 2, par: 5}), 260, 'albatross');
 assert.equal(holeXp({strokes: 1, par: 4}), 310, 'a hole in one on a par 4 is an ace, not an albatross as well');
 assert.equal(holeXp({strokes: 6, par: 4}), 10, 'a double still finished the hole');
 assert.equal(holeXp({strokes: 3.6, par: 4}), 20, 'decimal putting is named by the nearest stroke');
 assert.equal(holeXp({strokes: NaN, par: 4}), 0);
});

test('a shot: On the number within 5%, never a putt; chip-ins, long putts and bests', () => {
 assert.ok(onTheNumber({x: 0, z: 147}, {x: 0, z: 150}, 150));
 assert.ok(!onTheNumber({x: 0, z: 141}, {x: 0, z: 150}, 150));
 assert.equal(shotXp({onNumber: true}), 5);
 assert.equal(shotXp({onNumber: true, putt: true}), 0);
 assert.equal(shotXp({holed: true}), 25, 'a chip-in');
 assert.equal(shotXp({holed: true, teeShot: true}), 0, 'a hole in one is the hole\'s XP, not a chip-in as well');
 assert.equal(shotXp({holed: true, fromGreen: true, puttFeet: 31}), 25);
 assert.equal(shotXp({holed: true, fromGreen: true, puttFeet: 12}), 0);
 assert.equal(shotXp({bests: 2}), 80);
 assert.equal(withMult(25, 1.5), 38);assert.equal(withMult(25, .75), 19);
 assert.equal(roundXp(18), 100);assert.equal(roundXp(9), 50);assert.equal(roundXp(3), 0);
});

test('the ledger pays a thing once, re-scores it, and a mulligan takes a stroke\'s XP back', () => {
 const p = {xp: 0};
 award(p, 'r1:h0', 20);award(p, 'r1:h0', 20);
 assert.equal(p.xp, 20, 'the same hole saved twice pays once');
 award(p, 'r1:h0', 50);assert.equal(p.xp, 50, 're-scored');
 award(p, 'r1:h1:s1:number', 5, {stroke: 1});award(p, 'r1:h1:s2:shot', 25, {stroke: 2});
 assert.ok(hasOnNumber(p, 'r1:h1:', 3), 'once a hole');
 assert.ok(!hasOnNumber(p, 'r1:h1:', 1), 'the stroke that earned it may be re-awarded');
 takeBack(p, 'r1:h1:', 2);
 assert.equal(p.xp, 55, 'the mulligan took back stroke 2 and left stroke 1');
 award(p, 'r1:h0', 0);assert.equal(p.xp, 5, 'a hole un-holed pays nothing');
 for (let i = 0; i < LEDGER_SIZE + 20; i++) award(p, 'k' + i, 1);
 assert.equal(Object.keys(p.xpLog).length, LEDGER_SIZE, 'the ledger keeps the newest');
});

test('the daily first round, once a day; the range, two a time up to fifty a day', () => {
 const p = {xp: 0}, day = new Date(2026, 9, 14, 9).getTime();
 assert.equal(dailyXp(p, day), 100);assert.equal(dailyXp(p, day + 3600e3), 0);
 assert.equal(dailyXp(p, day + 86400e3), 100);
 const q = {xp: 0};let got = 0;
 for (let i = 0; i < 40; i++) got += rangeXp(q, day);
 assert.equal(got, 50);assert.equal(rangeXp(q, day + 86400e3), 2);
});

test('an existing profile loads at level 1, nothing lost, with the "XP is new" note', () => {
 assert.equal(PROFILE_VERSION, 3);
 const v2 = {version: 2, main: 'p1', profiles: [{id: 'p1', name: 'Tester', counters: {shots: 42}, bests: {ballSpeed: 150}, rounds: [], removed: []}]};
 const s = normalise(v2), p = s.profiles[0];
 assert.equal(s.version, 3);
 assert.equal(p.xp, 0);assert.equal(levelOf(p.xp).level, 1);assert.equal(p.xpNew, true);
 assert.equal(p.counters.shots, 42);assert.equal(p.bests.ballSpeed, 150);
 assert.equal(blankProfile('New', 1, 'p9').xpNew, undefined, 'a new golfer never needs the note');
 // A version 3 record keeps its XP and ledger.
 const v3 = normalise({version: 3, main: 'p1', profiles: [{...p, xp: 1234, xpLog: {'r:h0': {xp: 20, at: 5}}, xpNew: false}]});
 assert.equal(v3.profiles[0].xp, 1234);assert.deepEqual(v3.profiles[0].xpLog, {'r:h0': {xp: 20, at: 5}});
 assert.equal(v3.profiles[0].xpNew, undefined);
});
