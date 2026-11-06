// Every open form of LIDAR read (src/lidar/las.js, geotiff.js, formats.js):
// one small survey written out in each form by the writers below, read back,
// and the same points or heights found. The real LAZ is read locally from the
// owner's Worthington data where it is here (bench/lidar/worthington, or FAIRWAY_LIDAR_TEST).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worthingtonDir, LIDAR_HOME} from '../tools/lidar-home.mjs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {openSource, formOf, REFUSED} from '../src/lidar/formats.js';
import {parseHeader, toMetres} from '../src/lidar/las.js';
import {converter} from '../src/lidar/geo.js';
import {readGeoTiff} from '../src/lidar/geotiff.js';
import {createGridder, findTrees} from '../src/lidar/land.js';

// The survey: a plane rising 1 in 20 to the east, map coordinates near a UTM
// origin, and a 12 m tree at its middle.
const E0 = 288000, N0 = 4833000, ground = (x, y) => 480 + (x - E0) * .05;
const PTS = [];
for (let y = N0; y < N0 + 40; y += .7) for (let x = E0; x < E0 + 40; x += .7) PTS.push({x, y, z: ground(x, y), cls: 2, intensity: 300, ret: 1, returns: 1, r: 100, g: 150, b: 90});
for (let a = 0; a < 40; a++) PTS.push({x: E0 + 20 + Math.cos(a) * 1.5, y: N0 + 20 + Math.sin(a) * 1.5, z: ground(E0 + 20, 0) + 12 - (a % 5) * .3, cls: 5, intensity: 90, ret: 1, returns: 2, r: 30, g: 90, b: 30});
const enc = new TextEncoder();
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
async function points(src) { const out = []; await src.each(p => out.push({...p})); return out; }

