#!/usr/bin/env node
// THE AUTO TRACE ON REAL COURSES, FROM THE PICTURE (the course builder's
// imagery iterations; docs/COURSE_BUILDER.md, *The amended goal*, and RESEARCH,
// *The auto trace from the picture, iteration by iteration*).
//
//   node tools/imagery-bench.mjs                  every course fetched
//   node tools/imagery-bench.mjs desert links     some of them
//   node tools/imagery-bench.mjs --shots          and a picture of each trace
//   node tools/imagery-bench.mjs --label "iteration 3"   a name in the log
//
// Each course tools/imagery-fetch.mjs saved (bench/shots/imagery/<course>/):
// a land grid of half a metre over the course and 30 m round it, FLAT and
// with no LIDAR in it -- the picture alone, as the owner asked ("focus on
// imagery") -- the NAIP tiles laid on it by their position, and the auto
// trace run as door 2 runs it: before any hole is marked. Then:
//
//   overlap   each surface against OpenStreetMap's hand-drawn outlines
//             (intersection over union, per cent)
//   edges     what the course will be made of, tidied as docFromLand tidies
//             it: patches under 10 m² ("specks"), holes under 10 m² inside a
//             surface ("pocks"), and how ragged its edges are -- the mask's
//             edge length against the same mask's after a 1.5 m majority
//             smoothing (1.0 smooth; a staircase or a frayed edge more)
//
// The last line of each run is appended to bench/shots/imagery/log.txt, so
// the iterations can be laid side by side. Local only: nothing it reads or
// writes is committed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readGeoTiffRgb} from '../src/lidar/geotiff.js';
import {toUtm, converter} from '../src/lidar/geo.js';
import {createGridder} from '../src/lidar/land.js';
import {trace, TRACE, boxMean} from '../src/lidar/trace.js';
import {pictureOnLand} from '../src/builder/real-course.js';
import {tidyCodes, SPECK} from '../src/builder/trace-edit.js';
import {osmWays, truthGrid, scoreCodes, KINDS} from './osm-holes.mjs';
import {OUT, COURSES} from './imagery-fetch.mjs';

const argv = process.argv.slice(2), flag = n => argv.includes(`--${n}`), opt = n => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv[i + 1]; };
const want = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--label');
const CELL = .5, PAD = 30;
const fmt = v => v == null ? '  -' : String(Math.round(100 * v)).padStart(3);

// The edges of one kind's patches in a code grid: specks, pocks, raggedness.
export function edgeStats(codes, nx, nz, cell, code) {
 const N = nx * nz, mask = Uint8Array.from(codes, c => c === code ? 1 : 0);
 const edge = m => { let e = 0; for (let k = 0; k < N; k++) { if (!m[k]) continue; const i = k % nx; if (i === 0 || !m[k - 1]) e++; if (i === nx - 1 || !m[k + 1]) e++; if (k < nx || !m[k - nx]) e++; if (k >= N - nx || !m[k + nx]) e++; } return e; };
 const smooth = Uint8Array.from(boxMean(Float32Array.from(mask), nx, nz, Math.max(1, Math.round(1.5 / cell))), v => v > .5 ? 1 : 0);
 const e0 = edge(mask), e1 = edge(smooth);
 // Patches and holes by flood fill.
 const seen = new Uint8Array(N), small = Math.round(10 / (cell * cell)); let specks = 0, pocks = 0, patches = 0;
 for (let s = 0; s < N; s++) {
  if (seen[s]) continue;
  const on = mask[s], list = [s]; seen[s] = 1; let border = false;
  for (let q = 0; q < list.length; q++) { const k = list[q], i = k % nx; if (i === 0 || i === nx - 1 || k < nx || k >= N - nx) border = true;
   for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !seen[n] && mask[n] === on) { seen[n] = 1; list.push(n); } }
  if (on) { patches++; if (list.length < small) specks++; }
  else if (!border && list.length < small) pocks++;
 }
 return {patches, specks, pocks, ragged: e1 ? e0 / e1 : null};
}

