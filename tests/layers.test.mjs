// Surfaces in layers (src/builder/layers.js): each surface its own mask, the
// topmost shown, in the game's own order; hidden layers left out of the view
// only; a composite split back into layers; a mask tidied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayers, LAYER_ORDER, tidyMask, layersFor} from '../src/builder/layers.js';
import {BIOMES} from '../src/biomes.js';
import {PALETTE} from '../src/builder/trace-edit.js';

test('the order is the game\'s: water over sand over green over tee over path over fairway over semi over ground', () => {
 assert.deepEqual(LAYER_ORDER.slice(0, 7), ['water', 'sand', 'green', 'tee', 'path', 'fairway', 'semi']);
 assert.ok(LAYER_ORDER.includes('heather'));
});

test('the topmost layer shows; a lower one runs on under it; hiding shows what is under', () => {
 const L = createLayers(10, 1, PALETTE), fair = L.mask('fairway', true), sand = L.mask('sand', true);
 fair.fill(1); sand[4] = sand[5] = 1; L.recompose();
 assert.equal(L.kindAt(4), 'sand'); assert.equal(L.kindAt(3), 'fairway');
 L.setHidden('sand', true);
 assert.equal(PALETTE[L.view[4]], 'fairway', 'the view shows the fairway under a hidden bunker');
 assert.equal(L.kindAt(4), 'sand', 'the course still has the bunker');
 sand.fill(0); L.recompose();
 assert.equal(L.kindAt(4), 'fairway', 'the fairway was there all along');
 assert.deepEqual(L.present(), ['fairway']);
});

test('a composite comes apart into its layers', () => {
 const L = createLayers(4, 1, PALETTE).fromCodes(Uint8Array.from([0, PALETTE.indexOf('green'), PALETTE.indexOf('heather'), 0]));
 assert.deepEqual(L.present(), ['green', 'heather']);
 assert.equal(L.kindAt(2), 'heather');
});

test('a mask is tidied: small patches go, small holes fill', () => {
 const m = new Uint8Array(100); for (let k = 0; k < 100; k++) m[k] = (k % 10 > 1 && k % 10 < 8 && k > 20 && k < 80) ? 1 : 0;
 m[44] = 0; m[91] = 1;
 tidyMask(m, 10, 10, 3, 3);
 assert.equal(m[44], 1, 'the hole is filled'); assert.equal(m[91], 0, 'the speck is gone');
});

test('a landscape offers every turf layer, its own ground types, and rough last', () => {
 const mountain = layersFor(BIOMES.rockies), links = layersFor(BIOMES.links);
 for (const L of [mountain, links]) { assert.deepEqual(L.slice(0, 7), ['water', 'sand', 'green', 'tee', 'path', 'fairway', 'semi']); assert.equal(L.at(-1), 'rough'); }
 assert.ok(mountain.includes('rock') && mountain.includes('scree') && !mountain.includes('heather'), mountain.join());
 assert.ok(links.includes('native') && links.includes('heather') && !links.includes('rock'), links.join());
 assert.ok(layersFor(BIOMES.puget).includes('pinestraw'), 'what falls under its trees');
 assert.deepEqual(layersFor(null), [...LAYER_ORDER.slice(0, 7), 'rough']);
});
