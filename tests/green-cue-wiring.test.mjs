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

test('the shipped defaults turn on the cues that were chosen, and only those', () => {
 const u = greenCues({});
 assert.ok(u.greenLift > 3 && u.greenBend > 3, 'definition should be on by default');
 assert.ok(u.greenBandSoft < 1, 'bands should be softened by default');
 assert.ok(u.greenSun > 2, 'the sunlight cue should be on by default');
 // The two that measured no benefit stay off until someone moves them.
 assert.equal(u.greenSlopeShade, 0);
 assert.equal(u.greenGrain, 0);
 assert.equal(GREEN_READ.slopeShade, 0);
 assert.equal(GREEN_READ.grain, 0);
});

test('every cue can be turned fully off, and that is the old look', () => {
 const off = greenCues({greenDefinition: 0, greenBands: 100, greenSun: 0,
  greenSlopeShade: 0, greenGrain: 0});
 assert.equal(off.greenLift, 0);
 assert.equal(off.greenBend, 1);
 assert.equal(off.greenBandSoft, 1);
 assert.equal(off.greenSun, 0);
});
