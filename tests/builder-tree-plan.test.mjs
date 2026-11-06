// The trees placed for the player (src/builder/tree-plan.js, built-world.js
// `treeAt`; the owner, 5 November 2026): the LIDAR's sizes can be turned off and
// the species chosen, live; a tree placed by hand stays as it was; nothing stored
// changes; and a course with no plan is the course it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import {treeAt, speciesFor, TREE_HAND} from '../src/built-world.js';
import {validateDoc} from '../src/course-doc.js';
import {withSpecies, withSizes} from '../src/builder/tree-plan.js';
import {changeMark, sameMark} from '../src/builder/game-look.js';
import {biomeOf} from '../src/biomes.js';
import {tallHeight} from '../src/species.js';

const bio = biomeOf('palms'), at = (plan, i, role = 2, h = 9, stored = undefined) => treeAt(bio, plan, false, stored, role, h, 3, .3, i * .7 - 900, i * .3 + 40);

test('with no plan a surveyed tree is what it was', () => {
 const t = at(null, 5);
 assert.equal(t.h, 9); assert.equal(t.crown, 3); assert.equal(t.trunk, .3);
 assert.equal(t.kind, speciesFor(bio, 'broadleaf', 9, 5 * .7 - 900, 5 * .3 + 40));
});

test('sizes off: a tree keeps its place and takes the landscape\'s size for its species', () => {
 const plan = withSizes(null, false), hs = new Set();
 assert.deepEqual(plan, {sizes: 'landscape'});
 for (let i = 0; i < 400; i++) {
  const t = at(plan, i), plant = bio.plants.find(p => p[0] === t.kind) ?? [];
  hs.add(Math.round(t.h));
  assert.ok(t.h >= tallHeight(bio, t.kind, 0, plant[2] ?? 1) - .01 && t.h <= tallHeight(bio, t.kind, 1, plant[2] ?? 1) + .01, `${t.kind} ${t.h}`);
  assert.deepEqual(t, at(plan, i), 'the same tree every time');
 }
 assert.ok(hs.size > 5, 'a spread of sizes, not one default');
 // A 40 m survey reading no longer steers the species or its size.
 assert.ok(at(plan, 3, 2, 40).h < 30);
 assert.equal(withSizes(plan, true), null, 'back on, no plan left');
});

test('the species chosen are the only ones placed, in their shares; the last cannot go', () => {
 let plan = null;
 for (const k of ['tamarisk', 'smoketree', 'desertwillow', 'aleppopine']) plan = withSpecies(plan, bio, k, false);
 const kinds = new Set(Array.from({length: 600}, (_, i) => at(plan, i).kind));
 assert.deepEqual([...kinds].sort(), ['datepalm', 'fanpalm']);
 const last = withSpecies(withSpecies(plan, bio, 'datepalm', false), bio, 'fanpalm', false);
 assert.deepEqual(last.species, ['fanpalm'], 'one always stays');
 assert.equal(withSpecies(last, bio, 'datepalm', true).species.length, 2);
 assert.ok(at({species: ['redwood']}, 2).kind, 'a species this landscape lacks falls back to all of them');
});

test('a tree placed by hand, or with a species, stays as it was', () => {
 const plan = {sizes: 'landscape', species: ['fanpalm']};
 assert.equal(at(plan, 7, 2 | TREE_HAND, 22).h, 22);
 const named = at(plan, 7, 2, 11, 'tamarisk');
 assert.equal(named.kind, 'tamarisk'); assert.equal(named.h, 11);
 assert.equal(at(plan, 7, 3, 1).h, 1, 'a bush is no tree');
});

test('the plan is saved with the course; a course without one has none; Game view rebuilds for it', () => {
 const doc = {type: 'built', name: 'Plan', landscape: 'palms', halfX: 50, halfZ: 50, land: {x0: -50, z0: -50, cell: 10, nx: 11, nz: 11, heights: new Float32Array(121)}, patches: [], surfaces: {}, water: [], creeks: [],
  holes: Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: 0, z: 0, set: 'back'}], green: {x: 9, z: 9}, line: [[0, 0], [9, 9]]})), trees: new Float32Array(0), treeKinds: [], homes: [], credits: []};
 assert.equal('treePlan' in validateDoc(doc), false);
 assert.deepEqual(validateDoc({...doc, treePlan: {sizes: 'landscape', species: ['fanpalm']}}).treePlan, {sizes: 'landscape', species: ['fanpalm']});
 const s = {undo: [], redo: [], treeScale: 1, landscape: 'palms', name: 'x', treePlan: null};
 assert.equal(sameMark(changeMark(s), changeMark({...s, treePlan: {sizes: 'landscape'}})), false);
});