function writeLas(format, minor = 2) {
 const len = [20, 28, 26, 34, 57, 63, 30, 36, 38, 59, 67][format], head = minor >= 4 ? 375 : 227, buf = new ArrayBuffer(head + len * PTS.length), v = new DataView(buf), b = new Uint8Array(buf);
 b.set(enc.encode('LASF'), 0); b[24] = 1; b[25] = minor; v.setUint16(94, head, true); v.setUint32(96, head, true); b[104] = format; v.setUint16(105, len, true);
 v.setUint32(107, PTS.length, true); if (minor >= 4) v.setBigUint64(247, BigInt(PTS.length), true);
 for (const [k, s] of [[131, .001], [139, .001], [147, .001]]) v.setFloat64(k, s, true);
 v.setFloat64(155, E0, true); v.setFloat64(163, N0, true); v.setFloat64(171, 0, true);
 v.setFloat64(179, E0 + 40, true); v.setFloat64(187, E0, true); v.setFloat64(195, N0 + 40, true); v.setFloat64(203, N0, true); v.setFloat64(211, 500, true); v.setFloat64(219, 480, true);
 const rgb = {2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30}[format];
 PTS.forEach((p, i) => { const at = head + i * len;
  v.setInt32(at, Math.round((p.x - E0) / .001), true); v.setInt32(at + 4, Math.round((p.y - N0) / .001), true); v.setInt32(at + 8, Math.round(p.z / .001), true); v.setUint16(at + 12, p.intensity, true);
  if (format < 6) { b[at + 14] = p.ret | (p.returns << 3); b[at + 15] = p.cls; } else { b[at + 14] = p.ret | (p.returns << 4); b[at + 16] = p.cls; }
  if (rgb !== undefined) { v.setUint16(at + rgb, p.r * 257, true); v.setUint16(at + rgb + 2, p.g * 257, true); v.setUint16(at + rgb + 4, p.b * 257, true); } });
 return new Uint8Array(buf);
}
// A height grid of the plane: 41 x 41 at 1 m, north row first.
const W = 41, GRID = Float32Array.from({length: W * W}, (_, k) => ground(E0 + k % W, 0));
function writeTiff({compression = 1, predictor = 1, tiled = false} = {}) {
 let raw = new Uint8Array(GRID.buffer.slice(0));
 if (predictor === 3) { // floating-point predictor: bytes split by significance, differenced
  const out = new Uint8Array(raw.length);
  for (let r = 0; r < W; r++) { const row = raw.subarray(r * W * 4, (r + 1) * W * 4), sh = new Uint8Array(W * 4);
   for (let s = 0; s < W; s++) for (let byte = 0; byte < 4; byte++) sh[byte * W + s] = row[s * 4 + 3 - byte];
   for (let k = sh.length - 1; k > 0; k--) sh[k] = (sh[k] - sh[k - 1]) & 255; out.set(sh, r * W * 4); }
  raw = out;
 }
 const data = compression === 8 ? new Uint8Array(deflateSync(raw)) : compression === 5 ? lzwEncode(raw) : raw;
 const tags = [[256, 3, [W]], [257, 3, [W]], [258, 3, [32]], [259, 3, [compression]], [262, 3, [1]], [277, 3, [1]], [284, 3, [1]], [339, 3, [3]],
  ...(predictor > 1 ? [[317, 3, [predictor]]] : []),
  ...(tiled ? [[322, 3, [W]], [323, 3, [W]], [324, 4, [0]], [325, 4, [data.length]]] : [[273, 4, [0]], [278, 3, [W]], [279, 4, [data.length]]]),
  [33550, 12, [1, 1, 0]], [33922, 12, [0, 0, 0, E0 - .5, N0 + 40.5, 0]], [34735, 3, [1, 1, 0, 2, 1024, 0, 1, 1, 3072, 0, 1, 6344]], [42113, 2, '-9999']];
 tags.sort((a, b) => a[0] - b[0]);
 const SIZE = {2: 1, 3: 2, 4: 4, 12: 8}, ifdAt = 8, extraAt = ifdAt + 2 + tags.length * 12 + 4;
 let extra = 0; const blobs = [];
 for (const t of tags) { const n = typeof t[2] === 'string' ? t[2].length + 1 : t[2].length, sz = SIZE[t[1]] * n; if (sz > 4) { t.pos = extraAt + extra; extra += sz; } t.n = n; }
 const dataAt = extraAt + extra, buf = new ArrayBuffer(dataAt + data.length), v = new DataView(buf), b = new Uint8Array(buf);
 b.set([0x49, 0x49, 42, 0]); v.setUint32(4, ifdAt, true); v.setUint16(ifdAt, tags.length, true);
 tags.forEach((t, i) => { const at = ifdAt + 2 + i * 12; v.setUint16(at, t[0], true); v.setUint16(at + 2, t[1], true); v.setUint32(at + 4, t.n, true);
  const put = (o, val, k) => t[1] === 3 ? v.setUint16(o + k * 2, val, true) : t[1] === 4 ? v.setUint32(o + k * 4, (t[0] === 273 || t[0] === 324) ? dataAt : val, true) : t[1] === 12 ? v.setFloat64(o + k * 8, val, true) : 0;
  const base = t.pos ?? at + 8; if (t.pos != null) v.setUint32(at + 8, t.pos, true);
  if (typeof t[2] === 'string') b.set(enc.encode(t[2] + '\0'), base); else t[2].forEach((val, k) => put(base, val, k)); });
 b.set(data, dataAt);
 return b;
}
function lzwEncode(src) { // TIFF LZW, for the test only
 const out = [], dict = new Map(); let bits = 9, next = 258, acc = 0, nacc = 0;
 const emit = c => { acc = (acc << bits) | c; nacc += bits; while (nacc >= 8) { out.push((acc >> (nacc - 8)) & 255); nacc -= 8; } acc &= (1 << nacc) - 1; };
 const reset = () => { dict.clear(); for (let i = 0; i < 256; i++) dict.set(String(i), i); next = 258; bits = 9; };
 reset(); emit(256);
 let w = String(src[0]);
 for (let i = 1; i < src.length; i++) { const wc = w + ',' + src[i];
  if (dict.has(wc)) { w = wc; continue; }
  emit(dict.get(w)); dict.set(wc, next++); if (next >= 1 << bits) { if (bits < 12) bits++; else { emit(256); reset(); } } w = String(src[i]); }
 emit(dict.get(w)); emit(257); if (nacc) out.push((acc << (8 - nacc)) & 255);
 return Uint8Array.from(out);
}
function writeE57() { // one scan, cartesian Float fields and intensity, a pose, pages with room for a CRC
 const logical = 1020, recs = PTS.slice(0, 500), streams = ['cartesianX', 'cartesianY', 'cartesianZ'].map(k => { const f = new Float64Array(recs.map(p => k === 'cartesianX' ? p.x - E0 : k === 'cartesianY' ? p.y - N0 : p.z)); return new Uint8Array(f.buffer); });
 const inten = new Uint8Array(recs.map(p => p.intensity >> 2)); // Integer 0-255: 8 bits
 const all = [...streams, inten], body = [];
 // Packets of at most 60 records each, every field's bytestream in each.
 for (let s = 0; s < recs.length; s += 60) { const n = Math.min(60, recs.length - s), parts = [streams[0].slice(s * 8, (s + n) * 8), streams[1].slice(s * 8, (s + n) * 8), streams[2].slice(s * 8, (s + n) * 8), inten.slice(s, s + n)];
  const len = 6 + parts.length * 2 + parts.reduce((a, p) => a + p.length, 0), pad = (4 - len % 4) % 4, pk = new Uint8Array(len + pad), pv = new DataView(pk.buffer);
  pk[0] = 1; pv.setUint16(2, len + pad - 1, true); pv.setUint16(4, parts.length, true); let at = 6 + parts.length * 2; parts.forEach((p, i) => { pv.setUint16(6 + i * 2, p.length, true); pk.set(p, at); at += p.length; }); body.push(pk); }
 void all;
 const log = []; const push = a => { const at = log.length; for (const x of a) log.push(x); return at; };
 push(new Uint8Array(48));
 const secAt = push(new Uint8Array(32)), dataAt = log.length; for (const p of body) push(p);
 const phys = l => Math.floor(l / logical) * 1024 + l % logical;
 const xml = `<?xml version="1.0"?><e57Root type="Structure"><data3D type="Vector" allowHeterogeneousChildren="1"><vectorChild type="Structure"><pose type="Structure"><rotation type="Structure"><w type="Float">1</w><x type="Float">0</x><y type="Float">0</y><z type="Float">0</z></rotation><translation type="Structure"><x type="Float">${E0}</x><y type="Float">${N0}</y><z type="Float">0</z></translation></pose><points type="CompressedVector" fileOffset="${phys(secAt)}" recordCount="${recs.length}"><prototype type="Structure"><cartesianX type="Float"/><cartesianY type="Float"/><cartesianZ type="Float"/><intensity type="Integer" minimum="0" maximum="255"/></prototype><codecs type="Vector"/></points></vectorChild></data3D></e57Root>`;
 const xmlAt = push(enc.encode(xml));
 const L = new Uint8Array(log), lv = new DataView(L.buffer);
 L.set(enc.encode('ASTM-E57'), 0); lv.setUint32(8, 1, true); lv.setBigUint64(16, 0n, true); lv.setBigUint64(24, BigInt(phys(xmlAt)), true); lv.setBigUint64(32, BigInt(xml.length), true); lv.setBigUint64(40, 1024n, true);
 L[secAt] = 1; lv.setBigUint64(secAt + 8, BigInt(phys(dataAt)), true);
 const pages = Math.ceil(L.length / logical), out = new Uint8Array(pages * 1024);
 for (let p = 0; p < pages; p++) out.set(L.subarray(p * logical, (p + 1) * logical), p * 1024);
 return out;
}

