import test from 'node:test';
import assert from 'node:assert/strict';
import {world, measured} from './worlds.mjs';
import {inBuilding, CLUBHOUSE_SIZE} from '../src/clubhouse.js';
import {simulateShot} from '../src/physics.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {pathIndex} from '../src/paths.js';

// THE CLUBHOUSE (architect-courses, phase 2; clubhouse.js): every Architect
// course has one, on clear ground near its first tee and last green, facing the
// first tee, sized by its club; nothing grows in it or on its lawn; the path
// reaches its door; and it is solid -- a ball stops against it and is never
// out of bounds for it. Classic has none.

const A = biome => world({seed: 'CLUB-T', holes: 9, biome, designer: 'architect'});

// Twenty-seven courses, built on worker threads and measured there (worlds.mjs
// `measured`; the testing audit, 31 October 2026 -- one thread, the file took
// a minute and a half). What each test reads is in tests/measure/clubhouse.mjs.
const EVERY = BIOME_KEYS.map(biome => ({seed: 'CLUB-T', holes: 9, biome, designer: 'architect'}));
const HOME = ['pnw', 'desert', 'midwest', 'autumn'].flatMap(biome => ['HOME-1', 'HOME-2'].flatMap(seed =>
 [{seed, biome, holes: 9, designer: 'architect'}, {seed, biome, holes: 9}]));
const LIST = [{seed: 'CLUB-T', holes: 9, biome: 'midwest'}, ...EVERY, ...HOME];
const M = await measured(LIST, './measure/clubhouse.mjs');
const of = s => M[LIST.indexOf(s)];

test('every landscape\'s Architect course has its clubhouse; Classic has none', () => {
 assert.equal(M[0].buildings, 0);
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
 // its lawn; it is not on a green, tee, sand or water. Every landscape (was
 // midwest, links, mountain and redwood: measured with the rest, the others
 // cost nothing more).
 assert.deepEqual(EVERY.flatMap(s => of(s).clear), []);
});

test('the path runs to its door', () => {
 const w = A('midwest'), b = w.buildings[0], door = w.paths.find(p => p.door)?.door;
 assert.ok(door, 'the path knows the door');
 assert.ok(pathIndex(w.paths).onPath(door.x, door.z), 'the path reaches it');
 assert.ok(Math.hypot(door.x - b.x, door.z - b.z) < b.depth / 2 + 8);
});

test('a ball hit at the clubhouse stops against it, and is never out of bounds for it', () => {
 const w = A('midwest'), b = w.buildings[0], h = w.holes[0];
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

// PHASE 4: ROUTED FROM THE CLUBHOUSE (routing.js `homeArch`). An Architect
// nine comes home: most of its last greens within 200 m of the first tee,
// where the clubhouse is, and far more than Classic's.
test('an Architect course\'s nines come home, far more often than Classic\'s', () => {
 let a = 0, c = 0, n = 0;
 for (const biome of ['pnw', 'desert', 'midwest', 'autumn']) for (const seed of ['HOME-1', 'HOME-2']) {
  n++; a += of(HOME.find(s => s.seed === seed && s.biome === biome && s.designer)).home; c += of(HOME.find(s => s.seed === seed && s.biome === biome && !s.designer)).home;
 }
 assert.ok(a >= n * .75, `Architect: ${a} of ${n} nines home`);
 assert.ok(a > c, `Architect ${a} against Classic ${c}`);
});
