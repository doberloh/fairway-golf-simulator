// A course's holes from OpenStreetMap, lined up with the ground
// (src/builder/osm-course.js; the owner, 1 November 2026: "Make sure that open
// street maps holes actually line up with the holes on the real courses").
import test from 'node:test';
import assert from 'node:assert/strict';
import {osmCourses, osmHoles, shiftHoles, fitHoles, assign, osmTeeSets} from '../src/builder/osm-course.js';
import {osmFeatures} from '../src/builder/osm.js';
import {TRACE} from '../src/lidar/trace.js';

// Degrees made metres simply: a metre a millionth of a degree.
const toLocal = (lat, lon) => ({x: lon * 1e6, z: -lat * 1e6});
const pt = (x, z) => ({lat: -z / 1e6, lon: x / 1e6});
const way = (id, tags, pts, closed = true) => ({type: 'way', id, tags, geometry: (closed ? [...pts, pts[0]] : pts).map(([x, z]) => pt(x, z))});
const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

test('two courses at one club: each its own holes, the one with more first; the other\'s number 1 does not overwrite this one\'s', () => {
 const json = {elements: [
  way(1, {leisure: 'golf_course', name: 'North'}, box(0, 0, 500, 500)), way(2, {leisure: 'golf_course', name: 'South'}, box(600, 0, 1100, 500)),
  way(10, {golf: 'hole', ref: '1', par: '4'}, [[100, 450], [100, 100]], false), way(11, {golf: 'hole', ref: '2', par: '3'}, [[200, 100], [200, 280]], false),
  way(20, {golf: 'hole', ref: '1', par: '5'}, [[700, 450], [700, 20]], false),
  way(30, {golf: 'green'}, box(90, 90, 110, 110)), way(31, {golf: 'green'}, box(190, 270, 210, 290)), way(32, {golf: 'green'}, box(690, 10, 710, 30)),
 ]};
 const f = osmFeatures(json, toLocal), cs = osmCourses(json, toLocal, f);
 assert.deepEqual(cs.map(c => [c.name, c.holes]), [['North', 2], ['South', 1]]);
 const north = osmHoles(f, {within: cs[0].rings}), south = osmHoles(f, {within: cs[1].rings});
 assert.deepEqual(north[0].green, {x: 100, z: 100}); assert.equal(north[0].par, 4, 'the map\'s par kept');
 assert.deepEqual(south[0].green, {x: 700, z: 20}); assert.equal(south[0].par, 5);
 const all = osmHoles(f); assert.deepEqual(all.doubled, [1], 'read together, number 1 is claimed twice');
});

test('two courses in one boundary, told apart by their hole lines\' course names (Troon North)', () => {
 const json = {elements: [
  way(1, {leisure: 'golf_course', name: 'Troon North'}, box(0, 0, 1000, 500)),
  way(10, {golf: 'hole', ref: '1', par: '4', 'golf:course:name': 'Monument Course'}, [[100, 450], [100, 100]], false),
  way(11, {golf: 'hole', ref: '2', par: '3', 'golf:course:name': 'Monument Course'}, [[200, 100], [200, 280]], false),
  way(20, {golf: 'hole', ref: '1', par: '5', 'golf:course:name': 'Pinnacle Course'}, [[700, 450], [700, 20]], false),
  way(30, {golf: 'green'}, box(90, 90, 110, 110)), way(31, {golf: 'green'}, box(190, 270, 210, 290)), way(32, {golf: 'green'}, box(690, 10, 710, 30)),
 ]};
 const f = osmFeatures(json, toLocal), cs = osmCourses(json, toLocal, f);
 assert.deepEqual(cs.map(c => [c.id, c.name, c.only, c.holes]), [['way/1:Monument Course', 'Troon North: Monument Course', 'Monument Course', 2], ['way/1:Pinnacle Course', 'Troon North: Pinnacle Course', 'Pinnacle Course', 1]]);
 const mon = osmHoles(f, {within: cs[0].rings, only: cs[0].only}), pin = osmHoles(f, {within: cs[1].rings, only: cs[1].only});
 assert.deepEqual(mon[0].green, {x: 100, z: 100}); assert.deepEqual(mon.doubled, [], 'the Pinnacle\'s 1 does not claim the Monument\'s');
 assert.deepEqual(pin[0].green, {x: 700, z: 20}); assert.equal(pin.filter(Boolean).length, 1);
 // One course name, or none: one course, as before.
 const one = osmCourses({elements: json.elements.filter(e => e.id !== 20)}, toLocal, osmFeatures({elements: json.elements.filter(e => e.id !== 20)}, toLocal));
 assert.deepEqual(one.map(c => [c.id, c.only]), [['way/1', undefined]]);
});

