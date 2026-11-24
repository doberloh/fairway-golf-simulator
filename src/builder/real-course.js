// DOOR 2'S PIPELINE, "GENERATE A REAL LIFE COURSE" (the course builder,
// stage 7; docs/COURSE_BUILDER.md, *Two front doors*). Pure, so the builder's
// screens (door-real.js) and the scripted build of a real course
// (tools/real-course.mjs) run the same steps:
//   landFromSources  every LIDAR source gathered onto one grid over the
//                    property and the 150 m past it the game's mesh needs
//   pictureOnLand    an aerial picture laid on that grid, by its own position
//                    (geo.js) or by points matched by hand (`affineFromPairs`)
//   docFromLand      the land, the trace (lidar/trace.js), the holes marked
//                    and the trees found, as a built course document
// Local metres throughout: x east of the property's middle, z south of it.
import {createGridder, findTrees, gridFrame, FINE_NONE} from '../lidar/land.js';
import {toMetres} from '../lidar/las.js';
import {TREE_HAND} from '../built-world.js';
import {maskRings, fitRing, cellArea} from '../contour.js';
import {PALETTE, SPECK, POCK} from './trace-edit.js';
import {createLayers, tidyMask, LAYER_ORDER} from './layers.js';
import {boxMean, features, distanceFrom} from '../lidar/trace.js';
import {GRID_MARGIN, builtLine} from '../built-world.js';
// The longest tee set's yards (built-world.js builtLine: its first name).
const backYards = L => L.yards[L.names[0]];
import {digBed, levelFrom, shoreOf, digBowl, creekStations, carveCreek} from './water-bed.js';
import {CREEK_FIELDS, LIMITS} from '../course-doc.js';
import {DETAIL} from '../lidar/detail.js';

// The finest the land is gathered at for a property this size (PLACED: half
// a metre to 2.25 km², else a metre -- memory for a 3 x 3 km course).
export const cellFor = (wMetres, hMetres) => wMetres * hMetres <= 2.25e6 ? .5 : 1;
// The largest property (PLACED, the owner's decision 10: 3 x 3 km).
export const MAX_PROPERTY = 3000;

// One source's box, in its map units.
export const sourceBox = s => s.kind === 'points' ? {x0: s.bounds.minX, x1: s.bounds.maxX, y0: s.bounds.minY, y1: s.bounds.maxY}
   : {x0: Math.min(s.raster.x0, s.raster.x0 + s.raster.dx * (s.raster.width - 1)), x1: Math.max(s.raster.x0, s.raster.x0 + s.raster.dx * (s.raster.width - 1)), y0: Math.min(s.raster.y0, s.raster.y0 + s.raster.dy * (s.raster.height - 1)), y1: Math.max(s.raster.y0, s.raster.y0 + s.raster.dy * (s.raster.height - 1))};
// The box every source covers, in the first one's map units.
export function sourcesBox(sources) {
 let b = null;
 for (const s of sources) {
  const r = sourceBox(s);
  b = b ? {x0: Math.min(b.x0, r.x0), x1: Math.max(b.x1, r.x1), y0: Math.min(b.y0, r.y0), y1: Math.max(b.y1, r.y1)} : r;
 }
 return b;
}
export const crsOfSources = sources => sources[0]?.kind === 'points' ? sources[0].crs : sources[0]?.raster.crs;

