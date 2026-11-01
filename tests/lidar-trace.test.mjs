// The auto trace (src/lidar/trace.js) on a small hand-made hole whose every
// surface is known: each found by the LIDAR, by the picture, and by both;
// the LIDAR first where it is sure, the picture where the LIDAR has nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {trace, TRACE, SOURCE} from '../src/lidar/trace.js';

// 200 x 300 m at half a metre: a hole from a tee at z 120 to a green at
// z -110, a fairway 30 m wide between, a bunker beside the green, a pond off
// the fairway, rough elsewhere. Rough is bumpy at a few centimetres, raked
// sand rougher; mown ground is smooth. To the laser, as Worthington's survey
// saw them: turf bright (grass reflects its infrared), sand a little darker,
// water silent.
function hole({intensity = true, picture = true, pictureHole = null} = {}) {
 const cell = .5, halfX = 100, halfZ = 150, nx = 401, nz = 601, N = nx * nz;
 let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
 const ground = new Float32Array(N), canopy = new Float32Array(N), inten = new Float32Array(N), water = new Uint8Array(N), noReturns = new Uint8Array(N);
 const rgb = new Uint8Array(N * 3), nir = new Uint8Array(N), has = new Uint8Array(N), truth = new Array(N);
 const COL = {rough: [95, 115, 62], semi: [95, 115, 62], fairway: [78, 150, 58], green: [66, 172, 72], tee: [78, 150, 58], sand: [226, 214, 184], water: [32, 52, 62]};
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i, x = -halfX + i * cell, z = -halfZ + j * cell;
  let t = 'rough';
  if (Math.abs(x) < 15 && z > -95 && z < 100) t = 'fairway';
  if (Math.hypot(x, z + 110) < 13) t = 'green';
  if (Math.abs(x) < 4 && Math.abs(z - 120) < 6) t = 'tee';
  const bunker = Math.hypot(x - 22, z + 105);
  if (bunker < 6) t = 'sand';
  if (Math.hypot(x + 55, z) < 16) t = 'water';
  truth[k] = t;
  const mown = t === 'fairway' || t === 'green' || t === 'tee';
  ground[k] = 100 + z * .01 + (mown || t === 'water' ? 0 : (rnd() - .5) * (t === 'sand' ? .2 : .16)) - (bunker < 6 ? .6 * (1 - (bunker / 6) ** 2) : 0);
  if (t === 'water') { noReturns[k] = 1; inten[k] = NaN; } else inten[k] = intensity ? (t === 'sand' ? .66 : mown ? .8 : .72) + (rnd() - .5) * .06 : NaN;
  if (picture && !(pictureHole && pictureHole(x, z))) {
   // Rough coarser to the camera than mown turf, as every real course measured
   // (RESEARCH, *The auto trace from the picture*).
   for (let q = 0; q < 3; q++) rgb[k * 3 + q] = Math.max(0, Math.min(255, COL[t][q] + (rnd() - .5) * (t === 'rough' ? 44 : 12)));
   nir[k] = t === 'water' ? 18 : t === 'sand' ? rgb[k * 3] : Math.min(255, rgb[k * 3] * 2.5);
   has[k] = 1;
  }
 }
 // A tree in the rough.
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = -halfX + i * cell, z = -halfZ + j * cell, d = Math.hypot(x - 50, z - 40); if (d < 5) canopy[j * nx + i] = 14 * (1 - d * d / 60); }
 const land = {nx, nz, cell, halfX, halfZ, ground, canopy, intensity: inten, water, building: new Uint8Array(N), multi: new Uint8Array(N), noReturns, filled: Uint8Array.from(noReturns), method: 'classified'};
 return {land, picture: picture ? {rgb, nir, has} : null, holes: [{tees: [{x: 0, z: 120}], green: {x: 0, z: -110}}], truth};
}
const iou = (codes, truth, kind) => { const c = TRACE.indexOf(kind); let a = 0, u = 0; for (let k = 0; k < codes.length; k++) { const p = codes[k] === c, t = truth[k] === kind; if (p && t) a++; if (p || t) u++; } return a / u; };

test('the LIDAR alone finds the green, the tee, the sand and the water', () => {
 const h = hole(), r = trace(h.land, {holes: h.holes, mode: 'lidar'});
 // A green runs on into its approach to the laser (both smooth and open):
 // the picture's colour is what stops it at the collar.
 assert.ok(iou(r.codes, h.truth, 'green') > .5, 'green ' + iou(r.codes, h.truth, 'green'));
 assert.ok(iou(r.codes, h.truth, 'tee') > .6, 'tee ' + iou(r.codes, h.truth, 'tee'));
 assert.ok(iou(r.codes, h.truth, 'sand') > .5, 'sand ' + iou(r.codes, h.truth, 'sand'));
 assert.ok(iou(r.codes, h.truth, 'water') > .9, 'water ' + iou(r.codes, h.truth, 'water'));
});

test('the picture alone finds every surface, the fairway by its colour', () => {
 const h = hole(), r = trace(h.land, {picture: h.picture, holes: h.holes, mode: 'picture'});
 for (const [kind, least] of [['green', .8], ['sand', .7], ['water', .9], ['fairway', .7]]) assert.ok(iou(r.codes, h.truth, kind) > least, `${kind} ${iou(r.codes, h.truth, kind)}`);
});

test('LIDAR first: the picture fills only what the LIDAR cannot see', () => {
 // No laser brightness: the sand is the picture's call.
 const dark = hole({intensity: false}), r = trace(dark.land, {picture: dark.picture, holes: dark.holes, mode: 'both'});
 assert.ok(iou(r.codes, dark.truth, 'sand') > .7);
 const sandAt = r.codes.findIndex((c, k) => c === TRACE.indexOf('sand') && dark.truth[k] === 'sand');
 assert.equal(r.source[sandAt], SOURCE.picture);
 // No picture over the bunker: the LIDAR still finds it.
 const gap = hole({pictureHole: (x, z) => Math.hypot(x - 22, z + 105) < 12}), g = trace(gap.land, {picture: gap.picture, holes: gap.holes, mode: 'both'});
 assert.ok(iou(g.codes, gap.truth, 'sand') > .5);
 const at = g.codes.findIndex((c, k) => c === TRACE.indexOf('sand') && gap.truth[k] === 'sand');
 assert.equal(g.source[at], SOURCE.lidar);
 // The water the LIDAR is sure of stays the LIDAR's.
 const both = hole(), b = trace(both.land, {picture: both.picture, holes: both.holes, mode: 'both'});
 const wk = b.codes.findIndex((c, k) => c === TRACE.indexOf('water'));
 assert.equal(b.source[wk], SOURCE.lidar);
 assert.ok(iou(b.codes, both.truth, 'fairway') > .7);
});

// Door 2 traces before any hole is marked (the owner's order, 31 October
// 2026): the mown turf is then found in the picture itself.
test('with no hole marked the fairway is found from the picture; nothing under the tree', () => {
 const h = hole(), r = trace(h.land, {picture: h.picture, holes: [], mode: 'both'});
 const mown = iou(r.codes, h.truth, 'fairway') + iou(r.codes, h.truth, 'semi');
 assert.ok(r.codes.some(c => c === TRACE.indexOf('fairway')), 'no fairway found');
 assert.ok(mown > .4, 'fairway ' + mown);
 const k = Math.round((40 + 150) / .5) * 401 + Math.round((50 + 100) / .5);
 assert.equal(TRACE[r.codes[k]], 'rough');
});
