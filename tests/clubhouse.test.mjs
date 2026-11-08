import test from 'node:test';
import assert from 'node:assert/strict';
import {world as plainWorld, measured} from './worlds.mjs';
// Facilities are off on a generated course since 8 November 2026 (course.js `facilities`); these tests
// turn them on to keep the parts working for when they return.
const world = settings => plainWorld({facilities: true, ...settings});
import {inBuilding, CLUBHOUSE_SIZE} from '../src/clubhouse.js';
import {simulateShot} from '../src/physics.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {pathIndex} from '../src/paths.js';

// THE CLUBHOUSE (architect-courses, phase 2; clubhouse.js): every generated
// course has one (an Architect course's alone until the designer was removed,
// 2 November 2026), on clear ground near its first tee and last green, facing
// the first tee; nothing grows in it or on its lawn; the path reaches its
// door; and it is solid -- a ball stops against it and is never out of bounds
// for it. The range has none.

const A = biome => world({seed: 'CLUB-T', holes: 9, biome});

// Every landscape's course, built on worker threads and measured there
// (worlds.mjs `measured`; the testing audit, 31 October 2026). What each test
// reads is in tests/measure/clubhouse.mjs.
const EVERY = BIOME_KEYS.map(biome => ({seed: 'CLUB-T', holes: 9, biome, facilities: true}));
const M = await measured(EVERY, './measure/clubhouse.mjs');
const of = s => M[EVERY.indexOf(s)];

test('every landscape\'s course has its clubhouse', () => {
 for (const s of EVERY) {
  const biome = s.biome, b = of(s).building;
  assert.ok(b, `${biome}: no clubhouse`);
  assert.equal(b.kind, 'clubhouse');
  assert.ok(b.club, 'a club building');
  assert.ok(b.width >= CLUBHOUSE_SIZE.municipal.width && b.height > 5, `${biome}: ${b.width} x ${b.depth} x ${b.height}`);
 }
});

test('it stands on clear ground, faces the first tee, and nothing grows on it or its lawn', () => {
 // Its front (local -z) points at the tee; nothing grows or is built on it or
 // its lawn; it is not on a green, tee, sand or water. Every landscape.
 assert.deepEqual(EVERY.flatMap(s => of(s).clear), []);
});

test('the path runs to its door', () => {
 const w = A('heartland'), b = w.buildings[0], door = w.paths.find(p => p.door)?.door;
 assert.ok(door, 'the path knows the door');
 assert.ok(pathIndex(w.paths).onPath(door.x, door.z), 'the path reaches it');
 assert.ok(Math.hypot(door.x - b.x, door.z - b.z) < b.depth / 2 + 8);
});

test('a ball hit at the clubhouse stops against it, and is never out of bounds for it', () => {
 const w = A('heartland'), b = w.buildings[0], h = w.holes[0];
 // From 40 m in front of the door, straight at it, along the ground's own frame.
 const fx = -Math.sin(b.rotation), fz = -Math.cos(b.rotation);
 const from = h.toLocal({x: b.x + fx * (b.depth / 2 + 40), z: b.z + fz * (b.depth / 2 + 40)}), at = h.toLocal({x: b.x, z: b.z});
 const aim = Math.atan2(at.x - from.x, at.z - from.z) * 180 / Math.PI;
 for (const residentialOB of [false, true]) {
  const course = Object.assign(Object.create(h), {residentialOB});
  const r = simulateShot({origin: {...from}, aim, speed: 35, vla: 12, spin: 3000, hla: 0, spinAxis: 0}, course, {});
  assert.ok(r.homeHits > 0, 'the ball met the building');
  assert.notEqual(r.hazard, 'Out of bounds', 'a club building is not a boundary');
  const end = h.toWorld(r.end);
  assert.ok(!inBuilding(b, end.x, end.z), 'it did not finish inside the walls');
 }
});
