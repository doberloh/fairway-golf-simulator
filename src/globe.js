// THE LITTLE GLOBE IN A LANDSCAPE THUMBNAIL'S CORNER (the owner, 2 November
// 2026: "lets put a little map in the corner of the thumbnail that shows that
// location on the globe so that the user knows"). Pure: a place in, an SVG
// string out. tests/globe.test.mjs.
//
// Drawn, not a picture, so a landscape anywhere costs nothing to add: the
// Earth turned to face the place (orthographic, the globe as seen from space),
// Natural Earth's land (us-map-data.js GLOBE_LAND, 1:110m, public domain), a
// few lines of latitude and longitude for roundness, and a dot on the place.
//
// THE HORIZON IS CUT, NOT SQUASHED. Pressing land behind the globe onto its
// rim looked right for small places and flooded the whole disc for a big one
// mostly behind it (Hawaii's globe was all land: Asia, pressed round the
// rim). Each coastline is cut where it crosses the horizon instead, and the
// visible pieces are joined along the rim, as d3 does: a coastline that goes
// over the horizon comes back at the next crossing round the rim, turning the
// way that keeps the land on its left.
import {GLOBE_LAND} from './us-map-data.js';

const RAD = Math.PI / 180;
// The globe is turned so the place sits a little above the middle (PLACED:
// a tilt of 0.8 of its latitude toward the equator keeps the poles' empty
// cap out of view and the place's continent whole).
const TILT = .8;

// A view: [lat, lon] -> [x, y, z], y up, z toward the viewer (z >= 0 seen).
function view(lat0, lon0) {
 const s0 = Math.sin(lat0 * RAD), c0 = Math.cos(lat0 * RAD);
 return (lat, lon) => {
  const p = lat * RAD, l = (lon - lon0) * RAD, cp = Math.cos(p), cl = Math.cos(l);
  return [cp * Math.sin(l), c0 * Math.sin(p) - s0 * cp * cl, s0 * Math.sin(p) + c0 * cp * cl];
 };
}
const f2 = v => Math.round(v * 100) / 100;
const ang = ([x, y]) => Math.atan2(y, x);
// Where an edge from a seen point to a hidden one (or back) meets the rim.
const crossing = (a, b) => { const t = a[2] / (a[2] - b[2]), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, n = Math.hypot(x, y) || 1; return [x / n, y / n]; };

// One coastline's visible land as closed loops of [x, y] (y up).
export function clipRing(pts) {
 const seen = pts.map(p => p[2] >= 0);
 if (seen.every(Boolean)) return [pts.map(p => [p[0], p[1]])];
 if (!seen.some(Boolean)) return [];
 // Start on a hidden point, so every piece begins at an entry.
 const s = seen.indexOf(false), n = pts.length, frags = [];
 let cur = null;
 for (let k = 1; k <= n; k++) {
  const a = pts[(s + k - 1) % n], b = pts[(s + k) % n], sa = a[2] >= 0, sb = b[2] >= 0;
  if (!sa && sb) cur = [crossing(a, b), [b[0], b[1]]];
  else if (sa && sb) cur.push([b[0], b[1]]);
  else if (sa && !sb) { cur.push(crossing(a, b)); frags.push(cur); cur = null; }
 }
 // Join: from a piece's exit, round the rim anticlockwise to the next entry.
 const loops = [], used = new Set();
 for (let i = 0; i < frags.length; i++) {
  if (used.has(i)) continue;
  const loop = []; let j = i;
  while (!used.has(j)) {
   used.add(j); loop.push(...frags[j]);
   const out = ang(frags[j].at(-1));
   let next = -1, gap = Infinity;
   for (let m = 0; m < frags.length; m++) { const d = ((ang(frags[m][0]) - out) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (d < gap) { gap = d; next = m; } }
   for (let t = 8 * RAD; t < gap; t += 8 * RAD) loop.push([Math.cos(out + t), Math.sin(out + t)]);
   j = next;
  }
  loops.push(loop);
 }
 return loops;
}

// The globe as an SVG string, `size` pixels square, the place [lat, lon]
// marked. Colours from the caller's theme where it has them.
export function globeSvg([lat, lon], {size = 40, sea = '#1d4f73', land = '#cfe3b4', line = 'rgba(255,255,255,.22)', dot = '#ff5a4f', rim = 'rgba(255,255,255,.75)', title = ''} = {}) {
 const at = view(lat * TILT, lon);
 let paths = '';
 for (const r of GLOBE_LAND) {
  const pts = [];
  for (let i = 0; i < r.length; i += 2) pts.push(at(r[i + 1] / 2, r[i] / 2));
  // Anticlockwise seen from outside, so the land is on the left (the data
  // keeps either winding).
  let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1];
  if (a < 0) pts.reverse();
  for (const loop of clipRing(pts)) paths += loop.map(([x, y], k) => (k ? 'L' : 'M') + f2(x) + ',' + f2(-y)).join('') + 'Z';
 }
 // Parallels and meridians, the seen half of each.
 let grid = '';
 const trace = list => { let d = '', pen = false; for (const p of list) { if (p[2] < 0) { pen = false; continue; } d += (pen ? 'L' : 'M') + f2(p[0]) + ',' + f2(-p[1]); pen = true; } return d; };
 for (const g of [-60, -30, 0, 30, 60]) grid += trace(Array.from({length: 73}, (_, k) => at(g, lon - 180 + k * 5)));
 for (const m of [-60, 0, 60]) grid += trace(Array.from({length: 37}, (_, k) => at(-90 + k * 5, lon + m)));
 const [px, py] = at(lat, lon);
 return `<svg class="globe" xmlns="http://www.w3.org/2000/svg" viewBox="-1.08 -1.08 2.16 2.16" width="${size}" height="${size}" role="img" aria-label="${title ? title.replace(/[<>&"]/g, '') : 'Where it is'}">`
  + `<circle r="1" fill="${sea}"/>`
  + `<path d="${grid}" fill="none" stroke="${line}" stroke-width=".03"/><path d="${paths}" fill="${land}"/>`
  + `<circle r="1" fill="none" stroke="${rim}" stroke-width=".07"/>`
  + `<circle cx="${f2(px)}" cy="${f2(-py)}" r=".2" fill="${dot}" stroke="#ffffff" stroke-width=".07"/>`
  + `</svg>`;
}
