import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {simulateShot} from '../src/physics.js';

// PHASE 7: TOURNAMENT WEEK (architect-courses; occasion.js). A Championship
// venue's stands round the last green and a par three, its scoreboard,
// towers and marquees -- solid, off every played surface, never out of
// bounds -- its ropes, and a crowd that fills through the week. Nothing on
// any other club, and nothing on Classic.

const PLAYED = ['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path'];
const venue = day => world({seed: 'WEEK-T', holes: 9, biome: 'midwest', designer: 'architect', archClub: 'championship', pinDay: day});

test('only a Championship venue is dressed', () => {
 for (const w of [world({seed: 'WEEK-T', holes: 9, biome: 'midwest'}), world({seed: 'WEEK-T', holes: 9, biome: 'midwest', designer: 'architect', archClub: 'members'})]) {
  assert.equal(w.buildings.filter(b => b.occasion).length, 0);
  assert.equal(w.occasion.ropes.length + w.occasion.crowd.length, 0);
 }
 const w = venue('Sunday'), kinds = w.buildings.filter(b => b.occasion).map(b => b.kind);
 assert.ok(kinds.filter(k => k === 'stand').length >= 2, `stands: ${kinds}`);
 for (const k of ['scoreboard', 'tower', 'marquee']) assert.ok(kinds.includes(k), `no ${k}: ${kinds}`);
 assert.ok(w.occasion.ropes.length > 20, `${w.occasion.ropes.length} rope sections`);
});

test('everything stands off play; a stand behind the last green faces it', () => {
 const w = venue('Thursday'), last = w.holes[w.holes.length - 1], g = last.worldGreen;
 for (const b of w.buildings.filter(b => b.occasion)) {
  const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation);
  for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
   const x = b.x + u * b.width / 2 * cs + v * b.depth / 2 * sn, z = b.z - u * b.width / 2 * sn + v * b.depth / 2 * cs;
   assert.ok(!PLAYED.includes(w.surface(x, z)), `a ${b.kind} on ${w.surface(x, z)}`);
  }
 }
 for (const r of w.occasion.ropes) assert.ok(!PLAYED.includes(w.surface(r.x, r.z)), `a rope on ${w.surface(r.x, r.z)}`);
 const stand = w.buildings.filter(b => b.kind === 'stand').sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z))[0];
 const fx = -Math.sin(stand.rotation), fz = -Math.cos(stand.rotation), dx = g.x - stand.x, dz = g.z - stand.z, l = Math.hypot(dx, dz);
 assert.ok((fx * dx + fz * dz) / l > .98, 'the stand faces its green');
 assert.ok(l < 90, `the stand ${l.toFixed(0)} m from the last green`);
});

test('the crowd fills through the week', () => {
 const n = day => venue(day).occasion.crowd.length;
 const thu = n('Thursday'), sun = n('Sunday');
 assert.ok(thu > 30, `${thu} on Thursday`);
 assert.ok(sun > thu * 2, `Sunday ${sun} against Thursday ${thu}`);
});

test('a stand is solid: a ball flown at it stops short of it, never out of bounds', () => {
 const w = venue('Sunday'), b = w.buildings.find(o => o.kind === 'stand'), h = w.nearest(b.x, b.z).h;
 const fx = -Math.sin(b.rotation), fz = -Math.cos(b.rotation);
 const from = h.toLocal({x: b.x + fx * (b.depth / 2 + 30), z: b.z + fz * (b.depth / 2 + 30)}), at = h.toLocal({x: b.x, z: b.z});
 const aim = Math.atan2(at.x - from.x, at.z - from.z) * 180 / Math.PI;
 const course = Object.assign(Object.create(h), {residentialOB: true});
 const r = simulateShot({origin: {...from}, aim, speed: 30, vla: 10, spin: 2500, hla: 0, spinAxis: 0}, course, {});
 assert.ok(r.homeHits > 0, 'the ball met the stand');
 assert.notEqual(r.hazard, 'Out of bounds');
});
