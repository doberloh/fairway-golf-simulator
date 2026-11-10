// The steadied brush (src/builder/steady.js; the builder-ux goal): shakes
// inside the string never reach the paint, the brush follows straight when
// pulled, and dabs lie evenly with no gaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSteady} from '../src/builder/steady.js';

test('with no string it is the plain brush, with dabs filling the gaps', () => {
 const s = createSteady({string: 0, spacing: 1});
 assert.deepEqual(s.down({x: 0, z: 0}), [{x: 0, z: 0}]);
 const dabs = s.move({x: 5, z: 0});
 assert.equal(dabs.length, 5, 'a dab a metre along a 5 m jump');
 assert.ok(Math.abs(dabs.at(-1).x - 5) < 1e-9);
});

test('a shake inside the string lays nothing; a pull moves the brush straight', () => {
 const s = createSteady({string: 3, spacing: .5});
 s.down({x: 0, z: 0});
 for (const [x, z] of [[1, 1], [-1, 2], [2, -1], [0, 2.5]]) assert.deepEqual(s.move({x, z}), [], `a shake to ${x}, ${z}`);
 assert.deepEqual(s.at, {x: 0, z: 0}, 'the brush has not moved');
 const dabs = s.move({x: 10, z: 0});
 assert.ok(Math.abs(s.at.x - 7) < 1e-9 && Math.abs(s.at.z) < 1e-9, 'the brush trails the pointer by the string');
 assert.ok(dabs.every(d => Math.abs(d.z) < 1e-9), 'straight towards the pointer');
});

test('a wobbling line comes out straighter than the hand drew it', () => {
 const plain = createSteady({string: 0, spacing: .25}), steady = createSteady({string: 4, spacing: .25});
 const hand = Array.from({length: 200}, (_, i) => ({x: i * .5, z: Math.sin(i * 1.7) * 1.5}));
 const run = s => { const out = s.down(hand[0]); for (const p of hand.slice(1)) out.push(...s.move(p)); return out; };
 const wobble = dabs => Math.max(...dabs.slice(20).map(d => Math.abs(d.z)));
 const a = run(plain), b = run(steady);
 assert.ok(wobble(b) < wobble(a) / 3, `steadied ${wobble(b).toFixed(2)} m against ${wobble(a).toFixed(2)} m`);
 for (let i = 1; i < b.length; i++) assert.ok(Math.hypot(b[i].x - b[i - 1].x, b[i].z - b[i - 1].z) <= .25 + 1e-9, 'no gap wider than the spacing');
});

test('letting go catches the brush up to the pointer, so a short stroke still paints', () => {
 const s = createSteady({string: 15, spacing: 1});
 s.down({x: 0, z: 0});
 assert.deepEqual(s.move({x: 10, z: 0}), [], 'inside the string');
 const tail = s.up({x: 10, z: 0});
 assert.ok(tail.length >= 10 && Math.abs(tail.at(-1).x - 10) < 1e-9, `the stroke reaches the pointer: ${JSON.stringify(tail.at(-1))}`);
 assert.equal(s.at, null);
});
