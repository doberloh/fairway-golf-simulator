// THE TURF DETAIL ATLAS (the cartoon overhaul, 25 October 2026;
// docs/CARTOON_OVERHAUL.md *Ground textures*).
//
//   node tools/turf-detail.mjs            write src/turf-detail.js and a preview
//
// The ground's colour is all palette and procedure (ground.js): the biome's
// tints, mowing stripes, patches. What it lacked was the hand-made texture of
// a cartoon turf -- brush strokes in the rough, a fine nap on a fairway, grain
// in the sand, cracks in rock -- and a per-pixel hash ("grain") stood in for
// it, which reads as noise. This paints four tileable patterns, one per
// channel of one 512 x 512 image:
//
//   R  rough        clumps of tapering grass strokes leaning together
//   G  mown turf     a fine dense nap, for fairway, fringe, tee and green
//   B  grain         stipple of light and dark grains, for sand, hardpan, waste
//   A  stone         plates split by dark cracks, for rock, scree and coral
//
// Each is a MODULATION centred on 128: the shader multiplies the turf colour
// by 1 + (value - 0.5) x strength, so the palette, and the familiar look, are
// untouched -- only the hand changes. Seeded, so it rebuilds byte-identical.
// The PNG is inlined into the module, so the offline single file carries it.
// Also writes bench/shots/overhaul/rounds/turf-r<n>.png (the four channels as
// greyscale tiles, side by side) for review; pass `--round n`.
import {deflateSync} from 'node:zlib';
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 512;
const round = (() => { const i = process.argv.indexOf('--round'); return i < 0 ? null : process.argv[i + 1]; })();

// ------------------------------------------------------------- randomness
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ s; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const fade = t => t * t * (3 - 2 * t);
// Tileable value noise: lattice of `period` cells across the image.
function tileNoise(x, y, period, s) {
 const fx = x / S * period, fy = y / S * period, i = Math.floor(fx), j = Math.floor(fy), u = fade(fx - i), v = fade(fy - j);
 const h = (a, b) => hash(((a % period) + period) % period, ((b % period) + period) % period, s);
 return h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v;
}

// ------------------------------------------------------------- a canvas
// One float channel; values are added as signed modulation around 0.
class Channel {
 constructor() { this.v = new Float32Array(S * S); }
 add(x, y, a) { const i = ((Math.round(y) % S) + S) % S, j = ((Math.round(x) % S) + S) % S; this.v[i * S + j] += a; }
 // A tapering stroke from (x0,y0) to (x1,y1), width w0 at the root to w1 at
 // the tip, value `a`, soft-edged, wrapping across the tile's edges.
 stroke(x0, y0, x1, y1, w0, w1, a) {
  const minX = Math.floor(Math.min(x0, x1) - w0 - 1), maxX = Math.ceil(Math.max(x0, x1) + w0 + 1);
  const minY = Math.floor(Math.min(y0, y1) - w0 - 1), maxY = Math.ceil(Math.max(y0, y1) + w0 + 1);
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
   const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
   const px = x0 + dx * t, py = y0 + dy * t, d = Math.hypot(x - px, y - py), w = w0 + (w1 - w0) * t;
   const k = 1 - Math.max(0, Math.min(1, (d - w * .5) / .9));
   if (k > 0) this.add(x, y, a * k);
  }
 }
 dot(cx, cy, r, a) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
   const k = 1 - Math.max(0, Math.min(1, (Math.hypot(x - cx, y - cy) - r) / .8));
   if (k > 0) this.add(x, y, a * k);
  }
 }
 // To bytes: centred on 128, scaled so the spread fills about +-100.
 bytes(spread = 1) {
  let m = 0;
  for (const v of this.v) m += v;
  m /= this.v.length;
  let sd = 0;
  for (const v of this.v) sd += (v - m) ** 2;
  sd = Math.sqrt(sd / this.v.length) || 1;
  const out = new Uint8Array(S * S);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(128 + (this.v[i] - m) / sd * 38 * spread)));
  return out;
 }
}

// ------------------------------------------------------------- R: rough
// Clumps: each a root with 6-14 blades leaning one way together (a clump of
// grass bends as one), dark at the root and lighter toward the tip, laid
// over a base of soft blotches so the strokes sit in light and shade.
function rough() {
 const c = new Channel(), r = rng(11);
 for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.v[y * S + x] = (tileNoise(x, y, 8, 5) - .5) * 1.2 + (tileNoise(x, y, 23, 6) - .5) * .5;
 // Round 2: the dark root strokes were as strong as the blades and read as
 // dirt specks. Now the blade is the light stroke, long, and only its foot
 // carries a small dark touch; more clumps, so the strokes cover the ground.
 for (let k = 0; k < 1500; k++) {
  const cx = r() * S, cy = r() * S, lean = (r() - .5) * 1.2 - Math.PI / 2, n = 7 + Math.floor(r() * 9), tone = .7 + r() * .6;
  for (let b = 0; b < n; b++) {
   const a = lean + (r() - .5) * .8, len = 14 + r() * 22, ox = cx + (r() - .5) * 7, oy = cy + (r() - .5) * 4;
   const tx = ox + Math.cos(a) * len, ty = oy + Math.sin(a) * len;
   c.stroke(ox, oy, ox + Math.cos(a) * len * .25, oy + Math.sin(a) * len * .25, 3, 2.2, -.35);
   c.stroke(ox, oy, tx, ty, 2.6, .3, .42 * tone);
  }
 }
 return c.bytes(1);
}

