import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blowoutField, blowoutAt, blowoutGate, isBlowout, BLOWOUT_NEAR, BLOWOUT_RAMP, BLOWOUT_WATER} from '../src/blowouts.js';
import {generateWorld} from '../src/course.js';
import {ownerAtlasSize} from '../src/owner-atlas.js';

// BLOWOUTS (Lakeshore Dunes): paint and lie read one baked field. These tests
// hold the half that Node can see -- the field, how it is read back, the gate,
// and the world's lie -- and check the shader asks its questions in the same
// order (ground.js cannot run here; see TESTING.md).

test('the field is baked on the ground atlas grid and read back as a linear filter reads it', () => {
 const f = blowoutField('B1', 900, 700, .3);
 assert.deepEqual({Sx: f.Sx, Sz: f.Sz}, ownerAtlasSize(900, 700));
 assert.equal(f.data.length, f.Sx * f.Sz);
 // At a texel centre the read-back is that texel's byte exactly.
 for (const [i, j] of [[3, 5], [100, 200], [f.Sx - 1, f.Sz - 1]]) {
  const x = ((i + .5) / f.Sx * 2 - 1) * f.ex, z = ((j + .5) / f.Sz * 2 - 1) * f.ez;
  assert.equal(Math.round(blowoutAt(f, x, z) * 255), f.data[j * f.Sx + i]);
 }
 // Half way between two centres it is their mean.
 const i = 40, j = 60, x0 = ((i + .5) / f.Sx * 2 - 1) * f.ex, x1 = ((i + 1.5) / f.Sx * 2 - 1) * f.ex;
 const z = ((j + .5) / f.Sz * 2 - 1) * f.ez;
 assert.ok(Math.abs(blowoutAt(f, (x0 + x1) / 2, z) * 255 - (f.data[j * f.Sx + i] + f.data[j * f.Sx + i + 1]) / 2) < 1e-9);
});

test('the field is the seed\'s own: the same seed bakes the same bytes, another seed others', () => {
 const a = blowoutField('B1', 600, 600, .3), b = blowoutField('B1', 600, 600, .3), c = blowoutField('B2', 600, 600, .3);
 assert.deepEqual(a.data, b.data);
 assert.notDeepEqual(a.data, c.data);
});

test('the gate keeps every blowout off the playing lines', () => {
 assert.equal(blowoutGate(-30), 0);
 assert.equal(blowoutGate(BLOWOUT_NEAR), 0);
 assert.equal(blowoutGate(BLOWOUT_NEAR + BLOWOUT_RAMP), 1);
 assert.ok(blowoutGate(BLOWOUT_NEAR + BLOWOUT_RAMP / 2) > .4 && blowoutGate(BLOWOUT_NEAR + BLOWOUT_RAMP / 2) < .6);
 const f = blowoutField('B1', 600, 600, .9);
 for (let x = -500; x < 500; x += 37) assert.equal(isBlowout(f, x, 0, BLOWOUT_NEAR - .01), false);
});

const WATER = {rivers: 1, creeks: 2, water: 60, lakes: 1};

test('a Lakeshore Dunes course has open sand in its dune rough, and nowhere it should not', () => {
 for (const seed of ['S1', 'S2']) {
  const w = generateWorld({seed, biome: 'lakeshore', holes: 9, trees: 60, homes: true, ...WATER});
  assert.ok(w.blowouts, 'the field is built');
  let rough = 0, blow = 0;
  for (let x = -w.halfX; x < w.halfX; x += 7) for (let z = -w.halfZ; z < w.halfZ; z += 7) {
   const s = w.surface(x, z), n = w.nearest(x, z);
   if (s === 'rough') rough++;
   if (s !== 'sand' || w.height(x, z) < 1.7 || !isBlowout(w.blowouts, x, z, n.d)) continue;
   blow++;
   assert.ok(n.d >= BLOWOUT_NEAR, `a blowout ${n.d.toFixed(1)} m outside the corridor at ${x},${z}`);
   const st = w.streams.at(x, z);
   assert.ok(!(st && st.edge < Math.min(BLOWOUT_WATER, st.bank)), `a blowout beside a creek at ${x},${z}`);
  }
  // About a tenth of the open dune is sand. A guard against a retune that
  // turns the dunes into a desert or loses them altogether.
  const share = blow / (rough + blow);
  assert.ok(share > .04 && share < .16, `${seed}: ${(share * 100).toFixed(1)}% of the dune rough is blowout`);
  // Nothing grows out of open sand: trees and ground plants ask surface().
  for (const t of w.trees) assert.notEqual(w.surface(t.x, t.z), 'sand', `${t.kind} on sand at ${t.x},${t.z}`);
 }
});

test('no other biome builds a field, so nothing else can change', () => {
 for (const biome of ['links', 'island', 'midwest']) {
  const w = generateWorld({seed: 'S1', biome, holes: 9, trees: 0});
  assert.equal(w.blowouts, null, biome);
 }
});

test('the ground shader paints a blowout last, from the cover texture, by the same rules', () => {
 const src = readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 const creek = src.indexOf('if(edge<b.y)kind=6.;'), paint = src.indexOf('if(blowoutOn>.5&&kind<.5&&waterNear>=');
 assert.ok(creek > 0 && paint > creek, 'after every shore and creek band');
 assert.match(src, /texture2D\(cover,\(wp\/extent\+1\.\)\*\.5\)\.b\*smoothstep\(\$\{BLOWOUT_NEAR/);
 assert.match(src, /if\(blowField>=\.5\)kind=5\.;/);
 assert.match(src, /waterNear=min\(waterNear,hd\);/);
 assert.match(src, /coverBytes\[k\*4\+2\]=blow\[k\]/);
 assert.match(src, /abs\(wp\.x\)<extent\.x&&abs\(wp\.y\)<extent\.y\)\{/, 'inside the atlas only, as isBlowout');
 const f = blowoutField('B1', 300, 300, .99);
 assert.equal(isBlowout(f, 301, 0, 500), false);
 assert.equal(isBlowout(f, 0, -300.5, 500), false);
});
