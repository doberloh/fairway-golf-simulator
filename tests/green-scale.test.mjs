import test from 'node:test';
import assert from 'node:assert/strict';
import {greenGradient} from '../src/course-plan.js';
import {DEFAULT_COURSE, migrateSettings, validateSettings} from '../src/settings-schema.js';
import {world} from './worlds.mjs';

// GREEN SIZE (the owner, 15 October 2026). The slider multiplies each green's
// drawn radius after the draw, so nothing else in the course moves, and the
// bumps on a green scale with it (GREEN_REF), so a bigger green is not a
// steeper one.

const at = (greenScale, seed = 'GREEN-SCALE', biome = 'midwest') => world({holes: 9, biome, seed, greenScale});

test('100% is the greens there were before the slider', () => {
 assert.equal(DEFAULT_COURSE.greenScale, 100);
 const plain = world({holes: 9, biome: 'midwest', seed: 'GREEN-SCALE'}), scaled = at(100);
 plain.holes.forEach((h, i) => assert.equal(scaled.holes[i].greenSize, h.greenSize));
});

test('the slider multiplies every green and moves nothing else', () => {
 const base = at(100);
 for (const pct of [60, 160]) {
  const w = at(pct);
  w.holes.forEach((h, i) => {
   const b = base.holes[i];
   assert.ok(Math.abs(h.greenSize - b.greenSize * pct / 100) < 1e-9, `hole ${i + 1} at ${pct}%`);
   assert.equal(h.par, b.par, `hole ${i + 1} keeps its par at ${pct}%`);
   assert.equal(h.greenAspect, b.greenAspect, `hole ${i + 1} keeps its proportions at ${pct}%`);
  });
 }
});

test('a bigger or smaller green keeps its slopes', () => {
 const median = pct => {
  const slopes = [];
  for (const h of at(pct).holes) {
   const reach = h.greenSize * 1.6;
   for (let dx = -reach; dx <= reach; dx += reach / 12) for (let dz = -reach; dz <= reach; dz += reach / 12) {
    const x = h.pin.x + dx, z = h.pin.z + dz;
    if (h.surface(x, z) !== 'green') continue;
    const g = greenGradient(h, x, z); slopes.push(Math.hypot(g.x, g.z) * 100);
   }
  }
  slopes.sort((a, b) => a - b);
  return slopes[Math.floor(slopes.length / 2)];
 };
 const mid = median(100);
 for (const pct of [60, 160]) {
  const m = median(pct);
  assert.ok(Math.abs(m - mid) < .35, `median slope at ${pct}% is ${m.toFixed(2)}%, against ${mid.toFixed(2)}% at 100%`);
 }
});

test('a save from before the slider keeps its greens', () => {
 const old = {...DEFAULT_COURSE, seed: 'OLD-GREENS'};
 delete old.greenScale;
 const s = migrateSettings(old, 10);
 assert.equal(s.greenScale, 100);
 assert.doesNotThrow(() => validateSettings(s));
});
