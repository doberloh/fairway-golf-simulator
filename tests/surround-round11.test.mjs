import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {ringMesh, ringRelief, drawnGround} from '../src/landscape-edge.js';
import {surroundTrees, FAR_STEEP} from '../src/surround.js';
import {biomeOf, BIOMES} from '../src/biomes.js';
import {FAR_FACE} from '../src/ground.js';

// ROUND 11 OF THE SURROUNDINGS REWORK (13 November 2026). The owner, of the
// mountainsides round 10 left: the rock's cell pattern "looks like actively
// bad"; Hawaii's mountains "more rounded and less steep"; "trees growing on
// almost vertical surfaces"; "we also shouldnt have trees growing on top of
// that mountain" (Desert Mountain). What is held here: Hawaii's rounder range
// (landscape-edge.js `ringRound`, `ringCrags`), the steepest ground a far
// plant stands on (surround.js FAR_STEEP), the deserts' bare mountains
// (biomes.js `farLine`), and that no landscape still asks the rock's paint
// for cells. The paint itself and the far trees' lighting need a graphics
// card and are looked at in captures.
const WORLDS = {};
const worldOf = biome => WORLDS[biome] ??= generateWorld({seed: 'CRAGS', biome, holes: 9});

// The share of the drawn far ground, to 4 km, steeper than `degrees`; and its top.
function steepness(biome, degrees) {
 const w = worldOf(biome), m = ringMesh(w), p = m.positions, ix = m.indices, cos = Math.cos(degrees * Math.PI / 180);
 let area = 0, steep = 0, top = -Infinity;
 for (let t = 0; t < ix.length; t += 3) {
  const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
  if (Math.max(Math.abs(p[a]) - w.halfX, Math.abs(p[a + 2]) - w.halfZ) > 4000) continue;
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, plan = Math.abs(ny) / 2;
  area += plan; if (Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1) < cos) steep += plan;
  top = Math.max(top, p[a + 1]);
 }
 return {share: steep / area, top};
}

test('Hawaii\'s far mountains are rounded: far less steep ground than Mountain\'s, and no crags', () => {
 const hi = steepness('hiresort', 45), mt = steepness('mountains', 45);
 // Before the round a quarter of Hawaii's far ground to 4 km was steeper than
 // 45 degrees (seed FAIRWAY: 25.2%, its top at 930 m); after, a twentieth.
 assert.ok(hi.share < .1, `Hawaii: ${(hi.share * 100).toFixed(1)}% steeper than 45 degrees`);
 assert.ok(mt.share > hi.share * 4, `Mountain keeps its walls: ${(mt.share * 100).toFixed(1)}%`);
 assert.ok(hi.top < 720 && hi.top > 250, `Hawaii's top ${hi.top.toFixed(0)} m: lower, and still a mountain`);
 const w = worldOf('hiresort'), relief = ringRelief(w);
 for (let k = 0; k < 120; k++) {
  const a = k * 2.399963, x = Math.cos(a) * (w.halfX + 1600), z = Math.sin(a) * (w.halfZ + 1600);
  assert.equal(relief.at(x, z, 1600, 0, 20), relief.at(x, z, 1600, 0), 'no crag anywhere on a range that asks for none');
 }
 assert.equal(biomeOf('mountains').ringRound, 0, 'and Mountain is not rounded');
});

test('no far plant stands on a steep face', () => {
 // Counted more strictly than the rule itself plants by (eight ways at 8 m,
 // where the rule looks six ways at 7 m): before the round 28% of Hawaii's far
 // plants, 34% of Mountain's and 22% of Desert Resort's stood on over 40
 // degrees, the steepest at 75.
 for (const [biome, most] of [['mountains', .09], ['hiresort', .03], ['dresort', .04], ['dmountain', .02], ['parkland', .01]]) {
  const w = worldOf(biome), far = surroundTrees(w).far, at = drawnGround(w), inside = (x, z) => Math.abs(x) < w.groundGrid.halfX && Math.abs(z) < w.groundGrid.halfZ;
  assert.ok(far.length > 50, `${biome} has far plants (${far.length})`);
  let steep = 0, worst = 0;
  for (const s of far) {
   const h = inside(s.x, s.z) ? w.height : at, y = h(s.x, s.z);
   let slope = 0;
   for (let k = 0; k < 8; k++) { const q = k * Math.PI / 4; slope = Math.max(slope, Math.abs(h(s.x + Math.cos(q) * 8, s.z + Math.sin(q) * 8) - y) / 8); }
   if (slope > FAR_STEEP) steep++;
   worst = Math.max(worst, slope);
  }
  assert.ok(steep <= far.length * most, `${biome}: ${steep} of ${far.length} far plants on over 40 degrees`);
  assert.ok(worst < 2, `${biome}: the steepest ground under one is ${(Math.atan(worst) * 180 / Math.PI).toFixed(0)} degrees`);
 }
});