// THE FINE GROUND INSIDE THE COURSE'S OUTLINE (22 November 2026): with
// `outline` (a ring in the sources' map units) and land coarser than
// FINE_CELL, the ground inside the outline's box (and DETAIL.buffer past it)
// is gathered at FINE_CELL too (land.js `fine`), for the half-metre patches
// docFromLand lays on greens' banks, tees' banks and bunkers. PLACED:
// FINE_CELL half a metre -- about seven returns a cell on a 30-point survey,
// steady; a quarter metre would be one or two, and noisy -- and at most
// FINE_MOST cells (40 million, 240 MB while gathering: a 3 x 3 km outline).
export const FINE_CELL = .5, FINE_MOST = 40e6;
// `frame`: land.js gridFrame of the land to be built.
export function fineExtent(frame, outline, buffer = DETAIL.buffer) {
 if (!outline?.length || frame.cell <= FINE_CELL) return null;
 const pts = outline.map(([x, y]) => frame.local(x, y)), xs = pts.map(p => p.x), zs = pts.map(p => p.z), {halfX, halfZ, cell} = frame;
 const lo = (v, half) => -half + Math.max(0, Math.floor((v - buffer + half) / FINE_CELL)) * FINE_CELL, hi = (v, half) => Math.min(half, v + buffer);
 const x0 = lo(Math.min(...xs), halfX), z0 = lo(Math.min(...zs), halfZ), x1 = hi(Math.max(...xs), halfX), z1 = hi(Math.max(...zs), halfZ);
 if (x1 <= x0 || z1 <= z0) return null;
 const nx = Math.floor((x1 - x0) / FINE_CELL) + 1, nz = Math.floor((z1 - z0) / FINE_CELL) + 1;
 return nx * nz > FINE_MOST || !(cell > FINE_CELL) ? null : {x0, z0, nx, nz, cell: FINE_CELL};
}

// The land over `box` (map units of the sources) and GRID_MARGIN metres past
// it. `pause` lets a page paint between chunks. `outline`: the course's rough
// outline in the same units, for the fine ground. Returns {land, gridder, trees}.
export async function landFromSources(sources, box, {cell = null, onStep = () => {}, pause = null, outline = null} = {}) {
 const crs = crsOfSources(sources), unit = toMetres(crs), m = GRID_MARGIN / unit.h;
 const wide = {x0: box.x0 - m, x1: box.x1 + m, y0: box.y0 - m, y1: box.y1 + m};
 // The cell: half a metre, or a metre for a large property -- and never finer
  // than the survey's points are apart (PLACED: the spacing rounded up to the
  // half metre), or most cells would hold no return and read as holes.
  const pts = sources.filter(s => s.kind === 'points'), area = pts.reduce((a, s) => a + Math.max(1, (s.bounds.maxX - s.bounds.minX) * (s.bounds.maxY - s.bounds.minY) * unit.h * unit.h), 0);
  const spacing = pts.length ? Math.sqrt(area / Math.max(1, pts.reduce((a, s) => a + (s.count || 0), 0))) : 0;
  const c = cell ?? Math.max(cellFor((box.x1 - box.x0) * unit.h, (box.y1 - box.y0) * unit.h), Math.ceil(spacing * 2 - 1e-9) / 2);
 const fine = fineExtent(gridFrame({box: wide, cell: c, unit}), outline);
 const gridder = createGridder({box: wide, cell: c, unit, fine});
 let done = 0;
 for (const s of sources) {
  onStep(`Reading ${s.name ?? s.form}`, done / sources.length);
  if (s.kind === 'points') {
   const b = s.bounds; if (b.maxX < wide.x0 || b.minX > wide.x1 || b.maxY < wide.y0 || b.minY > wide.y1) { done++; continue; }
   await s.each(p => gridder.add(p), {pause, onProgress: f => onStep(`Reading ${s.name ?? s.form}`, (done + f) / sources.length)});
  } else gridder.addRaster(s.raster, {surface: !!s.surface, rasterUnit: toMetres(s.raster.crs)});
  done++;
 }
 onStep('Finding the ground', 1);
 const land = gridder.finish();
 onStep('Finding the trees', 1);
 return {land, gridder, trees: findTrees(land), crs};
}

