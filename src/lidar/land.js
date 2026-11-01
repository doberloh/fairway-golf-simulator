// FROM LIDAR TO LAND (the course builder, stage 6; docs/COURSE_BUILDER.md,
// *From points to land*). Points (las.js) and height grids (geotiff.js,
// grids.js) gathered onto one grid over the property, a cell at a time and
// never the whole cloud held: the bare ground from the points the survey
// classed as ground (an unclassified cloud from a ground filter), the tops of
// things from first returns, the laser's brightness, colour where the file
// has it, where the survey saw water and buildings. Then the holes filled, the
// canopy height (tops less ground), and the trees found in it.
//
// The grid is in LOCAL metres: x east of the property's centre, z SOUTH of it
// (north is -z, as the game's maps draw it), heights in metres. Pure; tested
// in Node (tests/lidar-land.test.mjs, and locally on the owner's Worthington
// data, tools/lidar-compare.mjs).

// Classes (ASPRS): 2 ground, 8 model key point (ground thinned), 9 water,
// 6 building, 7 and 18 noise.
const GROUND = new Set([2, 8]), NOISE = new Set([7, 18]);

// `box`: {x0, y0, x1, y1} in the source's map units; `cell` metres;
// `unit`: {h, v} metres per map unit.
export function createGridder({box, cell = 1, unit = {h: 1, v: 1}}) {
 const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
 const halfX = (box.x1 - box.x0) * unit.h / 2, halfZ = (box.y1 - box.y0) * unit.h / 2;
 const nx = Math.round(2 * halfX / cell) + 1, nz = Math.round(2 * halfZ / cell) + 1, N = nx * nz;
 const g = {sum: new Float64Array(N), n: new Uint32Array(N), low: new Float32Array(N).fill(Infinity), top: new Float32Array(N).fill(-Infinity),
  isum: new Float64Array(N), in: new Uint32Array(N), rgb: null, rgbN: new Uint32Array(0), water: new Uint16Array(N), building: new Uint16Array(N), multi: new Uint16Array(N), any: new Uint32Array(N)};
 let classed = 0, points = 0;
 const at = (mx, my) => {
  const x = (mx - cx) * unit.h, z = -(my - cy) * unit.h;
  const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell);
  return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
 };
 return {
  nx, nz, cell, halfX, halfZ, center: {x: cx, y: cy}, unit,
  get points() { return points; }, get classed() { return classed; },
  // Local metres for a map point, and back.
  local: (mx, my) => ({x: (mx - cx) * unit.h, z: -(my - cy) * unit.h}),
  map: (x, z) => ({x: cx + x / unit.h, y: cy - z / unit.h}),
  add(p) {
   if (NOISE.has(p.cls)) return;
   const k = at(p.x, p.y); if (k < 0) return;
   points++;
   const z = p.z * unit.v;
   g.any[k]++;
   if (GROUND.has(p.cls)) { g.sum[k] += z; g.n[k]++; classed++; g.isum[k] += p.intensity; g.in[k]++; }
   else if (p.cls > 1) classed++;
   if (z < g.low[k]) g.low[k] = z;
   // The tops of things: the highest return of any kind, not only first
   // returns (a leaf-out survey's second return off a crown is often its top).
   if (z > g.top[k]) g.top[k] = z;
   if (p.returns > 1) g.multi[k]++;
   if (p.cls === 9) g.water[k]++;
   if (p.cls === 6) g.building[k]++;
   if (p.r || p.g || p.b) {
    if (!g.rgb) { g.rgb = new Float32Array(N * 3); g.rgbN = new Uint32Array(N); }
    const s = p.r > 255 || p.g > 255 || p.b > 255 ? 1 / 257 : 1;
    g.rgb[k * 3] += p.r * s; g.rgb[k * 3 + 1] += p.g * s; g.rgb[k * 3 + 2] += p.b * s; g.rgbN[k]++;
   }
  },
  // A height grid (a DTM, or a DSM with `surface`) laid onto this grid,
  // bilinear, in its own map units (`raster` as geotiff.js gives it).
  addRaster(raster, {surface = false, rasterUnit = unit} = {}) {
   for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const m = this.map(-halfX + i * cell, -halfZ + j * cell);
    const u = (m.x - raster.x0) / raster.dx, v = (m.y - raster.y0) / raster.dy;
    const a = Math.floor(u), b = Math.floor(v), fu = u - a, fv = v - b;
    if (a < 0 || b < 0 || a + 1 >= raster.width || b + 1 >= raster.height) continue;
    const d = raster.data, w = raster.width, q = [d[b * w + a], d[b * w + a + 1], d[(b + 1) * w + a], d[(b + 1) * w + a + 1]];
    if (q.some(Number.isNaN)) continue;
    const h = ((q[0] * (1 - fu) + q[1] * fu) * (1 - fv) + (q[2] * (1 - fu) + q[3] * fu) * fv) * rasterUnit.v, k = j * nx + i;
    if (surface) g.top[k] = Math.max(g.top[k], h); else { g.sum[k] = h; g.n[k] = 1; classed++; }
   }
  },
  // The land: {nx, nz, cell, halfX, halfZ, ground (Float32, filled), surface,
  // canopy (surface less ground, 0 where none), intensity (0-1), rgb (Uint8 or
  // null), water and building (Uint8: share of returns), filled (Uint8: 1
  // where no ground return reached and the ground was filled in), method}.
  finish({onStep = () => {}} = {}) {
   const ground = new Float32Array(N).fill(NaN), filled = new Uint8Array(N);
   let method = 'classified';
   if (classed < points * .05) { method = 'filtered'; groundFilter(g.low, nx, nz, cell, ground); }
   else for (let k = 0; k < N; k++) if (g.n[k]) ground[k] = g.sum[k] / g.n[k];
   onStep('Filling the gaps');
   for (let k = 0; k < N; k++) if (Number.isNaN(ground[k])) filled[k] = 1;
   fill(ground, nx, nz);
   const surface = new Float32Array(N), canopy = new Float32Array(N), intensity = new Float32Array(N);
   let imax = 1;
   for (let k = 0; k < N; k++) if (g.in[k]) imax = Math.max(imax, g.isum[k] / g.in[k]);
   imax = Math.min(imax, 65535);
   for (let k = 0; k < N; k++) {
    surface[k] = Number.isFinite(g.top[k]) ? Math.max(g.top[k], ground[k]) : ground[k];
    canopy[k] = Math.max(0, surface[k] - ground[k]);
    intensity[k] = g.in[k] ? Math.min(1, g.isum[k] / g.in[k] / imax) : NaN;
   }
   fill(intensity, nx, nz);
   const share = arr => Uint8Array.from(arr, (c, k) => g.any[k] ? Math.min(255, Math.round(255 * c / g.any[k])) : 0);
   let rgb = null;
   if (g.rgb) { rgb = new Uint8Array(N * 3); for (let k = 0; k < N; k++) if (g.rgbN[k]) for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.min(255, g.rgb[k * 3 + c] / g.rgbN[k]); }
   return {nx, nz, cell, halfX, halfZ, center: {...this.center}, unit, ground, surface, canopy, intensity, rgb, water: share(g.water), building: share(g.building), multi: share(g.multi),
    noReturns: Uint8Array.from(g.any, v => v ? 0 : 1), filled, method, points};
  },
 };
}

