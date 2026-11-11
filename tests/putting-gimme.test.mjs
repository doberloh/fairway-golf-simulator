// THE GIMME CIRCLE (putting.js, 10 November 2026): one circle round the cup,
// its size set by the player in feet. A ball resting on the green inside it is
// picked up for one more stroke; outside it the golfer putts out.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../src/game.js';
import {awardedPutts, puttingConfig, puttingRings, puttingFieldsFor, puttingName, awardWords, PUTTING_MODES, GIMME, FOOT, DEFAULT_PUTTING} from '../src/putting.js';
import {YARD} from '../src/physics.js';

const pin = {x: 0, z: 100};
// A ball stopped `feet` from the cup, on the green unless told otherwise.
const rest = (feet, onGreen = true) => ({end: {x: feet * FOOT, z: 100}, holed: false, onGreen});
const solo = [{name: 'A', team: 'A', hand: 'RH'}];

test('a foot is a third of a yard', () => {
 assert.ok(Math.abs(FOOT - 0.3048) < 1e-12);
 assert.ok(PUTTING_MODES.includes('gimme'));
});

test('inside the circle is one putt, outside is none, and the edge counts as inside', () => {
 const c = {mode: 'gimme', gimme: 3};
 assert.equal(awardedPutts(0.5 * FOOT, true, c), 1);
 assert.equal(awardedPutts(3 * FOOT, true, c), 1);
 assert.equal(awardedPutts(3.01 * FOOT, true, c), 0);
 assert.equal(awardedPutts(40 * FOOT, true, c), 0, 'a long putt is played, never given 2 or 3');
 // Only a ball resting on the green, as with the other automatic modes.
 assert.equal(awardedPutts(1 * FOOT, false, c), 0);
 // The size the player set is the size used.
 assert.equal(awardedPutts(8 * FOOT, true, {mode: 'gimme', gimme: 10}), 1);
 assert.equal(awardedPutts(8 * FOOT, true, {mode: 'gimme', gimme: 6}), 0);
});

test('the circle size is checked and defaults to 3 ft', () => {
 assert.equal(DEFAULT_PUTTING.gimme, 3);
 assert.equal(puttingConfig({mode: 'gimme'}).gimme, GIMME.def);
 assert.equal(puttingConfig({mode: 'gimme', gimme: GIMME.min}).gimme, GIMME.min);
 assert.equal(puttingConfig({mode: 'gimme', gimme: GIMME.max}).gimme, GIMME.max);
 for (const bad of [0, GIMME.min - .1, GIMME.max + .1, NaN, Infinity, '3']) assert.throws(() => puttingConfig({mode: 'gimme', gimme: bad}), /gimme circle/);
 // The ring distances keep their own checks in this mode too.
 assert.throws(() => puttingConfig({mode: 'gimme', one: 10, two: 5}));
});

test('a round saved before the gimme circle loads, with the circle at its default', () => {
 // A save written by 0.9.12: putting carries no `gimme`.
 const old = JSON.parse(JSON.stringify(new Round({players: solo, putting: {mode: 'dartboard', one: 3, two: 10, three: 20}})));
 delete old.putting.gimme;
 const r = Round.restore(old);
 assert.equal(r.putting.mode, 'dartboard');
 assert.equal(r.putting.gimme, GIMME.def);
 // And a round in the new mode survives a save and restore with its size.
 const g = new Round({players: solo, putting: {mode: 'gimme', gimme: 4.5}});
 const back = Round.restore(JSON.parse(JSON.stringify(g)));
 assert.deepEqual([back.putting.mode, back.putting.gimme], ['gimme', 4.5]);
});

test('a ball inside the circle finishes the hole for one more stroke', () => {
 const r = new Round({players: solo, putting: {mode: 'gimme', gimme: 3}});
 r.takeShot(rest(30), pin); // the approach: 30 ft away, putt on
 assert.equal(r.done[0], false);
 const e = r.takeShot({...rest(2), puttStroke: true}, pin); // the putt stops 2 ft away: given
 assert.equal(e.putts, 1);
 assert.equal(e.complete, true);
 assert.equal(r.cards[0][0], 3, 'approach, putt, and the gimme');
 assert.equal(r.puttCards[0][0], 2, 'the putt played and the gimme; the approach is not a putt');
});

test('outside the circle the golfer putts out, and a holed putt is not given an extra stroke', () => {
 const r = new Round({players: solo, putting: {mode: 'gimme', gimme: 3}});
 r.takeShot(rest(6), pin);
 assert.equal(r.done[0], false);
 const e = r.takeShot({end: {...pin}, holed: true, onGreen: true, puttStroke: true}, pin);
 assert.equal(e.putts, 0);
 assert.equal(r.cards[0][0], 2);
});

test('in a scramble the team picks the lie, and a lie inside the circle is given', () => {
 const r = new Round({players: [{name: 'A', team: 'A'}, {name: 'B', team: 'A'}], mode: 'scramble', putting: {mode: 'gimme', gimme: 3}});
 r.takeShot(rest(20), pin);
 r.takeShot(rest(1), pin);
 assert.ok(r.scrambleSelection);
 r.chooseScramble(1);
 assert.equal(r.teamCards.A[0], 2, 'one shot and the gimme');
});

test('one ring is drawn, the circle itself, in metres', () => {
 const rings = puttingRings({mode: 'gimme', gimme: 3});
 assert.equal(rings.length, 1);
 assert.ok(Math.abs(rings[0].radius - 3 * 0.3048) < 1e-9);
 assert.equal(puttingRings({mode: 'holeout'}).length, 0);
 assert.deepEqual(puttingRings({mode: 'dartboard', one: 2, two: 8, three: 16}).map(r => r.radius), [2 * YARD, 8 * YARD, 16 * YARD]);
});

test('the menus show the circle field for the gimme circle and the ring distances for the ring modes', () => {
 assert.deepEqual(puttingFieldsFor('gimme'), {rings: false, gimme: true});
 assert.deepEqual(puttingFieldsFor('dartboard'), {rings: true, gimme: false});
 assert.deepEqual(puttingFieldsFor('decimal'), {rings: true, gimme: false});
 assert.deepEqual(puttingFieldsFor('holeout'), {rings: false, gimme: false});
});

test('the mode is named in words', () => {
 assert.equal(puttingName({mode: 'gimme', gimme: 2.5}), 'gimme circle (2.5 ft)');
 assert.equal(puttingName({mode: 'holeout'}), 'hole out');
 assert.equal(puttingName({mode: 'dartboard', one: 3, two: 10, three: 20}), 'dartboard putting (3/10/20 yd)');
 assert.deepEqual(awardWords(1, {mode: 'gimme', gimme: 3}), {title: 'Gimme', line: 'Inside the 3 ft gimme circle · one putt added.'});
 assert.equal(awardWords(2, {mode: 'dartboard'}).title, '2 putts awarded');
});
