// How different two screenshots are, with no image library: a PNG decoder for
// what Chrome writes (8-bit RGB or RGBA, not interlaced) and a changed-pixel
// count. Used by tools/frame-ab.mjs to show that a speed-up left the picture
// alone -- judged against the NOISE FLOOR, two shots of the same build, since
// wind, water and clouds keep moving between any two frames.
import zlib from 'node:zlib';
import fs from 'node:fs';

export function decodePng(buf) {
 if (buf.readUInt32BE(0) !== 0x89504e47) throw Error('not a PNG');
 let p = 8, width = 0, height = 0, depth = 0, type = 0;
 const idat = [];
 while (p < buf.length) {
  const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8);
  const data = buf.subarray(p + 8, p + 8 + len);
  if (kind === 'IHDR') {
   width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9];
   if (data[12]) throw Error('interlaced PNG not supported');
  } else if (kind === 'IDAT') idat.push(data);
  else if (kind === 'IEND') break;
  p += 12 + len;
 }
 if (depth !== 8 || (type !== 2 && type !== 6)) throw Error(`PNG type ${type}/${depth} not supported`);
 const bpp = type === 6 ? 4 : 3, stride = width * bpp;
 const raw = zlib.inflateSync(Buffer.concat(idat));
 const out = new Uint8Array(width * height * 4);
 let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
 for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let i = 0; i < stride; i++) {
   const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
   let v = row[i];
   if (f === 1) v += a;
   else if (f === 2) v += b;
   else if (f === 3) v += (a + b) >> 1;
   else if (f === 4) {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
    v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
   }
   cur[i] = v & 255;
  }
  for (let x = 0; x < width; x++) {
   const o = (y * width + x) * 4;
   out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2];
   out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
  }
  [prev, cur] = [cur, prev];
 }
 return {width, height, data: out};
}

// A picture of WHERE two screenshots differ: the first, darkened, with every
// changed pixel in red -- brighter for a larger change. Written as a plain PNG
// (filter 0, one IDAT), so it needs nothing either.
export function writeDiffPng(a, b, out, threshold = 24) {
 const A = decodePng(fs.readFileSync(a)), B = decodePng(fs.readFileSync(b)), {width, height} = A;
 const raw = Buffer.alloc((width * 3 + 1) * height);
 for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4, o = y * (width * 3 + 1) + 1 + x * 3;
  const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
  const grey = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 9;
  if (d > threshold) { raw[o] = Math.min(255, 120 + d); raw[o + 1] = raw[o + 2] = 0; } else raw[o] = raw[o + 1] = raw[o + 2] = grey;
 }
 const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
 const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
 const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
 const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
 fs.writeFileSync(out, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// Pixels whose summed RGB difference exceeds `threshold` (24, as RESEARCH.md's
// cull comparison of 27 September used), and the mean difference per pixel.
export function diffPng(a, b, threshold = 24) {
 const A = decodePng(Buffer.isBuffer(a) ? a : fs.readFileSync(a));
 const B = decodePng(Buffer.isBuffer(b) ? b : fs.readFileSync(b));
 if (A.width !== B.width || A.height !== B.height) throw Error('screenshots differ in size');
 let changed = 0, sum = 0;
 for (let i = 0; i < A.data.length; i += 4) {
  const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
  sum += d;
  if (d > threshold) changed++;
 }
 const n = A.width * A.height;
 return {changed, share: changed / n, mean: sum / n / 3};
}
