import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoResolution, resolutionLadder, targetInterval, MIN_PIXEL_RATIO} from '../src/auto-resolution.js';

// A pretend machine: a frame's cost in ms at a given scale of the tier's
// pixels (cost grows with the pixel count, the square of the scale), paced to
// a 60 Hz display the way requestAnimationFrame paces it -- a frame that
// misses one refresh waits for the next.
const run = (ar, seconds, costAt, {start = 0, cap = 0, refresh = 1000 / 60} = {}) => {
 let now = start;
 const scales = [];
 while (now < start + seconds * 1000) {
  const cost = costAt(ar.scale);
  const interval = Math.max(refresh, Math.ceil(cost / refresh) * refresh);
  now += interval;
  scales.push(ar.sample(interval, now, cap));
 }
 return {now, scales, changes: scales.filter((s, i) => i && s !== scales[i - 1]).length};
};

test('a ladder never goes above the tier or below the floor, and every step changes something', () => {
 for (const ceiling of [.75, 1, 1.25, 1.5, 2]) {
  const ladder = resolutionLadder(ceiling);
  assert.equal(ladder[0].ratio, ceiling);
  for (const s of ladder) assert.ok(s.ratio <= ceiling + 1e-9 && s.ratio >= Math.min(ceiling, MIN_PIXEL_RATIO) - 1e-9);
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i].ratio < ladder[i - 1].ratio);
 }
 // Low's .75 reaches the floor in two steps and stops there.
 assert.deepEqual(resolutionLadder(.75).map(s => +s.ratio.toFixed(3)), [.75, .637, .54, .5]);
});

test('it aims for 60, or the cap when that is lower -- never a faster display', () => {
 assert.equal(targetInterval(0), 1000 / 60);
 assert.equal(targetInterval(30), 1000 / 30);
 assert.equal(targetInterval(144), 1000 / 60);
});

test('a machine with room to spare is never touched', () => {
 const ar = createAutoResolution(); ar.setCeiling(1);
 const r = run(ar, 60, () => 9);
 assert.equal(r.changes, 0);
 assert.equal(ar.scale, 1);
});

test('a slow machine steps down until frames reach the target, and stays there', () => {
 // 30 ms at full pixels: needs about 55% of the pixels to fit 16.7 ms.
 const ar = createAutoResolution(); ar.setCeiling(1);
 run(ar, 20, s => 30 * s * s);
 assert.ok(ar.scale < 1, 'it never stepped down');
 assert.ok(30 * ar.scale ** 2 <= 1000 / 60, `settled at ${ar.scale}, still too slow`);
 // Settled: over the next two minutes it may try a step up now and then, but
 // it spends nearly all its time at the step that fits, and the tries get
 // rarer (the wait doubles each time one bounces).
 const r = run(ar, 120, s => 30 * s * s, {start: 20000});
 const fits = r.scales.filter(s => 30 * s * s <= 1000 / 60).length / r.scales.length;
 assert.ok(fits > .9, `only ${(fits * 100).toFixed(0)}% of frames at a step that fits`);
 assert.ok(ar.wait > 4000, 'bounced tries did not lengthen the wait');
});

test('a machine on the edge does not flicker between two steps', () => {
 // Fits at .85, not at 1: the classic flicker case.
 const ar = createAutoResolution(); ar.setCeiling(1);
 const r = run(ar, 180, s => (s > .9 ? 19 : 14));
 // Without the doubling this would change twice every ~6 s: about 60 times.
 assert.ok(r.changes <= 16, `${r.changes} changes in three minutes`);
});

test('when the load goes away it climbs back to full resolution', () => {
 const ar = createAutoResolution(); ar.setCeiling(1);
 run(ar, 20, s => 30 * s * s);
 assert.ok(ar.scale < 1);
 run(ar, 120, () => 8, {start: 20000});
 assert.equal(ar.scale, 1);
});

test('hitches are not the steady state: a course build or a probe does not step it down', () => {
 const ar = createAutoResolution(); ar.setCeiling(1);
 let now = 0;
 for (let i = 0; i < 600; i++) {
  const interval = i % 120 === 60 ? 900 : 1000 / 60;
  now += interval;
  ar.sample(interval, now);
 }
 assert.equal(ar.scale, 1);
});

test('a machine too slow for every frame still steps down', () => {
 // Three frames a second at full pixels: every frame is 'long', and ignoring
 // them all as hitches would leave the machine that needs it most untouched.
 const ar = createAutoResolution(); ar.setCeiling(1);
 run(ar, 30, s => 330 * s * s);
 assert.equal(ar.level, ar.steps - 1);
});

test('a frame cap of 30 is the target: 30 fps is not slow', () => {
 const ar = createAutoResolution(); ar.setCeiling(1);
 const r = run(ar, 30, () => 25, {cap: 30, refresh: 1000 / 30});
 assert.equal(r.changes, 0);
});

test('stop and a new ceiling both go straight back to full resolution', () => {
 const ar = createAutoResolution(); ar.setCeiling(1);
 run(ar, 20, s => 30 * s * s);
 assert.ok(ar.scale < 1);
 ar.stop(20000);
 assert.equal(ar.scale, 1);
 run(ar, 20, s => 30 * s * s, {start: 20000});
 assert.ok(ar.scale < 1);
 ar.setCeiling(1.5, 40000);
 assert.equal(ar.scale, 1);
});

test('the setting is on by default, a saved off stays off, and nonsense falls back to on', async () => {
 const {saveGraphics} = await import('../src/graphics.js');
 assert.equal(saveGraphics({}).autoResolution, true);
 assert.equal(saveGraphics({autoResolution: false}).autoResolution, false);
 assert.equal(saveGraphics({autoResolution: 'no'}).autoResolution, true);
});

test('a tester report says whether it was on and how sharp the picture was', async () => {
 const {diagnosticReport} = await import('../src/diagnostic.js');
 assert.match(diagnosticReport({app: {autoResolution: true, resolution: 72}}), /auto resolution\s+on, drawing at 72%/);
 assert.match(diagnosticReport({app: {autoResolution: false}}), /auto resolution\s+off/);
});