export async function benchCourse(key, {shots = false} = {}) {
 const dir = path.join(OUT, key), meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8')), osm = JSON.parse(fs.readFileSync(path.join(dir, 'osm.json'), 'utf8'));
 const [lon0, lat0, lon1, lat1] = meta.bbox_lonlat, zone = Math.floor(((lon0 + lon1) / 2 + 180) / 6) + 1, epsg = 26900 + zone;
 const a = toUtm(lat0, lon0, zone), b = toUtm(lat1, lon1, zone);
 const box = {x0: Math.min(a.x, b.x) - PAD, x1: Math.max(a.x, b.x) + PAD, y0: Math.min(a.y, b.y) - PAD, y1: Math.max(a.y, b.y) + PAD};
 const g = createGridder({box, cell: CELL, unit: {h: 1, v: 1}}), N = g.nx * g.nz;
 // The land: flat, no LIDAR -- the picture is all the trace has.
 const land = {nx: g.nx, nz: g.nz, cell: CELL, halfX: g.halfX, halfZ: g.halfZ, ground: new Float32Array(N), canopy: new Float32Array(N), surface: new Float32Array(N),
  intensity: new Float32Array(N).fill(NaN), water: new Uint8Array(N), building: new Uint8Array(N), multi: new Uint8Array(N), noReturns: new Uint8Array(N), filled: new Uint8Array(N), method: 'none', rgb: null};
 let picture = null;
 for (const t of meta.naip.tiles) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(dir, t)));
  const head = await readGeoTiffRgb(bytes, {box: {x0: 0, x1: 1, y0: 0, y1: 1}}), conv = converter({epsg, units: {h: 'metre', v: 'metre'}}, head.crs);
  if (!conv) throw Error(`${key}: cannot line ${t} (EPSG ${head.crs.epsg}) up with UTM ${zone}`);
  const c0 = conv(box.x0, box.y0), c1 = conv(box.x1, box.y1);
  const pic = await readGeoTiffRgb(bytes, {box: {x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), y0: Math.min(c0.y, c1.y), y1: Math.max(c0.y, c1.y)}}).catch(() => null);
  if (!pic) continue;
  picture = pictureOnLand(land, g, pic, {toPicture: conv, into: picture});
 }
 const cover = picture ? picture.has.reduce((s, v) => s + v, 0) / N : 0;
 const ways = osmWays(osm, (lat, lon) => { const p = toUtm(lat, lon, zone); return g.local(p.x, p.y); }), truth = truthGrid(ways, land);
 const debug = {}, t0 = performance.now(), r = trace(land, {picture, holes: [], mode: 'picture', debug}), secs = (performance.now() - t0) / 1000;
 if (flag('diagnose') && debug.turf) {
  // What each mapped surface measures in the picture: brightness, greenness
  // (NDVI with near-infrared), texture -- the medians the rules are set from.
  const q = (v, f) => { v.sort((x, y) => x - y); return v.length ? v[Math.floor(v.length * f)] : NaN; };
  for (const kind of [...Object.keys(KINDS), null]) { const L = [], G = [], T = []; for (let k = 0; k < N; k += 3) if (truth[k] === kind && picture?.has[k]) { L.push(debug.turf.lum[k]); T.push(debug.turf.tex[k]); const rr = picture.rgb[k * 3]; G.push(picture.nir ? (picture.nir[k] - rr) / (picture.nir[k] + rr + 1) : NaN); }
   console.log(`   ${String(kind ?? 'other').padEnd(8)} n ${String(L.length).padStart(7)}  lum ${q(L, .1).toFixed(0)}/${q(L, .5).toFixed(0)}/${q(L, .9).toFixed(0)}  ndvi ${q(G, .1).toFixed(2)}/${q(G, .5).toFixed(2)}/${q(G, .9).toFixed(2)}  tex ${q(T, .1).toFixed(3)}/${q(T, .5).toFixed(3)}/${q(T, .9).toFixed(3)}`); }
  console.log('   split', JSON.stringify(debug.turfSplit), 'limits', JSON.stringify(debug.turfLimits));
  { let raw = 0, kept = 0, isl = 0, tot = 0, traced = 0; for (let k = 0; k < N; k++) if (truth[k] === 'tee') { tot++; if (debug.turfRaw[k]) raw++; if (debug.turf[k]) kept++; if (debug.turf.islands?.[k]) isl++; if (r.codes[k] === TRACE.indexOf('tee')) traced++; } console.log(`   tees: ${tot} cells mapped; seen as mown ${(100 * raw / tot).toFixed(0)}%, kept as turf ${(100 * kept / tot).toFixed(0)}%, islands ${(100 * isl / tot).toFixed(0)}%, traced tee ${(100 * traced / tot).toFixed(0)}%`); }
  for (const kind of ['sand', 'green', 'fairway', 'water']) { const c = TRACE.indexOf(kind); let hit = 0, all = 0, tot = 0; for (let k = 0; k < N; k++) { const t = truth[k] === kind, q = r.codes[k] === c; if (t) tot++; if (q) all++; if (t && q) hit++; } console.log(`   ${kind}: finds ${(100 * hit / Math.max(1, tot)).toFixed(0)}% of the mapped, ${(100 * hit / Math.max(1, all)).toFixed(0)}% of what it draws is mapped`); }
  if (debug.greenCand) { let inC = 0, inT = 0, allC = 0, inK = 0, allK = 0; for (let k = 0; k < N; k++) { if (debug.greenCand[k]) allC++; if (debug.greens[k]) allK++; if (truth[k] === 'green') { inT++; if (debug.greenCand[k]) inC++; if (debug.greens[k]) inK++; } } console.log(`   greens: candidates hold ${(100 * inC / inT).toFixed(0)}% of the mapped greens (${allC} cells); kept patches hold ${(100 * inK / inT).toFixed(0)}% (${allK} cells)`); }
 }
 // What the course would be made of: tidied as docFromLand tidies it.
 const codes = Uint8Array.from(r.codes); tidyCodes(codes, land.nx, land.nz, CELL, SPECK);
 const score = scoreCodes(truth, codes), edges = Object.fromEntries(Object.keys(KINDS).map(k => [k, edgeStats(codes, land.nx, land.nz, CELL, TRACE.indexOf(k))]));
 if (shots) writeShot(path.join(dir, 'trace.png'), land, picture, codes, truth);
 return {key, name: meta.name, cover, secs, score, edges, size: `${(2 * land.halfX).toFixed(0)} x ${(2 * land.halfZ).toFixed(0)} m`};
}

