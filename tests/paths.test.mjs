import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {pathIndex} from '../src/paths.js';
import {pathRelief, STANCE} from '../src/relief.js';
import {GROUNDS, allows, isNatural} from '../src/grounds.js';

// CART PATHS (architect-courses, phase 2): an Architect course's paths run
// beside its holes out of play and on to each next tee; they are a lie of
// their own, nothing stands on them, a bridge carries them over a creek, and
// a ball that stops on one gets free relief. Classic has none.

const arch = world({seed: 'PATHS-T', holes: 9, biome: 'midwest', designer: 'architect', archStory: 'lots'});
const classic = world({seed: 'PATHS-T', holes: 9, biome: 'midwest'});

test('an Architect course has a path the length of a course; Classic has none', () => {
 assert.equal(classic.paths.length, 0);
 assert.equal(classic.bridges.length, 0);
 assert.equal(arch.paths.length, 1);
 const p = arch.paths[0].points;
 let len = 0;
 for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
 assert.ok(len > 2500 && len < 9000, `nine holes of path: ${Math.round(len)} m`);
 assert.ok(arch.paths[0].width >= 2 && arch.paths[0].width <= 3.2, 'about 8 ft wide');
});

test('the path is its own lie, never over a green, a tee, sand or water', () => {
 let on = 0, n = 0;
 for (const q of arch.paths[0].points) {
  n++;
  const s = arch.surface(q.x, q.z);
  if (s === 'path') on++;
  else assert.ok(!['green', 'fringe', 'tee', 'sand'].includes(s), `a path point on ${s}`);
 }
 assert.ok(on / n > .95, `${on} of ${n} path points play as path`);
 assert.equal(GROUNDS.path.label, 'Cart path');
 assert.ok(!isNatural('path') && !allows('path', 'trees') && !allows('path', 'boulders'));
});

test('nothing grows or stands on a path', () => {
 const idx = pathIndex(arch.paths);
 const on = arch.trees.filter(t => !t.under && idx.onPath(t.x, t.z));
 assert.equal(on.length, 0, `${on.length} plants on the path`);
 for (const h of arch.homes) assert.ok(!idx.onPath(h.x, h.z), 'a house on the path');
});

test('the path stays out of play beside the hole it runs down', () => {
 // Off the mown fairway for nearly all its run beside the holes; it crosses
 // fairways only on the way from a green to the next tee.
 let fairway = 0;
 for (const q of arch.paths[0].points) {
  const n = arch.nearest(q.x, q.z);
  if (n.h.localSurface?.(n.p.x, n.p.z) === 'fairway' || n.h.surface(n.p.x, n.p.z) === 'fairway') fairway++;
 }
 assert.ok(fairway / arch.paths[0].points.length < .12, `${fairway} path points on fairway`);
});

test('free relief from a path: off it, stance and all, no nearer the hole, no penalty', () => {
 // A straight path 2.4 m wide along z, rough either side.
 const surface = (x, z) => Math.abs(x) <= 1.2 ? 'path' : 'rough';
 const pin = {x: 30, z: 150};
 for (const ball of [{x: .4, z: 50}, {x: -1, z: 60}, {x: 1.1, z: 140}]) {
  const r = pathRelief(surface, ball, pin);
  assert.ok(r, 'relief found');
  assert.equal(r.penalty, 0);
  assert.notEqual(surface(r.spot.x, r.spot.z), 'path');
  const toPin = p => Math.hypot(p.x - pin.x, p.z - pin.z);
  assert.ok(toPin(r.spot) >= toPin(ball) - 1e-6, 'no nearer the hole');
  // The stance: half a metre either side, across the line to the hole.
  const q = r.reference, dx = pin.x - q.x, dz = pin.z - q.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
  for (const s of [-1, 1]) assert.notEqual(surface(q.x + nx * STANCE * s, q.z + nz * STANCE * s), 'path', 'the stance is off the path too');
  assert.ok(Math.hypot(r.spot.x - ball.x, r.spot.z - ball.z) < 3, 'beside the path, not across the course');
 }
 // Nowhere to go: no relief, rather than a drop in the water.
 assert.equal(pathRelief((x, z) => Math.abs(x) <= 1.2 ? 'path' : 'water', {x: 0, z: 10}, pin), null);
});

test('a creek the path crosses gets a bridge', () => {
 // PATHS-T crosses no creek; BR-7 on Midwest with a lot of story crosses one.
 const bridged = world({seed: 'BR-7', holes: 9, biome: 'midwest', designer: 'architect', archStory: 'lots'});
 assert.ok(bridged.bridges.length >= 1, 'no bridge where the path crosses a creek');
 for (const b of [...arch.bridges, ...bridged.bridges]) {
  assert.ok(b.span > 3 && b.span < 60, `bridge span ${b.span}`);
  assert.ok(Number.isFinite(b.angle));
 }
});

import {CLUBHOUSE_ASPECT} from '../src/clubhouse.js';
import {MESH_MODELS} from '../src/asset-meshes.js';
test('every clubhouse keeps its model\'s own proportions (clubhouse.js CLUBHOUSE_ASPECT)', () => {
 // The table is the ingested model's height for its width; a model rebuilt
 // without re-measuring it would be drawn stretched or squashed.
 for (const [k, a] of Object.entries(CLUBHOUSE_ASPECT)) {
  const m = MESH_MODELS[`Blender_Clubhouse_${k}`];
  assert.ok(m, `no model for ${k}`);
  assert.ok(Math.abs(a - 1 / (2 * m.rx)) < .002, `${k}: the table says ${a}, the model ${(1 / (2 * m.rx)).toFixed(3)}`);
 }
});

// PHASE 5: A BRIDGE'S DECK IS SOLID (physics.js, the houses' box routine with
// a floor). A ball dropped onto it stops on the planks, not in the creek bed
// under them, and is in the penalty area there (Rule 17.1a: a penalty area's
// edge runs straight up). Classic has no bridges, so nothing changes there.
import {simulateShot} from '../src/physics.js';
test('a ball dropped on a bridge stops on its deck, in the penalty area', () => {
 const w = world({seed: 'BR-7', holes: 9, biome: 'midwest', designer: 'architect', archStory: 'lots'});
 assert.ok(w.bridges.length, 'this course has a bridge');
 const b = w.bridges[0], h = w.nearest(b.x, b.z).h, at = h.toLocal({x: b.x, z: b.z});
 assert.ok(b.deck > w.height(b.x, b.z) + .3, 'the deck stands over the water');
 const r = simulateShot({origin: {...at}, height: b.deck - w.height(b.x, b.z) + 2, aim: 0, speed: 2, vla: -70, spin: 0, hla: 0, spinAxis: 0}, h, {});
 assert.equal(r.hazard, 'Water');
 assert.ok(Math.abs(r.end.y - (b.deck + .02135)) < .1, `the ball ends at ${r.end.y.toFixed(2)}, the deck at ${b.deck.toFixed(2)}`);
});
