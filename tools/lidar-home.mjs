// WHERE THE REAL COURSES' LIDAR LIVES (the owner, 1 November 2026: "put the
// lidar files into the repo (not committed)"): bench/lidar/<course>/, git-ignored,
// one folder a course -- the test courses' tiles for each landscape
// (tools/lidar-fetch.mjs), Worthington's survey, and the surveys the owner
// downloaded. Never committed or shipped: other people's data, gigabytes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIDAR_HOME = path.join(ROOT, 'bench', 'lidar');

// The imagery bench's test courses (imagery-fetch.mjs COURSES, by landscape)
// to their folders.
export const LIDAR_FOLDERS = {puget: 'sahalee', sonoran: 'tpc-scottsdale', rockies: 'breckenridge', links: 'chambers-bay', heartland: 'worthington',
 keys: 'key-west', redwood: 'northwood', newengland: 'ekwanok', lakedunes: 'arcadia-bluffs'};
// Every course here, with where its survey came from (the folders the owner
// brought in, 1 November 2026, identified from the files' own position).
export const LIDAR_COURSES = {
 worthington: {name: 'GreatLIFE Golf & Fitness (Worthington Country Club), Worthington MN', from: 'the owner\'s survey for another simulator: USGS 3DEP MN_MissouriRiverBigSioux_2021_B21, UTM 15N'},
 'battle-creek': {name: 'Battle Creek Golf Course, Tulalip WA', from: 'the owner\'s Downloads (BCGC): Washington DNR tiles and USGS WA Western QL1 2016, State Plane WA South (US feet)'},
 'salish-cliffs': {name: 'Salish Cliffs Golf Club, Kamilche WA', from: 'the owner\'s Downloads: Washington DNR Mason County refresh 2024 (2025), State Plane WA South (US feet), with its DTM and DSM'},
 snohomish: {name: 'Snohomish Golf Course, Snohomish WA', from: 'the owner\'s Downloads: Washington DNR Snohomish River Valley refresh 2024 (2025), State Plane WA South (US feet), with its DTM and DSM'},
 'nile-shrine': {name: 'Nile Shrine Golf Course, Mountlake Terrace WA', from: 'the owner\'s builder test (1 November 2026): four rockyweb tiles of USGS WA_KingCounty_2021_B21'},
};

export const lidarDir = key => path.join(LIDAR_HOME, LIDAR_FOLDERS[key] ?? key);
// The LIDAR files in a course's folder (the survey's own subfolders too:
// Worthington's raw/, a DNR download's laz/).
export function lidarFiles(dir) {
 if (!fs.existsSync(dir)) return [];
 const out = [], walk = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(classified|dsm|dsmhs|dtmhs|metadata|ept)$/i.test(e.name)) walk(p); } else if (/\.(laz|las)$/i.test(e.name)) out.push(p); } };
 walk(dir); return out;
}
// A fetch that keeps every answer under `dir` (by host and path) and answers
// from there next time: a survey downloaded through the builder's own code
// (lidar-search.js) once, then read offline.
export function cachedGet(dir) {
 return async url => {
  const u = new URL(url), file = path.join(dir, u.hostname, ...u.pathname.split('/').filter(Boolean)) + (u.search ? '_' + Buffer.from(u.search).toString('hex').slice(0, 40) : '');
  if (!fs.existsSync(file)) {
   let r = null;
   for (let attempt = 0; attempt < 5; attempt++) { r = await fetch(url).catch(() => null); if (r?.ok) break; await new Promise(res => setTimeout(res, 5000 * (attempt + 1))); }
   if (!r?.ok) return {ok: false, status: r?.status ?? 0};
   fs.mkdirSync(path.dirname(file), {recursive: true});
   fs.writeFileSync(file + '.part', Buffer.from(await r.arrayBuffer())); fs.renameSync(file + '.part', file);
  }
  const b = fs.readFileSync(file);
  return {ok: true, status: 200, json: async () => JSON.parse(b.toString('utf8')), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length)};
 };
}
// A course's survey as door 2 sources: its tiles here, else the Entwine
// square lidar-fetch.mjs saved (survey.json and the ept/ cache), offline.
// The Entwine square first when there is one: rockyweb's tiles fetched for a
// test course covered only part of it (Chambers Bay's mapped fairway lay
// wholly outside its three tiles, TPC Scottsdale's a third).
export async function courseSources(key, lazModule) {
 const dir = lidarDir(key), files = fs.existsSync(path.join(dir, 'survey.json')) ? [] : lidarFiles(dir);
 if (files.length) {
  const {openSource} = await import('../src/lidar/formats.js');
  const out = []; for (const f of files) out.push({...(await openSource(path.basename(f), new Uint8Array(fs.readFileSync(f)), {lazModule})), name: path.basename(f)});
  return out;
 }
 const sj = path.join(dir, 'survey.json');
 if (!fs.existsSync(sj)) return [];
 const {found, box} = JSON.parse(fs.readFileSync(sj, 'utf8')), {downloadLidar} = await import('../src/builder/lidar-search.js');
 return downloadLidar(found, box, {get: cachedGet(path.join(dir, 'ept')), lazModule});
}
// Worthington's folder: FAIRWAY_LIDAR_TEST when set, else the copy here.
export function worthingtonDir() {
 if (process.env.FAIRWAY_LIDAR_TEST) return process.env.FAIRWAY_LIDAR_TEST;
 const d = path.join(LIDAR_HOME, 'worthington');
 return fs.existsSync(path.join(d, 'raw')) ? d : null;
}
