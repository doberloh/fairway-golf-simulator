#!/usr/bin/env node
// HOW GOOD THE AUTO TRACE IS (the course builder, stage 8; docs/COURSE_BUILDER.md,
// *LIDAR first, the picture as fallback*).
//
//   node tools/trace-bench.mjs                      synthetic courses, every landscape
//   node tools/trace-bench.mjs midwest links        some of them
//
// A real course is measured by tools/real-course.mjs, which builds it through
// door 2's own pipeline and scores the same three ways against
// OpenStreetMap's hand-drawn outlines.
//
// SYNTHETIC: Fairway generates a course, and so knows every surface. From it
// a fake LIDAR survey (the ground the ball meets at 0.5 m, rough and raked
// sand bumpier than mown turf, a canopy over each tree's crown, the laser's
// brightness by surface as Worthington's survey measured it -- turf bright,
// sand a little darker, asphalt dark -- with noise, nothing back off water) and a fake aerial picture (each surface's map colour, mowing light
// and dark, noise, near-infrared bright on turf and leaves) -- then the auto
// trace, marked with the course's own tees and greens, in three ways: the
// LIDAR alone, the picture alone, and the LIDAR first with the picture as
// fallback. Each surface's overlap with the truth (intersection over union).
import {generateWorld, BIOMES, DEFAULT_COURSE} from '../src/course.js';
import {trace, TRACE} from '../src/lidar/trace.js';
import {GROUNDS} from '../src/grounds.js';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const holesN = Number(opt('holes', 9));
const KINDS = ['green', 'tee', 'fairway', 'sand', 'water'];
const MODES = ['lidar', 'picture', 'both'];
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
const noise = a => (rnd() - .5) * 2 * a;

function score(codes, truth) {
 const out = {};
 for (const kind of KINDS) {
  const c = TRACE.indexOf(kind); let i = 0, u = 0;
  for (let k = 0; k < codes.length; k++) { const a = codes[k] === c, b = truth[k] === kind; if (a && b) i++; if (a || b) u++; }
  out[kind] = u ? i / u : null;
 }
 return out;
}

// A generated course as a survey and a picture on a 0.5 m grid.
export function synthetic(w, cell = .5) {
 const halfX = w.halfX, halfZ = w.halfZ, nx = Math.round(2 * halfX / cell) + 1, nz = Math.round(2 * halfZ / cell) + 1, N = nx * nz;
 const ground = new Float32Array(N), canopy = new Float32Array(N), intensity = new Float32Array(N), water = new Uint8Array(N), noReturns = new Uint8Array(N), building = new Uint8Array(N), multi = new Uint8Array(N), filled = new Uint8Array(N);
 const rgb = new Uint8Array(N * 3), nir = new Uint8Array(N), has = new Uint8Array(N).fill(1), truth = new Array(N);
 const BRIGHT = {sand: .69, green: .87, fringe: .84, fairway: .79, tee: .77, semi: .75, rough: .7, path: .45};
 const hex = h => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
 const bio = w.bio, mt = bio.mapTurf || {};
 const COL = {green: hex(mt.green ?? bio.green), fringe: hex(bio.fringe), fairway: hex(mt.fairway ?? bio.fairway), tee: hex(mt.fairway ?? bio.fairway), semi: hex(mt.semi ?? bio.semi), rough: hex(bio.rough), sand: hex(bio.sand), water: [40, 70, 90], path: [190, 185, 175]};
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i, x = -halfX + i * cell, z = -halfZ + j * cell, s = w.surface(x, z);
  truth[k] = s === 'fringe' ? 'semi' : s;
  const mown = s === 'fairway' || s === 'green' || s === 'tee' || s === 'fringe';
  ground[k] = w.height(x, z) + noise(s === 'sand' ? .1 : mown ? .01 : .08);
  if (s === 'water') { noReturns[k] = filled[k] = 1; intensity[k] = NaN; }
  else intensity[k] = (BRIGHT[s] ?? (GROUNDS[s]?.like === 'sand' ? .69 : .7)) + noise(.04);
  const c = COL[s] ?? hex(GROUNDS[s]?.map ?? bio.rough), stripe = (s === 'fairway' || s === 'green') && Math.floor((x + z) / 6) % 2 ? 12 : 0;
  for (let q = 0; q < 3; q++) rgb[k * 3 + q] = Math.max(0, Math.min(255, c[q] + stripe + noise(10)));
  // Near-infrared as a real sensor sees it: green turf and leaves bright,
  // well above their red (NDVI 0.4-0.7); sand, paths and rock near their red.
  nir[k] = s === 'water' ? 20 : (s === 'sand' || s === 'path' || GROUNDS[s]?.like === 'sand') ? Math.min(255, rgb[k * 3] * 1.1) : Math.min(255, rgb[k * 3] * 2.6 + noise(10));
 }
 for (const t of w.trees) {
  if (t.h < 2) continue;
  const r = Math.max(1, t.r), i0 = Math.round((t.x - r + halfX) / cell), i1 = Math.round((t.x + r + halfX) / cell), j0 = Math.round((t.z - r + halfZ) / cell), j1 = Math.round((t.z + r + halfZ) / cell);
  for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
   const d = Math.hypot(-halfX + i * cell - t.x, -halfZ + j * cell - t.z) / r; if (d > 1) continue;
   const k = j * nx + i, h = t.h * (1 - d * d * .4); if (h > canopy[k]) canopy[k] = h;
   for (let q = 0; q < 3; q++) rgb[k * 3 + q] = [40, 80, 40][q] + noise(8); nir[k] = 210;
  }
 }
 const land = {nx, nz, cell, halfX, halfZ, ground, canopy, intensity, water, building, multi, noReturns, filled, method: 'classified'};
 const holes = w.holes.map(h => ({tees: Object.values(h.tees).map(t => h.toWorld(t)), green: h.worldGreen}));
 return {land, picture: {rgb, nir, has}, holes, truth};
}

const fmt = s => KINDS.map(k => `${k} ${s[k] == null ? '  -' : (100 * s[k]).toFixed(0).padStart(3)}`).join('  ');
{
 const biomes = argv.length ? argv : Object.keys(BIOMES), totals = Object.fromEntries(MODES.map(m => [m, Object.fromEntries(KINDS.map(k => [k, []]))]));
 for (const biome of biomes) {
  const w = generateWorld({...DEFAULT_COURSE, biome, holes: holesN, seed: `TRACE-${biome.toUpperCase()}`, water: 60});
  const s = synthetic(w), t0 = performance.now();
  for (const mode of MODES) {
   const r = trace(s.land, {picture: s.picture, holes: s.holes, mode}), sc = score(r.codes, s.truth);
   for (const k of KINDS) if (sc[k] != null) totals[mode][k].push(sc[k]);
   console.log(`${biome.padEnd(10)} ${mode.padEnd(8)} ${fmt(sc)}`);
  }
  console.log(`           (${((performance.now() - t0) / 3000).toFixed(1)} s a trace)`);
 }
 console.log('\nMEAN OVERLAP (intersection over union), every landscape:');
 for (const m of MODES) console.log(`  ${m.padEnd(8)} ${fmt(Object.fromEntries(KINDS.map(k => [k, totals[m][k].length ? totals[m][k].reduce((a, b) => a + b, 0) / totals[m][k].length : null])))}`);
}
