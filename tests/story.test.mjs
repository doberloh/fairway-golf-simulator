import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {simulateShot} from '../src/physics.js';
import {STORY_SET} from '../src/story.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// PHASE 6: THE LAND'S STORY AND ITS TEMPLATES (architect-courses; story.js,
// architect.js). Walls, a farmstead, ruins, a landmark, a stone circle and
// lanterns, by The land's story, out of play and solid where they stand; and
// the holes a landform makes -- the Dell, the Alps, the Barranca, the Pit.
// Classic has none of it.

const PLAYED = ['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path'];
const lots = biome => world({seed: 'ST-1', holes: 9, biome, designer: 'architect', archStory: 'lots'});

test('Classic has no story; None has none either, but for a Dell\'s stone', () => {
 const c = world({seed: 'ST-1', holes: 9, biome: 'midwest'});
 assert.equal(c.walls.length, 0);
 assert.equal(c.storyProps.length, 0);
 assert.equal(c.buildings.length, 0);
 const none = world({seed: 'ST-1', holes: 9, biome: 'links', designer: 'architect', archStory: 'none'});
 assert.equal(none.buildings.filter(b => b.story).length, 0);
 assert.equal(none.walls.filter(w => !w.pit).length, 0);
 assert.equal(none.storyProps.filter(p => p.kind !== 'aimstone').length, 0);
});

test('each landscape tells its own story', () => {
 for (const biome of BIOME_KEYS) {
  const w = lots(biome), set = STORY_SET[biome] || {}, kinds = new Set(w.buildings.filter(b => b.story).map(b => b.kind));
  if (set.farm) assert.ok(kinds.has('barn'), `${biome}: no farmstead`);
  if (set.ruins?.length) assert.ok(set.ruins.some(r => kinds.has(r)), `${biome}: no ruin (${[...kinds]})`);
  if (set.walls) assert.ok(w.walls.some(x => x.kind === set.walls), `${biome}: no ${set.walls} walls`);
  else assert.equal(w.walls.filter(x => !x.pit).length, 0, `${biome}: walls where none belong`);
  if (set.circle) assert.ok(w.storyProps.filter(p => p.kind === 'stone').length >= 7, `${biome}: no stone circle`);
 }
});

test('the story stands out of play: off every played surface, the paths and the water', () => {
 for (const biome of ['midwest', 'links', 'haunted', 'mountain', 'autumn']) {
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
 const w = lots('links'), l = w.walls.filter(x => !x.pit).sort((p, q) => Math.hypot(q.bx - q.ax, q.bz - q.az) - Math.hypot(p.bx - p.ax, p.bz - p.az))[0];
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

test('the land\'s templates: a Dell\'s dune, an Alps\' ridge, a Barranca\'s ravine, a Pit\'s wall', () => {
 const find = (biome, archStyle, seeds, t) => { for (const seed of seeds) { const w = world({seed, holes: 9, biome, designer: 'architect', archStyle}); const h = w.holes.find(k => k.design?.template === t); if (h) return {w, h}; } return null; };
 const rise = ({w, h}) => { const e = h.design.earthworks[0], c = h.toWorld({x: h.center(e.z), z: e.z}), b = h.toWorld({x: h.center(e.z - e.r - 6), z: e.z - e.r - 6}); return w.height(c.x, c.z) - w.height(b.x, b.z); };
 const dell = find('autumn', 'raynor', ['T-3', 'T-4'], 'dell');
 assert.ok(dell, 'a Dell');
 assert.ok(rise(dell) > 1.5, `the Dell's dune rises ${rise(dell).toFixed(1)} m`);
 assert.ok(dell.w.storyProps.some(p => p.kind === 'aimstone'), 'the Dell has its white stone');
 const alps = find('pnw', 'golden', ['T-1', 'T-3'], 'alps');
 assert.ok(alps && rise(alps) > 2.5, `the Alps' ridge rises ${alps && rise(alps).toFixed(1)} m`);
 const bar = find('pnw', 'golden', ['T-2'], 'barranca');
 assert.ok(bar, 'a Barranca');
 const e = bar.h.design.earthworks[0], c = bar.h.toWorld({x: bar.h.center(e.z), z: e.z});
 assert.ok(rise(bar) < -2.5, `the ravine falls ${rise(bar).toFixed(1)} m`);
 assert.notEqual(bar.w.surface(c.x, c.z), 'fairway', 'no fairway across the ravine');
 const before = bar.h.toWorld({x: bar.h.center(e.z - e.r - 12), z: e.z - e.r - 12});
 assert.equal(bar.w.surface(before.x, before.z), 'fairway', 'the fairway runs up to its lip');
 assert.ok(bar.w.bridges.length >= 1, 'the path bridges it');
 for (const t of bar.w.trees) { const q = bar.h.toLocal(t); assert.ok(!(Math.abs(q.z - e.z) < e.r && Math.abs(q.x - bar.h.center(q.z)) < bar.h.width(q.z)), 'a tree in the ravine across the line of play'); }
 const pit = find('links', 'links', ['T-2'], 'pit');
 assert.ok(pit, 'a Pit');
 const wall = pit.w.walls.find(l => l.pit && l.hole === pit.h.hole);
 assert.ok(wall, 'the Pit has its wall');
 const g = pit.h.worldGreen, mid = {x: (wall.ax + wall.bx) / 2, z: (wall.az + wall.bz) / 2};
 assert.ok(Math.hypot(mid.x - g.x, mid.z - g.z) < pit.h.greenSize + 12, 'in front of the green');
});