// Holes (no ground return: under water, under roofs, under dense trees)
// filled from their edges inwards, each pass averaging the known neighbours;
// then relaxed (`relax` passes, each filled cell the mean of its four
// neighbours), so a pond's floor or the land past a survey's edge is a smooth
// surface rather than the bumps of its rim carried inward in streaks (a
// filled pond read 25% steep and was refused as water).
export function fill(a, nx, nz, {relax = 40} = {}) {
 let todo = [];
 for (let k = 0; k < a.length; k++) if (Number.isNaN(a[k])) todo.push(k);
 const filled = todo.slice();
 for (let pass = 0; todo.length && pass < 4000; pass++) {
  const next = [], set = [];
  for (const k of todo) {
   const i = k % nx, j = (k - i) / nx;
   let s = 0, n = 0;
   if (i > 0 && !Number.isNaN(a[k - 1])) { s += a[k - 1]; n++; }
   if (i < nx - 1 && !Number.isNaN(a[k + 1])) { s += a[k + 1]; n++; }
   if (j > 0 && !Number.isNaN(a[k - nx])) { s += a[k - nx]; n++; }
   if (j < nz - 1 && !Number.isNaN(a[k + nx])) { s += a[k + nx]; n++; }
   if (n) set.push(k, s / n); else next.push(k);
  }
  for (let q = 0; q < set.length; q += 2) a[set[q]] = set[q + 1];
  if (!set.length) break;
  todo = next;
 }
 for (const k of todo) a[k] = 0;
 for (let pass = 0; pass < relax; pass++) for (const k of filled) {
  const i = k % nx, j = (k - i) / nx;
  a[k] = (a[i > 0 ? k - 1 : k] + a[i < nx - 1 ? k + 1 : k] + a[j > 0 ? k - nx : k] + a[j < nz - 1 ? k + nx : k]) / 4;
 }
}

