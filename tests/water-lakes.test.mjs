// A lake never lands on top of a pond. Split from water-terrain.test.mjs (the
// testing audit, 31 October 2026): its own courses, so it runs beside the rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius, insideOval, fairwayWidth, NO_INLAND_WATER, BEACH_RISE} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {shoreBands} from '../src/streams.js';

test('a lake never lands on top of a pond', () => {
 // The separation test consulted only the lakes this pass had already placed,
 // so a lake could be dropped straight onto a pond that had existed since the
 // hole was generated: ten overlapping pairs across twelve courses. They did
 // not merely touch -- the worst pair had water surfaces 14.19 m apart, one
 // body's plane hanging over the other's basin.
 let pairs = 0, lakes = 0;
 for (const biome of ['pacnw', 'rockies']) for (const seed of ['A', 'B', 'C']) {
  const w = buildWorld({seed, biome, holes: 9, water: 100, lakes: 3});
  lakes += (w.largeLakes || []).length;
  const bodies = [];
  for (const h of w.holes) for (const p of h.ponds) bodies.push({h, p});
  const hits = (a, b) => {
   for (let i = 0; i < 32; i++) {
    const v = ovalRadius(a.p, i / 32 * Math.PI * 2);
    const q = a.h.toWorld({x: a.p.x + v.x, z: a.p.z + v.z});
    const l = b.h.toLocal(q);
    if (insideOval(l.x, l.z, b.p)) return true;
   }
   return false;
  };
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++)
   if (hits(bodies[i], bodies[j]) || hits(bodies[j], bodies[i])) pairs++;
 }
 assert.equal(pairs, 0, `${pairs} overlapping water bodies`);
 // And the fix must not work by refusing to place lakes at all.
 assert.ok(lakes >= 15, `only ${lakes} lakes placed`);
});
