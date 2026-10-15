// BALL FINISHES (Phase 5, 14 October 2026; the agreed spec, 7.3).
//
// ONE PICTURE, ONE SOURCE. Each finish is a single rule: the colour at a point
// on the ball, given as a direction from its centre. The same rule fills the
// texture the 3D ball wears (`finishTexels`) and draws the small 2D picture --
// the profile picture, and the close-up turning in the hole-out banner
// (`ballPixels`) -- so the two can never disagree, and no 3D render is needed
// for an icon. Pure: no DOM, no three.js; tests run it in Node.
//
// The ball stays real size on the course (21.3 mm radius), so a finish is seen
// close up, on replays, and in the pictures; at a distance it is a dot of its
// average colour. The seat colour that tells golfers apart is not on the ball:
// the score chip, the scramble beams and the summary tracers keep it.
//
// Every colour and pattern here is PLACED by eye.

import {hexRgb} from './rewards.js';

const TAU = Math.PI * 2;
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const C = h => hexRgb(h);

// Value noise in three dimensions, sampled on the unit sphere so a pattern has
// no seam where the texture wraps and no pinch at the poles.
function hash(x, y, z) {
 let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
 h = (h ^ (h >>> 13)) * 1274126177 | 0;
 return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise3(x, y, z) {
 const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
 const fx = x - xi, fy = y - yi, fz = z - zi, s = t => t * t * (3 - 2 * t);
 const u = s(fx), v = s(fy), w = s(fz);
 const l = (a, b, t) => a + (b - a) * t;
 const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
 return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
  l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (p, f, oct = 3) => { let a = 0, amp = .5, n = 0; for (let i = 0; i < oct; i++) { a += amp * noise3(p[0] * f + 17 * i, p[1] * f + 31 * i, p[2] * f + 47 * i); n += amp; f *= 2; amp *= .5; } return a / n; };

// A point on the ball: the direction `p` [x, y, z] (y up), its longitude `u`
// (0 to 1 round the ball) and latitude `v` (0 at the top, 1 at the bottom).
const WHITE = C('#fbfaf2');
// The dimples: a faint shading in a lattice laid round the ball, row by row,
// every finish wears them (Chrome and Gold rather less).
function dimple(u, v) {
 const rows = 22, r = v * rows, ri = Math.floor(r), fr = r - ri;
 const n = Math.max(1, Math.round(44 * Math.sin(Math.PI * (ri + .5) / rows)));
 const c = (u * n + (ri % 2) * .5) % 1;
 const d = Math.hypot((fr - .5) * 1.1, (c - .5));
 return 1 - .07 * (1 - smooth(.25, .5, d));
}

const FINISH_RULES = {
 classic: () => WHITE,
 'red-stripe': ({v}) => { const d = Math.abs(v - .5); return d < .05 ? C('#d62f2f') : d < .065 ? WHITE : d < .08 ? C('#1f3d8f') : WHITE; },
 smiley: ({p}) => {
  // The face looks out along +z: two eyes, a smile, on yellow.
  const [x, y, z] = p, yellow = C('#ffd83a'), ink = C('#3b2a14');
  if (z < .2) return yellow;
  const eye = (ex) => Math.hypot(x - ex, y - .28) < .11;
  if (eye(-.27) || eye(.27)) return ink;
  const r = Math.hypot(x, y + .02), ang = Math.atan2(y + .02, x);
  if (y < -.05 && Math.abs(r - .5) < .06 && ang < -.35 && ang > -Math.PI + .35) return ink;
  return yellow;
 },
 'two-tone': ({u}) => (u + .02) % 1 < .5 ? C('#1f3f8a') : WHITE,
 'polka-dot': ({p, u, v}) => {
  // Dots laid row by row round the ball, each a round spot measured on the
  // ball itself, so none stretches into an oval near the poles.
  const rows = 7, dots = [C('#e64b6b'), C('#3aa5e8'), C('#f4b52f'), C('#5cc26a')];
  let best = 9, pick = 0;
  for (let ri = Math.max(0, Math.floor(v * rows) - 1); ri <= Math.min(rows - 1, Math.floor(v * rows) + 1); ri++) {
   const th = Math.PI * (ri + .5) / rows, n = Math.max(1, Math.round(13 * Math.sin(th))), off = (ri % 2) * .5;
   const j0 = Math.round(u * n - off - .5);
   for (let j = j0 - 1; j <= j0 + 1; j++) {
    const ph = ((j + off + .5) / n) * TAU, c = [Math.sin(ph) * Math.sin(th), Math.cos(th), Math.cos(ph) * Math.sin(th)];
    const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
    if (d < best) { best = d; pick = ((ri + j) % 4 + 4) % 4; }
   }
  }
  return best < .14 ? dots[pick] : WHITE;
 },
 pumpkin: ({u, v, p}) => {
  if (v < .1) return mix(C('#3f7a2d'), C('#2e5a20'), v / .1);
  const rib = Math.pow(Math.abs(Math.cos(u * Math.PI * 9)), .6);
  return mix(C('#a8460f'), C('#ff9a3c'), .15 + .8 * rib * (1 - Math.abs(p[1]) * .3));
 },
 glow: ({u, v}) => { const band = .5 + .5 * Math.sin(u * TAU * 3 + v * 6); return mix(C('#c8ff3c'), C('#ff5fd2'), smooth(.35, .65, band)); },
 chrome: ({p}) => {
  // A room reflected: sky above a bright horizon, the ground dark below.
  const y = p[1];
  if (y > .08) return mix(C('#f4f8ff'), C('#7fa6d6'), clamp01((y - .08) / .8));
  if (y > -.04) return C('#ffffff');
  return mix(C('#6d6a63'), C('#2c2b29'), clamp01(-y / .9));
 },
 camo: ({p}) => {
  const a = fbm(p, 2.6), b = fbm([p[2], p[0], p[1]], 3.4);
  return a > .58 ? C('#3b4a26') : b > .56 ? C('#7a6a45') : a < .42 ? C('#24301a') : C('#5c6e3a');
 },
 galaxy: ({p}) => {
  const n = fbm(p, 2.2, 4), m = fbm([p[1], p[2], p[0]], 3.1, 3);
  let c = mix(C('#0c0a2a'), C('#3a1a6e'), smooth(.4, .75, n));
  c = mix(c, C('#2e8fd6'), smooth(.55, .8, m) * .6);
  const s = hash(Math.floor(p[0] * 60), Math.floor(p[1] * 60), Math.floor(p[2] * 60));
  return s > .985 ? C('#ffffff') : c;
 },
 tartan: ({u, v}) => {
  const band = (t, n) => { const f = (t * n) % 1; return f < .18 ? 2 : f < .42 ? 1 : f < .46 ? 3 : 0; };
  const cols = [C('#b5232b'), C('#1d3f2a'), C('#14244f'), C('#e8c44a')];
  const a = cols[band(u, 10)], b = cols[band(v, 5)];
  return mix(a, b, .5);
 },
 marble: ({p}) => {
  const t = p[0] * 3 + p[1] * 2 + fbm(p, 2.8, 4) * 6;
  const vein = Math.abs(Math.sin(t * 2.2));
  return mix(C('#6f7378'), C('#f3f1ec'), smooth(.02, .3, vein));
 },
 'diamond-plate': ({u, v}) => {
  const n = 16, a = (u * n * 2 + v * n) % 1, b = (u * n * 2 - v * n + 100) % 1;
  const bump = (a > .35 && a < .65 && b > .1 && b < .3) || (b > .35 && b < .65 && a > .6 && a < .8);
  return bump ? C('#e9edf0') : mix(C('#8e959b'), C('#b8bec3'), (u * 7 + v * 3) % 1 * .5);
 },
 gold: ({p}) => mix(C('#8a5a12'), C('#ffe08a'), clamp01(.55 + p[1] * .45 + (fbm(p, 3) - .5) * .3)),
 'black-pearl': ({p}) => {
  const n = fbm(p, 1.8), h = (n * 1.6 + p[1] * .3) % 1;
  const sheen = [C('#3a2a52'), C('#1c3a4a'), C('#3d4a2a'), C('#4a2a3a')][Math.floor(h * 4) % 4];
  return mix(C('#141418'), sheen, .55);
 },
 rainbow: ({u}) => { const hues = ['#ff4d4d', '#ffa64d', '#ffe74d', '#5ee05e', '#4dc3ff', '#7a6cff', '#d36cff'].map(C), x = u * hues.length, i = Math.floor(x) % hues.length; return mix(hues[i], hues[(i + 1) % hues.length], smooth(.7, 1, x - Math.floor(x))); },
};
export const FINISH_IDS = Object.keys(FINISH_RULES);

// How the surface takes the light: roughness (0 glassy, 1 chalky), how much of
// the dimple lattice shows, and `glow`, a little light of its own by day.
const SURFACE = {chrome: {rough: .12, dimple: .3}, gold: {rough: .22, dimple: .5}, 'black-pearl': {rough: .16}, 'diamond-plate': {rough: .3}, glow: {glow: .35}, galaxy: {rough: .28}};
export const finishSurface = id => ({rough: .35, dimple: 1, glow: 0, ...(SURFACE[id] || {})});

// The colour of finish `id` at the direction `p` (need not be unit length).
export function finishColour(id, p) {
 const l = Math.hypot(p[0], p[1], p[2]) || 1, q = [p[0] / l, p[1] / l, p[2] / l];
 const u = (Math.atan2(q[0], q[2]) / TAU + 1) % 1, v = Math.acos(Math.max(-1, Math.min(1, q[1]))) / Math.PI;
 const rule = FINISH_RULES[id] || FINISH_RULES.classic, s = finishSurface(id);
 const c = rule({p: q, u, v}), d = 1 - (1 - dimple(u, v)) * s.dimple;
 return [c[0] * d, c[1] * d, c[2] * d];
}

// THE TEXTURE: RGBA bytes, `w` by `h`, laid out the way three.js's sphere
// wraps one -- column `i` is the angle round from -x, row `j` runs from the
// bottom (three's uv.y = 0) to the top -- in sRGB, as a colour map is read.
export function finishTexels(id, w = 256, h = 128) {
 const out = new Uint8Array(w * h * 4);
 for (let j = 0; j < h; j++) {
  const theta = (1 - (j + .5) / h) * Math.PI, st = Math.sin(theta), y = Math.cos(theta);
  for (let i = 0; i < w; i++) {
   const phi = (i + .5) / w * TAU, c = finishColour(id, [-Math.cos(phi) * st, y, Math.sin(phi) * st]), k = (j * w + i) * 4;
   out[k] = Math.round(clamp01(c[0]) * 255); out[k + 1] = Math.round(clamp01(c[1]) * 255); out[k + 2] = Math.round(clamp01(c[2]) * 255); out[k + 3] = 255;
  }
 }
 return out;
}

// THE PICTURE: the ball seen face on, `size` pixels square, lit from the upper
// left, transparent round it, as RGBA bytes for an ImageData. `turn` spins it
// about its upright axis (0 to 1 is a full turn), for the close-up.
export function ballPixels(id, size, turn = 0) {
 const out = new Uint8ClampedArray(size * size * 4), r = size / 2 - .5, s = finishSurface(id);
 const L = [-.45, .6, .66], ll = Math.hypot(...L), light = L.map(x => x / ll);
 const shine = 1 - s.rough, spec = 4 + shine * 60, ca = Math.cos(turn * TAU), sa = Math.sin(turn * TAU);
 for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
  const x = (px + .5 - size / 2) / r, y = -(py + .5 - size / 2) / r, d2 = x * x + y * y, k = (py * size + px) * 4;
  if (d2 > 1.04) continue;
  const z = Math.sqrt(Math.max(0, 1 - d2));
  // Turned: the point on the ball under this pixel.
  const c = finishColour(id, [x * ca + z * sa, y, -x * sa + z * ca]);
  const lam = Math.max(0, x * light[0] + y * light[1] + z * light[2]);
  const hz = light[2] + 1, hl = Math.hypot(light[0], light[1], hz), ndh = Math.max(0, (x * light[0] + y * light[1] + z * hz) / hl);
  const sp = Math.pow(ndh, spec) * (.25 + shine * .75), shade = .32 + .68 * lam + s.glow * .3;
  const edge = clamp01((1 - Math.sqrt(d2)) * r + .5);
  out[k] = clamp01(c[0] * shade + sp) * 255; out[k + 1] = clamp01(c[1] * shade + sp) * 255; out[k + 2] = clamp01(c[2] * shade + sp) * 255;
  out[k + 3] = edge * 255;
 }
 return out;
}
// The finish's colour from a distance: its average over the ball, for anything
// that draws the ball as a dot.
export function finishAverage(id) {
 const t = finishTexels(id, 32, 16), a = [0, 0, 0];
 let n = 0;
 for (let j = 0; j < 16; j++) { const wgt = Math.sin((j + .5) / 16 * Math.PI); for (let i = 0; i < 32; i++) { const k = (j * 32 + i) * 4; for (let c = 0; c < 3; c++) a[c] += t[k + c] * wgt; n += wgt; } }
 return a.map(v => v / n / 255);
}
