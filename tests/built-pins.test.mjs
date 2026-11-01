// Pins cut per round on a built course (the course builder, stage 2;
// built-world.js placeBuiltPins, game.js Round.pinSeed, rival.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, DEFAULT_COURSE, greenDistance} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {worldFromDoc, placeBuiltPins} from '../src/built-world.js';
import {Round} from '../src/game.js';
import {makeRivalCode, readRivalCode} from '../src/rival.js';

const doc = freezeWorld(generateWorld({...DEFAULT_COURSE, seed: 'PINS-TEST', biome: 'autumn', holes: 9}), {name: 'Pins'});
const slope = (h, x, z) => { const e = .4; return Math.hypot((h.height(x + e, z) - h.height(x - e, z)) / (2 * e), (h.height(x, z + e) - h.height(x, z - e)) / (2 * e)) * 100; };

test('every cup is on its green, with room from the edge, on ground a ball can rest on', () => {
 for (const day of ['Thursday', 'Sunday']) {
  const w = worldFromDoc(doc, {builtPins: 'round-one', pinDay: day});
  for (const h of w.holes) {
   const room = -greenDistance(h, h.pin.x, h.pin.z);
   assert.ok(room >= 2.0, `${day} hole ${h.hole + 1}: ${room.toFixed(2)} m from the edge`);
   assert.ok(slope(h, h.pin.x, h.pin.z) < 6, `${day} hole ${h.hole + 1}: ${slope(h, h.pin.x, h.pin.z).toFixed(1)}% slope`);
   assert.equal(h.surface(h.pin.x, h.pin.z), 'green');
   const w2 = h.toWorld(h.pin);
   assert.ok(Math.hypot(w2.x - h.worldPin.x, w2.z - h.worldPin.z) < 1e-9, 'the world pin follows');
  }
 }
});

test('the same round seed cuts the same cups; another round cuts others', () => {
 const a = worldFromDoc(doc, {builtPins: 'gabc123'}), b = worldFromDoc(doc, {builtPins: 'gabc123'}), c = worldFromDoc(doc, {builtPins: 'gzzz999'});
 a.holes.forEach((h, i) => assert.deepEqual(h.pin, b.holes[i].pin));
 assert.ok(a.holes.some((h, i) => Math.hypot(h.pin.x - c.holes[i].pin.x, h.pin.z - c.holes[i].pin.z) > .5), 'a new round moves some cups');
 const d = worldFromDoc(doc, {});
 placeBuiltPins(d, 'gabc123');
 d.holes.forEach((h, i) => assert.deepEqual(h.pin, a.holes[i].pin));
});

test('a round keeps its pin seed through a save, and a challenge carries it', () => {
 const r = new Round({players: [{name: 'A', team: 'A', hand: 'RH'}], holes: 9});
 assert.equal(r.pinSeed, r.uid, 'a round cuts from its own id unless told');
 const back = Round.restore(JSON.parse(JSON.stringify(r.toJSON())));
 assert.equal(back.pinSeed, r.pinSeed);
 const given = new Round({players: [{name: 'A', team: 'A', hand: 'RH'}], holes: 9, pinSeed: 'gfriend42'});
 assert.equal(given.pinSeed, 'gfriend42');
 const settings = {...DEFAULT_COURSE, holes: 9, built: 'a'.repeat(24), builtPins: 'gfriend42'};
 const code = makeRivalCode({name: 'Pat', course: 'Built', version: '1.0.0', settings, holes: 9, pars: Array(9).fill(4), card: Array(9).fill(4), rules: {}, log: []});
 const read = readRivalCode(code);
 assert.equal(read.built, 'a'.repeat(24)); assert.equal(read.pinSeed, 'gfriend42');
 const plain = readRivalCode(makeRivalCode({name: 'Pat', course: 'Seeded', version: '1.0.0', settings: {...DEFAULT_COURSE, holes: 9}, holes: 9, pars: Array(9).fill(4), card: Array(9).fill(4), rules: {}, log: []}));
 assert.equal(plain.built, undefined, 'a seeded course\'s challenge carries no file');
});

test('every green on its own: greens stored as one set of outlines still cut each hole\'s cup on its own green', async () => {
 // As door 2 and the editor write them: every green's rings in ONE set. A
 // practice green 50 m beside hole 1's (Worthington's holes 3 and 4 had
 // their cups cut on theirs before greenParts, and were never holed).
 const {greenParts} = await import('../src/built-world.js');
 const all = doc.surfaces.green.flat(), disc = (x, z, r) => Array.from({length: 24}, (_, i) => [x + r * Math.cos(i / 24 * Math.PI * 2), z + r * Math.sin(i / 24 * Math.PI * 2)]);
 const g1 = doc.holes[0].green, practice = disc(g1.x + 50, g1.z, 14);
 const one = {...doc, surfaces: {...doc.surfaces, green: [[...all, practice]]}};
 assert.equal(greenParts(one.surfaces.green).length, all.length + 1, 'each outer ring is a green');
 const hole = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]];
 assert.deepEqual(greenParts([hole]).map(p => p.length), [2], 'a ring inside another is its island, not a green');
 for (const seed of ['a', 'b', 'c', 'd']) {
  const w = worldFromDoc(one, {builtPins: seed}), h = w.holes[0];
  assert.ok(Math.hypot(h.worldPin.x - (g1.x + 50), h.worldPin.z - g1.z) > 20, `round ${seed}: hole 1's cup is not on the practice green`);
  assert.ok(-greenDistance(h, h.pin.x, h.pin.z) >= 2, `round ${seed}: on its own green, with room`);
 }
});
