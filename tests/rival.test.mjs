// CHALLENGE A FRIEND (rival.js, 20 October 2026): a finished card, its course
// and its shots packed into a code, read back on another copy of the same
// version, the shots flown again exactly, and a friend's card measured
// against the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_COURSE, GENERATOR_VERSION, SCHEMA_VERSION} from '../src/settings-schema.js';
import {simulateShot, MPH} from '../src/physics.js';
import {Round} from '../src/game.js';

const map = new Map();
globalThis.localStorage = {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), clear: () => map.clear()};
const R = await import('../src/rival.js');
const {checksum} = await import('../src/course-library.js');

const VERSION = '0.9.0';
const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 2000, minZ: -2000, maxZ: 2000}, trees: []};
// Numbers as a monitor or the meter hands them over: nowhere near the grid.
const rawDrive = {origin: {x: 3.0004917, z: -1.2345678}, aim: 1.23456789, speed: 150 * MPH, vla: 12.3456, hla: 1.0987, spin: 2600.4, spinAxis: 6.789};
const rawPitch = {origin: {x: 0.5, z: 230.25}, aim: -3.3333333, speed: 60 * MPH, vla: 30.123, hla: -0.555, spin: 7000.7, spinAxis: 0, roll: 2.345};
const settings = {...DEFAULT_COURSE, seed: 'RIVAL-1', holes: 9};
const rules = {tee: 'white', putting: {mode: 'holeout', one: 3, two: 10, three: 20}, ob: 'stroke', lie: true, input: 'meter', turf: {stimp: 11, fairway: 100, semi: 100, rough: 100, firmness: 0.45}};
const card = [4, 5, 3, 4, 4, 6, 3, 5, 4];
// Seat 0 drives, then pitches from where the drive stopped; seat 1 hits one
// pitch a hole. As main.js does: grid the shot, fly it, log it.
function play(log, hole, seat, raw, from) {
 const shot = R.gridShot(from ? {...raw, origin: from} : raw), r = simulateShot(shot, flat);
 R.recordShot(log, {hole, seat, shot, end: r.end, flagstick: hole % 2 === 0, poles: hole === 3});
 return r;
}
function log() {
 const l = [];
 for (let h = 0; h < 9; h++) { const d = play(l, h, 0, rawDrive); play(l, h, 1, rawPitch); play(l, h, 0, rawPitch, {x: d.end.x, z: d.end.z}); }
 return l;
}
const make = (over = {}) => R.makeRivalCode({name: 'Sam', course: 'Dune Run', version: VERSION, settings, holes: 9, pars: [4, 5, 3, 4, 4, 5, 3, 4, 4], card, putts: [2, 2, 1, 2, 2, 3, 1, 2, 2], rules, log: log(), seat: 0, day: '2026-10-20', ...over});

test('a shot is flown on the grid, and comes back from its numbers exactly', () => {
 for (const raw of [rawDrive, rawPitch]) {
  const shot = R.gridShot(raw);
  assert.deepEqual(R.gridShot(shot), shot, 'the grid is where it stays');
  assert.ok(Math.abs(shot.speed - raw.speed) <= 0.005 && Math.abs(shot.aim - raw.aim) <= 0.0005 && Math.abs(shot.origin.x - raw.origin.x) <= 0.0005);
  const flown = simulateShot(shot, flat);
  const back = R.shotFrom(R.shotNumbers(shot, flown.end, {flagstick: true}));
  for (const k of ['aim', 'speed', 'vla', 'hla', 'spin', 'spinAxis', 'roll']) assert.equal(back.shot[k], shot[k], k);
  assert.deepEqual(back.shot.origin, {x: shot.origin.x, z: shot.origin.z});
  assert.equal(back.flagstick, true);
  // The point of all of it: flown again, it is the same flight to the bit.
  const again = simulateShot(back.shot, flat);
  assert.equal(again.end.x, flown.end.x);
  assert.equal(again.end.z, flown.end.z);
  assert.equal(again.points.length, flown.points.length);
 }
});

test('a code carries the card, the course, the rules and only that golfer’s shots', () => {
 const back = R.readRivalCode(make());
 assert.equal(back.name, 'Sam');
 assert.equal(back.course, 'Dune Run');
 assert.equal(back.version, VERSION);
 assert.equal(back.generator, GENERATOR_VERSION);
 assert.equal(back.settings.seed, 'RIVAL-1');
 assert.equal(back.settings.holes, 9);
 assert.deepEqual(back.card, card);
 assert.deepEqual(back.putts, [2, 2, 1, 2, 2, 3, 1, 2, 2]);
 assert.deepEqual(back.rules, rules);
 assert.equal(back.day, '2026-10-20');
 const mine = log().filter(f => f.seat === 0);
 assert.equal(back.shots.length, 9);
 back.shots.forEach((hole, h) => assert.deepEqual(hole, mine.filter(f => f.hole === h).map(f => f.s), `hole ${h + 1}: seat 0's two shots, numbers intact`));
 const f = R.shotFrom(back.shots[3][0]);
 assert.deepEqual([f.flagstick, f.poles], [false, true]);
 assert.ok(R.isRivalCode(make()) && !R.isRivalCode('FW1.abc.def'));
});

