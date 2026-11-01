// A REAL COURSE'S MARKS AND REFERENCE FROM OPENSTREETMAP (the course builder,
// stages 7-8; docs/COURSE_BUILDER.md, *The test course*). Shared by the
// scripted build (tools/real-course.mjs) and the journey that drives door 2's
// page on the same course (tools/builder-journeys/door-real-worthington.mjs),
// so both mark the same holes and score against the same outlines.
//
// `toLocal(lat, lon)` -> {x, z}: door 2's local metres (x east of the
// property's middle, z south of it).
import {TRACE} from '../src/lidar/trace.js';

export function osmWays(osm, toLocal) {
 return (osm?.elements || []).filter(e => e.type === 'way' && e.geometry).map(e => ({tags: e.tags || {}, ring: e.geometry.map(g => { const p = toLocal(g.lat, g.lon); return [p.x, p.z]; })}));
}
const centroid = r => ({x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length});

// The holes, from OpenStreetMap's numbered greens and its tees, matched to the
// club's card ({par, blue, handicap?}; yards).
export function holesFromOsm(ways, card, log = () => {}) {
 const greens = ways.filter(w => w.tags.golf === 'green' && /^\d+$/.test(w.tags.ref || '')).map(w => ({n: +w.tags.ref, ...centroid(w.ring)}));
 const tees = ways.filter(w => w.tags.golf === 'tee').map(w => centroid(w.ring));
 const holes = [], used = new Set(), sets = ['back', 'middle', 'front'];
 for (let n = 1; n <= card.par.length; n++) {
  const g = greens.find(q => q.n === n); if (!g) continue;
  const want = card.blue[n - 1] * .9144;
  // The tee that fits the card best: its straight distance near the card's
  // yardage (a dogleg's card is measured round the bend, so a tee nearer than
  // the card is likelier than one farther), near the green before it (a
  // course walks from a green to the next tee), and not already another
  // hole's (two holes can share one). OpenStreetMap's tee is the whole pad,
  // the card's yardage from a plate on it.
  const prev = greens.find(q => q.n === n - 1);
  const fit = tees.map((t, i) => { const d = Math.hypot(t.x - g.x, t.z - g.z), e = d > want ? 1.5 * (d - want) / want : (want - d) / want;
   return {t, i, d, e, cost: e + (prev ? Math.hypot(t.x - prev.x, t.z - prev.z) / 400 : 0) + (used.has(i) ? .2 : 0)}; }).filter(c => c.e < .4).sort((p, q) => p.cost - q.cost);
  const mine = fit.slice(0, 1);
  // Its shorter tees: free ones ahead of the back tee, within 80 m of it.
  for (const c of fit.slice(1)) if (mine.length < 3 && !used.has(c.i) && c.d < mine[0].d && Math.hypot(c.t.x - mine[0].t.x, c.t.z - mine[0].t.z) < 80) mine.push(c);
  for (const c of mine) used.add(c.i);
  // None near the card (OpenStreetMap lacks the tee): the likeliest of any.
  if (!mine.length) { const any = tees.map((t, i) => ({t, i, d: Math.hypot(t.x - g.x, t.z - g.z)})).map(c => ({...c, cost: Math.abs(c.d - want) / want + (prev ? Math.hypot(c.t.x - prev.x, c.t.z - prev.z) / 400 : 0)})).sort((p, q) => p.cost - q.cost)[0];
   if (any) { mine.push(any); log(`  hole ${n}: no tee within 40% of ${card.blue[n - 1]} yards; took one ${Math.round(any.d / .9144)} yards out`); } }
  if (!mine.length) { log(`  hole ${n}: no tee fits ${card.blue[n - 1]} yards`); continue; }
  mine.sort((p, q) => q.d - p.d);
  holes.push({number: n, par: card.par[n - 1], index: card.handicap?.[n - 1] ?? n, tees: mine.map((c, i) => ({x: c.t.x, z: c.t.z, set: sets[i]})), green: {x: g.x, z: g.z}});
 }
 log(`holes: ${holes.length} marked from ${greens.length} numbered greens and ${tees.length} tees`);
 return holes;
}

// OpenStreetMap's outlines rasterised on a grid ({nx, nz, cell, halfX, halfZ}):
// each cell 'green', 'tee', 'fairway', 'sand', 'water' or null.
// OpenStreetMap's golf=rough is the grass mapped beside the fairways -- what
// the trace calls semi-rough -- scored only where a course maps it.
export const KINDS = {green: ['green'], tee: ['tee'], fairway: ['fairway'], semi: ['rough'], sand: ['bunker'], water: ['water_hazard', 'lateral_water_hazard']};
export function truthGrid(ways, grid) {
 const {nx, nz, cell, halfX, halfZ} = grid, truth = new Array(nx * nz).fill(null);
 const fillRing = (ring, kind) => {
  const zs = ring.map(p => p[1]), j0 = Math.max(0, Math.ceil((Math.min(...zs) + halfZ) / cell)), j1 = Math.min(nz - 1, Math.floor((Math.max(...zs) + halfZ) / cell));
  for (let j = j0; j <= j1; j++) { const z = -halfZ + j * cell, xs = [];
   for (let q = 0, p = ring.length - 1; q < ring.length; p = q++) { const [ax, az] = ring[p], [bx, bz] = ring[q]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
   xs.sort((u, v) => u - v);
   for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.ceil((xs[k] + halfX) / cell)); i <= Math.min(nx - 1, Math.floor((xs[k + 1] + halfX) / cell)); i++) truth[j * nx + i] = kind; }
 };
 // Larger surfaces first, so what lies on them is painted over them: a
 // course's rough outline wraps its fairways and greens (painted last, it
 // hid nearly every green TPC Scottsdale maps; imagery iteration 10).
 for (const kind of ['semi', 'fairway', 'water', 'tee', 'green', 'sand']) for (const w of ways) if (KINDS[kind].includes(w.tags.golf) || (kind === 'water' && w.tags.natural === 'water' && w.tags.water === 'pond')) fillRing(w.ring, kind);
 return truth;
}
// Overlap (intersection over union) of each kind: `kindAt(k)` the traced or
// built kind of cell k.
export function overlap(truth, kindAt) {
 return Object.fromEntries(Object.keys(KINDS).map(kind => { let i = 0, u = 0; for (let k = 0; k < truth.length; k++) { const p = kindAt(k) === kind, t = truth[k] === kind; if (p && t) i++; if (p || t) u++; } return [kind, u ? i / u : null]; }));
}
export const scoreCodes = (truth, codes) => overlap(truth, k => TRACE[codes[k]]);
