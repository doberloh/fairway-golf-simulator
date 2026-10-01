import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIERS, saveGraphics} from '../src/graphics.js';
import {saveDaylight} from '../src/daylight.js';

// THE TEXTURE-UNIT BUDGET THAT DECIDES HOW MANY FLOODLIGHTS MAY CAST SHADOWS.
// WebGL promises sixteen texture units to a fragment shader, and the ground's is
// the hungriest in the scene. Over sixteen, its program fails to link, does not
// draw, and the ground disappears at night with the lights on -- which shipped
// once. Measured on an RTX 4090 (RESEARCH.md, *Floodlight shadows*): Low and
// Medium link six casting lamps and fail at seven; High and Ultra four, and fail
// at five. Each tier keeps one unit spare. So adding a texture to the ground
// shader fails HERE, by name, rather than on somebody's night course.
const LIMIT = 16, SPARE = 1;
const groundSamplers = () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 let n = 0;
 for (const m of src.matchAll(/uniform\s+sampler2D\s+([^;]+);/g)) n += m[1].split(',').length;
 return n;
};
// Also in every lit fragment of the ground: the mist's water field (mist.js),
// the toon colour ramp, and the sun's (or the moon's) shadow maps.
const OTHERS = 2;

test('the ground shader declares the samplers this budget was measured with', () => {
 // owners, cover, holes, curves, outer, banks, streamSegments. If this number
 // changes, re-measure (bench/shots/flood-samplers.mjs) before changing it.
 assert.equal(groundSamplers(), 7);
});

test('no tier asks for more casting floodlights than its texture units allow, with one spare', () => {
 for (const [name, tier] of Object.entries(TIERS)) {
  const sun = Math.max(1, tier.cascades || 0);
  const used = groundSamplers() + OTHERS + sun + (tier.floodShadows ?? 0);
  assert.ok(used <= LIMIT - SPARE, `${name}: ${used} units of ${LIMIT}, leaving none spare`);
  assert.ok((tier.floodShadows ?? 0) > 0, `${name} casts no floodlight shadows at all`);
 }
});

test('floodlight shadows are on unless switched off', () => {
 assert.equal(saveGraphics({}).floodlightShadows, true);
 assert.equal(saveGraphics({floodlightShadows: false}).floodlightShadows, false);
});

test('the floodlight and glow ball strengths default to 100% and stay between 0 and 200%', () => {
 const d = saveDaylight({});
 assert.equal(d.floodStrength, 1);
 assert.equal(d.glowStrength, 1);
 assert.equal(saveDaylight({floodStrength: 1.5, glowStrength: .4}).floodStrength, 1.5);
 assert.equal(saveDaylight({glowStrength: .4}).glowStrength, .4);
 assert.equal(saveDaylight({floodStrength: 7}).floodStrength, 2);
 assert.equal(saveDaylight({glowStrength: -1}).glowStrength, 0);
 assert.equal(saveDaylight({floodStrength: 'bright'}).floodStrength, 1);
});
