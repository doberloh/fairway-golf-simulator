// THE AUTO TRACE (the course builder, stage 8; docs/COURSE_BUILDER.md, *LIDAR
// first, the picture as fallback*). A starting point, not an answer: every
// cell of the land given a surface, with where the call came from (the LIDAR,
// the picture, or neither) and how sure it was, for the player to correct.
// No trained model: per-surface rules over what each cell is known to be.
//
// THE RULE (the owner, 31 October 2026): the LIDAR first. A cell the LIDAR
// is sure of is decided by it; the picture decides where the LIDAR is unsure,
// has no data there, or lacks what the rule needs (no intensity, say); where
// neither is sure the cell stays rough and is marked for review. `mode`
// 'lidar' and 'picture' run one witness alone, for measuring the rule.
//
// What the LIDAR can see: height, slope, how smooth the ground is at a metre's
// scale, hollows, canopy, the laser's brightness (sand and paths bright,
// water dark or silent), where nothing came back, the survey's own classes.
// What it cannot: a few centimetres of mowing -- the fairway's edge against
// the rough, a green's collar -- which the picture's colour can.
//
// Pure; tested in Node (tests/lidar-trace.test.mjs), measured on synthetic
// courses and on Worthington (tools/trace-bench.mjs).

// The surfaces it proposes, as editing.js names them.
export const TRACE = ['rough', 'fairway', 'semi', 'tee', 'green', 'sand', 'water', 'path'];
export const SOURCE = {none: 0, lidar: 1, picture: 2, both: 3};
// How sure a witness must be to decide a cell (PLACED; set on the bench).
export const SURE = .6;

// ---- features over the grid.
export function boxMean(a, nx, nz, r) {
 // Separable running mean over (2r+1)^2, edges clamped.
 const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
 for (let j = 0; j < nz; j++) { let s = 0; const row = j * nx;
  for (let i = -r; i <= r; i++) s += a[row + Math.min(nx - 1, Math.max(0, i))];
  for (let i = 0; i < nx; i++) { tmp[row + i] = s / (2 * r + 1); s += a[row + Math.min(nx - 1, i + r + 1)] - a[row + Math.max(0, i - r)]; } }
 for (let i = 0; i < nx; i++) { let s = 0;
  for (let j = -r; j <= r; j++) s += tmp[Math.min(nz - 1, Math.max(0, j)) * nx + i];
  for (let j = 0; j < nz; j++) { out[j * nx + i] = s / (2 * r + 1); s += tmp[Math.min(nz - 1, j + r + 1) * nx + i] - tmp[Math.max(0, j - r) * nx + i]; } }
 return out;
}
export function features(land) {
 const {nx, nz, cell, ground} = land, N = nx * nz;
 const near = boxMean(ground, nx, nz, Math.max(1, Math.round(1 / cell))), wide = boxMean(ground, nx, nz, Math.max(2, Math.round(6 / cell)));
 const slope = new Float32Array(N), rough = new Float32Array(N), hollow = new Float32Array(N);
 for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
  const k = j * nx + i;
  slope[k] = Math.hypot(near[k + 1] - near[k - 1], near[k + nx] - near[k - nx]) / (2 * cell) * 100;
  rough[k] = Math.abs(ground[k] - near[k]);
  hollow[k] = near[k] - wide[k];
 }
 const roughS = boxMean(rough, nx, nz, Math.max(1, Math.round(1 / cell)));
 return {slope, rough: roughS, hollow};
}

// A picture laid on the land's grid: {rgb: Uint8 (N*3), nir: Uint8 | null}
// (the caller samples it; null cells are 0,0,0 with `has` 0).
const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;

// The connected patches of a mask kept when their area (m²) is within
// [minArea, maxArea] and they are thick enough -- area over edge length, in
// metres (a disc of radius r scores about r/2.5 on the grid's staircase
// edge; a path 2.5 m wide about 1). Sand and water are patches; roads, cart
// paths, roof edges and the shadow of a tree line are long and thin.
// `maxLength`: the longest a patch may run (its box's diagonal, m) -- a road
// is as thick as a bunker, but runs on. `accept(cells)`: any test of the
// patch as a whole.
export function blobs(mask, nx, nz, cell, {minArea = 0, maxArea = Infinity, thick = 0, maxLength = Infinity, accept = null} = {}) {
 const N = nx * nz, out = new Uint8Array(N), seen = new Uint8Array(N), a2 = cell * cell, list = [];
 for (let s = 0; s < N; s++) {
  if (!mask[s] || seen[s]) continue;
  list.length = 0; list.push(s); seen[s] = 1; let edge = 0, i0 = nx, i1 = 0, j0 = nz, j1 = 0;
  for (let q = 0; q < list.length; q++) {
   const k = list[q], i = k % nx, j = (k - i) / nx;
   if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
   for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k + nx < N ? k + nx : -1]) {
    if (n < 0 || !mask[n]) { edge++; continue; }
    if (!seen[n]) { seen[n] = 1; list.push(n); }
   }
  }
  const area = list.length * a2;
  if (area >= minArea && area <= maxArea && area / (edge * cell) >= thick && Math.hypot(i1 - i0, j1 - j0) * cell <= maxLength && (!accept || accept(list))) for (const k of list) out[k] = 1;
 }
 return out;
}

