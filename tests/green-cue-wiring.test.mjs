import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {greenCues, GREEN_READ} from '../src/graphics.js';

// A uniform can be declared, plumbed, exposed on a slider and reported back
// correctly while NOTHING IN THE SHADER READS IT. That is not hypothetical:
// `greenBandSoft` shipped that way, because removing a neighbouring block took
// the span between two anchors with it and deleted the one line that used it.
// The slider moved, the readout updated, the value reached the GPU, and the
// picture never changed. Only reading the shader source catches it.

const SRC = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
// Everything after the uniform declaration line is the shader body.
const DECL = /uniform float [^;]*;/;
const body = SRC.slice(SRC.search(DECL) + SRC.match(DECL)[0].length);

const CUES = ['greenLift', 'greenBend', 'greenBandSoft', 'greenSun', 'greenSlopeShade', 'greenGrain'];

test('every green cue uniform is actually read by the shader', () => {
 for (const name of CUES) {
  const uses = body.split(name).length - 1;
  assert.ok(uses >= 1,
   `${name} is declared and plumbed but never read in the shader body -- the slider would do nothing`);
 }
});

test('every green cue uniform is declared, or the shader will not compile', () => {
 const decl = SRC.match(DECL)[0];
 for (const name of CUES)
  assert.ok(decl.includes(name), `${name} is used but not declared in ${decl}`);
});

test('greenCues hands back exactly the uniforms the shader declares', () => {
 // A name that drifts on one side and not the other is silent: the renderer
 // writes a key nothing reads, and the uniform keeps its default forever.
 const produced = Object.keys(greenCues({}));
 assert.deepEqual(produced.slice().sort(), CUES.slice().sort(),
  `greenCues produces ${produced.join(', ')}`);
});

test('the shipped defaults are the ones the owner set on screen', () => {
 // These were picked by eye on a real green, not derived from the measurements,
 // and that is the right order of authority. Pinned so a later retune is a
 // deliberate act rather than a drift.
 assert.deepEqual(GREEN_READ,
  {definition: 35, bands: 10, sun: 20, slopeShade: 70, grain: 0});
 const u = greenCues({});
 assert.ok(u.greenLift > 1 && u.greenLift < 2, 'definition sits a third of the way up');
 assert.ok(u.greenBandSoft < .15, 'bands are nearly off');
 assert.ok(u.greenSun > 0 && u.greenSun < 1, 'the sunlight cue is present but low');
 assert.ok(u.greenSlopeShade > 1, 'slope darkening is past what used to be full strength');
 assert.equal(u.greenGrain, 0, 'grain is off');
});

test('half the slope slider is what used to be all of it', () => {
 // The owner asked for the old full strength to sit at 50, leaving room above
 // it. Anything else here means a saved setting quietly changes meaning.
 assert.equal(greenCues({greenSlopeShade: 50}).greenSlopeShade, 1);
 assert.equal(greenCues({greenSlopeShade: 100}).greenSlopeShade, 2);
 assert.equal(greenCues({greenSlopeShade: 0}).greenSlopeShade, 0);
});

test('every cue can be turned fully off, and that is the old look', () => {
 const off = greenCues({greenDefinition: 0, greenBands: 100, greenSun: 0,
  greenSlopeShade: 0, greenGrain: 0});
 assert.equal(off.greenLift, 0);
 assert.equal(off.greenBend, 1);
 assert.equal(off.greenBandSoft, 1);
 assert.equal(off.greenSun, 0);
});
