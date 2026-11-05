// Reopening a course file with everything behind it (the owner, 5 November
// 2026: "The game doesn't need to load all of that, but when reopening a builder
// file, we need to have everything"): the builder's section of a .fairway
// (course-doc.js BUILDER_PART, a whole door 2 draft) -- the game neither unpacks
// nor keeps it, the same course keeps its hash, and a draft brings back its
// pictures, its map data and where it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import {docFromLand} from '../src/builder/real-course.js';
import {createEditor} from '../src/builder/editing.js';
import {createLayers} from '../src/builder/layers.js';
import {PALETTE} from '../src/builder/trace-edit.js';
import {validateDoc, writeBuiltFile, readBuiltFile, playableFile, builderPart, BUILDER_PART, MAX_PLAYABLE, TREE_STRIDE} from '../src/course-doc.js';
import {writeDraft, readDraft, isDraft} from '../src/builder/draft.js';
import {withEditorWork} from '../src/builder/round-trip.js';
import {draftFromDoc} from '../src/builder/draft-from-doc.js';
import {rgbaOf, rgbOf, tooBig, packPictures} from '../src/builder/picture-file.js';
import {tilePixel, tileOf} from '../src/builder/imagery.js';
import {mergeTrees} from '../src/builder/osm.js';
import {readZip, writeZip, zipWithout} from '../src/zip.js';
import {createBuiltStore, memoryBackend, hashOf} from '../src/built-store.js';
import {saveHow} from '../src/builder/saving.js';

function session() {
 const cell = 1, halfX = 80, halfZ = 90, nx = 161, nz = 181, N = nx * nz;
 const ground = new Float32Array(N).fill(100), layers = createLayers(nx, nz, PALETTE);
 const at = (x, z) => Math.round((z + halfZ) / cell) * nx + Math.round((x + halfX) / cell);
 const fairway = layers.mask('fairway', true), green = layers.mask('green', true), tee = layers.mask('tee', true), holes = [];
 for (let n = 0; n < 9; n++) {
  const hx = -64 + n * 16;
  for (let z = -40; z <= 40; z++) for (let x = hx - 3; x <= hx + 3; x++) fairway[at(x, z)] = 1;
  for (let z = -56; z <= -44; z++) for (let x = hx - 6; x <= hx + 6; x++) if (Math.hypot(x - hx, z + 50) < 5) green[at(x, z)] = 1;
  for (let z = 52; z <= 58; z++) for (let x = hx - 2; x <= hx + 2; x++) tee[at(x, z)] = 1;
  holes.push({tees: [{x: hx, z: 55, set: 'back'}], aims: [], green: {x: hx, z: -50}, par: null, index: null});
 }
 layers.recompose();
 const land = {nx, nz, cell, halfX, halfZ, center: {x: 415000, y: 3722000}, unit: {h: 1, v: 1}, method: 'classified', points: 99, rgb: null, ground, surface: ground,
  canopy: new Float32Array(N).fill(3), intensity: new Float32Array(N).fill(.5), water: new Uint8Array(N), building: new Uint8Array(N), multi: new Uint8Array(N), noReturns: new Uint8Array(N), filled: new Uint8Array(N)};
 const trees = [{x: 24, z: 0, h: 12, crown: 4}], crs = {epsg: 6341, units: {h: 'metre', v: 'metre'}, wkt: null, geographic: false};
 const doc = validateDoc(docFromLand({land, traced: {layers}, holes: holes.map((h, i) => ({number: i + 1, par: null, index: null, tees: h.tees, green: h.green, line: [[h.tees[0].x, 55], [h.green.x, -50]]})), trees, homes: [], name: 'Reopen', landscape: 'palms', credits: [], landEdits: null, creeks: [], rocks: [],
  source: {files: ['a.laz'], epsg: 6341, crs, geo: null, origin: {...land.center}, trace: 'openstreetmap'}}));
 const raw = JSON.stringify({elements: [{type: 'node', id: 1, lat: 33.6, lon: -111.9, tags: {natural: 'tree'}}]});
 const draft = {step: 5, name: 'Reopen', landscape: 'palms', credits: ['x'], holes, holesN: 9, hole: 0, boundary: [[0, 0], [9, 0], [9, 9]], traceMode: 'openstreetmap', box: {x0: 1, x1: 2, y0: 3, y1: 4},
  sources: [{name: 'a.laz', crs}], view: {lidarView: 'relief', treeScale: 1, treesFrom: 'osm'}, picOffsets: {naip: {x: 3, z: -2}}, geo: {lat: 33.6, lon: -111.9}, picShow: 'naip',
  osm: {said: 'Laid', trees, homes: [], osmTrees: [{x: 1, z: 2, h: 9, crown: 3}], course: 'c1', shift: {x: 1, z: 0}, laid: {green: 9}, codes: Uint8Array.from(layers.codes), raw},
  pics: [{group: 'naip', label: 'NAIP', provider: 'naip', file: null, width: 4, height: 3, credit: 'USDA', place: {kind: 'tiles', z: 16, x0: 12000, y0: 26000}, pack: {type: 'jpeg', image: new Uint8Array([255, 216, 1, 2, 3, 255, 217]), nir: null}},
   {group: 'files', label: 'Picture files', provider: null, file: 'a.tif', width: 2, height: 2, credit: null, place: {kind: 'map', x0: 1, y0: 2, dx: .5, dy: -.5, crs: null}, pack: {type: 'rgb', image: new Uint8Array(12).fill(7), nir: new Uint8Array(4).fill(9)}}],
  trees: [...trees, {x: 30, z: 30, h: 8, crown: 3}], land, landEdits: null, creeks: [], rocks: [], trace: {masks: layers.masks, hidden: [], trees, homes: [], bunkers: [], creekLines: []}};
 return {land, layers, doc, draft};
}

