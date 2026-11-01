// A door 2 draft (src/builder/draft.js): the land, the trace's layers, the
// holes so far and the step written and read back the same; a course file or
// a newer draft refused in plain words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeDraft, readDraft, isDraft} from '../src/builder/draft.js';
import {writeZip} from '../src/zip.js';

test('a draft keeps the land, the layers, the trees, houses and holes so far, and the step', async () => {
 const nx = 30, nz = 20, N = nx * nz;
 const land = {nx, nz, cell: .5, halfX: 7.25, halfZ: 4.75, center: {x: 500100, y: 4800200}, unit: {h: 1, v: 1}, method: 'classified', points: 1234,
  ground: Float32Array.from({length: N}, (_, k) => 300 + k * .01), canopy: Float32Array.from({length: N}, (_, k) => k % 7 ? 0 : 12), intensity: Float32Array.from({length: N}, (_, k) => (k % 10) / 10),
  water: new Uint8Array(N), building: new Uint8Array(N), multi: new Uint8Array(N).fill(3), noReturns: new Uint8Array(N), filled: Uint8Array.from({length: N}, (_, k) => k < 5 ? 1 : 0), rgb: null};
 const sand = new Uint8Array(N); sand[44] = sand[45] = 1;
 const green = new Uint8Array(N); green[100] = 1;
 const d = {step: 3, name: 'Worthington', landscape: 'midwest', credits: ['NAIP'], holesN: 18, hole: 1, holes: [{tees: [{x: 1, z: 2, set: 'back'}], aims: [], green: {x: 3, z: 4}}],
  boundary: [[-5, -4], [5, -4], [5, 4]], traceMode: 'osm', box: {x0: 1, x1: 2, y0: 3, y1: 4}, sources: [{name: 'a.laz', crs: {epsg: 6344, units: {h: 'metre', v: 'metre'}}}],
  view: {lidarView: 'slope', picAlpha: .4}, picOffsets: {usgs: {x: 2.5, z: -1}}, trees: [{x: 1, z: 1, h: 12, crown: 3}],
  osm: {codes: Uint8Array.from({length: N}, (_, k) => k % 3), trees: [], homes: [], said: 'Laid: 2 green'},
  land, trace: {masks: new Map([['sand', sand], ['green', green]]), hidden: ['sand'], trees: [{x: 2, z: 2, h: 9, crown: 2}], homes: [{x: 0, z: 0, rotation: 1, width: 12, depth: 9}]}};
 const bytes = await writeDraft(d);
 assert.ok(await isDraft(bytes));
 const r = await readDraft(bytes);
 for (const k of ['step', 'name', 'landscape', 'holesN', 'hole', 'traceMode']) assert.equal(r[k], d[k], k);
 assert.deepEqual(r.holes, d.holes); assert.deepEqual(r.boundary, d.boundary); assert.deepEqual(r.picOffsets, d.picOffsets); assert.deepEqual(r.view, d.view); assert.deepEqual(r.sources, d.sources);
 for (const k of ['ground', 'canopy', 'intensity', 'multi', 'filled']) assert.deepEqual([...r.land[k]], [...land[k]], k);
 assert.equal(r.land.surface[7], land.ground[7] + 12, 'the surface made again');
 assert.deepEqual(r.land.center, land.center); assert.equal(r.land.rgb, null);
 assert.deepEqual([...r.trace.masks.keys()], ['sand', 'green']); assert.equal(r.trace.masks.get('sand')[45], 1);
 assert.equal(r.osm.said, 'Laid: 2 green'); assert.equal(r.osm.codes[5], 2, 'OpenStreetMap kept, so Refine still works');
 assert.deepEqual(r.trace.hidden, ['sand']); assert.deepEqual(r.trace.homes, d.trace.homes);
 // A draft with no land yet (step 1): its box and sources only.
 const early = await readDraft(await writeDraft({step: 0, name: 'x', landscape: 'links', box: d.box, sources: d.sources}));
 assert.equal(early.land, null); assert.deepEqual(early.box, d.box);
});

test('a course file or a newer draft is refused in plain words', async () => {
 const course = await writeZip([{name: 'course.json', data: '{}'}]);
 assert.equal(await isDraft(course), false);
 await assert.rejects(readDraft(course), /not a Fairway Course Builder draft/);
 const newer = await writeZip([{name: 'draft.json', data: JSON.stringify({kind: 'fairway-draft', version: 99})}]);
 await assert.rejects(readDraft(newer), /newer Fairway Course Builder/);
});
