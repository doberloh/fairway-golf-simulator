import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {greenCues, GREEN_READ, GROUND_CUES, loadGraphics} from '../src/graphics.js';

// A uniform can be declared, plumbed, exposed on a slider and reported back
// correctly while NOTHING IN THE SHADER READS IT. That is not hypothetical:
// `greenBandSoft` shipped that way, because removing a neighbouring block took
// the span between two anchors with it and deleted the one line that used it.
// The slider moved, the readout updated, the value reached the GPU, and the
// picture never changed. Only reading the shader source catches it.

const SRC = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
// Everything after the uniform declaration line is the shader body.
const DECL = /uniform float cueRelief[^;]*;/;
const body = SRC.slice(SRC.search(DECL) + SRC.match(DECL)[0].length);

const GREEN = ['greenLift', 'greenBend', 'greenBandSoft'];
// The switches in "Reading the ground" and "The look of the course".
const CUES = ['cueRelief', 'cueSlope', 'cueContours', 'cueStripes', 'cueSheen', 'cuePatches', 'cueShade'];

test('every ground cue uniform is actually read by the shader', () => {
 for (const name of [...GREEN, ...CUES]) {
  const uses = body.split(name).length - 1;
  assert.ok(uses >= 1,
   `${name} is declared and plumbed but never read in the shader body -- the setting would do nothing`);
 }
});

test('every ground cue uniform is declared, or the shader will not compile', () => {
 const decl = SRC.match(DECL)[0];
 for (const name of [...GREEN, ...CUES])
  assert.ok(decl.includes(name), `${name} is used but not declared in ${decl}`);
});

test('greenCues hands back exactly the uniforms the shader declares', () => {
 // A name that drifts on one side and not the other is silent: the renderer
 // writes a key nothing reads, and the uniform keeps its default forever.
 const produced = Object.keys(greenCues({}));
 assert.deepEqual(produced.slice().sort(), GREEN.slice().sort(),
  `greenCues produces ${produced.join(', ')}`);
});

test('the three removed green settings are gone from the shader and the saved record', () => {
 // Sunlight on contours, slope darkening and band grain were removed on 29
 // September because measured at noon they moved a green by 0.2, 1.9 and 0.9 of
 // 255 -- nothing, or an even darkening that read as dirt. A saved record from
 // before still carries their keys; they must not survive a load.
 for (const gone of ['greenSun', 'greenSlopeShade', 'greenGrain'])
  assert.ok(!SRC.includes(gone), `${gone} is still in ground.js`);
 const g = loadGraphics();
 for (const gone of ['greenSun', 'greenSlopeShade', 'greenGrain'])
  assert.ok(!(gone in g), `${gone} survived into a loaded graphics record`);
});

test('the shipped defaults', () => {
 assert.deepEqual(GREEN_READ, {definition: 50, bands: 40});
 assert.equal(GROUND_CUES.sheen, true, 'grass sheen is on by default');
 assert.equal(GROUND_CUES.contours, false, 'contour lines stay an opt-in map');
 const u = greenCues({});
 assert.ok(u.greenLift > 2 && u.greenLift < 2.5, 'definition sits halfway up');
 assert.ok(Math.abs(u.greenBandSoft - .4) < 1e-9, 'bands at 40%');
});

test('every cue can be turned fully off, and that is the plain green', () => {
 const off = greenCues({greenDefinition: 0, greenBands: 100});
 assert.equal(off.greenLift, 0);
 assert.equal(off.greenBend, 1);
 assert.equal(off.greenBandSoft, 1);
});

test('slope tinting only dries turf that is green', () => {
 // The fix for desert and links: drying is scaled by how green the turf is, so
 // turf that is already straw has nothing to lose and does not go orange.
 assert.ok(/float green=clamp\(\(turf\.g-max\(turf\.r,turf\.b\)\)/.test(body), 'greenness gate missing');
 assert.ok(/dry\*dryGain\*green\*cueSlope/.test(body), 'slope tint is not scaled by greenness');
});
