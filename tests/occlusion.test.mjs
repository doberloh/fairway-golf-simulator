import test from 'node:test';
import assert from 'node:assert/strict';
import {occlusionAtlas} from '../src/occlusion.js';
import {generateWorld} from '../src/course.js';
import {ownerAtlasSize} from '../src/owner-atlas.js';

// The bake the ground shader reads for soft shade under trees and rocks (U1).
const at = (occ, Sx, Sz, ex, ez, x, z) => occ[Math.floor((z / ez + 1) * .5 * Sz) * Sx + Math.floor((x / ex + 1) * .5 * Sx)];

test('open ground is open, and the foot of a trunk is shaded more than the edge of its crown', () => {
 const ex = 100, ez = 100, Sx = 160, Sz = 160;
 const bare = occlusionAtlas({trees: [], rocks: []}, ex, ez, Sx, Sz);
 assert.ok(bare.every(v => v === 0));
 const occ = occlusionAtlas({trees: [{x: 0, z: 0, h: 40, r: 5, kind: 'pine'}], rocks: []}, ex, ez, Sx, Sz);
 const foot = at(occ, Sx, Sz, ex, ez, 1.2, 0), crown = at(occ, Sx, Sz, ex, ez, 3.5, 0), far = at(occ, Sx, Sz, ex, ez, 40, 0);
 assert.ok(foot > crown && crown > 0, `foot ${foot} crown ${crown}`);
 assert.equal(far, 0);
});

test('overlapping crowns deepen the shade without ever reaching full dark', () => {
 const ex = 60, ez = 60, Sx = 96, Sz = 96;
 const trees = [];
 for (let i = 0; i < 40; i++) trees.push({x: (i % 7) * 3 - 9, z: Math.floor(i / 7) * 3 - 9, h: 30, r: 5, kind: 'pine'});
 const forest = occlusionAtlas({trees, rocks: []}, ex, ez, Sx, Sz);
 const lone = occlusionAtlas({trees: [trees[0]], rocks: []}, ex, ez, Sx, Sz);
 const k = Math.floor(.5 * Sz) * Sx + Math.floor(.5 * Sx);
 assert.ok(forest[k] > lone[Math.floor((trees[0].z / ez + 1) * .5 * Sz) * Sx + Math.floor((trees[0].x / ex + 1) * .5 * Sx) + 3]);
 assert.ok(Math.max(...forest) < 1);
});

test('a real course bakes without error and shades somewhere, on the ownership atlas grid', () => {
 const w = generateWorld({seed: 'OCCLUSION', biome: 'pnw', holes: 9});
 const ex = w.groundGrid.halfX, ez = w.groundGrid.halfZ, {Sx, Sz} = ownerAtlasSize(ex, ez);
 const occ = occlusionAtlas(w, ex, ez, Sx, Sz);
 assert.equal(occ.length, Sx * Sz);
 const shaded = occ.filter(v => v > .1).length / occ.length;
 assert.ok(shaded > .005 && shaded < .8, `shaded share ${shaded}`);
 assert.ok(occ.every(v => v >= 0 && v < 1));
});

test('a house shades the ground at its walls, turned with it, and not the forest floor', () => {
 const ex = 60, ez = 60, Sx = 240, Sz = 240;
 // 12 m wide along its own x, 8 m deep, turned a quarter: its long walls run along world z.
 const house = {x: 0, z: 0, width: 12, depth: 8, rotation: Math.PI / 2};
 const occ = occlusionAtlas({trees: [], rocks: [], homes: [house]}, ex, ez, Sx, Sz);
 const wall = at(occ, Sx, Sz, ex, ez, 4.6, 0), end = at(occ, Sx, Sz, ex, ez, 0, 6.6);
 const out = at(occ, Sx, Sz, ex, ez, 7.5, 0), far = at(occ, Sx, Sz, ex, ez, 20, 0);
 assert.ok(wall > .25, `just outside the long wall ${wall}`);
 assert.ok(end > .25, `just outside the end wall ${end}`);
 assert.ok(wall > out && out >= 0, `fades out: ${wall} then ${out}`);
 assert.equal(far, 0);
 assert.ok(occ.plants.every(v => v === 0), 'the forest floor never gathers at a wall');
});
