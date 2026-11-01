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
// BEFORE ANY HOLE IS MARKED (door 2's order since 31 October 2026) the
// mown turf, the greens and the tees are found in the picture itself
// (`mownTurf`, and the markless greens and tees below); with holes marked,
// greens and tees grow from the marks and fairways from the lines.
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

// Each cell's distance (metres) to the nearest cell of a mask: a two-pass
// chamfer (3-4), Infinity where the mask is empty.
export function distanceFrom(mask, nx, nz, cell) {
 const N = nx * nz, d = new Float32Array(N).fill(Infinity), a = cell, b = cell * Math.SQRT2;
 for (let k = 0; k < N; k++) if (mask[k]) d[k] = 0;
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let v = d[k];
  if (i > 0) v = Math.min(v, d[k - 1] + a); if (j > 0) { v = Math.min(v, d[k - nx] + a); if (i > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); } d[k] = v; }
 for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let v = d[k];
  if (i < nx - 1) v = Math.min(v, d[k + 1] + a); if (j < nz - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0) v = Math.min(v, d[k + nx - 1] + b); } d[k] = v; }
 return d;
}

// MOWN TURF FROM THE PICTURE ALONE (no hole marked; no LIDAR needed). Mown
// grass is green, bright and SMOOTH at a metre's scale; rough is coarser,
// trees are dark and mottled with their own shadows. All judged against the
// picture's own green ground (its percentiles), since a picture's colours
// change with the camera, the month and the place. Then in patches: a mown
// area of a golf course is hundreds of square metres or more, and wide.
// (Iteration 1 of the owner's ten, 31 October 2026; RESEARCH, *The auto trace
// from the picture, iteration by iteration*.)
export function mownTurf(P, land, debug = null) {
 const {nx, nz, cell} = land, N = nx * nz;
 const lum = new Float32Array(N), lum2 = new Float32Array(N), green = new Float32Array(N);
 for (let k = 0; k < N; k++) {
  if (!P.has[k]) continue;
  const r = P.rgb[k * 3], g = P.rgb[k * 3 + 1], b = P.rgb[k * 3 + 2], l = .299 * r + .587 * g + .114 * b;
  lum[k] = l; lum2[k] = l * l;
  green[k] = P.nir ? (P.nir[k] - r) / (P.nir[k] + r + 1) : (2 * g - r - b) / (r + g + b + 1);
 }
 const R = Math.max(1, Math.round(1 / cell)), m1 = boxMean(lum, nx, nz, R), m2 = boxMean(lum2, nx, nz, R);
 // Texture as spread over brightness (iteration 3): measured absolutely, a
 // tree's shadow is "smooth" only because it is dark (Sahalee's October
 // picture, shadows across every fairway).
 const tex = new Float32Array(N); for (let k = 0; k < N; k++) tex[k] = Math.sqrt(Math.max(0, m2[k] - m1[k] * m1[k])) / (m1[k] + 20);
 // The green ground: greener than the picture's middle.
 const q = (a, f, keep) => { const v = []; for (let k = 0; k < N; k += 11) if (keep(k)) v.push(a[k]); v.sort((x, y) => x - y); return v.length ? v[Math.floor(v.length * f)] : 0; };
 const gMid = q(green, .5, k => P.has[k]);
 // Plant ground: NDVI over 0.15 with near-infrared, greenness over 0.04
 // without (PLACED; iteration 4). Judged against the picture's own middle, a
 // forested picture's trees set the bar so high that Sahalee's bright, short
 // greens (NDVI 0.28 against the trees' 0.40) were not plant ground at all.
 const vegBar = Math.min(gMid, P.nir ? .15 : .04);
 const veg = k => P.has[k] && green[k] > vegBar;
 const lumLo = q(lum, P.nir ? .05 : .25, veg), texLo = q(tex, .5, veg), texMid = q(tex, .6, veg), lumTree = q(lum, .25, veg);
 const mask = new Uint8Array(N);
 for (let k = 0; k < N; k++) {
  if (!veg(k) || land.canopy[k] > 1) continue;
  const tree = lum[k] < lumTree && tex[k] > texMid;
  if (!tree && tex[k] < texLo && lum[k] > lumLo) mask[k] = 1;
 }
 const kept = blobs(majority(mask, nx, nz, Math.max(1, Math.round(2 / cell))), nx, nz, cell, {minArea: 400, thick: 3});
 // Gaps a turf patch surrounds (a stripe's edge, a sprinkler's shadow) under
 // 300 m² are turf too (PLACED); a bunker in one is found as sand first, and
 // keeps its sand.
 const gaps = blobs(Uint8Array.from(kept, v => v ? 0 : 1), nx, nz, cell, {maxArea: 300, accept: list => !list.some(k => { const i = k % nx; return i === 0 || i === nx - 1 || k < nx || k >= N - nx; })});
 for (let k = 0; k < N; k++) if (gaps[k]) kept[k] = 1;
 kept.tex = tex; kept.lum = lum; kept.texLo = texLo;
 // Texture over a 1.5 m square too, for greens (iteration 24): a putting
 // surface is smooth close up.
 { const f1 = boxMean(lum, nx, nz, 1), f2 = boxMean(lum2, nx, nz, 1); kept.fine = new Float32Array(N); for (let k = 0; k < N; k++) kept.fine[k] = Math.sqrt(Math.max(0, f2[k] - f1[k] * f1[k])) / (f1[k] + 20); }
 // The small mown islands the 400 m² floor drops: a tee box set apart in the
 // rough is one (40 to 600 m², squared off -- filling over 62% of its box;
 // PLACED, iteration 21).
 const fill = list => { let i0 = nx, i1 = 0, j0 = nz, j1 = 0; for (const k of list) { const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } return list.length / ((i1 - i0 + 1) * (j1 - j0 + 1)) > .62; };
 kept.islands = blobs(majority(mask, nx, nz, 1), nx, nz, cell, {minArea: 40, maxArea: 600, thick: 1.5, maxLength: 45, accept: list => fill(list) && !list.some(k => kept[k])});
 if (debug) Object.assign(debug, {turfRaw: mask, turf: kept, turfLimits: {gMid, lumLo, texLo, texMid, lumTree}});
 return kept;
}