test('a desert mountain is bare above its line, and a landscape with no line of its own is planted as before', () => {
 for (const biome of ['dmountain', 'dresort']) {
  const w = worldOf(biome), line = biomeOf(biome).farLine, far = surroundTrees(w).far, base = w.skyBase ?? 0;
  assert.ok(line > 100, `${biome} names a line (${line})`);
  assert.ok(far.length > 50, `${biome} still has far plants (${far.length})`);
  let top = -Infinity; for (const s of far) top = Math.max(top, s.y - base);
  assert.ok(top <= line + 20, `${biome}: the highest far plant is ${top.toFixed(0)} m over the course, the line ${line}`);
  // And the mountain itself stands well above it: the line is what bares it.
  let peak = -Infinity; const p = ringMesh(w).positions; for (let i = 1; i < p.length; i += 3) peak = Math.max(peak, p[i]);
  assert.ok(peak - base > line * 1.8, `${biome}: the range tops out at ${peak.toFixed(0)} m`);
 }
 assert.equal(biomeOf('parkland').farLine, null);
 assert.equal(biomeOf('mountains').farForest.line, 520, 'Mountain keeps its own treeline');
});

test('no landscape asks the far rock for the cells it was broken into', () => {
 const known = new Set(Object.keys(FAR_FACE));
 for (const gone of ['wide', 'tall', 'crack']) assert.ok(!known.has(gone), `${gone} is no setting`);
 for (const key of Object.keys(BIOMES)) {
  const face = biomeOf(key).farFace;
  if (face) for (const k of Object.keys(face)) assert.ok(known.has(k), `${key}: farFace.${k} is not a setting the paint reads`);
 }
});

test('the edge of a far wood wanders, by the same wave on the page and on the card', async () => {
 const {farWarp, coverField} = await import('../src/surround.js');
 const fs = await import('node:fs');
 // Up to 160 m either way, and not the same push everywhere.
 let least = Infinity, most = -Infinity;
 for (let k = 0; k < 400; k++) {
  const x = (k * 37.7) % 4000 - 2000, z = (k * 91.3) % 4000 - 2000, [wx, wz] = farWarp(x, z);
  assert.ok(Math.abs(wx - x) <= 160 && Math.abs(wz - z) <= 160, 'never more than 160 m');
  least = Math.min(least, wx - x); most = Math.max(most, wx - x);
 }
 assert.ok(most - least > 250, `the push varies (${least.toFixed(0)} to ${most.toFixed(0)} m)`);
 // The ground's paint reads the same wave: the numbers appear in its shader as written here.
 const shader = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.ok(shader.includes('wp+160.*sin(wp.yx/vec2(143.,167.)+vec2(1.3,2.6))'), 'ground.js warps by the same wave');
 assert.deepEqual(farWarp(100, 200).map(n => +n.toFixed(6)), [100 + 160 * Math.sin(200 / 143 + 1.3), 200 + 160 * Math.sin(100 / 167 + 2.6)].map(n => +n.toFixed(6)));
 // And no meadow edge is a ruled line: along a line of constant x through
 // wooded country, the cover does not flip at the same x for 900 m of z.
 // (Before: on seed `overhaul` Hawaii's wood ended at x = 0 for a whole cell.)
 const w = worldOf('hiresort'), cover = coverField(biomeOf('hiresort'), w.seed);
 let ruled = 0, edges = 0;
 for (let x = -3000; x <= 3000; x += 50) {
  let flips = 0, rows = 0;
  for (let z = -3000; z <= -2100; z += 100) { rows++; if ((cover(x - 60, z) > .5) !== (cover(x + 60, z) > .5)) flips++; }
  if (flips) edges++;
  if (flips === rows) ruled++;
 }
 assert.ok(edges > 5, 'there are edges to look at');
 assert.equal(ruled, 0, 'no edge holds one x for 900 m');
});
