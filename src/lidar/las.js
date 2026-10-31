// LAS AND LAZ POINT CLOUDS (the course builder, stage 6; docs/COURSE_BUILDER.md,
// *Real land: LIDAR*). The standard (ASPRS LAS 1.0-1.4, every point format 0-10)
// read by hand; LAZ (LASzip, and COPC, which is ordinary LAZ 1.4) through
// laz-perf, the LASzip decoder compiled to WebAssembly (Apache-2.0). Pure
// apart from that decoder, which the caller hands in (`lazModule`), so Node
// tests load its Node build and the builder its web build with the WASM
// inlined -- nothing is ever fetched.
//
// A point comes out as {x, y, z, intensity, ret, returns, cls, r, g, b}: map
// metres (or whatever the file's units are -- `header.units` says, and
// `toMetres` converts), the return number and how many returns its pulse had,
// the classification (2 ground, 3-5 vegetation, 6 building, 7 and 18 noise,
// 9 water), colour where the format carries it.

const POINT_LENGTH = [20, 28, 26, 34, 57, 63, 30, 36, 38, 59, 67];
// Where a format's colour starts, if it has one.
const RGB_AT = {2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30};

const dec = new TextDecoder();
const cstr = (b, at, n) => { const s = dec.decode(b.subarray(at, at + n)); const z = s.indexOf('\0'); return z < 0 ? s : s.slice(0, z); };

