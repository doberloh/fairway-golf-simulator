// A built course as a document and a file (src/course-doc.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeBuiltFile, readBuiltFile, validateDoc, encodeGrid, decodeGrid, TREE_STRIDE, BUILT_FILE_VERSION, isBuiltFile} from '../src/course-doc.js';
import {writeZip} from '../src/zip.js';

const square = (cx, cz, r) => [[[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]]];
function tinyDoc(over = {}) {
 const nx = 121, nz = 101, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = 470 + Math.sin(i * .07) * 3.21 + j * .013;
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -50 + i * 10, z: -40, set: 'middle'}], green: {x: -50 + i * 10, z: 40}, line: [[-50 + i * 10, -40], [-50 + i * 10, 40]]}));
 return {type: 'built', name: 'Test Links', landscape: 'heartland', designer: null, halfX: 60, halfZ: 50,
  land: {x0: -60, z0: -50, cell: 1, nx, nz, heights},
  patches: [{x0: -10, z0: 30, cell: .25, nx: 81, nz: 81, heights: new Float32Array(81 * 81).fill(472.5)}],
  surfaces: {green: [square(0, 40, 8)], fairway: [square(0, 0, 15)], tee: [square(0, -40, 3)], sand: [square(12, 30, 2.5)]},
  water: [{rings: square(-30, 0, 6), level: 469.2, kind: 'pond'}],
  holes, trees: new Float32Array([10, 10, 15, 4, .3, 0, 0, -20, 5, 8, 2.5, .2, 1, -1]), treeKinds: ['oak'], credits: ['Test data'], from: null, picture: null, ...over};
}

test('a height grid comes back to the centimetre', () => {
 const nx = 50, nz = 40, h = new Float32Array(nx * nz).map((_, k) => 300 + Math.sin(k) * 40 + k * .001);
 const {base, step, bytes} = encodeGrid(h, nx, nz);
 const back = decodeGrid(bytes, nx, nz, base, step);
 let worst = 0; for (let k = 0; k < h.length; k++) worst = Math.max(worst, Math.abs(back[k] - h[k]));
 assert.ok(worst <= .005 + 1e-4, `worst ${worst}`);
});

test('relief over 655 m still fits, at a coarser step', () => {
 const h = new Float32Array([0, 1000, 500, 250]);
 const {base, step, bytes} = encodeGrid(h, 2, 2);
 assert.ok(step > .01);
 const back = decodeGrid(bytes, 2, 2, base, step);
 for (let k = 0; k < 4; k++) assert.ok(Math.abs(back[k] - h[k]) <= step / 2 + 1e-3);
});

test('a built course comes back from its file as it went in', async () => {
 const doc = tinyDoc();
 const bytes = await writeBuiltFile(doc, 1);
 assert.ok(isBuiltFile(bytes));
 const back = await readBuiltFile(bytes);
 assert.equal(back.name, 'Test Links'); assert.equal(back.landscape, 'heartland'); assert.equal(back.builtVersion, 1);
 assert.equal(back.holes.length, 9); assert.deepEqual(back.holes[3].tees[0], {x: -20, z: -40, set: 'middle'});
 assert.equal(back.trees.length, 2 * TREE_STRIDE); assert.equal(back.trees[2], 15);
 assert.deepEqual(back.surfaces.green, doc.surfaces.green);
 assert.equal(back.water[0].level, 469.2);
 let worst = 0; for (let k = 0; k < doc.land.heights.length; k++) worst = Math.max(worst, Math.abs(back.land.heights[k] - doc.land.heights[k]));
 assert.ok(worst <= .0051, `land ${worst}`);
 assert.equal(back.patches[0].heights[100], doc.patches[0].heights[100]);
 assert.ok(bytes.length < doc.land.heights.length * 2, `a smooth land deflates (${bytes.length} bytes)`);
});

test('the same course makes the same file', async () => {
 const a = await writeBuiltFile(tinyDoc(), 1), b = await writeBuiltFile(tinyDoc(), 1);
 assert.deepEqual(a, b);
});

test('what is not a built course, or is broken, is refused in plain words', async () => {
 assert.throws(() => validateDoc(tinyDoc({landscape: 'moon'})), /landscape/);
 assert.throws(() => validateDoc(tinyDoc({name: ''})), /name/);
 assert.throws(() => validateDoc(tinyDoc({holes: tinyDoc().holes.slice(0, 5)})), /9 or 18/);
 assert.throws(() => validateDoc(tinyDoc({surfaces: {green: [[[0, 0], [1, 1]]]}})), /green outlines/);
 assert.throws(() => validateDoc(tinyDoc({land: {x0: 0, z0: 0, cell: 1, nx: 5000, nz: 5000, heights: new Float32Array(4)}})), /too large/);
 await assert.rejects(readBuiltFile(new TextEncoder().encode('{"kind":"fairway-course"}')), /not a Fairway course file/);
 await assert.rejects(readBuiltFile(await writeZip([{name: 'other.txt', data: 'x'}])), /not a Fairway course file/);
 const newer = await writeZip([{name: 'course.json', data: JSON.stringify({kind: 'fairway-course', type: 'built', version: BUILT_FILE_VERSION + 1})}]);
 await assert.rejects(readBuiltFile(newer), /newer version/);
});

test('houses go into the file and come back; a broken one is dropped', async () => {
 const {writeBuiltFile: w, readBuiltFile: r} = await import('../src/course-doc.js');
 const d = {...tinyDoc(), homes: [{x: 10.04, z: -5, rotation: .5, width: 20, depth: 14}, {x: 'no'}]};
 const back = await r(await w(d, 1));
 assert.deepEqual(back.homes, [{x: 10, z: -5, rotation: .5, width: 20, depth: 14}]);
});
