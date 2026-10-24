// ONLY THE CLOUDS WHOSE SHADOW CAN BE SEEN (the frame-rate goal, 23 October
// 2026): packCloudShadows hands the shader the clouds whose shadow can fall in
// view and leaves the rest out. A pixel's shade is the darkest shadow on it,
// so the picture must be EXACTLY what every cloud gave: checked here at many
// points in view, at every height a receiver can have, for low and high suns
// and cameras looking every way.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cloudShadowUniforms, packCloudShadows, allCloudShadows} from '../src/cloud-shadows.js';
import {MAX_CLOUDS} from '../src/clouds.js';

// cloudShadowAt in cloud-shadows.js, in JS, over the first `count` slots.
const shade = (u, count, p, edge = .15) => {
 let s = 0;
 const sun = u.cloudSun.value;
 for (let i = 0; i < count; i++) {
  const d = u.cloudDiscs.value[i];
  const t = (d.y - p.y) / Math.max(sun.y, .08);
  if (t <= 0) continue;
  const hx = p.x + sun.x * t, hz = p.z + sun.z * t;
  const r = Math.hypot(hx - d.x, hz - d.z) / Math.max(d.w, 1);
  const x = Math.min(1, Math.max(0, (r - (1 - edge)) / edge)), ss = x * x * (3 - 2 * x);
  s = Math.max(s, (1 - ss) * u.cloudFade.value[i]);
 }
 return s;
};
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('packing the clouds whose shadow can be seen changes no pixel in view', () => {
 const low = -40, high = 420;
 let left = 0, cases = 0, shaded = 0;
 for (const sunY of [.08, .2, .5, .95]) for (let k = 0; k < 6; k++) {
  const discs = Array.from({length: MAX_CLOUDS}, () => new T.Vector4((rnd() - .5) * 6000, 575 + rnd() * 130, (rnd() - .5) * 6000, 250 + rnd() * 450));
  const fades = Float32Array.from({length: MAX_CLOUDS}, () => rnd() < .15 ? 0 : .3 + .7 * rnd());
  const a = rnd() * Math.PI * 2, sun = new T.Vector3(Math.sin(a) * Math.sqrt(1 - sunY * sunY), sunY, Math.cos(a) * Math.sqrt(1 - sunY * sunY));
  const cam = new T.PerspectiveCamera(53, 16 / 9, 1, 6000);
  cam.position.set((rnd() - .5) * 2000, 30 + rnd() * 200, (rnd() - .5) * 2000);
  cam.lookAt(cam.position.x + Math.sin(rnd() * 7) * 100, cam.position.y - 20, cam.position.z + Math.cos(rnd() * 7) * 100);
  cam.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const full = cloudShadowUniforms(), packed = cloudShadowUniforms();
  full.cloudSun.value.copy(sun); packed.cloudSun.value.copy(sun);
  allCloudShadows(full, discs, fades);
  const n = packCloudShadows(packed, discs, fades, sun, frustum, low, high);
  left += MAX_CLOUDS - n; cases++;
  // Points in view: random directions through the screen, at distances spread
  // evenly to the far plane, kept where a receiver can be.
  for (let j = 0; j < 600; j++) {
   const dir = new T.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, 1).unproject(cam).sub(cam.position).normalize();
   const p = cam.position.clone().addScaledVector(dir, 2 + rnd() * 5900);
   if (p.y < low || p.y > high || !frustum.containsPoint(p)) continue;
   const want = shade(full, MAX_CLOUDS, p);
   if (want > 0) shaded++;
   assert.equal(shade(packed, n, p), want, `sun ${sunY}, case ${k}: point ${p.toArray().map(v => v.toFixed(0))}`);
  }
 }
 // Enough points under a shadow for the comparison to mean something.
 assert.ok(shaded > 300, `only ${shaded} points were in any cloud's shadow`);
 // And it has to leave something out, or it bought nothing.
 assert.ok(left / cases > 3, `left out ${(left / cases).toFixed(1)} of ${MAX_CLOUDS} clouds on average`);
});
