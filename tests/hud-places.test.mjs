import test from 'node:test';
import assert from 'node:assert/strict';
import {PIECES, KEY, cleanPlaces, placeFrom, placeIn, clampBox, loadPlaces, savePlaces} from '../src/hud-places.js';

const memory = () => { const m = new Map(); return {getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m}; };

test('the movable pieces are the map and the shot numbers', () => {
 assert.deepEqual(PIECES, ['map', 'tiles']);
});

test('a load keeps only well-formed places of known pieces, held to 0..1', () => {
 assert.deepEqual(cleanPlaces(null), {});
 assert.deepEqual(cleanPlaces({map: {x: .5, y: .25}, tiles: {x: 'a', y: 1}, other: {x: 0, y: 0}}), {map: {x: .5, y: .25}});
 assert.deepEqual(cleanPlaces({tiles: {x: -1, y: 2}}), {tiles: {x: 0, y: 1}});
 assert.deepEqual(cleanPlaces({map: {x: NaN, y: 0}}), {});
});

test('a place is the top-left corner as a fraction of the area, and comes back the same', () => {
 const area = {w: 1920, h: 1080};
 const place = placeFrom({left: 960, top: 270, w: 300, h: 200}, area);
 assert.deepEqual(place, {x: .5, y: .25});
 assert.deepEqual(placeIn(place, {w: 300, h: 200}, area), {left: 960, top: 270});
});

test('a drag past the edge is held on screen', () => {
 const area = {w: 1000, h: 600};
 assert.deepEqual(placeFrom({left: 900, top: -40, w: 200, h: 100}, area), {x: .8, y: 0});
});

test('a place made in a wide window slides back in on a narrow one', () => {
 const place = {x: .9, y: .9};
 const r = placeIn(place, {w: 300, h: 340}, {w: 1280, h: 720});
 assert.deepEqual(r, {left: 1280 - 300 - 8, top: 720 - 340 - 8});
});

test('a box bigger than the area keeps its top-left corner on screen', () => {
 assert.deepEqual(clampBox({left: 50, top: 50, w: 2000, h: 900}, {w: 1000, h: 600}, 8), {left: 8, top: 8});
});

test('places are kept per device, and an empty set removes the key', () => {
 const store = memory();
 assert.deepEqual(loadPlaces(store), {});
 savePlaces({map: {x: .1, y: .2}}, store);
 assert.deepEqual(JSON.parse(store.getItem(KEY)), {map: {x: .1, y: .2}});
 assert.deepEqual(loadPlaces(store), {map: {x: .1, y: .2}});
 savePlaces({}, store);
 assert.equal(store.getItem(KEY), null);
 store.setItem(KEY, '{not json');
 assert.deepEqual(loadPlaces(store), {});
});