// The units a file's numbers are in, from its GeoTIFF keys or its WKT: a
// metre, an international foot or a US survey foot. Horizontal and vertical
// apart, because a US State Plane file can be in feet across and metres up.
export const UNIT_METRES = {metre: 1, foot: .3048, usfoot: 1200 / 3937};
const unitFromCode = c => c === 9002 ? 'foot' : c === 9003 ? 'usfoot' : c === 9001 ? 'metre' : null;
const unitFromWkt = (wkt, axis) => {
 // The last unit inside the horizontal CRS, or inside the VERT_CS/VERTCRS part.
 const part = axis === 'v' ? (wkt.match(/VERT(?:_CS|CRS)\[[\s\S]*$/)?.[0] ?? '') : wkt.replace(/VERT(?:_CS|CRS)\[[\s\S]*$/, '');
 const units = [...part.matchAll(/(?:LENGTH)?UNIT\["([^"]+)"\s*,\s*([0-9.]+)/g)].map(m => [m[1].toLowerCase(), +m[2]]);
 const u = units.at(-1);
 if (!u) return null;
 if (/survey/.test(u[0]) || Math.abs(u[1] - 1200 / 3937) < 1e-9) return 'usfoot';
 if (/foot|feet/.test(u[0]) || Math.abs(u[1] - .3048) < 1e-9) return 'foot';
 return /met/.test(u[0]) || u[1] === 1 ? 'metre' : null;
};
export function parseGeoKeys(dir, doubles = [], ascii = '') {
 const keys = {};
 for (let k = 4; k + 3 < dir.length; k += 4) {
  const [id, loc, count, off] = [dir[k], dir[k + 1], dir[k + 2], dir[k + 3]];
  keys[id] = loc === 0 ? off : loc === 34736 ? doubles.slice(off, off + count) : loc === 34737 ? ascii.slice(off, off + count) : null;
 }
 return keys;
}
export function crsOf({geoKeys = null, wkt = ''} = {}) {
 // In WKT the projected (or geographic) system's own code is the last EPSG
 // authority before any vertical part: the ellipsoid's, datum's and units'
 // come earlier, inside it.
 const horiz = wkt.replace(/,?\s*VERT(?:_CS|CRS)\[[\s\S]*$/, '');
 const codes = [...horiz.matchAll(/(?:ID|AUTHORITY)\["EPSG",\s*"?(\d+)"?\]/g)].map(m => +m[1]);
 const epsg = geoKeys?.[3072] || geoKeys?.[2048] || codes.at(-1) || null;
 const h = unitFromCode(geoKeys?.[3076]) || (wkt ? unitFromWkt(wkt, 'h') : null) || 'metre';
 const v = unitFromCode(geoKeys?.[4099]) || (wkt ? unitFromWkt(wkt, 'v') : null) || h;
 return {epsg, units: {h, v}, wkt: wkt || null, geographic: !!(geoKeys?.[1024] === 2 || /^GEOG/.test(wkt))};
}

// The header of a LAS or LAZ file, from its first bytes (and its VLRs).
export function parseHeader(bytes) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 if (cstr(bytes, 0, 4) !== 'LASF') throw Error('This is not a LAS or LAZ file.');
 const major = bytes[24], minor = bytes[25], headerSize = v.getUint16(94, true), offset = v.getUint32(96, true), nvlr = v.getUint32(100, true);
 const formatByte = bytes[104], format = formatByte & 63, compressed = (formatByte & 128) !== 0 || (formatByte & 64) !== 0, recordLength = v.getUint16(105, true);
 if (format > 10) throw Error(`This LAS file uses point format ${format}, which no version of LAS defines.`);
 let count = v.getUint32(107, true);
 if (minor >= 4 && headerSize >= 375) { const big = Number(v.getBigUint64(247, true)); if (big) count = big; }
 const scale = [v.getFloat64(131, true), v.getFloat64(139, true), v.getFloat64(147, true)], add = [v.getFloat64(155, true), v.getFloat64(163, true), v.getFloat64(171, true)];
 const bounds = {maxX: v.getFloat64(179, true), minX: v.getFloat64(187, true), maxY: v.getFloat64(195, true), minY: v.getFloat64(203, true), maxZ: v.getFloat64(211, true), minZ: v.getFloat64(219, true)};
 // The variable-length records: the coordinate system lives in them.
 let at = headerSize, geoDir = null, geoDoubles = [], geoAscii = '', wkt = '', copc = false;
 for (let k = 0; k < nvlr && at + 54 <= bytes.length; k++) {
  const user = cstr(bytes, at + 2, 16), id = v.getUint16(at + 18, true), len = v.getUint16(at + 20, true), body = at + 54;
  if (user === 'LASF_Projection') {
   if (id === 34735) geoDir = Array.from({length: len / 2}, (_, i) => v.getUint16(body + i * 2, true));
   else if (id === 34736) geoDoubles = Array.from({length: len / 8}, (_, i) => v.getFloat64(body + i * 8, true));
   else if (id === 34737) geoAscii = cstr(bytes, body, len);
   else if (id === 2112) wkt = cstr(bytes, body, len);
  }
  if (user === 'copc' && id === 1) copc = true;
  at = body + len;
 }
 const crs = crsOf({geoKeys: geoDir ? parseGeoKeys(geoDir, geoDoubles, geoAscii) : null, wkt});
 return {version: `${major}.${minor}`, format, compressed, recordLength, count, scale, offset: add, bounds, pointsAt: offset, crs, copc,
  system: cstr(bytes, 26, 32), software: cstr(bytes, 58, 32)};
}

// One point record into an object (the same object, refilled, for speed).
function decoder(header) {
 const f = header.format, rgb = RGB_AT[f], [sx, sy, sz] = header.scale, [ox, oy, oz] = header.offset, p = {x: 0, y: 0, z: 0, intensity: 0, ret: 1, returns: 1, cls: 0, r: 0, g: 0, b: 0};
 return (v, at) => {
  p.x = v.getInt32(at, true) * sx + ox; p.y = v.getInt32(at + 4, true) * sy + oy; p.z = v.getInt32(at + 8, true) * sz + oz;
  p.intensity = v.getUint16(at + 12, true);
  const b = v.getUint8(at + 14);
  if (f < 6) { p.ret = b & 7; p.returns = (b >> 3) & 7; p.cls = v.getUint8(at + 15) & 31; }
  else { p.ret = b & 15; p.returns = (b >> 4) & 15; p.cls = v.getUint8(at + 16); }
  if (rgb !== undefined) { p.r = v.getUint16(at + rgb, true); p.g = v.getUint16(at + rgb + 2, true); p.b = v.getUint16(at + rgb + 4, true); }
  return p;
 };
}

// Every point of a file, to `onPoint(p)`; `every` thins (every k-th point).
// LAZ needs `lazModule` (laz-perf's module, already created). Yields to
// `pause()` every so many points so a page can paint.
export async function readPoints(bytes, header, onPoint, {lazModule = null, pause = null, every = 1, onProgress = null} = {}) {
 const read = decoder(header), n = header.count, step = 1 << 18;
 if (POINT_LENGTH[header.format] > header.recordLength) throw Error('This LAS file\'s points are shorter than their format.');
 if (!header.compressed) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i += every) {
   const at = header.pointsAt + i * header.recordLength;
   if (at + header.recordLength > bytes.length) break;
   onPoint(read(v, at));
   if (i % step < every) { onProgress?.(i / n); if (pause) await pause(); }
  }
  return;
 }
 if (!lazModule) throw Error('Reading LAZ needs the LAZ decoder.');
 const M = lazModule, file = M._malloc(bytes.length), point = M._malloc(header.recordLength);
 try {
  M.HEAPU8.set(bytes, file);
  const zip = new M.LASZip();
  try {
   zip.open(file, bytes.length);
   const len = zip.getPointLength(), total = zip.getCount();
   for (let i = 0; i < total; i++) {
    zip.getPoint(point);
    if (i % every) continue;
    // HEAPU8's buffer can be replaced as memory grows; take it fresh.
    onPoint(read(new DataView(M.HEAPU8.buffer, point, len), 0));
    if (i % step === 0) { onProgress?.(i / total); if (pause) await pause(); }
   }
  } finally { zip.delete(); }
 } finally { M._free(file); M._free(point); }
}

// Map units into metres, horizontally and vertically.
export const toMetres = crs => ({h: UNIT_METRES[crs.units.h] ?? 1, v: UNIT_METRES[crs.units.v] ?? 1});
