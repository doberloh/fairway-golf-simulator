#!/usr/bin/env node
// A REAL COURSE BUILT END TO END BY SCRIPT (the course builder, stages 7 and 8;
// docs/COURSE_BUILDER.md, *The test course*).
//
//   node tools/real-course.mjs --data <folder> --naip <naip.tif> --osm <osm.json> --scorecard <card.json> [--out <file.fairway>]
//   ... --refine      OpenStreetMap damaged (osm-holes.mjs damageTruth) and refined from
//                     the LIDAR, the picture, and both in turn; scored, then stop
//
// Door 2's own pipeline (src/builder/real-course.js) with no clicks: the raw
// LIDAR of <folder>/raw gathered into land over the course's box
// (<folder>/course.json), the aerial picture laid on it by its own position,
// the holes marked from OpenStreetMap's numbered greens with each tee given
// to the hole whose green it stands the scorecard's yardage from, the auto
// trace three ways (LIDAR alone, picture alone, LIDAR first) each scored
// against OpenStreetMap's hand-drawn outlines, the course written as a
// built file, read back, its holes measured against the scorecard, and the
// virtual golfer's test round played on it. Every input is the owner's or
// downloaded for testing; none is committed, and neither is the course built.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {openSource} from '../src/lidar/formats.js';
import {readGeoTiffRgb} from '../src/lidar/geotiff.js';
import {toUtm, utmOfEpsg, converter} from '../src/lidar/geo.js';
import {trace, TRACE, refineTrace} from '../src/lidar/trace.js';
import {landFromSources, pictureOnLand, docFromLand} from '../src/builder/real-course.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';
import {testRound} from '../src/builder/test-round.js';
import {osmWays, holesFromOsm, truthGrid, scoreCodes, damageTruth, lineUpTruth, KINDS} from './osm-holes.mjs';
import {worthingtonDir} from './lidar-home.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const dir = opt('data', worthingtonDir()), naipFile = opt('naip', null), osmFile = opt('osm', null), cardFile = opt('scorecard', null), out = opt('out', null);
if (!dir || !fs.existsSync(dir)) { console.log('No data folder (pass --data <folder>). Nothing to build.'); process.exit(0); }
const t0 = performance.now(), secs = () => ((performance.now() - t0) / 1000).toFixed(0) + ' s';
const card = cardFile ? JSON.parse(fs.readFileSync(cardFile, 'utf8')) : null;
const course = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
const lazModule = async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); };
const M = await lazModule();

// 1. The land.
const sources = [];
for (const f of fs.readdirSync(path.join(dir, 'raw')).filter(f => /\.la[sz]$/i.test(f))) sources.push({...(await openSource(f, new Uint8Array(fs.readFileSync(path.join(dir, 'raw', f))), {lazModule: M})), name: f});
const crs = sources[0].crs, zone = utmOfEpsg(crs.epsg).zone;
const [lon0, lat0, lon1, lat1] = course.bbox_lonlat, a = toUtm(lat0, lon0, zone), b = toUtm(lat1, lon1, zone), pad = 30;
const box = {x0: Math.min(a.x, b.x) - pad, x1: Math.max(a.x, b.x) + pad, y0: Math.min(a.y, b.y) - pad, y1: Math.max(a.y, b.y) + pad};
const {land, gridder, trees} = await landFromSources(sources, box);
console.log(`land: ${land.nx} x ${land.nz} at ${land.cell} m (${(2 * land.halfX).toFixed(0)} x ${(2 * land.halfZ).toFixed(0)} m with the margin), ${land.points.toLocaleString()} points, ground ${land.method}, ${trees.length} trees; ${secs()}`);

// 2. The picture, by its own position.
let picture = null;
// Several pictures (comma-separated): each fills what the ones before left.
for (const file of naipFile ? naipFile.split(',') : []) {
 const bytes = new Uint8Array(fs.readFileSync(file));
 const head = await readGeoTiffRgb(bytes, {box: {x0: 0, x1: 1, y0: 0, y1: 1}}).catch(() => null);
 const toPic = converter(crs, head?.crs ?? crs);
 const c0 = toPic(...Object.values(gridder.map(-land.halfX, land.halfZ))), c1 = toPic(...Object.values(gridder.map(land.halfX, -land.halfZ)));
 const pic = await readGeoTiffRgb(bytes, {box: {x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), y0: Math.min(c0.y, c1.y), y1: Math.max(c0.y, c1.y)}});
 picture = pictureOnLand(land, gridder, pic, {toPicture: toPic, into: picture});
 console.log(`picture: ${pic.width} x ${pic.height} px at ${pic.dx} m, EPSG ${pic.crs.epsg} -> lined up by its position; ${(100 * picture.has.reduce((s, v) => s + v, 0) / picture.has.length).toFixed(0)}% of the land covered; ${secs()}`);
}

