import test from 'node:test';
import assert from 'node:assert/strict';

const map = new Map();
globalThis.localStorage = {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), clear: () => map.clear()};
const {removeRound, exportProfiles, importProfiles, PROFILE_KEY, LEGACY_KEY, blankProfile, normalise, loadProfiles, storeProfiles, addProfile, renameProfile, setMainProfile, deleteProfile, findProfile, profileByName, mainProfile, tallyShot, tallyMulligan, syncHole, profileSummary, scoreType, sameGolfer, qualifies, COUNTERS} = await import('../src/profile.js');
const {Round} = await import('../src/game.js');

const meta = (id = 'g1', extra = {}) => ({id, me: 0, mode: 'stroke', players: 1, tee: 'blue', holes: 9, endless: false, finished: false,
 course: {name: 'Sitka Bluff', settings: {seed: 'abc', holes: 9}, seed: 'abc', biome: 'pnw', generator: 1, schema: 1}, ...extra});

test('no profiles until a name is given, and the first one is main', () => {
 localStorage.clear();
 assert.equal(loadProfiles(), null);
 assert.throws(() => addProfile(null, '   '), /name/);
 assert.throws(() => addProfile(null, 'x'.repeat(25)), /24/);
 const {store, profile} = addProfile(null, '  Dustin   O  ');
 assert.equal(profile.name, 'Dustin O');
 assert.equal(store.main, profile.id);
 assert.equal(mainProfile(loadProfiles()).name, 'Dustin O');
});

test('more players join the same store; names stay unique and main can move', () => {
 localStorage.clear();
 const {store, profile: me} = addProfile(null, 'Dee');
 const sam = addProfile(store, 'Sam').profile, jo = addProfile(store, 'Jo').profile;
 assert.equal(loadProfiles().profiles.length, 3);
 assert.equal(loadProfiles().main, me.id);
 // A name is what a player picks from a list, so two the same would be a trap.
 assert.throws(() => addProfile(store, ' sam '), /already/);
 assert.throws(() => renameProfile(store, jo.id, 'DEE'), /already/);
 renameProfile(store, jo.id, 'Joanne');
 assert.equal(profileByName(loadProfiles(), 'joanne').id, jo.id);
 // Main is a choice, and the main profile cannot be removed until it is handed on.
 assert.throws(() => deleteProfile(store, me.id), /main/);
 setMainProfile(store, sam.id);
 assert.equal(loadProfiles().main, sam.id);
 deleteProfile(store, me.id);
 assert.equal(findProfile(loadProfiles(), me.id), null);
 assert.equal(loadProfiles().profiles.length, 2);
});

