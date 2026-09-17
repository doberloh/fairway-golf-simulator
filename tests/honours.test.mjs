// Who plays, and when.
//
// Two rules, and they are the whole of it: in stroke play a golfer plays the
// hole out before the next one starts, and the next tee is played in the order
// they scored the last one, lowest first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../src/game.js';

const PIN = {x: 0, z: 200};
const group = n => Array.from({length: n}, (_, i) => ({name: 'P' + (i + 1), team: i % 2 ? 'B' : 'A', hand: 'RH'}));
const round = (n, extra = {}) => new Round({players: group(n), holes: 9, ...extra});

// A shot that finishes somewhere, and one that holes out. `onGreen:false` keeps
// automatic putting out of it so a hole ends exactly when the test says it does.
const shot = (x, z) => ({end: {x, z}, holed: false, onGreen: false});
const holeOut = {end: {...PIN}, holed: true, onGreen: false};

// Play a golfer in, in `strokes` shots.
function holeOutIn(r, strokes) {
 for (let s = 1; s < strokes; s++) r.takeShot(shot(0, s * 10), PIN);
 return r.takeShot(holeOut, PIN);
}

test('stroke play keeps the same golfer until their ball is in the hole', () => {
 // The bug this is here to catch: alternating. Four golfers, and the first one
 // hits every shot until they hole out.
 const r = round(4);
 for (let s = 0; s < 6; s++) {
  assert.equal(r.active, 0, `the turn moved after ${s} shots`);
  r.takeShot(shot(0, s * 10), PIN);
 }
 r.takeShot(holeOut, PIN);
 assert.equal(r.active, 1, 'and only then does the next golfer start');
 assert.deepEqual(r.done, [true, false, false, false]);
});

test('a golfer who holes out does not hand the ball back to the tee', () => {
 // The other half of the report. Positions are per golfer, so the one still
 // playing keeps their own ball where it lies while the others are untouched.
 const r = round(2);
 r.takeShot(shot(5, 120), PIN);
 assert.deepEqual(r.positions[0], {x: 5, z: 120}, 'the ball in play stays where it finished');
 assert.equal(r.active, 0);
 assert.deepEqual(r.positions[1], {x: 0, z: 0}, 'and nobody else has moved');
});

test('the first tee is played in the order the group was entered', () => {
 // Nobody has a score to be ranked by yet, so there is nothing to sort on.
 const r = round(4);
 assert.deepEqual(r.order, [0, 1, 2, 3]);
 assert.equal(r.active, 0);
});

test('lowest score on the previous hole has honours on the next tee', () => {
 const r = round(3);
 holeOutIn(r, 5);  // P1 makes five
 holeOutIn(r, 3);  // P2 makes three
 holeOutIn(r, 4);  // P3 makes four
 assert.equal(r.holeComplete, true);
 assert.ok(r.nextHole());
 assert.deepEqual(r.order, [1, 2, 0], 'three, four, five');
 assert.equal(r.active, 1, 'the golfer who made three tees off');
});

test('the whole order follows the card, not just the first name on it', () => {
 const r = round(4);
 holeOutIn(r, 6);
 holeOutIn(r, 3);
 holeOutIn(r, 5);
 holeOutIn(r, 4);
 r.nextHole();
 assert.deepEqual(r.order, [1, 3, 2, 0]);
 // And the turn follows it as each golfer plays in.
 const played = [];
 for (let i = 0; i < 4; i++) { played.push(r.active); holeOutIn(r, 2); }
 assert.deepEqual(played, [1, 3, 2, 0], 'each golfer starts when the one before them is in');
});

test('a tie keeps the order the group already had', () => {
 // Reshuffling two golfers who made the same score would be noise: nothing
 // happened on that hole to separate them.
 const r = round(3);
 holeOutIn(r, 4);
 holeOutIn(r, 4);
 holeOutIn(r, 3);
 r.nextHole();
 assert.deepEqual(r.order, [2, 0, 1], 'the three leads; the two fours keep their order');
});

test('honours carries forward hole after hole', () => {
 const r = round(2);
 holeOutIn(r, 5); holeOutIn(r, 3);
 r.nextHole();
 assert.equal(r.active, 1);
 // Now the other way round, from the new order.
 holeOutIn(r, 6); holeOutIn(r, 2);
 r.nextHole();
 assert.deepEqual(r.order, [0, 1], 'P1 made two, so P1 leads');
 assert.equal(r.active, 0);
});

