// The LIDAR folder (src/builder/lidar-folder.js) and what door 2 keeps in it
// (lidar-search.js `keep`, `kept`): a download written there and read back
// instead of downloaded again, a USGS square as its ZIP of pieces, the
// folder's files listed and told over the place or not. Against a fake
// folder: the browser's own File System Access objects are not in Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveIn, fileIn, bytesIn, listIn, overPlace, LIDAR_FILE} from '../src/builder/lidar-folder.js';
import {downloadLidar, squareName, squareAround, gridByName, isEptZip} from '../src/builder/lidar-search.js';
import {lonLatToMerc} from '../src/lidar/ept.js';
import {parseHeader} from '../src/lidar/las.js';
import {converter} from '../src/lidar/geo.js';
import {readZip} from '../src/zip.js';

// A folder as showDirectoryPicker hands one: files by name, folders in it.
function fakeFolder(name = 'Downloads') {
 const files = new Map(), dirs = new Map();
 const dir = {name, kind: 'directory', files, dirs,
  async getFileHandle(n, {create = false} = {}) {
   if (!files.has(n) && !create) throw Object.assign(Error('NotFound'), {name: 'NotFoundError'});
   return {kind: 'file', name: n, getFile: async () => new File([files.get(n) ?? new Uint8Array()], n),
    createWritable: async () => { const parts = []; return {write: async b => { parts.push(b); }, close: async () => { files.set(n, new Uint8Array(await new Blob(parts).arrayBuffer())); }, abort: async () => {}}; }};
  },
  async *entries() { for (const n of files.keys()) yield [n, await dir.getFileHandle(n)]; for (const [n, d] of dirs) yield [n, d]; }};
 return dir;
}

// A LAS 1.2 file (point format 0) of points in a grid: `at(i, j)` gives x, y.
function las(at, n = 10, {geoKeys = null} = {}) {
 const vlr = geoKeys ? 54 + geoKeys.length * 2 : 0, head = 227, len = 20, count = n * n, buf = new ArrayBuffer(head + vlr + len * count), v = new DataView(buf), b = new Uint8Array(buf);
 b.set(new TextEncoder().encode('LASF'), 0); b[24] = 1; b[25] = 2; v.setUint16(94, head, true); v.setUint32(96, head + vlr, true); v.setUint32(100, geoKeys ? 1 : 0, true); b[104] = 0; v.setUint16(105, len, true); v.setUint32(107, count, true);
 for (const k of [131, 139, 147]) v.setFloat64(k, .01, true);
 const pts = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push(at(i, j));
 const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
 v.setFloat64(179, Math.max(...xs), true); v.setFloat64(187, Math.min(...xs), true); v.setFloat64(195, Math.max(...ys), true); v.setFloat64(203, Math.min(...ys), true); v.setFloat64(211, 310, true); v.setFloat64(219, 300, true);
 v.setFloat64(155, Math.min(...xs), true); v.setFloat64(163, Math.min(...ys), true);
 if (geoKeys) { b.set(new TextEncoder().encode('LASF_Projection'), head + 2); v.setUint16(head + 18, 34735, true); v.setUint16(head + 20, geoKeys.length * 2, true); geoKeys.forEach((g, q) => v.setUint16(head + 54 + q * 2, g, true)); }
 pts.forEach((p, q) => { const o = head + vlr + q * len; v.setInt32(o, Math.round((p.x - Math.min(...xs)) / .01), true); v.setInt32(o + 4, Math.round((p.y - Math.min(...ys)) / .01), true); v.setInt32(o + 8, 30500, true); b[o + 14] = 1 | 1 << 3; b[o + 15] = 2; });
 return new Uint8Array(buf);
}

test('a file written to the folder is found whole by name and size, listed with the folder one down, and a download in progress left out', async () => {
 const dir = fakeFolder(), sub = fakeFolder('laz');
 dir.dirs.set('laz', sub);
 await saveIn(dir, 'a.laz', Uint8Array.of(1, 2, 3));
 await saveIn(sub, 'b.las', Uint8Array.of(4));
 dir.files.set('c.laz.crdownload', Uint8Array.of(9)); dir.files.set('notes.pdf', Uint8Array.of(9));
 assert.deepEqual([...await bytesIn(dir, 'a.laz')], [1, 2, 3]);
 assert.ok(await fileIn(dir, 'a.laz', 3)); assert.equal(await fileIn(dir, 'a.laz', 4), null, 'not yet whole');
 assert.equal(await fileIn(dir, 'missing.laz'), null); assert.equal(await bytesIn(null, 'a.laz'), null, 'no folder: nothing kept');
 assert.deepEqual((await listIn(dir)).map(e => e.path), ['a.laz', 'laz/b.las']);
 assert.ok(LIDAR_FILE.test('USGS_LPC_x.laz') && LIDAR_FILE.test('custom_download.zip') && !LIDAR_FILE.test('readme.pdf'));
});

