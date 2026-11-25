// Surfaces in layers (src/builder/layers.js): each surface its own mask, the
// topmost shown, in the game's own order; hidden layers left out of the view
// only; a composite split back into layers; a mask tidied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYER_ORDER, layersFor} from '../src/builder/layers.js';
import {BIOMES} from '../src/biomes.js';
import {PALETTE, createTrace} from '../src/builder/trace-edit.js';

test('the order is the game\'s: water over sand over green over fringe over tee over path over fairway over semi over ground', () => {
 assert.deepEqual(LAYER_ORDER.slice(0, 8), ['water', 'sand', 'green', 'fringe', 'tee', 'path', 'fairway', 'semi']);
 assert.ok(LAYER_ORDER.includes('heather'));
});

// A draft keeps OpenStreetMap's cells as palette codes (draft.js), so the
// fringe (24 November 2026) went on the end and no older code moved.
test('the fringe is the palette\'s last code', () => {
 assert.equal(PALETTE.at(-1), 'fringe');
 assert.deepEqual(PALETTE.slice(0, 8), ['rough', 'fairway', 'semi', 'tee', 'green', 'sand', 'water', 'path']);
});

// The layers as outlines since 24 November 2026 (trace-edit.js on shapes.js;
// a composite turned into layers, and tidying, are tested there).
test('the topmost layer shows; a lower one runs on under it; hiding shows what is under', () => {
 const t = createTrace({nx: 21, nz: 21, cell: 1, halfX: 10, halfZ: 10});
 t.fill([[[-10, -3], [10, -3], [10, 3], [-10, 3]]], 'fairway'); t.paint({x: 0, z: 0, radius: 1.5, kind: 'sand'});
 assert.equal(t.kindAt(0, 0), 'sand'); assert.equal(t.kindAt(5, 0), 'fairway');
 t.setHidden('sand', true);
 assert.equal(t.kindAt(0, 0, true), 'fairway', 'the view shows the fairway under a hidden bunker');
 assert.equal(t.kindAt(0, 0), 'sand', 'the course still has the bunker');
 t.erase({x: 0, z: 0, radius: 2, kind: 'sand'});
 assert.equal(t.kindAt(0, 0), 'fairway', 'the fairway was there all along');
 assert.deepEqual(t.layersPresent(), ['fairway']);
});

test('a landscape offers every turf layer, its own ground types, and rough last', () => {
 const mountain = layersFor(BIOMES.mountains), links = layersFor(BIOMES.seaside);
 for (const L of [mountain, links]) { assert.deepEqual(L.slice(0, 8), ['water', 'sand', 'green', 'fringe', 'tee', 'path', 'fairway', 'semi']); assert.equal(L.at(-1), 'rough'); }
 assert.ok(mountain.includes('rock') && mountain.includes('scree') && !mountain.includes('heather'), mountain.join());
 assert.ok(links.includes('native') && links.includes('heather') && !links.includes('rock'), links.join());
 assert.ok(layersFor(BIOMES.pacnw).includes('pinestraw'), 'what falls under its trees');
 // Road in every landscape (the US landscapes goal, PLAN 4: roads anywhere).
 assert.deepEqual(layersFor(null), [...LAYER_ORDER.slice(0, 8), 'road', 'rough']);
 assert.ok(mountain.includes('road') && links.includes('road'));
});
