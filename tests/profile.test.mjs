import test from 'node:test';
import assert from 'node:assert/strict';

const map = new Map();
globalThis.localStorage = {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), clear: () => map.clear()};
const {PROFILE_KEY, blankProfile, normalise, loadProfile, createProfile, renameProfile, tallyShot, tallyMulligan, syncHole, profileSummary, scoreType, sameGolfer, qualifies, COUNTERS} = await import('../src/profile.js');
const {Round} = await import('../src/game.js');

const meta = (id = 'g1', extra = {}) => ({id, me: 0, mode: 'stroke', players: 1, tee: 'blue', holes: 9, endless: false, finished: false,
 course: {name: 'Sitka Bluff', settings: {seed: 'abc', holes: 9}, seed: 'abc', biome: 'pnw', generator: 1, schema: 1}, ...extra});

test('no profile until a name is given, and the name comes back after a reload', () => {
 localStorage.clear();
 assert.equal(loadProfile(), null);
 assert.throws(() => createProfile('   '), /name/);
 assert.throws(() => createProfile('x'.repeat(25)), /24/);
 createProfile('  Dustin   O  ');
 assert.equal(loadProfile().name, 'Dustin O');
 renameProfile(loadProfile(), 'Dee');
 assert.equal(loadProfile().name, 'Dee');
});

test('a profile follows the golfer by name, not by seat or case', () => {
 assert.ok(sameGolfer('Dustin', ' dustin '));
 assert.ok(!sameGolfer('Dustin', 'Dusty'));
 assert.ok(!sameGolfer('', ''));
});

test('a shot moves exactly the counters it should', () => {
 const p = blankProfile('Dee');
 tallyShot(p, {lie: 'sand', rest: 'fairway', yards: 40, airtime: 3, mph: 60, trees: 2, houses: 0});
 tallyShot(p, {lie: 'fairway', rest: 'water', hazard: 'Water', yards: 150, airtime: 6, mph: 120});
 tallyShot(p, {lie: 'rough', rest: 'green', holed: true, yards: 20});
 tallyShot(p, {lie: 'green', rest: 'green', holed: true, puttFeet: 32});
 tallyShot(p, {lie: 'green', rest: 'green', lipped: true, puttFeet: 8});
 tallyShot(p, {lie: 'fairway', rest: 'sand', yards: 140});
 tallyShot(p, {range: true, mph: 170});
 tallyMulligan(p);
 const c = p.counters;
 assert.equal(c.shots, 6);
 assert.equal(c.sandShots, 1);
 assert.equal(c.bunkers, 1);
 assert.equal(c.water, 1);
 assert.equal(c.trees, 2);
 assert.equal(c.chipIns, 1);
 assert.equal(c.lipOuts, 1);
 assert.equal(c.rangeBalls, 1);
 assert.equal(c.mulligans, 1);
 assert.equal(c.distance, 350);
 assert.equal(p.bests.longestPutt, 32);
 // The range still sets the fastest ball speed: a swing is a swing.
 assert.equal(p.bests.ballSpeed, 170);
});

test('the longest drive is a driver off the tee that stayed in play', () => {
 const p = blankProfile('Dee');
 tallyShot(p, {lie: 'tee', rest: 'fairway', teeShot: true, driver: true, yards: 281.4});
 tallyShot(p, {lie: 'tee', rest: 'water', hazard: 'Water', teeShot: true, driver: true, yards: 320});
 tallyShot(p, {lie: 'fairway', rest: 'fairway', driver: true, yards: 300});
 assert.equal(p.bests.longestDrive, 281.4);
});

test('holes are recorded from the card, and a mulligan takes a score back off', () => {
 const p = blankProfile('Dee'), m = meta();
 tallyShot(p, {lie: 'tee', rest: 'fairway', teeShot: true, strokes: 1, hole: {index: 0, par: 4, yards: 400}}, m);
 tallyShot(p, {lie: 'fairway', rest: 'green', strokes: 2, hole: {index: 0, par: 4, yards: 400}}, m);
 syncHole(p, m, {index: 0, par: 4, yards: 400, score: 4, putts: 2});
 assert.deepEqual(p.rounds[0].card[0], {par: 4, yards: 400, fairway: true, gir: true, score: 4, putts: 2});
 syncHole(p, m, {index: 0, par: 4, yards: 400, score: undefined});
 assert.equal(p.rounds[0].card[0].score, undefined);
 // Nothing is created for a round where nothing was scored.
 syncHole(p, meta('g2'), {index: 0, par: 4, yards: 400});
 assert.equal(p.rounds.length, 1);
});

