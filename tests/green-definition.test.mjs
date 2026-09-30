import test from 'node:test';
import assert from 'node:assert/strict';
import {greenCues, GREEN_READ_GEN, loadGraphics, saveGraphics} from '../src/graphics.js';

// The slider exists because a green is the flattest ground on the course and
// every shading cue is proportional to slope. These pin the two things that
// matter: the default lands on the setting that was actually chosen from the
// comparison, and zero gives back exactly the old look.

test('70 still means what it meant in the comparison', () => {
 // The report's "strong" was lift 3.2, bend 3.5, bands at 60%, and that is what
 // 70 and 60 on these sliders produce. The DEFAULT has since moved twice, up to
 // 100 and back down to 35, because the owner tuned it on a real green -- but
 // the MAPPING must not drift, or a saved setting quietly changes meaning
 // between versions. Where the default sits is pinned in green-cue-wiring.
 const u = greenCues({greenDefinition: 70, greenBands: 60});
 assert.ok(Math.abs(u.greenLift - 3.2) < .01, `lift ${u.greenLift}`);
 assert.ok(Math.abs(u.greenBend - 3.5) < .01, `bend ${u.greenBend}`);
 assert.ok(Math.abs(u.greenBandSoft - .6) < .001, `bands ${u.greenBandSoft}`);
});

test('zero definition and full bands are the neutral values', () => {
 // No extra tilt on the shading normal, bands bending by their original amount,
 // bands at full contrast. (The grass sheen and the green's base tone are
 // separate from these two sliders; the sheen has its own switch.)
 const u = greenCues({greenDefinition: 0, greenBands: 100});
 assert.equal(u.greenLift, 0);
 assert.equal(u.greenBend, 1);
 assert.equal(u.greenBandSoft, 1);
});

test('definition raises both cues together and stays monotonic', () => {
 let lift = -1, bend = -1;
 for (let v = 0; v <= 100; v += 5) {
  const u = greenCues({greenDefinition: v});
  assert.ok(u.greenLift >= lift, `lift went backwards at ${v}%`);
  assert.ok(u.greenBend >= bend, `bend went backwards at ${v}%`);
  lift = u.greenLift; bend = u.greenBend;
 }
 assert.ok(lift > 4 && bend > 4, `at 100% the cues should exceed the default (${lift}, ${bend})`);
});

test('nonsense settings fall back instead of reaching the shader', () => {
 // These are persisted to localStorage, so anything can come back: an old save
 // without the keys, a hand-edited value, a string.
 for (const bad of [undefined, null, NaN, Infinity, 'lots', {}, -40, 900]) {
  const u = greenCues({greenDefinition: bad, greenBands: bad});
  assert.ok(Number.isFinite(u.greenLift) && u.greenLift >= 0 && u.greenLift <= 5,
   `greenLift ${u.greenLift} from ${String(bad)}`);
  assert.ok(u.greenBandSoft >= 0 && u.greenBandSoft <= 1,
   `greenBandSoft ${u.greenBandSoft} from ${String(bad)}`);
 }
});

test('a saved graphics record carries the two settings', () => {
 const saved = saveGraphics({...loadGraphics(), greenDefinition: 35, greenBands: 80});
 assert.equal(saved.greenDefinition, 35);
 assert.equal(saved.greenBands, 80);
 // And out-of-range values are clamped on the way in, not on the way out.
 // The record has to carry the current greenReadGen or the value is discarded
 // for the default, which is the whole point of the stamp.
 assert.equal(saveGraphics({greenReadGen: GREEN_READ_GEN, greenDefinition: 500}).greenDefinition, 100);
 // A record from before the stamp takes today's defaults instead of its own.
 assert.equal(saveGraphics({greenDefinition: 500}).greenDefinition, loadGraphics().greenDefinition);
});