test('numbered greens with no hole lines: each green its tee by the best pairing over all, a scorecard settling it', () => {
 // Three greens in a row; three tees, each 300 m before its own green and
 // near the green before.
 const els = [];
 for (let n = 1; n <= 3; n++) { const gx = n * 400; els.push(way(n, {golf: 'green', ref: String(n)}, box(gx - 10, -10, gx + 10, 10)), way(10 + n, {golf: 'tee'}, box(gx - 310, -5, gx - 290, 5))); }
 const f = osmFeatures({elements: els}, toLocal), holes = osmHoles(f);
 assert.deepEqual(holes.fromGreens, [1, 2, 3]);
 for (let n = 1; n <= 3; n++) assert.equal(holes[n - 1].tees[0].x, n * 400 - 300, `hole ${n}'s own tee`);
 // A card that says hole 2 is a 110-yard par 3 picks a tee 100 m out if there is one.
 els.push(way(20, {golf: 'tee'}, box(690, -5, 710, 5)));
 const carded = osmHoles(osmFeatures({elements: els}, toLocal), {card: {blue: [328, 110, 328]}});
 assert.equal(carded[1].tees[0].x, 700);
});

test('the best pairing: each row its own column, cheapest in total', () => {
 assert.deepEqual(assign([[4, 1, 3], [2, 0, 5], [3, 2, 2]]), [1, 0, 2]);
 assert.deepEqual(assign([[1, 9], [1, 9], [1, 9]]).filter(c => c >= 0).length, 2, 'more rows than columns: some get none');
});

test('holes moved with the map, then put on their greens and given the tee boxes along their first stretch', () => {
 const land = {nx: 401, nz: 401, cell: 1, halfX: 200, halfZ: 200}, codes = new Uint8Array(401 * 401), at = (x, z) => (z + 200) * 401 + x + 200;
 for (let z = -130; z <= -110; z++) for (let x = -10; x <= 10; x++) if (Math.hypot(x, z + 120) < 10) codes[at(x, z)] = TRACE.indexOf('green');
 for (const tz of [150, 110]) for (let z = tz - 3; z <= tz + 3; z++) for (let x = -4; x <= 4; x++) codes[at(x, z)] = TRACE.indexOf('tee');
 // The map lies 6 m east of the ground; its hole line ends off the green.
 const hole = {tees: [{x: 6, z: 112, set: 'back'}], aims: [], green: {x: 6, z: -105}, par: 4};
 const [fit] = fitHoles(shiftHoles([hole], {x: -6, z: 0}), codes, land);
 assert.equal(fit.green.x, 0); assert.ok(Math.abs(fit.green.z + 120) < 1.5, `on the green's middle: ${JSON.stringify(fit.green)}`);
 assert.equal(fit.fit.tees, 2);
 assert.deepEqual(fit.tees.map(t => `${t.z}:${t.set}`), ['150:blue', '110:white', '110:red'], 'two untagged boxes on a three-set course: every set on one of them, by distance');
 assert.equal(fit.tees[0].z, 150, 'the back tee behind the one the map gave');
});

