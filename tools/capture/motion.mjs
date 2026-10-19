// HOW SMOOTHLY A CLIP'S CAMERA MOVES, measured from the frames themselves
// (19 October 2026; it found the shake in every website flyover -- docs/
// CAPTURE.md *Traps*). For each frame, the shift (dx, dy, in pixels at 480
// wide) that best lines it up with the one before, by block matching on a grey
// copy of a band of the picture; the jitter is how far each frame's shift sits
// from the average of the nine around it. A smooth camera gives a smooth
// series; a stop-start one gives a series that zig-zags.
//   node tools/capture/motion.mjs <video.webm> [band] [--frames] [--worst]
// `band` is the rows to measure, at 270 tall: the default 40-230 is most of
// the picture; a band on the distant horizon (for example 74-130) sees only the
// camera turning, since wind cannot move it. `--frames` prints frames 60-120.
//
// CPU only, no graphics card: the WebM's frames are read here in Node and
// decoded one by one with WebCodecs in software (seeking a <video> returned
// the same frame every time). WebCodecs needs a secure page, so a blank file
// page is written beside the video and removed afterwards.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--') && !/^\d+-\d+$/.test(a));
const [Y0, Y1] = (args.find(a => /^\d+-\d+$/.test(a)) || '40-230').split('-').map(Number);
if (!file) throw Error('usage: node tools/capture/motion.mjs <video.webm> [band] [--frames]');
const buf = fs.readFileSync(file);

// The frames, by a minimal walk of the WebM: Segment > Cluster > SimpleBlock.
const vint = (p, keepMarker) => { const f = buf[p]; let len = 1; while (len <= 8 && !(f & (0x80 >> (len - 1)))) len++;
 let v = keepMarker ? f : f & (0xff >> len); for (let i = 1; i < len; i++) v = v * 256 + buf[p + i]; return {len, v}; };
const frames = [];
const walk = (start, end) => { let p = start; while (p < end) {
 const id = vint(p, true), size = vint(p + id.len), body = p + id.len + size.len, stop = body + size.v;
 if (id.v === 0x18538067 || id.v === 0x1F43B675) walk(body, Math.min(stop, end));
 else if (id.v === 0xA3) { const tn = vint(body), flags = buf[body + tn.len + 2]; frames.push({key: !!(flags & 0x80), data: buf.subarray(body + tn.len + 3, stop).toString('base64')}); }
 p = stop; } };
walk(0, buf.length);
const codec = buf.includes(Buffer.from('V_AV1')) ? 'av01.0.08M.08' : 'vp09.00.40.08';

const blank = path.join(path.dirname(path.resolve(file)), '.motion.html');
fs.writeFileSync(blank, '<!doctype html><title>motion</title>');
const b = await chromium.launch();
let rows;
try {
 const p = await b.newPage();
 await p.goto(pathToFileURL(blank).href);
 await p.evaluate(([y0, y1, codec]) => {
  const W = 480, H = 270, c = new OffscreenCanvas(W, H), g = c.getContext('2d', {willReadFrequently: true});
  window.__rows = []; let prev = null, n = 0;
  const measure = cur => {
   const S = 6, x0 = 60, x1 = W - 60, cost = {};
   let best = [0, 0, Infinity];
   for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
    let s = 0; for (let y = Math.max(y0, S); y < Math.min(y1, H - S); y += 2) for (let x = x0; x < x1; x += 2) s += Math.abs(cur[y * W + x] - prev[(y + dy) * W + x + dx]);
    cost[dx + ',' + dy] = s; if (s < best[2]) best = [dx, dy, s];
   }
   // A parabola through the neighbours gives the shift to a fraction of a pixel.
   const sub = (a, m, z) => { const d = a - 2 * m + z; return d > 0 ? (a - z) / (2 * d) : 0; };
   const [bx, by] = best, C = (x, y) => cost[x + ',' + y] ?? best[2];
   return [bx + sub(C(bx - 1, by), best[2], C(bx + 1, by)), by + sub(C(bx, by - 1), best[2], C(bx, by + 1))];
  };
  window.__dec = new VideoDecoder({output: f => {
   g.drawImage(f, 0, 0, W, H); f.close();
   const d = g.getImageData(0, 0, W, H).data, cur = new Float32Array(W * H);
   for (let i = 0; i < W * H; i++) cur[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
   if (prev) window.__rows.push([n, ...measure(cur)]);
   prev = cur; n++;
  }, error: e => { window.__err = e.message; }});
  window.__dec.configure({codec, hardwareAcceleration: 'prefer-software'});
 }, [Y0, Y1, codec]);
 // No flush until the end: a flush makes the decoder want a key frame next.
 for (const [i, f] of frames.entries()) {
  await p.evaluate(([f, i]) => { const u = Uint8Array.from(atob(f.data), c => c.charCodeAt(0));
   window.__dec.decode(new EncodedVideoChunk({type: f.key ? 'key' : 'delta', timestamp: i * 16667, data: u})); }, [f, i]);
  await p.evaluate(async () => { while (window.__dec.decodeQueueSize > 4) await new Promise(r => setTimeout(r, 5)); });
 }
 const out = await p.evaluate(async () => { await window.__dec.flush(); return {rows: window.__rows, err: window.__err}; });
 if (out.err) throw Error(out.err);
 rows = out.rows;
} finally { await b.close(); fs.rmSync(blank, {force: true}); }

const avg = (k, i) => { let s = 0, m = 0; for (let j = Math.max(0, i - 4); j <= Math.min(rows.length - 1, i + 4); j++) { s += rows[j][k]; m++; } return s / m; };
let jx = 0, jy = 0;
const res = rows.map((r, i) => { const ex = r[1] - avg(1, i), ey = r[2] - avg(2, i); jx += ex * ex; jy += ey * ey; return [r[0], r[1], r[2], ex, ey]; });
console.log(`${path.basename(file)} (rows ${Y0}-${Y1}): ${frames.length} frames; jitter x ${Math.sqrt(jx / rows.length).toFixed(3)}, y ${Math.sqrt(jy / rows.length).toFixed(3)} px at 480 wide`);
// `--worst`: the twelve frames that jump most, to tell a camera that shakes all
// through from a few single jumps (a tree popping in, a cut in the picture).
if (args.includes('--worst')) {
 console.log('worst frames (frame: jitter x, y):', [...res].sort((a, b) => Math.hypot(b[3], b[4]) - Math.hypot(a[3], a[4])).slice(0, 12)
  .map(r => `${r[0]}: ${r[3].toFixed(2)}, ${r[4].toFixed(2)}`).join('  '));
}
if (args.includes('--frames')) {
 console.log('frame    dx     dy  | jitter x     y');
 for (const r of res.slice(60, 120)) console.log(r.map((v, k) => k ? v.toFixed(2).padStart(6) : String(v).padStart(4)).join(' '));
}
