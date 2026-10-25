// A course's surfaces seen from above, 2 m a pixel, on the CPU (no graphics
// card): node tools/surface-map.mjs <seed> <holes> <out.png> [biome] [--trees]
// Tees are white dots, greens red; ground types take their map colour from
// grounds.js. Made for the shared links fairways (RESEARCH, *Shared links
// fairways*): the routing is easier to judge from above than in the game.
import {generateWorld} from '../src/course.js';
import {GROUNDS} from '../src/grounds.js';
import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const [seed = 'overhaul', n = '18', out = 'map.png', biome = 'links'] = process.argv.slice(2);
const w = generateWorld({seed, biome, holes: +n, trees: 60, homes: true});
const res = 2, W = Math.ceil(2 * w.halfX / res), H = Math.ceil(2 * w.halfZ / res);
const col = {fairway: [80, 170, 70], green: [60, 210, 90], fringe: [70, 190, 80], tee: [90, 200, 120], rough: [40, 110, 45], semiRough: [55, 140, 55], semirough: [55, 140, 55], bunker: [230, 210, 150], sand: [230, 210, 150], water: [40, 90, 200], path: [150, 140, 120]};
const px = Buffer.alloc((W * 3 + 1) * H);
for (let j = 0; j < H; j++) {
 px[j * (W * 3 + 1)] = 0;
 for (let i = 0; i < W; i++) {
  const x = -w.halfX + i * res, z = -w.halfZ + j * res, s = w.surface(x, z);
  const hex = GROUNDS[s]?.map, c = col[s] || (hex ? [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16)) : [120, 100, 80]);
  px.set(c, j * (W * 3 + 1) + 1 + i * 3);
 }
}
// Trees as their crowns: the open scatter dark green, a stand's (stands.js)
// near black, ground plants olive.
const disc = (p, rad, c) => { const ci = Math.round((p.x + w.halfX) / res), cj = Math.round((p.z + w.halfZ) / res), k = Math.max(0, Math.round(rad / res)); for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { if (a * a + b * b > k * k) continue; const ii = ci + a, jj = cj + b; if (ii >= 0 && ii < W && jj >= 0 && jj < H) px.set(c, jj * (W * 3 + 1) + 1 + ii * 3); } };
if (process.argv.includes('--trees')) for (const t of w.trees) disc(t, t.r * .8, t.h < 3.2 ? [120, 120, 40] : t.stand ? [15, 45, 20] : [25, 80, 30]);
// hole numbers: dots at tees (white) and greens (red)
const dot = (p, c) => { const ci = Math.round((p.x + w.halfX) / res), cj = Math.round((p.z + w.halfZ) / res); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const ii = ci + a, jj = cj + b; if (ii >= 0 && ii < W && jj >= 0 && jj < H) px.set(c, jj * (W * 3 + 1) + 1 + ii * 3); } };
for (const h of w.holes) { dot(h.worldTee, [255, 255, 255]); dot(h.worldGreen, [255, 0, 0]); }
const crcT = new Uint32Array(256).map((_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, W, H, 'shared', w.holes.map((h, i) => h.sharedFairway ? i + 1 : null).filter(Boolean).join(','));