// THE TEE SETS FROM THE MAP (tees.js; the owner, 10 November 2026: up to six,
// "This needs to feed from the open street map data").
test('tee boxes take the sets the map tags, and the course\'s sets by distance where it tags none', () => {
 const land = {nx: 401, nz: 401, cell: 1, halfX: 200, halfZ: 200}, codes = new Uint8Array(401 * 401), at = (x, z) => (z + 200) * 401 + x + 200;
 for (let z = -130; z <= -110; z++) for (let x = -10; x <= 10; x++) if (Math.hypot(x, z + 120) < 10) codes[at(x, z)] = TRACE.indexOf('green');
 for (const tz of [160, 130, 100, 70]) for (let z = tz - 3; z <= tz + 3; z++) for (let x = -4; x <= 4; x++) codes[at(x, z)] = TRACE.indexOf('tee');
 const hole = {tees: [{x: 0, z: 160, set: 'blue'}], aims: [], green: {x: 0, z: -120}, par: 4};
 // Untagged, four boxes: a four-set course, black at the back.
 const [plain] = fitHoles([hole], codes, land);
 assert.deepEqual(plain.tees.map(t => t.set), ['black', 'blue', 'white', 'red']);
 // The second box tagged blue and white: both there, the rest spread over the others.
 const [tagged] = fitHoles([hole], codes, land, {tagged: [{x: 0, z: 130, sets: ['blue', 'white']}], sets: ['black', 'blue', 'white', 'gold', 'red']});
 assert.deepEqual(tagged.tees.map(t => `${t.z}:${t.set}`), ['160:black', '130:blue', '130:white', '100:gold', '70:red']);
 // A hole with no box keeps the map's tee, as the course's longest set.
 const [none] = fitHoles([{...hole, tees: [{x: 150, z: 150, set: 'back'}], green: {x: 150, z: -150}}], codes, land, {sets: ['black', 'white', 'red']});
 assert.deepEqual(none.tees.map(t => t.set), ['blue'], 'an old back mark reads as blue');
});

test('the course\'s sets from the map: its tags together, else its holes\' dist:* keys', () => {
 const tee = (id, tags, x) => way(id, {golf: 'tee', ...tags}, box(x - 4, -4, x + 4, 4));
 const tagged = osmTeeSets(osmFeatures({elements: [tee(1, {tee: 'blue;white;gold;red'}, 0), tee(2, {tee: 'teebox'}, 50), tee(3, {}, 100)]}, toLocal));
 assert.deepEqual(tagged.sets, ['blue', 'white', 'gold', 'red'], 'Worthington\'s one tagged box names the course\'s four');
 assert.equal(tagged.tagged.length, 1);
 const hole = (id, tags) => way(id, {golf: 'hole', ref: String(id), ...tags}, [[0, 300], [0, 0]], false);
 const named = osmTeeSets(osmFeatures({elements: [hole(1, {'dist:championship': '420', 'dist:players': '400', 'dist:resort': '370', 'dist:forward': '330'})]}, toLocal));
 assert.deepEqual(named.sets, ['black', 'blue', 'white', 'red'], 'TPC Scottsdale\'s four names: a four-set course');
 const colours = osmTeeSets(osmFeatures({elements: [hole(1, {'dist:blue': '400', 'dist:red': '330'})]}, toLocal));
 assert.deepEqual(colours.sets, ['blue', 'red']);
 assert.equal(osmTeeSets(osmFeatures({elements: [hole(1, {})]}, toLocal)).sets, null, 'nothing named: fitHoles counts the boxes');
});

test('one tee box on a hole carries every set the course has; the game plays them side by side', () => {
 const land = {nx: 401, nz: 401, cell: 1, halfX: 200, halfZ: 200}, codes = new Uint8Array(401 * 401), at = (x, z) => (z + 200) * 401 + x + 200;
 for (let z = -130; z <= -110; z++) for (let x = -10; x <= 10; x++) if (Math.hypot(x, z + 120) < 10) codes[at(x, z)] = TRACE.indexOf('green');
 for (let z = 147; z <= 153; z++) for (let x = -4; x <= 4; x++) codes[at(x, z)] = TRACE.indexOf('tee');
 const [one] = fitHoles([{tees: [{x: 0, z: 150, set: 'blue'}], aims: [], green: {x: 0, z: -120}, par: 4}], codes, land, {sets: ['black', 'blue', 'white', 'red']});
 assert.deepEqual(one.tees.map(t => t.set), ['black', 'blue', 'white', 'red']);
 assert.ok(one.tees.every(t => t.z === 150), 'all on the one box');
});
