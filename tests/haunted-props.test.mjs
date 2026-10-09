import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot} from '../src/physics.js';
import {launchCorridors, blocksLaunch, inTeeFan, teeFans} from '../src/course.js';
import {PROP_MODELS} from '../src/species.js';
import {world} from './worlds.mjs';

// Haunted Hollow's giant pumpkins and toadstools are SOLID: the owner asked for
// them at three to five times life size and with colliders, so they are world
// data like boulders (course.js) and physics collides with them as cylinders.

const haunted = () => world({holes: 9, biome: 'haunted', seed: 'props'});

test('pumpkins and toadstools are three to five times their old size', () => {
 const w = haunted();
 const pumpkins = w.props.filter(p => p.kind === 'pumpkin'), toadstools = w.props.filter(p => p.kind === 'toadstool');
 // 26 and 18 a hole asked for; siting refuses some, never most.
 assert.ok(pumpkins.length > 9 * 26 * .7, `only ${pumpkins.length} pumpkins`);
 assert.ok(toadstools.length > 9 * 18 * .7, `only ${toadstools.length} toadstools`);
 // The old floor sizes were 0.3-0.7 m and 0.25-0.55 m; times 3 to 5.
 for (const p of pumpkins) assert.ok(p.h >= .9 - 1e-9 && p.h <= 3.5 + 1e-9, `pumpkin ${p.h.toFixed(2)} m`);
 for (const p of toadstools) assert.ok(p.h >= .75 - 1e-9 && p.h <= 2.75 + 1e-9, `toadstool ${p.h.toFixed(2)} m`);
 assert.ok(pumpkins.some(p => p.lantern) && pumpkins.some(p => !p.lantern), 'some pumpkins are lanterns, some are not');
});

test('a prop is as wide as the model it is drawn with', () => {
 for (const p of haunted().props) {
  const ratio = new Map(PROP_MODELS[p.kind]).get(p.model);
  assert.ok(ratio, `${p.model} is not one of the ${p.kind} models`);
  assert.ok(Math.abs(p.reach - p.h * ratio) < 1e-9, `${p.model} reach ${p.reach} is not its drawn width`);
 }
});

test('props keep off the turf and out of every tee shot', () => {
 const w = haunted(), launch = launchCorridors(w.holes, w.height), fans = teeFans(w.holes);
 for (const p of w.props) {
  assert.equal(w.surface(p.x, p.z), 'rough', `${p.kind} on ${w.surface(p.x, p.z)}`);
  assert.ok(!blocksLaunch(launch, p.x, p.z, p.y, p.y + p.h, p.reach), `${p.kind} in a tee shot`);
  assert.ok(!inTeeFan(fans, p.x, p.z, p.reach), `${p.kind} in a tee fan`);
 }
});

test('no other biome grows any', () => {
 for (const biome of ['pnw', 'redwood', 'autumn'])
  assert.equal(world({holes: 9, biome, seed: 'props'}).props.length, 0, `${biome} has props`);
});

test('a ball rolled into a giant pumpkin does not pass through it', () => {
 const w = haunted(), solid = w.props;
 // Rolled from just short of each pumpkin, hard. The first version started 20 m
 // back, and the ball died in the rough before it got there: it passed with the
 // pumpkins taken out of physics altogether. So the control is part of the
 // test -- the same rolls with the props hidden must go past the spot.
 const roll = () => {
  let tested = 0, through = 0;
  for (const h of w.holes) {
   const mine = solid.filter(p => p.kind === 'pumpkin').map(p => ({...p, ...h.toLocal(p)}))
    .filter(p => p.reach > 1 && p.z > 30 && p.z < h.length && Math.abs(p.x) < 200)
    .sort((a, b) => b.reach - a.reach).slice(0, 3);
   for (const p of mine) {
    const end = simulateShot({origin: {x: p.x, z: p.z - p.reach - 2}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: 25}, h, {wind: [0, 0, 0]});
    tested++;
    if (end.end.z > p.z + p.reach) through++;
   }
  }
  return {tested, through};
 };
 const hit = roll();
 w.props = [];
 const control = roll();
 w.props = solid;
 assert.ok(hit.tested >= 12, `only ${hit.tested} pumpkins were testable`);
 assert.equal(control.through, control.tested, `with no pumpkins there, only ${control.through} of ${control.tested} rolls reached past the spot`);
 assert.equal(hit.through, 0, `${hit.through} of ${hit.tested} rolls went straight through a pumpkin`);
});
