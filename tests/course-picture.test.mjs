import test from 'node:test';
import assert from 'node:assert/strict';
import {courseLayout, layoutFor, fitLayout, drawCoursePicture} from '../src/course-picture.js';

// Course pictures are drawn from the course's own routing: the holes the
// generator makes, placed as generateWorld places them.
test('a course picture lays out every hole, and the same course the same way', () => {
 const a = courseLayout({seed: 'HEMLOCK', holes: 9, biome: 'midwest'}), b = courseLayout({seed: 'HEMLOCK', holes: 9, biome: 'midwest'});
 assert.equal(a.holes.length, 9);
 assert.deepEqual(a.bounds, b.bounds);
 for (const v of Object.values(a.bounds)) assert.ok(Number.isFinite(v));
 assert.equal(courseLayout({seed: 'X', holes: 18}).holes.length, 18);
 assert.equal(layoutFor({seed: 'HEMLOCK', holes: 9, biome: 'midwest'}), layoutFor({seed: 'HEMLOCK', holes: 9, biome: 'midwest'}));
});

test('the picture fills its frame, turned a quarter when that fits better', () => {
 const tall = {minX: -100, maxX: 100, minZ: -300, maxZ: 300};
 const f = fitLayout(tall, 200, 120);
 assert.equal(f.turn, true);
 const corners = [{x: -100, z: -300}, {x: 100, z: 300}].map(f.at);
 for (const [x, y] of corners) { assert.ok(x >= 0 && x <= 200, `x ${x}`); assert.ok(y >= 0 && y <= 120, `y ${y}`); }
 assert.equal(fitLayout({minX: -300, maxX: 300, minZ: -100, maxZ: 100}, 200, 120).turn, false);
});

test('drawing touches only the frame it is given', () => {
 const calls = [];
 const ctx = new Proxy({}, {get: (o, k) => (k in o ? o[k] : (...args) => calls.push([k, ...args])), set: (o, k, v) => { o[k] = v; return true; }});
 drawCoursePicture(ctx, courseLayout({seed: 'HEMLOCK', holes: 9, biome: 'desert'}), 200, 120);
 const pts = calls.filter(c => c[0] === 'lineTo' || c[0] === 'moveTo').map(c => [c[1], c[2]]);
 assert.ok(pts.length > 100);
 assert.ok(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > -60 && x < 260 && y > -60 && y < 180));
});