test('the forms are told apart, and the closed ones named with how to convert', () => {
 assert.equal(formOf('a.laz', enc.encode('LASF1234')), 'laz');
 assert.equal(formOf('a.copc.laz', enc.encode('LASF')), 'laz');
 assert.equal(formOf('a.las', enc.encode('LASF')), 'las');
 assert.equal(formOf('a.e57', enc.encode('ASTM-E57')), 'e57');
 assert.equal(formOf('a.tif', Uint8Array.of(0x49, 0x49, 42, 0)), 'tiff');
 for (const k of ['zlas', 'sid', 'img', 'dem']) assert.equal(formOf(`a.${k}`, new Uint8Array(8)), k);
 assert.match(REFUSED.zlas, /LAS Optimizer/); assert.match(REFUSED.sid, /MrSID/);
});

test('LAS 1.2 and 1.4, point formats 0 to 10, give the same points', async () => {
 for (const [fmt, minor] of [[0, 2], [1, 2], [2, 2], [3, 2], [6, 4], [7, 4], [8, 4], [10, 4]]) {
  const src = await openSource('s.las', writeLas(fmt, minor));
  const got = await points(src);
  assert.equal(got.length, PTS.length, `format ${fmt}`);
  near(got[123].x, PTS[123].x, .001, `format ${fmt} x`); near(got[123].z, PTS[123].z, .001, `format ${fmt} z`);
  assert.equal(got[123].cls, 2); assert.equal(got.at(-1).cls, 5); assert.equal(got.at(-1).returns, 2);
  if ([2, 3, 7, 8, 10].includes(fmt)) assert.equal(got[0].g, 150 * 257);
 }
});

