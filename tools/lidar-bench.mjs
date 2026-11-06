#!/usr/bin/env node
// THE AUTO TRACE FROM THE LIDAR ALONE, before any hole is marked, on the real
// course of each landscape (docs/COURSE_BUILDER.md, amendments 4, 5 and 13;
// RESEARCH, *The auto trace from the LIDAR alone*). Each course's survey from
// bench/lidar (lidar-home.mjs courseSources), its OpenStreetMap from the
// imagery bench's folder, lined up with the laser first (osm-holes.mjs
// lineUpTruth) and scored by overlap. The land is built once a course at 1 m
// (PLACED, for the bench's speed; the builder uses half a metre to 2.25 km²)
// and kept in bench/shots/lidar/land-cache (a door 2 draft, draft.js).
//
//   node tools/lidar-bench.mjs                  every course
//   node tools/lidar-bench.mjs links desert     some
//   node tools/lidar-bench.mjs --study          also what each surface is like to the laser
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OUT, COURSES} from './imagery-fetch.mjs';
import {courseSources} from './lidar-home.mjs';
import {osmWays, truthGrid, scoreCodes, lineUpTruth, KINDS} from './osm-holes.mjs';
import {converter} from '../src/lidar/geo.js';
import {toMetres} from '../src/lidar/las.js';
import {createGridder} from '../src/lidar/land.js';
import {trace, features} from '../src/lidar/trace.js';
import {landFromSources} from '../src/builder/real-course.js';
import {writeDraft, readDraft} from '../src/builder/draft.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), CACHE = path.join(ROOT, 'bench', 'shots', 'lidar', 'land-cache');
const argv = process.argv.slice(2), flag = n => argv.includes(`--${n}`), want = argv.filter(a => !a.startsWith('--'));
const CELL = 1, PAD = 30;
let M = null;
const laz = async () => M ??= await (async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); })();

// The land over the course's box (and PAD metres), in the survey's own grid;
// built once and kept.
async function courseLand(key, meta) {
 const file = path.join(CACHE, `${key}.fairway-draft`);
 if (fs.existsSync(file)) { const d = await readDraft(new Uint8Array(fs.readFileSync(file))); return {land: d.land, crs: d.sources[0].crs}; }
 const sources = await courseSources(key, await laz());
 if (!sources.length) return null;
 const crs = sources[0].crs, fromDeg = converter({epsg: 4326, geographic: true}, crs), u = toMetres(crs).h;
 const [lon0, lat0, lon1, lat1] = meta.bbox_lonlat, a = fromDeg(lon0, lat0), b = fromDeg(lon1, lat1), pad = PAD / u;
 const box = {x0: Math.min(a.x, b.x) - pad, x1: Math.max(a.x, b.x) + pad, y0: Math.min(a.y, b.y) - pad, y1: Math.max(a.y, b.y) + pad};
 const {land} = await landFromSources(sources, box, {cell: CELL});
 fs.mkdirSync(CACHE, {recursive: true});
 fs.writeFileSync(file, await writeDraft({step: 1, name: key, landscape: key, sources: [{name: sources[0].name, crs}], land}));
 return {land, crs};
}

const pct = v => v == null ? '  -' : String(Math.round(100 * v)).padStart(3);
const rows = [];
for (const c of COURSES.filter(c => !want.length || want.includes(c.key))) {
 const dir = path.join(OUT, c.key);
 if (!fs.existsSync(path.join(dir, 'osm.json'))) continue;
 const meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8')), osm = JSON.parse(fs.readFileSync(path.join(dir, 'osm.json'), 'utf8'));
 const t0 = performance.now(), got = await courseLand(c.key, meta);
 if (!got) { console.log(`${c.key}: no survey in bench/lidar`); continue; }
 const {land, crs} = got, u = land.unit ?? {h: 1, v: 1};
 const g = createGridder({box: {x0: land.center.x - land.halfX / u.h, x1: land.center.x + land.halfX / u.h, y0: land.center.y - land.halfZ / u.h, y1: land.center.y + land.halfZ / u.h}, cell: land.cell, unit: u});
 const fromDeg = converter({epsg: 4326, geographic: true}, crs), ways = osmWays(osm, (lat, lon) => { const p = fromDeg(lon, lat); return g.local(p.x, p.y); });
 const lined = lineUpTruth(truthGrid(ways, land), land, {mode: 'lidar'}), truth = lined.truth;
 const t1 = performance.now(), r = trace(land, {mode: 'lidar', holes: []}), score = scoreCodes(truth, r.codes);
 rows.push({key: c.key, score});
 console.log(`${c.key.padEnd(10)} ${Object.entries(score).map(([k, v]) => `${k} ${pct(v)}`).join('  ')}   (land ${land.nx} x ${land.nz}, map moved ${lined.x.toFixed(1)}, ${lined.z.toFixed(1)} m; trace ${((performance.now() - t1) / 1000).toFixed(1)} s, all ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
 if (flag('study')) {
  // What each mapped surface is like to the laser: the medians (and 10th and
  // 90th) of smoothness, slope, brightness, canopy and several returns.
  const F = features(land), N = land.nx * land.nz, of = {};
  for (let k = 0; k < N; k += 3) { const t = truth[k] ?? 'other'; (of[t] ??= []).push(k); }
  const q = (list, f, p) => { const v = list.map(f).filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length * p)] : NaN; };
  const iMed = q(of.fairway ?? of.other, k => land.intensity[k], .5);
  for (const [t, list] of Object.entries(of)) {
   const cols = [['rough cm', k => F.rough[k] * 100], ['slope %', k => F.slope[k]], ['bright/fw', k => land.intensity[k] / iMed], ['canopy m', k => land.canopy[k]], ['multi %', k => land.multi[k] / 2.55]];
   console.log(`   ${t.padEnd(8)} n ${String(list.length).padStart(7)}  ` + cols.map(([n, f]) => `${n} ${q(list, f, .1).toFixed(2)}/${q(list, f, .5).toFixed(2)}/${q(list, f, .9).toFixed(2)}`).join('  '));
  }
 }
}
if (rows.length > 1) console.log(`${'mean'.padEnd(10)} ${Object.keys(KINDS).map(k => { const v = rows.map(r => r.score[k]).filter(x => x != null); return `${k} ${pct(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)}`; }).join('  ')}`);
