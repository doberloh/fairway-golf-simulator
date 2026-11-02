// A COURSE FROM OPENSTREETMAP (the owner, 1 November 2026: "Pull in the open
// maps tracing first. Give the user the option to keep it. Or use it as a
// starting point to build LIDAR or Image traces"; docs/COURSE_BUILDER.md *The
// amended goal*). Many real courses are already traced in OpenStreetMap:
// golf=green, fairway, tee, bunker, rough, water_hazard and
// lateral_water_hazard, cartpath and path; natural=water and natural=wood;
// natural=tree; and golf=hole lines from tee to green with the hole's number
// (`ref`) and `par`. Door 2 lays them on the land as layers and its holes as
// markers.
//
// Fetched only when the player presses for it (Overpass API, the land's box),
// or read from a file the player saved from it. ODbL: the course is credited
// "© OpenStreetMap contributors (ODbL)", and a database made from it and
// shared stays under that licence (docs/DISTRIBUTION_REVIEW.md).
//
// The parsing and the laying are pure (no DOM); tests/osm.test.mjs.

export const OSM_CREDIT = 'Course outlines © OpenStreetMap contributors (ODbL)';
// OpenStreetMap's tags to door 2's layers. Lower in the list is painted later,
// but layers do not cover one another (layers.js), so the order only matters
// within a layer.
export const OSM_LAYERS = {
 semi: t => t.golf === 'rough',
 fairway: t => t.golf === 'fairway',
 tee: t => t.golf === 'tee',
 green: t => t.golf === 'green',
 sand: t => t.golf === 'bunker' || t.natural === 'sand' && t.golf != null,
 water: t => t.golf === 'water_hazard' || t.golf === 'lateral_water_hazard' || t.natural === 'water' || t.water === 'pond',
 path: t => t.golf === 'cartpath' || t.golf === 'path' || (t.highway === 'path' && t.golf != null),
};

// The Overpass query for every golf feature, water body and wood in a box
// ([lon0, lat0, lon1, lat1]), with their shapes.
export function overpassQuery([lon0, lat0, lon1, lat1]) {
 const b = `${lat0},${lon0},${lat1},${lon1}`;
 return `[out:json][timeout:90];(way["golf"](${b});relation["golf"](${b});way["natural"="water"](${b});way["natural"="wood"](${b});way["landuse"="forest"](${b});node["natural"="tree"](${b});way["leisure"="golf_course"](${b});way["building"](${b});relation["leisure"="golf_course"](${b}););out geom;`;
}
export async function fetchOsm(box, get = fetch) {
 const r = await get('https://overpass-api.de/api/interpreter', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(overpassQuery(box))});
 if (!r.ok) throw Error(`OpenStreetMap's server said ${r.status}${r.status === 429 || r.status >= 500 ? ' (it is busy: try again in a minute)' : ''}.`);
 return r.json();
}

// The features of an Overpass answer (JSON) in local metres: `toLocal(lat,
// lon)` -> {x, z}. Ways closed or not; a relation's outer rings (its inner
// ones as holes). Returns {areas: [{tags, rings}], lines: [{tags, points}],
// trees: [{x, z}]}.
export function osmFeatures(json, toLocal) {
 const areas = [], lines = [], trees = [];
 const ring = g => g.map(p => { const q = toLocal(p.lat, p.lon); return [q.x, q.z]; });
 for (const e of json?.elements || []) {
  const t = e.tags || {};
  if (e.type === 'node' && t.natural === 'tree') { const q = toLocal(e.lat, e.lon); trees.push({x: q.x, z: q.z}); continue; }
  if (e.type === 'way' && e.geometry?.length >= 2) {
   const pts = ring(e.geometry), closed = e.geometry.length > 3 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
   if (closed) areas.push({tags: t, rings: [pts]}); else lines.push({tags: t, points: pts});
  }
  if (e.type === 'relation' && e.members) {
   const outer = e.members.filter(m => m.role !== 'inner' && m.geometry?.length > 3).map(m => ring(m.geometry)), inner = e.members.filter(m => m.role === 'inner' && m.geometry?.length > 3).map(m => ring(m.geometry));
   if (outer.length) areas.push({tags: {...t, ...(e.members[0]?.tags || {})}, rings: [...outer, ...inner]});
  }
 }
 return {areas, lines, trees};
}

// THE COURSE'S BOUNDARY as OpenStreetMap draws it (leisure=golf_course): a
// closed way, or a relation whose outer ways are joined end to end into
// rings. The largest ring, in local metres, or null when the course has none.
export function osmBoundary(json, toLocal) {
 const rings = [], key = p => `${p.lat},${p.lon}`;
 for (const e of json?.elements || []) {
  if (e.tags?.leisure !== 'golf_course') continue;
  if (e.type === 'way' && e.geometry?.length > 3) rings.push(e.geometry);
  if (e.type === 'relation') {
   const segs = (e.members || []).filter(m => m.role !== 'inner' && m.geometry?.length >= 2).map(m => [...m.geometry]);
   while (segs.length) {
    const ring = segs.shift();
    for (let grew = true; grew && key(ring[0]) !== key(ring.at(-1));) {
     grew = false;
     for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], end = key(ring.at(-1));
      if (key(sg[0]) === end) ring.push(...sg.slice(1)); else if (key(sg.at(-1)) === end) ring.push(...sg.reverse().slice(1)); else continue;
      segs.splice(i, 1); grew = true; break;
     }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring.at(-1))) rings.push(ring);
   }
  }
 }
 const local = rings.map(r => r.map(p => { const q = toLocal(p.lat, p.lon); return [q.x, q.z]; }));
 const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
 return local.sort((a, b) => area(b) - area(a))[0] ?? null;
}

