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
// ZIP64 written (a part over 4 GB is refused -- a course is megabytes), no data
// descriptors on write; on read, a data descriptor is tolerated because the
// central directory carries the sizes. `readZipFile` reads a ZIP of any size
// (ZIP64 too) from its file a part at a time, for LIDAR downloads. Pure: no DOM, tested in Node
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

// The CRC carried on over another stretch of bytes (start with 0xFFFFFFFF;
// the finished value is `(c ^ 0xFFFFFFFF) >>> 0`).
function crcUpdate(c, bytes) {
 for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
 return c;
}
export function crc32(bytes) {
 return (crcUpdate(0xFFFFFFFF, bytes) ^ 0xFFFFFFFF) >>> 0;
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

// A ZIP WRITTEN A PART AT A TIME (22 November 2026): a kept USGS square
// (lidar-search.js) was written by `writeZip`, which copies every part into
// one array -- a second full copy of up to gigabytes beside the parts
// themselves -- and wraps past 4 GB. Here every part is stored as it is, read
// only when its turn comes (`read()`, or `data`), and handed on in pieces;
// past 4 GB the directory is ZIP64, which readZipFile reads. `entries`:
// [{name, size, data?: Uint8Array | string, read?: () => Promise<Uint8Array>}]
// -- every size known first, so the whole length is. Returns {size, chunks()},
// chunks an async iterator of Uint8Array. writeZip, whose bytes are a course
// file's identity, is unchanged.
// `far`: the offset past which the 8-byte records are used (4 GB; a test
// lowers it to try them without writing 4 GB).
export function zipStream(entries, {far: FAR = MAX32} = {}) {
 const names = entries.map(e => utf8.encode(e.name)), sizes = entries.map(e => typeof e.data === 'string' ? utf8.encode(e.data).length : e.data?.length ?? e.size);
 let at = 0; const offsets = entries.map((e, i) => { const o = at; at += 30 + names[i].length + sizes[i]; return o; });
 const dirAt = at, big = dirAt > FAR || entries.length > 0xFFFF;
 const cen = entries.map((e, i) => 46 + names[i].length + (offsets[i] > FAR ? 12 : 0)).reduce((s, n) => s + n, 0);
 const size = dirAt + cen + (big ? 56 + 20 : 0) + 22;
 async function* chunks() {
  const crcs = [];
  for (const [i, e] of entries.entries()) {
   const raw = typeof e.data === 'string' ? utf8.encode(e.data) : e.data ?? await e.read();
   if (raw.length !== sizes[i]) throw Error(`${e.name} is not the size it was listed at.`);
   const crc = crc32(raw); crcs.push(crc);
   const head = new DataView(new ArrayBuffer(30));
   head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(10, DOS_TIME, true); head.setUint16(12, DOS_DATE, true);
   head.setUint32(14, crc, true); head.setUint32(18, raw.length, true); head.setUint32(22, raw.length, true); head.setUint16(26, names[i].length, true);
   yield new Uint8Array(head.buffer); yield names[i]; yield raw;
  }
  for (const [i] of entries.entries()) {
   const far = offsets[i] > FAR, c = new DataView(new ArrayBuffer(46));
   c.setUint32(0, 0x02014b50, true); c.setUint16(4, far ? 45 : 20, true); c.setUint16(6, far ? 45 : 20, true); c.setUint16(8, 0x0800, true);
   c.setUint16(12, DOS_TIME, true); c.setUint16(14, DOS_DATE, true); c.setUint32(16, crcs[i], true); c.setUint32(20, sizes[i], true); c.setUint32(24, sizes[i], true);
   c.setUint16(28, names[i].length, true); c.setUint16(30, far ? 12 : 0, true); c.setUint32(42, far ? MAX32 : offsets[i], true);
   yield new Uint8Array(c.buffer); yield names[i];
   if (far) { const x = new DataView(new ArrayBuffer(12)); x.setUint16(0, 1, true); x.setUint16(2, 8, true); x.setBigUint64(4, BigInt(offsets[i]), true); yield new Uint8Array(x.buffer); }
  }
  const n = entries.length;
  if (big) {
   const r = new DataView(new ArrayBuffer(56));
   r.setUint32(0, 0x06064b50, true); r.setBigUint64(4, 44n, true); r.setUint16(12, 45, true); r.setUint16(14, 45, true);
   r.setBigUint64(24, BigInt(n), true); r.setBigUint64(32, BigInt(n), true); r.setBigUint64(40, BigInt(cen), true); r.setBigUint64(48, BigInt(dirAt), true);
   const l = new DataView(new ArrayBuffer(20)); l.setUint32(0, 0x07064b50, true); l.setBigUint64(8, BigInt(dirAt + cen), true); l.setUint32(16, 1, true);
   yield new Uint8Array(r.buffer); yield new Uint8Array(l.buffer);
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Math.min(n, 0xFFFF), true); end.setUint16(10, Math.min(n, 0xFFFF), true);
  end.setUint32(12, big ? MAX32 : cen, true); end.setUint32(16, big ? MAX32 : dirAt, true);
  yield new Uint8Array(end.buffer);
 }
 return {size, chunks};
}
// A streamed ZIP gathered into one array (small ones, and tests).
export async function zipBytes(z) { const out = new Uint8Array(z.size); let at = 0; for await (const c of z.chunks()) { out.set(c, at); at += c.length; } if (at !== z.size) throw Error('The ZIP came out a different size from its listing.'); return out; }

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

// A ZIP READ FROM ITS FILE, A PART AT A TIME (the owner, 21 November 2026: a
// state portal's 6.2 GB LIDAR download could not be opened in the builder --
// `readZip` wants the whole ZIP in memory, and a browser will not hand over a
// file that size in one piece, so it failed with NotReadableError and nothing
// on screen). The directory is read from the file's end, ZIP64's sizes and
// offsets followed (a ZIP or a part over 4 GB), and each part is lifted out
// of the file only when asked: a stored part is the file's own slice, nothing
// copied; a deflated one is unpacked as it streams, its CRC and length
// checked on the way. A stored part's CRC is not checked (that would read it
// twice; whatever reads it next checks its own format). Returns [{name, size
// (unpacked), blob(): Promise<Blob>}], folders left out. `file`: a File or
// Blob, read only through `slice`.
const MAX32 = 0xFFFFFFFF;
const u64 = (v, at) => v.getUint32(at, true) + v.getUint32(at + 4, true) * 2 ** 32;
export async function readZipFile(file, {only = null} = {}) {
 const bytesOf = async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
 const tailLen = Math.min(file.size, 22 + 65535 + 20), tail = await bytesOf(file.size - tailLen, file.size), tv = new DataView(tail.buffer);
 let e = -1;
 for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { e = i; break; }
 if (e < 0) throw Error('This file is damaged, or not a ZIP: it has no ZIP directory.');
 let count = tv.getUint16(e + 10, true), cenSize = tv.getUint32(e + 12, true), cenAt = tv.getUint32(e + 16, true);
 if (cenAt === MAX32 || cenSize === MAX32 || count === 0xFFFF) {
  if (e < 20 || tv.getUint32(e - 20, true) !== 0x07064b50) throw Error('This file is damaged: its large-ZIP directory is missing.');
  const recAt = u64(tv, e - 20 + 8), rec = await bytesOf(recAt, recAt + 56), rv = new DataView(rec.buffer);
  if (rec.length < 56 || rv.getUint32(0, true) !== 0x06064b50) throw Error('This file is damaged: its large-ZIP directory is broken.');
  count = u64(rv, 32); cenSize = u64(rv, 40); cenAt = u64(rv, 48);
 }
 if (cenAt + cenSize > file.size || cenSize > 256e6) throw Error('This file is damaged or cut short: its ZIP directory does not fit it.');
 const cen = await bytesOf(cenAt, cenAt + cenSize), v = new DataView(cen.buffer), dec = new TextDecoder(), out = [];
 let p = 0;
 for (let k = 0; k < count; k++) {
  if (p + 46 > cen.length || v.getUint32(p, true) !== 0x02014b50) throw Error('This file is damaged: its ZIP directory is broken.');
  const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true);
  let size = v.getUint32(p + 20, true), raw = v.getUint32(p + 24, true), local = v.getUint32(p + 42, true);
  const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
  const name = dec.decode(cen.subarray(p + 46, p + 46 + nameLen));
  // ZIP64: the 8-byte figures, for those the record marks as too large, in the format's order.
  for (let x = p + 46 + nameLen; x + 4 <= p + 46 + nameLen + extraLen;) {
   const id = v.getUint16(x, true), len = v.getUint16(x + 2, true);
   if (id === 1) { let q = x + 4; if (raw === MAX32) { raw = u64(v, q); q += 8; } if (size === MAX32) { size = u64(v, q); q += 8; } if (local === MAX32) local = u64(v, q); }
   x += 4 + len;
  }
  p += 46 + nameLen + extraLen + commentLen;
  if (name.endsWith('/') || (only && !only(name))) continue;
  const entry = {name, method, crc, size, raw, local};
  out.push({name, size: raw, blob: () => zipPart(file, entry, bytesOf)});
 }
 return out;
}
async function zipPart(file, e, bytesOf) {
 const head = await bytesOf(e.local, e.local + 30), hv = new DataView(head.buffer);
 if (head.length < 30 || hv.getUint32(0, true) !== 0x04034b50) throw Error(`This file is damaged: ${e.name} cannot be found.`);
 const start = e.local + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
 if (start + e.size > file.size) throw Error(`This file is damaged: ${e.name} is cut short.`);
 const body = file.slice(start, start + e.size);
 if (e.method === 0) return body;
 if (e.method !== 8) throw Error(`This ZIP packs ${e.name} in a way Fairway cannot read: unpack it first, then choose the files inside.`);
 let c = 0xFFFFFFFF, n = 0;
 const check = new TransformStream({transform(chunk, out) { c = crcUpdate(c, chunk); n += chunk.length; out.enqueue(chunk); }});
 let blob;
 try { blob = await new Response(body.stream().pipeThrough(new DecompressionStream('deflate-raw')).pipeThrough(check)).blob(); }
 catch { throw Error(`This file is damaged: ${e.name} cannot be unpacked.`); }
 if (n !== e.raw || ((c ^ 0xFFFFFFFF) >>> 0) !== e.crc) throw Error(`This file is damaged: ${e.name} does not check out.`);
 return blob;
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