// 3. The holes, from OpenStreetMap's numbered greens and its tees (osm-holes.mjs).
const osm = osmFile ? JSON.parse(fs.readFileSync(osmFile, 'utf8')) : null;
const ways = osmWays(osm, (lat, lon) => { const p = toUtm(lat, lon, zone); return gridder.local(p.x, p.y); });
const holes = osm && card ? holesFromOsm(ways, card, t => console.log(t)) : [];

// 4. The trace, three ways, against OpenStreetMap's outlines.
const truth = truthGrid(ways, land);
const score = codes => scoreCodes(truth, codes);
// --shots <folder>: each trace drawn over the picture at a metre a pixel,
// OpenStreetMap's outlines in white -- to look at what the scores count;
// --crop x,z,size adds that square (local metres) at the land's own cell.
const shots = opt('shots', null);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const chunk = (type, data) => { const tb = Buffer.from(type, 'latin1'), body = Buffer.concat([tb, data]); let c = -1; for (const v of body) c = CRC[(c ^ v) & 255] ^ (c >>> 8); const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length); return o; };
const TINT = {fairway: [40, 200, 40], semi: [150, 220, 90], tee: [0, 120, 255], green: [0, 255, 160], sand: [255, 60, 200], water: [0, 40, 255], path: [255, 160, 0]};
// `crop` [x, z, size] in local metres: that square at the land's own cell.
function picturePng(file, codes, crop = null) {
 const s = crop ? 1 : 2, i0 = crop ? Math.round((crop[0] + land.halfX) / land.cell) : 0, j0 = crop ? Math.round((crop[1] + land.halfZ) / land.cell) : 0;
 const w = crop ? Math.round(crop[2] / land.cell) : Math.floor(land.nx / s), h = crop ? w : Math.floor(land.nz / s), raw = Buffer.alloc((w * 3 + 1) * h);
 for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const k = (j0 + y * s) * land.nx + i0 + x * s, o = y * (w * 3 + 1) + 1 + x * 3, tint = TINT[TRACE[codes[k]]];
  let c = picture?.has[k] ? [picture.rgb[k * 3], picture.rgb[k * 3 + 1], picture.rgb[k * 3 + 2]] : [60, 60, 60];
  if (tint) c = c.map((v, i) => v * .45 + tint[i] * .55);
  const edge = truth[k] && (truth[k + s] !== truth[k] || truth[k + s * land.nx] !== truth[k]);
  if (edge) c = [255, 255, 255];
  raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
 }
 const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
 fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const markHoles = holes.map(h => ({tees: h.tees, green: h.green}));
