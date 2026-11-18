// A TOUR AS ONE FILE (the fairway-tour goal, 17 November 2026; SPEC section
// 7). A `.fairway-tour` is a ZIP: `tour.json` (the tour, never the person's
// progress or results, Q6), `courses/<hash>.fairway` for every built course
// it plays, byte for byte as the built store keeps them, and a `README.txt`.
//
// NO SIZE LIMIT OF ITS OWN (the owner, decision 69): it must carry at least
// a full season of 50 built events at the game's built-course limit (64 MB),
// about 3.2 GB. So it is written a piece at a time into a Blob -- never the
// whole file in one buffer -- with ZIP64 records past 4 GB or 65,535 entries,
// and read a piece at a time from a File, an entry sliced as it is needed.
// zip.js, which writes course files, is left as it is: a built course's
// identity is its file's bytes.
//
// Every entry is stored, not deflated: a course file is already a ZIP of
// packed parts, and tour.json is small. Someone else's file is untrusted:
// only the names a tour file holds are read, every size is checked against
// the directory before reading, every built course's hash must match its
// bytes, and each is parsed by course-doc.js's own reader. Pure but for the
// Blob and crypto the browser and Node both have.
import {crc32} from './zip.js';
import {readTour, TOUR_KIND, TOUR_VERSION} from './tour.js';
import {rosterGolfer} from './ai/roster.js';

export const FILE_EXT = '.fairway-tour';
export const MAX_COURSE = 64e6; // course-doc.js MAX_PLAYABLE: the game's own limit for a built course
const BUILT_NAME = /^courses\/([0-9a-f]{24})\.fairway$/;
const utf8 = new TextEncoder(), dec = new TextDecoder();
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const BIG = 0xFFFFFFFF;

// WHAT TRAVELS: the tour's calendar, defaults, members and their roster
// records (so a friend on a later version gets the same rivals), not the
// season played.
export function sharedTour(tour) {
 return {kind: TOUR_KIND, v: TOUR_VERSION, id: tour.id, name: tour.name, year: tour.year, seed: tour.seed, defaults: tour.defaults, members: tour.members,
  events: tour.events.map(e => ({...e})), roster: tour.members.map(id => rosterGolfer(id)).filter(Boolean)};
}
export const builtHashes = tour => [...new Set(tour.events.map(e => e.course?.built).filter(Boolean))];

const README = name => `This is a Fairway tour: "${name}".\r\nOpen Fairway, choose Fairway Tour on the main menu, then Open a tour file, and pick this file.\r\nIt holds the tour's calendar and every built course it plays. Your own results are not in it.\r\n`;

