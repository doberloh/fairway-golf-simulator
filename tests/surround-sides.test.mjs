import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {ringMesh, ringRelief, normaliseSurround, waterSide, SURROUND_KINDS, SURROUND_SIDES, RING_DETAIL} from '../src/landscape-edge.js';

// WHAT STANDS ON EACH SIDE, WHEN THE COURSE SAYS (the surroundings rework;
// landscape-edge.js `sidedRelief`): a world's `surround` record names a kind
// for each of its four sides, and the far ring is raised by it.
const world = generateWorld({seed: 'SIDES', biome: 'parkland', holes: 9});
// The ring's mean and highest ground past one side, between two distances.
const past = (w, side, from, to, detail = {grow: 1.08}) => {
 const {positions: P} = ringMesh(w, detail), gx = w.groundGrid.halfX, gz = w.groundGrid.halfZ;
 let n = 0, sum = 0, top = -Infinity, low = Infinity;
 for (let i = 0; i < P.length; i += 3) {
  const x = P[i], y = P[i + 1], z = P[i + 2];
  // Squarely past that side: beyond it and within the property's own width.
  const d = side === 'e' ? x - gx : side === 'w' ? -x - gx : side === 's' ? z - gz : -z - gz, across = side === 'e' || side === 'w' ? Math.abs(z) < w.halfZ : Math.abs(x) < w.halfX;
  if (!across || d < from || d > to) continue;
  n++; sum += y; top = Math.max(top, y); low = Math.min(low, y);
 }
 return {n, mean: sum / n, top, low};
};
const withSides = (sides, more = {}) => ({...world, surround: {sides: {n: 'auto', e: 'auto', s: 'auto', w: 'auto', ...sides}, height: 1, ...more}});

test('a record from a file is made safe, and one that changes nothing is no record', () => {
 assert.equal(normaliseSurround(null), null);
 assert.equal(normaliseSurround({sides: {n: 'auto', e: 'auto', s: 'auto', w: 'auto'}}), null, 'all auto at height 1 is the landscape\'s own');
 assert.deepEqual(normaliseSurround({sides: {e: 'sea', n: 'volcano'}, height: 9}), {sides: {n: 'auto', e: 'sea', s: 'auto', w: 'auto'}, height: 2});
 assert.deepEqual(normaliseSurround({sides: {w: 'range'}, height: 'tall', cover: -3}), {sides: {n: 'auto', e: 'auto', s: 'auto', w: 'range'}, height: 1, cover: 0});
 assert.deepEqual(normaliseSurround({height: .5}).height, .5);
 assert.deepEqual(SURROUND_SIDES, ['n', 'e', 's', 'w']);
 assert.ok(SURROUND_KINDS.includes('auto') && SURROUND_KINDS.includes('mountain') && SURROUND_KINDS.includes('lake'));
 assert.ok(waterSide('sea') && waterSide('lake') && waterSide('islands') && !waterSide('hills') && !waterSide('auto'));
});

test('a world with no record keeps its landscape\'s ring exactly', () => {
 const plain = ringMesh(world, {grow: 1.08}), again = ringMesh({...world, surround: null}, {grow: 1.08});
 assert.deepEqual(again.positions, plain.positions);
 // And the relief asked without the ground under it (tests, tools) still answers.
 assert.ok(Number.isFinite(ringRelief(world).at(world.halfX + 3000, 0, 3000)));
});

test('each side takes its own kind: a range one way, flat country another, a sea a third', () => {
 const w = withSides({e: 'range', w: 'flat', s: 'sea', n: 'hills'});
 const east = past(w, 'e', 2500, 6000), west = past(w, 'w', 2500, 6000), south = past(w, 's', 400, 3000), north = past(w, 'n', 2500, 6000);
 for (const p of [east, west, south, north]) assert.ok(p.n > 20, `${p.n} ring vertices past a side`);
 assert.ok(east.top > 350, `the range's highest ground is ${east.top.toFixed(0)} m`);
 assert.ok(east.top > north.top + 150, `a range (${east.top.toFixed(0)} m) stands over hills (${north.top.toFixed(0)} m)`);
 assert.ok(north.top > west.top + 20, `hills (${north.top.toFixed(0)} m) stand over flat country (${west.top.toFixed(0)} m)`);
 // The sea: every vertex from 400 m out is under the water.
 assert.ok(south.top < (w.waterLevel ?? 0) - 2, `the sea bed's highest point is ${south.top.toFixed(1)} m`);
 // The flat side adds nothing: it is the course's own country carried on.
 const {positions: P} = ringMesh(w, {grow: 1.08});
 let checked = 0;
 for (let i = 0; i < P.length; i += 3) {
  const x = P[i], z = P[i + 2];
  if (-x - w.groundGrid.halfX < 500 || Math.abs(z) > w.halfZ * .9) continue;
  assert.ok(Math.abs(P[i + 1] - w.height(x, z)) < 1e-6, 'flat is the land as it is'); checked++;
 }
 assert.ok(checked > 20);
});

test('one mountain stands off the side that asks for it, and nowhere else', () => {
 for (const side of ['n', 'e', 's', 'w']) {
  const w = withSides({n: 'flat', e: 'flat', s: 'flat', w: 'flat', [side]: 'mountain'});
  const here = past(w, side, 800, 6000);
  assert.ok(here.top > 400, `${side}: the mountain rises ${here.top.toFixed(0)} m`);
  for (const other of ['n', 'e', 's', 'w']) if (other !== side) {
   const there = past(w, other, 800, 6000), flat = past(withSides({n: 'flat', e: 'flat', s: 'flat', w: 'flat'}), other, 800, 6000);
   assert.ok(there.top < flat.top + 60, `${side}: nothing stands to the ${other} (${there.top.toFixed(0)} m against ${flat.top.toFixed(0)})`);
  }
 }
});

test('a lake has a far shore, height scales the relief, and the ring has no step at a corner', () => {
 const lake = withSides({e: 'lake'});
 const water = past(lake, 'e', 400, 1100), shore = past(lake, 'e', 2600, 6000);
 assert.ok(water.top < (lake.waterLevel ?? 0) - 1, `the lake bed is under water (${water.top.toFixed(1)} m)`);
 assert.ok(shore.top > (lake.waterLevel ?? 0) + 5, `land stands beyond it (${shore.top.toFixed(0)} m)`);
 const low = past(withSides({e: 'range'}, {height: .5}), 'e', 2500, 6000), high = past(withSides({e: 'range'}, {height: 1.5}), 'e', 2500, 6000);
 assert.ok(high.top > low.top * 2, `height 1.5 (${high.top.toFixed(0)} m) against 0.5 (${low.top.toFixed(0)} m)`);
 // Round a corner the two sides blend: neighbouring ring vertices never differ
 // by more than the slope a range itself has (a step would be hundreds of metres).
 const w = withSides({e: 'range', s: 'flat', n: 'sea', w: 'mesas'}), m = ringMesh(w, {grow: 1.08}), P = m.positions, I = m.indices;
 let worst = 0;
 for (let k = 0; k < I.length; k += 3) for (const [a, b] of [[I[k], I[k + 1]], [I[k + 1], I[k + 2]]]) {
  const run = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 2] - P[b * 3 + 2]);
  if (run > 1) worst = Math.max(worst, Math.abs(P[a * 3 + 1] - P[b * 3 + 1]) / run);
 }
 assert.ok(worst < 6, `the steepest edge in the ring is ${worst.toFixed(1)} to 1`);
 assert.equal(RING_DETAIL.grow, 1.02);
});