// A mask closed: grown by r cells and shrunk back, so gaps narrower than 2r
// between patches are bridged and notches filled.
export function close(mask, nx, nz, r) {
 const grown = Uint8Array.from(boxMean(Float32Array.from(mask), nx, nz, r), v => v > 0 ? 1 : 0);
 return Uint8Array.from(boxMean(Float32Array.from(grown), nx, nz, r), v => v > .999 ? 1 : 0);
}

// FAIRWAYS AS SIMPLE SHAPES (the owner, 1 November 2026: "real fairways are
// one continuous shape ... bring our fairway shapes closer to more simple
// shapes"; iteration 28). The pieces along a hole are joined (closed over
// 8 m: gaps a shadow or a cart path cut are bridged), the holes in them
// filled (to 2,000 m²), the spurs and fringes cut off (opened over 4 m), and
// the outline rounded (a majority over 5 m) -- then only whole fairways are
// kept (2,000 m² and up). PLACED, all of it.
export function shapeFairways(mask, nx, nz, cell) {
 const N = nx * nz, R = m => Math.max(1, Math.round(m / cell));
 let m = close(mask, nx, nz, R(8));
 const holes = blobs(Uint8Array.from(m, v => v ? 0 : 1), nx, nz, cell, {maxArea: 2000, accept: list => !list.some(k => { const i = k % nx; return i === 0 || i === nx - 1 || k < nx || k >= N - nx; })});
 for (let k = 0; k < N; k++) if (holes[k]) m[k] = 1;
 m = open(m, nx, nz, R(4));
 m = majority(m, nx, nz, R(5));
 return blobs(m, nx, nz, cell, {minArea: 2000, thick: 5});
}

