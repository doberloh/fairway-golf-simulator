#!/usr/bin/env node
// A REAL COURSE'S FILE AGAINST THE REAL PLACE (the course builder, stage 7;
// docs/COURSE_BUILDER.md, *The test course*). Whatever made the file -- door
// 2's page, or tools/real-course.mjs -- this reads only the .fairway file it
// saved and measures it:
//
//   node tools/built-compare.mjs --file <course.fairway> [--dem <dem.tif>] [--dtm <dtm.tif>]
//        [--osm <osm.json>] [--scorecard <card.json>] [--against <other.fairway>]
//
//   ground   the file's land against a bare-earth model (USGS's DEM, another
//            pipeline's DTM), on open ground: not water, sand, greens or tees
//            (the builder carves ponds and smooths greens on purpose)
//   surfaces the file's outlines against OpenStreetMap's (overlap by kind)
//   lengths  each hole's back tee against the club's card
//   round    the virtual golfer's test round
//   against  another file of the same place: ground and surfaces cell by cell
//
// A real course's file keeps where it is (`source.origin`, the land's middle
// in the survey's map units, and `source.epsg`); a file without one cannot be
// set against a map. Every input is local and none is committed.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {readGeoTiff} from '../src/lidar/geotiff.js';
import {toUtm, utmOfEpsg} from '../src/lidar/geo.js';
import {testRound} from '../src/builder/test-round.js';
import {osmWays, truthGrid, overlap} from './osm-holes.mjs';

const fmt = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); const q = f => v.length ? (100 * v[Math.min(v.length - 1, Math.floor(v.length * f))]).toFixed(1) : '-'; return `median ${q(.5)} cm, 95th ${q(.95)}, 99th ${q(.99)}, n ${v.length}`; };
const KIND_OF = {green: 'green', tee: 'tee', fairway: 'fairway', sand: 'sand', water: 'water'};

