#!/usr/bin/env node
// A REAL COURSE'S LIDAR, READ BY FAIRWAY, AGAINST WHAT OTHERS MADE OF IT (the
// course builder, stage 6; docs/COURSE_BUILDER.md, *The test course*).
//
//   node tools/lidar-compare.mjs --data <folder> [--cell 1] [--dem <usgs.tif>]
//
// <folder> is a course folder laid out as the owner's Worthington download is
// (raw/*.laz as delivered; terrain/dtm_0p5m.tif, chm_0p5m.tif, trees.csv,
// grid_info.json from another simulator's pipeline; course.json with the
// course's longitude-latitude box). Nothing in it is committed: pass its path.
// Reads every raw tile with Fairway's own readers (las.js and laz-perf),
// grids the property (land.js), and reports: the ground against the other
// pipeline's 0.5 m terrain model (and, with --dem, against USGS's own DEM),
// split by ground the survey saw and ground filled in; the canopy against
// theirs; the trees found against their tree list. Times each step.
import fs from 'node:fs';
import path from 'node:path';
import {parseHeader, readPoints, toMetres} from '../src/lidar/las.js';
import {readGeoTiff} from '../src/lidar/geotiff.js';
import {createGridder, findTrees} from '../src/lidar/land.js';
import {toUtm, utmOfEpsg} from '../src/lidar/geo.js';
import {worthingtonDir} from './lidar-home.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const dir = opt('data', worthingtonDir());
if (!dir || !fs.existsSync(dir)) { console.log('No data folder (pass --data <folder>, set FAIRWAY_LIDAR_TEST, or copy the survey to bench/lidar/worthington). Nothing to compare.'); process.exit(0); }
const cell = Number(opt('cell', 1)), margin = Number(opt('margin', 0));
const pct = (a, q) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const fmt = a => `median ${(pct(a, .5) * 100).toFixed(1)} cm, 95th ${(pct(a, .95) * 100).toFixed(1)}, 99th ${(pct(a, .99) * 100).toFixed(1)}, n ${a.length}`;

export async function lazModule() { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); }

const course = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
const tiles = fs.readdirSync(path.join(dir, 'raw')).filter(f => /\.la[sz]$/i.test(f)).map(f => path.join(dir, 'raw', f));
const t0 = performance.now();
const first = parseHeader(new Uint8Array(fs.readFileSync(tiles[0]).subarray(0, 65536)));
const utm = utmOfEpsg(first.crs.epsg);
const [lon0, lat0, lon1, lat1] = course.bbox_lonlat, a = toUtm(lat0, lon0, utm?.zone), b = toUtm(lat1, lon1, utm?.zone);
const box = {x0: Math.min(a.x, b.x) - margin, y0: Math.min(a.y, b.y) - margin, x1: Math.max(a.x, b.x) + margin, y1: Math.max(a.y, b.y) + margin};
console.log(`${course.name}: ${tiles.length} tiles, EPSG ${first.crs.epsg} (${first.crs.units.h}/${first.crs.units.v}), format ${first.format}${first.compressed ? ' LAZ' : ''}; property ${(box.x1 - box.x0).toFixed(0)} x ${(box.y1 - box.y0).toFixed(0)} m at ${cell} m`);
const grid = createGridder({box, cell, unit: toMetres(first.crs)});
const M = await lazModule();
let read = 0;
for (const f of tiles) {
 const bytes = new Uint8Array(fs.readFileSync(f)), h = parseHeader(bytes);
 if (h.bounds.maxX < box.x0 || h.bounds.minX > box.x1 || h.bounds.maxY < box.y0 || h.bounds.minY > box.y1) continue;
 const t = performance.now();
 await readPoints(bytes, h, p => grid.add(p), {lazModule: M});
 read += h.count;
 console.log(`  ${path.basename(f)}: ${h.count.toLocaleString()} points in ${((performance.now() - t) / 1000).toFixed(1)} s`);
}
const t1 = performance.now();
const land = grid.finish();
const trees = findTrees(land);
console.log(`read ${read.toLocaleString()} points (${grid.points.toLocaleString()} on the property), gridded and finished in ${((performance.now() - t0) / 1000).toFixed(1)} s (finish ${((performance.now() - t1) / 1000).toFixed(1)} s); ground ${land.method}; ${(100 * land.filled.reduce((s, v) => s + v, 0) / land.filled.length).toFixed(1)}% of cells filled; ${trees.length} trees`);

