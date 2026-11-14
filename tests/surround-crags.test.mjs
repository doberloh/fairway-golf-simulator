import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {ringMesh, ringRelief, RING_DETAIL} from '../src/landscape-edge.js';
import {surroundTrees} from '../src/surround.js';
import {biomeOf} from '../src/biomes.js';

// THE MOUNTAINSIDES (the surroundings rework, 13 November 2026). The owner
// asked whether the rework was done on every landscape; on the three with a
// range close over the course it was not. What was added, and held here:
// crags on a peaked range's flanks (landscape-edge.js `crags`), the ring's
// baked hollows and ribs (`shade`), and the plants a landscape names for the
// land past its line (biomes.js `farPlants`). The rock face's paint
// (ground.js cragFace) needs a graphics card and is looked at in captures.
const world = biome => generateWorld({seed: 'CRAGS', biome, holes: 9});
const WORLDS = {};
const worldOf = biome => WORLDS[biome] ??= world(biome);

test('a peaked range has crags only where the ring can draw them, and none on a valley floor', () => {
 const w = worldOf('mountains'), relief = ringRelief(w);
 let differ = 0, same = 0, n = 0;
 for (let k = 0; k < 400; k++) {
  const a = k * 2.399963, x = Math.cos(a) * (w.halfX + 1800), z = Math.sin(a) * (w.halfZ + 1800);
  const plain = relief.at(x, z, 1800, 0), fine = relief.at(x, z, 1800, 0, 20), coarse = relief.at(x, z, 1800, 0, 400);
  assert.ok(Number.isFinite(fine) && fine >= 0, 'the relief is a height');
  assert.equal(coarse, plain, 'cells too wide to draw a crag are given none');
  n++; if (Math.abs(fine - plain) > 1) differ++; else same++;
  // A crag is a part of the range, never a new mountain: within a fifth of the lift.
  assert.ok(Math.abs(fine - plain) < biomeOf('mountains').ringLift * .45, `a crag of ${(fine - plain).toFixed(0)} m`);
 }
 assert.ok(differ > n * .5, `crags on most of the range (${differ} of ${n})`);
 assert.ok(same > 0, `and none on its valley floors (${same} of ${n})`);
});

test('a landscape with no range is given no crags', () => {
 const w = worldOf('parkland'), relief = ringRelief(w);
 for (let k = 0; k < 60; k++) {
  const a = k * 2.399963, x = Math.cos(a) * (w.halfX + 1500), z = Math.sin(a) * (w.halfZ + 1500);
  assert.equal(relief.at(x, z, 1500, 0, 20), relief.at(x, z, 1500, 0));
 }
});

test('the ring has no crags standing on its last row', () => {
 // The last ring stops at the reach, a short step after long ones; told that
 // short step as its cell, every crag stood up on it (an edge of 18 to 1).
 // Out where the cells are 220 m no crag is drawn, the last row included.
 for (const biome of ['mountains', 'dresort']) {
  const w = worldOf(biome), m = ringMesh(w, {grow: 1.08}), P = m.positions, relief = ringRelief(w);
  let n = 0;
  for (let v = 0; v < m.out.length; v++) {
   if (m.out[v] < 12900) continue;
   const x = P[v * 3], z = P[v * 3 + 2], y0 = w.height(x, z);
   assert.ok(Math.abs(P[v * 3 + 1] - (y0 + relief.at(x, z, m.out[v], y0))) < 1e-6, `${biome}: a crag on the last row`);
   n++;
  }
  assert.ok(n > 40, 'the last row was looked at');
 }
});

test('the ring\'s baked shade is nothing at the seam, bounded, and stronger on a range than on rolling country', () => {
 const mean = biome => {
  const w = worldOf(biome), m = ringMesh(w, RING_DETAIL);
  assert.equal(m.shade.length, m.positions.length / 3, 'one number a vertex');
  let sum = 0, n = 0;
  for (let v = 0; v < m.shade.length; v++) {
   const s = m.shade[v];
   assert.ok(s >= -1 && s <= 1, 'within -1 to 1');
   if (m.out[v] <= 120) assert.ok(s === 0, `nothing within 120 m of the seam (${m.out[v].toFixed(0)} m)`);
   if (m.out[v] > 600 && m.out[v] < 4000) { sum += Math.abs(s); n++; }
  }
  return sum / n;
 };
 const range = mean('mountains'), rolling = mean('parkland');
 assert.ok(range > rolling * 1.5, `a range ${range.toFixed(2)}, rolling country ${rolling.toFixed(2)}`);
 assert.ok(range > .1, 'and enough to see');
});

test('a landscape that names its far plants is planted with them past the line, and with nothing else', () => {
 for (const biome of ['dresort', 'hiresort']) {
  const w = worldOf(biome), named = new Set(biomeOf(biome).farPlants.map(([k]) => k)), around = surroundTrees(w);
  assert.ok(around.far.length > 50, `${biome} has far sites (${around.far.length})`);
  for (const s of around.far) assert.ok(named.has(s.kind), `${biome}: ${s.kind} past the line`);
  // Every one of them is a plant the course itself grows, so its model is loaded.
  const grown = new Set(biomeOf(biome).plants.map(([k]) => k));
  for (const k of named) assert.ok(grown.has(k), `${biome} grows ${k}`);
 }
 // The Desert Resort's Afghan pines stay inside the property; Hawaii's Cook pines are few.
 assert.ok(!surroundTrees(worldOf('dresort')).far.some(s => s.kind === 'drafghan'));
 const hi = surroundTrees(worldOf('hiresort')).far, cook = hi.filter(s => s.kind === 'hicookpine').length;
 assert.ok(cook < hi.length * .2, `${cook} Cook pines of ${hi.length}`);
 assert.equal(biomeOf('parkland').farPlants, null, 'and a landscape that names none keeps its stand');
});