test('a course file with its builder\'s section is the same course to the game', async () => {
 const {doc, draft} = session(), plain = await writeBuiltFile(doc, 5), builder = await writeDraft(draft), full = await writeBuiltFile(doc, 5, {builder});
 assert.ok(full.length > plain.length);
 assert.deepEqual([...await builderPart(full)], [...builder], 'the section comes back whole');
 assert.equal(await builderPart(plain), null);
 assert.deepEqual([...playableFile(full)], [...plain], 'without the section, the very bytes of the plain file');
 assert.equal(playableFile(plain), plain, 'a file with no section is left alone');
 assert.equal(await hashOf(playableFile(full)), await hashOf(plain));
 const a = await readBuiltFile(full), b = await readBuiltFile(plain);
 assert.equal(a.name, b.name); assert.deepEqual([...a.land.heights], [...b.land.heights]); assert.equal(a.trees.length, b.trees.length);
 assert.equal(a.builder, undefined, 'nothing of it reaches the game\'s document');
});

test('the game never unpacks the section: a broken one does not stop a course loading', async () => {
 const {doc} = session(), good = await writeBuiltFile(doc, 5), damaged = await writeBuiltFile(doc, 5, {builder: new TextEncoder().encode('x'.repeat(5000))});
 // Spoil its bytes, as a CRC check would notice were it read.
 const at = damaged.length - 22 - 200 - 2000; damaged[at] ^= 255;
 const back = await readBuiltFile(damaged);
 assert.equal(back.name, doc.name);
 assert.equal(good.length + 5000 + 30 + 46 + 2 * BUILDER_PART.length, damaged.length, 'the section is stored, not packed again');
 await assert.rejects(readZip(damaged), /does not check out/, 'it really is broken');
});

test('the game keeps the course, not the section, and knows it as the same course', async () => {
 const {doc, draft} = session(), plain = await writeBuiltFile(doc, 5), full = await writeBuiltFile(doc, 5, {builder: await writeDraft(draft)});
 const backend = memoryBackend(), store = createBuiltStore({backend});
 const one = await store.put(full), two = await store.put(plain);
 assert.equal(one.hash, two.hash, 'imported twice, one course');
 assert.equal((await store.bytes(one.hash)).length, plain.length, 'what is kept is what plays');
 const tooLarge = await writeZip([{name: 'course.json', data: new Uint8Array(MAX_PLAYABLE + 10), store: true}]);
 await assert.rejects(store.put(tooLarge), /built courses up to 64 MB/);
});