test('the single profile the first build wrote becomes the main profile of a store', () => {
 localStorage.clear();
 map.set(LEGACY_KEY, JSON.stringify({version: 1, name: 'Dee', created: 5, counters: {shots: 12}, bests: {longestDrive: 250}, rounds: [{id: 'g1', card: [{par: 4, yards: 400, score: 5}]}]}));
 const store = loadProfiles();
 assert.equal(store.version, 2);
 assert.equal(store.profiles.length, 1);
 const m = mainProfile(store);
 assert.equal(m.name, 'Dee');
 assert.equal(m.counters.shots, 12);
 assert.equal(m.rounds[0].card[0].score, 5);
 // Written back under the new key, and the old one is gone.
 addProfile(store, 'Sam');
 assert.equal(map.has(LEGACY_KEY), false);
 assert.equal(loadProfiles().profiles.length, 2);
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

test('a damaged store keeps what it can and refuses what it cannot', () => {
 assert.equal(normalise(null), null);
 assert.equal(normalise({version: 2, profiles: []}), null);
 assert.equal(normalise({version: 99, profiles: [{id: 'p1', name: 'Dee'}]}), null);
 const store = normalise({version: 2, main: 'nobody', profiles: [
  {id: 'p1', name: 'Dee', counters: {shots: 5, water: -1, nonsense: 3}, bests: {longestDrive: 'far'}, rounds: [{id: 'g1', card: []}, {card: []}, null]},
  {id: 'p2', name: ''}, {id: 'p3', name: 'dee'}, {name: 'No id'}, {id: 'p1', name: 'Twin'}]});
 // One readable profile; main falls back to it.
 assert.equal(store.profiles.length, 1);
 assert.equal(store.main, 'p1');
 const p = store.profiles[0];
 assert.deepEqual(p.counters, {shots: 5});
 assert.deepEqual(p.bests, {});
 assert.equal(p.rounds.length, 1);
 // A counter added later reads zero on an old record rather than breaking it.
 assert.ok(COUNTERS.every(({key}) => p.counters[key] === undefined || Number.isFinite(p.counters[key])));
 map.set(PROFILE_KEY, '{not json');
 assert.equal(loadProfiles(), null);
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
 // The first golfer is the main profile, carrying its id.
 const was = Round.defaultPlayer;
 Round.defaultPlayer = {name: 'Dee', team: 'A', hand: 'RH', profile: 'p1'};
 assert.deepEqual([new Round().players[0].name, new Round().players[0].profile], ['Dee', 'p1']);
 Round.defaultPlayer = was;
});

test('a golfer keeps their profile through a change of group, and a newcomer brings theirs', () => {
 const r = new Round({players: [{name: 'Dee', team: 'A', profile: 'p1'}, {name: 'Sam', team: 'A', profile: 'p2'}]});
 // Dee leaves mid-round; Jo joins.
 r.setPlayers([{name: 'Sam', team: 'A', profile: 'p2', seat: 1}, {name: 'Jo', team: 'A', profile: 'p3'}], {blue: {x: 0, z: 0}});
 assert.deepEqual(r.players.map(p => p.profile), ['p2', 'p3']);
 assert.equal(Round.restore(JSON.parse(JSON.stringify(r))).players[1].profile, 'p3');
});

// ---- backup ---------------------------------------------------------------
test('a backup restores every player exactly, onto a device with nobody on it', () => {
 localStorage.clear();
 const {store} = addProfile(null, 'Dee');
 const sam = addProfile(store, 'Sam').profile;
 tallyShot(sam, {lie: 'tee', rest: 'fairway', yards: 250});
 syncHole(sam, meta('g1'), {index: 0, par: 4, yards: 400, score: 5, putts: 2});
 setMainProfile(store, sam.id);
 const file = exportProfiles(store);
 localStorage.clear();
 const back = importProfiles(null, file);
 assert.deepEqual(back.added, ['Dee', 'Sam']);
 assert.deepEqual(loadProfiles(), store, 'the same players, the same history, the same main profile');
});

test('a backup is merged into the players already here, never poured over them', () => {
 localStorage.clear();
 // The device: Dee (main) and Sam, Sam having played recently.
 const {store} = addProfile(null, 'Dee');
 const sam = addProfile(store, 'Sam').profile;
 const file = JSON.parse(exportProfiles(store));
 syncHole(sam, meta('fresh'), {index: 0, par: 4, yards: 400, score: 4}, Date.now() + 1000);
 // The file, from another device: an older Sam, a new player Jo, and a
 // different player who is also called Dee.
 file.profiles = file.profiles.filter(p => p.name === 'Sam');
 file.profiles.push({id: 'pjo', name: 'Jo', created: 1, counters: {shots: 9}, bests: {}, rounds: []},
  {id: 'pother', name: 'dee', created: 1, counters: {}, bests: {}, rounds: []});
 file.main = 'pjo';
 const r = importProfiles(store, JSON.stringify(file));
 assert.deepEqual(r.added, ['Jo', 'dee (2)']);
 assert.deepEqual(r.renamed, ['dee → dee (2)']);
 assert.ok(r.kept.includes('Sam'), 'the more recent Sam on this device is kept');
 const now = loadProfiles();
 assert.equal(now.profiles.length, 4);
 assert.equal(findProfile(now, sam.id).rounds.length, 1, "Sam's newer round survives");
 assert.equal(mainProfile(now).name, 'Dee', 'the device keeps its own main profile');
});

test('the same player from a newer backup replaces the older copy here', () => {
 localStorage.clear();
 const {store, profile: dee} = addProfile(null, 'Dee');
 const later = JSON.parse(exportProfiles(store));
 later.profiles[0].counters = {shots: 120};
 later.profiles[0].rounds = [{id: 'g9', started: Date.now() + 5000, updated: Date.now() + 5000, card: [{par: 3, yards: 150, score: 3}]}];
 const r = importProfiles(store, JSON.stringify(later));
 assert.deepEqual(r.updated, ['Dee']);
 assert.equal(findProfile(loadProfiles(), dee.id).counters.shots, 120);
});

test('a file that is not a player backup is refused, and changes nothing', () => {
 localStorage.clear();
 const {store} = addProfile(null, 'Dee');
 const before = JSON.stringify(loadProfiles());
 assert.throws(() => importProfiles(store, 'not json'), /not a Fairway player backup/);
 assert.throws(() => importProfiles(store, JSON.stringify({kind: 'fairway-courses', courses: []})), /not a Fairway player backup/);
 assert.throws(() => importProfiles(store, JSON.stringify({kind: 'fairway-profiles', version: 2, profiles: []})), /no players/);
 assert.equal(JSON.stringify(loadProfiles()), before);
 // The single profile the first build kept reads as a backup too.
 const r = importProfiles(store, JSON.stringify({version: 1, name: 'Old Me', created: 3, counters: {shots: 2}, bests: {}, rounds: []}));
 assert.deepEqual(r.added, ['Old Me']);
});

test('a round removed from the history leaves the scoring and the handicap, and stays removed', () => {
 const p = blankProfile('Dee');
 const nine = (id, score) => { const m = meta(id, {finished: true}); for (let i = 0; i < 9; i++) syncHole(p, m, {index: i, par: 4, yards: 400, score, putts: 2}); };
 nine('a', 4); nine('b', 4); nine('c', 4); nine('bad', 9);
 tallyShot(p, {lie: 'tee', rest: 'fairway', yards: 200});
 const before = profileSummary(p);
 assert.equal(before.handicap.rounds, 4);
 removeRound(p, 'bad');
 const after = profileSummary(p);
 assert.equal(after.roundsPlayed, 3);
 assert.equal(after.handicap.rounds, 3);
 assert.ok(after.handicap.index <= before.handicap.index, 'the blow-up no longer counts');
 assert.equal(after.types.triple, 0);
 // The balls hit are still counted: a shot taken was still taken.
 assert.equal(p.counters.shots, 1);
 // A round removed while it is still being played is not written back.
 syncHole(p, meta('bad', {finished: false}), {index: 0, par: 4, yards: 400, score: 5});
 tallyShot(p, {lie: 'tee', rest: 'fairway', teeShot: true, strokes: 1, hole: {index: 1, par: 4, yards: 400}}, meta('bad'));
 assert.ok(!p.rounds.some(r => r.id === 'bad'));
 // And the store keeps the list through a save and a load.
 localStorage.clear();
 const {store, profile} = addProfile(null, 'Dee');
 removeRound(profile, 'gone'); storeProfiles(store);
 assert.deepEqual(findProfile(loadProfiles(), profile.id).removed, ['gone']);
});