test('GeoTIFF: plain, Deflate with the float predictor, LZW, tiled; its place and EPSG', async () => {
 for (const o of [{}, {compression: 8, predictor: 3}, {compression: 5}, {tiled: true}, {compression: 8, tiled: true}]) {
  const r = await readGeoTiff(writeTiff(o));
  assert.equal(r.width, W);
  near(r.data[5 * W + 7], GRID[5 * W + 7], 1e-4, JSON.stringify(o));
  near(r.x0, E0, 1e-9, 'pixel centre x'); near(r.y0, N0 + 40, 1e-9, 'pixel centre y'); assert.equal(r.dy, -1);
  assert.equal(r.crs.epsg, 6344);
 }
});

test('text and other point forms: XYZ (with and without a header), PTS, PTX, PLY ascii and binary, E57', async () => {
 const xyz = PTS.slice(0, 200).map(p => `${p.x} ${p.y} ${p.z}`).join('\n');
 let got = await points(await openSource('a.xyz', enc.encode(xyz)));
 assert.equal(got.length, 200); assert.equal(got[0].cls, 2, 'XYZ heights are bare earth');
 got = await points(await openSource('a.csv', enc.encode('X,Y,Z,Intensity,Classification\n' + PTS.slice(0, 50).map(p => `${p.x},${p.y},${p.z},${p.intensity},${p.cls}`).join('\n'))));
 assert.equal(got.length, 50); assert.equal(got[3].intensity, 300);
 got = await points(await openSource('a.pts', enc.encode(`${100}\n` + PTS.slice(0, 100).map(p => `${p.x} ${p.y} ${p.z} ${p.intensity} 1 2 3`).join('\n'))));
 assert.equal(got.length, 100); assert.equal(got[0].b, 3);
 const ptx = ['10', '10', '0 0 0', '1 0 0', '0 1 0', '0 0 1', '1 0 0 0', '0 1 0 0', '0 0 1 0', `${E0} ${N0} 0 1`, ...PTS.slice(0, 100).map(p => `${p.x - E0} ${p.y - N0} ${p.z} .5`)].join('\n');
 got = await points(await openSource('a.ptx', enc.encode(ptx)));
 assert.equal(got.length, 100); near(got[7].x, PTS[7].x, 1e-6, 'PTX transform');
 const plyA = `ply\nformat ascii 1.0\nelement vertex 30\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n` + PTS.slice(0, 30).map(p => `${p.x - E0} ${p.y - N0} ${p.z} 10 20 30`).join('\n');
 got = await points(await openSource('a.ply', enc.encode(plyA)));
 assert.equal(got.length, 30); assert.equal(got[0].g, 20);
 const head = enc.encode('ply\nformat binary_little_endian 1.0\nelement vertex 30\nproperty double x\nproperty double y\nproperty float z\nend_header\n'), body = new DataView(new ArrayBuffer(30 * 20));
 PTS.slice(0, 30).forEach((p, i) => { body.setFloat64(i * 20, p.x, true); body.setFloat64(i * 20 + 8, p.y, true); body.setFloat32(i * 20 + 16, p.z, true); });
 const plyB = new Uint8Array(head.length + body.byteLength); plyB.set(head); plyB.set(new Uint8Array(body.buffer), head.length);
 got = await points(await openSource('b.ply', plyB));
 assert.equal(got.length, 30); near(got[5].x, PTS[5].x, 1e-6, 'binary PLY');
 got = await points(await openSource('a.e57', writeE57()));
 assert.equal(got.length, 500, 'E57 records across packets and pages'); near(got[321].x, PTS[321].x, 1e-6, 'E57 x with its pose'); near(got[321].z, PTS[321].z, 1e-6, 'E57 z'); assert.equal(got[321].intensity, 75);
});

