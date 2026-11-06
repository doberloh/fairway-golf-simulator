// What the preview shows for each tool (src/builder/preview-items.js): real
// models the game has, on every landscape.
import test from 'node:test';
import assert from 'node:assert/strict';
import {previewOf} from '../src/builder/preview-items.js';
import {coverOptions, COVER_RANGE} from '../src/builder/cover.js';
import {layersFor} from '../src/builder/layers.js';
import {familyModels} from '../src/mesh-assets.js';
import {BIOMES} from '../src/biomes.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

const pieces = s => s?.pieces ?? [];
const haveModels = (s, what) => { for (const p of pieces(s)) assert.ok(familyModels(p.family).length, `${what}: no model for ${p.family}`); };

test('every tool on every landscape shows models that exist', () => {
 for (const k of BIOME_KEYS) {
  const bio = BIOMES[k];
  for (const surface of layersFor(bio)) { const s = previewOf({kind: 'surface', surface}, bio); assert.ok(s?.title, `${k} ${surface}`); assert.match(s.ground, /^#/); haveModels(s, `${k} ${surface}`); }
  for (const kind of ['tree', 'house', 'pond', 'creek', 'bunker']) { const s = previewOf({kind}, bio); assert.ok(s?.title, `${k} ${kind}`); haveModels(s, `${k} ${kind}`); }
  for (const c of coverOptions(bio)) { const s = previewOf({kind: 'cover', cover: c.key, min: .5, max: 2}, bio); assert.equal(s.pieces.length, 3); haveModels(s, `${k} ${c.key}`); }
 }
});

test('trees are the landscape\'s own, and a house is a house', () => {
 const s = previewOf({kind: 'tree'}, BIOMES.winecountry);
 assert.ok(s.pieces.length >= 2); assert.ok(s.golfer, 'a golfer to measure by');
 assert.ok(s.pieces.every(p => p.size >= 5));
 assert.equal(previewOf({kind: 'house'}, BIOMES.puget).pieces[0].family, 'house');
});

test('the cover preview shows the smallest and largest it will paint', () => {
 const bio = BIOMES.alaska, s = previewOf({kind: 'cover', cover: 'rocks', min: .4, max: 3}, bio);
 assert.deepEqual(s.pieces.map(p => p.size), [.4, 1.7, 3]);
 assert.ok(s.pieces.every(p => p.by === 'across' && p.family === 'boulderangular'));
 assert.match(s.caption, /0\.4 m to 3\.0 m/);
 const again = previewOf({kind: 'cover', cover: 'rocks', min: .4, max: 5}, bio);
 assert.equal(again.pieces[2].size, 5, 'the preview follows the slider');
 for (const r of Object.values(COVER_RANGE)) assert.ok(r.high > r.low);
});

test('no tool, no preview', () => {
 assert.equal(previewOf(null, BIOMES.puget), null);
 assert.equal(previewOf({kind: 'navigate'}, BIOMES.puget), null);
 assert.equal(previewOf({kind: 'cover', cover: 'nothing', min: 1, max: 2}, BIOMES.puget), null);
});