// Their 0.5 m terrain model, sampled at our cells.
const sampler = r => (mx, my) => { const u = (mx - r.x0) / r.dx, v = (my - r.y0) / r.dy, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 if (i < 0 || j < 0 || i + 1 >= r.width || j + 1 >= r.height) return NaN; const d = r.data, w = r.width;
 return (d[j * w + i] * (1 - fu) + d[j * w + i + 1] * fu) * (1 - fv) + (d[(j + 1) * w + i] * (1 - fu) + d[(j + 1) * w + i + 1] * fu) * fv; };
const against = async (file, label) => {
 if (!file || !fs.existsSync(file)) return;
 const r = await readGeoTiff(new Uint8Array(fs.readFileSync(file))), at = sampler(r), seen = [], filled = [], signed = [];
 for (let j = 0; j < land.nz; j++) for (let i = 0; i < land.nx; i++) {
  const k = j * land.nx + i, m = grid.map(-land.halfX + i * cell, -land.halfZ + j * cell), theirs = at(m.x, m.y);
  if (!Number.isFinite(theirs)) continue;
  const e = land.ground[k] - theirs;
  (land.filled[k] ? filled : seen).push(Math.abs(e)); signed.push(e);
 }
 console.log(`GROUND against ${label}: where the survey saw ground ${fmt(seen)}; filled in ${fmt(filled)}; mean signed ${(signed.reduce((s, v) => s + v, 0) / signed.length * 100).toFixed(1)} cm`);
};
await against(path.join(dir, 'terrain', 'dtm_0p5m.tif'), 'the other pipeline\'s 0.5 m DTM');
await against(opt('dem', null), 'USGS\'s DEM');
{
 const r = await readGeoTiff(new Uint8Array(fs.readFileSync(path.join(dir, 'terrain', 'chm_0p5m.tif')))), at = sampler(r), e = [];
 for (let j = 0; j < land.nz; j++) for (let i = 0; i < land.nx; i++) { const k = j * land.nx + i, m = grid.map(-land.halfX + i * cell, -land.halfZ + j * cell), theirs = at(m.x, m.y); if (Number.isFinite(theirs) && (theirs > 2 || land.canopy[k] > 2)) e.push(Math.abs(land.canopy[k] - theirs)); }
 console.log(`CANOPY against theirs, where either is over 2 m: ${fmt(e)}`);
}
{
 const rows = fs.readFileSync(path.join(dir, 'terrain', 'trees.csv'), 'utf8').trim().split(/\r?\n/), head = rows[0].split(',');
 const col = n => head.indexOf(n), theirs = rows.slice(1).map(r => r.split(',')).map(c => ({...grid.local(+c[col('map_x')], +c[col('map_y')]), h: +c[col('height_m')], crown: +c[col('crown_radius_m')], on: c[col('on_course')] === 'True'}))
  .filter(t => Math.abs(t.x) <= land.halfX && Math.abs(t.z) <= land.halfZ);
 const used = new Set(), match = [];
 for (const t of theirs) {
  let best = -1, d = 3;
  trees.forEach((u, i) => { if (used.has(i)) return; const q = Math.hypot(u.x - t.x, u.z - t.z); if (q < d) { d = q; best = i; } });
  if (best >= 0) { used.add(best); match.push({t, u: trees[best], d}); }
 }
 const dh = match.map(m => Math.abs(m.u.h - m.t.h)), dc = match.map(m => Math.abs(m.u.crown - m.t.crown));
 console.log(`TREES: theirs ${theirs.length} on the property, ours ${trees.length}; ${match.length} within 3 m of each other (${(100 * match.length / theirs.length).toFixed(0)}% of theirs, ${(100 * match.length / trees.length).toFixed(0)}% of ours); height error median ${pct(dh, .5).toFixed(2)} m, crown ${pct(dc, .5).toFixed(2)} m`);
}
