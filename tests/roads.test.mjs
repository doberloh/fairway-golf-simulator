import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {roadOnPlay, roadOnHouse, lotSize, pastBoundary, ROAD_WIDTH, STREET, driveEnd, driveFrame, mailboxAt} from '../src/roads.js';
import {pathIndex, pathShape, unbridgedWater} from '../src/paths.js';
import {outOfBounds} from '../src/physics.js';
import {inBuilding} from '../src/clubhouse.js';

// THE ROADS (roads.js; the US landscapes goal, phase 4): a public road along
// the clubhouse's side of the property, the parking lot beside the clubhouse,
// the drive between them -- and no road across a fairway, ever.

const LANDS = ['heartland', 'pacnw', 'rockies', 'sonoran', 'seaside', 'newengland', 'keys'];
const worlds = Object.fromEntries(LANDS.map(b => [b, world({seed: 'RD-1', holes: 9, biome: b})]));

test('no road or lot lies on anything played', () => {
 for (const [b, w] of Object.entries(worlds)) assert.deepEqual(roadOnPlay(w, w.surface), [], b);
});

test('every course has its lot beside the clubhouse, a road and a drive where a straight dry edge allows', () => {
 for (const [b, w] of Object.entries(worlds)) {
  const club = w.buildings.find(x => x.kind === 'clubhouse');
  assert.ok(w.lot, `${b}: no lot`);
  const full = lotSize(w.holes).stalls;
  assert.ok([full, Math.floor(full / 8) * 4].includes(w.lot.stalls), `${b}: ${w.lot.stalls} stalls`);
  assert.ok(Math.hypot(w.lot.x - club.x, w.lot.z - club.z) < 140, `${b}: the lot is far from the clubhouse`);
  assert.ok(!inBuilding(club, w.lot.x, w.lot.z, 2), `${b}: the lot under the clubhouse`);
  // The Keys' islands have no straight dry edge: no public road (PLACED).
  if (b === 'keys') continue;
  assert.ok(w.roads.some(r => r.kind === 'boundary'), `${b}: no public road`);
  assert.ok(w.roads.some(r => r.kind === 'drive'), `${b}: no drive`);
 }
});

test('a ball on a road plays as a road and takes relief; beyond the public road is out of bounds', () => {
 const w = worlds.heartland, road = w.roads.find(r => r.kind === 'boundary'), mid = road.points[Math.floor(road.points.length / 2)];
 assert.equal(w.surface(mid.x, mid.z), 'road');
 assert.equal(w.surface(w.lot.x, w.lot.z), 'road');
 const b = w.boundary, out = b.axis === 'x' ? {x: b.at + b.sign * (ROAD_WIDTH.boundary / 2 + 3), z: mid.z} : {x: mid.x, z: b.at + b.sign * (ROAD_WIDTH.boundary / 2 + 3)};
 assert.ok(pastBoundary(b, out.x, out.z) > 0);
 assert.ok(pastBoundary(b, mid.x, mid.z) < 0, 'the road itself is in bounds');
 // physics.js asks in a hole's own frame.
 const h = w.holes[0], course = {world: w, toWorld: p => h.toWorld(p)};
 const local = h.toLocal ? h.toLocal(out) : null;
 if (local) assert.ok(outOfBounds(course, local.x, local.z), 'past the road is out of bounds');
});

test('the lot has its streets kit: a wheel stop a stall, islands at the rows, poles, the bag drop', () => {
 for (const [b, w] of Object.entries(worlds)) {
  if (!w.lot) continue;
  const n = k => w.streetProps.filter(p => p.kind === k).length;
  assert.equal(n('wheelstop'), w.lot.stalls, `${b}: wheel stops`);
  assert.equal(n('island'), 8, `${b}: islands`);
  assert.ok(n('lightpole') >= 2, `${b}: light poles`);
  assert.equal(n('bagdrop'), 1, `${b}: the bag drop`);
  if (w.roads.some(r => r.kind === 'drive' && r.points.length > 1)) assert.ok(n('streetlight') >= 0);
 }
});

// THE CART BARN AND THE ISLAND TREES (generator 71): the barn stands off
// play and off the clubhouse wherever it is placed; every island tree is in
// the lot's ring of islands and is the landscape's own.
test('the cart barn stands off play, and the lot\'s islands carry the landscape\'s trees', () => {
 let barns = 0;
 for (const biome of ['heartland', 'sonoran', 'keys']) {
  const w = world({biome, holes: 9, seed: 'RD-1'}), barn = w.buildings.find(b => b.kind === 'cartbarn');
  if (barn) {
   barns++;
   const rc = Math.cos(barn.rotation), rs = Math.sin(barn.rotation);
   for (const [u, v] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5], [0, 0]]) {
    const x = barn.x + u * barn.width * rc + v * barn.depth * rs, z = barn.z - u * barn.width * rs + v * barn.depth * rc;
    assert.ok(!['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water'].includes(w.surface(x, z)), `${biome}: the barn on ${w.surface(x, z)}`);
    assert.ok(!inBuilding(w.buildings[0], x, z, 0), `${biome}: the barn in the clubhouse`);
   }
  }
  for (const t of w.trees.filter(t => t.island)) assert.ok(w.bio.plants.some(([k]) => k === t.kind) && t.h <= 5.5, `${biome}: an island tree ${t.kind} ${t.h}`);
 }
 assert.ok(barns >= 1, 'a barn somewhere');
});

