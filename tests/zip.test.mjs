// The hand-written ZIP container a built course file is (src/zip.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeZip, readZip, crc32, isZip} from '../src/zip.js';

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