// THE FILE, as a Blob. `builtBytes(hash)` gives a built course's bytes (the
// built store); each is turned into its own Blob at once, so only one course
// is held in memory at a time.
// `zip64At` (tests only) is the size or offset past which the ZIP64 records
// are written: 4 GB in a real file, a few bytes in a test that cannot hold
// four gigabytes.
export async function writeTourFile(tour, {builtBytes, onProgress = null, zip64At = BIG} = {}) {
 const parts = [], central = [];
 let offset = 0, count = 0;
 const lim = zip64At;
 const add = (name, data) => {
  const n = utf8.encode(name), size = data.length, crc = crc32(data), z64 = size >= lim || offset >= lim;
  const extra = z64 ? zip64Extra({size, offset: null}) : new Uint8Array(0);
  const head = new DataView(new ArrayBuffer(30));
  head.setUint32(0, 0x04034b50, true); head.setUint16(4, z64 ? 45 : 20, true); head.setUint16(6, 0x0800, true);
  head.setUint16(8, 0, true); head.setUint16(12, DOS_DATE, true); head.setUint32(14, crc, true);
  head.setUint32(18, z64 ? BIG : size, true); head.setUint32(22, z64 ? BIG : size, true); head.setUint16(26, n.length, true); head.setUint16(28, extra.length, true);
  // (A local header's ZIP64 extra carries the two sizes only.)
  parts.push(new Blob([head.buffer, n, extra, data]));
  const cz64 = size >= lim || offset >= lim, cextra = cz64 ? zip64Extra({size, offset: offset >= lim ? offset : null}) : new Uint8Array(0);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 45, true); cen.setUint16(6, cz64 ? 45 : 20, true); cen.setUint16(8, 0x0800, true);
  cen.setUint16(14, DOS_DATE, true); cen.setUint32(16, crc, true); cen.setUint32(20, cz64 ? BIG : size, true); cen.setUint32(24, cz64 ? BIG : size, true);
  cen.setUint16(28, n.length, true); cen.setUint16(30, cextra.length, true); cen.setUint32(42, offset >= lim ? BIG : offset, true);
  central.push(new Uint8Array(cen.buffer), n, cextra);
  offset += 30 + n.length + extra.length + size; count++;
 };
 add('README.txt', utf8.encode(README(tour.name)));
 add('tour.json', utf8.encode(JSON.stringify(sharedTour(tour))));
 const hashes = builtHashes(tour);
 for (let i = 0; i < hashes.length; i++) {
  const bytes = await builtBytes(hashes[i]);
  if (!bytes) throw Error(`A built course this tour plays is not on this device (${hashes[i]}). Open it in Fairway first, then share the tour.`);
  add(`courses/${hashes[i]}.fairway`, bytes);
  onProgress?.((i + 1) / hashes.length);
 }
 const cenSize = central.reduce((s, b) => s + b.length, 0), z64 = offset >= lim || count > 0xFFFE || cenSize >= lim;
 const tail = [];
 if (z64) {
  // ZIP64 end of central directory record and its locator.
  const r = new DataView(new ArrayBuffer(56));
  r.setUint32(0, 0x06064b50, true); setU64(r, 4, 44); r.setUint16(12, 45, true); r.setUint16(14, 45, true);
  setU64(r, 24, count); setU64(r, 32, count); setU64(r, 40, cenSize); setU64(r, 48, offset);
  const l = new DataView(new ArrayBuffer(20));
  l.setUint32(0, 0x07064b50, true); setU64(l, 8, offset + cenSize); l.setUint32(16, 1, true);
  tail.push(r.buffer, l.buffer);
 }
 const end = new DataView(new ArrayBuffer(22));
 end.setUint32(0, 0x06054b50, true); end.setUint16(8, Math.min(count, 0xFFFF), true); end.setUint16(10, Math.min(count, 0xFFFF), true);
 end.setUint32(12, Math.min(cenSize, BIG), true); end.setUint32(16, z64 ? BIG : offset, true);
 return new Blob([...parts, ...central, ...tail, end.buffer], {type: 'application/zip'});
}
function setU64(v, at, n) { v.setUint32(at, n % 2 ** 32, true); v.setUint32(at + 4, Math.floor(n / 2 ** 32), true); }
const getU64 = (v, at) => v.getUint32(at, true) + v.getUint32(at + 4, true) * 2 ** 32;
function zip64Extra({size, offset}) {
 const n = 16 + (offset != null ? 8 : 0), v = new DataView(new ArrayBuffer(4 + n));
 v.setUint16(0, 1, true); v.setUint16(2, n, true); setU64(v, 4, size); setU64(v, 12, size);
 if (offset != null) setU64(v, 20, offset);
 return new Uint8Array(v.buffer);
}

