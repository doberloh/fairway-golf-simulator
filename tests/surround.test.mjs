import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {surroundTrees, SURROUND_TREES} from '../src/surround.js';
import {FAR_SHAPES} from '../src/far-woods.js';
import {drawnGround, ringMesh} from '../src/landscape-edge.js';
import {farWoodGeometry} from '../src/vegetation.js';
import {biomeOf} from '../src/biomes.js';

// The surroundings' trees (the surroundings rework, 12 November 2026;
// src/surround.js): past the property line the landscape's own stand carries
// on -- near, as tree records drawn with the course's models; beyond, as sites
// drawn as pictures of them (src/far-trees.js, which needs a graphics card and
// is not tested here). They replaced the far woods' clusters, domes and cones.
// The bench's `surround` checks every course; this holds the rules together.
const SETTINGS = {seed: 'SURROUND', holes: 9};
// One small world a landscape, built when first asked for: its own tree count
// taken BEFORE the surroundings are planted, and the surroundings at their
// default options.
const WORLDS = {};
const worldOf = biome => WORLDS[biome] ??= (() => {
 const w = generateWorld({...SETTINGS, biome}), own = w.trees.length;
 return {w, own, around: surroundTrees(w)};
})();
// Metres past the property line (0 inside it).
const past = (w, s) => Math.hypot(Math.max(0, Math.abs(s.x) - w.halfX), Math.max(0, Math.abs(s.z) - w.halfZ));
// Sites a square kilometre in the band `lo` to `hi` metres past the line: the
// band round a rectangle is its sides times the depth, plus the corners' ring.
const perKm2 = (w, sites, lo, hi) => sites.filter(s => past(w, s) >= lo && past(w, s) < hi).length
 / ((4 * (w.halfX + w.halfZ) * (hi - lo) + Math.PI * (hi * hi - lo * lo)) / 1e6);
// Two lists the same, entry by entry (a failure names one entry, not 150,000).
const sameList = (a, b, what) => {
 assert.equal(a.length, b.length, `${what}: ${a.length} against ${b.length}`);
 for (let i = 0; i < a.length; i++) assert.deepEqual(a[i], b[i], `${what} ${i}`);
};

test('the surroundings are the same every time: cached on the world, and equal on a fresh one', () => {
 const {w, around} = worldOf('parkland');
 // No real models past the line by default (`nearMax` 0, round 8): pictures from the line.
 assert.ok(around.near.length === 0 && around.far.length > 1000, `${around.near.length} near, ${around.far.length} far`);
 assert.equal(surroundTrees(w), around, 'the same options return the same object');
 assert.equal(surroundTrees(w, {...SURROUND_TREES}), around, 'the defaults spelled out are the defaults');
 const fresh = surroundTrees(generateWorld({...SETTINGS, biome: 'parkland'}));
 assert.notEqual(fresh, around);
 sameList(fresh.near, around.near, 'near tree');
 sameList(fresh.far, around.far, 'far site');
});

test('near trees stand just past the property line, on the course\'s ground, in the landscape\'s own stand, and are not the world\'s', () => {
 for (const biome of ['parkland', 'mountains', 'dmountain']) {
  // (Asked for: the default draws none as models. The band and its cap stay.)
  const {w, own} = worldOf(biome), around = surroundTrees(w, {nearMax: 200}), bio = biomeOf(biome), g = w.groundGrid;
  const kinds = new Set((bio.stands?.plants ?? bio.plants).map(([k]) => k)), theirs = new Set(w.trees);
  assert.ok(around.near.length > 0, `${biome}: no near trees`);
  assert.ok(around.near.length <= 200, `${biome}: ${around.near.length} near trees, the most asked for is 200`);
  assert.equal(w.trees.length, own, `${biome}: the world's own trees went from ${own} to ${w.trees.length}`);
  for (const t of around.near) {
   const where = `${biome} ${t.kind} at ${t.x.toFixed(0)},${t.z.toFixed(0)}`;
   assert.ok(Math.abs(t.x) > w.halfX || Math.abs(t.z) > w.halfZ, `${where}: inside the property line`);
   assert.ok(Math.abs(t.x) < g.halfX && Math.abs(t.z) < g.halfZ, `${where}: off the course's ground`);
   assert.ok(past(w, t) < SURROUND_TREES.near, `${where}: ${past(w, t).toFixed(1)} m past the line`);
   assert.equal(t.surround, true, `${where}: not marked as the surroundings'`);
   assert.ok(Number.isFinite(t.h) && t.h > 0 && Number.isFinite(t.r) && t.r > 0 && Number.isFinite(t.y), `${where}: h ${t.h}, r ${t.r}, y ${t.y}`);
   assert.ok(kinds.has(t.kind), `${where}: not one of the landscape's stand plants`);
   assert.ok(!theirs.has(t), `${where}: in the world's own tree list`);
  }
 }
});

