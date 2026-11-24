#!/usr/bin/env node
// WHAT A BIG USGS SQUARE COSTS THE BUILDER, AND WHAT THE COURSE OUTLINE SAVES
// (the owner, 22 November 2026: "I think we have optimizations that need to
// happen on large courses maybe"; RESEARCH, *Full detail inside the course,
// less outside*). A square kept from USGS (a `.ept.zip` in the LIDAR folder)
// read as door 2 reads it -- through `downloadLidar`, which finds every piece
// it needs already in the file and downloads none (it reads USGS's index of
// the survey online, to know which pieces an outline needs) -- and its land
// built over the property as door 2 builds it, with the time and the memory
// of each stage.
//
//   node tools/lidar-detail.mjs <square.ept.zip>
//   node tools/lidar-detail.mjs <square.ept.zip> --outline "lon,lat lon,lat ..."
//   ... --whole    every piece read into memory first, as door 2 did before
//                  22 November 2026 (the baseline)
//   ... --outside <n>  points a land cell outside the outline (default 8, DETAIL.outsidePerCell)
//   ... --course <folder>  the course too, as door 2 lays it from OpenStreetMap
//                  (asked online: its greens, tees, bunkers and numbered
//                  holes), written twice to <folder> -- with the half-metre
//                  patches and without -- with each file's size, the game's
//                  ground mesh, and the computer golfers' test round on each
//
// The file is the player's and stays where it is; nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import {readZipFile} from '../src/zip.js';
import {downloadLidar, eptFileSource} from '../src/builder/lidar-search.js';
import {squareOfName} from '../src/builder/lidar-coverage.js';
import {landFromSources, sourcesBox, cellFor} from '../src/builder/real-course.js';
import {converter} from '../src/lidar/geo.js';
import {GRID_MARGIN} from '../src/built-world.js';
import {DETAIL} from '../src/lidar/detail.js';

const argv = process.argv.slice(2), opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const file = argv.find(a => !a.startsWith('--') && a !== opt('outline'));
if (!file || !fs.existsSync(file)) { console.log('Pass a kept USGS square: node tools/lidar-detail.mjs <square.ept.zip>'); process.exit(0); }
const outline = opt('outline') ? opt('outline').trim().split(/\s+/).map(p => p.split(',').map(Number)) : null;
// --outside <n>: points a land cell asked for outside the outline (DETAIL.outsidePerCell), to compare.
if (opt('outside')) DETAIL.outsidePerCell = +opt('outside');

const MB = b => (b / 2 ** 20).toFixed(0) + ' MB';
const t0 = performance.now(), secs = () => ((performance.now() - t0) / 1000).toFixed(1) + ' s';
// The most memory the process has held (the operating system's count), and now.
const peak = () => MB(process.resourceUsage().maxRSS * 1024);
const now = () => { const m = process.memoryUsage(); return `heap ${MB(m.heapUsed)}, buffers ${MB(m.arrayBuffers)}`; };
const say = what => console.log(`${secs().padStart(8)}  ${what}  (${now()}; peak ${peak()})`);

