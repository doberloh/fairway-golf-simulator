// THE COUNTRY BETWEEN THE HOLES (the cartoon overhaul; src/landforms.js):
// each biome's recipe of relief and ground types, baked on the ground atlas
// so paint and lie read one set of bytes. These hold the half Node can see --
// the field, how it is read, the gates, the world's lie -- and check that the
// ground shader asks the same questions in the same order (ground.js cannot
// run here; TESTING.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {landformOf, wildField, wildAt, wildGate, wildGround, fallenAt, WILD_WATER} from '../src/landforms.js';
import {GROUNDS, allows} from '../src/grounds.js';
import {BIOMES} from '../src/biomes.js';
import {generateWorld} from '../src/course.js';
import {ownerAtlasSize} from '../src/owner-atlas.js';

const SEEDS = ['L1', 'L2'];

test('every recipe names ground types that exist, and a biome with blowouts leaves channel b to them', () => {
 for (const [key, bio] of Object.entries(BIOMES)) {
  const o = bio.landform;
  if (!o) continue;
  for (const ch of ['a', 'b', 'floor']) if (o.kinds?.[ch]) {
   assert.ok(GROUNDS[o.kinds[ch]], `${key}: channel ${ch} is ${o.kinds[ch]}, not a ground type`);
   assert.ok(o.gates?.[ch]?.near >= 0 && o.gates[ch].ramp > 0, `${key}: channel ${ch} has no gate`);
  }
  if (bio.blowouts) assert.ok(!o.kinds?.b, `${key}: blowouts own the blue channel`);
  if (bio.fallen) assert.ok(GROUNDS[bio.fallen.kind], `${key}: fallen ${bio.fallen.kind}`);
 }
});

test('the field is baked on the ground atlas grid and read back as a linear filter reads it', () => {
 const r = landformOf(BIOMES.mountain, 'L1'), f = wildField(r, 900, 700, () => 0);
 assert.deepEqual({Sx: f.Sx, Sz: f.Sz}, ownerAtlasSize(900, 700));
 for (const [i, j] of [[3, 5], [100, 200], [f.Sx - 1, f.Sz - 1]]) {
  const x = ((i + .5) / f.Sx * 2 - 1) * f.ex, z = ((j + .5) / f.Sz * 2 - 1) * f.ez;
  assert.equal(Math.round(wildAt(f, 'a', x, z) * 255), f.a[j * f.Sx + i]);
  assert.equal(Math.round(wildAt(f, 'b', x, z) * 255), f.b[j * f.Sx + i]);
 }
});

test('a seed bakes its own field, the same every time', () => {
 const flat = () => 0, a = wildField(landformOf(BIOMES.desert, 'L1'), 600, 600, flat), b = wildField(landformOf(BIOMES.desert, 'L1'), 600, 600, flat);
 const c = wildField(landformOf(BIOMES.desert, 'L2'), 600, 600, flat);
 assert.deepEqual(a.a, b.a); assert.deepEqual(a.b, b.b);
 // Channel b, the washes: on flat test ground the cliffs (a) are steepness
 // and so empty for every seed.
 assert.notDeepEqual(a.b, c.b);
});

test('the gates keep every ground type off the playing lines', () => {
 for (const [key, bio] of Object.entries(BIOMES)) {
  const o = bio.landform;
  if (!o) continue;
  for (const ch of ['a', 'b', 'floor']) if (o.gates?.[ch]) {
   assert.equal(wildGate(o.gates[ch].near - .01, o.gates[ch]), 0, `${key} ${ch}`);
   assert.equal(wildGate(o.gates[ch].near + o.gates[ch].ramp, o.gates[ch]), 1, `${key} ${ch}`);
  }
  // Nothing is a ground type inside the corridor envelope.
  const r = landformOf(bio, 'L1'), f = wildField(r, 600, 600, () => 1.5);
  if (!f) continue;
  for (let x = -500; x < 500; x += 23) assert.equal(wildGround(f, r, x, 0, -1), null, `${key} at ${x}`);
 }
});

test('the driving range stays flat and plain whatever its biome', () => {
 for (const biome of ['mountain', 'desert', 'links']) {
  const w = generateWorld({seed: 'L1', biome, range: true});
  assert.equal(w.wild, null, `${biome} range has a ground field`);
 }
});

const WATER = {rivers: 1, creeks: 2, water: 60, lakes: 1};

