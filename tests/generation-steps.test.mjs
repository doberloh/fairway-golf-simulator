import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, generateWorldSteps} from '../src/course.js';
import {makeGroundGrid, makeGroundGridSteps} from '../src/terrain-grid.js';

// The whole point of the stepped generator is that it changes NOTHING about what
// comes out. These are the tests that would catch a yield landing mid-row, or a
// loop reordered while it was being banded.

const SETTINGS = {holes: 9, biome: 'pnw', seed: 'stepped', trees: 120};

test('draining the steps gives the same world as calling it straight', () => {
 const direct = generateWorld(SETTINGS);
 const it = generateWorldSteps(SETTINGS);
 let r = it.next();
 while (!r.done) r = it.next();
 const stepped = r.value;
 // Ground is the thing the grid decides, so it is the thing to compare. A yield
 // in the wrong place inside makeGroundGrid shows up here and nowhere else.
 let worst = 0;
 for (let i = 0; i < 4000; i++) {
  const x = (i * 97 % 1400) - 700, z = (i * 53 % 1400) - 700;
  worst = Math.max(worst, Math.abs(direct.height(x, z) - stepped.height(x, z)));
 }
 assert.equal(worst, 0, `heights differ by up to ${worst}`);
 assert.equal(direct.holes.length, stepped.holes.length);
 assert.equal(direct.trees.length, stepped.trees.length);
 for (const k of ['halfX', 'halfZ', 'waterLevel']) assert.equal(direct[k], stepped[k]);
});

test('the grid drained in steps is identical to the grid built in one go', () => {
 const sample = (x, z) => Math.sin(x / 37) * 4 + Math.cos(z / 51) * 3 + x / 400;
 const refine = (x, z) => Math.hypot(x, z) < 60;
 const direct = makeGroundGrid(sample, 220, 180, 3, refine);
 const it = makeGroundGridSteps(sample, 220, 180, 3, refine);
 let r = it.next();
 while (!r.done) r = it.next();
 const stepped = r.value;
 assert.deepEqual(Array.from(direct.values), Array.from(stepped.values));
 assert.deepEqual(Array.from(direct.indices), Array.from(stepped.indices));
 assert.deepEqual(Array.from(direct.positions), Array.from(stepped.positions));
 assert.equal(direct.cells.size, stepped.cells.size);
});

test('progress only ever goes forward, and reaches the end', () => {
 const it = generateWorldSteps(SETTINGS);
 let r = it.next(), last = -1, steps = 0, labels = new Set();
 while (!r.done) {
  const {label, done} = r.value;
  assert.ok(done >= last, `progress went backward: ${last} then ${done}`);
  assert.ok(done >= 0 && done <= 1, `progress out of range: ${done}`);
  assert.ok(typeof label === 'string' && label.length, 'every step is labelled');
  last = done; steps++; labels.add(label);
  r = it.next();
 }
 assert.ok(steps > 200, `only ${steps} steps -- too coarse to pace a frame budget against`);
 assert.ok(last > .95, `finished at ${last}, so the bar would stop short`);
 assert.ok(labels.size >= 4, `only ${labels.size} distinct phases: ${[...labels]}`);
});

test('the ground phase is most of the steps, because it is most of the work', () => {
 // If this inverts, the weights in course.js have drifted from where the time
 // actually goes and the bar will crawl and then leap.
 const it = generateWorldSteps(SETTINGS);
 let r = it.next(), ground = 0, total = 0;
 while (!r.done) {
  if (r.value.label === 'Building the ground') ground++;
  total++;
  r = it.next();
 }
 assert.ok(ground / total > .8, `ground was ${(100 * ground / total).toFixed(0)}% of the steps`);
});

test('a stepped run can be abandoned partway without breaking the next one', () => {
 // The driver abandons a run whenever a newer round replaces it. A generator
 // left unfinished must not hold anything that the next call reads.
 const half = generateWorldSteps(SETTINGS);
 for (let i = 0; i < 50; i++) half.next();
 half.return?.();
 const after = generateWorld(SETTINGS);
 assert.equal(after.holes.length, 9);
 assert.ok(Number.isFinite(after.height(0, 0)));
});