// THE FILE'S DIRECTORY, read from its end: [{name, size, offset, crc}].
// Refused in plain words when it is not a ZIP or is damaged.
async function directory(blob) {
 const bytesOf = async (a, b) => new Uint8Array(await blob.slice(a, b).arrayBuffer());
 const tailLen = Math.min(blob.size, 22 + 65535 + 20), tail = await bytesOf(blob.size - tailLen, blob.size), tv = new DataView(tail.buffer);
 let e = -1;
 for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { e = i; break; }
 if (e < 0) throw Error('This is not a Fairway tour file: it has no ZIP directory.');
 let count = tv.getUint16(e + 10, true), cenSize = tv.getUint32(e + 12, true), cenAt = tv.getUint32(e + 16, true);
 if (cenAt === BIG || count === 0xFFFF) {
  if (e < 20 || tv.getUint32(e - 20, true) !== 0x07064b50) throw Error('This tour file is damaged: its large-file directory is missing.');
  const recAt = getU64(tv, e - 20 + 8), rec = await bytesOf(recAt, recAt + 56), rv = new DataView(rec.buffer);
  if (rv.getUint32(0, true) !== 0x06064b50) throw Error('This tour file is damaged: its large-file directory is broken.');
  count = getU64(rv, 32); cenSize = getU64(rv, 40); cenAt = getU64(rv, 48);
 }
 if (count > 10000 || cenSize > 64e6 || cenAt + cenSize > blob.size) throw Error('This tour file is damaged: its directory does not fit the file.');
 const cen = await bytesOf(cenAt, cenAt + cenSize), v = new DataView(cen.buffer), out = [];
 let p = 0;
 for (let k = 0; k < count; k++) {
  if (p + 46 > cen.length || v.getUint32(p, true) !== 0x02014b50) throw Error('This tour file is damaged: its directory is broken.');
  const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true);
  let size = v.getUint32(p + 20, true), raw = v.getUint32(p + 24, true), offset = v.getUint32(p + 42, true);
  const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
  const name = dec.decode(cen.subarray(p + 46, p + 46 + nameLen));
  // ZIP64 sizes and offset, in the order the format gives them.
  for (let x = p + 46 + nameLen; x < p + 46 + nameLen + extraLen - 4;) {
   const id = v.getUint16(x, true), len = v.getUint16(x + 2, true);
   if (id === 1) { let q = x + 4; if (raw === BIG) { raw = getU64(v, q); q += 8; } if (size === BIG) { size = getU64(v, q); q += 8; } if (offset === BIG) { offset = getU64(v, q); } }
   x += 4 + len;
  }
  if (method !== 0 || raw !== size) throw Error(`This tour file packs ${name} in a way Fairway does not read. Share it again from Fairway.`);
  out.push({name, size, offset, crc});
  p += 46 + nameLen + extraLen + commentLen;
 }
 return {entries: out, bytesOf};
}
async function entryBytes(dir, e, blob) {
 const head = await dir.bytesOf(e.offset, e.offset + 30), hv = new DataView(head.buffer);
 if (hv.getUint32(0, true) !== 0x04034b50) throw Error(`This tour file is damaged: ${e.name} cannot be found.`);
 const start = e.offset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
 if (start + e.size > blob.size) throw Error(`This tour file is damaged: ${e.name} is cut short.`);
 const bytes = await dir.bytesOf(start, start + e.size);
 if (crc32(bytes) !== e.crc) throw Error(`This tour file is damaged: ${e.name} does not check out.`);
 return bytes;
}

// READING SOMEONE'S FILE. Returns {tour, courses: [{hash, size, read()}],
// bytes} -- the tour checked and ready to keep, each built course readable
// one at a time (`read()` checks its hash with `hashOf` and parses it with
// `parse`, both passed in so this module needs neither the store nor the
// course reader), and the space it will take. Nothing is kept here.
export async function readTourFile(blob, {hashOf, parse = null} = {}) {
 const dir = await directory(blob);
 const allowed = e => e.name === 'tour.json' || e.name === 'README.txt' || BUILT_NAME.test(e.name);
 const strange = dir.entries.find(e => !allowed(e));
 if (strange) throw Error(`This tour file holds something a tour does not (${strange.name.slice(0, 60)}). It was not opened.`);
 const json = dir.entries.find(e => e.name === 'tour.json');
 if (!json) throw Error('This file holds no tour.');
 if (json.size > 4e6) throw Error('This tour file\'s calendar is far too large to be a tour.');
 let d;
 try { d = JSON.parse(dec.decode(await entryBytes(dir, json, blob))); } catch (e) { throw Error(e.message.startsWith('This') ? e.message : 'This tour file\'s calendar could not be read.'); }
 const tour = readTour(d);
 const files = new Map(dir.entries.filter(e => BUILT_NAME.test(e.name)).map(e => [BUILT_NAME.exec(e.name)[1], e]));
 for (const h of builtHashes(tour)) if (!files.has(h)) throw Error(`This tour plays a built course its file does not carry (${h}).`);
 const courses = [...files.entries()].map(([hash, e]) => ({hash, size: e.size, async read() {
  if (e.size > MAX_COURSE) throw Error(`A built course in this tour is ${(e.size / 1e6).toFixed(0)} MB; Fairway opens built courses up to ${MAX_COURSE / 1e6} MB.`);
  const bytes = await entryBytes(dir, e, blob);
  if (hashOf && await hashOf(bytes) !== hash) throw Error('A built course in this tour file is not the course it says it is. It was not opened.');
  if (parse) await parse(bytes);
  return bytes;
 }}));
 return {tour, courses, bytes: dir.entries.reduce((s, e) => s + e.size, 0)};
}
