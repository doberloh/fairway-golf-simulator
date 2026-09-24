import test from 'node:test';
import assert from 'node:assert/strict';
import {greenCues, GREEN_READ, loadGraphics, saveGraphics} from '../src/graphics.js';

// The slider exists because a green is the flattest ground on the course and
// every shading cue is proportional to slope. These pin the two things that
// matter: the default lands on the setting that was actually chosen from the
// comparison, and zero gives back exactly the old look.

test('the default lands on the setting chosen from the comparison', () => {
 // "strong" in the report: lift 3.2, bend 3.5, bands at 60%. If the mapping is
 // ever retuned, this is the test that says the default moved with it.
 const u = greenCues({});
 assert.ok(Math.abs(u.greenLift - 3.2) < .01, `lift ${u.greenLift}`);
 assert.ok(Math.abs(u.greenBend - 3.5) < .01, `bend ${u.greenBend}`);
 assert.ok(Math.abs(u.greenBandSoft - .6) < .001, `bands ${u.greenBandSoft}`);
 assert.equal(GREEN_READ.definition, 70);
});

test('zero is exactly the look greens had before this existed', () => {
 // The neutral values: no extra tilt on the shading normal, bands bending by
 // their original amount, bands at full contrast. Anything else here would mean
 // a player who turns it off does not get the old game back.
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
 assert.equal(saveGraphics({greenDefinition: 500}).greenDefinition, 100);
});