const lazModule = await (async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); })();
const blob = await fs.openAsBlob(file), name = path.basename(file), q = squareOfName(name);
const head = (await readZipFile(blob)).find(p => p.name === 'fairway-ept.json');
if (!q || !head) { console.log(`${file} is not a square kept from USGS.`); process.exit(0); }
const meta = JSON.parse(await (await head.blob()).text());
say(`${name}: ${MB(blob.size)}, ${meta.count.toLocaleString()} points kept`);
// The property: the square less the margin it was downloaded with.
const b = meta.box, m = GRID_MARGIN / 111320, mLon = m / Math.cos((b.lat0 + b.lat1) / 2 * Math.PI / 180);
const property = {lon0: b.lon0 + mLon, lon1: b.lon1 - mLon, lat0: b.lat0 + m, lat1: b.lat1 - m};
const w = (property.lon1 - property.lon0) * 111320 * Math.cos((b.lat0 + b.lat1) / 2 * Math.PI / 180), h = (property.lat1 - property.lat0) * 111320, cell = cellFor(w, h);
const detail = outline ? {ring: outline, perM2: DETAIL.outsidePerCell / (cell * cell)} : null;
let source;
if (argv.includes('--whole')) {
 const all = new Uint8Array(await blob.arrayBuffer());
 source = await eptFileSource(all, lazModule);
 for (const p of (await readZipFile(new Blob([all])))) await p.blob();
} else {
 const found = {source: 'usgs', id: q.id, title: meta.title, ept: `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/${q.id}/ept.json`};
 [source] = await downloadLidar(found, b, {lazModule, detail, kept: async n => n === name ? blob : null, list: async () => [name], get: (u, o) => fetch(u, {...o, headers: {'User-Agent': 'golf-course-builder-test/1.0'}})});
 if (source.keep) throw Error('it wanted to download pieces the file does not hold');
}
say(`read: ${source.pieces} pieces, ${source.count.toLocaleString()} points, ${MB(source.bytes)}${source.thinned ? `, outside the outline to depth ${source.thinned.depth} of the survey's ${source.thinned.of} pieces` : ''}`);

const toGrid = converter({epsg: 4326, geographic: true}, source.crs);
const c = [[property.lon0, property.lat0], [property.lon1, property.lat0], [property.lon0, property.lat1], [property.lon1, property.lat1]].map(([x, y]) => toGrid(x, y)), xs = c.map(p => p.x), ys = c.map(p => p.y);
const box = {x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys)};
const ring = outline ? outline.map(([lon, lat]) => { const p = toGrid(lon, lat); return [p.x, p.y]; }) : null;
let last = '';
const r = await landFromSources([source], box, {outline: ring, pause: () => new Promise(setImmediate), onStep: (what, f) => { const s = `${what} ${Math.floor(f * 2) * 50}%`; if (s !== last) { last = s; say(s); } }});
const {land} = r, filled = land.filled.reduce((s, v) => s + v, 0) / land.filled.length;
say(`land ${land.nx} x ${land.nz} at ${land.cell} m, ${land.points.toLocaleString()} points gathered, ${(100 * filled).toFixed(1)}% filled, ${r.trees.length.toLocaleString()} trees${land.fine ? `; fine ground ${land.fine.nx} x ${land.fine.nz} at ${land.fine.cell} m, ${(100 * land.fine.detail.filter(v => v !== -32768).length / land.fine.detail.length).toFixed(0)}% of it measured` : ''}`);
// Inside and outside the outline: the share filled and the trees.
if (ring) {
 const inR = (x, z) => { const mx = x + (box.x0 + box.x1) / 2, my = (box.y0 + box.y1) / 2 - z; let k = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i]; if ((by > my) !== (ay > my) && mx < (ax - bx) * (my - by) / (ay - by) + bx) k = !k; } return k; };
 let fi = 0, ni = 0, fo = 0, no = 0;
 for (let j = 0; j < land.nz; j += 4) for (let i = 0; i < land.nx; i += 4) { const k = j * land.nx + i, x = -land.halfX + i * land.cell, z = -land.halfZ + j * land.cell; if (inR(x, z)) { ni++; fi += land.filled[k]; } else { no++; fo += land.filled[k]; } }
 const ti = r.trees.filter(t => inR(t.x, t.z)).length;
 let fm = 0, fn = 0;
 if (land.fine) { const F = land.fine; for (let j = 0; j < F.nz; j += 2) for (let i = 0; i < F.nx; i += 2) if (inR(F.x0 + i * F.cell, F.z0 + j * F.cell)) { fn++; if (F.detail[j * F.nx + i] !== -32768) fm++; } }
 say(`inside the outline: ${(100 * fi / ni).toFixed(1)}% filled, ${ti.toLocaleString()} trees${fn ? `, ${(100 * fm / fn).toFixed(0)}% of the half-metre cells measured` : ''}; outside: ${(100 * fo / no).toFixed(1)}% filled, ${(r.trees.length - ti).toLocaleString()} trees`);
}