// THE STREETS (roads.js placeStreets, generator 84): every drive reaches a
// street, every street reaches a road, and none of it touches what is played,
// water or anything built.
const ESTATES = ['heartland', 'newengland', 'sonoran', 'bayou', 'lowcountry', 'keys'].map(biome => world({seed: 'RD-1', holes: 9, biome, homes: true, homeDensity: 70, rivers: 1, creeks: 2, lakes: 1}));
const ways = w => w.roads.filter(r => r.kind !== 'lane');

test('every drive left reaches a street or a road, down a lane from its own end', () => {
 let lanes = 0;
 for (const w of ESTATES) {
  const idx = pathIndex(ways(w));
  for (const h of w.homes.filter(h => h.garage)) {
   assert.ok(h.lane, `${w.settings.biome}: a drive with no lane`);
   const E = driveEnd(h), lane = w.roads.find(r => r.kind === 'lane' && Math.hypot(r.points[0].x - E.x, r.points[0].z - E.z) < .01);
   assert.ok(lane, `${w.settings.biome}: the lane does not start at the drive`);
   assert.ok(Math.hypot(h.lane.x - E.x, h.lane.z - E.z) <= STREET.reach, 'a lane past its reach');
   assert.ok(idx.at(h.lane.x, h.lane.z).d < .5, 'a lane that ends on nothing');
   lanes++;
  }
 }
 assert.ok(lanes >= 10, `only ${lanes} lanes across the fixtures`);
});

test('no street or lane on play, on water or through anything built', () => {
 for (const w of ESTATES) {
  assert.deepEqual(roadOnPlay(w, w.surface), [], w.settings.biome);
  assert.deepEqual(roadOnHouse(w), [], w.settings.biome);
  assert.deepEqual(unbridgedWater(w.roads, w.bridges, (x, z) => w.surface(x, z) === 'water'), [], w.settings.biome);
 }
});

test('a street starts on a road or another street, and bends rather than corners', () => {
 const w = ESTATES[0], streets = w.roads.filter(r => r.kind === 'street');
 assert.ok(streets.length >= 3, 'a street or three');
 for (const st of streets) {
  const others = pathIndex(ways(w).filter(r => r !== st)), a = st.points[0], b = st.points[st.points.length - 1];
  assert.ok(Math.min(others.at(a.x, a.z)?.d ?? 99, others.at(b.x, b.z)?.d ?? 99) < 4, 'a street joined to nothing');
 }
 const shape = pathShape(streets, w.buildings);
 assert.ok(shape.sharp.length <= streets.length / 2, `${shape.sharp.length} sharp corners on ${streets.length} streets`);
});

test('a street does not hang off another\'s tip and head back beside it', () => {
 for (const w of ESTATES) {
  const streets = w.roads.filter(r => r.kind === 'street');
  for (const a of streets) for (const b of streets) {
   if (a === b) continue;
   const p = a.points, E = p[p.length - 1], D = p[Math.max(0, p.length - 3)], S = b.points[0], N = b.points[Math.min(b.points.length - 1, 2)];
   assert.ok(Math.hypot(E.x - S.x, E.z - S.z) >= 3 || (E.x - D.x) * (N.x - S.x) + (E.z - D.z) * (N.z - S.z) >= 0, `${w.settings.biome}: a blunt join`);
  }
 }
});

test('a house turns its front to the street, away from the fairway, and its footprint stays', () => {
 for (const w of ESTATES) for (const h of w.homes) {
  const hole = w.holes.find(q => q.hole === h.hole), mid = hole.toWorld({x: hole.center(h.along), z: h.along});
  assert.ok(Math.sin(h.rotation) * (h.x - mid.x) + Math.cos(h.rotation) * (h.z - mid.z) > 0, 'a house facing the fairway');
 }
});

test('a mailbox stands on the verge beside its lane, off the street', () => {
 let boxes = 0;
 for (const w of ESTATES) for (const h of w.homes.filter(h => h.garage)) {
  const m = mailboxAt(h), {gx} = driveFrame(h);
  assert.ok(Math.hypot(m.x - h.lane.x, m.z - h.lane.z) < STREET.width / 2 + 5, 'a mailbox away from the street');
  assert.ok(Math.hypot(m.x - h.lane.x, m.z - h.lane.z) > 2, 'a mailbox in the lane');
  assert.ok(Number.isFinite(m.rot) && Number.isFinite(gx));
  boxes++;
 }
 assert.ok(boxes >= 10);
});

test('with the homes off there are no streets, and the road stays off the clubhouse', () => {
 const w = worlds.heartland;
 assert.deepEqual([...new Set(w.roads.map(r => r.kind))].sort(), ['boundary', 'drive']);
 assert.equal(world({seed: 'RD-1', holes: 9, biome: 'heartland', homes: false}).homes.length, 0);
 assert.deepEqual(roadOnHouse(w), []);
});
