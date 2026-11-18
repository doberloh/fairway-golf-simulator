// THE COMPUTER GOLFER (the fairway-tour goal, 17 November 2026): its table of
// strokes to hole out, its skill model, and a golfer playing real holes
// through the ball model. How closely it matches real golfers is
// tools/ai-bench.mjs's job; this holds the rules that must never break.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tourStrokes, strokesFor, lieClass} from '../src/ai/strokes.js';
import {skillFor, ANCHORS, TARGETS, CAL} from '../src/ai/skill.js';
import {computerGolfer, golferBag} from '../src/ai/golfer.js';
import {playHole, shotKey} from '../src/ai/play.js';
import {Round} from '../src/game.js';
import {STARTING_COURSE} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

const YARD = .9144, FOOT = .3048;

test('the tour table is Broadie\'s, and putting passes through its anchors', () => {
 assert.equal(tourStrokes('fairway', 100 * YARD).toFixed(2), '2.80');
 assert.equal(tourStrokes('tee', 400 * YARD).toFixed(2), '3.99');
 assert.equal(tourStrokes('sand', 30 * YARD).toFixed(2), '2.66');
 assert.equal(tourStrokes('rough', 200 * YARD).toFixed(2), '3.42');
 assert.equal(tourStrokes('green', 8 * FOOT).toFixed(2), '1.50');
 assert.equal(tourStrokes('green', 33 * FOOT).toFixed(2), '2.00');
 // A tee shot under 100 yd reads the fairway column (the table has none).
 assert.equal(tourStrokes('tee', 80 * YARD), tourStrokes('fairway', 80 * YARD));
 assert.equal(lieClass('pinestraw'), 'rough');
 assert.equal(lieClass('waste'), 'sand');
});

test('a worse golfer needs more strokes from everywhere', () => {
 for (const [s, m] of [['green', 3], ['green', 10], ['fairway', 40], ['fairway', 140], ['rough', 180], ['sand', 15], ['tee', 380]]) {
  let prev = -Infinity;
  for (const h of [-4, 0, 5, 10, 15, 20, 25, 30, 36]) { const v = strokesFor(h, s, m); assert.ok(v > prev - 1e-9, `${s} ${m} m: handicap ${h} needs ${v}, fewer than the better golfer's ${prev}`); prev = v; }
 }
});

test('skill follows the anchors and every spread widens with the handicap', () => {
 assert.equal(ANCHORS.length, TARGETS.drive75.length);
 for (const row of Object.values(CAL)) assert.equal(row.length, ANCHORS.length);
 let prev = null;
 for (const h of [-4, 0, 5, 10, 15, 20, 25, 30, 36]) {
  const s = skillFor(h);
  if (prev) {
   assert.ok(s.driveCarry <= prev.driveCarry + 1e-9, `handicap ${h} drives further`);
   assert.ok(s.puttLine >= prev.puttLine - 1e-9 && s.mishit >= prev.mishit - 1e-9, `handicap ${h} putts or strikes better`);
   assert.ok(s.read <= prev.read + 1e-9, `handicap ${h} reads more break`);
  }
  prev = s;
 }
 // A trait moves only its own spreads, and a fifth at most.
 const plain = skillFor(12), good = skillFor(12, {putting: 1});
 assert.ok(good.puttLine < plain.puttLine && good.puttLine >= plain.puttLine * .79);
 assert.equal(good.driveDir, plain.driveDir);
 // The bag is the stock bag, every carry scaled to the drive.
 const bag = golferBag(skillFor(30)), stock = golferBag(skillFor(-4));
 assert.ok(bag.find(c => c.kind === 'driver').carry < stock.find(c => c.kind === 'driver').carry);
 assert.equal(bag.length, stock.length);
});