test('a round’s code is a few thousand characters, and whitespace from a message is ignored', () => {
 const code = make();
 // Eighteen shots here; a typical round of about 85 measures in RESEARCH.
 assert.ok(code.length < 1200, `${code.length} characters`);
 const back = R.readRivalCode(`  ${code.slice(0, 40)}\n${code.slice(40)}  `);
 assert.equal(back.shots.flat().length, 18);
 assert.deepEqual(R.readRivalCode(make({log: []})).shots, Array(9).fill([]));
});

test('only a finished card of 9 or 18 holes, on a build with a version, can be sent', () => {
 assert.throws(() => make({card: [4, 5, 3]}), /finished card/);
 assert.throws(() => make({card: [4, 5, 3, 4, 4, undefined, 3, 5, 4]}), /finished card/);
 assert.throws(() => make({holes: 3, card: [4, 5, 3]}), /9 or 18/);
 assert.throws(() => make({version: ''}), /no version/);
});

test('a code cut short, altered, from a newer Fairway or not a challenge is refused in words', () => {
 const code = make();
 assert.throws(() => R.readRivalCode(code.slice(0, -40)), /incomplete or altered/);
 assert.throws(() => R.readRivalCode(code.replace('.', '.A')), /incomplete or altered/);
 assert.throws(() => R.readRivalCode('FW1.abc.def'), /does not look like a Fairway challenge/);
 assert.throws(() => R.readRivalCode(''), /does not look/);
 const parts = code.split('.');
 const wrap = (head, shots = parts[2]) => { const body = `${Buffer.from(JSON.stringify(head)).toString('base64url')}.${shots}`; return `FWC1.${body}.${checksum(body)}`; };
 const head = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
 assert.equal(R.readRivalCode(wrap(head)).name, 'Sam', 'the wrapper itself makes a good code');
 assert.throws(() => R.readRivalCode(wrap({...head, s: SCHEMA_VERSION + 1})), /newer version/);
 assert.throws(() => R.readRivalCode(wrap({...head, k: [4, 5]})), /no complete card/);
 // A correct checksum over shots that do not parse, or that run on: refused.
 assert.throws(() => R.readRivalCode(wrap(head, 'gICAgICA')), /shots could not be read/);
 assert.throws(() => R.readRivalCode(wrap(head, parts[2] + 'AA')), /shots could not be read/);
});

test('another version of Fairway, or another course generator, is refused', () => {
 const rival = R.readRivalCode(make());
 assert.equal(R.rivalProblem(rival, {version: VERSION}), '');
 assert.match(R.rivalProblem(rival, {version: '0.9.1'}), /Fairway 0\.9\.0, and this is Fairway 0\.9\.1/);
 assert.match(R.rivalProblem(R.readRivalCode(make({generator: GENERATOR_VERSION - 1})), {version: VERSION}), /same version/);
});

test('total strokes decide it, part of the way round and at the end', () => {
 const theirs = [4, 5, 3, 4];
 let c = R.compareCards(theirs, [3, 6]);
 assert.deepEqual([c.played, c.finished, c.theirTotal, c.myTotal, c.lead, c.won, c.lost, c.halved], [2, false, 9, 9, 0, 1, 1, 0]);
 assert.equal(R.compareText(c, 'Sam'), 'Level with Sam after 2');
 c = R.compareCards(theirs, [3, 5, 3]);
 assert.equal(R.compareText(c, 'Sam'), '1 ahead of Sam after 3');
 c = R.compareCards(theirs, [5, 5, 4, 4]);
 assert.equal(R.compareText(c, 'Sam'), 'Sam wins by 2');
 assert.equal(R.holesText(c), 'Holes won 0, lost 2, halved 2');
 c = R.compareCards(theirs, [3, 5, 3, 4]);
 assert.equal(R.compareText(c, 'Sam', 'Alex'), 'Alex beat Sam by 1');
 assert.equal(R.compareText(R.compareCards(theirs, []), 'Sam'), 'Sam’s card is waiting on the first hole.');
});

test('the rules are shown, and only the ones that differed are named', () => {
 assert.deepEqual(R.rulesDiff(rules, rules, 'Sam'), []);
 const mine = {...rules, tee: 'blue', input: 'monitor', putting: {mode: 'dartboard', one: 3, two: 10, three: 20}, turf: {...rules.turf, stimp: 12}};
 assert.deepEqual(R.rulesDiff(rules, mine, 'Sam'), ['Tees: Sam White, you Blue.', 'Putting: Sam hole out, you dartboard putting (3/10/20 yd).', 'Played on: Sam the Swing Meter, you a launch monitor.', 'Green speed: Sam Stimp 11, you Stimp 12.']);
 const round = new Round({players: [{name: 'Alex', team: 'A', hand: 'RH', tee: 'red'}], putting: {mode: 'decimal'}, outOfBounds: 'e5', monitorLie: false});
 const r = R.rulesOf(round, 0, {turf: {stimp: 12, firmness: 0.45, fairway: 100, semi: 90, rough: 80}}, 'monitor');
 assert.deepEqual([r.tee, r.putting.mode, r.ob, r.lie, r.input, r.turf.stimp, r.turf.rough], ['red', 'decimal', 'e5', false, 'monitor', 12, 80]);
});