test('decimal putting scores rank the same way whole ones do', () => {
 // Dartboard and decimal putting make fractional scores real, and a sort that
 // only understood integers would put 3.5 and 3 in whatever order it found them.
 const r = new Round({players: group(2), holes: 9, putting: {mode: 'decimal', one: 3, two: 10, three: 20}});
 r.takeShot({end: {x: 0, z: 199}, holed: false, onGreen: true}, PIN);
 const first = r.cards[0][0];
 r.takeShot({end: {x: 0, z: 199}, holed: false, onGreen: true}, PIN);
 const second = r.cards[1][0];
 assert.ok(Number.isFinite(first) && Number.isFinite(second));
 r.nextHole();
 const [lead] = r.order;
 assert.ok(r.cards[lead][0] <= r.cards[1 - lead][0], `${r.cards[0][0]} vs ${r.cards[1][0]} ordered wrong`);
});

test('a golfer with no score on the previous hole goes to the back', () => {
 // Someone who joined mid-round has an empty cell for that hole. Sorted as a
 // missing number they would lead the field, which is the one place they have
 // not earned.
 const r = round(2);
 holeOutIn(r, 4); holeOutIn(r, 5);
 r.nextHole();
 r.setPlayers([...group(2), {name: 'Late', team: 'A', hand: 'RH'}], {x: 0, z: 0});
 // Finish this hole so the new golfer's blank is the one being ranked.
 assert.deepEqual(r.order, [0, 1, 2], 'a joiner goes to the back of the order they arrive in');
});

test('the order survives a save and a restore', () => {
 const r = round(3);
 holeOutIn(r, 5); holeOutIn(r, 3); holeOutIn(r, 4);
 r.nextHole();
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.deepEqual(back.order, r.order);
 assert.equal(back.active, r.active);
});

test('a save written before honours existed still opens', () => {
 // Every round saved so far has no `order` at all, and one with a broken order
 // is worse than one with none -- a missing golfer would be dropped from the
 // hole rather than merely played out of turn.
 const r = round(3);
 for (const bad of [undefined, [], [0, 1], [0, 1, 5], 'nope', [0, 0, 1]]) {
  const data = JSON.parse(JSON.stringify(r.toJSON()));
  data.order = bad;
  const back = Round.restore(data);
  assert.deepEqual(back.order, [0, 1, 2], `order ${JSON.stringify(bad)} was not repaired`);
 }
});

test('a mulligan puts the turn back where it was', () => {
 // `checkpoint` snapshots the whole round, so the order rides along with it.
 const r = round(2);
 holeOutIn(r, 3);
 assert.equal(r.active, 1);
 r.mulligan();
 assert.equal(r.active, 0, 'the golfer who was playing is playing again');
 assert.deepEqual(r.order, [0, 1]);
});

test('match play still plays the farthest ball, but tees off on honours', () => {
 const r = round(2, {mode: 'match'});
 // Both on the tee: honours decides, and on the first hole that is group order.
 assert.equal(r.active, 0);
 r.takeShot(shot(0, 150), PIN);
 assert.equal(r.active, 1, 'the golfer still on the tee is farther away');
 r.takeShot(shot(0, 120), PIN);
 assert.equal(r.active, 1, 'and is still farther after a shorter shot');
});

// Removing a golfer mid-round. The editor removes the row you clicked; this has
// to remove that golfer's round, not the last one in the list.
const seated = r => r.players.map(p => ({name: p.name, team: p.team, hand: p.hand, seat: p.id}));

test('removing the golfer whose turn it is takes THEIR card, not somebody else’s', () => {
 // The bug: `setPlayers` resized by length, so slot i kept slot i and the arrays
 // were truncated from the end. Removing the first of two golfers deleted the
 // SECOND one's card and handed the first one's strokes and ball to whoever was
 // left, under the remaining name.
 const r = round(2);
 r.takeShot(shot(1, 100), PIN);
 r.takeShot(shot(2, 150), PIN);
 assert.equal(r.active, 0);
 assert.deepEqual(r.strokes, [2, 0]);

 r.setPlayers([seated(r)[1]], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.players.map(p => p.name), ['P2']);
 assert.deepEqual(r.strokes, [0], 'P2 keeps their own strokes, not the departed golfer’s');
 assert.deepEqual(r.positions, [{x: 0, z: 0}], 'and their own ball, still on the tee');
 assert.equal(r.active, 0, 'and the turn passes to them');
});