test('a USGS square is downloaded once: kept as a ZIP of its pieces, read back from the folder the next time with no request', async () => {
 const box = squareAround(-95.6, 43.62, 400), a = lonLatToMerc(box.lon0, box.lat0), b = lonLatToMerc(box.lon1, box.lat1);
 // One piece of ten by ten points spread over the square, in Web Mercator.
 const piece = las((i, j) => ({x: a.x + (b.x - a.x) * (i + .5) / 10, y: a.y + (b.y - a.y) * (j + .5) / 10}));
 const cube = [a.x - 1000, a.y - 1000, 0, a.x + 3000, a.y + 3000, 4000], asked = [];
 const files = {'https://x/ept.json': {dataType: 'laszip', bounds: cube}, 'https://x/ept-hierarchy/0-0-0-0.json': {'0-0-0-0': 100}};
 const get = async url => { asked.push(url); if (url.endsWith('.laz')) return {ok: true, arrayBuffer: async () => piece.buffer}; const j = files[url]; return j ? {ok: true, json: async () => j} : {ok: false, status: 404}; };
 const found = {source: 'usgs', id: 'MN_Test_2021', title: 'MN Test 2021', ept: 'https://x/ept.json'}, folder = fakeFolder();
 const [first] = await downloadLidar(found, box, {get, kept: n => bytesIn(folder, n)});
 assert.equal(first.keep.name, squareName(found, box)); assert.match(first.keep.name, /^MN_Test_2021_43\.6200_-95\.6000_400m\.ept\.zip$/);
 assert.ok(isEptZip(await readZip(first.keep.bytes)), 'a ZIP with the square in it');
 await saveIn(folder, first.keep.name, first.keep.bytes);
 const before = asked.length, [again] = await downloadLidar(found, box, {get, kept: n => bytesIn(folder, n)});
 assert.equal(asked.length, before, 'nothing asked of USGS the second time');
 assert.equal(again.kept, true); assert.equal(again.keep, undefined);
 const pts = s => { const out = []; return s.each(p => out.push({x: p.x, y: p.y})).then(() => out); };
 const [p1, p2] = [await pts(first), await pts(again)];
 assert.equal(p2.length, 100); assert.deepEqual(p2, p1, 'the same points, in the same UTM grid');
 assert.equal(again.crs.epsg, first.crs.epsg);
});

test('IGN tiles: kept under their own names; a tile already in the folder is read, not downloaded', async () => {
 const tile = las((i, j) => ({x: 650000 + i, y: 6860000 + j}));
 const urls = ['https://data.geopf.fr/x/LHD_1.copc.laz', 'https://data.geopf.fr/x/LHD_2.copc.laz'], asked = [];
 const get = async url => { asked.push(url); return {ok: true, arrayBuffer: async () => tile.buffer.slice(0)}; };
 const folder = fakeFolder(); await saveIn(folder, 'LHD_1.copc.laz', tile);
 const got = await downloadLidar({source: 'ign', urls}, null, {get, kept: n => bytesIn(folder, n)});
 assert.deepEqual(asked, [urls[1]], 'only the tile not kept');
 assert.equal(got[0].kept, true); assert.equal(got[1].keep.name, 'LHD_2.copc.laz');
});

test('which of the folder\'s files lie over the place: a kept square by its name, a LAS by its header, the rest unknown', async () => {
 const box = squareAround(-95.6, 43.62, 1500);
 const toDegrees = crs => crs?.epsg ? converter(crs, {epsg: 4326, geographic: true}) : null;
 const entry = (name, bytes = new Uint8Array()) => ({name, file: new File([bytes], name)});
 assert.equal(await overPlace(entry('MN_Test_2021_43.6200_-95.6000_1800m.ept.zip'), box, {parseHeader, toDegrees}), true);
 assert.equal(await overPlace(entry('MN_Test_2021_47.0000_-95.6000_1800m.ept.zip'), box, {parseHeader, toDegrees}), false);
 // UTM 15N (EPSG 26915) in the GeoKeys: Worthington's corner, and one 100 km off.
 const keys = [1, 1, 0, 1, 3072, 0, 1, 26915], near = converter({epsg: 4326, geographic: true}, {epsg: 26915, units: {h: 'metre', v: 'metre'}})(-95.6, 43.62);
 assert.equal(await overPlace(entry('here.laz', las((i, j) => ({x: near.x + i, y: near.y + j}), 10, {geoKeys: keys})), box, {parseHeader, toDegrees}), true);
 assert.equal(await overPlace(entry('far.las', las((i, j) => ({x: near.x + 1e5 + i, y: near.y + j}), 10, {geoKeys: keys})), box, {parseHeader, toDegrees}), false);
 assert.equal(await overPlace(entry('dtm.tif'), box, {parseHeader, toDegrees}), null);
 assert.equal(await overPlace(entry('nogrid.las', las((i, j) => ({x: i, y: j}))), box, {parseHeader, toDegrees}), null);
});

test('a swisstopo tile, whose LAS states no grid, is placed by its name', () => {
 assert.equal(gridByName('swisssurface3d_2019_2600-1199_2056_5728.las.zip').epsg, 2056);
 assert.equal(gridByName('USGS_LPC_x.laz'), null);
});
