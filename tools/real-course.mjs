#!/usr/bin/env node
// A REAL COURSE BUILT END TO END BY SCRIPT (the course builder, stages 7 and 8;
// docs/COURSE_BUILDER.md, *The test course*).
//
//   node tools/real-course.mjs --data <folder> --naip <naip.tif> --osm <osm.json> --scorecard <card.json> [--out <file.fairway>]
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
import {trace, TRACE} from '../src/lidar/trace.js';
import {landFromSources, pictureOnLand, docFromLand} from '../src/builder/real-course.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';
import {testRound} from '../src/builder/test-round.js';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const dir = opt('data', process.env.FAIRWAY_LIDAR_TEST), naipFile = opt('naip', null), osmFile = opt('osm', null), cardFile = opt('scorecard', null), out = opt('out', null);
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

// 3. The holes, from OpenStreetMap's numbered greens and its tees.
const osm = osmFile ? JSON.parse(fs.readFileSync(osmFile, 'utf8')) : null;
const ll = (lat, lon) => { const p = toUtm(lat, lon, zone); return gridder.local(p.x, p.y); };
const ways = (osm?.elements || []).filter(e => e.type === 'way' && e.geometry).map(e => ({tags: e.tags || {}, ring: e.geometry.map(g => { const p = ll(g.lat, g.lon); return [p.x, p.z]; })}));
const centroid = r => ({x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length});
const greens = ways.filter(w => w.tags.golf === 'green' && /^\d+$/.test(w.tags.ref || '')).map(w => ({n: +w.tags.ref, ...centroid(w.ring)}));
const tees = ways.filter(w => w.tags.golf === 'tee').map(w => centroid(w.ring));
const holes = [];
if (greens.length && card) {
 const used = new Set(), sets = ['back', 'middle', 'front'];
 for (let n = 1; n <= card.par.length; n++) {
  const g = greens.find(q => q.n === n); if (!g) continue;
  const want = card.blue[n - 1] * .9144;
  // The tee that fits the card best: its straight distance near the card's
  // yardage (a dogleg's card is measured round the bend, so a tee nearer than
  // the card is likelier than one farther), near the green before it (a
  // course walks from a green to the next tee), and not already another
  // hole's (two holes can share one). OpenStreetMap's tee is the whole pad,
  // the card's yardage from a plate on it.
  const prev = greens.find(q => q.n === n - 1);
  const fit = tees.map((t, i) => { const d = Math.hypot(t.x - g.x, t.z - g.z), e = d > want ? 1.5 * (d - want) / want : (want - d) / want;
   return {t, i, d, e, cost: e + (prev ? Math.hypot(t.x - prev.x, t.z - prev.z) / 400 : 0) + (used.has(i) ? .2 : 0)}; }).filter(c => c.e < .4).sort((p, q) => p.cost - q.cost);
  const mine = fit.slice(0, 1);
  // Its shorter tees: free ones ahead of the back tee, within 80 m of it.
  for (const c of fit.slice(1)) if (mine.length < 3 && !used.has(c.i) && c.d < mine[0].d && Math.hypot(c.t.x - mine[0].t.x, c.t.z - mine[0].t.z) < 80) mine.push(c);
  for (const c of mine) used.add(c.i);
  // None near the card (OpenStreetMap lacks the tee): the likeliest of any.
  if (!mine.length) { const any = tees.map((t, i) => ({t, i, d: Math.hypot(t.x - g.x, t.z - g.z)})).map(c => ({...c, cost: Math.abs(c.d - want) / want + (prev ? Math.hypot(c.t.x - prev.x, c.t.z - prev.z) / 400 : 0)})).sort((p, q) => p.cost - q.cost)[0];
   if (any) { mine.push(any); console.log(`  hole ${n}: no tee within 40% of ${card.blue[n - 1]} yards; took one ${Math.round(any.d / .9144)} yards out`); } }
  if (!mine.length) { console.log(`  hole ${n}: no tee fits ${card.blue[n - 1]} yards`); continue; }
  mine.sort((p, q) => q.d - p.d);
  holes.push({number: n, par: card.par[n - 1], index: card.handicap?.[n - 1] ?? n, tees: mine.map((c, i) => ({x: c.t.x, z: c.t.z, set: sets[i]})), green: {x: g.x, z: g.z}});
 }
 console.log(`holes: ${holes.length} marked from ${greens.length} numbered greens and ${tees.length} tees`);
}