test('each landscape has the ground its recipe asks for, and only where the lie rules allow', () => {
 const want = {mountain: ['rock', 'scree'], desert: ['rock', 'waste', 'hardpan'], links: ['native', 'heather'],
  midwest: ['native'], haunted: ['heather'], autumn: ['rock', 'litter'], pnw: ['pinestraw'], lakeshore: ['native']};
 for (const [biome, kinds] of Object.entries(want)) {
  const w = generateWorld({seed: SEEDS[0], biome, holes: 9, trees: 60, homes: true, ...WATER});
  const seen = new Set();
  for (let x = -w.halfX; x < w.halfX; x += 9) for (let z = -w.halfZ; z < w.halfZ; z += 9) {
   const s = w.surface(x, z);
   if (!GROUNDS[s]) continue;
   seen.add(s);
   const n = w.nearest(x, z);
   // Clear of the corridor envelope by the gate, and of water.
   const gate = Object.entries(w.landform.kinds).find(([, k]) => k === s)?.[0];
   if (gate) assert.ok(n.d >= w.landform.gates[gate].near, `${biome}: ${s} ${n.d.toFixed(1)} m outside the corridor at ${x},${z}`);
   const st = w.streams.at(x, z);
   assert.ok(!(st && st.edge < Math.min(WILD_WATER, st.bank)), `${biome}: ${s} beside a creek at ${x},${z}`);
  }
  for (const k of kinds) assert.ok(seen.has(k), `${biome} has no ${k}`);
  // Trees keep off what will not hold them.
  for (const t of w.trees.filter(t => !t.feature)) assert.ok(allows(w.surface(t.x, t.z), 'trees'), `${biome}: a ${t.kind} on ${w.surface(t.x, t.z)}`);
 }
});

test('fallen needles are played from the bytes the straw is painted with', () => {
 const w = generateWorld({seed: SEEDS[0], biome: 'pnw', holes: 9, trees: 60, homes: true});
 assert.ok(w.fallenField, 'pine straw is baked');
 let straw = 0;
 for (let x = -w.halfX; x < w.halfX; x += 7) for (let z = -w.halfZ; z < w.halfZ; z += 7) {
  if (w.surface(x, z) !== 'pinestraw') continue;
  straw++;
  assert.ok(fallenAt(w.fallenField, x, z), `pine straw played off the straw at ${x},${z}`);
  assert.equal(w.groundCover(x, z), 'straw');
 }
 assert.ok(straw > 100, `only ${straw} samples of pine straw`);
});

test('the ground shader asks the lie\'s questions in the lie\'s order', () => {
 const src = readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 const block = src.slice(src.indexOf('THE OVERHAUL\'S GROUND TYPES (landforms.js): last of the classification'));
 assert.ok(block.length > 100, 'the block is there');
 // Rough only, clear of water by the same distance, inside the atlas.
 assert.match(block, /kind<\.5&&waterNear>=\$\{WILD_WATER\.toFixed\(1\)\}&&streamNear>=\$\{WILD_WATER\.toFixed\(1\)\}&&abs\(wp\.x\)<extent\.x/);
 // Painted lowest priority first: fallen, floor, b, a.
 const order = ['wildKinds.w', 'wildKinds.z', 'wildKinds.y', 'wildKinds.x'].map(k => block.indexOf(k + '>.5'));
 assert.ok(order.every(i => i > 0), 'every channel is painted');
 assert.deepEqual([...order].sort((a, b) => a - b), order, 'painted fallen, floor, b, then a');
 // The fields: a in alpha, b in blue, fallen in green, each gated as wildGate is.
 assert.match(block, /cv\.a\*smoothstep\(wildGateA\.x,wildGateA\.x\+wildGateA\.y,hd\)/);
 assert.match(block, /cv\.b\*smoothstep\(wildGateB\.x,wildGateB\.x\+wildGateB\.y,hd\)/);
 assert.match(block, /float ff=fallenOn>\.5&&wildKinds\.w>\.5\?cv\.g:0\.;/);
 assert.match(block, /wildSoft\(ff\)\);[\s\S]*wildSoft\(fz\)\);[\s\S]*wildSoft\(fy\)\);[\s\S]*wildSoft\(fx\)\);/);
 // And the colour's soft edge straddles the 0.5 the lie switches at.
 assert.match(src, /float wildSoft\(float f\)\{return smoothstep\(\.34,\.66,f\);\}/);
});
