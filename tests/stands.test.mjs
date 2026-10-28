// UNCLEARED STANDS (the cartoon overhaul; src/stands.js): dense woods or
// thicket round the property and between the holes. These hold that every
// landscape that asks gets one, that it keeps back from play, that it obeys
// the rules every tree obeys, and that it is the seed's alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {standsOf, standSites, choose} from '../src/stands.js';
import {BIOMES} from '../src/biomes.js';
import {allows} from '../src/grounds.js';
import {generateWorld} from '../src/course.js';

const build = (biome, seed = 'stand') => generateWorld({seed, biome, holes: 9, trees: 60, homes: true});

test('every stand record is whole, and names plants its landscape can draw', () => {
 for (const [key, bio] of Object.entries(BIOMES)) {
  const o = bio.stands;
  if (!o) continue;
  for (const k of ['edge', 'wobble', 'ramp', 'spacing']) assert.ok(o[k] > 0, `${key}: ${k}`);
  assert.ok(o.edge - o.wobble >= 25, `${key}: the rim can reach within 25 m of a corridor`);
  assert.ok(!o.patch || o.near >= 30, `${key}: patches allowed within 30 m of a corridor`);
  for (const [kind] of o.plants ?? bio.plants) assert.ok(bio.plants.some(([k]) => k === kind) || ['gorse', 'shrub', 'palm', 'hala', 'naupaka', 'mesquite', 'palo', 'cactus', 'ocotillo'].includes(kind), `${key}: ${kind}`);
 }
});

test('a stand is planted thick, back from play, on ground that holds a tree', () => {
 for (const biome of ['pnw', 'desert', 'autumn']) {
  const w = build(biome), stand = w.trees.filter(t => t.stand), open = w.trees.filter(t => !t.stand);
  assert.ok(stand.length > open.length, `${biome}: ${stand.length} stand trees against ${open.length} in the open`);
  const o = w.bio.stands;
  for (const t of stand) {
   assert.ok(allows(w.surface(t.x, t.z), 'trees') || w.surface(t.x, t.z) === 'pinestraw' || w.surface(t.x, t.z) === 'litter', `${biome}: a stand tree on ${w.surface(t.x, t.z)}`);
   assert.ok(w.nearest(t.x, t.z).d >= Math.min(o.near, o.edge - o.wobble) - 1, `${biome}: a stand tree ${w.nearest(t.x, t.z).d.toFixed(1)} m outside a corridor`);
  }
 }
});

test('a landscape without a stand plants none, nor does the range', () => {
 assert.equal(build('redwood').trees.filter(t => t.stand).length, 0);
 assert.equal(standsOf({}, 'x'), null);
 const range = generateWorld({seed: 'stand', biome: 'pnw', holes: 1, range: true, trees: 60});
 assert.equal(range.trees.filter(t => t.stand).length, 0);
});

test('the sites and the field are the seed\'s alone', () => {
 const o = standsOf(BIOMES.pnw, 'a');
 const a = standSites(o, 300, 200, 'a'), b = standSites(o, 300, 200, 'a'), c = standSites(o, 300, 200, 'b');
 assert.deepEqual(a, b);
 assert.notDeepEqual(a.map(p => p.x), c.map(p => p.x));
 for (const p of a) assert.ok(Math.abs(p.x) <= 300 && Math.abs(p.z) <= 200);
 assert.equal(o.at(0, 0, -10), 0, 'inside a corridor is never a stand');
 assert.equal(o.at(0, 0, 500), 1, 'far outside every corridor is always a stand');
 assert.equal(choose([['a', 1], ['b', 3]], .1), 'a');
 assert.equal(choose([['a', 1], ['b', 3]], .9), 'b');
 assert.deepEqual(build('pnw', 's1').trees.filter(t => t.stand).map(t => [t.x, t.z, t.kind]).slice(0, 50),
  build('pnw', 's1').trees.filter(t => t.stand).map(t => [t.x, t.z, t.kind]).slice(0, 50));
});

// The forest painted on the far hills (ground.js, rendering only): a record
// the shader can take -- three or four colours, a share of the country, a
// crown spacing -- on every landscape, so none is left with bare hills.
test('every landscape paints forest on its far hills, from a record the shader can take', async () => {
 const {farForestUniforms} = await import('../src/ground.js');
 for (const [key, bio] of Object.entries(BIOMES)) {
  const f = bio.farForest;
  assert.ok(f, `${key} has bare far hills`);
  assert.ok(f.cover > 0 && f.cover <= 1 && f.size >= 4, `${key}: cover ${f.cover}, size ${f.size}`);
  assert.ok(f.colors.length === 3 || f.colors.length === 4, `${key}: ${f.colors.length} colours`);
  for (const c of f.colors) assert.match(c, /^#[0-9a-f]{6}$/i, `${key}: ${c}`);
  const u = farForestUniforms(bio);
  assert.equal(u.farOn.value, 1);
  assert.ok(u.farC3.value.r <= 1 && u.farC3.value.g <= 1);
 }
 assert.equal(farForestUniforms({}).farOn.value, 0);
});

// The long grass between the holes (vegetation.js addLongGrass, decoration):
// every landscape's record names families the model module carries, with a
// height and a weight, and colours the renderer can parse.
test('every landscape grows long grass from families that exist', async () => {
 const {familyModels} = await import('../src/mesh-assets.js');
 for (const [key, bio] of Object.entries(BIOMES)) {
  const g = bio.longGrass;
  assert.ok(g, `${key} grows no long grass`);
  assert.ok(g.count > 0 && g.near >= 10, `${key}: count ${g.count}, near ${g.near}`);
  for (const [family, weight, height] of g.families) {
   assert.ok(familyModels(family).length > 0, `${key}: no models in ${family}`);
   assert.ok(weight > 0 && height > .2 && height < 2, `${key}: ${family} ${weight} ${height}`);
  }
  for (const c of [g.leaf, g.accent]) assert.match(c, /^#[0-9a-f]{6}$/i);
 }
});

// A stand's understory (course.js `under`) is shrubs and ferns: trunkless, so
// a ball passes through and a graphics tier may draw a share of it without
// two players meeting different courses.
test('the understory is plants a ball passes through, planted inside stands only', async () => {
 const {GROUND_PLANTS} = await import('../src/species.js');
 for (const [key, bio] of Object.entries(BIOMES)) {
  for (const [kind] of bio.stands?.under?.plants ?? []) assert.ok(GROUND_PLANTS.has(kind), `${key}: ${kind} has a trunk`);
 }
 const w = build('pnw'), under = w.trees.filter(t => t.under);
 assert.ok(under.length > 100, `only ${under.length} understory plants`);
 const o = standsOf(w.bio, w.seed);
 for (const t of under.slice(0, 400)) assert.ok(o.at(t.x, t.z, w.nearest(t.x, t.z).d) >= .5, 'understory outside a stand');
});
