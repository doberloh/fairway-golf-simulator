import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {simulateShot} from '../src/physics.js';
import {storySet} from '../src/story.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// PHASE 6: THE LAND'S STORY (architect-courses; story.js). Walls, a farmstead,
// ruins and a landmark, out of play and solid where they stand, on every
// generated course (an Architect course's alone until the designer was
// removed, 2 November 2026; its template holes -- the Dell, the Alps, the
// Barranca, the Pit -- went with it).

const PLAYED = ['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path'];
const lots = biome => world({seed: 'ST-1', holes: 9, biome});

test('each landscape tells its own story', () => {
 for (const biome of BIOME_KEYS) {
  const w = lots(biome), set = storySet(biome), kinds = new Set(w.buildings.filter(b => b.story).map(b => b.kind));
  if (set.farm) assert.ok(kinds.has(typeof set.farm === 'string' ? set.farm : 'barn'), `${biome}: no farmstead`);
  if (set.farm === 'redbarn') assert.ok(w.storyProps.some(p => p.kind === 'corn'), `${biome}: no corn by the barn`);
  if (set.ruins?.length) assert.ok(set.ruins.some(r => kinds.has(r)), `${biome}: no ruin (${[...kinds]})`);
  // A landmark was silently lost for a day (generator 55-59): the story was
  // fixed at "some" and a landmark needed "lots".
  if (set.landmark) assert.ok(kinds.has(set.landmark), `${biome}: no ${set.landmark}`);
  if (set.walls) assert.ok(w.walls.some(x => x.kind === set.walls), `${biome}: no ${set.walls} walls`);
  else assert.equal(w.walls.filter(x => !x.pit).length, 0, `${biome}: walls where none belong`);
 }
});

test('the story stands out of play: off every played surface, the paths and the water', () => {
 for (const biome of ['heartland', 'links', 'rockies', 'newengland']) {
  const w = lots(biome);
  for (const b of w.buildings.filter(b => b.story)) {
   assert.ok(!PLAYED.includes(w.surface(b.x, b.z)), `${biome}: a ${b.kind} on ${w.surface(b.x, b.z)}`);
   assert.ok(w.nearest(b.x, b.z).d > 14, `${biome}: a ${b.kind} ${w.nearest(b.x, b.z).d.toFixed(0)} m from a corridor`);
  }
  for (const l of w.walls.filter(l => !l.pit)) for (let t = 0; t <= 1; t += .25) {
   const x = l.ax + (l.bx - l.ax) * t, z = l.az + (l.bz - l.az) * t;
   assert.ok(!PLAYED.includes(w.surface(x, z)), `${biome}: a wall on ${w.surface(x, z)}`);
  }
  // Nothing grows inside a building.
  for (const b of w.buildings.filter(b => b.story)) for (const t of w.trees) {
   const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = t.x - b.x, dz = t.z - b.z;
   assert.ok(!(Math.abs(dx * cs - dz * sn) < b.width / 2 && Math.abs(dx * sn + dz * cs) < b.depth / 2), `${biome}: a ${t.kind} inside a ${b.kind}`);
  }
 }
});

test('a wall is solid: a ball rolled at it stops against it, and is never out of bounds for it', () => {
 // A wall on mown rough (ST-2): on ST-1 the generator's longest wall stands in
 // native grass, which stops a rolled ball short of it.
 const w = world({seed: 'ST-2', holes: 9, biome: 'links'}), l = w.walls.filter(x => !x.pit).sort((p, q) => Math.hypot(q.bx - q.ax, q.bz - q.az) - Math.hypot(p.bx - p.ax, p.bz - p.az))[0];
 const mx = (l.ax + l.bx) / 2, mz = (l.az + l.bz) / 2, dx = l.bx - l.ax, dz = l.bz - l.az, n = Math.hypot(dx, dz);
 const h = w.nearest(mx, mz).h, from = h.toLocal({x: mx + dz / n * 12, z: mz - dx / n * 12}), at = h.toLocal({x: mx, z: mz});
 const aim = Math.atan2(at.x - from.x, at.z - from.z) * 180 / Math.PI;
 const course = Object.assign(Object.create(h), {residentialOB: true});
 const r = simulateShot({origin: {...from}, aim, speed: 20, vla: 0, spin: 0, hla: 0, spinAxis: 0}, course, {});
 assert.ok(r.homeHits > 0, 'the ball met the wall');
 assert.notEqual(r.hazard, 'Out of bounds');
 // It finishes on the side it came from (a links rough rolls it no further).
 const end = h.toWorld(r.end), across = p => (p.x - mx) * dz / n - (p.z - mz) * dx / n;
 assert.ok(across(end) * across(h.toWorld(from)) > 0 && Math.abs(across(end)) > .3, 'it stopped on its own side of the wall');
});