// 4. The trace, three ways, against OpenStreetMap's outlines.
const truth = new Array(land.nx * land.nz).fill(null);
const KINDS = {green: ['green'], tee: ['tee'], fairway: ['fairway'], sand: ['bunker'], water: ['water_hazard']};
const fillTruth = (ring, kind) => {
 const zs = ring.map(p => p[1]), j0 = Math.max(0, Math.ceil((Math.min(...zs) + land.halfZ) / land.cell)), j1 = Math.min(land.nz - 1, Math.floor((Math.max(...zs) + land.halfZ) / land.cell));
 for (let j = j0; j <= j1; j++) { const z = -land.halfZ + j * land.cell, xs = [];
  for (let q = 0, p = ring.length - 1; q < ring.length; p = q++) { const [ax, az] = ring[p], [bx, bz] = ring[q]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
  xs.sort((u, v) => u - v);
  for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.ceil((xs[k] + land.halfX) / land.cell)); i <= Math.min(land.nx - 1, Math.floor((xs[k + 1] + land.halfX) / land.cell)); i++) truth[j * land.nx + i] = kind; }
};
for (const [kind, tags] of Object.entries(KINDS)) for (const w of ways) if (tags.includes(w.tags.golf) || (kind === 'water' && w.tags.natural === 'water' && w.tags.water === 'pond')) fillTruth(w.ring, kind);
const score = codes => Object.fromEntries(Object.keys(KINDS).map(kind => { const c = TRACE.indexOf(kind); let i = 0, u = 0; for (let k = 0; k < codes.length; k++) { const p = codes[k] === c, t = truth[k] === kind; if (p && t) i++; if (p || t) u++; } return [kind, u ? i / u : null]; }));
// --shots <folder>: each trace drawn over the picture at a metre a pixel,
// OpenStreetMap's outlines in white -- to look at what the scores count.
const shots = opt('shots', null);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const chunk = (type, data) => { const tb = Buffer.from(type, 'latin1'), body = Buffer.concat([tb, data]); let c = -1; for (const v of body) c = CRC[(c ^ v) & 255] ^ (c >>> 8); const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length); return o; };
const TINT = {fairway: [40, 200, 40], semi: [150, 220, 90], tee: [0, 120, 255], green: [0, 255, 160], sand: [255, 60, 200], water: [0, 40, 255], path: [255, 160, 0]};
function picturePng(file, codes) {
 const s = 2, w = Math.floor(land.nx / s), h = Math.floor(land.nz / s), raw = Buffer.alloc((w * 3 + 1) * h);
 for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const k = y * s * land.nx + x * s, o = y * (w * 3 + 1) + 1 + x * 3, tint = TINT[TRACE[codes[k]]];
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
 if (argv.includes('--diagnose')) { const n = TRACE.map(() => 0), t = {}; for (let k = 0; k < r.codes.length; k++) n[r.codes[k]]++; for (const v of truth) if (v) t[v] = (t[v] || 0) + 1; console.log('  cells traced ' + TRACE.map((k, i) => k + ' ' + n[i]).join(', ') + '; outlined ' + JSON.stringify(t)); }
}

if (argv.includes('--trace-only')) process.exit(0);
// 5. The course, as a file; read back and measured.
const doc = docFromLand({land, traced: best, holes, trees, name: `${course.name} (test)`, landscape: 'midwest', credits: ['Elevation: USGS 3D Elevation Program, public domain'], source: {epsg: crs.epsg, files: sources.map(s => s.name)}});
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