test('a ZIP without a part: the rest unchanged, wherever the part stood', async () => {
 const zip = await writeZip([{name: 'a', data: 'one '.repeat(50)}, {name: 'b', data: 'two'}, {name: 'c', data: 'three '.repeat(40)}]);
 const out = await readZip(zipWithout(zip, 'b'));
 assert.deepEqual([...out.keys()], ['a', 'c']);
 assert.equal(new TextDecoder().decode(out.get('c')), 'three '.repeat(40));
 assert.equal(zipWithout(zip, 'nothing'), zip);
 assert.deepEqual([...(await readZip(zip, {only: n => n === 'c'})).keys()], ['c']);
});

test('a draft keeps the pictures, the map download and its place, and which picture showed', async () => {
 const {draft} = session(), bytes = await writeDraft(draft), d = await readDraft(bytes);
 assert.ok(await isDraft(bytes));
 assert.equal(d.version, 3);
 assert.deepEqual(d.geo, {lat: 33.6, lon: -111.9});
 assert.equal(d.picShow, 'naip');
 assert.equal(d.view.treesFrom, 'osm');
 assert.equal(d.osm.raw, draft.osm.raw, 'the download as it came');
 assert.deepEqual(d.osm.osmTrees, draft.osm.osmTrees, 'the map\'s own trees');
 assert.equal(d.osm.course, 'c1'); assert.deepEqual(d.osm.shift, {x: 1, z: 0});
 assert.deepEqual(d.pics.map(p => [p.group, p.width, p.height, p.credit, p.place.kind, p.pack.type]), [['naip', 4, 3, 'USDA', 'tiles', 'jpeg'], ['files', 2, 2, null, 'map', 'rgb']]);
 assert.deepEqual([...d.pics[0].pack.image], [...draft.pics[0].pack.image]);
 assert.deepEqual([...d.pics[1].pack.nir], [9, 9, 9, 9]);
 assert.deepEqual(d.trees, draft.trees, 'every surveyed tree, not only those that stayed');
 assert.deepEqual(d.boundary, draft.boundary); assert.deepEqual(d.box, draft.box);
});

test('a version 2 draft still opens, with no pictures and nothing behind its map data', async () => {
 const {draft} = session(), {pics, geo, picShow, ...rest} = draft, parts = await readZip(await writeDraft({...rest, osm: {...draft.osm, raw: null, osmTrees: null}}));
 const j = JSON.parse(new TextDecoder().decode(parts.get('draft.json')));
 j.version = 2; delete j.geo; delete j.picShow; delete j.pics; delete j.osm.osmTrees;
 const old = await writeZip([{name: 'draft.json', data: JSON.stringify(j)}, ...[...parts].filter(([k]) => k !== 'draft.json').map(([name, data]) => ({name, data}))]);
 const d = await readDraft(old);
 assert.deepEqual(d.pics, []); assert.equal(d.geo, null); assert.equal(d.osm.raw, null);
 assert.equal(d.osm.osmTrees, undefined, 'door 2 hides the Trees choice on this');
});

test('the Trees choice would drop the map\'s trees with nothing behind it, which is why door 2 hides it', () => {
 assert.equal(mergeTrees([{x: 0, z: 0, h: 9, crown: 3}], [], 'osm').length, 0);
});

