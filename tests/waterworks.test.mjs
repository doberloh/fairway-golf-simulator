import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';

// PHASE 5: BUILT GROUND AND BUILT WATER (architect-courses; architect.js
// `designMounds`, waterworks.js). Mounds by style as real ground, clear of
// play; rip-rap or tie walls along the side of a pond that faces play, by
// style; a fountain in a big pond of a dressed club. Classic has none of it.

const base = {seed: 'WW-1', holes: 9, biome: 'midwest', designer: 'architect'};
const parkland = world({...base, archStyle: 'parkland', archClub: 'members'});
const stadium = world({...base, archStyle: 'stadium', archClub: 'resort'});
const links = world({...base, archStyle: 'links'});
const classic = world({seed: 'WW-1', holes: 9, biome: 'midwest'});

test('Classic has no mounds and no waterworks; Links leaves its ponds as found', () => {
 assert.equal(classic.mounds.length, 0);
 assert.equal(classic.waterworks.length, 0);
 assert.equal(links.mounds.length, 0);
 assert.equal(links.waterworks.filter(w => w.kind !== 'fountain').length, 0);
});

test('mounds stand in the rough and rise from the ground round them', () => {
 const golden = world({...base, archStyle: 'golden'});
 for (const w of [parkland, golden, stadium]) {
  assert.ok(w.mounds.length > 0, `${w.settings.archStyle}: no mounds`);
  const rises = [];
  for (const m of w.mounds) {
   const s = w.surface(m.x, m.z);
   assert.ok(!['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water'].includes(s), `${w.settings.archStyle}: a mound on ${s}`);
   rises.push(w.height(m.x, m.z) - Math.min(...[0, 1, 2, 3].map(k => w.height(m.x + Math.cos(k * Math.PI / 2) * m.r * 1.3, m.z + Math.sin(k * Math.PI / 2) * m.r * 1.3))));
  }
  rises.sort((a, b) => a - b);
  assert.ok(rises[rises.length >> 1] > .6, `${w.settings.archStyle}: the median mound rises ${rises[rises.length >> 1].toFixed(2)} m`);
 }
});

test('rip-rap lies along the water\'s edge, never on a green, tee, sand or path', () => {
 const stones = parkland.waterworks.filter(w => w.kind === 'riprap');
 assert.ok(stones.length > 50, `${stones.length} stones`);
 let wet = 0;
 for (const r of stones) {
  const s = parkland.surface(r.x, r.z);
  assert.ok(!['green', 'tee', 'sand', 'path'].includes(s), `a stone on ${s}`);
  // In the water, or within a stride of it.
  if ([0, 1, 2, 3, 4, 5, 6, 7].some(k => parkland.surface(r.x + Math.cos(k * Math.PI / 4) * 1.5, r.z + Math.sin(k * Math.PI / 4) * 1.5) === 'water')) wet++;
 }
 assert.ok(wet / stones.length > .95, `${wet} of ${stones.length} stones at the water`);
});

test('a tie wall faces its pond', () => {
 const ties = stadium.waterworks.filter(w => w.kind === 'bulkhead');
 assert.ok(ties.length > 10, `${ties.length} sections`);
 let facing = 0;
 // The model's face is its +x; a turn of `rot` carries it to (cos rot, -sin rot).
 for (const t of ties) if (stadium.surface(t.x + Math.cos(t.rot) * 2, t.z - Math.sin(t.rot) * 2) === 'water') facing++;
 assert.ok(facing / ties.length > .9, `${facing} of ${ties.length} sections face the water`);
 assert.equal(parkland.waterworks.filter(w => w.kind === 'bulkhead').length, 0, 'Parkland lines with stone');
});

test('a fountain stands in open water, two a course at most', () => {
 for (const w of [parkland, stadium]) {
  const f = w.waterworks.filter(k => k.kind === 'fountain');
  assert.ok(f.length >= 1 && f.length <= 2, `${f.length} fountains`);
  for (const k of f) assert.equal(w.surface(k.x, k.z), 'water');
 }
 const muni = world({...base, archStyle: 'parkland', archClub: 'municipal'});
 assert.equal(muni.waterworks.filter(k => k.kind === 'fountain').length, 0, 'a municipal course has none');
});
