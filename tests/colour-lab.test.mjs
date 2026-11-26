// The green colour lab's arithmetic (src/colour-lab.js; the owner, 26
// November 2026: "an in game interactive picker with sliders that lets me
// tune the colors of the greens in each biome with the ability to copy
// settings back out to you").
import test from 'node:test';
import assert from 'node:assert/strict';
import {hexToHsl, hslToHex, readPicks, labText, isHex} from '../src/colour-lab.js';
import {BIOMES} from '../src/biomes.js';

test('every landscape\'s green goes to the sliders and back to the same colour', () => {
 for (const [k, b] of Object.entries(BIOMES)) {
  if (!isHex(b.green)) continue;
  const back = hslToHex(hexToHsl(b.green)), n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  n(back).forEach((v, i) => assert.ok(Math.abs(v - n(b.green)[i]) <= 1, `${k}: ${b.green} came back ${back}`));
 }
 assert.equal(hslToHex({h: 120, s: 100, l: 50}), '#00ff00');
 assert.deepEqual(hexToHsl('#808080'), {h: 0, s: 0, l: 50.2});
});

test('a damaged or hand-edited store is read as far as it is sound', () => {
 assert.deepEqual(readPicks('not json'), {});
 assert.deepEqual(readPicks('[1,2]'), {});
 assert.deepEqual(readPicks(JSON.stringify({parkland: {green: '#9FB86A', fringe: 'pale', rough: '#000000'}, redwood: 'green', 'bad key': {green: '#000000'}})), {parkland: {green: '#9fb86a'}});
});

test('the copy-out names each changed landscape and surface with its new and old base colour', () => {
 const biomes = {parkland: {name: 'Classic Parkland', green: '#b2c280', fringe: '#99aa66'}, redwood: {name: 'Redwood Coast', green: '#7ba452', fringe: '#6e9a4d'}};
 assert.equal(labText({}, biomes), '');
 assert.equal(labText({redwood: {green: '#7BA452'}}, biomes), '', 'a pick equal to the colour it has is no change');
 const t = labText({parkland: {green: '#9fb86a', fringe: '#8ea35c'}, redwood: {green: '#7ba452'}, gone: {green: '#000000'}}, biomes, '0.9.21');
 assert.match(t, /^Fairway green colour lab \(0\.9\.21\)/);
 assert.match(t, /- Classic Parkland \(parkland\): green #9fb86a \(was #b2c280\)/);
 assert.match(t, /- Classic Parkland \(parkland\): fringe #8ea35c \(was #99aa66\)/);
 assert.doesNotMatch(t, /redwood|gone/);
});