test('the same shot key is the same shot; another key is another', () => {
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings), h = w.holes[0];
 const from = {...h.tees[Object.keys(h.tees)[0]]};
 const a = computerGolfer({handicap: 12, seed: 'same', settings}).shot({hole: h, from, key: 'k1'});
 const b = computerGolfer({handicap: 12, seed: 'same', settings}).shot({hole: h, from, key: 'k1'});
 const c = computerGolfer({handicap: 12, seed: 'same', settings}).shot({hole: h, from, key: 'k2'});
 assert.deepEqual(a.result.end, b.result.end);
 assert.notDeepEqual(a.result.end, c.result.end);
 assert.equal(a.club, 'driver');
});

test('computer golfers of every standard finish every hole of a nine, and the better scores better', () => {
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings);
 const totals = {};
 for (const hcp of [0, 30]) {
  totals[hcp] = 0;
  for (let k = 0; k < 2; k++) {
   const g = computerGolfer({handicap: hcp, seed: `t${hcp}-${k}`, settings});
   const r = new Round({players: [{name: 'C', team: 'A', hand: 'RH'}], mode: 'stroke', holes: 9, putting: {mode: 'holeout'}, tee: 'white', seed: `T${k}`});
   for (let i = 0; i < 9; i++) {
    const res = playHole(r, w.holes[i], [g], {roundKey: `T${k}`});
    assert.ok(res.complete, `handicap ${hcp} left hole ${i + 1} unfinished`);
    if (!r.finished) r.nextHole();
   }
   totals[hcp] += r.cards[0].reduce((s, v) => s + (v || 0), 0);
  }
 }
 assert.ok(totals[0] < totals[30], `scratch ${totals[0]} against the 30's ${totals[30]} over two nines`);
});

test('the computer golfers rate a course: a rating near par, a slope in the WHS range', async () => {
 const {rateCourse} = await import('../src/ai/rating.js');
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings);
 // A long seed, as the game passes (the course's whole rating key): the
 // first browser run threw "Invalid round seed" on it.
 const r = rateCourse(w.holes, {tee: 'white', rounds: 1, settings, seed: JSON.stringify(['', 'AI-TEST', 'pacnw', 9, 3240, 'white'])});
 const par = w.holes.reduce((s, h) => s + h.par, 0);
 assert.ok(Math.abs(r.course - par) < 6, `course rating ${r.course} on a par ${par} nine`);
 assert.ok(r.bogey > r.course, `bogey rating ${r.bogey} above ${r.course}`);
 assert.ok(r.slope >= 55 && r.slope <= 155);
});

test('a group of computer golfers plays three holes in every format, through the ball model', () => {
 const settings = {...STARTING_COURSE, holes: 9, seed: 'AI-TEST'}, w = world(settings);
 const groups = {stroke: ['A', 'A', 'A'], match: ['A', 'B'], scramble: ['A', 'A', 'B', 'B'], skins: ['A', 'A', 'A']};
 for (const [mode, teams] of Object.entries(groups)) {
  const players = teams.map((team, i) => ({name: `C${i}`, team, input: 'cpu', cpu: {handicap: 5 + 7 * i}}));
  const golfers = players.map((p, i) => computerGolfer({handicap: p.cpu.handicap, seed: `${mode}${i}`, settings}));
  const r = new Round({players, mode, holes: 9, putting: {mode: 'holeout'}, tee: 'white', seed: mode});
  for (let i = 0; i < 3; i++) {
   const res = playHole(r, w.holes[i], golfers, {roundKey: mode});
   assert.ok(res.complete, `${mode}: hole ${i + 1} unfinished`);
   r.nextHole();
  }
  const card = mode === 'scramble' ? r.teamCards.A : r.cards[0];
  assert.ok(card.slice(0, 3).every(v => v >= 1 && v < 15), `${mode}: ${card.slice(0, 3)}`);
 }
 assert.match(shotKey({seed: 'X', hole: 2, strokes: [3]}, 0), /^X\|h2\|p0\|s3$/);
});