// --diagnose: what each surface looks like to each witness, inside
// OpenStreetMap's outlines -- the numbers the trace's rules are set from.
if (argv.includes('--diagnose')) {
 const {features} = await import('../src/lidar/trace.js');
 const F = features(land), q = (a, f) => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length * f)].toFixed(3) : '-'; };
 for (const kind of [...Object.keys(KINDS), null]) {
  const ks = []; for (let k = 0; k < truth.length; k++) if (truth[k] === kind && land.canopy[k] < 1) ks.push(k);
  const pick = f => ks.map(f);
  const row = [['intensity', k => land.intensity[k]], ['rough', k => F.rough[k]], ['slope', k => F.slope[k]], ['hollow', k => F.hollow[k]]];
  if (picture) row.push(['lum', k => picture.has[k] ? .299 * picture.rgb[k * 3] + .587 * picture.rgb[k * 3 + 1] + .114 * picture.rgb[k * 3 + 2] : NaN], ['exg', k => { const r = picture.rgb[k * 3], g = picture.rgb[k * 3 + 1], b = picture.rgb[k * 3 + 2]; return picture.has[k] ? (2 * g - r - b) / (r + g + b + 1) : NaN; }], ['ndvi', k => picture.has[k] && picture.nir ? (picture.nir[k] - picture.rgb[k * 3]) / (picture.nir[k] + picture.rgb[k * 3] + 1) : NaN]);
  if (picture) { const pass = ks.filter(k => { if (!picture.has[k]) return false; const r = picture.rgb[k * 3], g = picture.rgb[k * 3 + 1], b = picture.rgb[k * 3 + 2]; return Math.max(r, g, b) - Math.min(r, g, b) < 70 && .299 * r + .587 * g + .114 * b > 150; }).length; const sat = ks.filter(k => picture.has[k]).map(k => Math.max(picture.rgb[k * 3], picture.rgb[k * 3 + 1], picture.rgb[k * 3 + 2]) - Math.min(picture.rgb[k * 3], picture.rgb[k * 3 + 1], picture.rgb[k * 3 + 2])); console.log(`  ${kind}: pale and grey ${(100 * pass / ks.length).toFixed(0)}%, saturation ${q(sat, .1)}/${q(sat, .5)}/${q(sat, .9)}, water class ${q(ks.map(k => land.water[k]), .5)}/${q(ks.map(k => land.water[k]), .9)}, no return ${(100 * ks.filter(k => land.noReturns[k]).length / ks.length).toFixed(0)}%, filled ${(100 * ks.filter(k => land.filled[k]).length / ks.length).toFixed(0)}%`); }
  console.log(`${String(kind ?? 'other').padEnd(8)} n ${String(ks.length).padStart(7)}  ` + row.map(([n, f]) => { const v = pick(f); return `${n} ${q(v, .1)}/${q(v, .5)}/${q(v, .9)}`; }).join('  '));
 }
}
let best = null;
for (const mode of ['lidar', 'picture', 'both']) {
 if (mode !== 'lidar' && !picture) continue;
 const dbg = argv.includes('--diagnose') ? {} : null, t = performance.now(), r = trace(land, {picture, holes: markHoles, mode, debug: dbg}), s = score(r.codes);
if (dbg) { console.log(`  yardstick: laser ${dbg.iF?.toFixed(3)}, picture ${JSON.stringify(dbg.fc)}`); for (const [name, kind] of [['lidarWater', 'water'], ['pictureWater', 'water'], ['lidarSand', 'sand'], ['pictureSand', 'sand']]) for (const key of [name, name + 'Kept']) { const m = dbg[key]; if (!m) continue; let hit = 0, all = 0, tot = 0; for (let k = 0; k < m.length; k++) { if (truth[k] === kind) { tot++; if (m[k]) hit++; } if (m[k]) all++; } console.log(`  ${key.padEnd(18)} finds ${(100 * hit / tot).toFixed(0)}% of the ${kind}, ${all} cells, ${(100 * hit / Math.max(1, all)).toFixed(0)}% of them right`); } }
 console.log(`trace ${mode.padEnd(8)} ${Object.entries(s).map(([k, v]) => `${k} ${v == null ? '-' : (100 * v).toFixed(0)}`).join('  ')}   (${((performance.now() - t) / 1000).toFixed(1)} s)`);
 if (mode === 'both' || !best) best = r;
 if (shots) picturePng(path.join(shots, `worthington-trace-${mode}.png`), r.codes);
 if (shots && opt('crop', null)) picturePng(path.join(shots, `worthington-trace-${mode}-crop.png`), r.codes, opt('crop').split(',').map(Number));
 if (argv.includes('--diagnose')) { const n = TRACE.map(() => 0), t = {}; for (let k = 0; k < r.codes.length; k++) n[r.codes[k]]++; for (const v of truth) if (v) t[v] = (t[v] || 0) + 1; console.log('  cells traced ' + TRACE.map((k, i) => k + ' ' + n[i]).join(', ') + '; outlined ' + JSON.stringify(t)); }
}

