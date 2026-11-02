import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {WORLD} from '../src/biomes.js';

// PHASE 5: BUILT WATER (architect-courses; waterworks.js). Rip-rap along the
// side of a pond that faces play, and a fountain in a big pond, by landscape
// (biomes.js WORLD `edge` and `fountain`) on every generated course. Until
// the designer was removed (2 November 2026) it was an Architect course's
// alone, by its style and club; its designed mounds went with it.

// Redwood dresses its ponds with stone and may have a fountain; Midwest
// leaves its ponds as found.
const stone = world({seed: 'WW-1', holes: 9, biome: 'redwood', water: 80});
const soft = world({seed: 'WW-1', holes: 9, biome: 'midwest', water: 80});

test('each landscape dresses its water its own way', () => {
 assert.equal(WORLD.redwood.edge, 'riprap');
 assert.equal(WORLD.midwest.edge, null);
 assert.equal(soft.waterworks.filter(w => w.kind !== 'fountain').length, 0, 'Midwest leaves its ponds as found');
 assert.ok(stone.waterworks.some(w => w.kind === 'riprap'), 'Redwood lines its ponds with stone');
});

test('rip-rap lies along the water\'s edge, never on a green, tee, sand or path', () => {
 const stones = stone.waterworks.filter(w => w.kind === 'riprap');
 assert.ok(stones.length > 50, `${stones.length} stones`);
 let wet = 0;
 for (const r of stones) {
  const s = stone.surface(r.x, r.z);
  assert.ok(!['green', 'tee', 'sand', 'path'].includes(s), `a stone on ${s}`);
  // In the water, or within a stride of it.
  if ([0, 1, 2, 3, 4, 5, 6, 7].some(k => stone.surface(r.x + Math.cos(k * Math.PI / 4) * 1.5, r.z + Math.sin(k * Math.PI / 4) * 1.5) === 'water')) wet++;
 }
 assert.ok(wet / stones.length > .95, `${wet} of ${stones.length} stones at the water`);
});

test('a fountain stands in open water, two a course at most, and only where the landscape has them', () => {
 const f = stone.waterworks.filter(k => k.kind === 'fountain');
 assert.ok(f.length <= 2, `${f.length} fountains`);
 for (const k of f) assert.equal(stone.surface(k.x, k.z), 'water');
 assert.equal(soft.waterworks.filter(k => k.kind === 'fountain').length, 0, 'Midwest has none');
});
