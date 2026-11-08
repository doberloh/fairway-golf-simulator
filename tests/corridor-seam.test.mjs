import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';

// NO SEAM WHERE TWO CORRIDORS MEET (PROJECT_HANDOFF; course.js `land`). The
// relief kept behind a tee belonged to the nearest hole, so where one hole's
// tee area met another's fairway the ground switched there as a bank: 2.4 m
// across 1.5 m of Links ST-1's first fairway (Architect, the owner's "weird
// hole"), a 4 m wall in 3 m at the edge of HZ-2's fifth fairway (Classic).
// Measured where the nearest hole changes between neighbouring points, on
// played ground clear of sand, water, paths and tee pads (whose banks are
// meant): the sharpest bend, the height's second difference over 2 m.

const PLAYED = new Set(['fairway', 'fringe', 'green', 'semi']);
const KEEP_CLEAR = new Set(['sand', 'water', 'path', 'tee']);

function sharpestOnSeams(w) {
 let worst = 0, seams = 0;
 const bend = (x, z) => {
  const y = w.height(x, z);
  let c = 0;
  for (const [ax, az] of [[1, 0], [0, 1], [.707, .707], [.707, -.707]]) c = Math.max(c, Math.abs(w.height(x + ax * 2, z + az * 2) + w.height(x - ax * 2, z - az * 2) - 2 * y) / 4);
  return c;
 };
 for (const h of w.holes) for (let z = 0; z < h.length + 30; z += 3) {
  const half = Math.max(h.leftWidth(Math.min(z, h.length)), h.rightWidth(Math.min(z, h.length))) + 30;
  for (let o = -half; o <= half; o += 3) {
   const p = h.toWorld({x: h.center(Math.min(z, h.length)) + o, z});
   if (!PLAYED.has(w.surface(p.x, p.z))) continue;
   const own = w.nearest(p.x, p.z).h;
   if ([[3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dz]) => w.nearest(p.x + dx, p.z + dz).h === own)) continue;
   let clear = true;
   for (let a = 0; a < 8 && clear; a++) for (const r of [2, 4, 6]) if (KEEP_CLEAR.has(w.surface(p.x + Math.cos(a * .785) * r, p.z + Math.sin(a * .785) * r))) clear = false;
   if (!clear) continue;
   seams++;
   worst = Math.max(worst, bend(p.x, p.z));
  }
 }
 return {worst, seams};
}

for (const [settings, before] of [
 [{seed: 'HZ-2', holes: 18, biome: 'seaside'}, .94],
 [{seed: 'ST-1', holes: 9, biome: 'seaside'}, .56],
]) test(`no bank where two corridors meet: ${settings.biome} ${settings.seed} (was ${before})`, () => {
 const {worst, seams} = sharpestOnSeams(world(settings));
 assert.ok(seams > 8, `only ${seams} points where the nearest hole changes -- the course no longer tests a seam`);
 assert.ok(worst < .3, `the played ground bends ${worst.toFixed(2)} where two corridors meet`);
});