test('the summary counts score types, averages and the handicap from finished nines', () => {
 const p = blankProfile('Dee');
 const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4], scores = [1, 3, 3, 6, 4, 6, 4, 4, 4];
 for (let r = 0; r < 3; r++) {
  const m = meta('g' + r, {finished: true});
  pars.forEach((par, i) => syncHole(p, m, {index: i, par, yards: par * 100, score: scores[i], putts: 2}, 1000 + r));
 }
 // A scramble is listed but its team score stays out of the totals.
 syncHole(p, meta('s1', {mode: 'scramble'}), {index: 0, par: 4, yards: 400, score: 3});
 const s = profileSummary(p);
 assert.equal(s.roundsPlayed, 4);
 assert.equal(s.holes, 27);
 assert.equal(s.types.ace, 3);
 // Each nine: an ace, two birdies, three pars, two bogeys and a double.
 assert.equal(s.types.birdie, 6);
 assert.equal(s.types.par, 9);
 assert.equal(s.types.bogey, 6);
 assert.equal(s.types.double, 3);
 assert.equal(s.types.eagle, 0);
 assert.equal(s.puttsPerHole, 2);
 assert.equal(s.handicap.rounds, 3);
 assert.ok(Number.isFinite(s.handicap.index));
 assert.equal(s.best9.t.score, 35);
 assert.equal(scoreType(4.3, 4), 'par');
});

test('an unfinished, endless or three-hole round never reaches the handicap', () => {
 const full = {holes: 9, mode: 'stroke', card: Array.from({length: 9}, () => ({par: 4, yards: 400, score: 5}))};
 assert.ok(qualifies(full));
 assert.ok(!qualifies({...full, endless: true}));
 assert.ok(!qualifies({...full, holes: 3}));
 assert.ok(!qualifies({...full, card: full.card.slice(0, 8)}));
 assert.ok(!qualifies({...full, mode: 'scramble'}));
});

test('a damaged record keeps what it can and refuses what it cannot', () => {
 assert.equal(normalise(null), null);
 assert.equal(normalise({name: ''}), null);
 assert.equal(normalise({version: 99, name: 'Dee'}), null);
 const p = normalise({name: 'Dee', counters: {shots: 5, water: -1, nonsense: 3}, bests: {longestDrive: 'far'}, rounds: [{id: 'g1', card: []}, {card: []}, null]});
 assert.deepEqual(p.counters, {shots: 5});
 assert.deepEqual(p.bests, {});
 assert.equal(p.rounds.length, 1);
 // A counter added later reads zero on an old record rather than breaking it.
 assert.ok(COUNTERS.every(({key}) => p.counters[key] === undefined || Number.isFinite(p.counters[key])));
 map.set(PROFILE_KEY, '{not json');
 assert.equal(loadProfile(), null);
});

test('a round carries its id through a save and a mulligan', () => {
 const r = new Round();
 const back = Round.restore(JSON.parse(JSON.stringify(r)));
 assert.equal(back.uid, r.uid);
 r.takeShot({end: {x: 0, z: 10}, hazard: null, holed: false}, {x: 0, z: 200});
 r.mulligan();
 assert.equal(r.uid, back.uid);
 // A save written before rounds had ids gets one.
 const {uid, ...old} = JSON.parse(JSON.stringify(new Round()));
 assert.match(Round.restore(old).uid, /^g[a-z0-9]+$/);
 // The first golfer is whoever the profile says is playing.
 Round.defaultName = 'Dee';
 assert.equal(new Round().players[0].name, 'Dee');
 Round.defaultName = 'Alex';
});
