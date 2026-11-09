#!/usr/bin/env node
// EVERY REAL COURSE WE HAVE LIDAR FOR, BUILT AS DOOR 2 BUILDS ONE (the owner,
// 1 November 2026: "build me a working version of every course in the LiDAR
// folder ... Prefer open street map tracing with LiDAR cleanup"). For each
// course: its boundary from OpenStreetMap, the land from its survey in
// bench/lidar (fetched from 3DEP's Entwine copy where there is none),
// OpenStreetMap laid as layers and refined with the LIDAR, the holes picked
// for that course, moved with the map and fitted to their greens and tees
// (osm-course.js), the trees merged, the course made (docFromLand), written,
// read back as the game reads it, and played by the virtual golfers. Door 2's
// own modules throughout, so what is built here is what a player gets.
//
//   node tools/build-courses.mjs                 every course
//   node tools/build-courses.mjs sahalee druids-glen    some
//
// Writes to bench/courses/<key>/ (git-ignored): the course (.fairway), the
// map's answer (osm.json, kept so a rerun asks nothing), a plan (plan.png:
// the trace, every hole's line white, greens red, tees blue) and report.txt.
// Other people's data -- never committed or shipped.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {converter} from '../src/lidar/geo.js';
import {toMetres} from '../src/lidar/las.js';
import {TRACE, refineTrace} from '../src/lidar/trace.js';
import {landFromSources, docFromLand, crsOfSources, coverage} from '../src/builder/real-course.js';
import {createTrace} from '../src/builder/trace-edit.js';
import {overpassQuery, osmFeatures, layOsm, mergeTrees, OSM_CREDIT} from '../src/builder/osm.js';
import {osmCourses, osmHoles, shiftHoles, fitHoles} from '../src/builder/osm-course.js';
import {writeBuiltFile, readBuiltFile, validateDoc} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';
import {createEditor} from '../src/builder/editing.js';
import {BIOMES} from '../src/biomes.js';
import {testRound} from '../src/builder/test-round.js';
import {searchLidar, downloadLidar} from '../src/builder/lidar-search.js';
import {lidarDir, lidarFiles, cachedGet, courseSources} from './lidar-home.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'bench', 'courses');
const UA = 'FairwayCourseBuilder/0.1 (testing; github.com/doberloh/fairway-golf-simulator)';
// Every course: its folder under bench/lidar, OpenStreetMap's golf_course
// (way or relation), the landscape it is built as.
export const COURSES = {
 worthington: {name: 'Worthington Country Club', osm: 'way["leisure"="golf_course"]["name"~"Worthington Country Club|GreatLIFE"]', landscape: 'heartland'},
 sahalee: {name: 'Sahalee Country Club', osm: 'way(1002185812)', landscape: 'pacnw'},
 'tpc-scottsdale': {name: 'TPC Scottsdale (Stadium)', osm: 'way(78388948)', landscape: 'dmountain'},
 breckenridge: {name: 'Breckenridge Golf Club', osm: 'way(1571231453)', landscape: 'mountains'},
 // On the Oregon Dunes, the Pacific links (the US landscapes goal, step 10;
 // PLACED: the study puts it "in the lowland, but built as Links").
 'chambers-bay': {name: 'Chambers Bay', osm: 'way(26787026)', landscape: 'seaside'},
 // The owner's addition of 3 November 2026: Bully Pulpit at Medora, North
 // Dakota, on the Badlands (its survey fetched from 3DEP).
 'bully-pulpit': {name: 'Bully Pulpit', osm: 'way(245874307)', landscape: 'badlands', skin: true},
 // Troon North's Monument (9 November 2026), the course Desert Mountain was drawn from
 // (the owner's Troon North photographs): its granite hills skinned from the land.
 // One boundary round both of the club's courses; the Monument's holes by name.
 'troon-north': {name: 'Troon North (Monument)', osm: 'relation(1389558)', course: 'Monument Course', bbox: [-111.8800, 33.7355, -111.8455, 33.7520], landscape: 'dmountain', skin: true},
 'key-west': {name: 'Key West Golf Club', osm: 'way(84902763)', landscape: 'flpalms'},
 northwood: {name: 'Northwood Golf Club', osm: 'way(1246462624)', landscape: 'redwood'},
 ekwanok: {name: 'Ekwanok Country Club', osm: 'way(424514357)', landscape: 'newengland'},
 'arcadia-bluffs': {name: 'Arcadia Bluffs', osm: 'way(293247442)', landscape: 'seaside'},
 'battle-creek': {name: 'Battle Creek Golf Course', osm: 'way(54454203)', landscape: 'pacnw'},
 'salish-cliffs': {name: 'Salish Cliffs Golf Club', osm: 'way(226885836)', landscape: 'pacnw'},
 snohomish: {name: 'Snohomish Golf Course', osm: 'way(235184973)', landscape: 'pacnw'},
 'nile-shrine': {name: 'Nile Shrine Golf Course', osm: 'way(35451043)', landscape: 'pacnw'},
 'druids-glen': {name: 'Druids Glen Golf Course', osm: 'way(350237324)', landscape: 'pacnw'},
};