// A building's footprint as a house (trace-edit.js `homes`): the smallest
// rectangle round its outline, tried along each of its edges, turned to face
// the nearest mown ground (`facing(x, z)`, a bearing) among its four sides.
// Only house-sized ones (40 to 1500 m², PLACED): a garden shed is not drawn,
// and a warehouse is not a house.
export function homeOfFootprint(ring, facing = () => 0) {
 const pts = ring.slice(0, ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? -1 : ring.length);
 if (pts.length < 3) return null;
 let best = null;
 for (let i = 0; i < pts.length; i++) {
  const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, bz - az); if (len < .01) continue;
  const ux = (bx - ax) / len, uz = (bz - az) / len; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, z] of pts) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const area = (u1 - u0) * (v1 - v0);
  if (!best || area < best.area) { const um = (u0 + u1) / 2, vm = (v0 + v1) / 2; best = {area, a: u1 - u0, b: v1 - v0, phi: Math.atan2(ux, uz), x: um * ux - vm * uz, z: um * uz + vm * ux}; }
 }
 if (!best || best.area < 40 || best.area > 1500) return null;
 const want = facing(best.x, best.z), diff = t => Math.abs(Math.atan2(Math.sin(t - want), Math.cos(t - want)));
 const k = [0, 1, 2, 3].reduce((m, q) => diff(best.phi + q * Math.PI / 2) < diff(best.phi + m * Math.PI / 2) ? q : m, 0);
 const along = k % 2 === 0;
 return {x: best.x, z: best.z, rotation: Math.atan2(Math.sin(best.phi + k * Math.PI / 2), Math.cos(best.phi + k * Math.PI / 2)), width: along ? best.b : best.a, depth: along ? best.a : best.b};
}

// The features laid on a trace (trace-edit.js): each area filled onto its
// layer, a cart path's line painted 2.5 m wide; woods become a tree zone,
// single trees placed. Returns what was laid, by layer.
export function layOsm(model, feats, {pathWidth = 2.5, woodDensity = 150} = {}) {
 const laid = {};
 for (const [kind, is] of Object.entries(OSM_LAYERS)) {
  for (const a of feats.areas) if (is(a.tags)) { model.fill(a.rings, kind); laid[kind] = (laid[kind] || 0) + 1; }
 }
 for (const l of feats.lines) if (OSM_LAYERS.path(l.tags)) {
  model.beginStroke();
  for (let i = 1; i < l.points.length; i++) { const [ax, az] = l.points[i - 1], [bx, bz] = l.points[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1)); for (let s = 0; s <= n; s++) model.paint({x: ax + (bx - ax) * s / n, z: az + (bz - az) * s / n, radius: pathWidth / 2, kind: 'path'}); }
  model.endStroke(); laid.path = (laid.path || 0) + 1;
 }
 for (const a of feats.areas) if (a.tags.natural === 'wood' || a.tags.landuse === 'forest') { model.treeZone(a.rings[0], {density: woodDensity, seed: (laid.woods = (laid.woods || 0) + 1)}); }
 for (const t of feats.trees) model.addTree({x: t.x, z: t.z, h: 14, crown: 4});
 if (feats.trees.length) laid.trees = feats.trees.length;
 // Buildings, as houses (after the surfaces, so each faces the mown ground).
 model.beginStroke();
 for (const a of feats.areas) if (a.tags.building && !a.tags.golf) { const h = homeOfFootprint(a.rings[0], model.facing); if (h) { model.addHome(h); laid.houses = (laid.houses || 0) + 1; } }
 model.endStroke();
 return laid;
}

// WHOSE TREES (the owner, 1 November 2026: "when i started building the
// course i had tree data, but then after i imported open street maps i lost
// the trees. We need to give the user options for tree data to be merged
// with OSM"). Until then a map with any tree or wood of its own replaced
// every tree the LIDAR found. Now door 2 offers three: 'merge' (the default)
// keeps every LIDAR tree -- each one measured, where it stands and how tall
// -- and adds OpenStreetMap's (its single trees and the woods it scatters)
// only where no LIDAR tree stands within `gap` metres: a tree the survey
// missed, or a wood planted since; 'lidar' keeps the survey's alone; 'osm'
// the map's alone. `gap` 6 m: about one crown across, the closest two LIDAR
// trees stand at the canopy's own spacing (PLACED).
export const TREES_FROM = ['merge', 'lidar', 'osm'];
export function mergeTrees(lidar, osm, how = 'merge', {gap = 6} = {}) {
 if (how === 'lidar') return lidar.map(t => ({...t}));
 if (how === 'osm') return osm.map(t => ({...t}));
 const cells = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
 for (const t of lidar) { const k = key(Math.floor(t.x / gap), Math.floor(t.z / gap)); (cells.get(k) ?? cells.set(k, []).get(k)).push(t); }
 const near = o => { const i = Math.floor(o.x / gap), j = Math.floor(o.z / gap); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const t of cells.get(key(i + a, j + b)) ?? []) if (Math.hypot(t.x - o.x, t.z - o.z) < gap) return true; return false; };
 return [...lidar.map(t => ({...t})), ...osm.filter(o => !near(o)).map(t => ({...t}))];
}

// The holes OpenStreetMap numbers are read by osm-course.js (osmHoles), which
// also picks the course and lines them up with the ground.
