// A REAL COURSE'S MARKS AND REFERENCE FROM OPENSTREETMAP (the course builder,
// stages 7-8; docs/COURSE_BUILDER.md, *The test course*). Shared by the
// scripted build (tools/real-course.mjs) and the journey that drives door 2's
// page on the same course (tools/builder-journeys/door-real-worthington.mjs),
// so both mark the same holes and score against the same outlines.
//
// `toLocal(lat, lon)` -> {x, z}: door 2's local metres (x east of the
// property's middle, z south of it).
import {TRACE, lineUp} from '../src/lidar/trace.js';

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

// OPENSTREETMAP DAMAGED, the refinement's test (the owner, 1 November 2026:
// OpenStreetMap first, refined from the picture or the LIDAR): the map's
// codes (TRACE's) with every outline moved `shiftM` metres east (and `dz` south) and every
// other bunker and green left out. What a refinement recovers from this,
// scored against the map as it is, is the measure (imagery-bench.mjs and
// real-course.mjs --refine).
export function damageTruth(truth, land, {shiftM = 4, dz = 0} = {}) {
 const N = land.nx * land.nz, shift = Math.round(shiftM / land.cell), sz = Math.round(dz / land.cell), damaged = new Uint8Array(N); let flip = 0;
 for (let j = 0; j < land.nz; j++) for (let i = 0; i < land.nx; i++) { const k = j * land.nx + i, si = i - shift, sj = j - sz, src = si >= 0 && sj >= 0 && si < land.nx && sj < land.nz ? sj * land.nx + si : -1, t = src >= 0 ? truth[src] : null; if (t) damaged[k] = TRACE.indexOf(t); }
 const lab = new Int32Array(N).fill(-1); let id = 0;
 for (let s0 = 0; s0 < N; s0++) { const c = damaged[s0]; if ((c !== TRACE.indexOf('sand') && c !== TRACE.indexOf('green')) || lab[s0] >= 0) continue; const st = [s0]; lab[s0] = id; const drop = (flip++ % 2) === 1; const cells = [s0]; while (st.length) { const k = st.pop(), i = k % land.nx; for (const n of [i > 0 ? k - 1 : -1, i < land.nx - 1 ? k + 1 : -1, k - land.nx, k + land.nx]) if (n >= 0 && n < N && lab[n] < 0 && damaged[n] === c) { lab[n] = id; st.push(n); cells.push(n); } } if (drop) for (const k of cells) damaged[k] = 0; id++; }
 return damaged;
}

// OPENSTREETMAP LINED UP WITH THE PLACE before it is a yardstick (1 November
// 2026): Worthington's outlines sit about 3 m west and 1.5 m north of where
// the LIDAR's ground and the aerial picture both put its bunkers and ponds,
// and scoring a trace against the map as it lies charged the trace with the
// map's own error. The map's truth grid moved by trace.js's own lineUp (from
// the picture, or the LIDAR); the shift in metres comes back with it.
export function lineUpTruth(truth, land, {picture = null, mode = 'picture'} = {}) {
 const {nx, nz, cell} = land, codes = Uint8Array.from(truth, t => t ? TRACE.indexOf(t) : 0), u = lineUp(land, codes, {picture, mode});
 if (!u.di && !u.dj) return {truth, x: 0, z: 0, gain: u.gain};
 const moved = new Array(truth.length).fill(null);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const si = i - u.di, sj = j - u.dj; if (si >= 0 && sj >= 0 && si < nx && sj < nz) moved[j * nx + i] = truth[sj * nx + si]; }
 return {truth: moved, x: u.di * cell, z: u.dj * cell, gain: u.gain};
}