// A mask's majority over a square of side 2r+1 cells: speckle gone, a patch
// made whole (a pond's ragged returns, a bunker's raked ridges).
export function majority(mask, nx, nz, r) {
 const m = boxMean(Float32Array.from(mask), nx, nz, r);
 return Uint8Array.from(m, v => v > .5 ? 1 : 0);
}

// `land` (land.js finish), `picture` ({rgb, nir, has} on the same grid, or
// null), `holes` ([{tees: [{x, z}], green: {x, z}, line?}] in local metres),
// `mode`. Returns {codes: Uint8 (TRACE index), source: Uint8, sure: Float32}.
export function trace(land, {picture = null, holes = [], mode = 'both', debug = null} = {}) {
 const {nx, nz, cell, halfX, halfZ} = land, N = nx * nz, F = features(land);
 const useL = mode !== 'picture', useP = mode !== 'lidar' && !!picture;
 const codes = new Uint8Array(N), source = new Uint8Array(N), sure = new Float32Array(N);
 const idx = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
 const xy = k => ({x: -halfX + (k % nx) * cell, z: -halfZ + Math.floor(k / nx) * cell});
 const P = useP ? picture : null;
 const pix = k => P && P.has[k] ? {r: P.rgb[k * 3], g: P.rgb[k * 3 + 1], b: P.rgb[k * 3 + 2], n: P.nir ? P.nir[k] : null} : null;
 const ndvi = p => p && p.n != null ? (p.n - p.r) / (p.n + p.r + 1) : null;
 const exg = p => p ? (2 * p.g - p.r - p.b) / (p.r + p.g + p.b + 1) : null;
 const set = (k, code, src, s) => { if (s > sure[k] || (src === SOURCE.lidar && source[k] === SOURCE.picture && s >= SURE)) { codes[k] = code; source[k] = src; sure[k] = s; } };
 const C = Object.fromEntries(TRACE.map((t, i) => [t, i]));
 const median = (list, f) => { const v = list.map(f).filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };

 // THE HOLES' LINES, as segments: their bends where the player marked them
 // (`line`, [[x, z]...]), else straight from the back tee to the green; and
 // each cell's distance from the nearest.
 const lines = [];
 for (const h of holes) {
  if (!h.tees?.[0] || !h.green) continue;
  const pts = h.line?.length >= 2 ? h.line.map(([x, z]) => ({x, z})) : [h.tees[0], h.green];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.z - a.z); lines.push({a, b, len, ux: (b.x - a.x) / (len || 1), uz: (b.z - a.z) / (len || 1), last: i === pts.length - 1, first: i === 1}); }
 }
 const off = new Float32Array(N).fill(Infinity);
 for (const L of lines) {
  // Only the cells within 80 m of this segment's box.
  const r = 80, i0 = Math.max(0, Math.floor((Math.min(L.a.x, L.b.x) - r + halfX) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(L.a.x, L.b.x) + r + halfX) / cell));
  const j0 = Math.max(0, Math.floor((Math.min(L.a.z, L.b.z) - r + halfZ) / cell)), j1 = Math.min(nz - 1, Math.ceil((Math.max(L.a.z, L.b.z) + r + halfZ) / cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
   const x = -halfX + i * cell, z = -halfZ + j * cell, t = Math.max(0, Math.min(L.len, (x - L.a.x) * L.ux + (z - L.a.z) * L.uz)), d = Math.hypot(x - L.a.x - L.ux * t, z - L.a.z - L.uz * t), k = j * nx + i;
   if (d < off[k]) off[k] = d;
  }
 }
 // THE FAIRWAY, AS THE COURSE'S YARDSTICK. Each hole's APPROACH -- 15 to 45 m
 // short of the green along the line into it -- is fairway on nearly every
 // hole that has one, dogleg or not. (Sampled along the middle of a straight
 // tee-to-green chord instead, a doglegged PNW's "fairway colour" was its
 // rough's.) What the fairway looks like there, to the laser and in the
 // picture, is what sand and water are told from: a picture's colours and a
 // survey's brightness differ from one course, camera and month to the next,
 // and on Worthington's August picture roads, car parks and dry rough were
 // as pale as its sand. The rest of each line seeds the fairway.
 const approach = [], seeds = [];
 for (const L of lines) {
  for (let t = L.first ? L.len * .25 : 0; t < L.len - 10; t += 2) { const k = idx(L.a.x + L.ux * t, L.a.z + L.uz * t); if (k >= 0 && land.canopy[k] < 1) seeds.push(k); }
  if (L.last && L.len > 90) for (let t = L.len - 45; t < L.len - 15; t += 1.5) for (const o of [-3, 0, 3]) { const k = idx(L.a.x + L.ux * t + L.uz * o, L.a.z + L.uz * t - L.ux * o); if (k >= 0 && land.canopy[k] < 1) { approach.push(k); seeds.push(k); } }
 }
 // With no hole marked, the open ground as a whole stands in.
 const yard = approach.length ? approach : seeds.length ? seeds : Array.from({length: Math.ceil(N / 97)}, (_, q) => q * 97).filter(k => land.canopy[k] < 1);
 // A survey with the laser's brightness has it varying over the land (one
 // without it reads a constant; a mown fairway alone can be even).
 let iLo = Infinity, iHi = -Infinity;
 for (let k = 0; k < N; k += 97) if (Number.isFinite(land.intensity[k])) { iLo = Math.min(iLo, land.intensity[k]); iHi = Math.max(iHi, land.intensity[k]); }
 const hasIntensity = iHi > iLo;
 const iF = hasIntensity ? median(yard, k => land.intensity[k]) : null;
 const yardPix = yard.map(pix).filter(Boolean);
 const fc = yardPix.length ? {r: median(yardPix, p => p.r), g: median(yardPix, p => p.g), b: median(yardPix, p => p.b), l: median(yardPix, p => lum(p.r, p.g, p.b)), e: median(yardPix, exg), n: P?.nir ? median(yardPix, ndvi) : null} : null;

 // WATER. LIDAR: the survey's class 9; or flat open ground that sent nothing
 // back or very little (water swallows the laser or mirrors it away) -- in
 // patches, not the odd silent cell under a roof. Picture: darker than the
 // fairway and far less green (NDVI, where there is near-infrared), in
 // patches; where the LIDAR has a bright return there, it is not water.
 // (PLACED, set on Worthington: water's laser brightness was a fifth of the
 // fairway's, its NDVI 0.6 below it.)
 if (useL) {
  // SILENT: nothing back here and from most of the metre round it, not
  // merely an empty cell (a survey of 1-2 points a square metre leaves most
  // half-metre cells empty; the builder's own smoke survey found a lake under every hole).
  const quiet = boxMean(Float32Array.from(land.noReturns), nx, nz, Math.max(1, Math.round(.75 / cell)));
  const silent = k => land.noReturns[k] && quiet[k] > .6;
  const wet = new Uint8Array(N);
  // Flatness is asked only of what the laser measured: a silent patch's ground
  // is filled in from its shore, as level as the shore is.
  for (let k = 0; k < N; k++) wet[k] = land.canopy[k] < 1 && (land.water[k] > 76 || silent(k) || (F.slope[k] < 3 && iF != null && land.intensity[k] < iF * .35)) ? 1 : 0;
  // A patch is water when some of it sent nothing back to the ground at all
  // (a fifth: PLACED; Worthington's ponds 40%) or the survey called it water:
  // a running track, a car park or a dark roof is as dark to the laser, but
  // the laser reaches it everywhere.
  // And a patch that runs to the edge of the land is past the survey's
  // edge (nothing came back because nothing was flown), unless the survey
  // called it water.
  const accept = list => { let n = 0, w = 0, edge = false; for (const k of list) { const i = k % nx, j = (k - i) / nx; if (silent(k)) n++; if (land.water[k] > 76) w++; if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) edge = true; } return w > list.length * .2 || (!edge && n + w > list.length * .2); };
  const keep = blobs(majority(wet, nx, nz, Math.max(1, Math.round(1.5 / cell))), nx, nz, cell, {minArea: 60, thick: 2.5, accept});
  if (debug) Object.assign(debug, {lidarWater: wet, lidarWaterKept: keep});
  for (let k = 0; k < N; k++) if (keep[k]) set(k, C.water, SOURCE.lidar, land.water[k] > 76 ? .95 : .85);
 }
 if (P && fc) {
  const wet = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
   if (sure[k] >= SURE || land.canopy[k] > 1) continue;
   if (useL && iF != null && !land.noReturns[k] && land.intensity[k] > iF * .6) continue;
   const p = pix(k); if (!p) continue;
   const nd = ndvi(p), l = lum(p.r, p.g, p.b);
   // Without near-infrared, greenness: water's is about nothing (Worthington's
   // ponds -0.01), turf's well above.
   wet[k] = l < fc.l - 10 && (nd != null && fc.n != null ? nd < fc.n - .45 : exg(p) < Math.min(.03, fc.e - .15)) ? 1 : 0;
  }
  const keep = blobs(majority(wet, nx, nz, Math.max(1, Math.round(1.5 / cell))), nx, nz, cell, {minArea: 60, thick: 2.5});
  if (debug) Object.assign(debug, {pictureWater: wet, pictureWaterKept: keep});
  for (let k = 0; k < N; k++) if (keep[k]) set(k, C.water, SOURCE.picture, .7);
 }
 // SAND, within 70 m of a hole's line (bunkers guard greens and fairways; a
 // practice bunker elsewhere is the player's to draw). LIDAR: rougher than
 // mown turf at a metre's scale (raked sand, and the bunker's lip), a little
 // darker to the laser than the fairway (grass reflects its infrared
 // strongly), and low. Picture: much brighter than the fairway and not
 // green. Both in patches of 4 to 1,500 m² that are not paths. (PLACED, set on
 // Worthington: sand's laser brightness 0.69 against the fairway's 0.79, its
 // roughness 2.5 cm against 0.7, its brightness in the picture 60 over the
 // fairway's, its greenness 0.14 under. The first rule -- "bright to the
 // laser" -- was a guess and found none.)
 const sandy = {minArea: 4, maxArea: 1500, thick: 1.2, maxLength: 60};
 if (useL && iF != null) {
  const m = new Uint8Array(N);
  // Rough is as dark to the laser and nearly as bumpy, so where a picture
  // covers the cell the LIDAR's sand must not be plainly turf there (a loose
  // check, far short of the picture's own rule): with it, sand's overlap rose
  // on both the synthetic courses and Worthington.
  const turfy = k => { const p = P && fc ? pix(k) : null; return p ? lum(p.r, p.g, p.b) < fc.l + 15 || exg(p) > fc.e - .04 : false; };
  // Only where the laser reached: past a survey's edge the land is filled in.
  for (let k = 0; k < N; k++) m[k] = !land.noReturns[k] && off[k] < 70 && sure[k] < SURE && land.canopy[k] < 1 && F.rough[k] > .014 && land.intensity[k] < iF - .05 && F.hollow[k] < 0 && !turfy(k) ? 1 : 0;
  const keep = blobs(majority(m, nx, nz, 1), nx, nz, cell, sandy);
  if (debug) Object.assign(debug, {lidarSand: m, lidarSandKept: keep});
  for (let k = 0; k < N; k++) if (keep[k]) set(k, C.sand, SOURCE.lidar, .75);
 }
 if (P && fc) {
  const m = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
   if (off[k] >= 70 || sure[k] >= SURE || land.canopy[k] > 1) continue;
   // The LIDAR first: ground as smooth as a road, a roof or a car park is
   // not sand, however pale.
   if (useL && F.rough[k] < .01) continue;
   const p = pix(k); if (!p) continue;
   const nd = ndvi(p);
   m[k] = lum(p.r, p.g, p.b) > fc.l + 30 && exg(p) < fc.e - .08 && (nd == null || fc.n == null || nd < fc.n - .25) ? 1 : 0;
  }
  const keep = blobs(m, nx, nz, cell, sandy);
  if (debug) Object.assign(debug, {pictureSand: m, pictureSandKept: keep});
  for (let k = 0; k < N; k++) if (keep[k]) set(k, C.sand, SOURCE.picture, .7);
 }
 // GREENS AND TEES: grown out from each mark over the smoothest ground (the
 // LIDAR's pad) and, where there is a picture, while the colour stays the
 // mark's (the collar is where the mowing -- and so the colour -- changes).
 // With both, the colour finds the edge and the LIDAR only refuses what is
 // plainly not a pad (twice as rough or steep): the laser cannot see a
 // collar, and holding a tee to the LIDAR's own limits as well cut its
 // overlap at Worthington from 30% to 19%.
 const grow = (start, code, maxR, smoothMax, slopeMax) => {
  const k0 = idx(start.x, start.z); if (k0 < 0) return;
  const p0 = pix(k0), seen = new Uint8Array(N), q = [k0]; seen[k0] = 1;
  while (q.length) {
   const k = q.pop(), here = xy(k);
   if (Math.hypot(here.x - start.x, here.z - start.z) > maxR) continue;
   const p = pix(k), loose = p && p0 ? 2 : 1, lidarOk = !useL || (F.rough[k] < smoothMax * loose && F.slope[k] < slopeMax * loose && land.canopy[k] < 1);
   const colourOk = !p || !p0 || Math.hypot(p.r - p0.r, p.g - p0.g, p.b - p0.b) < 38;
   if (!(lidarOk && colourOk) && k !== k0) continue;
   set(k, code, useL && p ? SOURCE.both : useL ? SOURCE.lidar : SOURCE.picture, .9);
   const i = k % nx;
   for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !seen[n]) { seen[n] = 1; q.push(n); }
  }
 };
 for (const h of holes) {
  grow(h.green, C.green, 24, .035, 7);
  for (const t of h.tees || []) grow(t, C.tee, 9, .03, 4);
 }
 // FAIRWAYS: grown out from each hole's line through the mown ground. The
 // picture's colour decides it: a cell is fairway when nearer the fairway's
 // colour than the rough's (ground 30 to 60 m off the lines: farther out, the
 // houses and roads round a course pulled "rough" off the rough); then only
 // cells connected to a line are kept, so a dogleg is followed and a
 // look-alike patch elsewhere is not taken. The LIDAR alone can say only
 // "smooth open ground within 14 m of the line" (a weak call, kept below SURE).
 const roughPix = [];
 for (let k = 0; k < N; k += 37) if (land.canopy[k] < 1 && codes[k] === C.rough && off[k] > 30 && off[k] < 60) { const p = pix(k); if (p) roughPix.push(p); }
 const rc = roughPix.length ? {r: median(roughPix, p => p.r), g: median(roughPix, p => p.g), b: median(roughPix, p => p.b)} : null;
 const mown = new Uint8Array(N);
 for (let k = 0; k < N; k++) {
  if (codes[k] === C.green || codes[k] === C.tee || codes[k] === C.sand || codes[k] === C.water || land.canopy[k] > 1 || off[k] > 70) continue;
  const p = pix(k);
  if (p && fc) { const d = Math.hypot(p.r - fc.r, p.g - fc.g, p.b - fc.b), dr = rc ? Math.hypot(p.r - rc.r, p.g - rc.g, p.b - rc.b) : Infinity; if (d < 60 && d < dr * .85) mown[k] = 2; }
  else if (useL && off[k] < 14 && F.rough[k] < .05 && F.slope[k] < 12) mown[k] = 1;
 }
 const reached = new Uint8Array(N), q = seeds.filter(k => mown[k]);
 for (const k of q) reached[k] = 1;
 while (q.length) { const k = q.pop(), i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !reached[n] && mown[n]) { reached[n] = 1; q.push(n); } }
 for (let k = 0; k < N; k++) if (reached[k]) set(k, C.fairway, mown[k] === 2 ? SOURCE.picture : SOURCE.lidar, mown[k] === 2 ? .75 : .5);
 // SEMI-ROUGH: a 2 m collar round the fairways (PLACED: the generator's
 // default is 6 m of semi each side, but a real course's first cut is
 // narrower and the picture rarely shows it).
 const fair = Uint8Array.from(codes, c => c === C.fairway ? 1 : 0), ring = Math.max(1, Math.round(2 / cell));
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i; if (codes[k] !== C.rough || sure[k] >= SURE) continue;
  let near = false;
  for (let dj = -ring; dj <= ring && !near; dj++) for (let di = -ring; di <= ring; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && fair[jj * nx + ii]) { near = true; break; } }
  if (near) set(k, C.semi, source[k] || SOURCE.lidar, .5);
 }
 // What is not sure enough stays rough (the review layer shows it).
 for (let k = 0; k < N; k++) if (sure[k] < .45 && codes[k] !== C.rough) { codes[k] = C.rough; }
 if (debug) Object.assign(debug, {iF, fc, off});
 return {codes, source, sure, nx, nz, cell, halfX, halfZ};
}