// A picture (`readGeoTiffRgb`, or {width, height, rgb, nir?, x0, y0, dx, dy})
// on the land's grid. `toPicture(mx, my)` takes the land's map point to the
// picture's map point (geo.js converter); `affine` instead takes local metres
// straight to the picture's pixel (hand alignment). Returns {rgb, nir, has}.
// `into`: a picture already laid, whose gaps this one fills (aerial pictures
// come in tiles, and a course often sits where several meet).
export function pictureOnLand(land, gridder, pic, {toPicture = null, affine = null, into = null} = {}) {
 const {nx, nz, cell, halfX, halfZ} = land, N = nx * nz;
 const rgb = into?.rgb ?? new Uint8Array(N * 3), nir = into ? into.nir : pic.nir ? new Uint8Array(N) : null, has = into?.has ?? new Uint8Array(N);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  if (has[j * nx + i]) continue;
  const x = -halfX + i * cell, z = -halfZ + j * cell;
  let col, row;
  if (affine) [col, row] = affine(x, z);
  else { const m = gridder.map(x, z), q = toPicture ? toPicture(m.x, m.y) : m; col = (q.x - pic.x0) / pic.dx; row = (q.y - pic.y0) / pic.dy; }
  const c = Math.round(col), r = Math.round(row);
  if (c < 0 || r < 0 || c >= pic.width || r >= pic.height) continue;
  const k = j * nx + i, s = r * pic.width + c;
  rgb[k * 3] = pic.rgb[s * 3]; rgb[k * 3 + 1] = pic.rgb[s * 3 + 1]; rgb[k * 3 + 2] = pic.rgb[s * 3 + 2];
  if (nir && pic.nir) nir[k] = pic.nir[s];
  has[k] = 1;
 }
 return {rgb, nir, has};
}

// Points matched by hand -- [{local: {x, z}, pixel: {col, row}}], three or
// more -- as the affine map that fits them best (least squares), and how far
// off in metres the worst pair is left. A slight bend is what more points can
// show; this keeps to a flat fit (turn, scale, shear, shift).
export function affineFromPairs(pairs) {
 if (pairs.length < 3) throw Error('Line a picture up with three or more matching points.');
 const solve = pick => {
  // Normal equations for [a b c] in v = a*x + b*z + c.
  let sxx = 0, sxz = 0, sx = 0, szz = 0, sz = 0, n = 0, sxv = 0, szv = 0, sv = 0;
  for (const p of pairs) { const {x, z} = p.local, v = pick(p); sxx += x * x; sxz += x * z; sx += x; szz += z * z; sz += z; n++; sxv += x * v; szv += z * v; sv += v; }
  const A = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]], B = [sxv, szv, sv];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A); if (Math.abs(D) < 1e-9) throw Error('The matching points lie on a line: pick three that make a triangle.');
  return [0, 1, 2].map(c => det(A.map((row, i) => row.map((v, j) => j === c ? B[i] : v))) / D);
 };
 const a = solve(p => p.pixel.col), b = solve(p => p.pixel.row);
 const f = (x, z) => [a[0] * x + a[1] * z + a[2], b[0] * x + b[1] * z + b[2]];
 // The pixel's size in metres, for the leftover error.
 const px = Math.sqrt(Math.abs(1 / (a[0] * b[1] - a[1] * b[0])));
 const worst = Math.max(...pairs.map(p => { const [c, r] = f(p.local.x, p.local.z); return Math.hypot(c - p.pixel.col, r - p.pixel.row) * px; }));
 return {map: f, worst};
}

