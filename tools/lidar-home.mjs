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
export const LIDAR_FOLDERS = {pnw: 'sahalee', desert: 'tpc-scottsdale', mountain: 'breckenridge', links: 'chambers-bay', midwest: 'worthington',
 island: 'key-west', redwood: 'northwood', autumn: 'ekwanok', lakeshore: 'arcadia-bluffs'};
// Every course here, with where its survey came from (the folders the owner
// brought in, 1 November 2026, identified from the files' own position).
export const LIDAR_COURSES = {
 worthington: {name: 'GreatLIFE Golf & Fitness (Worthington Country Club), Worthington MN', from: 'the owner\'s survey for another simulator: USGS 3DEP MN_MissouriRiverBigSioux_2021_B21, UTM 15N'},
 'battle-creek': {name: 'Battle Creek Golf Course, Tulalip WA', from: 'the owner\'s Downloads (BCGC): Washington DNR tiles and USGS WA Western QL1 2016, State Plane WA South (US feet)'},
 'salish-cliffs': {name: 'Salish Cliffs Golf Club, Kamilche WA', from: 'the owner\'s Downloads: Washington DNR Mason County refresh 2024 (2025), State Plane WA South (US feet), with its DTM and DSM'},
 snohomish: {name: 'Snohomish Golf Course, Snohomish WA', from: 'the owner\'s Downloads: Washington DNR Snohomish River Valley refresh 2024 (2025), State Plane WA South (US feet), with its DTM and DSM'},
};

export const lidarDir = key => path.join(LIDAR_HOME, LIDAR_FOLDERS[key] ?? key);
// The LIDAR files in a course's folder (the survey's own subfolders too:
// Worthington's raw/, a DNR download's laz/).
export function lidarFiles(dir) {
 if (!fs.existsSync(dir)) return [];
 const out = [], walk = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(classified|dsm|dsmhs|dtmhs|metadata)$/i.test(e.name)) walk(p); } else if (/\.(laz|las)$/i.test(e.name)) out.push(p); } };
 walk(dir); return out;
}
// Worthington's folder: FAIRWAY_LIDAR_TEST when set, else the copy here.
export function worthingtonDir() {
 if (process.env.FAIRWAY_LIDAR_TEST) return process.env.FAIRWAY_LIDAR_TEST;
 const d = path.join(LIDAR_HOME, 'worthington');
 return fs.existsSync(path.join(d, 'raw')) ? d : null;
}
