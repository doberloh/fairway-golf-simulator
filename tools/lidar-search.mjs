#!/usr/bin/env node
// THE BUILDER'S LIDAR SEARCH, CHECKED ON A REAL PLACE (src/builder/lidar-search.js;
// docs/COURSE_BUILDER.md, amendments 13-14). Searches every online source over
// a square, downloads one survey through the builder's own code, builds the
// land, and -- where the same survey is here as tiles (bench/lidar/<course>) --
// compares the two lands' ground cell by cell. Testing only; nothing written
// but the local report line.
//
//   node tools/lidar-search.mjs                       Worthington, 400 m
//   node tools/lidar-search.mjs --at 43.6286,-95.6280 --size 400 --course worthington
import fs from 'node:fs';
import path from 'node:path';
import {searchLidar, downloadLidar, squareAround, sourcesAt} from '../src/builder/lidar-search.js';
import {openSource} from '../src/lidar/formats.js';
import {converter} from '../src/lidar/geo.js';
import {landFromSources} from '../src/builder/real-course.js';
import {lidarDir, lidarFiles} from './lidar-home.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const [lat, lon] = opt('at', '43.6286,-95.6280').split(',').map(Number), size = +opt('size', 400), course = opt('course', 'worthington');
const M = await (async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); })();
const box = squareAround(lon, lat, size), t0 = performance.now(), secs = () => ((performance.now() - t0) / 1000).toFixed(1) + ' s';
console.log(`Sources at ${lat}, ${lon}: ${sourcesAt(lon, lat).map(s => s.key).join(', ')}`);
const found = [];
for (const s of sourcesAt(lon, lat).filter(s => s.online)) { const f = await searchLidar(s.key, box); found.push(...f); console.log(`${s.key}: ${f.map(x => `${x.title} (${String(x.date).slice(0, 10)}, ${x.tiles} tiles)`).join('; ') || 'nothing'}`); }
if (!found.length) process.exit(0);
const pick = found[0];
const got = await downloadLidar(pick, box, {lazModule: M, onProgress: (f, what) => process.stdout.write(`\r  downloading ${what} ${(100 * f).toFixed(0)}%   `)});
console.log(`\n${pick.title}: ${got.map(s => `${s.count.toLocaleString()} points${s.pieces ? ` in ${s.pieces} pieces` : ''}${s.bytes ? `, ${(s.bytes / 1e6).toFixed(1)} MB` : ''}`).join('; ')} -- ${secs()}`);
// The land from the download, over the middle of the square (half its size).
const crs = got[0].crs, conv = converter({epsg: 4326, geographic: true}, crs), inner = squareAround(lon, lat, size / 2);
const a = conv(inner.lon0, inner.lat0), b = conv(inner.lon1, inner.lat1), pbox = {x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y)};
const L1 = (await landFromSources(got, pbox, {cell: 1})).land;
console.log(`land from the download: ${L1.nx} x ${L1.nz} at 1 m, ${L1.method}, ${(100 * L1.filled.reduce((s, v) => s + v, 0) / L1.filled.length).toFixed(1)}% filled -- ${secs()}`);
// Against the same survey's tiles here.
const files = lidarFiles(lidarDir(course));
if (!files.length) { console.log(`No tiles in bench/lidar/${course} to compare with.`); process.exit(0); }
const tiles = []; for (const f of files) tiles.push({...(await openSource(path.basename(f), new Uint8Array(fs.readFileSync(f)), {lazModule: M})), name: path.basename(f)});
const L2 = (await landFromSources(tiles, pbox, {cell: 1})).land;
if (L1.nx !== L2.nx || L1.nz !== L2.nz) { console.log(`grids differ: ${L1.nx}x${L1.nz} against ${L2.nx}x${L2.nz}`); process.exit(1); }
const d = []; for (let k = 0; k < L1.ground.length; k++) if (!L1.filled[k] && !L2.filled[k]) d.push(Math.abs(L1.ground[k] - L2.ground[k]));
d.sort((x, y) => x - y);
const q = f => d[Math.floor(d.length * f)];
console.log(`ground, download against ${course}'s tiles: ${d.length.toLocaleString()} cells, median ${(100 * q(.5)).toFixed(1)} cm, 95% ${(100 * q(.95)).toFixed(1)} cm, worst ${(100 * d.at(-1)).toFixed(0)} cm -- ${secs()}`);
