// The green, read from above.
//
// The contour heat map existed only as a 3D overlay you had to be standing on
// the green to use. Read from the ball it is foreshortened into almost nothing:
// the far half of the green is a few pixels tall, which is exactly the half you
// are trying to judge. Straight down it is legible, and the map is already a
// top-down view, so this paints the same field onto the map canvas.
//
// It is the SAME field the 3D overlay draws -- height across the putting
// surface, scaled between that green's own lowest and highest point, blue low to
// red high. Two views of one thing that disagreed would be worse than one view.
import {greenDistance, greenRadius} from './course.js';

// The square the green occupies, in hole-local coordinates. Sampled from
// `greenRadius` rather than assumed circular, because greens are not: the
// outline wobbles with the hole's own seed and is stretched by `greenAspect`.
export function greenBounds(course, margin = 1.5) {
 const centre = course.green ?? course.pin;
 let rx = 0, rz = 0;
 for (let i = 0; i < 64; i++) {
  const a = i * Math.PI / 32;
  const r = greenRadius(course, a) + (course.settings?.fringe ?? 0);
  rx = Math.max(rx, Math.abs(Math.cos(a) * r * course.greenAspect));
  rz = Math.max(rz, Math.abs(Math.sin(a) * r));
 }
 return {x: centre.x, z: centre.z, rx: rx + margin, rz: rz + margin};
}

// Height across the green on an n x n grid, plus the range to scale it against.
//
// `lo` and `hi` come from the putting surface ALONE, never from the whole
// sampled square. Include the surround and a green sitting in a hollow scales
// against the bank behind it: the putting surface then occupies a sliver of the
// ramp and reads as uniformly flat, which is the opposite of what it is for.
export function heatField(course, n = 96) {
 const b = greenBounds(course);
 const height = new Float32Array(n * n);
 const inside = new Uint8Array(n * n);
 let lo = Infinity, hi = -Infinity;
 for (let j = 0; j < n; j++) {
  for (let i = 0; i < n; i++) {
   // PIXEL CENTRES, not corner-to-corner. The grid is drawn as an image
   // covering the bounds rectangle, where texel i spans [i, i+1] and is
   // sampled at i+0.5. Sampling at i/(n-1) instead put the whole field half a
   // texel out of register with the ground it describes.
   const x = b.x + ((i + 0.5) / n * 2 - 1) * b.rx;
   const z = b.z + ((j + 0.5) / n * 2 - 1) * b.rz;
   const k = j * n + i;
   const y = course.height(x, z);
   height[k] = y;
   if (greenDistance(course, x, z) < 0) {
    inside[k] = 1;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
   }
  }
 }
 // A green can be dead flat -- the practice bench is -- and a zero range would
 // divide by nothing and paint the whole surface one end of the ramp.
 if (!Number.isFinite(lo)) { lo = 0; hi = 0; }
 return {n, bounds: b, height, inside, lo, hi, flat: hi - lo < 1e-4};
}

// Blue low to red high, matching `createGreenReading` exactly: hue sweeps 0.64
// down to 0 across the green's own range. Returned as HSL so the two renderers
// cannot drift apart through one of them rounding to hex.
export function heatColor(t) {
 const clamped = Math.min(1, Math.max(0, t));
 return `hsl(${(1 - clamped) * 0.64 * 360} 88% 48%)`;
}

// Contour bands, 10 cm apart, as the 3D overlay's own note promises. Returned as
// a band index so the caller can draw a line wherever the index changes rather
// than testing heights against a list.
export const CONTOUR_STEP = 0.1;
export const contourBand = (y, lo) => Math.floor((y - lo) / CONTOUR_STEP);

// The field painted onto an offscreen canvas, cached per green.
//
// Browser only -- it needs a 2D context. The map redraws about twelve times a
// second and the field is thousands of `course.height` calls, so it is built
// once and blitted after that. The key covers everything that changes the
// surface; a pin moving does not, because a cup is cut into the green rather
// than reshaping it.
const tiles = new Map();
export function greenHeatTile(course, n = 96) {
 const b = greenBounds(course);
 const key = [course.hole, b.x.toFixed(2), b.z.toFixed(2), course.greenSize,
  course.greenAspect, course.settings?.greenDifficulty, course.settings?.seed, n].join('|');
 const hit = tiles.get(key);
 if (hit) return hit;

 const field = heatField(course, n);
 const canvas = typeof OffscreenCanvas === 'function'
  ? new OffscreenCanvas(n, n)
  : Object.assign(document.createElement('canvas'), {width: n, height: n});
 const ctx = canvas.getContext('2d');
 const img = ctx.createImageData(n, n);
 const span = Math.max(1e-4, field.hi - field.lo);

 for (let k = 0; k < n * n; k++) {
  const p = k * 4;
  if (!field.inside[k]) { img.data[p + 3] = 0; continue; }
  const t = (field.height[k] - field.lo) / span;
  // HSL to RGB by hand: pulling a computed style per pixel would be absurd, and
  // this has to agree with `heatColor` exactly.
  const h = (1 - Math.min(1, Math.max(0, t))) * 0.64 * 6;
  const c = 0.88 * (1 - Math.abs(2 * 0.48 - 1)), x = c * (1 - Math.abs(h % 2 - 1)), m = 0.48 - c / 2;
  const [r, g, bl] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x]
   : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  img.data[p] = Math.round((r + m) * 255);
  img.data[p + 1] = Math.round((g + m) * 255);
  img.data[p + 2] = Math.round((bl + m) * 255);
  img.data[p + 3] = 214;
 }

 // Contour lines drawn as band EDGES rather than by tracing: a pixel whose band
 // differs from the one left or above it is on a line. On a flat green there are
 // no edges, so nothing is drawn, which is correct rather than a special case.
 if (!field.flat) {
  for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
   const k = j * n + i;
   if (!field.inside[k]) continue;
   const band = contourBand(field.height[k], field.lo);
   if (band === contourBand(field.height[k - 1], field.lo)
    && band === contourBand(field.height[k - n], field.lo)) continue;
   const p = k * 4;
   img.data[p] = Math.round(img.data[p] * 0.45);
   img.data[p + 1] = Math.round(img.data[p + 1] * 0.45);
   img.data[p + 2] = Math.round(img.data[p + 2] * 0.45);
   img.data[p + 3] = 235;
  }
 }
 ctx.putImageData(img, 0, 0);
 const tile = {canvas, bounds: b, lo: field.lo, hi: field.hi, flat: field.flat};
 // One green at a time is all the map ever shows; the cache exists to survive
 // redraws, not to hold a course.
 if (tiles.size > 4) tiles.clear();
 tiles.set(key, tile);
 return tile;
}
