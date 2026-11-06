#!/usr/bin/env node
// WRITES src/us-map-data.js: the clickable map's shapes and the thumbnails'
// globe (the US landscapes goal, 2 November 2026; src/landscape-map.js,
// src/globe.js). Never edit the output; re-run this.
//
//   node tools/us-map.mjs            write it, and print its size
//   node tools/us-map.mjs --check    print the size and point counts only
//
// Its inputs are local (git-ignored, under docs/studies/us-landscapes/map/):
//   partition.geojson   the study's partition of the USA into the landscapes
//                       (EPA level III ecoregions, public domain, grouped by
//                       the study; overlays for the small special places)
//   source/ne_50m_admin_1_states_provinces_lakes.geojson   Natural Earth's
//                       states (public domain): Alaska's and Hawaii's
//                       outlines, which the partition holds only as boxes
//   source/ne_110m_land.geojson   Natural Earth's land: the globe
// From https://github.com/nvkelso/natural-earth-vector (geojson/), 2 November
// 2026. The geometry comes from src/landscape-map.js (`project`), so the
// shapes and the lookup the game makes can never disagree.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {project} from '../src/landscape-map.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.join(here, '..', 'docs', 'studies', 'us-landscapes');
const OUT = path.join(here, '..', 'src', 'us-map-data.js');
const read = f => JSON.parse(fs.readFileSync(path.join(STUDY, f), 'utf8'));
// How much each outline is simplified: the largest a point may stray, in
// pixels of the 960 x 500 map (PLACED: under half a pixel is invisible at
// the size the map is shown), and the smallest piece kept, in square pixels.
const TOL = .45, MIN_AREA = .15;
// The globe's land: degrees (PLACED: a 64-pixel globe shows nothing finer).
const GLOBE_TOL = .9, GLOBE_MIN = 4;

function simplify(ring, tol) {
 // A closed ring starts and ends on one point, so a single Douglas-Peucker
 // over it measures everything against a line of no length and keeps
 // nothing: split it at the point farthest from its start.
 const pts = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
 if (pts.length < 4) return pts;
 let far = 0, fd = -1;
 pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
 return [...line(pts.slice(0, far + 1), tol), ...line([...pts.slice(far), pts[0]], tol).slice(1, -1)];
}
function line(pts, tol) { // Douglas-Peucker on an open line, [[x, y], ...]
 if (pts.length < 3) return pts;
 const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
 const stack = [[0, pts.length - 1]];
 while (stack.length) {
  const [a, b] = stack.pop(); let far = -1, fd = tol;
  const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > fd) { fd = d; far = i; } }
  if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
 }
 return pts.filter((_, i) => keep[i]);
}
const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a / 2); };
const polysOf = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

const cat = read('catalogue.json');
const keyOf = Object.fromEntries(cat.subs.map(s => [s.id, s.key]));
const shapes = new Map(); // `${key}|${overlay}` -> {key, overlay, rings}
const add = (key, overlay, ring) => {
 const id = `${key}|${overlay ? 1 : 0}`;
 if (!shapes.has(id)) shapes.set(id, {key, overlay, rings: []});
 shapes.get(id).rings.push(ring);
};
const ringOf = (coords, tol, min) => {
 const r = simplify(coords.map(([lon, lat]) => project(lat, lon)), tol);
 if (r.length < 4 || area(r) < min) return null;
 const flat = []; let px = null, py = null;
 for (const [x, y] of r) { const X = Math.round(x * 10), Y = Math.round(y * 10); if (X === px && Y === py) continue; flat.push(X, Y); px = X; py = Y; }
 return flat.length >= 8 ? flat : null;
};

const part = read('map/partition.geojson');
for (const f of part.features) {
 const key = keyOf[f.properties.sub];
 if (!key) throw new Error(`no landscape for ${f.properties.sub}`);
 if (key === 'alaska' || key === 'hawaii') continue; // boxes in the partition
 for (const p of polysOf(f.geometry)) for (const ring of p) { const r = ringOf(ring, TOL, MIN_AREA); if (r) add(key, !!f.properties.overlay, r); }
}
const states = read('map/source/ne_50m_admin_1_states_provinces_lakes.geojson');
for (const name of ['Alaska', 'Hawaii']) {
 const f = states.features.find(q => q.properties.name === name && q.properties.admin === 'United States of America');
 if (!f) throw new Error(`no ${name}`);
 for (const p of polysOf(f.geometry)) { const r = ringOf(p[0], TOL, name === 'Hawaii' ? .2 : MIN_AREA); if (r) add(name.toLowerCase(), false, r); }
}

// The globe: land as [lon, lat] in half degrees.
const land = read('map/source/ne_110m_land.geojson'), globe = [];
for (const f of land.features) for (const p of polysOf(f.geometry)) {
 const r = simplify(p[0], GLOBE_TOL);
 if (r.length < 4 || area(r) < GLOBE_MIN) continue;
 const flat = []; for (const [lon, lat] of r) flat.push(Math.round(lon * 2), Math.round(lat * 2));
 globe.push(flat);
}

const list = [...shapes.values()].sort((a, b) => (a.overlay - b.overlay) || a.key.localeCompare(b.key));
const points = list.reduce((n, s) => n + s.rings.reduce((m, r) => m + r.length / 2, 0), 0);
const text = `// GENERATED by tools/us-map.mjs -- never edit; re-run it. The map of the
// landscapes (landscape-map.js): each landscape's shape, projected, in tenths
// of a pixel of a 960 x 500 picture, flat [x0, y0, x1, y1, ...] rings; the
// overlays last (they lie over the rest). Sources: the study's partition of
// EPA level III ecoregions, Natural Earth's Alaska and Hawaii (public domain).
export const US_SHAPES = ${JSON.stringify(list.map(s => ({key: s.key, overlay: s.overlay, rings: s.rings})))};
// The globe's land (globe.js): [lon, lat] rings in half degrees. Natural
// Earth 1:110m land (public domain).
export const GLOBE_LAND = ${JSON.stringify(globe)};
`;
console.log(`${list.length} shapes, ${points} points; globe ${globe.length} rings, ${globe.reduce((n, r) => n + r.length / 2, 0)} points; ${(text.length / 1024).toFixed(0)} KB`);
const missing = cat.subs.map(s => s.key).filter(k => !list.some(s => s.key === k));
if (missing.length) console.log('no shape for', missing.join(', '));
if (!process.argv.includes('--check')) fs.writeFileSync(OUT, text);
