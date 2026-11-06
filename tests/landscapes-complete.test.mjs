// EVERY LANDSCAPE IS COMPLETE (the US landscapes goal, 2 November 2026; the
// owner's plan, PLAN.md section 2, local). A landscape a player can pick
// must answer everything the game and the builder ask of it; this walks
// BIOME_KEYS and fails on the first thing missing, naming the landscape. A
// landscape the goal adds is not done until it passes here.
import test from 'node:test';

// The open scatter's pick walks the weights cumulatively, so a list summing
// past 1 never plants what is past it (generator 61: Redwood Coast's iris,
// Lake Dunes' sand cherry and the Sonoran's ironwood were never planted).
test('every planting list sums to one', () => {
 for (const [key, b] of Object.entries(BIOMES)) for (const [name, list] of [['plants', b.plants], ['stands', b.stands?.plants], ['under', b.stands?.under?.plants]]) {
  if (!list) continue;
  const sum = list.reduce((t, p) => t + p[1], 0);
  if (Math.abs(sum - 1) > 1e-9) throw Error(`${key} ${name} sums to ${sum.toFixed(3)}`);
 }
});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BIOME_KEYS, migrateSettings, DEFAULT_COURSE, validateSettings} from '../src/settings-schema.js';
import {BIOMES, WORLD_GENERIC} from '../src/biomes.js';
import {LANDSCAPES, REGIONS, OLD_KEYS, currentKey} from '../src/regions.js';
import {NAME_WORDS} from '../src/course-names.js';
import {LAND_WORDS} from '../src/hole-names.js';
import {MOTIFS} from '../src/crest.js';
import {US_SHAPES} from '../src/us-map-data.js';
import {seasonLook, SEASONS} from '../src/seasons.js';

test('the landscapes a player can pick are exactly the built ones, each in the full list', () => {
 assert.deepEqual([...BIOME_KEYS].sort(), Object.keys(BIOMES).sort());
 for (const k of BIOME_KEYS) {
  assert.ok(LANDSCAPES[k], `${k} is not in regions.js LANDSCAPES`);
  assert.ok(REGIONS[LANDSCAPES[k].region], `${k}'s region`);
 }
 for (const [k, l] of Object.entries(LANDSCAPES)) {
  assert.ok(REGIONS[l.region], `${k}'s region ${l.region}`);
  assert.ok(l.name && l.name.length <= 20, `${k}'s name`);
  const [lat, lon] = l.where;
  assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, `${k}'s place`);
  assert.match(k, /^[a-z]{3,12}$/, 'a key is short and lower case');
 }
 // Every region holds at least one landscape.
 for (const r of Object.keys(REGIONS)) assert.ok(Object.values(LANDSCAPES).some(l => l.region === r), r);
});

test('every built landscape has its record, interface, world, names, crest and pictures', () => {
 for (const k of BIOME_KEYS) {
  const b = BIOMES[k];
  for (const f of ['rough', 'semi', 'fairway', 'fringe', 'green', 'tree', 'sky', 'sand', 'water', 'rock', 'altitude', 'temperature', 'treeKind', 'sun', 'title', 'tag'])
   assert.ok(b[f] !== undefined, `${k} has no ${f}`);
  assert.equal(b.key, k);
  assert.equal(b.name, LANDSCAPES[k].name);
  for (const f of ['panel', 'a1', 'a2', 'hot', 'soft', 'onHot']) assert.ok(b.ui?.[f], `${k}'s interface has no ${f}`);
  for (const f of Object.keys(WORLD_GENERIC)) assert.ok(f in b.world, `${k}'s world has no ${f}`);
  assert.ok(b.world.clubhouse && b.world.path && b.world.bridge, `${k}'s clubhouse, path and bridge`);
  assert.ok(NAME_WORDS[k]?.[0]?.length && NAME_WORDS[k]?.[1]?.length, `${k} has no course names (course-names.js)`);
  assert.ok(LAND_WORDS[k]?.length >= 6, `${k} has no hole names (hole-names.js)`);
  assert.ok(MOTIFS[k], `${k} has no crest motif (crest.js)`);
  assert.ok(fs.existsSync(`src/shots/${k}-1.webp`), `${k} has no landscape picture (src/shots/${k}-1.webp)`);
  for (const s of SEASONS) assert.equal(typeof seasonLook(b, s), 'object', `${k} in ${s}`);
 }
});

test('every species a landscape plants has its models in the game', async () => {
 const {FAMILY_OF} = await import('../src/mesh-assets.js');
 const {MESH_MODELS} = await import('../src/asset-meshes.js');
 const families = new Set(Object.values(MESH_MODELS).map(m => m.family));
 for (const k of BIOME_KEYS) {
  const b = BIOMES[k];
  const planted = [...(b.plants || []), ...(b.stands?.plants || []), ...(b.stands?.under?.plants || [])].map(p => p[0]);
  for (const s of planted) {
   assert.ok(FAMILY_OF[s], `${k} plants ${s}, which has no family (mesh-assets.js FAMILY_OF)`);
   assert.ok(families.has(FAMILY_OF[s]), `${k} plants ${s}, whose family ${FAMILY_OF[s]} has no models (tools/build-meshes.mjs)`);
  }
 }
});

test('no two landscapes share a course name word list', () => {
 const seen = new Map();
 for (const k of BIOME_KEYS) {
  const id = JSON.stringify(NAME_WORDS[k]);
  assert.ok(!seen.has(id), `${k} shares its course names with ${seen.get(id)}`);
  seen.set(id, k);
 }
});

test('every landscape in the USA has a shape on the map; Scottish Links has none', () => {
 const drawn = new Set(US_SHAPES.map(s => s.key));
 for (const [k, l] of Object.entries(LANDSCAPES)) assert.equal(drawn.has(k), l.us, k);
 for (const s of US_SHAPES) assert.ok(LANDSCAPES[s.key], `a shape for ${s.key}, which is no landscape`);
});

test('the old keys lead to built landscapes, and the settings migration agrees', () => {
 for (const [old, now] of Object.entries(OLD_KEYS)) {
  assert.ok(BIOME_KEYS.includes(now), `${old} -> ${now}`);
  assert.equal(currentKey(old), now);
  if (old === 'haunted') continue; // reaches schema 16 already as Autumn's key
  assert.equal(validateSettings(migrateSettings({...DEFAULT_COURSE, seed: 'OLD', biome: old}, 16)).biome, now, old);
 }
 for (const k of BIOME_KEYS) assert.equal(currentKey(k), k);
});
