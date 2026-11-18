// THE FAIRWAY TOUR'S GOLFERS (src/ai/roster.js). Their ids are named in
// tours and saves, so the roster is pinned whole: a change to a word list or
// the order of draws fails here until it is meant -- and then only by adding
// golfers with new ids, never by renaming one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROSTER, REAL_PROS, NATIONS, pickField, rosterGolfer, shortName} from '../src/ai/roster.js';
import {TRAITS, SHAPES} from '../src/ai/skill.js';
import {FINISH_IDS} from '../src/ball-finishes.js';
import {TRACERS} from '../src/rewards.js';

test('150 golfers, every id and name its own, none a real professional', () => {
 assert.equal(ROSTER.length, 150);
 assert.equal(new Set(ROSTER.map(g => g.id)).size, 150);
 assert.equal(new Set(ROSTER.map(g => g.name)).size, 150);
 const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
 for (const g of ROSTER) {
  assert.ok(!REAL_PROS.has(plain(g.name)), g.name);
  assert.ok(NATIONS[g.nation], g.nation);
  assert.ok(FINISH_IDS.includes(g.ball), g.ball);
  assert.ok(TRACERS[g.tracer], g.tracer);
  assert.ok(SHAPES.includes(g.traits.shape));
  for (const k of TRAITS) assert.ok(g.traits[k] >= 0 && g.traits[k] <= 1, `${g.name} ${k}`);
 }
});

test('the field runs from tour strength to club golfers', () => {
 const hs = ROSTER.map(g => g.handicap);
 assert.ok(Math.min(...hs) <= -3.5 && Math.max(...hs) >= 30);
 assert.equal(hs.filter(h => h <= 0).length, 30);
 const avg = f => f.reduce((s, g) => s + g.handicap, 0) / f.length;
 assert.ok(avg(pickField(60, 'tour', 's')) < avg(pickField(60, 'mixed', 's')));
 assert.ok(avg(pickField(60, 'mixed', 's')) < avg(pickField(60, 'club', 's')));
 assert.deepEqual(pickField(30, 'strong', 'same').map(g => g.id), pickField(30, 'strong', 'same').map(g => g.id));
 assert.equal(rosterGolfer('g001').id, 'g001');
 assert.equal(shortName(rosterGolfer('g001')), `${rosterGolfer('g001').first[0]}. ${rosterGolfer('g001').last}`);
});

test('the roster is pinned', () => {
 // Changed on purpose? Add golfers at the end with new ids; never rename.
 assert.equal(createHash('sha256').update(JSON.stringify(ROSTER)).digest('hex').slice(0, 16), '2854ae616c88f13c');
});
