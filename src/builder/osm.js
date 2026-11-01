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
 return `[out:json][timeout:90];(way["golf"](${b});relation["golf"](${b});way["natural"="water"](${b});way["natural"="wood"](${b});way["landuse"="forest"](${b});node["natural"="tree"](${b}););out geom;`;
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
 return laid;
}

// The holes OpenStreetMap numbers: each golf=hole line, tee first, green last,
// with its bends -- as door 2's markers ({tees: [{x, z, set}], aims, green}),
// by its `ref`. A line drawn green-first is turned round by the green nearest
// one of its ends.
export function osmHoles(feats) {
 const greens = feats.areas.filter(a => a.tags.golf === 'green').map(a => { const r = a.rings[0]; return {x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length}; });
 const out = [];
 for (const l of feats.lines) {
  if (l.tags.golf !== 'hole' || !/^\d+$/.test(l.tags.ref || '')) continue;
  let pts = l.points;
  const near = p => Math.min(Infinity, ...greens.map(g => Math.hypot(g.x - p[0], g.z - p[1])));
  if (greens.length && near(pts[0]) < near(pts.at(-1))) pts = [...pts].reverse();
  const n = +l.tags.ref;
  out[n - 1] = {tees: [{x: pts[0][0], z: pts[0][1], set: 'back'}], aims: pts.slice(1, -1).map(([x, z]) => ({x, z})), green: {x: pts.at(-1)[0], z: pts.at(-1)[1]}, par: +l.tags.par || null};
 }
 return out;
}
