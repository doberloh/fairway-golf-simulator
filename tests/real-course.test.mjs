// Door 2's pipeline (src/builder/real-course.js): a picture lined up by hand
// and by its position, tiles filling each other's gaps, and the land, trace,
// holes and trees made into a course the game's world contract accepts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {affineFromPairs, pictureOnLand, docFromLand, parFor, cellFor, lidarTexels, coverage, LIDAR_VIEWS} from '../src/builder/real-course.js';
import {createGridder} from '../src/lidar/land.js';
import {TRACE} from '../src/lidar/trace.js';
import {validateDoc, writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';

test('three or more matched points give the picture\'s placement back', () => {
 // A picture turned 20 degrees, 0.6 m a pixel, shifted.
 const a = 20 * Math.PI / 180, truth = (x, z) => [(Math.cos(a) * x - Math.sin(a) * z) / .6 + 400, (Math.sin(a) * x + Math.cos(a) * z) / .6 + 300];
 const pairs = [[-100, -80], [120, -60], [10, 140], [-60, 90]].map(([x, z]) => { const [col, row] = truth(x, z); return {local: {x, z}, pixel: {col, row}}; });
 const fit = affineFromPairs(pairs);
 assert.ok(fit.worst < 1e-6);
 const [c, r] = fit.map(55, -33), [tc, tr] = truth(55, -33);
 assert.ok(Math.abs(c - tc) < 1e-6 && Math.abs(r - tr) < 1e-6);
 // A badly clicked point shows in the worst error, in metres.
 pairs[3].pixel.col += 5;
 assert.ok(affineFromPairs(pairs).worst > 1);
 assert.throws(() => affineFromPairs(pairs.slice(0, 2)), /three or more/);
 assert.throws(() => affineFromPairs([0, 1, 2].map(t => ({local: {x: t, z: t}, pixel: {col: t, row: t}}))), /on a line/);
});

test('a picture is laid by its position, and a second tile fills only the gaps', () => {
 const g = createGridder({box: {x0: 1000, x1: 1100, y0: 5000, y1: 5100}, cell: 1});
 const land = {nx: g.nx, nz: g.nz, cell: g.cell, halfX: g.halfX, halfZ: g.halfZ};
 // Two tiles at 1 m, split at x 1050: the west red, the east blue.
 const tile = (x0, w, colour) => ({width: w, height: 101, dx: 1, dy: -1, x0, y0: 5100, rgb: Uint8Array.from({length: w * 101 * 3}, (_, i) => colour[i % 3]), nir: null});
 let pic = pictureOnLand(land, g, tile(1000, 50, [200, 0, 0]));
 const cov = p => p.has.reduce((s, v) => s + v, 0) / p.has.length;
 assert.ok(cov(pic) > .45 && cov(pic) < .55);
 pic = pictureOnLand(land, g, tile(1000, 101, [0, 0, 200]), {into: pic});
 assert.equal(cov(pic), 1);
 const west = g.nx * 50 + 10, east = g.nx * 50 + 90;
 assert.deepEqual([...pic.rgb.subarray(west * 3, west * 3 + 3)], [200, 0, 0]);
 assert.deepEqual([...pic.rgb.subarray(east * 3, east * 3 + 3)], [0, 0, 200]);
});

test('the land, the trace and the marks become a course the game can play', async () => {
 const cell = 1, halfX = 300, halfZ = 300, nx = 601, nz = 601, N = nx * nz;
 const ground = new Float32Array(N).fill(200), codes = new Uint8Array(N);
 const at = (x, z) => Math.round((z + halfZ) / cell) * nx + Math.round((x + halfX) / cell);
 const holes = [];
 for (let n = 0; n < 9; n++) {
  const x = -120 + n * 30, tee = {x, z: 120, set: 'back'}, green = {x, z: -120};
  holes.push({number: n + 1, tees: [tee], green});
  for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) if (dx * dx + dz * dz < 140) codes[at(x + dx, -120 + dz)] = TRACE.indexOf('green');
  for (let dz = -4; dz <= 4; dz++) for (let dx = -3; dx <= 3; dx++) codes[at(x + dx, 120 + dz)] = TRACE.indexOf('tee');
 }
 for (let dz = -15; dz <= 15; dz++) for (let dx = -15; dx <= 15; dx++) if (dx * dx + dz * dz < 200) codes[at(200 + dx, dz)] = TRACE.indexOf('water');
 const trees = [{x: -120, z: -120, h: 12, crown: 4}, {x: 200, z: 150, h: 15, crown: 2}];
 const doc = validateDoc(docFromLand({land: {nx, nz, cell, halfX, halfZ, ground}, traced: {codes}, holes, trees, name: 'Test', credits: ['Elevation: a test']}));
 assert.equal(doc.holes.length, 9);
 assert.equal(doc.holes[0].par, parFor(240 / .9144));
 // Traced, a kind is one even-odd polygon of every ring found, as freeze.js
 // writes a generated course's.
 assert.equal(doc.surfaces.green[0].length, 9);
 assert.equal(doc.water.length, 1);
 // The pond's floor is carved below its level; the tree on a green is gone,
 // and the narrow one is a conifer.
 assert.ok(doc.land.heights[at(200, 0)] < doc.water[0].level - .5);
 assert.equal(doc.trees.length, 7);
 assert.equal(doc.trees[5], 1);
 const w = worldFromDoc(await readBuiltFile(await writeBuiltFile(doc, BUILT_VERSION)));
 assert.equal(w.surface(-120, -120), 'green');
 assert.equal(w.surface(200, 0), 'water');
 assert.equal(w.holes.length, 9);
 // With no trace, each green is a disc round its mark and each tee a pad.
 const plain = validateDoc(docFromLand({land: {nx, nz, cell, halfX, halfZ, ground}, holes, trees: []}));
 assert.equal(plain.surfaces.green.length, 9);
 assert.equal(plain.surfaces.tee.length, 9);
 // A trace that missed a mark: the plain green or pad goes under it.
 const missed = validateDoc(docFromLand({land: {nx, nz, cell, halfX, halfZ, ground}, traced: {codes: new Uint8Array(N)}, holes, trees: []}));
 assert.equal(missed.surfaces.green.length, 9);
 assert.equal(missed.surfaces.tee.length, 9);
});

