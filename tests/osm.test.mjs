// A course from OpenStreetMap (src/builder/osm.js): an Overpass answer read
// into local metres, laid as door 2's layers and trees, its numbered holes as
// markers -- against a hand-made answer, never the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {osmFeatures, layOsm, osmHoles, overpassQuery, fetchOsm} from '../src/builder/osm.js';
import {createTrace} from '../src/builder/trace-edit.js';

// Degrees to metres round 0,0 near enough for a test: a hundred-thousandth of
// a degree a metre.
const toLocal = (lat, lon) => ({x: lon * 1e5, z: -lat * 1e5});
const g = pts => pts.map(([x, z]) => ({lon: x / 1e5, lat: -z / 1e5}));
const box = (x0, z0, x1, z1) => g([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]);
const answer = {elements: [
 {type: 'way', tags: {golf: 'rough'}, geometry: box(-40, -90, 40, 90)},
 {type: 'way', tags: {golf: 'fairway'}, geometry: box(-15, -60, 15, 60)},
 {type: 'way', tags: {golf: 'green'}, geometry: box(-10, -85, 10, -65)},
 {type: 'way', tags: {golf: 'bunker'}, geometry: box(12, -80, 18, -70)},
 {type: 'way', tags: {golf: 'tee'}, geometry: box(-3, 75, 3, 85)},
 {type: 'way', tags: {golf: 'lateral_water_hazard'}, geometry: box(25, -20, 38, 20)},
 {type: 'way', tags: {golf: 'cartpath'}, geometry: g([[-30, 80], [-30, -80]])},
 {type: 'way', tags: {golf: 'hole', ref: '1', par: '4'}, geometry: g([[0, -75], [5, 0], [0, 80]])},
 {type: 'way', tags: {natural: 'wood'}, geometry: box(-48, -40, -42, 40)},
 {type: 'node', tags: {natural: 'tree'}, lat: 0, lon: 45 / 1e5},
]};

test('an Overpass answer becomes layers, trees and a numbered hole', () => {
 const f = osmFeatures(answer, toLocal);
 assert.equal(f.areas.length, 7); assert.equal(f.lines.length, 2); assert.equal(f.trees.length, 1);
 const t = createTrace({nx: 201, nz: 401, cell: .5, halfX: 50, halfZ: 100});
 const laid = layOsm(t, f);
 assert.deepEqual([t.kindAt(0, 0), t.kindAt(0, -75), t.kindAt(15, -75), t.kindAt(0, 80), t.kindAt(30, 0), t.kindAt(-30, 0), t.kindAt(-35, 0)], ['fairway', 'green', 'sand', 'tee', 'water', 'path', 'semi']);
 assert.ok(laid.fairway === 1 && laid.path === 1);
 assert.ok(t.state.trees.length > 1, 'the wood and the single tree');
 // What lies under the green runs on beneath it (layers): here the rough.
 t.erase({x: 0, z: -75, radius: 4, kind: 'green'});
 assert.equal(t.kindAt(0, -75), 'semi');
 // The hole drawn green first is turned round: its tee at the tee end.
 const holes = osmHoles(f);
 assert.equal(holes.length, 1);
 assert.ok(Math.abs(holes[0].tees[0].z - 80) < 1 && Math.abs(holes[0].green.z + 75) < 1);
 assert.equal(holes[0].aims.length, 1); assert.equal(holes[0].par, 4);
});

test('the query asks for the golf features in the box; a busy server is said so', async () => {
 assert.match(overpassQuery([-95.63, 43.62, -95.61, 43.63]), /way\["golf"\]\(43\.62,-95\.63,43\.63,-95\.61\)/);
 await assert.rejects(fetchOsm([0, 0, 1, 1], async () => ({ok: false, status: 504})), /busy/);
 const got = await fetchOsm([0, 0, 1, 1], async (url, o) => ({ok: true, json: async () => ({url, body: o.body})}));
 assert.match(got.url, /overpass-api\.de/);
});