test('the file\'s section has the editor\'s work in it, and a second save starts from the same place', () => {
 const {doc, draft} = session(), e = createEditor(doc);
 e.paint({kind: 'sand', x: 6, z: 0, radius: 2.5});
 e.shape({op: 'raise', x: -40, z: 0, radius: 8, strength: 1});
 e.setTee(4, 'back', 0, 56); e.setPar(4, 5);
 e.addTree([40, 30, 14, 5, .4, 2, -1]);
 const args = {base: doc, now: e.toDoc(), changed: e.changedLayers(), hidden: e.hiddenLayers()}, d = withEditorWork(draft, args), again = withEditorWork(draft, args);
 assert.equal(d.step, 5);
 assert.ok(d.trace.masks.get('sand').some(Boolean), 'the bunker painted');
 assert.equal(d.trace.masks.get('fairway'), draft.trace.masks.get('fairway'), 'a layer left alone stays as the trace has it');
 assert.ok(d.landEdits.some(v => v > .1), 'the hill');
 assert.equal(d.holes[4].par, 5); assert.deepEqual(d.holes[4].tees[0], {x: 0, z: 56, set: 'back'});
 assert.ok(d.trace.trees.some(t => t.kept && t.x === 40), 'the tree planted');
 assert.equal(draft.landEdits, null, 'the session it came from is untouched');
 assert.equal(draft.trace.masks.get('sand')?.some(Boolean) ?? false, false);
 assert.deepEqual(d.pics, draft.pics, 'the pictures come along');
 assert.equal(d.osm, draft.osm, 'and the map data');
 assert.deepEqual([...again.landEdits], [...d.landEdits], 'saving twice does not add the hill twice');
 assert.equal(withEditorWork({...draft, landEdits: d.landEdits}, args).landEdits[0], d.landEdits[0] * 2, 'on earlier shaping, it adds');
});

test('a course file from before all this still knows where it is, and its trees are not lost to the map', () => {
 const {doc} = session(), plain = {...doc, source: {files: ['a.laz'], epsg: 6341, origin: {x: 415000, y: 3722000}}};
 const d = draftFromDoc(plain);
 assert.deepEqual(d.land.center, {x: 415000, y: 3722000}, 'the land\'s middle in its map grid');
 assert.equal(d.sources[0].crs.epsg, 6341); assert.equal(d.sources[0].name, 'a.laz');
 assert.equal(d.trees.length, doc.trees.length / TREE_STRIDE, 'what fetching the map merges with');
 const none = draftFromDoc({...doc, source: {}});
 assert.deepEqual(none.sources, []); assert.deepEqual(none.land.center, {x: 0, y: 0});
 assert.deepEqual(draftFromDoc({...doc, source: {geo: {lat: 36, lon: -115}}}).geo, {lat: 36, lon: -115}, 'or the place searched for');
});

test('a picture\'s pixels and its place survive the file', async () => {
 const rgb = Uint8Array.from({length: 12}, (_, k) => k * 20), back = rgbOf(rgbaOf(rgb, 2, 2), 2, 2);
 assert.deepEqual([...back], [...rgb]);
 assert.ok(!tooBig(4096, 4096)); assert.ok(tooBig(20000, 100)); assert.ok(tooBig(12000, 12000));
 const a = tileOf(-111.9, 33.6, 16), at = tilePixel({z: 16, x0: Math.floor(a.x), y0: Math.floor(a.y)})(-111.9, 33.6);
 assert.ok(at[0] >= -.5 && at[0] < 256 && at[1] >= -.5 && at[1] < 256, 'a mosaic finds its own pixel from its place alone');
 const big = {group: 'files', label: 'Big', provider: null, file: 'big.tif', place: {kind: 'map'}, pic: {width: 20000, height: 2, rgb: new Uint8Array(120000).fill(4), nir: null}};
 const [packed] = await packPictures([big]);
 assert.equal(packed.pack.type, 'rgb', 'too big for a canvas: its plain pixels');
 assert.equal((await packPictures([big]))[0].pack, big.pack, 'and packed once');
});

test('the copy to share is a Save on the side: the next Save goes where it did', () => {
 const last = {key: 'editor-1', name: 'A', handle: {}};
 assert.equal(saveHow(last, {key: 'editor-1', name: 'A'}), 'overwrite');
 assert.equal(saveHow(last, {key: 'share-1', name: 'A'}), 'pick', 'a copy never overwrites the course file');
});