const wait = ms => new Promise(r => setTimeout(r, ms));
// Overpass, politely: named, retried, every answer kept.
async function overpass(query, file) {
 if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
 for (let attempt = 0; attempt < 5; attempt++) {
  const r = await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA}, body: 'data=' + encodeURIComponent(query)}).catch(() => null);
  if (r?.ok) { const j = await r.json(); if (file) fs.writeFileSync(file, JSON.stringify(j)); return j; }
  console.log(`  Overpass ${r?.status ?? 'no answer'}; waiting`); await wait(20000 * (attempt + 1));
 }
 throw Error('Overpass would not answer');
}
const lazModule = async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); };

// A PNG of the trace with the holes drawn: a metre a pixel.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const chunk = (type, data) => { const tb = Buffer.from(type, 'latin1'), body = Buffer.concat([tb, data]); let c = -1; for (const v of body) c = CRC[(c ^ v) & 255] ^ (c >>> 8); const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length); return o; };
const COL = {rough: [58, 84, 40], fairway: [96, 170, 70], semi: [80, 130, 55], tee: [150, 210, 120], green: [130, 230, 120], sand: [230, 215, 160], water: [60, 110, 200], path: [180, 180, 175]};
function planPng(file, land, codes, holes, trees) {
 const s = Math.max(1, Math.round(1 / land.cell)), w = Math.floor(land.nx / s), h = Math.floor(land.nz / s), px = new Uint8Array(w * h * 3);
 for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = COL[TRACE[codes[y * s * land.nx + x * s]]] ?? [70, 90, 60], o = (y * w + x) * 3; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
 const put = (x, z, c) => { const i = Math.round((x + land.halfX) / land.cell / s), j = Math.round((z + land.halfZ) / land.cell / s); if (i >= 0 && j >= 0 && i < w && j < h) { const o = (j * w + i) * 3; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; } };
 for (const t of trees) put(t.x, t.z, [25, 50, 25]);
 const dot = (x, z, r, c) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) put(x + a, z + b, c); };
 for (const hl of holes) {
  if (!hl) continue;
  const pts = [[hl.tees[0].x, hl.tees[0].z], ...hl.aims.map(a => [a.x, a.z]), [hl.green.x, hl.green.z]];
  for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let k = 0; k <= n; k++) put(ax + (bx - ax) * k / n, az + (bz - az) * k / n, [255, 255, 255]); }
  for (const t of hl.tees) dot(t.x, t.z, 2, [40, 90, 255]);
  dot(hl.green.x, hl.green.z, 2, [255, 40, 40]);
 }
 const raw = Buffer.alloc((w * 3 + 1) * h);
 for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(px.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
 const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
 fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

async function build(key) {
 const c = COURSES[key], dir = path.join(OUT, key), t0 = performance.now(), log = [];
 const say = s => { console.log(`${key}: ${s}`); log.push(s); };
 fs.mkdirSync(dir, {recursive: true});
 // 1. The course's boundary, from the map.
 const edge = await overpass(`[out:json][timeout:90];${c.osm};out geom;`, path.join(dir, 'boundary.json'));
 const el = edge.elements[0]; if (!el) throw Error('OpenStreetMap has no such course');
 const geom = el.geometry ?? el.members.flatMap(m => m.geometry ?? []);
 const lats = geom.map(p => p.lat), lons = geom.map(p => p.lon), padLat = 80 / 111320, padLon = 80 / (111320 * Math.cos(lats[0] * Math.PI / 180));
 // `bbox` [lon0, lat0, lon1, lat1]: the one course's own square, where the boundary is a club's.
 const ll = c.bbox ? {lon0: c.bbox[0], lat0: c.bbox[1], lon1: c.bbox[2], lat1: c.bbox[3]} : {lon0: Math.min(...lons) - padLon, lat0: Math.min(...lats) - padLat, lon1: Math.max(...lons) + padLon, lat1: Math.max(...lats) + padLat};
 // 2. The survey: the folder's, else 3DEP's Entwine copy over the course.
 const M = await lazModule();
 let sources = await courseSources(key, M);
 if (!sources.length) {
  say('no survey here: fetching 3DEP\'s Entwine copy');
  const box = {lon0: ll.lon0 - padLon, lat0: ll.lat0 - padLat, lon1: ll.lon1 + padLon, lat1: ll.lat1 + padLat};
  const found = (await searchLidar('usgs', box)).find(f => f.ept); if (!found) throw Error('no 3DEP LIDAR over it');
  const out = lidarDir(key); fs.mkdirSync(out, {recursive: true});
  await downloadLidar(found, box, {get: cachedGet(path.join(out, 'ept')), lazModule: M});
  fs.writeFileSync(path.join(out, 'survey.json'), JSON.stringify({found: {...found, tileUrls: undefined}, box, course: c.name}, null, 1));
  sources = await courseSources(key, M);
 }
 const crs = crsOfSources(sources), fromDeg = converter({epsg: 4326, geographic: true}, crs);
 const corners = [[ll.lon0, ll.lat0], [ll.lon1, ll.lat0], [ll.lon1, ll.lat1], [ll.lon0, ll.lat1]].map(([lon, lat]) => fromDeg(lon, lat));
 const box = {x0: Math.min(...corners.map(p => p.x)), x1: Math.max(...corners.map(p => p.x)), y0: Math.min(...corners.map(p => p.y)), y1: Math.max(...corners.map(p => p.y))};
 const {land, gridder, trees: lidarTrees} = await landFromSources(sources, box);
 const cov = coverage(land), covered = cov.reduce((s, v) => s + v, 0) / cov.length;
 say(`land ${land.nx} x ${land.nz} at ${land.cell} m, ${(2 * land.halfX).toFixed(0)} x ${(2 * land.halfZ).toFixed(0)} m, EPSG ${crs.epsg}, ${land.points.toLocaleString()} points, ${(100 * covered).toFixed(0)}% surveyed, ${lidarTrees.length.toLocaleString()} trees; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
 const toLocal = (lat, lon) => { const m = fromDeg(lon, lat); return gridder.local(m.x, m.y); };
 // 3. OpenStreetMap over the land, as door 2 asks for it.
 const osmFile = path.join(dir, 'osm.json');
 // door 2's own query (osm.js overpassQuery), retried when the server is busy.
 const json = await overpass(overpassQuery([ll.lon0, ll.lat0, ll.lon1, ll.lat1]), osmFile);
 const feats = osmFeatures(json, toLocal), courses = osmCourses(json, toLocal, feats);
 // `course`: which of the boundary's courses, when it holds two (osm-course.js `only`).
 const wantId = `${el.type}/${el.id}${c.course ? ':' + c.course : ''}`, course = courses.find(q => q.id === wantId) ?? courses[0];
 say(`map: ${courses.map(q => `${q.name} (${q.id}) ${q.holes} holes`).join('; ')}; building ${course.name}`);
 const model = createTrace(land, {trees: []}), laid = layOsm(model, feats), osmTrees = model.state.trees;
 say(`laid ${Object.entries(laid).map(([k, n]) => `${n} ${k}`).join(', ')}`);
 // 4. Refined with the LIDAR; the holes moved with the map, then fitted.
 // A scorecard in the course's folder (card.json: par, blue, white, red), when
 // the map numbers greens rather than drawing hole lines.
 const cardFile = path.join(dir, 'card.json'), card = fs.existsSync(cardFile) ? JSON.parse(fs.readFileSync(cardFile, 'utf8')) : null;
 const raw = osmHoles(feats, {within: course.rings, only: course.only ?? null, codes: model.state.codes, land, card});
 const codes = refineTrace(land, model.state.codes, {mode: 'lidar'}), shift = refineTrace.lastShift ?? {x: 0, z: 0};
 // Eighteen when the map numbers all eighteen, else nine when it numbers 1 to
 // 9 (a club's nine: Breckenridge's Bear nine, a stray hole 12 beside it).
 const fitted = fitHoles(shiftHoles(raw, shift), codes, land), N = fitted.slice(0, 18).filter(Boolean).length === 18 ? 18 : fitted.slice(0, 9).filter(Boolean).length === 9 ? 9 : 0;
 const holes = N ? fitted.slice(0, N) : fitted, n = holes.filter(Boolean).length;
 say(`refined with the LIDAR: the map moved ${shift.x.toFixed(1)}, ${shift.z.toFixed(1)} m; ${n} holes${raw.doubled.length ? `, numbers claimed twice: ${raw.doubled.join(', ')}` : ''}`);
 const traced = createTrace(land, {codes, trees: mergeTrees(lidarTrees, osmTrees, 'merge'), homes: model.state.homes});
 planPng(path.join(dir, 'plan.png'), land, codes, holes, traced.state.trees);
 if (![9, 18].includes(n) || holes.length !== n) { say(`NOT BUILT: holes numbered ${holes.map((h, i) => h ? i + 1 : null).filter(Boolean).join(',')}`); fs.writeFileSync(path.join(dir, 'report.txt'), log.join('\n') + '\n'); return; }
 // 5. The course.
 const recs = holes.map((h, i) => ({number: i + 1, par: h.par ?? null, index: null, tees: h.tees, green: h.green, line: [[h.tees[0].x, h.tees[0].z], ...h.aims.map(a => [a.x, a.z]), [h.green.x, h.green.z]]}));
 let doc = validateDoc(docFromLand({land, traced: {layers: traced.state.layers}, holes: recs, trees: traced.state.trees, homes: traced.state.homes, name: c.name, landscape: c.landscape,
  credits: ['Elevation: USGS 3D Elevation Program (public domain)' + (crs.epsg === 2927 ? '; Washington DNR' : ''), OSM_CREDIT], source: {epsg: crs.epsg, files: sources.map(s => s.name), origin: {x: gridder.center.x, y: gridder.center.y}, trace: 'openstreetmap+lidar', picture: 'none'}}));
 // SKINNED FROM THE LAND (`skin: true`; the owner, 3 November 2026): the
 // editor's own Skin from the land, as a player pressing it would -- the
 // landscape's rock on the survey's steep ground, its apron below.
 if (c.skin) {
  const e = createEditor(doc), got = e.skinFromLand({bio: BIOMES[c.landscape]});
  doc = validateDoc(await e.toDoc());
  say(`skinned from the land: ${got.kinds.face} on ${got.cells.face.toLocaleString()} cells${got.kinds.apron ? `, ${got.kinds.apron} on ${got.cells.apron.toLocaleString()}` : ''}`);
 }
 const bytes = await writeBuiltFile(doc, BUILT_VERSION), file = path.join(dir, `${c.name.replace(/[^\w ()-]+/g, '')}.fairway`);
 fs.writeFileSync(file, bytes);
 const w = worldFromDoc(await readBuiltFile(bytes));
 // 6. Each hole: its par, yards, whether it sits on its green and tees, the
 // walk from the green before.
 const rows = w.holes.map((h, i) => {
  const hr = holes[i], prev = i ? holes[i - 1].green : null, walk = prev ? Math.hypot(hr.tees[0].x - prev.x, hr.tees[0].z - prev.z) : 0;
  return `${String(h.number).padStart(2)} par ${h.par}${hr.par ? '' : '*'} ${['blue', 'white', 'red'].map(s => Math.round(h.tees[s]?.yards ?? 0)).join('/')} yd, green ${hr.fit.green}${hr.fit.moved ? ` ${hr.fit.moved.toFixed(0)} m` : ''}, ${hr.fit.tees} tee box${hr.fit.tees === 1 ? '' : 'es'}${i ? `, ${walk.toFixed(0)} m from the green before` : ''}`;
 });
 say(`holes (* par worked out):\n  ${rows.join('\n  ')}`);
 const r = await testRound(await readBuiltFile(bytes));
 const mean = h => h.strokes.reduce((a, b) => a + b, 0) / h.strokes.length;
 say(`par ${w.holes.reduce((s, h) => s + h.par, 0)}, ${Math.round(w.holes.reduce((s, h) => s + (h.tees.blue?.yards ?? 0), 0)).toLocaleString()} yd from the back; ${doc.trees.length / 7} trees, ${doc.water.length} ponds, ${doc.homes.length} houses; ${(bytes.length / 1e6).toFixed(1)} MB`);
 say(`test round ${r.total.toFixed(1)} against par ${r.par} (${r.holes.map(h => `${h.number}:${mean(h).toFixed(1)}`).join(' ')}); stuck: ${r.holes.filter(h => h.stuck).map(h => `${h.number} on ${h.stuck.on} at ${h.stuck.x.toFixed(0)}, ${h.stuck.z.toFixed(0)} (${Math.round(Math.hypot(h.stuck.x - holes[h.number - 1].green.x, h.stuck.z - holes[h.number - 1].green.z))} m from the green)`).join(', ') || 'none'}; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
 fs.writeFileSync(path.join(dir, 'report.txt'), log.join('\n') + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const want = process.argv.slice(2).filter(a => !a.startsWith('--')), keys = want.length ? want : Object.keys(COURSES);
 for (const k of keys) { if (!COURSES[k]) { console.log(`${k}: not a course here`); continue; } try { await build(k); } catch (e) { console.log(`${k}: FAILED -- ${e.stack}`); } }
}
