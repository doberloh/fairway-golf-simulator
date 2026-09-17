import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../src/game.js';
import {DEFAULT_COURSE, GENERATOR_VERSION} from '../src/settings-schema.js';

// localStorage does not exist in Node, and the library is deliberately built on
// it. A minimal stand-in keeps the store honest without pulling in a DOM.
function installStorage() {
 const map = new Map();
 globalThis.localStorage = {
  getItem: k => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: k => map.delete(k),
  clear: () => map.clear(),
 };
 return map;
}

const store = installStorage();
const lib = await import('../src/round-library.js');

const freshRound = () => new Round({holes: 9, players: [{name: 'Alex', team: 'A', hand: 'RH'}]});
const record = (over = {}) => ({
 name: 'Test round',
 settings: {...DEFAULT_COURSE},
 round: freshRound().toJSON(),
 camera: {mode: 'player'},
 ...over,
});

test('a round round-trips through the library', () => {
 store.clear();
 const saved = lib.saveRound(record());
 assert.ok(saved.id, 'it gets an id');
 assert.equal(saved.name, 'Test round');
 assert.ok(saved.saved > 0, 'and a timestamp');
 assert.equal(saved.generator, GENERATOR_VERSION, 'stamped with the generator it was played on');

 const found = lib.findRound(saved.id);
 assert.ok(found, 'it can be found again');
 // The whole point: what comes back must actually rebuild into a playable Round.
 const rebuilt = Round.restore(found.round);
 assert.equal(rebuilt.holes, 9);
 assert.equal(rebuilt.players.length, 1);
});

test('a round carries its full settings, unlike a course', () => {
 store.clear();
 // A course record deliberately drops play-scope settings so a shared course
 // cannot carry the author's club distances. A round is the opposite: it has to
 // come back under the same yardages and turf it was played on.
 const saved = lib.saveRound(record({settings: {...DEFAULT_COURSE, biome: 'links', holes: 9}}));
 assert.equal(saved.settings.biome, 'links', 'generation settings survive');
 assert.ok('fringe' in saved.settings, 'and so do play-scope settings');
});

test('the list summarises without rebuilding every round', () => {
 store.clear();
 lib.saveRound(record({name: 'One'}));
 lib.saveRound(record({name: 'Two'}));
 const all = lib.listRounds();
 assert.equal(all.length, 2);
 assert.equal(all[0].name, 'Two', 'newest first');
 const s = all[0].summary;
 assert.equal(s.holes, 9);
 assert.equal(s.players, 1);
 assert.equal(s.hole, 1, 'a fresh round is on hole 1');
 assert.equal(s.finished, false);
});

test('bad records are refused rather than stored', () => {
 store.clear();
 assert.throws(() => lib.saveRound(record({name: ''})), /name/i, 'an empty name is refused');
 assert.throws(() => lib.saveRound(record({name: 'x'.repeat(100)})), /name/i, 'an over-long name is refused');
 assert.throws(() => lib.saveRound({...record(), round: null}), /no round/i, 'a missing round is refused');
 // Validated BEFORE writing, so nothing unusable reaches the store.
 assert.throws(() => lib.saveRound(record({round: {holes: 'nonsense'}})));
 assert.equal(lib.listRounds().length, 0, 'and none of those were written');
});

test('one corrupt entry does not take the library down', () => {
 store.clear();
 const good = lib.saveRound(record({name: 'Good'}));
 const raw = JSON.parse(localStorage.getItem('fairway-rounds-v1'));
 raw.rounds.push({id: 'broken', name: 'Broken', round: {nope: true}});
 localStorage.setItem('fairway-rounds-v1', JSON.stringify(raw));

 const all = lib.listRounds();
 assert.equal(all.length, 1, 'the readable round still lists');
 assert.equal(all[0].id, good.id);
});

test('rounds can be renamed and deleted', () => {
 store.clear();
 const saved = lib.saveRound(record());
 const renamed = lib.renameRound(saved.id, 'Sunday at dawn');
 assert.equal(renamed.name, 'Sunday at dawn');
 assert.equal(lib.findRound(saved.id).name, 'Sunday at dawn');

 lib.deleteRound(saved.id);
 assert.equal(lib.findRound(saved.id), null);
 assert.equal(lib.listRounds().length, 0);

 assert.throws(() => lib.renameRound('gone', 'x'), /no longer saved/);
});

test('the library is capped and says so', () => {
 store.clear();
 for (let i = 0; i < lib.MAX_ROUNDS; i++) lib.saveRound(record({name: 'Round ' + i}));
 assert.equal(lib.listRounds().length, lib.MAX_ROUNDS);
 assert.throws(() => lib.saveRound(record({name: 'One too many'})), /at most/);
});

test('saving over the same id replaces rather than duplicates', () => {
 store.clear();
 const first = lib.saveRound(record({name: 'Front nine'}));
 const again = lib.saveRound(record({id: first.id, name: 'Front nine, later'}));
 assert.equal(again.id, first.id);
 assert.equal(lib.listRounds().length, 1, 'still one entry');
 assert.equal(lib.listRounds()[0].name, 'Front nine, later');
});

test('the suggested name says where the round got to', () => {
 const round = freshRound();
 assert.match(lib.suggestName(round, DEFAULT_COURSE, 'Bandon Ridge'), /Bandon Ridge/);
 assert.match(lib.suggestName(round, DEFAULT_COURSE, 'Bandon Ridge'), /hole 1/);
 round.finished = true;
 assert.match(lib.suggestName(round, DEFAULT_COURSE, 'Bandon Ridge'), /finished/);
 assert.ok(lib.suggestName(round, DEFAULT_COURSE, 'x'.repeat(80)).length <= lib.MAX_NAME);
});