test('a property to 2.25 km² is gathered at half a metre, a larger one at a metre', () => {
 assert.equal(cellFor(1500, 1500), .5);
 assert.equal(cellFor(2000, 1500), 1);
});

test('the LIDAR shows as its relief, its brightness or its slope, to lay the picture against', () => {
 // A 40 x 40 land, flat but for a 1 m step at i = 20 (a bunker's lip), its
 // brightness bright on the left half, and no brightness in one corner cell.
 const nx = 40, nz = 40, N = nx * nz, ground = new Float32Array(N), intensity = new Float32Array(N);
 for (let k = 0; k < N; k++) { ground[k] = k % nx >= 20 ? 1 : 0; intensity[k] = k % nx < 20 ? .8 : .2; }
 intensity[0] = NaN;
 const land = {nx, nz, cell: .5, halfX: 10, halfZ: 10, ground, intensity};
 const at = (d, i, j) => d[(j * nx + i) * 4];
 assert.deepEqual(LIDAR_VIEWS, ['relief', 'brightness', 'slope']);
 const rel = lidarTexels(land, 'relief', new Uint8ClampedArray(N * 4)), br = lidarTexels(land, 'brightness', new Uint8ClampedArray(N * 4)), sl = lidarTexels(land, 'slope', new Uint8ClampedArray(N * 4));
 for (const d of [rel, br, sl]) assert.ok(d.every((v, q) => q % 4 !== 3 || v === 255), 'every texel opaque');
 assert.equal(at(br, 5, 20), 204); assert.equal(at(br, 30, 20), 51);
 assert.equal(at(br, 0, 0), at(rel, 0, 0), 'no brightness: the relief');
 assert.ok(at(sl, 20, 20) > 200 && at(sl, 5, 20) === 20, 'the step bright, the flat dark');
 assert.ok(at(rel, 20, 20) !== at(rel, 5, 20), 'the relief shades the step');
});

test('where the files reach: every cell within 10 m of one a point landed in, a far corner not', () => {
 const nx = 100, nz = 80, cell = 1, noReturns = new Uint8Array(nx * nz).fill(1);
 for (let j = 0; j < 40; j += 8) for (let i = 0; i < 50; i += 8) noReturns[j * nx + i] = 0;   // points every 8 m over the west half of the north
 const on = coverage({nx, nz, cell, noReturns});
 assert.equal(on[20 * nx + 20], 1, 'between the points: covered'); assert.equal(on[42 * nx + 30], 1, '10 m past the last row'); assert.equal(on[43 * nx + 30], 0, '11 m past it: not');
 assert.equal(on[60 * nx + 90], 0, 'the far corner: not'); assert.equal(on[20 * nx + 60], 0, '12 m past the last column: not');
});