// The trace over the picture at a metre a pixel, OpenStreetMap's outlines white.
import zlib from 'node:zlib';
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const chunk = (type, data) => { const tb = Buffer.from(type, 'latin1'), body = Buffer.concat([tb, data]); let c = -1; for (const v of body) c = CRC[(c ^ v) & 255] ^ (c >>> 8); const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length); return o; };
const TINT = {fairway: [40, 200, 40], semi: [150, 220, 90], tee: [0, 120, 255], green: [0, 255, 160], sand: [255, 60, 200], water: [0, 40, 255], path: [255, 160, 0]};
function writeShot(file, land, picture, codes, truth) {
 const s = 2, w = Math.floor(land.nx / s), h = Math.floor(land.nz / s), raw = Buffer.alloc((w * 3 + 1) * h);
 for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const k = y * s * land.nx + x * s, o = y * (w * 3 + 1) + 1 + x * 3, tint = TINT[TRACE[codes[k]]];
  let c = picture?.has[k] ? [picture.rgb[k * 3], picture.rgb[k * 3 + 1], picture.rgb[k * 3 + 2]] : [60, 60, 60];
  if (tint) c = c.map((v, i) => v * .45 + tint[i] * .55);
  if (truth[k] && (truth[k + s] !== truth[k] || truth[k + s * land.nx] !== truth[k])) c = [255, 255, 255];
  raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
 }
 const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
 fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const have = COURSES.map(c => c.key).filter(k => fs.existsSync(path.join(OUT, k, 'course.json')) && (!want.length || want.includes(k)));
 const kinds = Object.keys(KINDS), mean = Object.fromEntries(kinds.map(k => [k, []])), rag = Object.fromEntries(kinds.map(k => [k, []]));
 let specks = 0, pocks = 0;
 console.log(`course      cover  ${kinds.map(k => k.padStart(7)).join('')}   specks pocks  ragged (green fairway sand water)`);
 for (const key of have) {
  try {
   const r = await benchCourse(key, {shots: flag('shots')});
   for (const k of kinds) { if (r.score[k] != null) mean[k].push(r.score[k]); if (r.edges[k].ragged != null) rag[k].push(r.edges[k].ragged); }
   const sp = kinds.reduce((s, k) => s + r.edges[k].specks, 0), po = kinds.reduce((s, k) => s + r.edges[k].pocks, 0); specks += sp; pocks += po;
   console.log(`${key.padEnd(11)} ${(100 * r.cover).toFixed(0).padStart(4)}%  ${kinds.map(k => fmt(r.score[k]).padStart(7)).join('')}   ${String(sp).padStart(6)} ${String(po).padStart(5)}  ${['green', 'fairway', 'sand', 'water'].map(k => r.edges[k].ragged?.toFixed(2) ?? '-').join(' ')}   (${r.size}, ${r.secs.toFixed(1)} s)`);
  } catch (e) { console.log(`${key.padEnd(11)} FAILED: ${e.message}`); }
 }
 const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
 const line = `${new Date().toISOString().slice(0, 16)} ${opt('label') ?? ''} | ${have.length} courses | overlap ${kinds.map(k => `${k} ${fmt(avg(mean[k])).trim()}`).join(', ')} | specks ${specks}, pocks ${pocks} | ragged ${kinds.map(k => `${k} ${avg(rag[k])?.toFixed(2) ?? '-'}`).join(', ')}`;
 console.log('\n' + line);
 fs.appendFileSync(path.join(OUT, 'log.txt'), line + '\n');
}