// A far site inside the near band is one of the band's trees past its `nearMax`
// real models: there only when the models are all taken, no nearer the line
// than any of them, outside the property, and drawn at its own size.
const overflowOf = (w, around, o, s, where) => {
 const d = past(w, s), last = around.near.reduce((m, t) => Math.max(m, past(w, t)), 0);
 assert.equal(around.near.length, o.nearMax, `${where}: a picture ${d.toFixed(1)} m past the line with ${around.near.length} of ${o.nearMax} models used`);
 assert.ok(d >= last - 1e-9, `${where}: a picture ${d.toFixed(1)} m past the line, nearer than a model at ${last.toFixed(1)} m`);
 assert.ok(Math.abs(s.x) > w.halfX || Math.abs(s.z) > w.halfZ, `${where}: inside the property line`);
 assert.equal(s.grow, 1, `${where}: a near band's picture drawn ${s.grow} times its size`);
};

test('far sites stand past the near band (or are its trees past the most drawn as models), within reach, out of the water and under the treeline', () => {
 for (const biome of ['parkland', 'mountains', 'dmountain']) {
  const {w, around} = worldOf(biome), level = w.waterLevel ?? 0, line = biomeOf(biome).farForest.line;
  assert.ok(around.far.length > 0, `${biome}: no far sites`);
  assert.ok(around.far.some(s => past(w, s) >= SURROUND_TREES.near), `${biome}: no far sites past the near band`);
  for (const s of around.far) {
   const d = past(w, s), where = `${biome} ${s.kind} at ${s.x.toFixed(0)},${s.z.toFixed(0)}`;
   if (d < SURROUND_TREES.near - 1e-9) overflowOf(w, around, SURROUND_TREES, s, where);
   assert.ok(d <= SURROUND_TREES.reach + 1e-9, `${where}: ${d.toFixed(1)} m past the line, beyond the reach`);
   assert.ok(s.y >= level, `${where}: at ${s.y.toFixed(2)} m, below the water at ${level}`);
   assert.ok(Number.isFinite(s.h) && s.h > 0 && Number.isFinite(s.r) && s.r > 0, `${where}: h ${s.h}, r ${s.r}`);
   if (line !== undefined) assert.ok(s.y <= line + 20, `${where}: at ${s.y.toFixed(0)} m, above the treeline at ${line}`);
  }
 }
 // Mountain has a treeline, or the check above proved nothing.
 assert.ok(Number.isFinite(biomeOf('mountains').farForest.line));
});

test('far sites thin with distance, and each is drawn between once and twice its size', () => {
 const {w, around} = worldOf('parkland');
 const close = perKm2(w, around.far, 200, 800), distant = perKm2(w, around.far, 2500, 4500);
 assert.ok(distant > 0, 'no sites 2.5 to 4.5 km out');
 assert.ok(close > distant, `${close.toFixed(0)} a square kilometre at 200-800 m, ${distant.toFixed(0)} at 2500-4500 m`);
 for (const biome of ['parkland', 'mountains', 'dmountain']) for (const s of worldOf(biome).around.far)
  assert.ok(s.grow >= 1 && s.grow <= 2, `${biome}: a site drawn ${s.grow} times its size`);
});

