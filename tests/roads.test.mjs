import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {roadOnPlay, lotSize, pastBoundary, ROAD_WIDTH} from '../src/roads.js';
import {outOfBounds} from '../src/physics.js';
import {inBuilding} from '../src/clubhouse.js';

// THE ROADS (roads.js; the US landscapes goal, phase 4): a public road along
// the clubhouse's side of the property, the parking lot beside the clubhouse,
// the drive between them -- and no road across a fairway, ever.

const LANDS = ['heartland', 'puget', 'rockies', 'sonoran', 'links', 'newengland', 'keys'];
const worlds = Object.fromEntries(LANDS.map(b => [b, world({seed: 'RD-1', holes: 9, biome: b})]));

test('no road or lot lies on anything played', () => {
 for (const [b, w] of Object.entries(worlds)) assert.deepEqual(roadOnPlay(w, w.surface), [], b);
});

test('every course has its lot beside the clubhouse, a road and a drive where a straight dry edge allows', () => {
 for (const [b, w] of Object.entries(worlds)) {
  const club = w.buildings.find(x => x.kind === 'clubhouse');
  assert.ok(w.lot, `${b}: no lot`);
  const full = lotSize(w.holes).stalls;
  assert.ok([full, full / 2].includes(w.lot.stalls), `${b}: ${w.lot.stalls} stalls`);
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
