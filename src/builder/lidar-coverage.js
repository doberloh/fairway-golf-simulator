// HOW MUCH OF THE GROUND A SEARCH'S LIDAR COVERS (the owner, 5 November 2026:
// "before downloading we need to signify how much of the course is going to be
// covered by the tiles. Sometimes you may not have downloaded all of the tiles
// needed"). The square searched for is sampled on a grid and each sample asked
// whether anything covers it: a tile's box, a survey's published outline, or
// what is already saved in the LIDAR folder. Measured against the square, as the
// course's own edge is not known until it is traced. Pure;
// tests/lidar-coverage.test.mjs.

// Boxes are {lon0, lat0, lon1, lat1}, in degrees, as squareAround makes them.
export const boxFrom = ([lon0, lat0, lon1, lat1]) => ({lon0, lat0, lon1, lat1});
export const overlaps = (a, b) => a.lon1 >= b.lon0 && a.lon0 <= b.lon1 && a.lat1 >= b.lat0 && a.lat0 <= b.lat1;
const inBox = (b, lon, lat) => lon >= b.lon0 && lon <= b.lon1 && lat >= b.lat0 && lat <= b.lat1;
// A GeoJSON Polygon or MultiPolygon as a list of polygons, each a list of rings.
export const polygonsOf = g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
export function boxOfGeometry(g) {
 const pts = polygonsOf(g).flat(2); if (!pts.length) return null;
 const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
 return {lon0: Math.min(...xs), lat0: Math.min(...ys), lon1: Math.max(...xs), lat1: Math.max(...ys)};
}
const inPolygon = (rings, lon, lat) => { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; };

// `boxes` and `polys`: what the source holds there. `held`: boxes of what is
// already saved. n x n samples (PLACED: 48, 30 m on a 1.5 km square, finer than a
// tile). Returns {n, grid, share, heldShare}: grid 0 no data, 1 to download, 2
// saved, south row first; the shares are of the whole square.
export function coverageOf(box, {boxes = [], polys = [], held = []} = {}, n = 48) {
 const grid = new Uint8Array(n * n), dLon = (box.lon1 - box.lon0) / n, dLat = (box.lat1 - box.lat0) / n; let some = 0, saved = 0;
 for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const lon = box.lon0 + (i + .5) * dLon, lat = box.lat0 + (j + .5) * dLat;
  if (held.some(b => inBox(b, lon, lat))) { grid[j * n + i] = 2; some++; saved++; }
  else if (boxes.some(b => inBox(b, lon, lat)) || polys.some(p => inPolygon(p, lon, lat))) { grid[j * n + i] = 1; some++; }
 }
 return {n, grid, share: some / (n * n), heldShare: saved / (n * n)};
}
// Rounded so that nearly all never reads as all: 99.6% says 99%.
export const percent = v => v >= 1 ? 100 : Math.min(99, Math.round(v * 100));

// THE SQUARES KEPT IN THE FOLDER are named for their survey, middle and size
// (lidar-search.js squareName). {id, box} from a name, or null.
export function squareOfName(name) {
 const m = name.match(/^(.*)_(-?\d+\.\d+)_(-?\d+\.\d+)_(\d+)m\.ept\.zip$/i); if (!m) return null;
 const lat = +m[2], lon = +m[3], h = +m[4] / 2 / 111320, w = h / Math.cos(lat * Math.PI / 180);
 return {id: m[1], box: {lon0: lon - w, lat0: lat - h, lon1: lon + w, lat1: lat + h}};
}
export const unionBox = boxes => ({lon0: Math.min(...boxes.map(b => b.lon0)), lat0: Math.min(...boxes.map(b => b.lat0)), lon1: Math.max(...boxes.map(b => b.lon1)), lat1: Math.max(...boxes.map(b => b.lat1))});

// One line for a survey, in the player's words.
export function coverageWords(c, sizeKm) {
 const all = percent(c.share), held = percent(c.heldShare), of = `the ${sizeKm} km square`;
 const covers = all === 100 ? `Covers all of ${of}` : all ? `Covers ${all}% of ${of}: the rest has no data here` : `Nothing over ${of}`;
 return c.heldShare ? `${covers}. ${held}% already saved.` : `${covers}.`;
}
