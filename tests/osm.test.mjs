// A course from OpenStreetMap (src/builder/osm.js): an Overpass answer read
// into local metres, laid as door 2's layers and trees, its numbered holes as
// markers -- against a hand-made answer, never the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {osmFeatures, layOsm, osmHoles, overpassQuery, fetchOsm, osmBoundary, homeOfFootprint, mergeTrees} from '../src/builder/osm.js';
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

test('the course boundary: a relation\'s outer ways joined end to end, the largest ring kept', () => {
 const P = (lat, lon) => ({lat, lon}), toLocal = (lat, lon) => ({x: lon * 1000, z: -lat * 1000});
 const json = {elements: [
  {type: 'relation', tags: {leisure: 'golf_course'}, members: [
   {role: 'outer', geometry: [P(0, 0), P(0, .2)]}, {role: 'outer', geometry: [P(.2, .2), P(0, .2)]}, {role: 'outer', geometry: [P(.2, .2), P(.2, 0), P(0, 0)]}]},
  {type: 'way', tags: {leisure: 'golf_course'}, geometry: [P(1, 1), P(1, 1.01), P(1.01, 1.01), P(1, 1)]},
  {type: 'way', tags: {golf: 'green'}, geometry: [P(0, 0), P(0, .3), P(.3, .3), P(0, 0)]}]};
 const ring = osmBoundary(json, toLocal);
 assert.equal(ring.length, 5, JSON.stringify(ring));
 const xs = ring.map(p => p[0]); assert.equal(Math.max(...xs), 200); assert.equal(Math.min(...xs), 0);
 assert.equal(osmBoundary({elements: []}, toLocal), null);
});

test('a building becomes a house: its smallest rectangle, turned to face the course; a shed is left out', () => {
 // A 20 x 12 m footprint turned 30 degrees, the course to the east.
 const t = Math.PI / 6, c = Math.cos(t), s = Math.sin(t), pt = (a, b) => [100 + a * c + b * s, 50 - a * s + b * c];
 const ring = [pt(-10, -6), pt(10, -6), pt(10, 6), pt(-10, 6), pt(-10, -6)];
 const h = homeOfFootprint(ring, () => Math.PI / 2);
 assert.ok(Math.abs(h.x - 100) < 1e-6 && Math.abs(h.z - 50) < 1e-6);
 assert.ok(Math.abs(h.width * h.depth - 240) < 1e-6, `${h.width} x ${h.depth}`);
 assert.ok(Math.abs(Math.atan2(Math.sin(h.rotation - Math.PI / 2), Math.cos(h.rotation - Math.PI / 2))) <= Math.PI / 4 + 1e-9, `faces east: ${h.rotation}`);
 assert.equal(homeOfFootprint([[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]), null, 'a 25 m² shed');
});

test('whose trees: the LIDAR\'s all kept, OpenStreetMap\'s added only where no LIDAR tree stands within 6 m; or either alone', () => {
 const lidar = [{x: 0, z: 0, h: 20, crown: 4}, {x: 40, z: 0, h: 15, crown: 3}];
 const osm = [{x: 3, z: 2, h: 14, crown: 4}, {x: 20, z: 0, h: 14, crown: 4}, {x: 44, z: 3, h: 14, crown: 4}, {x: 46.5, z: 0, h: 14, crown: 4}];
 const merged = mergeTrees(lidar, osm);
 assert.deepEqual(merged.map(t => [t.x, t.z]), [[0, 0], [40, 0], [20, 0], [46.5, 0]], 'the map\'s within 6 m of a measured tree left out');
 assert.equal(merged[0].h, 20, 'the measured height kept');
 assert.equal(mergeTrees(lidar, osm, 'lidar').length, 2); assert.equal(mergeTrees(lidar, osm, 'osm').length, 4);
 assert.equal(mergeTrees([], osm).length, 4, 'no survey trees: the map\'s all');
 merged[0].x = 99; assert.equal(lidar[0].x, 0, 'copies, not the same trees');
});
