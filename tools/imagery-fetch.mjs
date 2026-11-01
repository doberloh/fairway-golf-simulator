#!/usr/bin/env node
// THE AUTO TRACE'S TEST COURSES, FETCHED (the course builder's imagery
// iterations; docs/COURSE_BUILDER.md, *The amended goal*). One real course for
// each of Fairway's landscapes but Haunted Hollow, each with OpenStreetMap's
// hand-drawn golf features (the reference the trace is scored against) and
// the newest NAIP aerial picture over it (USDA, public domain, 0.6 m, red,
// green, blue and near-infrared) -- downloaded into the ignored
// bench/shots/imagery/<course>/ for testing only. Nothing it fetches is
// committed or shipped.
//
//   node tools/imagery-fetch.mjs                every course not yet fetched
//   node tools/imagery-fetch.mjs desert links   some of them
//
// OpenStreetMap through the Overpass API (https://overpass-api.de, ODbL), with
// a User-Agent and retries (it refuses bare requests and is often busy); NAIP
// through Microsoft's Planetary Computer (its STAC search, then a signed blob
// URL). A course already fetched is skipped.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'bench', 'shots', 'imagery');
// The courses: the landscape each stands for, how OpenStreetMap knows it.
export const COURSES = [
 {key: 'pnw', name: 'Sahalee Country Club, Sammamish WA', osm: 'way(1002185812)'},
 {key: 'desert', name: 'TPC Scottsdale Stadium Course, Scottsdale AZ', osm: 'way(78388948)'},
 {key: 'mountain', name: 'Breckenridge Golf Club, Bear nine, Breckenridge CO', osm: 'way(1571231453)'},
 {key: 'links', name: 'Chambers Bay, University Place WA', osm: 'way["leisure"="golf_course"]["name"="Chambers Bay"]'},
 {key: 'midwest', name: 'Worthington Country Club, Worthington MN', osm: 'way["leisure"="golf_course"]["name"~"Worthington Country Club|GreatLIFE"]'},
 {key: 'island', name: 'Kapalua Plantation Course, Maui HI', osm: 'rel(12152889)'},
 {key: 'redwood', name: 'Northwood Golf Club, Monte Rio CA', osm: 'way(1246462624)'},
 {key: 'autumn', name: 'Ekwanok Country Club, Manchester VT', osm: 'way(424514357)'},
 {key: 'lakeshore', name: 'Arcadia Bluffs Golf Club, Arcadia MI', osm: 'way(293247442)'},
];
const UA = {'User-Agent': 'FairwayCourseBuilder/0.1 (testing; github.com/doberloh/fairway-golf-simulator)'};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q) {
 for (let attempt = 0; attempt < 8; attempt++) {
  const r = await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', headers: {...UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(q)}).catch(e => ({ok: false, text: async () => String(e)}));
  const t = await r.text();
  if (r.ok && t.trim().startsWith('{')) return JSON.parse(t);
  console.log(`  overpass busy (try ${attempt + 1}); waiting`);
  await wait(15000 * (attempt + 1));
 }
 throw Error('Overpass would not answer');
}

async function fetchCourse(c) {
 const dir = path.join(OUT, c.key);
 fs.mkdirSync(dir, {recursive: true});
 const osmFile = path.join(dir, 'osm.json');
 if (!fs.existsSync(osmFile)) {
  const j = await overpass(`[out:json][timeout:180];${c.osm}->.c;.c out geom;.c map_to_area->.a;(way(area.a)["golf"];way(area.a)["natural"="water"];way(area.a)["landuse"="forest"];way(area.a)["natural"="wood"];way(area.a)["natural"="sand"];);out geom;`);
  fs.writeFileSync(osmFile, JSON.stringify(j));
 }
 const osm = JSON.parse(fs.readFileSync(osmFile, 'utf8'));
 // The course's box from its outline (a relation's members, a way's nodes).
 const pts = [];
 for (const e of osm.elements) {
  if (e.tags?.leisure !== 'golf_course') continue;
  for (const g of e.geometry || []) pts.push(g);
  for (const m of e.members || []) for (const g of m.geometry || []) pts.push(g);
 }
 if (!pts.length) throw Error(`${c.key}: no course outline in OpenStreetMap's answer`);
 const bbox = [Math.min(...pts.map(p => p.lon)), Math.min(...pts.map(p => p.lat)), Math.max(...pts.map(p => p.lon)), Math.max(...pts.map(p => p.lat))];
 const counts = {}; for (const e of osm.elements) { const k = e.tags?.golf ?? (e.tags?.leisure ? null : e.tags?.natural ?? e.tags?.landuse); if (k) counts[k] = (counts[k] || 0) + 1; }
 // NAIP: the newest year whose tiles cover the box.
 const s = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {method: 'POST', headers: {...UA, 'Content-Type': 'application/json'},
  body: JSON.stringify({collections: ['naip'], bbox, limit: 50, sortby: [{field: 'datetime', direction: 'desc'}]})}).then(r => r.json());
 const items = s.features || [];
 if (!items.length) throw Error(`${c.key}: no NAIP over ${bbox}`);
 const year = items[0].properties['naip:year'] ?? items[0].properties.datetime.slice(0, 4);
 const mine = items.filter(i => (i.properties['naip:year'] ?? i.properties.datetime.slice(0, 4)) === year);
 const token = (await fetch('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip', {headers: UA}).then(r => r.json())).token;
 const tiles = [];
 for (const it of mine) {
  const href = it.assets.image.href, file = path.join(dir, path.basename(new URL(href).pathname));
  tiles.push(path.basename(file));
  if (fs.existsSync(file) && fs.statSync(file).size > 1e6) continue;
  console.log(`  ${c.key}: downloading ${path.basename(file)}`);
  const r = await fetch(`${href}?${token}`, {headers: UA});
  if (!r.ok) throw Error(`${c.key}: ${r.status} for ${href}`);
  fs.writeFileSync(file + '.part', Buffer.from(await r.arrayBuffer()));
  fs.renameSync(file + '.part', file);
 }
 fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({key: c.key, name: c.name, bbox_lonlat: bbox, naip: {year, tiles, flown: mine.map(i => i.properties.datetime)}, osmCounts: counts}, null, 1));
 console.log(`${c.key}: ${c.name}; NAIP ${year}, ${tiles.length} tile(s); OpenStreetMap ${JSON.stringify(counts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const want = process.argv.slice(2);
 for (const c of COURSES.filter(c => !want.length || want.includes(c.key))) {
  try { await fetchCourse(c); } catch (e) { console.log(`${c.key}: FAILED -- ${e.message}`); }
  await wait(3000);
 }
}