// AN UNCLASSIFIED CLOUD'S GROUND: a progressive morphological filter (Zhang et
// al. 2003) on the lowest return per cell -- openings with a window growing to
// 21 m, a cell kept as ground while it stands within a height threshold of
// the opened surface that grows with the window (PLACED: 0.3 m, slope 0.3,
// cap 3 m). Cells rejected are filled from the ground round them.
export function groundFilter(low, nx, nz, cell, out) {
 const surf = Float32Array.from(low, v => Number.isFinite(v) ? v : NaN);
 fill(surf, nx, nz);
 const isGround = new Uint8Array(low.length).fill(1);
 let opened = Float32Array.from(surf), prevWin = 0;
 for (const w of [1, 2, 4, 8, 10]) {
  const r = Math.max(1, Math.round(w / cell));
  opened = dilate(erode(opened, nx, nz, r), nx, nz, r);
  const dh = Math.min(3, .3 + .3 * (w - prevWin) * cell);
  for (let k = 0; k < low.length; k++) if (surf[k] - opened[k] > dh) isGround[k] = 0;
  prevWin = w;
 }
 for (let k = 0; k < low.length; k++) out[k] = isGround[k] && Number.isFinite(low[k]) ? low[k] : NaN;
}
function erode(a, nx, nz, r) { return sweep(sweep(a, nx, nz, r, 1, Math.min), nx, nz, r, nx, Math.min); }
function dilate(a, nx, nz, r) { return sweep(sweep(a, nx, nz, r, 1, Math.max), nx, nz, r, nx, Math.max); }
function sweep(a, nx, nz, r, stride, f) {
 const out = new Float32Array(a.length);
 for (let k = 0; k < a.length; k++) {
  const i = k % nx, j = (k - i) / nx, along = stride === 1 ? i : j, len = stride === 1 ? nx : nz;
  let v = a[k];
  for (let d = -r; d <= r; d++) { const q = along + d; if (q >= 0 && q < len) v = f(v, a[k + d * stride]); }
  out[k] = v;
 }
 return out;
}

// THE TREES: peaks in the canopy height, each a tree of that height whose
// crown reaches out to where the canopy falls under half of it (searched in
// eight directions, to 15 m). A peak is the highest cell within a window that
// grows with height (PLACED: 2 m plus a tenth of the height); nothing under
// 2 m is a tree. Points in local metres.
export function findTrees(land, {minHeight = 2, smooth = true} = {}) {
 const {nx, nz, cell, halfX, halfZ} = land, trees = [];
 // Peaks are looked for in the canopy smoothed once (a 3x3 average), so one
 // crown's twigs are not each a tree; heights are read off the canopy itself.
 const raw = land.canopy, canopy = smooth ? Float32Array.from(raw, (v, k) => { const i = k % nx, j = (k - i) / nx; let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) { s += raw[jj * nx + ii]; n++; } } return s / n; }) : raw;
 for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
  const k = j * nx + i, h = canopy[k];
  if (h < minHeight) continue;
  const r = Math.max(1, Math.round((2 + h * .1) / cell));
  let peak = true;
  for (let dj = -r; dj <= r && peak; dj++) for (let di = -r; di <= r; di++) {
   if (!di && !dj) continue;
   const ii = i + di, jj = j + dj;
   if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
   const o = canopy[jj * nx + ii];
   if (o > h || (o === h && (dj < 0 || (dj === 0 && di < 0)))) { peak = false; break; }
  }
  if (!peak) continue;
  let reach = 0;
  for (let d = 0; d < 8; d++) {
   const a = d * Math.PI / 4, ux = Math.cos(a), uz = Math.sin(a);
   let s = 0;
   for (let step = 1; step <= 15 / cell; step++) { const ii = Math.round(i + ux * step), jj = Math.round(j + uz * step); if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || canopy[jj * nx + ii] < h / 2) break; s = step; }
   reach += s * cell;
  }
  // Its height: the highest raw canopy within the peak's window (the smoothed
  // peak sits lower than the crown's top).
  let top = raw[k];
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) top = Math.max(top, raw[jj * nx + ii]); }
  trees.push({x: -halfX + i * cell, z: -halfZ + j * cell, h: top, crown: Math.max(1, reach / 8 + cell / 2)});
 }
 return trees;
}
