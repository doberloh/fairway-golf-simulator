import test from 'node:test';
import assert from 'node:assert/strict';
import {fountainDrops, dropAt, ringAt, jetAt} from '../src/fountain.js';

// THE FOUNTAIN'S WATER (fountain.js; the owner's review: "fountains need to be
// animated"). The renderer draws whatever these say, so they hold the shape:
// a plume about 4 m tall, landing within 3 m, steady, and moving.

const drops = fountainDrops(480, 7);

test('every drop flies a parabola from the nozzle and lands within 3.5 m', () => {
 for (const d of drops) {
  const flight = 2 * d.vy / 9.81;
  let top = 0, far = 0;
  for (let k = 0; k <= 40; k++) { const p = dropAt({...d, phase: 0}, flight * k / 40 * .999); top = Math.max(top, p.y); far = Math.max(far, Math.hypot(p.x, p.z)); assert.ok(p.y >= -1e-6, 'a drop below the water'); }
  assert.ok(top > 2.9 && top < 4.3, `apex ${top.toFixed(2)} m`);
  assert.ok(far < 3.5, `lands ${far.toFixed(2)} m out`);
 }
});

test('the plume is steady: at any moment drops fill it from the water to the top', () => {
 for (const t of [0, 1.3, 7.7]) {
  const ys = drops.map(d => dropAt(d, t).y);
  for (const [lo, hi] of [[0, 1], [1, 2], [2, 3], [3, 4.3]]) assert.ok(ys.filter(y => y >= lo && y < hi).length >= 15, `t=${t}: few drops between ${lo} and ${hi} m`);
 }
});

test('it moves, and the same seed draws the same fountain', () => {
 const a = dropAt(drops[5], 1), b = dropAt(drops[5], 1.1);
 assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > .1, 'a drop did not move in a tenth of a second');
 assert.deepEqual(fountainDrops(480, 7)[9], drops[9]);
 assert.notDeepEqual(fountainDrops(480, 8)[9], drops[9]);
});

test('rings spread and fade; the jet breathes but stays about 3.7 m', () => {
 const r0 = ringAt(0, 3, 0), r1 = ringAt(0, 3, 1);
 assert.ok(r1.r > r0.r, 'a ring did not spread');
 for (let t = 0; t < 10; t += .37) { const r = ringAt(1, 3, t); assert.ok(r.r >= 1 && r.r <= 4 && r.o >= 0 && r.o <= .55); const j = jetAt(t); assert.ok(j > 3.4 && j < 4); }
});
