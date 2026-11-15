import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BAKE, levelCenter, courseSquare, bakeUV, isStale, pickRepaint, encodeTurf, decodeTurf, bakeFragment} from '../src/ground-bake.js';

// THE GROUND PAINTED ONCE, FOR A PHONE (src/ground-bake.js): where a point of
// the world lands in a square's picture, which square is repainted when, and
// the colour's round trip through eight bits.

test('a point lands in the picture exactly where the painting camera puts it', () => {
 // The camera renderer.js paints with: orthographic, straight overhead, its
 // up to -z, the square's side across both ways.
 for (const sq of [{x: 120, z: -340, size: 32}, {x: -800, z: 40, size: 512}, courseSquare(1300, 900)]) {
  const cam = new T.OrthographicCamera(-sq.size / 2, sq.size / 2, sq.size / 2, -sq.size / 2, 1, 10000);
  cam.up.set(0, 0, -1); cam.position.set(sq.x, 3000, sq.z); cam.lookAt(sq.x, 0, sq.z); cam.updateMatrixWorld();
  for (const [dx, dz, y] of [[0, 0, 0], [.3, -.2, 40], [-.49, .45, -12], [.1, .49, 600]]) {
   const p = new T.Vector3(sq.x + dx * sq.size, y, sq.z + dz * sq.size).project(cam);
   const {u, v} = bakeUV(sq, sq.x + dx * sq.size, sq.z + dz * sq.size);
   // A render target's texel (u, v) is the frame's (2u - 1, 2v - 1).
   assert.ok(Math.abs(p.x - (2 * u - 1)) < 1e-9 && Math.abs(p.y - (2 * v - 1)) < 1e-9, `(${dx}, ${dz}) at ${p.x}, ${p.y} against ${2 * u - 1}, ${2 * v - 1}`);
  }
 }
});

test('the squares sit ahead of the camera, finest a few centimetres a texel', () => {
 const c = levelCenter({x: 10, z: 20}, {x: 0, z: 3}, 32);
 assert.deepEqual(c, {x: 10, z: 20 + 32 * BAKE.ahead});
 assert.deepEqual(levelCenter({x: 1, z: 2}, {x: 0, z: 0}, 128), {x: 1, z: 2}, 'looking straight down: on the camera');
 assert.ok(BAKE.levels[0] / BAKE.texels <= .035, 'the finest about 3 cm a texel');
 // The camera's own spot and 20 m ahead lie in the finest square.
 const sq = {...c, size: 32};
 for (const z of [20, 40]) { const {u, v} = bakeUV(sq, 10, z); assert.ok(u > 0 && u < 1 && v > 0 && v < 1, `z ${z}`); }
 assert.deepEqual(courseSquare(1300, 900), {x: 0, z: 0, size: 2600});
});

test('repainting: the unpainted at once, then one at a time, the finest held while the camera races', () => {
 const sq = (painted, want, size) => ({painted, want, size});
 const at = {x: 0, z: 0}, far = {x: 40, z: 0};  // stale for the 32 and 128 m squares (8 and 32 m)
 assert.equal(pickRepaint([sq(at, at, 32), sq(null, at, 128), sq(at, at, 512), sq(null, at, 2600)], {now: 0}), 3, 'the course first');
 assert.equal(pickRepaint([sq(at, far, 32), sq(at, far, 128), sq(at, at, 512), sq(at, at, 2600)], {now: 100, last: 0}), -1, 'not yet: one every BAKE.every ms');
 assert.equal(pickRepaint([sq(at, far, 32), sq(at, far, 128), sq(at, at, 512), sq(at, at, 2600)], {now: 1000, last: 0}), 1, 'the coarser stale square first: it is the fallback');
 assert.equal(pickRepaint([sq(at, far, 32), sq(at, at, 128), sq(at, at, 512), sq(at, at, 2600)], {now: 1000, last: 0, speed: 30}), -1, 'the finest waits while the camera races');
 assert.equal(pickRepaint([sq(at, far, 32), sq(at, at, 128), sq(at, at, 512), sq(at, at, 2600)], {now: 1000, last: 0, speed: 2}), 0);
 assert.ok(!isStale(at, {x: 7, z: 0}, 32) && isStale(at, {x: 9, z: 0}, 32), 'stale past a quarter of the side');
 // The sun turned or a cue changed: repainted where it stands, one at a time.
 assert.equal(pickRepaint([sq(at, at, 32), sq(at, at, 128), sq(at, at, 512), {...sq(at, at, 2600), dirty: true}], {now: 1000, last: 0}), 3);
});

test('the colour survives eight bits, a little over 1 included', () => {
 for (const c of [0, .02, .18, .5, 1, 1.3, 1.9]) {
  const back = decodeTurf(Math.round(encodeTurf(c) * 255) / 255);
  assert.ok(Math.abs(back - c) <= Math.max(.004, c * .02), `${c} came back ${back}`);
 }
 assert.equal(decodeTurf(encodeTurf(5)), 2, 'above 2 is clipped');
 const glsl = bakeFragment(.054);
 assert.match(glsl, /2\.\*s\.rgb\*s\.rgb/, 'the shader reads it back the same way');
 assert.match(glsl, /discard/, 'and cuts the cup');
});