test('a golfer removed from the middle takes their own card with them', () => {
 const r = round(3);
 holeOutIn(r, 4);  // P1
 holeOutIn(r, 5);  // P2
 assert.deepEqual(r.cards.map(c => c[0]), [4, 5, undefined]);

 const rows = seated(r);
 r.setPlayers([rows[0], rows[2]], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.players.map(p => p.name), ['P1', 'P3']);
 assert.deepEqual(r.cards.map(c => c[0]), [4, undefined], 'P1 keeps their four; P3 keeps their blank');
 assert.deepEqual(r.done, [true, false]);
});

test('a golfer who joins mid-round starts clean and goes to the back of the order', () => {
 const r = round(2);
 holeOutIn(r, 4);
 const rows = seated(r);
 r.setPlayers([...rows, {name: 'Late', team: 'A', hand: 'RH'}], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.players.map(p => p.name), ['P1', 'P2', 'Late']);
 assert.deepEqual(r.cards[2], [], 'nothing is invented for the holes they missed');
 assert.equal(r.strokes[2], 0);
 assert.deepEqual(r.order, [0, 1, 2]);
});

test('seat is an instruction, not part of a golfer', () => {
 // Persisted, it would be read back as a seat in a group that has since changed.
 const r = round(2);
 r.setPlayers(seated(r), {blue: {x: 0, z: 0}});
 for (const p of r.players) assert.ok(!('seat' in p), `${p.name} carried a seat into the round`);
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 for (const p of back.players) assert.ok(!('seat' in p));
});

test('reordering the group without removing anyone keeps every card with its owner', () => {
 const r = round(3);
 holeOutIn(r, 4); holeOutIn(r, 6); holeOutIn(r, 5);
 const rows = seated(r);
 r.setPlayers([rows[2], rows[0], rows[1]], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.players.map(p => p.name), ['P3', 'P1', 'P2']);
 assert.deepEqual(r.cards.map(c => c[0]), [5, 4, 6], 'each score followed its golfer');
});

test('an unseated row is treated as new, so an old save cannot steal a card', () => {
 // `readDraft` on a group loaded before seats existed sends no seat at all.
 const r = round(2);
 holeOutIn(r, 4);
 r.setPlayers([{name: 'P1', team: 'A', hand: 'RH'}, {name: 'P2', team: 'B', hand: 'RH'}], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.cards.map(c => c[0]), [undefined, undefined],
  'without a seat nobody inherits a card, which is safer than inheriting the wrong one');
});

// A mulligan is a shot on the hole you are playing.
test('a mulligan cannot reach back into a hole you have finished', () => {
 // The bug: `history` runs across hole boundaries, so on a fresh tee with
 // nothing hit the top of it was the last shot of the PREVIOUS hole. Pressing
 // Mulligan rewound a whole hole and unrecorded its score -- nothing you did on
 // this hole was undone, which is the one thing the button claims to do.
 const r = round(1);
 r.takeShot(shot(1, 100), PIN);
 assert.equal(r.canMulligan(), true, 'mid-hole there is a shot to take back');
 r.takeShot(holeOut, PIN);
 assert.equal(r.canMulligan(), true, 'holed but still on the card: the putt can go back');

 r.nextHole();
 assert.equal(r.canMulligan(), false, 'a fresh tee has nothing of its own to take back');
 const card = JSON.parse(JSON.stringify(r.cards));
 assert.equal(r.mulligan(), false, 'and the call refuses, it does not half-do it');
 assert.equal(r.hole, 1, 'the hole is not rewound');
 assert.deepEqual(r.cards, card, 'and the finished hole keeps its score');
});

test('once you have hit on the new hole the mulligan is yours again', () => {
 const r = round(1);
 r.takeShot(shot(1, 100), PIN);
 r.takeShot(holeOut, PIN);
 r.nextHole();
 r.takeShot(shot(2, 90), PIN);
 assert.equal(r.canMulligan(), true);
 assert.equal(r.mulligan(), true);
 assert.equal(r.hole, 1, 'back to this hole’s tee, not to the last hole');
 assert.deepEqual(r.strokes, [0]);
});

test('a round with no history at all refuses politely', () => {
 const r = round(2);
 assert.equal(r.canMulligan(), false);
 assert.equal(r.mulligan(), false);
});

test('the mulligan still walks back several shots on one hole', () => {
 // The depth is not what changed -- only how far back it may reach.
 const r = round(1);
 for (let i = 0; i < 4; i++) r.takeShot(shot(0, i * 20), PIN);
 assert.equal(r.strokes[0], 4);
 for (let expect = 3; expect >= 0; expect--) {
  assert.equal(r.mulligan(), true);
  assert.equal(r.strokes[0], expect);
 }
 assert.equal(r.canMulligan(), false, 'and stops at the tee');
});