export async function compareBuilt(bytes, {dem = null, dtm = null, osm = null, card = null, against = null, round = true, log = console.log} = {}) {
 const doc = await readBuiltFile(bytes), w = worldFromDoc(doc), L = doc.land, out = {};
 const origin = doc.source?.origin, epsg = doc.source?.epsg;
 // The file's own land, bilinear between its samples.
 const heightAt = (x, z) => { const u = (x - L.x0) / L.cell, v = (z - L.z0) / (L.cellZ ?? L.cell), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  if (i < 0 || j < 0 || i + 1 >= L.nx || j + 1 >= L.nz) return NaN; const h = L.heights, n = L.nx;
  return (h[j * n + i] * (1 - fu) + h[j * n + i + 1] * fu) * (1 - fv) + (h[(j + 1) * n + i] * (1 - fu) + h[(j + 1) * n + i + 1] * fu) * fv; };
 // A 1 m grid over the property (not the margin past it).
 const grid = {cell: 1, halfX: Math.floor(doc.halfX), halfZ: Math.floor(doc.halfZ)};
 grid.nx = 2 * grid.halfX + 1; grid.nz = 2 * grid.halfZ + 1;
 const at = k => ({x: -grid.halfX + (k % grid.nx), z: -grid.halfZ + Math.floor(k / grid.nx)});
 const kinds = Array.from({length: grid.nx * grid.nz}, (_, k) => { const p = at(k), s = w.surface(p.x, p.z); return KIND_OF[s] ?? (s === 'fringe' ? 'semi' : s); });
 log(`file: "${doc.name}", ${(bytes.length / 1e6).toFixed(1)} MB, ${doc.holes.length} holes, ${doc.trees.length / 7} trees, ${doc.water.length} ponds; property ${2 * grid.halfX} x ${2 * grid.halfZ} m; ${origin ? `origin ${origin.x.toFixed(1)} E, ${origin.y.toFixed(1)} N, EPSG ${epsg}` : 'no origin recorded'}`);
 for (const [file, label] of [[dem, 'USGS\'s DEM'], [dtm, 'the other pipeline\'s DTM']]) {
  if (!file || !origin) continue;
  const r = await readGeoTiff(new Uint8Array(fs.readFileSync(file))), e = [], signed = [];
  const sample = (mx, my) => { const u = (mx - r.x0) / r.dx, v = (my - r.y0) / r.dy, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
   if (i < 0 || j < 0 || i + 1 >= r.width || j + 1 >= r.height) return NaN; const d = r.data, n = r.width;
   return (d[j * n + i] * (1 - fu) + d[j * n + i + 1] * fu) * (1 - fv) + (d[(j + 1) * n + i] * (1 - fu) + d[(j + 1) * n + i + 1] * fu) * fv; };
  for (let k = 0; k < kinds.length; k++) {
   if (['water', 'sand', 'green', 'tee'].includes(kinds[k])) continue;
   const p = at(k), theirs = sample(origin.x + p.x, origin.y - p.z), ours = heightAt(p.x, p.z);
   if (Number.isFinite(theirs) && Number.isFinite(ours)) { e.push(Math.abs(ours - theirs)); signed.push(ours - theirs); }
  }
  out[label] = e;
  log(`ground against ${label} (open ground, 1 m): ${fmt(e)}; mean signed ${(100 * signed.reduce((s, v) => s + v, 0) / Math.max(1, signed.length)).toFixed(1)} cm`);
 }
 if (osm && origin && epsg) {
  const zone = utmOfEpsg(epsg).zone, ways = osmWays(osm, (lat, lon) => { const p = toUtm(lat, lon, zone); return {x: p.x - origin.x, z: -(p.y - origin.y)}; });
  out.surfaces = overlap(truthGrid(ways, grid), k => kinds[k]);
  log(`surfaces against OpenStreetMap: ${Object.entries(out.surfaces).map(([k, v]) => `${k} ${v == null ? '-' : Math.round(100 * v)}%`).join(', ')}`);
 }
 if (card) {
  const rows = w.holes.map(h => ({n: h.number, built: Math.round(h.tees.blue.yards), card: card.blue[h.number - 1]})), err = rows.map(r => Math.abs(r.built - r.card)).sort((a, b) => a - b);
  out.lengths = rows;
  log(`lengths against the card (blue): ${rows.map(r => `${r.n}:${r.built}/${r.card}`).join(' ')}; median ${err[Math.floor(err.length / 2)]} yd off, worst ${err.at(-1)}; total ${rows.reduce((s, r) => s + r.built, 0)} against ${card.blue.reduce((s, v) => s + v, 0)}`);
 }
 if (against) {
  const other = await readBuiltFile(against), wo = worldFromDoc(other), dh = [];
  let same = 0, n = 0;
  for (let k = 0; k < kinds.length; k += 3) { const p = at(k), s = wo.surface(p.x, p.z), ko = KIND_OF[s] ?? (s === 'fringe' ? 'semi' : s); if (ko === kinds[k]) same++; n++; dh.push(Math.abs(w.height(p.x, p.z) - wo.height(p.x, p.z))); }
  out.against = {sameSurface: same / n};
  log(`against the other file: the same surface on ${(100 * same / n).toFixed(1)}% of the property; ground ${fmt(dh)}`);
 }
 if (round) {
  const r = await testRound(doc);
  out.round = r;
  log(`test round: ${r.total.toFixed(1)} against par ${r.par}; stuck: ${r.holes.filter(h => h.stuck).map(h => h.number).join(', ') || 'none'}`);
 }
 return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv[i + 1]; };
 const json = f => f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
 if (!opt('file')) { console.log('Pass --file <course.fairway>.'); process.exit(2); }
 await compareBuilt(new Uint8Array(fs.readFileSync(opt('file'))), {dem: opt('dem'), dtm: opt('dtm'), osm: json(opt('osm')), card: json(opt('scorecard')), against: opt('against') ? new Uint8Array(fs.readFileSync(opt('against'))) : null});
}
