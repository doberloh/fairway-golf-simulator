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
import {createGridder, findTrees} from '../lidar/land.js';
import {toMetres} from '../lidar/las.js';
import {maskRings, simplify, smoothRing} from '../contour.js';
import {PALETTE, SPECK, POCK} from './trace-edit.js';
import {createLayers, tidyMask, LAYER_ORDER} from './layers.js';
import {boxMean, features} from '../lidar/trace.js';
import {GRID_MARGIN} from '../built-world.js';

// The finest the land is gathered at for a property this size (PLACED: half
// a metre to 2.25 km², else a metre -- memory for a 3 x 3 km course).
export const cellFor = (wMetres, hMetres) => wMetres * hMetres <= 2.25e6 ? .5 : 1;
// The largest property (PLACED, the owner's decision 10: 3 x 3 km).
export const MAX_PROPERTY = 3000;

// The box every source covers, in the first one's map units.
export function sourcesBox(sources) {
 let b = null;
 for (const s of sources) {
  const r = s.kind === 'points' ? {x0: s.bounds.minX, x1: s.bounds.maxX, y0: s.bounds.minY, y1: s.bounds.maxY}
   : {x0: Math.min(s.raster.x0, s.raster.x0 + s.raster.dx * (s.raster.width - 1)), x1: Math.max(s.raster.x0, s.raster.x0 + s.raster.dx * (s.raster.width - 1)), y0: Math.min(s.raster.y0, s.raster.y0 + s.raster.dy * (s.raster.height - 1)), y1: Math.max(s.raster.y0, s.raster.y0 + s.raster.dy * (s.raster.height - 1))};
  b = b ? {x0: Math.min(b.x0, r.x0), x1: Math.max(b.x1, r.x1), y0: Math.min(b.y0, r.y0), y1: Math.max(b.y1, r.y1)} : r;
 }
 return b;
}
export const crsOfSources = sources => sources[0]?.kind === 'points' ? sources[0].crs : sources[0]?.raster.crs;

// The land over `box` (map units of the sources) and GRID_MARGIN metres past
// it. `pause` lets a page paint between chunks. Returns {land, gridder, trees}.
export async function landFromSources(sources, box, {cell = null, onStep = () => {}, pause = null} = {}) {
 const crs = crsOfSources(sources), unit = toMetres(crs), m = GRID_MARGIN / unit.h;
 const wide = {x0: box.x0 - m, x1: box.x1 + m, y0: box.y0 - m, y1: box.y1 + m};
 // The cell: half a metre, or a metre for a large property -- and never finer
  // than the survey's points are apart (PLACED: the spacing rounded up to the
  // half metre), or most cells would hold no return and read as holes.
  const pts = sources.filter(s => s.kind === 'points'), area = pts.reduce((a, s) => a + Math.max(1, (s.bounds.maxX - s.bounds.minX) * (s.bounds.maxY - s.bounds.minY) * unit.h * unit.h), 0);
  const spacing = pts.length ? Math.sqrt(area / Math.max(1, pts.reduce((a, s) => a + (s.count || 0), 0))) : 0;
  const c = cell ?? Math.max(cellFor((box.x1 - box.x0) * unit.h, (box.y1 - box.y0) * unit.h), Math.ceil(spacing * 2 - 1e-9) / 2);
 const gridder = createGridder({box: wide, cell: c, unit});
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
// One layer's outlines as a course gets them: traced round its cells, the
// staircase taken out (simplified to 0.6 of a cell, PLACED) and the corners
// rounded (two passes of corner cutting); scraps under SPECK dropped. The
// trace step draws these too, so what is painted is seen as it will play.
export function layerRings(m, {nx, nz, cell, halfX, halfZ}) {
 return maskRings((i, j) => m[j * nx + i] === 1, nx, nz, -halfX, -halfZ, cell)
  .map(r => smoothRing(simplify(r, cell * .6))).filter(r => r.length >= 3 && ringArea(r) > SPECK);
}

export function docFromLand({land, traced = null, holes, trees = [], homes = [], name = 'Real course', landscape = 'midwest', credits = [], source = {}}) {
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
 const greenAt = (x, z) => holes.some(h => Math.hypot(x - h.green.x, z - h.green.z) < 14);
 const smoothR = new Uint8Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i, t = codes ? PALETTE[codes[k]] : greenAt(-halfX + i * cell, -halfZ + j * cell) ? 'green' : 'rough';
  smoothR[k] = t === 'green' || t === 'tee' ? 2 : t === 'fairway' ? 1 : 0;
 }
 for (const r of [1, 2]) {
  const m = boxMean(land.ground, nx, nz, Math.max(1, Math.round(r * 1.25 / cell / 2)));
  for (let k = 0; k < m.length; k++) if (smoothR[k] === r) ground[k] = m[k];
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
   // just under its lowest tenth of shore; the ground under it carved a metre
   // down so the water shows (the LIDAR's ground there was filled in from the
   // shore, so it stood at the water's own level).
   const outer = rings.filter(r => !rings.some(o => o !== r && inside(o, r[0])));
   for (const o of outer) {
    const isl = rings.filter(r => r !== o && inside(o, r[0]));
    const shore = o.map(([x, z]) => sampleGrid(ground, land, x, z)).sort((a, b) => a - b), level = shore[Math.floor(shore.length * .1)] - .15;
    water.push({rings: [o, ...isl], level: r2(level), kind: 'pond'});
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (m[j * nx + i]) {
     const x = -halfX + i * cell, z = -halfZ + j * cell;
     if (inside(o, [x, z]) && !isl.some(s => inside(s, [x, z]))) ground[j * nx + i] = Math.min(ground[j * nx + i], level - 1);
    }
   }
  }
 }
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
  return {number: h.number ?? i + 1, par: h.par ?? parFor(yards(back, h.green)), index: h.index ?? i + 1, tees: h.tees.map(t => ({x: r2(t.x), z: r2(t.z), set: t.set || 'middle'})),
   green: {x: r2(h.green.x), z: r2(h.green.z)}, line: h.line?.length >= 2 ? h.line.map(([x, z]) => [r2(x), r2(z)]) : [[r2(back.x), r2(back.z)], [r2(h.green.x), r2(h.green.z)]]};
 });
 // The trees: those standing on rough or semi-rough (a canopy peak over a
 // green or in water is a flag, a lamp or a mistake), their trunk from their
 // height as physics.js sizes one, conifer when narrow for their height
 // (PLACED: a crown under a fifth of the height).
 const treeData = [];
 for (const t of trees) {
  const lie = codeAt(t.x, t.z);
  if (['green', 'tee', 'water', 'sand', 'fairway'].includes(lie)) continue;
  treeData.push(t.x, t.z, t.h, t.crown, Math.min(3.6, Math.max(.14, t.h * .027)), t.crown / t.h < .2 ? 1 : 2, -1);
 }
 return {type: 'built', name, landscape, designer: null, halfX: halfX - GRID_MARGIN, halfZ: halfZ - GRID_MARGIN,
  land: {x0: -halfX, z0: -halfZ, cell, nx, nz, heights: ground}, patches: [], surfaces, water, creeks: [], holes: recs,
  trees: new Float32Array(treeData), treeKinds: [], homes, credits, source: {kind: 'lidar', ...source}, from: null, picture: null, landEdits: []};
}
const inside = (ring, [x, z]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
function sampleGrid(g, land, x, z) { const i = Math.max(0, Math.min(land.nx - 1, Math.round((x + land.halfX) / land.cell))), j = Math.max(0, Math.min(land.nz - 1, Math.round((z + land.halfZ) / land.cell))); return g[j * land.nx + i]; }
