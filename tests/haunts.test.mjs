import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateWorld} from '../src/course.js';
import {addHaunts} from '../src/haunts.js';
import {solarState, PRESETS} from '../src/daylight.js';
import {BIOMES} from '../src/biomes.js';

// Haunted Hollow's night: bats, will-o-the-wisps and a harvest moon. All
// scenery, so these check what the owner would see go wrong -- creatures out
// in daylight, none after dark, a moon that has not risen by Dusk.

const world = generateWorld({seed: 'NIGHT', biome: 'haunted', holes: 9});
const counts = view => {
 const c = {};
 view.group.traverse(o => { if (o.isInstancedMesh && ['Bats', 'Wisps'].includes(o.name)) c[o.name] = (c[o.name] || 0) + o.count; });
 return c;
};

test('bats and wisps stay in by day and come out after dark', () => {
 const view = {world, group: new T.Group()};
 const haunts = addHaunts(view);
 haunts.update(.016, 5, {lamplight: 0}, null);
 assert.deepEqual(counts(view), {Bats: 0, Wisps: 0}, 'nothing out in daylight');
 haunts.update(.016, 6, {lamplight: 1}, null);
 const night = counts(view);
 // Three meshes a bat (body and two wings), two a wisp (core and glow).
 assert.ok(night.Bats >= 3 * 6 * 9 * .8, `only ${night.Bats / 3} bats on nine holes`);
 assert.ok(night.Wisps >= 2 * 3 * 9 * .8, `only ${night.Wisps / 2} wisps on nine holes`);
});

test('the night creatures keep out of the instance cull', () => {
 // The cull rewrites instance buffers from where things were built; a bat
 // that moves every frame would be put back where it started.
 const view = {world, group: new T.Group()};
 addHaunts(view);
 view.group.traverse(o => {
  if (o.isInstancedMesh && ['Bats', 'Wisps'].includes(o.name)) assert.ok(o.userData.noCull, `${o.name} would be culled`);
 });
});

test('the harvest moon is up by Dusk and down at midday', () => {
 const sun = BIOMES.haunted.sun, hour = name => PRESETS.find(([n]) => n === name)[1];
 assert.ok(solarState(hour('Dusk'), sun).moonDiscElevation > 5, 'the moon is low in the sky by Dusk');
 assert.ok(solarState(hour('Golden hour'), sun).moonDiscElevation > 0, 'and rising by Golden hour');
 assert.ok(solarState(hour('Midday'), sun).moonDiscElevation < 0, 'and below the horizon at midday');
});

test('only a biome that asks for a moon draws one', () => {
 for (const [key, b] of Object.entries(BIOMES)) assert.equal(!!b.moon, key === 'haunted', `${key} moon`);
});
