import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeToPar, parText, parSide, parTint, holeScoreName, PAR_LIMIT} from '../src/scoring.js';

const PARS = [4, 5, 3, 4, 4, 3, 5, 4, 4];
const alpha = tint => Number(tint.match(/,([\d.]+)\)$/)[1]);

test('only holes that have actually been completed count against par', () => {
 // Three holes in: bogey, birdie, par. A fourth hole in progress cannot be on
 // the card yet, and holes never reached are undefined rather than zero.
 const card = [5, 4, 3];
 const {rel, played} = relativeToPar(card, PARS);
 assert.equal(played, 3);
 assert.equal(rel, 0);

 // A blow-up on the hole being played must not move the number until it is
 // holed out -- the player can still make par from there.
 assert.deepEqual(relativeToPar([5, 4, 3], PARS), relativeToPar([5, 4, 3, undefined], PARS));
});

test('a sparse card scores only the holes it holds', () => {
 const card = [];
 card[4] = 6; // a double on the fifth, nothing else played
 const {rel, played} = relativeToPar(card, PARS);
 assert.equal(played, 1);
 assert.equal(rel, 2);
});

test('an empty card is level par with nothing played', () => {
 assert.deepEqual(relativeToPar([], PARS), {rel: 0, played: 0});
 assert.deepEqual(relativeToPar(undefined, PARS), {rel: 0, played: 0});
});

test('decimal putting scores do not leave float noise in the total', () => {
 // 0.1 + 0.2 is the classic: summed naively this is 3.0000000000000004.
 const {rel} = relativeToPar([4.1, 5.2, 3.7], PARS);
 assert.equal(rel, 1);
});

test('par reads as E, and either side of it carries its sign', () => {
 assert.equal(parText(0), 'E');
 assert.equal(parText(3), '+3');
 assert.equal(parText(-2), '-2');
 assert.equal(parText(1.5), '+1.5');
});

test('colour means something happened, so level par is never tinted', () => {
 assert.equal(parTint(0, 9), '');
 assert.equal(parTint(4, 0), '');
 assert.equal(parSide(0, 9), 'even');
 assert.equal(parSide(4, 0), 'even');
});

test('over par goes red, under par goes green, and neither is ambiguous', () => {
 assert.match(parTint(3, 3), /^rgba\(193,57,42,/);
 assert.match(parTint(-3, 3), /^rgba\(64,146,80,/);
 assert.equal(parSide(3, 3), 'over');
 assert.equal(parSide(-3, 3), 'under');
});

test('the tint deepens with the score and then stops', () => {
 const ramp = [1, 3, 5, 7, 9].map(n => alpha(parTint(n, 9)));
 for (let i = 1; i < ramp.length; i++)
  assert.ok(ramp[i] > ramp[i - 1], `${ramp[i]} should be deeper than ${ramp[i - 1]}`);

 // Past the limit it holds, rather than running to opaque and burying the text.
 const capped = alpha(parTint(PAR_LIMIT, 9));
 assert.equal(alpha(parTint(PAR_LIMIT + 14, 9)), capped);
 assert.ok(capped < 1);

 // Both directions ramp identically, so +4 and -4 read as equally far out.
 assert.equal(alpha(parTint(4, 9)), alpha(parTint(-4, 9)));
});

test('one over par is already visible rather than starting from nothing', () => {
 assert.ok(alpha(parTint(1, 1)) >= .2);
});

test('a hole score is called what a golfer would call it', () => {
 assert.equal(holeScoreName(3, 4), 'Birdie');
 assert.equal(holeScoreName(4, 4), 'Par');
 assert.equal(holeScoreName(5, 4), 'Bogey');
 assert.equal(holeScoreName(6, 4), 'Double bogey');
 assert.equal(holeScoreName(2, 4), 'Eagle');
 assert.equal(holeScoreName(2, 5), 'Albatross');
});

test('an ace is an ace, whatever the arithmetic would otherwise call it', () => {
 // One on a par 3 is a birdie by subtraction, and nobody has ever called it that.
 assert.equal(holeScoreName(1, 3), 'Hole in one');
 assert.equal(holeScoreName(1, 4), 'Hole in one');
 assert.equal(holeScoreName(1, 5), 'Hole in one');
});

test('a score far outside the named range falls back to the number', () => {
 assert.equal(holeScoreName(12, 4), '+8');
});

test('a fractional score has no name, because there is no such thing', () => {
 // Decimal putting can award 2.4 strokes; "two-point-four over" is not a word.
 assert.equal(holeScoreName(6.4, 4), '');
 assert.equal(holeScoreName(undefined, 4), '');
 assert.equal(holeScoreName(4, undefined), '');
});
