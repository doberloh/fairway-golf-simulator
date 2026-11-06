// A ZIP FILE, WRITTEN AND READ BY HAND (the course builder, stage 0;
// docs/COURSE_BUILDER.md, *Course files*).
//
// A built course is a `.fairway` file holding several parts -- the course's
// JSON, its land as a height grid, its trees -- and some are megabytes of
// numbers, so the file is a ZIP: one container, each part compressed, readable
// by any unzip tool when somebody wants to look inside. No dependency, the way
// pdf.js writes PDFs by hand: the browser's own CompressionStream does the
// deflating ('deflate-raw' is exactly a ZIP entry's method 8), and the rest is
// a few fixed headers and a CRC.
//
// What it handles: stored (0) and deflated (8) entries, no encryption, no
// ZIP64 (a part over 4 GB is refused -- a course is megabytes), no data
// descriptors on write; on read, a data descriptor is tolerated because the
// central directory carries the sizes. Pure: no DOM, tested in Node
// (tests/zip.test.mjs).

const CRC_TABLE = (() => {
 const t = new Uint32Array(256);
 for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  t[n] = c >>> 0;
 }
 return t;
})();

export function crc32(bytes) {
 let c = 0xFFFFFFFF;
 for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
 return (c ^ 0xFFFFFFFF) >>> 0;
}

async function through(bytes, stream) {
 const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
 return new Uint8Array(await out.arrayBuffer());
}
export const deflateRaw = bytes => through(bytes, new CompressionStream('deflate-raw'));
export const inflateRaw = bytes => through(bytes, new DecompressionStream('deflate-raw'));

const utf8 = new TextEncoder();
// A fixed date (1 January 2026) so the same course always makes the same
// bytes: a built course's identity is its file's hash (a friend's challenge,
// the cache key), and a timestamp would change it on every save.
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

// `entries`: [{name, data: Uint8Array | string, store?: true}]. Returns the
// ZIP's bytes. A part that does not shrink when deflated is stored.
export async function writeZip(entries) {
 const locals = [], centrals = [];
 let offset = 0;
 for (const e of entries) {
  const name = utf8.encode(e.name);
  const raw = typeof e.data === 'string' ? utf8.encode(e.data) : e.data;
  if (raw.length > 0xFFFFFFF0) throw Error(`${e.name} is too large for a course file.`);
  const crc = crc32(raw);
  let method = 0, body = raw;
  if (!e.store && raw.length > 64) {
   const packed = await deflateRaw(raw);
   if (packed.length < raw.length) { method = 8; body = packed; }
  }
  const head = new DataView(new ArrayBuffer(30));
  head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
  head.setUint16(8, method, true); head.setUint16(10, DOS_TIME, true); head.setUint16(12, DOS_DATE, true);
  head.setUint32(14, crc, true); head.setUint32(18, body.length, true); head.setUint32(22, raw.length, true);
  head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
  cen.setUint16(10, method, true); cen.setUint16(12, DOS_TIME, true); cen.setUint16(14, DOS_DATE, true);
  cen.setUint32(16, crc, true); cen.setUint32(20, body.length, true); cen.setUint32(24, raw.length, true);
  cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
  locals.push(new Uint8Array(head.buffer), name, body);
  centrals.push(new Uint8Array(cen.buffer), name);
  offset += 30 + name.length + body.length;
 }
 const cenSize = centrals.reduce((s, b) => s + b.length, 0);
 const end = new DataView(new ArrayBuffer(22));
 end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
 end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
 const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
 const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
 let at = 0;
 for (const p of parts) { out.set(p, at); at += p.length; }
 return out;
}

export const isZip = bytes => bytes?.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;

// A ZIP's parts: Map of name -> Uint8Array. Refused in plain words when it is
// damaged, uses a method other than stored or deflated, or fails its CRC.
// `only`: a test of a part's name; a part it turns down is not unpacked, so a
// course file's builder section costs the game nothing but the file's length.
export async function readZip(bytes, {only = null} = {}) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 let e = -1;
 for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
 if (e < 0) throw Error('This file is damaged: it has no ZIP directory.');
 const count = v.getUint16(e + 10, true);
 let p = v.getUint32(e + 16, true);
 const out = new Map(), dec = new TextDecoder();
 for (let k = 0; k < count; k++) {
  if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw Error('This file is damaged: its ZIP directory is broken.');
  const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), size = v.getUint32(p + 20, true), rawSize = v.getUint32(p + 24, true);
  const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
  const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
  p += 46 + nameLen + extraLen + commentLen;
  if (only && !only(name)) continue;
  if (v.getUint32(local, true) !== 0x04034b50) throw Error(`This file is damaged: ${name} cannot be found.`);
  const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
  const body = bytes.subarray(start, start + size);
  if (body.length !== size) throw Error(`This file is damaged: ${name} is cut short.`);
  let raw;
  if (method === 0) raw = body.slice();
  else if (method === 8) {
   try { raw = await inflateRaw(body); } catch { throw Error(`This file is damaged: ${name} cannot be unpacked.`); }
  }
  else throw Error(`This file uses a kind of compression Fairway cannot read (${name}).`);
  if (raw.length !== rawSize || crc32(raw) !== crc) throw Error(`This file is damaged: ${name} does not check out.`);
  out.set(name, raw);
 }
 return out;
}

// The same ZIP without the part `name`, its other parts copied as they are.
// The bytes themselves when it has no such part. A part written last leaves
// exactly the bytes a ZIP without it would have been, so a built course's hash
// does not depend on it (a course's identity is its file's hash).
export function zipWithout(bytes, name) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
 let e = -1;
 for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
 if (e < 0) throw Error('This file is damaged: it has no ZIP directory.');
 const count = v.getUint16(e + 10, true), kept = [];
 let p = v.getUint32(e + 16, true), dropped = false;
 for (let k = 0; k < count; k++) {
  if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw Error('This file is damaged: its ZIP directory is broken.');
  const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true), size = 46 + nameLen + extraLen + commentLen;
  const own = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)), local = v.getUint32(p + 42, true);
  if (own === name) dropped = true;
  else kept.push({central: bytes.subarray(p, p + size), local, length: 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true) + v.getUint32(p + 20, true)});
  p += size;
 }
 if (!dropped) return bytes;
 const bodies = kept.reduce((s, q) => s + q.length, 0), cenSize = kept.reduce((s, q) => s + q.central.length, 0);
 const out = new Uint8Array(bodies + cenSize + 22), w = new DataView(out.buffer);
 let at = 0, cen = bodies;
 for (const q of kept) {
  out.set(bytes.subarray(q.local, q.local + q.length), at);
  out.set(q.central, cen); w.setUint32(cen + 42, at, true);
  at += q.length; cen += q.central.length;
 }
 w.setUint32(cen, 0x06054b50, true); w.setUint16(cen + 8, kept.length, true); w.setUint16(cen + 10, kept.length, true);
 w.setUint32(cen + 12, cenSize, true); w.setUint32(cen + 16, bodies, true);
 return out;
}