test('the options bound the far sites: a shorter reach holds fewer, and the defaults stay under 250,000', () => {
 const {w, around} = worldOf('parkland'), o = {near: 60, reach: 1500, fall: 1200}, short = surroundTrees(w, o);
 assert.ok(around.far.length < 250000, `${around.far.length} far sites at the defaults`);
 assert.ok(short.far.length > 0 && short.far.length < around.far.length, `${short.far.length} within 1500 m against ${around.far.length} at the defaults`);
 for (const s of short.far) {
  assert.ok(past(w, s) <= o.reach + 1e-9, `a site ${past(w, s).toFixed(1)} m past the line`);
  if (past(w, s) < o.near - 1e-9) overflowOf(w, short, {...SURROUND_TREES, ...o}, s, 'the shorter reach');
 }
 for (const t of short.near) assert.ok(past(w, t) < o.near, `a near tree ${past(w, t).toFixed(1)} m past the line`);
 // `nearMax` changes how the near band is drawn, never what stands in it: the
 // same trees, fewer of them as models.
 const few = surroundTrees(w, {nearMax: 50}), all = surroundTrees(w, {nearMax: 1e9});
 assert.equal(few.near.length, 50);
 assert.ok(all.near.length > SURROUND_TREES.nearMax, `${all.near.length} trees in the near band`);
 assert.ok(all.far.every(s => past(w, s) >= SURROUND_TREES.near - 1e-9), 'with no limit, no picture stands in the near band');
 for (const a of [few, around]) assert.equal(a.near.length + a.far.length, all.near.length + all.far.length, 'the trees past the line, however drawn');
});

test('a scrub far forest has far sites, far fewer of them than woodland', () => {
 const park = worldOf('parkland'), dry = worldOf('dmountain');
 assert.equal(biomeOf('dmountain').farForest.scrub, true);
 assert.ok(dry.around.far.length > 0, 'no far sites on a scrub landscape');
 const {near, reach} = SURROUND_TREES;
 const wooded = perKm2(park.w, park.around.far, near, reach), scrub = perKm2(dry.w, dry.around.far, near, reach);
 assert.ok(scrub < wooded / 3, `${scrub.toFixed(0)} a square kilometre of scrub against ${wooded.toFixed(0)} of woodland`);
});

// (From the far woods' tests: the far sites stand on `drawnGround`, so it must
// be the ring's own triangles.)
test('the drawn ground reproduces the ring\'s own vertices', () => {
 const w = generateWorld({seed: 'FARWOODS', biome: 'seaside', holes: 9}), at = drawnGround(w), m = ringMesh(w);
 for (let v = m.count; v < m.positions.length / 3; v += 13) {
  const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
  assert.ok(Math.abs(at(x, z) - y) < .01, `vertex ${v}: ${at(x, z)} against ${y}`);
 }
});

// What is left of the far woods' shapes (far-woods.js FAR_SHAPES): the twins
// the water mirror draws for trees reflected in still water.
test('each of the water mirror\'s twin shapes is flat-based at its origin and as wide and tall as FAR_SHAPES says', () => {
 for (const kind of Object.keys(FAR_SHAPES)) {
  const g = farWoodGeometry(kind), p = g.attributes.position, [, h] = FAR_SHAPES[kind].scale;
  assert.ok(Math.abs(g.boundingBox.min.y) < 1e-6, `${kind} base at ${g.boundingBox.min.y}`);
  let wide = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < .02 * h) wide = Math.max(wide, Math.hypot(p.getX(i), p.getZ(i)));
  assert.ok(wide <= FAR_SHAPES[kind].foot + 1e-6, `${kind} base ${wide.toFixed(3)} wide, FAR_SHAPES says ${FAR_SHAPES[kind].foot}`);
  assert.ok(Math.abs(g.boundingBox.max.y - FAR_SHAPES[kind].tall) < .15 * FAR_SHAPES[kind].tall, `${kind} ${g.boundingBox.max.y.toFixed(2)} tall, FAR_SHAPES says ${FAR_SHAPES[kind].tall}`);
 }
});
