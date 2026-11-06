// THE MAP OF THE LANDSCAPES (the US landscapes goal, 2 November 2026; the
// owner: "Lets also expose the map we built so players have something to refer
// to when selecting biomes. Im thinking of a clickable map"). Pure: shapes in,
// a landscape out for a point, an SVG path out for a shape. No DOM; the menus
// draw it (ui-map.js), the builder's door 2 asks it where a survey lies.
// tests/landscape-map.test.mjs.
//
// The shapes are src/us-map-data.js, written by tools/us-map.mjs from the
// study's partition of the USA (EPA level III ecoregions grouped into the
// landscapes, with overlays for the small special places -- Monterey, the
// redwood belt, the Coachella Valley, Sedona -- local:
// docs/studies/us-landscapes/map/), Alaska's and Hawaii's outlines from
// Natural Earth (public domain). They are stored already projected, in tenths
// of a pixel of a 960 x 500 picture, so drawing them is a path string and
// finding a point is a projection and a point-in-polygon test.
//
// The projection is the familiar one for a map of the USA (as d3's
// geoAlbersUsa): an equal-area Albers conic for the lower 48 (standard
// parallels 29.5 and 45.5 N), Alaska a third of its size in the lower left,
// Hawaii beside it. The numbers are d3's (BSD licence; the numbers, not its
// code). The map is a picture to pick from, not a survey: a point a few
// kilometres outside every shape (a course on the shore, simplified away)
// takes the nearest shape within `near`.

const RAD = Math.PI / 180;
export const MAP_W = 960, MAP_H = 500;

function albers(phi1, phi2, phi0, lam0) {
 const n = (Math.sin(phi1 * RAD) + Math.sin(phi2 * RAD)) / 2;
 const C = Math.cos(phi1 * RAD) ** 2 + 2 * n * Math.sin(phi1 * RAD);
 const r0 = Math.sqrt(C - 2 * n * Math.sin(phi0 * RAD)) / n;
 return (lat, lon) => {
  const t = n * (lon - lam0) * RAD, r = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
  return [r * Math.sin(t), r0 - r * Math.cos(t)];
 };
}
// One part of the map: a projection, its scale, the place at its centre and
// where on the picture that centre goes.
function part(phi1, phi2, lam0, centre, k, at) {
 const p = albers(phi1, phi2, centre[0], lam0), c = p(centre[0], centre[1]);
 return (lat, lon) => { const [x, y] = p(lat, lon); return [at[0] + k * (x - c[0]), at[1] - k * (y - c[1])]; };
}
const K = 1070;
const LOWER48 = part(29.5, 45.5, -96, [38.7, -96.6], K, [480, 250]);
const ALASKA = part(55, 65, -154, [58.5, -156], .35 * K, [480 - .307 * K, 250 + .201 * K]);
const HAWAII = part(8, 18, -157, [19.9, -160], K, [480 - .205 * K, 250 + .212 * K]);

// Which part of the map a place is drawn in.
export const inset = (lat, lon) => {
 const w = lon > 0 ? lon - 360 : lon; // the Aleutians run past 180
 if (lat > 50.5 && w < -129) return 'alaska';
 if (lat < 23.5 && w < -150) return 'hawaii';
 return 'lower48';
};
// A place on the map's picture, [x, y] in pixels of the 960 x 500 picture.
export function project(lat, lon) {
 const w = lon > 0 ? lon - 360 : lon;
 const which = inset(lat, lon);
 return which === 'alaska' ? ALASKA(lat, w) : which === 'hawaii' ? HAWAII(lat, w) : LOWER48(lat, w);
}

// A shape's rings (flat [x0, y0, x1, y1, ...] in tenths of a pixel) as an SVG
// path, in pixels.
export function shapePath(rings) {
 let d = '';
 for (const r of rings) {
  for (let i = 0; i < r.length; i += 2) d += (i ? 'L' : 'M') + (r[i] / 10) + ',' + (r[i + 1] / 10);
  d += 'Z';
 }
 return d;
}

// Even-odd point in a shape's rings (pixels).
function inside(rings, x, y) {
 const X = x * 10, Y = y * 10;
 let c = false;
 for (const r of rings) {
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
   const ax = r[j], ay = r[j + 1], bx = r[i], by = r[i + 1];
   if ((by > Y) !== (ay > Y) && X < (ax - bx) * (Y - by) / (ay - by) + bx) c = !c;
  }
 }
 return c;
}
// Distance in pixels from a point to a shape's outline.
function edgeDistance(rings, x, y) {
 const X = x * 10, Y = y * 10;
 let best = Infinity;
 for (const r of rings) for (let i = 2; i < r.length; i += 2) {
  const ax = r[i - 2], ay = r[i - 1], dx = r[i] - ax, dy = r[i + 1] - ay;
  const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy || 1)));
  best = Math.min(best, Math.hypot(X - ax - dx * t, Y - ay - dy * t));
 }
 return best / 10;
}

// The landscape at a point of the picture: the overlays first (they lie over
// the big shapes), then the shape holding it, then the nearest within `near`
// pixels. `shapes` [{key, overlay, rings}]. Null outside them all.
export function landscapeAtPoint(shapes, x, y, {near = 2} = {}) {
 for (const pass of [true, false]) for (const s of shapes) if (!!s.overlay === pass && inside(s.rings, x, y)) return s.key;
 let best = null, bd = near;
 for (const s of shapes) { const d = edgeDistance(s.rings, x, y); if (d < bd) { bd = d; best = s.key; } }
 return best;
}
// The landscape at a place on Earth, for the builder's door 2: where a survey
// lies. A pixel is about 8 km on the lower 48; `near` is 6 px (PLACED: Key
// West's islands are thinner than the simplified outline keeps, and lie 4-6
// px from the nearest shape -- a survey that far off every shape is on a
// coast, and its nearest landscape is the right guess).
export const landscapeAt = (shapes, lat, lon, {near = 6} = {}) => {
 const [x, y] = project(lat, lon);
 return landscapeAtPoint(shapes, x, y, {near});
};