test('height grids: Esri ASCII, float grid with its .hdr, SRTM HGT', async () => {
 const asc = `ncols ${W}\nnrows ${W}\nxllcorner ${E0 - .5}\nyllcorner ${N0 - .5}\ncellsize 1\nNODATA_value -9999\n` + Array.from({length: W}, (_, r) => Array.from({length: W}, (_, c) => GRID[r * W + c].toFixed(3)).join(' ')).join('\n');
 let r = (await openSource('a.asc', enc.encode(asc))).raster;
 near(r.data[5 * W + 7], GRID[5 * W + 7], 1e-3, 'ASC'); near(r.y0, N0 + 40, 1e-9, 'ASC top row centre');
 r = (await openSource('a.flt', new Uint8Array(GRID.buffer.slice(0)), {sidecar: `ncols ${W}\nnrows ${W}\nxllcorner ${E0 - .5}\nyllcorner ${N0 - .5}\ncellsize 1\nbyteorder LSBFIRST`})).raster;
 near(r.data[9], GRID[9], 1e-4, 'FLT');
 const hgt = new DataView(new ArrayBuffer(3 * 3 * 2)); [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((h, k) => hgt.setInt16(k * 2, h * 100, false));
 r = (await openSource('N43W096.hgt', new Uint8Array(hgt.buffer))).raster;
 assert.equal(r.data[4], 500); assert.equal(r.x0, -96); assert.equal(r.y0, 44);
});

test('land from points: the ground classed, the tree found at its height', async () => {
 const src = await openSource('s.las', writeLas(6, 4));
 const g = createGridder({box: {x0: E0, y0: N0, x1: E0 + 40, y1: N0 + 40}, cell: 1});
 await src.each(p => g.add(p));
 const land = g.finish(), trees = findTrees(land);
 assert.equal(land.method, 'classified');
 const k = 20 * land.nx + 30;
 near(land.ground[k], ground(E0 + 30, 0), .05, 'ground');
 assert.equal(trees.length, 1, `one tree (${trees.length})`);
 near(trees[0].h, 12, .6, 'its height'); near(trees[0].x, 0, 2, 'where');
 // The same survey unclassified: the ground filter finds the plane under the tree.
 const g2 = createGridder({box: {x0: E0, y0: N0, x1: E0 + 40, y1: N0 + 40}, cell: 1});
 await src.each(p => g2.add({...p, cls: 1}));
 const l2 = g2.finish();
 assert.equal(l2.method, 'filtered');
 near(l2.ground[20 * l2.nx + 20], ground(E0 + 20, 0), .3, 'filtered ground under the tree');
});

test('the owner\'s Washington surveys, in State Plane feet, place where their courses are', {skip: !fs.existsSync(path.join(LIDAR_HOME, 'battle-creek')) && 'no surveys in bench/lidar'}, () => {
 // Each folder's first tile: its header's middle, through its own WKT, to degrees.
 const where = {'battle-creek': [48.05, -122.23], 'salish-cliffs': [47.118, -123.108], snohomish: [47.923, -122.028]};
 for (const [key, [lat, lon]] of Object.entries(where)) {
  const d = path.join(LIDAR_HOME, key), sub = fs.existsSync(path.join(d, 'laz')) ? path.join(d, 'laz') : d, file = fs.readdirSync(sub).find(f => f.endsWith('.laz'));
  if (!file) continue;
  const fd = fs.openSync(path.join(sub, file), 'r'), buf = Buffer.alloc(65536); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
  const h = parseHeader(new Uint8Array(buf.buffer, buf.byteOffset, buf.length)), c = converter(h.crs, {epsg: 4326, geographic: true});
  assert.ok(c, `${key}: its grid (EPSG ${h.crs.epsg}) should be worked from its WKT`);
  const g = c((h.bounds.minX + h.bounds.maxX) / 2, (h.bounds.minY + h.bounds.maxY) / 2);
  assert.ok(Math.abs(g.y - lat) < .03 && Math.abs(g.x - lon) < .03, `${key}: ${g.y.toFixed(4)}, ${g.x.toFixed(4)} should be near ${lat}, ${lon}`);
 }
});

test('the owner\'s Worthington LAZ, where it is on this machine', {skip: !worthingtonDir() && 'no Worthington survey in bench/lidar/worthington (or FAIRWAY_LIDAR_TEST)'}, async () => {
 const dir = path.join(worthingtonDir(), 'raw'), file = fs.readdirSync(dir).find(f => f.endsWith('.laz'));
 const bytes = new Uint8Array(fs.readFileSync(path.join(dir, file))), h = parseHeader(bytes);
 assert.equal(h.version, '1.4'); assert.equal(h.format, 6); assert.equal(h.crs.epsg, 6344); assert.deepEqual(toMetres(h.crs), {h: 1, v: 1});
 const m = await import('laz-perf'), M = await (m.createLazPerf || m.default?.createLazPerf || m.default)();
 const src = await openSource(file, bytes, {lazModule: M});
 let n = 0, ground = 0; await src.each(p => { n++; if (p.cls === 2) ground++; }, {every: 50});
 assert.ok(n > h.count / 51 && ground > n / 2, `${n} points read, ${ground} ground`);
});
