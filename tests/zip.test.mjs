// The hand-written ZIP container a built course file is (src/zip.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeZip, readZip, readZipFile, crc32, isZip} from '../src/zip.js';

test('crc32 matches the standard check value', () => {
 assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('parts come back exactly, stored and deflated', async () => {
 const big = new Uint8Array(200000); for (let i = 0; i < big.length; i++) big[i] = (i * 7) % 13;
 const noise = new Uint8Array(5000); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
 const zip = await writeZip([{name: 'course.json', data: '{"a":1}'}, {name: 'land.bin', data: big}, {name: 'noise.bin', data: noise}, {name: 'empty', data: new Uint8Array(0)}]);
 assert.ok(isZip(zip));
 assert.ok(zip.length < big.length / 4, 'repetitive data is deflated');
 const back = await readZip(zip);
 assert.equal(new TextDecoder().decode(back.get('course.json')), '{"a":1}');
 assert.deepEqual(back.get('land.bin'), big);
 assert.deepEqual(back.get('noise.bin'), noise);
 assert.equal(back.get('empty').length, 0);
});

test('the same parts make the same bytes (a course file\'s hash is its identity)', async () => {
 const a = await writeZip([{name: 'x', data: 'hello hello hello hello hello hello hello hello hello hello hello'}]);
 const b = await writeZip([{name: 'x', data: 'hello hello hello hello hello hello hello hello hello hello hello'}]);
 assert.deepEqual(a, b);
});

test('a damaged file is refused in plain words', async () => {
 const zip = await writeZip([{name: 'x', data: 'some text that is long enough to be deflated by the writer, surely'}]);
 const bad = zip.slice(); bad[40] ^= 0xff;
 await assert.rejects(readZip(bad), /damaged|cannot read/);
 await assert.rejects(readZip(new Uint8Array(10)), /damaged/);
});

test('another tool can read what is written (python zipfile, where present)', async t => {
 let py = null;
 for (const c of ['python', 'python3']) { try { execFileSync(c, ['--version'], {stdio: 'ignore'}); py = c; break; } catch {} }
 if (!py) return t.skip('no python on this machine');
 const dir = mkdtempSync(join(tmpdir(), 'fw-zip-'));
 try {
  const file = join(dir, 'c.zip');
  writeFileSync(file, await writeZip([{name: 'course.json', data: '{"kind":"fairway-course"}'.repeat(20)}, {name: 'b.bin', data: new Uint8Array(3000).fill(9)}]));
  const out = execFileSync(py, ['-I', '-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(",".join(sorted(z.namelist())))', file], {encoding: 'utf8'}).trim();
  assert.equal(out, 'b.bin,course.json');
 } finally { rmSync(dir, {recursive: true, force: true}); }
});

// A ZIP READ FROM ITS FILE, A PART AT A TIME (21 November 2026: the owner's
// 6.2 GB LIDAR download, which a browser will not read in one piece).
const setU64 = (v, at, n) => { v.setUint32(at, n % 2 ** 32, true); v.setUint32(at + 4, Math.floor(n / 2 ** 32), true); };
// A file a browser will not read whole: only its slices can be read.
const sliceOnly = blob => ({size: blob.size, slice: (a, b) => blob.slice(a, b), arrayBuffer() { throw new DOMException('too big', 'NotReadableError'); }});
// ZIP64 by hand, as a download over 4 GB is written: every size and offset
// in the 8-byte records, the 4-byte ones 0xFFFFFFFF. Stored parts.
function zip64Of(entries) {
 const enc = new TextEncoder(), locals = [], cen = [];
 let off = 0;
 for (const e of entries) {
  const name = enc.encode(e.name), crc = crc32(e.data);
  const xl = new DataView(new ArrayBuffer(20)); xl.setUint16(0, 1, true); xl.setUint16(2, 16, true); setU64(xl, 4, e.data.length); setU64(xl, 12, e.data.length);
  const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 45, true); h.setUint32(14, crc, true); h.setUint32(18, 0xFFFFFFFF, true); h.setUint32(22, 0xFFFFFFFF, true); h.setUint16(26, name.length, true); h.setUint16(28, 20, true);
  locals.push(new Uint8Array(h.buffer), name, new Uint8Array(xl.buffer), e.data);
  const xc = new DataView(new ArrayBuffer(28)); xc.setUint16(0, 1, true); xc.setUint16(2, 24, true); setU64(xc, 4, e.data.length); setU64(xc, 12, e.data.length); setU64(xc, 20, off);
  const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 45, true); c.setUint16(6, 45, true); c.setUint32(16, crc, true); c.setUint32(20, 0xFFFFFFFF, true); c.setUint32(24, 0xFFFFFFFF, true); c.setUint16(28, name.length, true); c.setUint16(30, 28, true); c.setUint32(42, 0xFFFFFFFF, true);
  cen.push(new Uint8Array(c.buffer), name, new Uint8Array(xc.buffer));
  off += 30 + name.length + 20 + e.data.length;
 }
 const cenSize = cen.reduce((s, b) => s + b.length, 0), cenAt = off;
 const r = new DataView(new ArrayBuffer(56)); r.setUint32(0, 0x06064b50, true); setU64(r, 4, 44); r.setUint16(12, 45, true); r.setUint16(14, 45, true); setU64(r, 24, entries.length); setU64(r, 32, entries.length); setU64(r, 40, cenSize); setU64(r, 48, cenAt);
 const l = new DataView(new ArrayBuffer(20)); l.setUint32(0, 0x07064b50, true); setU64(l, 8, cenAt + cenSize); l.setUint32(16, 1, true);
 const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, 0xFFFF, true); end.setUint16(10, 0xFFFF, true); end.setUint32(12, 0xFFFFFFFF, true); end.setUint32(16, 0xFFFFFFFF, true);
 return new Blob([...locals, ...cen, new Uint8Array(r.buffer), new Uint8Array(l.buffer), new Uint8Array(end.buffer)]);
}
const bytesOfBlob = async b => new Uint8Array(await b.arrayBuffer());

