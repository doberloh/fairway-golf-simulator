// The six tee sets (src/tees.js; the owner, 10 November 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {TEE_ORDER, teeFor, teeOn, setsForCount, setsFromTag, courseSets, backTee, colourOf, inOrder} from '../src/tees.js';

test('the six sets in the owner\'s order, longest first', () => {
 assert.deepEqual(TEE_ORDER, ['black', 'blue', 'white', 'silver', 'gold', 'red']);
 assert.deepEqual(inOrder(['red', 'blue', 'red', 'teebox', 'black']), ['black', 'blue', 'red']);
});

test('a golfer plays their own set, else the nearest, a tie going to the longer', () => {
 assert.equal(teeFor('white', ['blue', 'white', 'red']), 'white');
 assert.equal(teeFor('black', ['blue', 'white', 'red']), 'blue');
 assert.equal(teeFor('gold', ['blue', 'white', 'red']), 'red');
 assert.equal(teeFor('silver', ['white', 'gold']), 'white', 'silver sits between white and gold: the longer');
 assert.equal(teeFor('silver', ['blue', 'white', 'red']), 'white');
 assert.equal(teeFor('nonsense', ['white', 'red']), 'white');
 assert.equal(teeFor('blue', []), null);
 assert.deepEqual(teeOn({blue: {x: 1}, red: {x: 2}}, 'white'), {x: 1});
});

test('a course of n sets that the map does not name', () => {
 assert.deepEqual(setsForCount(1), ['blue', 'white', 'red']);
 assert.deepEqual(setsForCount(3), ['blue', 'white', 'red']);
 assert.deepEqual(setsForCount(4), ['black', 'blue', 'white', 'red']);
 assert.deepEqual(setsForCount(5), ['black', 'blue', 'white', 'gold', 'red']);
 assert.deepEqual(setsForCount(9), TEE_ORDER);
});

test('OpenStreetMap tee tags read as sets', () => {
 assert.deepEqual(setsFromTag('blue;white;gold;red'), ['blue', 'white', 'gold', 'red'], 'Worthington\'s');
 assert.deepEqual(setsFromTag('Yellow'), ['gold']);
 assert.deepEqual(setsFromTag('championship'), ['black']);
 assert.deepEqual(setsFromTag('teebox'), []);
 assert.deepEqual(setsFromTag('3'), []);
 assert.deepEqual(setsFromTag(undefined), []);
 assert.deepEqual(setsFromTag('Silver tees'), ['silver']);
});

test('a built course\'s sets, and its back tee, old marks and new', () => {
 assert.equal(courseSets([{tees: [{set: 'back'}, {set: 'front'}]}]), null, 'a course from before the six names none');
 assert.deepEqual(courseSets([{tees: [{set: 'red'}, {set: 'black'}]}, {tees: [{set: 'gold'}]}]), ['black', 'gold', 'red']);
 assert.equal(colourOf('middle'), 'white');
 assert.equal(colourOf('silver'), 'silver');
 assert.equal(backTee([{set: 'red', x: 1}, {set: 'blue', x: 2}]).x, 2);
 assert.equal(backTee([{set: 'front', x: 1}, {set: 'back', x: 2}]).x, 2);
 assert.equal(backTee([{x: 7}]).x, 7);
});

test('a built hole plays each of the course\'s sets from its tee, or the nearest it has; an old hole as it always did', async () => {
 const {builtLine} = await import('../src/built-world.js');
 const rec = {tees: [{x: 0, z: 400, set: 'black'}, {x: 0, z: 340, set: 'red'}], green: {x: 0, z: 0}, line: [[0, 400], [0, 0]]};
 const L = builtLine(rec, ['black', 'blue', 'white', 'red']);
 assert.deepEqual(L.names, ['black', 'blue', 'white', 'red']);
 assert.deepEqual(L.sets.map(t => t.set), ['black', 'black', 'black', 'red'], 'blue and white from black, the nearer of the two it has');
 assert.ok(L.yards.black > L.yards.red + 60);
 // From before the six: back and front, spread over blue, white and red by distance.
 const old = builtLine({...rec, tees: [{x: 0, z: 400, set: 'back'}, {x: 0, z: 340, set: 'front'}]});
 assert.deepEqual(old.names, ['blue', 'white', 'red']);
 assert.deepEqual(old.sets.map(t => t.set), ['back', 'front', 'front']);
});
