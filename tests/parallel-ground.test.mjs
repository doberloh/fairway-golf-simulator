import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, generateWorldSteps} from '../src/course.js';
import {sampleRows, sampleExtras} from '../src/terrain-grid.js';

// The ground grid built from heights computed "elsewhere" -- here by a second,
// independently generated copy of the world, exactly as a worker holds one --
// and handed back in scrambled band order, must be byte for byte the grid the
// serial build makes. This is the whole promise of B2: the workers change where
// the heights are computed and nothing else.

// A worker's copy: generate until the grid and keep the question it would ask.
const capture = settings => {
 const it = generateWorldSteps(settings, {capture: true});
 let r = it.next();
 while (!r.done && !r.value?.capture) r = it.next();
 return r.value.capture;
};

// The pool, in-process. Bands are handed out in reverse and assembled by row,
// extras in reverse chunks, so any dependence on order would show.
const fakePool = (settings, bands = 5, chunks = 7) => {
 const grid = capture(settings);
 return {
  rows: async dims => {
   const {nx, nz} = dims, rows = nz + 1, values = new Float64Array((nx + 1) * rows), mask = new Uint8Array(nx * nz);
   const edges = Array.from({length: bands + 1}, (_, b) => Math.round(rows * b / bands));
   for (let b = bands - 1; b >= 0; b--) {
    const out = sampleRows(grid.sample, grid.refine, dims, edges[b], edges[b + 1]);
    values.set(out.values, edges[b] * (nx + 1));
    mask.set(out.mask, edges[b] * nx);
   }
   return {values, mask};
  },
  extras: async at => {
   const n = at.length / 2, out = new Float64Array(n), edges = Array.from({length: chunks + 1}, (_, c) => Math.round(n * c / chunks));
   for (let c = chunks - 1; c >= 0; c--) out.set(sampleExtras(grid.sample, at.subarray(edges[c] * 2, edges[c + 1] * 2)), edges[c]);
   return out;
  },
 };
};

// The driver main.js uses, minus the pacing.
const drive = async (settings, options) => {
 const it = generateWorldSteps(settings, options);
 let r = it.next();
 while (!r.done) r = r.value?.await ? it.next(await r.value.await) : it.next();
 return r.value;
};

const sameGrid = (a, b) => {
 assert.equal(a.nx, b.nx); assert.equal(a.nz, b.nz);
 assert.deepEqual(Buffer.from(a.values.buffer), Buffer.from(b.values.buffer), 'coarse heights');
 assert.deepEqual(Buffer.from(a.positions.buffer), Buffer.from(b.positions.buffer), 'vertex positions');
 assert.deepEqual(Buffer.from(a.indices.buffer), Buffer.from(b.indices.buffer), 'triangles');
 assert.equal(a.cells.size, b.cells.size, 'refined cells');
 for (const [k, c] of a.cells) {
  const d = b.cells.get(k);
  assert.ok(d, `cell ${k}`);
  if (c.n) assert.deepEqual(Buffer.from(c.heights.buffer), Buffer.from(d.heights.buffer), `cell ${k} heights`);
  else { assert.equal(c.y, d.y); assert.deepEqual(c.ring.map(r => [r.u, r.v, r.y, r.id]), d.ring.map(r => [r.u, r.v, r.y, r.id])); }
 }
};

for (const settings of [
 {seed: 'PARALLEL', biome: 'pnw', holes: 9},
 {seed: 'PARALLEL', biome: 'island', holes: 9},
 {seed: 'PARALLEL', biome: 'links', holes: 18},
]) {
 test(`${settings.biome} ${settings.holes}: the pooled grid is the serial grid, byte for byte`, async () => {
  const serial = generateWorld(settings);
  const pooled = await drive(settings, {gridPool: fakePool(settings)});
  sameGrid(serial.groundGrid, pooled.groundGrid);
  // And what is built on the grid afterwards comes out the same too.
  assert.deepEqual(pooled.trees.map(t => [t.x, t.z, t.y, t.kind]), serial.trees.map(t => [t.x, t.z, t.y, t.kind]));
  assert.equal(pooled.height(123.4, -56.7), serial.height(123.4, -56.7));
 });
}

test('a pool that fails falls back to computing here, and gets the same grid', async () => {
 const settings = {seed: 'PARALLEL', biome: 'pnw', holes: 9};
 const serial = generateWorld(settings);
 const broken = {rows: async () => null, extras: async () => null};
 sameGrid(serial.groundGrid, (await drive(settings, {gridPool: broken})).groundGrid);
 // Failing only on the second round still finishes the job.
 const half = fakePool(settings);
 half.extras = async () => null;
 sameGrid(serial.groundGrid, (await drive(settings, {gridPool: half})).groundGrid);
});

// THE OWNERSHIP ATLAS (B2c): the ground shader's record of which hole owns each
// texel. The workers compute three of its four channels from their own copy of
// the world; the main thread adds straw. Both halves must reproduce the loop
// ground.js used to run, which is copied here as the reference.
import {ownerAtlasSize, ownerRows, strawChannel} from '../src/owner-atlas.js';
const referenceAtlas = (w, ex, ez, Sx, Sz) => {
 const owners = new Float32Array(Sx * Sz * 4);
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez, k = (j * Sx + i) * 4; const lake = w.lakeOwner(x, z, 7); owners[k] = (lake || w.nearest(x, z).h).hole; owners[k + 1] = w.groundCover(x, z) === 'straw' ? 1 : 0; owners[k + 2] = (w.streams.at(x, z)?.id ?? -1) + 1; owners[k + 3] = lake ? 1 : 0;}
 return owners;
};
for (const settings of [{seed: 'PARALLEL', biome: 'links', holes: 9}, {seed: 'PARALLEL', biome: 'island', holes: 9}]) {
 test(`${settings.biome}: the ownership atlas from the workers is the one ground.js built`, () => {
  const w = generateWorld(settings), ex = w.groundGrid.halfX, ez = w.groundGrid.halfZ, {Sx, Sz} = ownerAtlasSize(ex, ez);
  const reference = referenceAtlas(w, ex, ez, Sx, Sz);
  // The main thread's own path, as ground.js now runs it.
  const here = ownerRows({lakeOwner: w.lakeOwner, nearest: w.nearest, streamAt: (x, z) => w.streams.at(x, z)}, ex, ez, Sx, Sz, 0, Sz);
  strawChannel(here, w.groundCover, ex, ez, Sx, Sz);
  assert.deepEqual(Buffer.from(here.buffer), Buffer.from(reference.buffer));
  // A worker's copy, in bands handed back in reverse.
  const q = capture(settings), bands = 6, edges = Array.from({length: bands + 1}, (_, b) => Math.round(Sz * b / bands));
  const theirs = new Float32Array(Sx * Sz * 4);
  for (let b = bands - 1; b >= 0; b--) theirs.set(ownerRows(q, ex, ez, Sx, Sz, edges[b], edges[b + 1]), edges[b] * Sx * 4);
  strawChannel(theirs, w.groundCover, ex, ez, Sx, Sz);
  assert.deepEqual(Buffer.from(theirs.buffer), Buffer.from(reference.buffer));
 });
}