test('a ZIP read from its file gives the same parts, stored and deflated, folders left out', async () => {
 const big = new Uint8Array(200000).map((_, i) => (i * 7) & 0x3f), noise = new Uint8Array(5000).map((_, i) => (i * 2654435761) >>> 24);
 const zip = await writeZip([{name: 'tiles/', data: ''}, {name: 'tiles/a.laz', data: big}, {name: 'tiles/b.prj', data: 'PROJCS["x"]'}, {name: 'noise.bin', data: noise, store: true}]);
 const parts = await readZipFile(sliceOnly(new Blob([zip])));
 assert.deepEqual(parts.map(p => [p.name, p.size]), [['tiles/a.laz', big.length], ['tiles/b.prj', 11], ['noise.bin', noise.length]]);
 assert.deepEqual(await bytesOfBlob(await parts[0].blob()), big);
 assert.equal(await (await parts[1].blob()).text(), 'PROJCS["x"]');
 assert.deepEqual(await bytesOfBlob(await parts[2].blob()), noise);
 const only = await readZipFile(new Blob([zip]), {only: n => n.endsWith('.prj')});
 assert.deepEqual(only.map(p => p.name), ['tiles/b.prj']);
});

test('a large-format (ZIP64) ZIP is read, sizes and offsets from its 8-byte records, never read whole', async () => {
 const a = new Uint8Array(3000).fill(7), b = new TextEncoder().encode('LASF and more');
 const parts = await readZipFile(sliceOnly(zip64Of([{name: '17SPD270665.laz', data: a}, {name: 'second.las', data: b}])));
 assert.deepEqual(parts.map(p => [p.name, p.size]), [['17SPD270665.laz', 3000], ['second.las', b.length]]);
 assert.deepEqual(await bytesOfBlob(await parts[0].blob()), a);
 assert.deepEqual(await bytesOfBlob(await parts[1].blob()), b);
});

test('a damaged ZIP, and a damaged part, are refused in plain words', async () => {
 await assert.rejects(readZipFile(new Blob([new Uint8Array(100)])), /no ZIP directory/);
 const zip = await writeZip([{name: 'a.las', data: new Uint8Array(50000).map((_, i) => i % 13)}]);
 const bad = zip.slice(); bad[60] ^= 0xFF; bad[61] ^= 0xFF;
 const [part] = await readZipFile(new Blob([bad]));
 await assert.rejects(part.blob(), /damaged/);
});
