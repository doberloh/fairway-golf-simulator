import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {inBuilding, inForecourt, CLUBHOUSE_SIZE} from '../src/clubhouse.js';
import {simulateShot} from '../src/physics.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {pathIndex} from '../src/paths.js';

// THE CLUBHOUSE (architect-courses, phase 2; clubhouse.js): every Architect
// course has one, on clear ground near its first tee and last green, facing the
// first tee, sized by its club; nothing grows in it or on its lawn; the path
// reaches its door; and it is solid -- a ball stops against it and is never
// out of bounds for it. Classic has none.

const A = biome => world({seed: 'CLUB-T', holes: 9, biome, designer: 'architect'});

test('every landscape\'s Architect course has its clubhouse; Classic has none', () => {
 assert.equal(world({seed: 'CLUB-T', holes: 9, biome: 'midwest'}).buildings.length, 0);
 for (const biome of BIOME_KEYS) {
  const w = A(biome), b = w.buildings[0];
  assert.ok(b, `${biome}: no clubhouse`);
  assert.equal(b.kind, 'clubhouse');
  assert.ok(b.club, 'a club building');
  assert.ok(b.width >= CLUBHOUSE_SIZE.municipal.width && b.height > 5, `${biome}: ${b.width} x ${b.depth} x ${b.height}`);
 }
});

test('it stands on clear ground, faces the first tee, and nothing grows on it or its lawn', () => {
 for (const biome of ['midwest', 'links', 'mountain', 'redwood']) {
  const w = A(biome), b = w.buildings[0], h = w.holes[0], tee = h.toWorld(h.tees.blue);
  for (const t of w.trees) if (!t.under) assert.ok(!inBuilding(b, t.x, t.z, 3) && !inForecourt(b, t.x, t.z), `${biome}: a ${t.kind} on the clubhouse or its lawn`);
  for (const home of w.homes) assert.ok(!inBuilding(b, home.x, home.z, 10), `${biome}: a house on the clubhouse`);
  // Its front (local -z) points at the tee.
  const fx = -Math.sin(b.rotation), fz = -Math.cos(b.rotation), tx = tee.x - b.x, tz = tee.z - b.z, l = Math.hypot(tx, tz);
  assert.ok((fx * tx + fz * tz) / l > .99, `${biome}: facing the first tee`);
  // Not on a green, tee, sand or water.
  for (const [dx, dz] of [[0, 0], [b.width / 2, 0], [-b.width / 2, 0]]) {
   const s = w.surface(b.x + dx * Math.cos(b.rotation), b.z - dx * Math.sin(b.rotation));
   assert.ok(!['green', 'tee', 'sand', 'water'].includes(s), `${biome}: the clubhouse on ${s}`);
  }
 }
});

test('the path runs to its door', () => {
 const w = A('midwest'), b = w.buildings[0], door = w.paths[0].door;
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
 const home = (w, k) => { const t = w.holes[0].toWorld(w.holes[0].tees.blue), g = w.holes[k].worldGreen; return Math.hypot(g.x - t.x, g.z - t.z) <= 200; };
 let a = 0, c = 0, n = 0;
 for (const biome of ['pnw', 'desert', 'midwest', 'autumn']) for (const seed of ['HOME-1', 'HOME-2']) {
  const arch = world({seed, biome, holes: 9, designer: 'architect'}), classic = world({seed, biome, holes: 9});
  n++; a += home(arch, 8); c += home(classic, 8);
 }
 assert.ok(a >= n * .75, `Architect: ${a} of ${n} nines home`);
 assert.ok(a > c, `Architect ${a} against Classic ${c}`);
});