test('the shot log takes back a mulligan and drops what a damaged save carries', () => {
 const l = log();
 assert.equal(l.length, 27);
 R.takeBackShot(l);
 assert.equal(l.length, 26);
 const bad = [null, {hole: 99, seat: 0, s: l[0].s}, {hole: 0, seat: 7, s: l[0].s}, {hole: 0, seat: 0, s: [1, 2, 3]}, {hole: 0, seat: 0, s: [...l[0].s, 5]}, {hole: 0, seat: 0, s: l[0].s.map(v => v + 0.5)}];
 assert.deepEqual(R.normaliseShots([...l, ...bad]), l);
 assert.deepEqual(R.normaliseShots('junk'), []);
});

test('pasted challenges are kept, the same code once, newest first', () => {
 map.clear();
 const a = R.saveRival(make());
 const b = R.saveRival(make({name: 'Bo'}));
 assert.equal(R.saveRival(make()).id, a.id, 'the same code pasted again is the same challenge');
 assert.deepEqual(R.listRivals().map(r => r.name), ['Sam', 'Bo']);
 assert.equal(R.findRival(b.id).name, 'Bo');
 assert.equal(R.findRival('nothing'), null);
 assert.throws(() => R.saveRival('FW1.abc.def'), /does not look/);
 for (let i = 0; i < R.MAX_RIVALS + 3; i++) R.saveRival(make({name: `G${i}`}));
 assert.equal(R.listRivals().length, R.MAX_RIVALS);
});

test('a round played against a challenge remembers it through a save', () => {
 const round = new Round({players: [{name: 'Alex', team: 'A', hand: 'RH'}], holes: 9, rival: 'fabc12345'});
 assert.equal(round.rival, 'fabc12345');
 assert.equal(Round.restore(JSON.parse(JSON.stringify(round))).rival, 'fabc12345');
 assert.throws(() => new Round({rival: 'BAD ID'}), /challenge/);
 assert.equal(new Round({}).rival, '');
});

// THE WHOLE CHAIN ON A REAL COURSE: one machine plays two holes through trees
// and wind, logging each shot as main.js does; a second world grown from the
// code's settings flies them again. Every ball must stop on the same
// millimetre, or the drawn shots would not be the shots that were played.
test('shots from a code fly again to the same millimetre on a freshly grown course', async () => {
 const {generateWorld} = await import('../src/course.js');
 const {localWind} = await import('../src/shot-visuals.js');
 const turf = {stimp: 11, fairway: 100, semi: 100, rough: 100, firmness: 0.45};
 const fly = (shot, hole, s, f) => simulateShot(shot, hole, {wind: localWind(s, hole.rotation), altitude: hole.bio.altitude, temperature: hole.bio.temperature, turf, flagsticks: {current: f}});
 const mine = {...DEFAULT_COURSE, seed: 'RIVAL-WORLD', holes: 9, trees: 70, wind: 12};
 const here = generateWorld(mine), l = [];
 for (let h = 0; h < 2; h++) {
  const hole = here.holes[h];
  let pos = {...hole.tees.blue};
  for (let k = 0; k < 4; k++) {
   const dx = hole.pin.x - pos.x, dz = hole.pin.z - pos.z, d = Math.hypot(dx, dz), green = hole.surface(pos.x, pos.z) === 'green';
   const shot = R.gridShot(green ? {origin: pos, aim: Math.atan2(-dx, dz) * 180 / Math.PI, speed: 1 + d * 0.3, vla: 0, hla: 0.3, spin: 0, spinAxis: 0}
    : {origin: pos, aim: Math.atan2(-dx, dz) * 180 / Math.PI + 2.5, speed: Math.min(70, 18 + d * 0.22), vla: 14, hla: -1.2, spin: 3200, spinAxis: -4});
   const r = fly(shot, hole, mine, !green);
   R.recordShot(l, {hole: h, seat: 0, shot, end: r.end, flagstick: !green});
   pos = {x: r.end.x, z: r.end.z};
  }
 }
 const back = R.readRivalCode(R.makeRivalCode({name: 'Sam', course: 'Wooded', version: VERSION, settings: mine, holes: 9, pars: here.holes.map(h => h.par), card: Array(9).fill(4), rules: {...rules, turf}, log: l}));
 const there = generateWorld({...DEFAULT_COURSE, ...back.settings});
 let n = 0;
 back.shots.forEach((hole, h) => hole.forEach(s => {
  const f = R.shotFrom(s), r = fly(f.shot, there.holes[h], back.settings, f.flagstick);
  assert.deepEqual([Math.round(r.end.x * 1000), Math.round(r.end.z * 1000)], [s[9], s[10]], `hole ${h + 1}, shot ${++n}`);
 }));
 assert.equal(n, 8);
});