// A mask opened: shrunk by r cells and grown back (a square's reach), so
// patches joined by a strip narrower than 2r come apart and specks go.
export function open(mask, nx, nz, r) {
 const f = Float32Array.from(mask), shrunk = Uint8Array.from(boxMean(f, nx, nz, r), v => v > .999 ? 1 : 0);
 return Uint8Array.from(boxMean(Float32Array.from(shrunk), nx, nz, r), (v, k) => v > 0 && mask[k] ? 1 : 0);
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
 // NO HOLE MARKED YET (door 2 traces before the holes are marked: the owner's
 // order, 31 October 2026). With no line to start from, the mown turf is found
 // in the picture itself (`mownTurf`), stands as the fairway's yardstick, and
 // its distance replaces the distance from the lines.
 const markless = !lines.length && !!P;
 const turf = markless ? mownTurf(P, land, debug) : null;
 if (turf) { const d = distanceFrom(turf, nx, nz, cell); for (let k = 0; k < N; k++) off[k] = d[k]; }
 const turfCells = []; if (turf) for (let k = 0; k < N; k += 13) if (turf[k]) turfCells.push(k);
 // Still water darker than nearly everything (the darkest 6% of the picture,
 // PLACED): algae can make a pond as green as grass to the colour tests, but
 // not as smooth or as dark (TPC Scottsdale's lakes, iteration 2).
 const darkest = turf ? (() => { const v = []; for (let k = 0; k < N; k += 11) if (P.has[k]) v.push(turf.lum[k]); v.sort((a, b) => a - b); return v[Math.floor(v.length * .06)] ?? 0; })() : 0;
 // (Iteration 27 let sand be 30 brighter than the turf within 20 m, for
 // bunkers in shade: sand fell 24 to 23. Not kept.)
 // With no hole marked and no picture, the open ground as a whole stands in.
 const yard = approach.length ? approach : seeds.length ? seeds : turfCells.length ? turfCells : Array.from({length: Math.ceil(N / 97)}, (_, q) => q * 97).filter(k => land.canopy[k] < 1);
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
   wet[k] = (l < fc.l - 10 && (nd != null && fc.n != null ? nd < fc.n - .45 : exg(p) < Math.min(.03, fc.e - .15))) || (turf && l < darkest && turf.tex[k] < turf.texLo * .6 && (nd == null || fc.n == null || nd < fc.n - .3))
    // Water with algae (iteration 4: TPC Scottsdale's lakes, NDVI 0.05
    // against the fairway's 0.33, brightness 73 against 103): clearly darker
    // and clearly less green than the fairway, and as smooth.
    || (turf && l < fc.l - 15 && turf.tex[k] < turf.texLo && (nd != null && fc.n != null ? nd < fc.n - .2 : exg(p) < fc.e - .08)) ? 1 : 0;
  }
  // Wider than a shadow (iteration 12: a road's tree shadows at Northwood
  // read as water): 3.5 m thick, area over edge (PLACED).
  const keep = blobs(majority(wet, nx, nz, Math.max(1, Math.round(1.5 / cell))), nx, nz, cell, {minArea: 60, thick: 3.5});
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
 // (Iteration 20 let sand run to 6,000 m² and 120 m for a links course's
 // waste areas: Breckenridge's sand fell 40 to 27 on false patches. Not kept.)
 const sandy = {minArea: 4, maxArea: 1500, thick: 1.2, maxLength: 60, accept: list => notBox(list) && notPath(list)};
 // A patch filling over 86% of its own box (a disc fills 79%) and over 40 m²
 // is a roof or a car park, not a bunker (PLACED; iteration 2: TPC
 // Scottsdale's houses). One whose area is under 8% of its length squared is
 // a cart path (a 3 x 60 m path 5%, a 4 x 30 m fairway bunker 13%; PLACED,
 // iteration 13).
 function notPath(list) { let i0 = nx, i1 = 0, j0 = nz, j1 = 0; for (const k of list) { const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } const len = Math.hypot(i1 - i0 + 1, j1 - j0 + 1) * cell; return list.length * cell * cell / (len * len) > .08; }
 function notBox(list) { if (list.length * cell * cell < 40) return true; let i0 = nx, i1 = 0, j0 = nz, j1 = 0; for (const k of list) { const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } return list.length / ((i1 - i0 + 1) * (j1 - j0 + 1)) < .86; }
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
   // Cells the LIDAR already called sand stay in the picture's patch: left out,
   // they broke its bunkers into pieces too small to keep, and "both" scored
   // under the picture alone.
   if (off[k] >= (turf ? 25 : 70) || (sure[k] >= SURE && codes[k] !== C.sand) || land.canopy[k] > 1) continue;
   // The LIDAR first: ground as smooth as a road, a roof or a car park is
   // not sand, however pale.
   if (useL && F.rough[k] < .01) continue;
   const p = pix(k); if (!p) continue;
   const nd = ndvi(p);
   // (Iteration 13 let sand with near-infrared be only 10 brighter than the
   // fairway, for Sahalee's shaded bunkers: sand fell 26 to 24 -- the shade
   // took in more than it found. Not kept.)
   // Under 0.25 below the fairway's NDVI, or under 40% of it, whichever is
   // more (iteration 20): Chambers Bay's fescue fairways read only 0.20, so
   // "0.25 below" asked for less than nothing and its sand (0.00) failed.
   m[k] = lum(p.r, p.g, p.b) > fc.l + 30 && exg(p) < fc.e - .08 && (nd == null || fc.n == null || nd < Math.max(fc.n - .25, fc.n * .4)) ? 1 : 0;
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
 // With no hole marked, the mown turf found is the fairway (the greens and
 // tees in it are found below).
 if (turf) {
  // FAIRWAY OR NOT: mown turf is the fairway's short grass and the longer
  // grass beside it (the semi, the rough a desert course keeps green). Split
  // in two by brightness and texture together (a two-means, PLACED): the
  // brighter, smoother half is fairway, when the halves differ enough to be
  // two cuts (iteration 3).
  const cells = []; for (let k = 0; k < N; k += 5) if (turf[k]) cells.push(k);
  // By TEXTURE ALONE (iteration 16, kept): with brightness counted, a
  // fairway in the shade of its trees was split off as semi (Sahalee's
  // fairway 21 -> 30 without it). The cost: a desert course's green rough is
  // as smooth to the camera as its fairway, and is called fairway (TPC
  // Scottsdale's semi 52 -> 13); half-weight brightness (17) and the shade
  // judged by texture alone (18) each kept the cost and lost the gain.
  // In THREE by texture (iteration 25): the smoothest third fairway, the
  // middle semi, the coarsest left rough -- mown turf holds all three cuts.
  // (A three-means over the texture, PLACED; with the three closer than half
  // the turf's texture bar, the whole is fairway.)
  const t1 = boxMean(turf.tex, nx, nz, Math.max(1, Math.round(1.5 / cell)));
  const vals = cells.map(k => t1[k]).sort((x, y) => x - y);
  let c = [vals[Math.floor(vals.length * .2)] ?? 0, vals[Math.floor(vals.length * .5)] ?? 0, vals[Math.floor(vals.length * .8)] ?? 0];
  for (let it = 0; it < 10 && vals.length; it++) {
   const sum = [0, 0, 0], n = [0, 0, 0];
   for (const v of vals) { const q = Math.abs(v - c[0]) < Math.abs(v - c[1]) ? (Math.abs(v - c[0]) < Math.abs(v - c[2]) ? 0 : 2) : (Math.abs(v - c[1]) < Math.abs(v - c[2]) ? 1 : 2); sum[q] += v; n[q]++; }
   c = c.map((v, q) => n[q] ? sum[q] / n[q] : v);
  }
  const apart = c[2] - c[0] > turf.texLo * .5, hi = c[0], lo = c[2];
  const which = v => !apart ? 0 : Math.abs(v - c[0]) <= Math.abs(v - c[1]) ? 0 : Math.abs(v - c[1]) <= Math.abs(v - c[2]) ? 1 : 2;
  const fairM = new Uint8Array(N), semiM = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (turf[k]) { const q = which(t1[k]); if (q === 0) fairM[k] = 1; else if (q === 1) semiM[k] = 1; }
  const fairCut = shapeFairways(blobs(majority(fairM, nx, nz, Math.max(1, Math.round(2.5 / cell))), nx, nz, cell, {minArea: 300, thick: 3}), nx, nz, cell);
  const semiCut = majority(semiM, nx, nz, Math.max(1, Math.round(2.5 / cell)));
  for (let k = 0; k < N; k++) if (codes[k] === C.rough && turf[k] && (fairCut[k] || semiCut[k])) set(k, fairCut[k] ? C.fairway : C.semi, SOURCE.picture, fairCut[k] ? .75 : .55);
  if (debug) Object.assign(debug, {turfSplit: {apart, hi, lo}});
  // GREENS with no mark: a green is cut shorter than the fairway round it, so
  // in the picture it is smoother and a different shade, and it is compact --
  // 150 to 1,500 m², round rather than long (PLACED; iteration 2).
  // How a green stands out from the turf round it (iteration 6): it is cut
  // shortest, so LIGHTER, LESS GREEN to the near-infrared (or to the eye) and
  // SMOOTHER than the fairway and rough within 20 m -- each difference
  // counted in its own spread over the course's turf, and the cells that
  // stand out most (the top 7% of turf, PLACED) are the candidates.
  // Iteration 5 counted any difference, either way, and the candidates ran
  // together into patches far bigger than greens (TPC Scottsdale: half a
  // million cells, none kept).
  const L = new Float32Array(N), G = new Float32Array(N);
  for (let k = 0; k < N; k++) { const p = pix(k); if (!p) continue; L[k] = lum(p.r, p.g, p.b); G[k] = p.n != null ? ndvi(p) : exg(p); }
  const r1 = Math.max(1, Math.round(1.5 / cell)), r2 = Math.max(2, Math.round(20 / cell));
  // The surroundings are the TURF within 20 m only (iteration 12): with the
  // trees counted in, every fairway edge among Northwood's redwoods was
  // "lighter than round it" and no green was kept.
  const tf = Float32Array.from(turf), wTurf = boxMean(tf, nx, nz, r2), turfMean = a => { const m = boxMean(Float32Array.from(a, (v, k) => turf[k] ? v : 0), nx, nz, r2); for (let k = 0; k < N; k++) m[k] = wTurf[k] > .05 ? m[k] / wTurf[k] : a[k]; return m; };
  const nL = boxMean(L, nx, nz, r1), wL = turfMean(L), nG = boxMean(G, nx, nz, r1), wG = turfMean(G), nT = boxMean(turf.fine, nx, nz, r1), wT = turfMean(turf.fine);
  const spread = f => { const v = []; for (let k = 0; k < N; k += 7) if (turf[k]) v.push(f(k)); v.sort((x, y) => x - y); return Math.max(1e-6, (v[Math.floor(v.length * .84)] ?? 1) - (v[Math.floor(v.length * .16)] ?? 0)) / 2; };
  const sL = spread(k => nL[k] - wL[k]), sG = spread(k => nG[k] - wG[k]), sT = spread(k => nT[k] - wT[k]);
  const score = new Float32Array(N).fill(-Infinity);
  // A green is a plant: bare ground, paths and roofs stand out the same way
  // (iteration 9: ranked by score alone, they were all that was kept).
  // (Iterations 32-34, for Ekwanok's pale greens -- NDVI 0.07 against its
  // fairways' 0.16 in June 2023 -- set this bar from the fairway's own
  // greenness, let greens lie 40 m from the turf, and measured a green with no
  // turf near against everything near: greens fell 29 to 24 and Ekwanok's
  // stayed at 3. Not kept.)
  const plantBar = P.nir ? .15 : .04;
  for (let k = 0; k < N; k++) if (pix(k) && off[k] < 12 && G[k] > plantBar && codes[k] !== C.sand && codes[k] !== C.water) score[k] = (nL[k] - wL[k]) / sL + (wG[k] - nG[k]) / sG + 2 * (wT[k] - nT[k]) / sT;
  const bar = (() => { const v = []; for (let k = 0; k < N; k += 7) if (turf[k] && score[k] > -Infinity) v.push(score[k]); v.sort((x, y) => x - y); return v[Math.floor(v.length * .9)] ?? Infinity; })();
  const cand = new Uint8Array(N);
  for (let k = 0; k < N; k++) cand[k] = score[k] > bar ? 1 : 0;
  // How round a patch is: 1 a disc, less as it runs long or ragged.
  const roundness = list => { let e = 0; const set1 = new Set(list); for (const k of list) { const i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (!set1.has(n)) e++; } const P = e * cell / 1.27; return Math.min(1, 4 * Math.PI * list.length * cell * cell / (P * P)); };
  const round = list => { let e = 0; const set1 = new Set(list); for (const k of list) { const i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (!set1.has(n)) e++; } const A = list.length * cell * cell, P = e * cell / 1.27; return 4 * Math.PI * A / (P * P) > .45; };
  // Opened (shrunk and grown back 2.5 m, PLACED) so candidates touching by a
  // thin strip part into their own patches (iteration 7: on TPC Scottsdale's
  // 60 hectares of turf the candidates ran together and none was kept).
  const opened = open(majority(cand, nx, nz, Math.max(1, Math.round(1.5 / cell))), nx, nz, Math.max(1, Math.round(2.5 / cell)));
  // THE STRONGEST FEW (iteration 8): every patch that could be a green is
  // ranked by how far it stands out (its mean score), and only as many are
  // kept as a course this size has greens -- one for about 2 hectares of
  // turf, 6 to 30 (PLACED). Without the count, opening the candidates found
  // more real greens (TPC Scottsdale 44%, Breckenridge 60%) and many more
  // false ones.
  const turfHa = (() => { let n = 0; for (let k = 0; k < N; k++) if (turf[k]) n++; return n * cell * cell / 1e4; })();
  const pick = (mask, opts, howMany) => {
   const found = []; blobs(mask, nx, nz, cell, {...opts, accept: list => { if (!opts.keep || opts.keep(list)) { let m = 0; for (const k of list) m += score[k]; found.push({list: list.slice(), mean: m / list.length * roundness(list)}); } return false; }});
   found.sort((x, y) => y.mean - x.mean);
   const out = new Uint8Array(N); for (const f of found.slice(0, howMany)) for (const k of f.list) out[k] = 1; return out;
  };
  const nGreens = Math.max(9, Math.min(40, Math.round(turfHa / 1)));
  const greens = pick(opened, {minArea: 150, maxArea: 1500, thick: 3, maxLength: 60, keep: round}, nGreens);
  // TOO FEW GREENS FOUND: a second look, looser, on that course alone
  // (iteration 39). Greens can be pale -- Ekwanok's read NDVI 0.07 in June
  // 2023 against its fairways' 0.16 -- not counted as turf, and ringed by
  // collars that are not turf either. Loosened everywhere (iterations 32-34)
  // the same tests cost the other courses more than they found; asked only
  // where the first look found under 6 greens or 40% of the room for them,
  // they cost nothing elsewhere. The plant bar a third of the fairway's own
  // greenness, 30 m from the turf, a green with no turf near against all that
  // is near.
  { let found = 0; const seen = new Uint8Array(N);
   for (let s0 = 0; s0 < N; s0++) if (greens[s0] && !seen[s0]) { found++; const st = [s0]; seen[s0] = 1; while (st.length) { const k = st.pop(), i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && greens[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
   if (found < Math.max(6, nGreens * .4)) {
    const bar2 = Math.min(plantBar, (fc.n ?? fc.e) * .35), all = [boxMean(L, nx, nz, r2), boxMean(G, nx, nz, r2), boxMean(turf.fine, nx, nz, r2)];
    const score2 = new Float32Array(N).fill(-Infinity);
    for (let k = 0; k < N; k++) {
     if (!pix(k) || !(off[k] < 30) || G[k] <= bar2 || codes[k] === C.sand || codes[k] === C.water || greens[k]) continue;
     const near = wTurf[k] > .05, l = near ? wL[k] : all[0][k], g = near ? wG[k] : all[1][k], t = near ? wT[k] : all[2][k];
     score2[k] = (nL[k] - l) / sL + (g - nG[k]) / sG + 2 * (t - nT[k]) / sT;
    }
    const v = []; for (let k = 0; k < N; k += 7) if (score2[k] > -Infinity) v.push(score2[k]); v.sort((x, y) => x - y);
    const bar3 = v[Math.floor(v.length * .9)] ?? Infinity, cand2 = Uint8Array.from(score2, x => x > bar3 ? 1 : 0);
    for (let k = 0; k < N; k++) if (score2[k] > -Infinity) score[k] = score2[k];
    const more = pick(open(majority(cand2, nx, nz, Math.max(1, Math.round(1.5 / cell))), nx, nz, Math.max(1, Math.round(2.5 / cell))), {minArea: 150, maxArea: 1500, thick: 3, maxLength: 60, keep: round}, Math.round(nGreens - found));
    for (let k = 0; k < N; k++) if (more[k]) greens[k] = 1;
    if (debug) Object.assign(debug, {greenSecondLook: {found, added: true}});
   }
  }
  // Each green found GROWN to its edge (iteration 30): the patch that stood
  // out is often only part of a green (found 28%, right 70%), so it spreads
  // to neighbouring cells as bright, as green and as smooth as itself (within
  // 12 of brightness, 0.06 of greenness, half again its texture; PLACED), to
  // 22 m from its middle, as the marked trace grows a green from a click.
  { const seen = new Uint8Array(N), list = [];
   for (let s0 = 0; s0 < N; s0++) {
    if (!greens[s0] || seen[s0]) continue;
    list.length = 0; list.push(s0); seen[s0] = 1;
    for (let q = 0; q < list.length; q++) { const k = list[q], i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && greens[n] && !seen[n]) { seen[n] = 1; list.push(n); } }
    let mL = 0, mG = 0, mT = 0, cx = 0, cz = 0; for (const k of list) { mL += L[k]; mG += G[k]; mT += turf.fine[k]; cx += k % nx; cz += Math.floor(k / nx); }
    const n0 = list.length; mL /= n0; mG /= n0; mT /= n0; cx /= n0; cz /= n0;
    const reach = (22 / cell) ** 2;
    for (let q = 0; q < list.length; q++) { const k = list[q], i = k % nx;
     for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) {
      if (n < 0 || n >= N || seen[n] || codes[n] === C.sand || codes[n] === C.water) continue;
      const ni = n % nx, nj = Math.floor(n / nx); if ((ni - cx) ** 2 + (nj - cz) ** 2 > reach) continue;
      if (Math.abs(L[n] - mL) < 12 && Math.abs(G[n] - mG) < .06 && turf.fine[n] < mT * 1.5) { seen[n] = 1; greens[n] = 1; list.push(n); }
     } }
   }
  }
  // Grown, then rounded: closed over 2 m and a majority over 2.5 m, so the
  // growing's frayed edge is a green's smooth one (it read 1.31 ragged).
  { const g2 = majority(close(greens, nx, nz, Math.max(1, Math.round(2 / cell))), nx, nz, Math.max(1, Math.round(2.5 / cell))); for (let k = 0; k < N; k++) greens[k] = g2[k] && codes[k] !== C.sand && codes[k] !== C.water ? 1 : 0; }
  for (let k = 0; k < N; k++) if (greens[k]) set(k, C.green, SOURCE.picture, .85);
  // TEES with no mark: the same short cut as a green, in small squared-off
  // pads -- 30 to 450 m², filling most of their own box (PLACED; iteration 7).
  const pad = list => { let i0 = nx, i1 = 0, j0 = nz, j1 = 0; for (const k of list) { const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } return list.length / ((i1 - i0 + 1) * (j1 - j0 + 1)) > .6; };
  const tees = pick(open(cand, nx, nz, Math.max(1, Math.round(1 / cell))), {minArea: 30, maxArea: 450, thick: 1.5, maxLength: 45, keep: list => pad(list) && !list.some(k => greens[k])}, nGreens * 2);
  for (let k = 0; k < N; k++) if ((tees[k] || (turf.islands[k] && off[k] < 150)) && codes[k] !== C.green) set(k, C.tee, SOURCE.picture, .8);
  if (debug) Object.assign(debug, {greenCand: cand, greens, tees});
  // THE COURSE TEACHES ITSELF (iteration 36). What the rules above are surest
  // of -- each surface shrunk from its edges -- becomes the examples of what a
  // green, a fairway, the semi, sand, water, rough and bare ground look like
  // in THIS picture, by twelve measures a cell (brightness, greenness, the
  // colour's balance, texture at two scales, how it stands out from the turf
  // round it). A naive-Bayes classifier learns them and labels every cell
  // near the course; the shape rules then clean what it says (whole round
  // greens, simple fairways, compact bunkers, wide water), and it may only
  // add to the rules, never take away. PLACED, all of it.
  {
   const R = m => Math.max(1, Math.round(m / cell));
   const shrink = (code, r) => Uint8Array.from(boxMean(Float32Array.from(codes, c => c === code ? 1 : 0), nx, nz, r), v => v > .999 ? 1 : 0);
   const sums = new Float32Array(N); for (let k = 0; k < N; k++) { const p = pix(k); if (p) sums[k] = p.r + p.g + p.b + 1; }
   const feat = k => { const p = pix(k); return [L[k] / 40, G[k] * 6, turf.tex[k] / turf.texLo, turf.fine[k] / turf.texLo, (L[k] - wL[k]) / 20, (G[k] - wG[k]) * 6, p.r / sums[k] * 10, p.b / sums[k] * 10, (nL[k] - wL[k]) / 20, (nT[k] - wT[k]) / turf.texLo, Math.min(off[k], 60) / 20, (p.n ?? p.g) / 40]; };
   const seedOf = [shrink(C.green, R(1)), shrink(C.fairway, R(3)), shrink(C.semi, R(1)), shrink(C.sand, 1), shrink(C.water, R(2))];
   const classes = seedOf.map(() => []), rough = [], bare = [];
   let q = 12345; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
   for (let k = 0; k < N; k++) {
    if (!pix(k) || !(off[k] < 60)) continue;
    for (let c = 0; c < seedOf.length; c++) if (seedOf[c][k] && classes[c].length < 4000 && rnd() < .3) classes[c].push(k);
    if (codes[k] === C.rough && off[k] > 8 && rnd() < .05) (G[k] > plantBar ? rough : bare).length < 4000 && (G[k] > plantBar ? rough : bare).push(k);
   }
   classes.push(rough, bare);
   const models = classes.map(list => {
    if (list.length < 30) return null;
    const D = 12, mu = new Float64Array(D), va = new Float64Array(D);
    for (const k of list) { const f = feat(k); for (let d = 0; d < D; d++) mu[d] += f[d]; }
    for (let d = 0; d < D; d++) mu[d] /= list.length;
    for (const k of list) { const f = feat(k); for (let d = 0; d < D; d++) va[d] += (f[d] - mu[d]) ** 2; }
    for (let d = 0; d < D; d++) va[d] = Math.max(.02, va[d] / list.length);
    return {mu, va, norm: -.5 * va.reduce((s, v) => s + Math.log(v), 0)};
   });
   const label = new Int8Array(N).fill(-1);
   for (let k = 0; k < N; k++) {
    if (!pix(k) || !(off[k] < 60)) continue;
    const f = feat(k); let best = -1, bl = -Infinity;
    for (let c = 0; c < models.length; c++) { const m = models[c]; if (!m) continue; let l = m.norm; for (let d = 0; d < 12; d++) l -= (f[d] - m.mu[d]) ** 2 / (2 * m.va[d]); if (l > bl) { bl = l; best = c; } }
    label[k] = best;
   }
   const as = c => Uint8Array.from(label, v => v === c ? 1 : 0);
   // Greens: the learnt green, in whole round patches, beside the rules' own.
   const more = pick(open(majority(as(0), nx, nz, R(1.5)), nx, nz, R(2)), {minArea: 150, maxArea: 1500, thick: 3, maxLength: 60, keep: list => round(list) && !list.some(k => greens[k])}, nGreens);
   for (let k = 0; k < N; k++) if (more[k] && codes[k] !== C.sand && codes[k] !== C.water) set(k, C.green, SOURCE.picture, .86);
   // (Its fairways and sand were tried too, iteration 36: drawn too wide --
   // fairway 30% right, sand 25% -- they fell 31 to 24 and 28 to 19. Its
   // greens are kept.)
   // (Iteration 40 added the learnt sand where a looser rule agreed: sand
   // found more, 45 to 49, but right fell 41 to 26 and overlap 28 to 20. Not
   // kept.)
   // (Its water was kept at iteration 37 and dropped after: on the real
   // courses it added nothing -- water 42 either way -- and over a picture
   // of plain dark and light squares it learnt the survey's one pond and
   // called every dark square a pond, the first tee in one.)
   if (debug) Object.assign(debug, {learnt: label, seeds: classes.map(l => l.length)});
  }
 }
 const roughPix = [];
 if (!turf) for (let k = 0; k < N; k += 37) if (land.canopy[k] < 1 && codes[k] === C.rough && off[k] > 30 && off[k] < 60) { const p = pix(k); if (p) roughPix.push(p); }
 const rc = roughPix.length ? {r: median(roughPix, p => p.r), g: median(roughPix, p => p.g), b: median(roughPix, p => p.b)} : null;
 const mown = new Uint8Array(N);
 for (let k = 0; k < N && !turf; k++) {
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

// REFINING A STARTING TRACE (the owner, 1 November 2026: OpenStreetMap's
// outlines "as a starting point to build LIDAR or Image traces"). `start`:
// codes over the land in the palette whose first entries are TRACE's (door
// 2's layers' composite). The start's surfaces, each shrunk 2 m from its
// edges, are the examples; a naive-Bayes classifier learns what each looks
// like -- in the picture (`mode` 'picture': brightness, greenness, colour
// balance, texture at two scales) or in the survey ('lidar': roughness at a
// metre, slope, hollows, the laser's brightness, canopy) -- and then:
//   - a cell within `band` m of the start's edges takes what the classifier
//     says: the edge moves to where the picture or the ground puts it;
//   - deeper inside a surface, the start's surface stands;
//   - away from every surface of the start, only what is clearly sand, water
//     or green (by the classifier, in the shapes the auto trace keeps) is
//     added -- a bunker or pond the map left out.
// Each surface then rounded (a majority over 1.5 m) and the fairways made
// simple shapes (shapeFairways). Returns new codes. PLACED, all of it.
export function refineTrace(land, start, {picture = null, mode = 'picture', band = 3, align = true} = {}) {
 const {nx, nz, cell} = land, N = nx * nz, R = m => Math.max(1, Math.round(m / cell));
 const C = Object.fromEntries(TRACE.map((t, i) => [t, i]));
 const usePic = mode === 'picture' && !!picture;
 // The features, and a smoothness map for lining the start up.
 let feat, smooth;
 if (usePic) {
  const P = picture, L = new Float32Array(N), L2 = new Float32Array(N), Gr = new Float32Array(N), cr = new Float32Array(N), cb = new Float32Array(N);
  for (let k = 0; k < N; k++) { if (!P.has[k]) continue; const r = P.rgb[k * 3], g = P.rgb[k * 3 + 1], b = P.rgb[k * 3 + 2], s = r + g + b + 1; L[k] = .299 * r + .587 * g + .114 * b; L2[k] = L[k] * L[k]; Gr[k] = P.nir ? (P.nir[k] - r) / (P.nir[k] + r + 1) : (2 * g - r - b) / s; cr[k] = r / s; cb[k] = b / s; }
  const tex = r => { const m1 = boxMean(L, nx, nz, r), m2 = boxMean(L2, nx, nz, r); return Float32Array.from(m1, (m, k) => Math.sqrt(Math.max(0, m2[k] - m * m)) / (m + 20)); };
  const t1 = tex(R(1)), t2 = tex(1), Lw = boxMean(L, nx, nz, R(10)), Gw = boxMean(Gr, nx, nz, R(10));
  feat = k => P.has[k] ? [L[k] / 40, Gr[k] * 6, cr[k] * 10, cb[k] * 10, t1[k] * 20, t2[k] * 20, (L[k] - Lw[k]) / 20, (Gr[k] - Gw[k]) * 6] : null;
  smooth = t1;
 } else {
  const F = features(land); smooth = F.rough; const Iw = boxMean(Float32Array.from(land.intensity, v => Number.isFinite(v) ? v : 0), nx, nz, R(10));
  feat = k => [F.rough[k] * 50, F.slope[k] / 5, F.hollow[k] * 5, Number.isFinite(land.intensity[k]) ? land.intensity[k] * 5 : 0, Math.min(land.canopy[k], 20) / 4, Number.isFinite(land.intensity[k]) ? (land.intensity[k] - Iw[k]) * 10 : 0];
 }
 // LINED UP FIRST: a map is most often off by a shift. The start's mown
 // surfaces (fairway, green, tee) should sit on the smoothest ground and the
 // 2-6 m just outside them on coarser: every shift to 10 m either way is
 // tried (a metre apart, then half a metre round the best) and the start moved
 // by the one that makes that contrast greatest. (The first refinement, with
 // no lining up and 8 m of edge relabelled, lost tees and greens to a map 4 m
 // off: green 37 -> 22, tee 45 -> 9.)
 if (align) {
  const mown = Uint8Array.from(start, c => c === C.fairway || c === C.green || c === C.tee ? 1 : 0), dist = distanceFrom(mown, nx, nz, cell);
  let q0 = 777; const rnd0 = () => (q0 = (q0 * 1103515245 + 12345) % 2147483648) / 2147483648;
  const inS = [], ring = []; for (let k = 0; k < N; k++) { if (mown[k] && rnd0() < .05) inS.push(k); else if (dist[k] > 2 && dist[k] < 6 && rnd0() < .05) ring.push(k); }
  const at = (list, di, dj) => { let t = 0, n = 0; for (const k of list) { const i = k % nx + di, j = Math.floor(k / nx) + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; t += smooth[j * nx + i]; n++; } return n ? t / n : Infinity; };
  const energy = (di, dj) => at(inS, di, dj) - at(ring, di, dj);
  let best = [0, 0], be = energy(0, 0);
  const step = R(1), reach = R(10);
  for (let dj = -reach; dj <= reach; dj += step) for (let di = -reach; di <= reach; di += step) { const e = energy(di, dj); if (e < be) { be = e; best = [di, dj]; } }
  const [bi, bj] = best; for (let dj = bj - step; dj <= bj + step; dj++) for (let di = bi - step; di <= bi + step; di++) { const e = energy(di, dj); if (e < be) { be = e; best = [di, dj]; } }
  if (best[0] || best[1]) { const moved = new Uint8Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const si = i - best[0], sj = j - best[1]; if (si >= 0 && sj >= 0 && si < nx && sj < nz) moved[j * nx + i] = start[sj * nx + si]; } start = moved; }
  refineTrace.lastShift = {x: best[0] * cell, z: best[1] * cell};
 }
 // The examples: each surface of the start shrunk 2 m; rough 6 m from all.
 const kinds = ['green', 'fairway', 'semi', 'tee', 'sand', 'water', 'path'];
 const any = Uint8Array.from(start, c => c && c < TRACE.length ? 1 : 0);
 const far = distanceFrom(any, nx, nz, cell);
 const sets = kinds.map(kind => { const m = Uint8Array.from(boxMean(Float32Array.from(start, c => c === C[kind] ? 1 : 0), nx, nz, R(2)), v => v > .999 ? 1 : 0); return m; });
 sets.push(Uint8Array.from(far, d => d > 6 && d < 80 ? 1 : 0));
 let q = 4242; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
 const models = sets.map(m => {
  const list = []; let seen = 0; for (let k = 0; k < N; k++) if (m[k]) seen++;
  const p = Math.min(1, 6000 / Math.max(1, seen)); for (let k = 0; k < N; k++) if (m[k] && rnd() < p) { const f = feat(k); if (f) list.push(f); }
  if (list.length < 30) return null;
  const D = list[0].length, mu = new Float64Array(D), va = new Float64Array(D);
  for (const f of list) for (let d = 0; d < D; d++) mu[d] += f[d];
  for (let d = 0; d < D; d++) mu[d] /= list.length;
  for (const f of list) for (let d = 0; d < D; d++) va[d] += (f[d] - mu[d]) ** 2;
  for (let d = 0; d < D; d++) va[d] = Math.max(.02, va[d] / list.length);
  return {mu, va, norm: -.5 * va.reduce((s, v) => s + Math.log(v), 0)};
 });
 const classify = k => { const f = feat(k); if (!f) return -1; let best = -1, bl = -Infinity; for (let c = 0; c < models.length; c++) { const m = models[c]; if (!m) continue; let l = m.norm; for (let d = 0; d < f.length; d++) l -= (f[d] - m.mu[d]) ** 2 / (2 * m.va[d]); if (l > bl) { bl = l; best = c; } } return best; };
 // The start's edges, and how far each cell is from one.
 const edge = new Uint8Array(N);
 for (let k = 0; k < N; k++) { const i = k % nx; if ((i > 0 && start[k - 1] !== start[k]) || (k >= nx && start[k - nx] !== start[k])) edge[k] = 1; }
 const toEdge = distanceFrom(edge, nx, nz, cell);
 const out = Uint8Array.from(start, c => c < TRACE.length ? c : c);
 const learnt = new Int8Array(N).fill(-1);
 for (let k = 0; k < N; k++) {
  if (toEdge[k] < band || far[k] < 80) learnt[k] = classify(k);
  // Only the edges between fairway, semi, sand, water and rough move; greens,
  // tees and paths keep the start's shapes (they are drawn most carefully,
  // and a band wider than a tee swallowed them).
  const fixed = c => c === C.green || c === C.tee || c === C.path;
  if (toEdge[k] < band && learnt[k] >= 0 && !fixed(start[k])) { const to = learnt[k] === kinds.length ? (start[k] >= TRACE.length ? start[k] : C.rough) : C[kinds[learnt[k]]]; if (!fixed(to)) out[k] = to; }
 }
 // What the map left out, far from its surfaces: clear sand, water, greens.
 const addFar = (kind, opts) => { const c = kinds.indexOf(kind), m = Uint8Array.from(learnt, (v, k) => v === c && toEdge[k] >= band && !any[k] ? 1 : 0); const keep = blobs(majority(m, nx, nz, R(1)), nx, nz, cell, opts); for (let k = 0; k < N; k++) if (keep[k]) out[k] = C[kind]; };
 addFar('sand', {minArea: 6, maxArea: 1500, thick: 1.2, maxLength: 60});
 addFar('water', {minArea: 60, thick: 3.5});
 addFar('green', {minArea: 200, maxArea: 1500, thick: 4, maxLength: 55});
 // Each surface rounded; the fairways made simple shapes.
 const final = Uint8Array.from(out);
 for (const kind of kinds) {
  const c = C[kind], m = majority(Uint8Array.from(out, v => v === c ? 1 : 0), nx, nz, R(1.5)), shaped = kind === 'fairway' ? shapeFairways(m, nx, nz, cell) : m;
  for (let k = 0; k < N; k++) { if (shaped[k]) final[k] = c; else if (final[k] === c && !shaped[k]) final[k] = start[k] === c && toEdge[k] >= band ? c : C.rough; }
 }
 return final;
}