// THE LIDAR AS A PICTURE, to lay the aerial picture against (the owner, 1
// November 2026: "display the lidar data along with the satellite data with
// different opacities"). One RGBA texel a cell into `out`:
//   relief      the ground shaded from the north-west, trees tinted green
//   brightness  the laser's brightness (sand and paths bright, water dark);
//               the relief where the survey has none
//   slope       the ground's slope, dark flat to white at 25% (PLACED) -- a
//               bunker's lip, a green's fall and a tee's bank as bright lines,
//               the edges the line-up (trace.js lineUp) itself reads
export const LIDAR_VIEWS = ['relief', 'brightness', 'slope'];
// WHERE THE FILES REACH (door 2's step 1, yellow; the owner, 1 November
// 2026): 1 for every cell within `metres` of a cell a point or height landed
// in (`land.noReturns` 0). The reach smooths over a survey thinned for the
// first look, or one sparse to begin with, and a pond the laser saw nothing
// back from; 10 m (PLACED: past the widest spacing of a QL2 survey thinned
// tenfold for the first look, short of a gap worth seeing).
export function coverage(land, metres = 10) {
 const {nx, nz, noReturns} = land, r = Math.max(1, Math.round(metres / land.cell)), a = new Uint8Array(nx * nz), out = new Uint8Array(nx * nz);
 // A square reach, row then column, each by a running count over the window.
 for (let j = 0; j < nz; j++) { let n = 0; const row = j * nx; for (let i = -r; i < nx; i++) { if (i + r < nx && !noReturns[row + i + r]) n++; if (i - r - 1 >= 0 && !noReturns[row + i - r - 1]) n--; if (i >= 0) a[row + i] = n > 0 ? 1 : 0; } }
 for (let i = 0; i < nx; i++) { let n = 0; for (let j = -r; j < nz; j++) { if (j + r < nz && a[(j + r) * nx + i]) n++; if (j - r - 1 >= 0 && a[(j - r - 1) * nx + i]) n--; if (j >= 0) out[j * nx + i] = n > 0 ? 1 : 0; } }
 return out;
}
export function lidarTexels(land, mode, out) {
 const {nx, ground: g, cell} = land, N = land.nx * land.nz;
 const slope = mode === 'slope' ? features(land).slope : null, I = mode === 'brightness' ? land.intensity : null;
 for (let k = 0; k < N; k++) {
  let c;
  if (slope) { const v = 20 + 235 * Math.min(1, slope[k] / 25); c = [v, v, v]; }
  else if (I && Number.isFinite(I[k])) { const v = Math.max(0, Math.min(255, I[k] * 255)); c = [v, v, v]; }
  else {
   const a = g[Math.min(N - 1, k + 1)] - g[Math.max(0, k - 1)], b = g[Math.min(N - 1, k + nx)] - g[Math.max(0, k - nx)];
   const s = Math.max(.15, Math.min(1, .62 - (a * .7 - b * .7) / (2 * cell) * 1.8));
   c = [s * 230, s * 235, s * 225];
   if (land.canopy?.[k] > 2) c = c.map((v, q) => v * .5 + [30, 90, 40][q] * .5);
  }
  out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = 255;
 }
 return out;
}

// Par from a hole's length (PLACED: to 250 yards a three, to 470 a four, a
// five past it -- the USGA's men's guide, rounded).
export const parFor = yards => yards <= 250 ? 3 : yards <= 470 ? 4 : 5;

// The built document. `traced` -- the trace's layers ({layers}, layers.js),
// or a composite ({codes}, the auto trace's) -- may be null: then -- and wherever
// the trace drew no green or tee under a mark -- a green is a 12 m disc round
// its mark and a tee a 6 x 10 m pad (PLACED), for the player to draw over. `holes`: [{number, par?, tees: [{x, z, set}], green: {x, z},
// line?}] in local metres. `trees` as land.js finds them.
// One layer's outlines as a course gets them: traced round its cells and
// FITTED (contour.js `fitRing`, 23 November 2026): straight where the cells
// ran straight, sharp where they turned a corner, curved elsewhere, and
// grown back to the cells' own area; scraps under SPECK dropped. Until then
// the staircase was relaxed (eight passes) and the corners cut, which left a
// side a few degrees off the grid wobbling -- the owner's "jaggy edges" on
// tees and greens, 80 cm on 1 m land -- and wore every corner off, a Line
// laid with Auto curve off included (RESEARCH, *Outlines fitted*; before
// 1 November, *Outlines without notches*). The
// trace step draws these too, so what is painted is seen as it will play.
// `x0`, `z0`: the first cell's middle, when the grid is not centred (the
// editor's raster, a part of it).
export function layerRings(m, {nx, nz, cell, halfX, halfZ, x0 = -halfX, z0 = -halfZ}) {
 return maskRings((i, j) => m[j * nx + i] === 1, nx, nz, x0, z0, cell)
  .map(r => fitRing(r, cell, {area: cellArea(r, x0, cell)})).filter(r => r.length >= 3 && ringArea(r) > SPECK);
}