// ------------------------------------------------------------- G: mown turf
// A fine nap: short strokes, dense, mostly one way with a little scatter --
// the grain a mower leaves -- and very little large-scale change, since the
// stripes and patches already do that.
function turf() {
 const c = new Channel(), r = rng(23);
 for (let k = 0; k < 26000; k++) {
  const x = r() * S, y = r() * S, a = -Math.PI / 2 + (r() - .5) * .8, len = 3 + r() * 5;
  c.stroke(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 1.4, .4, r() < .5 ? -.6 : .6);
 }
 for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.v[y * S + x] += (tileNoise(x, y, 16, 9) - .5) * .8;
 // Round 2: lower contrast; at full spread it read as static.
 return c.bytes(.6);
}

// ------------------------------------------------------------- B: grain
// Stipple: grains of every size, light and dark, a few pebbles, and a faint
// drift so it is not even.
function grain() {
 const c = new Channel(), r = rng(37);
 for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.v[y * S + x] = (tileNoise(x, y, 12, 13) - .5) * .9;
 for (let k = 0; k < 14000; k++) c.dot(r() * S, r() * S, .5 + r() * 1.3, r() < .55 ? -.8 : .8);
 for (let k = 0; k < 160; k++) { const x = r() * S, y = r() * S, rr = 2.5 + r() * 3.5; c.dot(x, y, rr, -.9); c.dot(x - rr * .3, y - rr * .3, rr * .55, 1.3); }
 return c.bytes(1);
}

// ------------------------------------------------------------- A: stone
// Plates: a tileable cellular field, each cell its own tone, split by dark
// cracks where two cells meet, with a few pits.
function stone() {
 const c = new Channel(), r = rng(53), cells = [];
 const N = 36;
 for (let k = 0; k < N; k++) cells.push({x: r() * S, y: r() * S, tone: r() - .5});
 for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  let d1 = Infinity, d2 = Infinity, t = 0;
  for (const p of cells) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
   const d = Math.hypot(x - p.x - ox, y - p.y - oy);
   if (d < d1) { d2 = d1; d1 = d; t = p.tone; } else if (d < d2) d2 = d;
  }
  const crack = 1 - Math.min(1, (d2 - d1) / 5);
  c.v[y * S + x] = t * .9 - crack * 1.6 + (tileNoise(x, y, 20, 17) - .5) * .5;
 }
 // (Round 1 had pits too; they read as rivets.)
 return c.bytes(1);
}

// ------------------------------------------------------------- PNG
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
 const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
 const td = Buffer.concat([Buffer.from(type, 'ascii'), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
 return Buffer.concat([len, td, crc]);
}
export function png(width, height, rgba, channels = 4) {
 const raw = Buffer.alloc((width * channels + 1) * height);
 for (let y = 0; y < height; y++) { raw[y * (width * channels + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * width * channels, width * channels).copy(raw, y * (width * channels + 1) + 1); }
 const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 0;
 return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

const R = rough(), G = turf(), B = grain(), A = stone();
const rgba = new Uint8Array(S * S * 4);
for (let i = 0; i < S * S; i++) { rgba[i * 4] = R[i]; rgba[i * 4 + 1] = G[i]; rgba[i * 4 + 2] = B[i]; rgba[i * 4 + 3] = A[i]; }
const file = png(S, S, rgba);
const out = `// GENERATED by tools/turf-detail.mjs -- do not edit by hand.
// The cartoon overhaul's turf detail atlas: four tileable patterns, one per
// channel (R rough strokes, G mown nap, B grain, A stone), each centred on 128.
// ground.js multiplies the turf colour by them. ${file.length} bytes of PNG.
export const TURF_DETAIL = 'data:image/png;base64,${file.toString('base64')}';
`;
writeFileSync(join(ROOT, 'src', 'turf-detail.js'), out);
console.log(`src/turf-detail.js: ${(file.length / 1024).toFixed(1)} KB of PNG`);
if (round) {
 // The four channels side by side, each tiled 2 x 2 so a seam would show.
 const W = S * 2 * 4, H = S * 2, grey = new Uint8Array(W * H);
 [R, G, B, A].forEach((ch, k) => { for (let y = 0; y < H; y++) for (let x = 0; x < S * 2; x++) grey[y * W + k * S * 2 + x] = ch[(y % S) * S + (x % S)]; });
 const dir = join(ROOT, 'bench', 'shots', 'overhaul', 'rounds');
 mkdirSync(dir, {recursive: true});
 writeFileSync(join(dir, `turf-r${round}.png`), png(W, H, grey, 1));
 console.log(`preview: bench/shots/overhaul/rounds/turf-r${round}.png`);
}