// --refine: OPENSTREETMAP THEN THE LIDAR (the owner, 1 November 2026: "the
// best path for mapping is pull open street maps and then fit to LIDAR").
if (argv.includes('--refine')) {
 // The yardstick lined up with the place first (lineUpTruth): by the LIDAR,
 // and by the picture for comparison.
 const byL = lineUpTruth(truth, land, {mode: 'lidar'}), byP = picture ? lineUpTruth(truth, land, {picture, mode: 'picture'}) : null;
 console.log(`OpenStreetMap lies off the LIDAR by ${byL.x.toFixed(1)}, ${byL.z.toFixed(1)} m (gain ${(100 * byL.gain).toFixed(0)}%)${byP ? `, off the picture by ${byP.x.toFixed(1)}, ${byP.z.toFixed(1)} m (gain ${(100 * byP.gain).toFixed(0)}%)` : ''}; scored against it lined up by the LIDAR, the raw map's score in brackets`);
 const aligned = byL.truth, scoreA = codes => scoreCodes(aligned, codes);
 const dmg = (opt('damage', '4,0')).split(',').map(Number), damaged = damageTruth(truth, land, {shiftM: dmg[0], dz: dmg[1]}), row = (name, codes, extra = '') => console.log(`${name.padEnd(20)} ${Object.entries(scoreA(codes)).map(([k, v]) => `${k} ${v == null ? '-' : (100 * v).toFixed(0)} (${score(codes)[k] == null ? '-' : (100 * score(codes)[k]).toFixed(0)})`).join('  ')}${extra}`); void row;
 const row0 = (name, codes, extra = '') => console.log(`${name.padEnd(20)} ${Object.entries(score(codes)).map(([k, v]) => `${k} ${v == null ? '-' : (100 * v).toFixed(0)}`).join('  ')}${extra}`);
 row(`OSM moved ${dmg[0]}, ${dmg[1]} m`, damaged);
 for (const mode of ['lidar', 'picture']) for (const mown of [true, false]) {
  if (mode === 'picture' && !picture) continue;
  const t = performance.now(), r = refineTrace(land, damaged, {picture, mode, mown}), sh = refineTrace.lastShift;
  row(`refined, ${mode}${mown ? '' : ', mown kept'}`, r, ` (lined up ${sh ? `${sh.x.toFixed(1)}, ${sh.z.toFixed(1)} m` : '-'}; ${((performance.now() - t) / 1000).toFixed(1)} s)`);
  if (shots) picturePng(path.join(shots, `worthington-refine-${mode}.png`), r);
 }
 process.exit(0);
}
if (argv.includes('--trace-only')) process.exit(0);
// 5. The course, as a file; read back and measured.
const doc = docFromLand({land, traced: best, holes, trees, name: `${course.name} (test)`, landscape: 'midwest', credits: ['Elevation: USGS 3D Elevation Program, public domain'], source: {epsg: crs.epsg, files: sources.map(s => s.name), origin: {x: gridder.center.x, y: gridder.center.y}}});
const bytes = await writeBuiltFile(doc, BUILT_VERSION);
if (out) fs.writeFileSync(out, bytes);
const w = worldFromDoc(await readBuiltFile(bytes));
console.log(`file: ${(bytes.length / 1e6).toFixed(1)} MB, ${doc.trees.length / 7} trees, ${doc.water.length} ponds; ${secs()}`);
if (card) {
 const rows = w.holes.map(h => ({n: h.number, built: Math.round(h.tees.blue.yards), card: card.blue[h.number - 1]}));
 const err = rows.map(r => Math.abs(r.built - r.card));
 console.log(`lengths against the scorecard (blue): ${rows.map(r => `${r.n}:${r.built}/${r.card}`).join(' ')}`);
 console.log(`  worst ${Math.max(...err)} yd, median ${err.sort((p, q) => p - q)[Math.floor(err.length / 2)]} yd; total ${rows.reduce((s, r) => s + r.built, 0)} against ${card.blue.reduce((s, v) => s + v, 0)}`);
}
const r = await testRound(await readBuiltFile(bytes));
const mean = h => h.strokes.reduce((a, b) => a + b, 0) / h.strokes.length;
console.log(`test round: ${r.total.toFixed(1)} against par ${r.par} (${r.holes.map(h => `${h.number}:${mean(h).toFixed(1)}`).join(' ')}); stuck: ${r.holes.filter(h => h.stuck).map(h => `${h.number} on ${h.stuck.on} at ${h.stuck.x.toFixed(0)},${h.stuck.z.toFixed(0)}`).join(', ') || 'none'}; ${secs()}`);
