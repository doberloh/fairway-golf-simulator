#!/usr/bin/env node
// THE TEST COURSES' LIDAR, FETCHED (the course builder's LIDAR iterations;
// docs/COURSE_BUILDER.md, *The amended goal*). For each course
// tools/imagery-fetch.mjs saved, the USGS 3DEP lidar point-cloud tiles (LAZ)
// over it, found through the National Map's product search and downloaded into
// the ignored bench/lidar/<course>/ (lidar-home.mjs), for testing only -- never
// committed or shipped. US government work, public domain.
//
//   node tools/lidar-fetch.mjs                every course without its LIDAR (Entwine)
//   node tools/lidar-fetch.mjs --tiles        rockyweb's whole tiles instead
//   node tools/lidar-fetch.mjs --ept links     the Entwine square even where tiles are here (they may not cover it)
//   node tools/lidar-fetch.mjs desert links   some of them
//
// The newest project covering the course is taken (by its publication date);
// tiles that only touch the box's edge are taken too -- the land is built 150
// m past the course.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OUT, COURSES} from './imagery-fetch.mjs';
import {lidarDir, lidarFiles, cachedGet} from './lidar-home.mjs';
import {searchLidar, downloadLidar} from '../src/builder/lidar-search.js';

const UA = {'User-Agent': 'FairwayCourseBuilder/0.1 (testing)'};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function products(bbox) {
 const url = `https://tnmaccess.nationalmap.gov/api/v1/products?datasets=${encodeURIComponent('Lidar Point Cloud (LPC)')}&bbox=${bbox.join(',')}&prodFormats=LAZ&max=200&outputFormat=JSON`;
 for (let attempt = 0; attempt < 5; attempt++) {
  const r = await fetch(url, {headers: UA}).catch(() => null);
  if (r?.ok) return (await r.json()).items || [];
  await wait(10000 * (attempt + 1));
 }
 throw Error('The National Map would not answer');
}

async function fetchCourse(key) {
 const dir = path.join(OUT, key), meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
 const out = lidarDir(key); fs.mkdirSync(out, {recursive: true});
 const [lon0, lat0, lon1, lat1] = meta.bbox_lonlat, pad = .0015, bbox = [lon0 - pad, lat0 - pad, lon1 + pad, lat1 + pad];
 const items = await products(bbox);
 if (!items.length) throw Error('no 3DEP LIDAR over it');
 // The newest project: its name is in each title; take the tiles of the
 // project published last.
 const project = t => (t.title.match(/USGS Lidar Point Cloud (\S+)/) || [])[1] || t.title;
 const byProject = new Map(); for (const it of items) { const p = project(it); if (!byProject.has(p)) byProject.set(p, []); byProject.get(p).push(it); }
 const newest = [...byProject.entries()].sort((a, b) => String(b[1][0].publicationDate).localeCompare(String(a[1][0].publicationDate)))[0];
 const tiles = newest[1];
 for (const it of tiles) {
  const url = it.downloadLazURL || it.downloadURL, file = path.join(out, path.basename(new URL(url).pathname));
  if (fs.existsSync(file) && fs.statSync(file).size > 1e5) continue;
  console.log(`  ${key}: ${path.basename(file)} (${(it.sizeInBytes / 1e6).toFixed(0)} MB)`);
  // USGS's server limits how fast it is asked (429): wait and try again, a
  // minute more each time, and rest between tiles.
  let r = null; for (let attempt = 0; attempt < 6; attempt++) { r = await fetch(url, {headers: UA}).catch(() => null); if (r?.ok) break; await wait(60000 * (attempt + 1)); }
  if (!r?.ok) throw Error(`${r?.status ?? 'no answer'} for ${url}`);
  fs.writeFileSync(file + '.part', Buffer.from(await r.arrayBuffer())); fs.renameSync(file + '.part', file);
  await wait(15000);
 }
 meta.lidar = {project: newest[0], tiles: tiles.map(t => path.basename(new URL(t.downloadLazURL || t.downloadURL).pathname)), published: tiles[0].publicationDate};
 fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify(meta, null, 1));
 console.log(`${key}: ${newest[0]}, ${tiles.length} tile(s)`);
}

// THE ENTWINE ROUTE (1 November 2026, the default): the course's box and 150 m
// past it from 3DEP's Entwine copy, through the builder's own search and
// download (lidar-search.js) with every answer kept under the course's ept/
// (lidar-home.mjs cachedGet), and survey.json saying which survey and box --
// courseSources() reads it back offline. Only the course, not whole 1 km
// tiles, and no rockyweb rate limit: Sahalee's three tiles took four hours.
async function fetchCourseEpt(key) {
 const meta = JSON.parse(fs.readFileSync(path.join(OUT, key, 'course.json'), 'utf8')), out = lidarDir(key);
 const [lon0, lat0, lon1, lat1] = meta.bbox_lonlat, padLat = 150 / 111320, padLon = 150 / (111320 * Math.cos((lat0 + lat1) / 2 * Math.PI / 180));
 const box = {lon0: lon0 - padLon, lat0: lat0 - padLat, lon1: lon1 + padLon, lat1: lat1 + padLat};
 const found = (await searchLidar('usgs', box)).find(f => f.ept);
 if (!found) throw Error('no 3DEP LIDAR over it');
 const M = await (async () => { const m = await import('laz-perf'); return (m.createLazPerf || m.default?.createLazPerf || m.default)(); })();
 let last = -1;
 const got = await downloadLidar(found, box, {get: cachedGet(path.join(out, 'ept')), lazModule: M, onProgress: (f, what) => { const p = Math.floor(f * 10); if (p !== last) { last = p; console.log(`  ${key}: ${what}`); } }});
 fs.mkdirSync(out, {recursive: true});
 fs.writeFileSync(path.join(out, 'survey.json'), JSON.stringify({found: {...found, tileUrls: undefined}, box, course: meta.name}, null, 1));
 console.log(`${key}: ${found.title} (${String(found.date).slice(0, 10)}), ${got[0].count.toLocaleString()} points in ${got[0].pieces} pieces, ${(got[0].bytes / 1e6).toFixed(0)} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.argv.includes('--tiles')) {
 const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
 for (const c of COURSES.filter(c => (!want.length || want.includes(c.key)) && c.key !== 'midwest' && fs.existsSync(path.join(OUT, c.key, 'course.json')))) {
  if ((!process.argv.includes('--ept') && lidarFiles(lidarDir(c.key)).length) || fs.existsSync(path.join(lidarDir(c.key), 'survey.json'))) { console.log(`${c.key}: already here`); continue; }
  try { await fetchCourseEpt(c.key); } catch (e) { console.log(`${c.key}: FAILED -- ${e.message}`); }
 }
}
// --tiles: rockyweb's whole tiles, as before.
else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
 // Worthington's tiles are the owner's survey, copied to bench/lidar/worthington: not fetched.
 for (const c of COURSES.filter(c => (!want.length || want.includes(c.key)) && c.key !== 'midwest' && fs.existsSync(path.join(OUT, c.key, 'course.json')))) {
  try { await fetchCourse(c.key); } catch (e) { console.log(`${c.key}: FAILED -- ${e.message}`); }
 }
}