// THE COURSE, with and without the half-metre patches.
const out = opt('course');
if (out) {
 const {fetchOsm, osmFeatures, layOsm} = await import('../src/builder/osm.js');
 const {osmCourses, osmHoles} = await import('../src/builder/osm-course.js');
 const {createTrace} = await import('../src/builder/trace-edit.js');
 const {docFromLand} = await import('../src/builder/real-course.js');
 const {validateDoc, writeBuiltFile} = await import('../src/course-doc.js');
 const {worldFromDoc} = await import('../src/built-world.js');
 const {BUILT_VERSION} = await import('../src/settings-schema.js');
 const {testRound} = await import('../src/builder/test-round.js');
 const fromDeg = converter({epsg: 4326, geographic: true}, source.crs), toLocal = (lat, lon) => { const q = fromDeg(lon, lat); return r.gridder.local(q.x, q.y); };
 // Kept as <folder>/osm.json once asked, so a busy server costs one try.
 const osmFile = path.join(out, 'osm.json');
 const json = fs.existsSync(osmFile) ? JSON.parse(fs.readFileSync(osmFile, 'utf8')) : await fetchOsm([property.lon0, property.lat0, property.lon1, property.lat1], (u, o) => fetch(u, {...o, headers: {...o?.headers, 'User-Agent': 'golf-course-builder-test/1.0'}}));
 fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(osmFile, JSON.stringify(json));
 const feats = osmFeatures(json, toLocal), courses = osmCourses(json, toLocal, feats), course = courses[0];
 const model = createTrace(land, {trees: []}); layOsm(model, feats);
 const got = osmHoles(feats, {within: course?.rings ?? null});
 let holes = got.map((h, i) => h && {number: i + 1, par: h.par, tees: h.tees.map(t => ({...t, set: t.set ?? 'blue'})), green: h.green, line: [[h.tees[0].x, h.tees[0].z], ...h.aims.map(a => [a.x, a.z]), [h.green.x, h.green.z]]}).filter(Boolean);
 holes = holes.length >= 18 ? holes.slice(0, 18) : holes.slice(0, 9);
 say(`OpenStreetMap: ${course?.name ?? 'no course'}, ${holes.length} holes laid`);
 fs.mkdirSync(out, {recursive: true});
 for (const [label, withFine] of [['patches', true], ['plain', false]]) {
  const l = withFine ? land : {...land, fine: undefined};
  const doc = validateDoc(docFromLand({land: l, traced: {shapes: model.state.shapes}, holes, trees: r.trees, name: `Alpine Lake (${label})`, landscape: 'heartland'}));
  const bytes = await writeBuiltFile(doc, BUILT_VERSION), file = path.join(out, `alpine-lake-${label}.fairway`); fs.writeFileSync(file, bytes);
  const samples = doc.patches.reduce((s, p) => s + p.nx * p.nz, 0);
  // How large the detail laid is: each patch height against the 1 m land read
  // there. Mostly under 3 cm is survey noise more than shape.
  if (doc.patches.length) {
   const {gridSampler} = await import('../src/built-world.js'), base = gridSampler(doc.land), bins = [0, 0, 0, 0];
   for (const p of doc.patches) for (let j = 0; j < p.nz; j++) for (let i = 0; i < p.nx; i++) { const d = Math.abs(p.heights[j * p.nx + i] - base(p.x0 + i * p.cell, p.z0 + j * p.cell)); bins[d < .005 ? 0 : d < .03 ? 1 : d < .1 ? 2 : 3]++; }
   const pc = n => `${(100 * n / samples).toFixed(0)}%`;
   say(`${label}: detail laid -- none ${pc(bins[0])}, under 3 cm ${pc(bins[1])}, 3-10 cm ${pc(bins[2])}, over 10 cm ${pc(bins[3])}`);
  }
  const t1 = performance.now(), w = worldFromDoc(doc), tw = performance.now() - t1;
  const cells = w.groundGrid.cells.size, tris = w.groundGrid.indices.length / 3;
  say(`${label}: ${MB(bytes.length)} file, ${doc.patches.length} patches (${(samples / 1e6).toFixed(2)} M heights); the game's ground ${cells.toLocaleString()} refined cells, ${(tris / 1e6).toFixed(2)} M triangles, built in ${(tw / 1000).toFixed(1)} s`);
  const round = await testRound(doc);
  const total = g => round.holes.reduce((s, h) => s + (h.strokes[g] ?? 0), 0), stuck = round.holes.filter(h => h.stuck).length;
  say(`${label}: test round ${round.holes.length} holes, ${total(0)} and ${total(1)} strokes, ${stuck} hole${stuck === 1 ? '' : 's'} where a ball stuck`);
 }
}
