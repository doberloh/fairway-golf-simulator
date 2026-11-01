#!/usr/bin/env node
// THE TEST COURSES' LIDAR, FETCHED (the course builder's LIDAR iterations;
// docs/COURSE_BUILDER.md, *The amended goal*). For each course
// tools/imagery-fetch.mjs saved, the USGS 3DEP lidar point-cloud tiles (LAZ)
// over it, found through the National Map's product search and downloaded into
// the ignored bench/shots/imagery/<course>/lidar/, for testing only -- never
// committed or shipped. US government work, public domain.
//
//   node tools/lidar-fetch.mjs                every course without its LIDAR
//   node tools/lidar-fetch.mjs desert links   some of them
//
// The newest project covering the course is taken (by its publication date);
// tiles that only touch the box's edge are taken too -- the land is built 150
// m past the course.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OUT, COURSES} from './imagery-fetch.mjs';

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
 const out = path.join(dir, 'lidar'); fs.mkdirSync(out, {recursive: true});
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const want = process.argv.slice(2);
 // Worthington's tiles are the owner's, read in place (FAIRWAY_LIDAR_TEST): not fetched.
 for (const c of COURSES.filter(c => (!want.length || want.includes(c.key)) && c.key !== 'midwest' && fs.existsSync(path.join(OUT, c.key, 'course.json')))) {
  try { await fetchCourse(c.key); } catch (e) { console.log(`${c.key}: FAILED -- ${e.message}`); }
 }
}