export function docFromLand({land, traced = null, holes, trees = [], homes = [], name = 'Real course', landscape = 'heartland', credits = [], source = {}, landEdits = null, creeks = [], rocks = [], bunkers = [], creekLines = [], treePlan = null, surround = null}) {
 const {nx, nz, cell, halfX, halfZ} = land, ground = Float32Array.from(land.ground);
 // THE LAYERS, TIDIED (the owner, 31 October 2026: "features should not have
 // jagged or pock marked edges"): on each layer, patches under SPECK go and
 // holes under POCK fill. Each layer is then traced as its own outlines --
 // overlapping where the layers overlap, as the game reads a built course's
 // surfaces in the layers' own order (layers.js) -- so a fairway runs on
 // unbroken under its bunkers.
 const L = traced ? createLayers(nx, nz, PALETTE) : null;
 if (traced) {
  const from = traced.layers ?? createLayers(nx, nz, PALETTE).fromCodes(traced.codes);
  for (const [kind, m] of from.masks) { const c = Uint8Array.from(m); tidyMask(c, nx, nz, Math.round(SPECK / (cell * cell)), Math.round(POCK / (cell * cell))); L.masks.set(kind, c); }
  L.recompose();
 }
 const codes = L ? L.codes : null;
 // MOWN GROUND SMOOTHED. A survey's ground is a few points a cell, each a
 // centimetre or two off: on a green that is a pit a putted ball cannot climb
 // out of (Worthington's first test round stuck 70 cm from two cups). A
 // green's or tee's real shape is metres across, so their ground is averaged
 // over a 2.5 m square (PLACED), the fairway's over 1.5 m; sand and rough keep
 // what was measured. With no trace, the discs round the green marks.
 //
 // ONLY A SURVEY'S GROUND. Land that came from a finished course (Back to 2D,
 // draft-from-doc.js, `method` 'course') has had this, or was never a survey:
 // smoothing it again took a little more off a green's contours at every trip
 // between 2D and 3D (the owner, 4 November 2026). A survey's course starts
 // from the raw ground each time, so it never built up there.
 const surveyed = land.method !== 'course';
 const greenAt = (x, z) => holes.some(h => Math.hypot(x - h.green.x, z - h.green.z) < 14);
 const smoothR = new Uint8Array(nx * nz);
 if (surveyed) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i, t = codes ? PALETTE[codes[k]] : greenAt(-halfX + i * cell, -halfZ + j * cell) ? 'green' : 'rough';
  smoothR[k] = t === 'green' || t === 'tee' ? 2 : t === 'fairway' ? 1 : 0;
 }
 if (surveyed) for (const r of [1, 2]) {
  const m = boxMean(land.ground, nx, nz, Math.max(1, Math.round(r * 1.25 / cell / 2)));
  for (let k = 0; k < m.length; k++) if (smoothR[k] === r) ground[k] = m[k];
 }
 // GREENS TRUER STILL (1 November 2026, building every course in bench/lidar):
 // averaged over 2.5 m, the survey's greens kept ridges a putt cannot hold --
 // 17% inside Arcadia Bluffs' second, 10% at TPC Scottsdale's third green's
 // mark, the virtual golfers stuck on two of Arcadia's greens. A green's
 // ground is averaged over 5 m (PLACED: its tilt and tiers stay, a bump under
 // a stride goes), eased into the ground round it over 3 m outside, so its
 // collar keeps no lip. RESEARCH, *Greens a putt can hold*.
 if (surveyed) {
  const isGreen = Uint8Array.from({length: nx * nz}, (_, k) => codes ? (PALETTE[codes[k]] === 'green' ? 1 : 0) : (greenAt(-halfX + (k % nx) * cell, -halfZ + Math.floor(k / nx) * cell) ? 1 : 0));
  const out = distanceFrom(isGreen, nx, nz, cell), m = boxMean(ground, nx, nz, Math.max(1, Math.round(2.5 / cell))), EASE = 3;
  for (let k = 0; k < m.length; k++) { const w = isGreen[k] ? 1 : out[k] < EASE ? 1 - out[k] / EASE : 0; if (w > 0) { ground[k] = ground[k] * (1 - w) + m[k] * w; smoothR[k] = 3; } }
 }
 // THE 3D EDITOR'S SHAPING (round-trip.js): a difference on this grid, added
 // to the ground as the survey and the smoothing leave it -- before the ponds
 // are carved, which take the lower of the two.
 if (landEdits?.length === ground.length) for (let k = 0; k < ground.length; k++) ground[k] += landEdits[k];
 // Bunkers dug and creeks drawn on the 2D plan: into the ground here, as the 3D
 // editor digs them at once (water-bed.js), so each is made from the ground as
 // it stands. Before the ponds, which take the lower of the two.
 const onGrid = {heights: ground, nx, nz, cell, x0: -halfX, z0: -halfZ}, drawnCreeks = [];
 for (const b of bunkers) digBowl(onGrid, b);
 for (const c of creekLines) {
  const stations = creekStations(c.points, {width: c.width, height: (x, z) => sampleGrid(ground, land, x, z)});
  carveCreek(onGrid, stations);
  drawnCreeks.push({kind: 'creek', points: stations.map(p => CREEK_FIELDS.map(f => p[f]))});
 }
 const r2 = v => Math.round(v * 100) / 100;
 const surfaces = {green: [], fairway: [], tee: [], sand: [], semi: [], path: []};
 const water = [];
 // THE OUTLINES, SMOOTH: each layer's as `layerRings` makes them.
 const codeAt = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return codes && i >= 0 && j >= 0 && i < nx && j < nz ? PALETTE[codes[j * nx + i]] : 'rough'; };
 if (codes) {
  for (const kind of LAYER_ORDER) {
   const m = L.masks.get(kind); if (!m) continue;
   const rings = layerRings(m, land).map(r => r.map(([x, z]) => [r2(x), r2(z)])).filter(r => r.length >= 3);
   if (!rings.length) continue;
   if (kind !== 'water') { surfaces[kind] = [rings]; continue; }
   // Water: a body a ring not inside another, its islands with it; its level
   // just under its lowest tenth of shore; its bed dug and its banks graded
   // (water-bed.js; the LIDAR's ground there was filled in from the shore, so
   // it stood at the water's own level). A green or a tee beside it keeps its
   // ground.
   const outer = rings.filter(r => !rings.some(o => o !== r && inside(o, r[0])));
   const grid = {heights: ground, nx, nz, cell, x0: -halfX, z0: -halfZ}, keep = (x, z) => ['green', 'tee'].includes(codeAt(x, z));
   for (const o of outer) {
    const isl = rings.filter(r => r !== o && inside(o, r[0]));
    const level = r2(levelFrom(shoreOf([o], (x, z) => sampleGrid(ground, land, x, z))));
    water.push({rings: [o, ...isl], level, kind: 'pond'});
    digBed(grid, [o, ...isl], level, {keep});
   }
  }
 }
 const patches = surveyed && land.fine ? finePatches(land, ground, smoothR, surfaces) : [];
 const yards = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) / .9144;
 // Inside a kind's outlines (each polygon even-odd over its rings).
 const onKind = (kind, p) => surfaces[kind].some(poly => poly.filter(r => inside(r, [p.x, p.z])).length % 2 === 1);
 const recs = [...holes].sort((a, b) => a.number - b.number).map((h, i) => {
  const back = [...h.tees].sort((p, q) => yards(q, h.green) - yards(p, h.green))[0];
  // A green or tee the trace did not draw under its mark gets the plain
  // one (Worthington's first tee, traced only as semi-rough, played from it).
  if (!onKind('green', h.green)) surfaces.green.push([Array.from({length: 32}, (_, k) => [r2(h.green.x + 12 * Math.cos(k / 32 * Math.PI * 2)), r2(h.green.z + 12 * Math.sin(k / 32 * Math.PI * 2))])]);
  for (const t of h.tees) { if (onKind('tee', t)) continue;
   const ux = (h.green.x - t.x), uz = (h.green.z - t.z), l = Math.hypot(ux, uz) || 1, ax = ux / l, az = uz / l, px = -az, pz = ax;
   surfaces.tee.push([[[-3, -5], [3, -5], [3, 5], [-3, 5]].map(([u, v]) => [r2(t.x + px * u + ax * v), r2(t.z + pz * u + az * v)])]); }
  const line = h.line?.length >= 2 ? h.line.map(([x, z]) => [r2(x), r2(z)]) : [[r2(back.x), r2(back.z)], [r2(h.green.x), r2(h.green.z)]];
  // Par, unless given, from the back tee's yards along the line as the game
  // measures them (built-world.js builtLine) -- round the doglegs, not
  // straight to the green (until 1 November 2026: straight).
  return {number: h.number ?? i + 1, par: h.par ?? parFor(backYards(builtLine({tees: h.tees, green: h.green, line}))), index: h.index ?? i + 1, tees: h.tees.map(t => ({x: r2(t.x), z: r2(t.z), set: t.set || 'middle'})),
   green: {x: r2(h.green.x), z: r2(h.green.z)}, line};
 });
 // The trees: those standing on rough or semi-rough (a canopy peak over a
 // green or in water is a flag, a lamp or a mistake), their trunk from their
 // height as physics.js sizes one, conifer when narrow for their height
 // (PLACED: a crown under a fifth of the height).
 const treeData = [], treeKinds = [];
 // A tree the 3D editor planted, moved or sized (round-trip.js, `kept`) stays
 // wherever it stands, with its own trunk and role.
 for (const t of trees) {
  const lie = codeAt(t.x, t.z);
  if (!t.kept && ['green', 'tee', 'water', 'sand', 'fairway'].includes(lie)) continue;
  // A plant the editor painted keeps its species (cover.js).
  let ki = -1; if (t.kind) { ki = treeKinds.indexOf(t.kind); if (ki < 0) ki = treeKinds.push(t.kind) - 1; }
  treeData.push(t.x, t.z, t.h, t.crown, t.trunk ?? Math.min(3.6, Math.max(.14, t.h * .027)), (t.role ?? (t.crown / t.h < .2 ? 1 : 2)) | (t.placed ? TREE_HAND : 0), ki);
 }
 return {type: 'built', name, landscape, designer: null, halfX: halfX - GRID_MARGIN, halfZ: halfZ - GRID_MARGIN,
  land: {x0: -halfX, z0: -halfZ, cell, nx, nz, heights: ground}, patches, surfaces, water, creeks: [...structuredClone(creeks), ...drawnCreeks], holes: recs,
  trees: new Float32Array(treeData), treeKinds, rocks: structuredClone(rocks), homes, credits, source: {kind: 'lidar', ...source}, from: null, picture: null, landEdits: [], ...(treePlan ? {treePlan} : {}), ...(surround ? {surround} : {})};
}
// THE HALF-METRE PATCHES (22 November 2026; the owner: "yes go ahead, include
// bunkers"). Round every bunker, tee and green, inside the fine ground the
// course's outline gathered (land.js `fine`), a finer grid the game lays over
// the land (built-world.js landSampler, blended over PATCH_BLEND at its edge):
// the course's own 1 m ground, read between its nodes, plus the fine ground's
// detail -- but only where the 1 m ground is still the survey's own. Where
// the course changed it on purpose the detail would undo the change: a green,
// tee or fairway smoothed so a putt holds (above; RESEARCH, *Greens a putt
// can hold*), a green's surround eased into it, the 3D editor's shaping, a
// bunker dug or a creek carved on the plan, a pond's bed. So the detail lands
// on bunkers' lips and faces, tees' and greens' banks, swales in the rough
// round them: what the 1 m land rounds off. PLACED: the margins round each
// shape (green 8 m, for its banks and false front; tee 5 m; bunker 4 m, past
// the 1.5 m blend), the 1 cm that counts as changed, and patches carrying
// under 5 mm of detail left out. Merged where they overlap; the smallest first
// up to the file's limit (course-doc.js LIMITS.patchSamples).
// THE NOISE FLOOR (23 November 2026): on the owner's Alpine Lake survey only
// half the half-metre cells had two ground returns, and of the detail laid
// 22% was under 3 cm, 6% 3 to 10 cm, none over 10 -- mostly a two-return
// mean's noise, not shape. Each difference is moved PATCH_FLOOR towards nought
// (PLACED: 2 cm, about a two-return mean's noise on a 3DEP survey), so noise
// goes and a real lip keeps its shape less 2 cm, with no step at the floor.
export const PATCH_MARGIN = {green: 8, tee: 5, sand: 4}, PATCH_MOST = 250000, PATCH_FLOOR = .02;
const floored = d => Math.sign(d) * Math.max(0, Math.abs(d) - PATCH_FLOOR);
function finePatches(land, ground, smoothR, surfaces) {
 const {nx, nz, cell, halfX, halfZ, fine} = land, F = fine, N = nx * nz;
 const keep = new Float32Array(N);
 for (let k = 0; k < N; k++) keep[k] = smoothR[k] === 0 && Math.abs(ground[k] - land.ground[k]) < .01 ? 1 : 0;
 const read = (a, x, z) => { const u = Math.min(nx - 1, Math.max(0, (x + halfX) / cell)), v = Math.min(nz - 1, Math.max(0, (z + halfZ) / cell)), i = Math.min(nx - 2, Math.floor(u)), j = Math.min(nz - 2, Math.floor(v)), fu = u - i, fv = v - j, k = j * nx + i;
  const p = a[k] + (a[k + 1] - a[k]) * fu, q = a[k + nx] + (a[k + nx + 1] - a[k + nx]) * fu; return p + (q - p) * fv; };
 // Each shape's box, its margin round it, inside the fine ground.
 const fx1 = F.x0 + (F.nx - 1) * F.cell, fz1 = F.z0 + (F.nz - 1) * F.cell;
 let boxes = [];
 for (const kind of ['sand', 'tee', 'green']) for (const poly of surfaces[kind] ?? []) for (const ring of poly) {
  const m = PATCH_MARGIN[kind], xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const b = [Math.max(F.x0, Math.min(...xs) - m), Math.max(F.z0, Math.min(...zs) - m), Math.min(fx1, Math.max(...xs) + m), Math.min(fz1, Math.max(...zs) + m)];
  if (b[2] - b[0] >= 2 * F.cell && b[3] - b[1] >= 2 * F.cell) boxes.push(b);
 }
 // Merged while the union stays under PATCH_MOST heights: merging runs on
 // from box to box, and on a compact course one box could grow past the
 // file's limit and be left out whole. Overlapping patches are harmless.
 const heightsIn = b => ((b[2] - b[0]) / F.cell + 1) * ((b[3] - b[1]) / F.cell + 1);
 for (let merged = true; merged;) {
  merged = false;
  for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length; j++) {
   const a = boxes[i], b = boxes[j], u = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
   if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3] && heightsIn(u) <= PATCH_MOST) { boxes[i] = u; boxes.splice(j, 1); merged = true; break; }
  }
 }
 const out = []; let budget = LIMITS.patchSamples;
 boxes.sort((a, b) => (a[2] - a[0]) * (a[3] - a[1]) - (b[2] - b[0]) * (b[3] - b[1]));
 for (const b of boxes) {
  const i0 = Math.ceil((b[0] - F.x0) / F.cell - 1e-9), i1 = Math.floor((b[2] - F.x0) / F.cell + 1e-9), j0 = Math.ceil((b[1] - F.z0) / F.cell - 1e-9), j1 = Math.floor((b[3] - F.z0) / F.cell + 1e-9);
  const pnx = i1 - i0 + 1, pnz = j1 - j0 + 1; if (pnx < 3 || pnz < 3 || pnx * pnz > budget) continue;
  const heights = new Float32Array(pnx * pnz); let most = 0;
  for (let j = 0; j < pnz; j++) for (let i = 0; i < pnx; i++) {
   const x = F.x0 + (i0 + i) * F.cell, z = F.z0 + (j0 + j) * F.cell, d = F.detail[(j0 + j) * F.nx + i0 + i], add = d === FINE_NONE ? 0 : read(keep, x, z) * floored(d / 1000);
   heights[j * pnx + i] = read(ground, x, z) + add; most = Math.max(most, Math.abs(add));
  }
  if (most < .005) continue;
  out.push({x0: F.x0 + i0 * F.cell, z0: F.z0 + j0 * F.cell, cell: F.cell, nx: pnx, nz: pnz, heights}); budget -= pnx * pnz;
 }
 return out;
}
const inside = (ring, [x, z]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
function sampleGrid(g, land, x, z) { const i = Math.max(0, Math.min(land.nx - 1, Math.round((x + land.halfX) / land.cell))), j = Math.max(0, Math.min(land.nz - 1, Math.round((z + land.halfZ) / land.cell))); return g[j * land.nx + i]; }
