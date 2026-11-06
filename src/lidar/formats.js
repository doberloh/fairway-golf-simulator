// EVERY OPEN FORM OF LIDAR, OPENED (the course builder, stage 6;
// docs/COURSE_BUILDER.md, *Every form, read*). One door for whatever file a
// player brings: `openSource(name, bytes)` tells the form from the name and
// the first bytes and answers either
//   {kind: 'points', form, count, crs, bounds, each(onPoint, opts)}   a cloud
//   {kind: 'raster', form, raster}                                    a height grid
// where a point is las.js's {x, y, z, intensity, ret, returns, cls, r, g, b}
// and a raster geotiff.js's {width, height, data, x0, y0, dx, dy, crs}.
//
// Read: LAS 1.0-1.4 and LAZ/COPC (las.js), E57, PLY (ASCII and binary), PTS,
// PTX, XYZ/TXT/CSV points, GeoTIFF/BigTIFF/COG (geotiff.js), Esri ASCII grid,
// Esri float grid and BIL (with their .hdr), SRTM HGT. Named and refused with
// how to convert: Esri zLAS and MrSID (closed formats), ERDAS Imagine and the
// old USGS DEM (open, not read yet). A cloud with no classification is all
// unclassified (class 1); an XYZ or ASCII grid of heights is bare earth.
// Pure; tested in Node (tests/lidar-readers.test.mjs).
import {parseHeader, readPoints, crsOf} from './las.js';
import {readGeoTiff, isTiff} from './geotiff.js';

const dec = new TextDecoder();
const ext = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const point = (x, y, z, o = {}) => ({x, y, z, intensity: o.intensity ?? 0, ret: 1, returns: 1, cls: o.cls ?? 1, r: o.r ?? 0, g: o.g ?? 0, b: o.b ?? 0});
const boundsOf = pts => pts.reduce((b, p) => ({minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z)}), {minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity});
const cloud = (form, pts, crs = crsOf()) => ({kind: 'points', form, count: pts.length, crs, bounds: boundsOf(pts), each: async f => { for (const p of pts) f(p); }});
const lines = bytes => dec.decode(bytes).split(/\r?\n/);
const nums = s => s.trim().split(/[\s,;]+/).filter(Boolean).map(Number);

export const REFUSED = {
 zlas: 'This is an Esri zLAS file, a closed format Fairway cannot read. Convert it to LAS for free with Esri\'s LAS Optimizer (no ArcGIS needed) or rapidlasso\'s LASliberator, then open the LAS.',
 sid: 'This is a MrSID file, a closed format Fairway cannot read. Convert it with the free MrSID tools from Extensis (or GDAL with the MrSID driver) to LAS or GeoTIFF, then open that.',
 img: 'This is an ERDAS Imagine (.img) height grid, which Fairway does not read yet. Convert it to GeoTIFF (for example: gdal_translate in.img out.tif) and open the GeoTIFF.',
 dem: 'This is an old USGS DEM (.dem) file, which Fairway does not read yet. Convert it to GeoTIFF (for example: gdal_translate in.dem out.tif) and open the GeoTIFF.',
};

// ---- Esri ASCII grid: a six-line header, then rows from the north.
export function readAsciiGrid(bytes) {
 const L = lines(bytes), head = {};
 let row = 0;
 for (; row < L.length; row++) { const m = L[row].trim().match(/^([a-z_]+)\s+(-?[0-9.eE+-]+)$/i); if (!m) break; head[m[1].toLowerCase()] = +m[2]; }
 const w = head.ncols, h = head.nrows, c = head.cellsize ?? head.dx, nodata = head.nodata_value;
 if (!w || !h || !c) throw Error('This ASCII grid has no ncols, nrows or cellsize.');
 const data = new Float32Array(w * h).fill(NaN);
 let k = 0;
 for (; row < L.length && k < w * h; row++) for (const v of nums(L[row])) { data[k++] = v === nodata ? NaN : v; if (k >= w * h) break; }
 const x0 = head.xllcenter ?? (head.xllcorner + c / 2), yll = head.yllcenter ?? (head.yllcorner + c / 2);
 return {width: w, height: h, data, x0, y0: yll + (h - 1) * c, dx: c, dy: -c, crs: crsOf()};
}

// ---- Points as text: x y z and whatever follows. A header line names the
// columns where there is one ("X,Y,Z,Intensity,Classification,R,G,B");
// otherwise x y z [intensity] [r g b].
export function readXyz(bytes) {
 const L = lines(bytes), pts = [];
 let cols = null;
 for (const raw of L) {
  const s = raw.trim(); if (!s || s.startsWith('#') || s.startsWith('//')) continue;
  const v = nums(s);
  if (v.some(Number.isNaN)) { if (!pts.length) cols = s.toLowerCase().split(/[\s,;]+/); continue; }
  if (v.length < 3) continue;
  const at = name => { const i = cols?.findIndex(c => c === name || c.startsWith(name)); return i >= 0 ? v[i] : undefined; };
  pts.push(cols ? point(at('x'), at('y'), at('z'), {intensity: at('intensity') ?? at('i'), cls: at('classification') ?? at('class') ?? 2, r: at('r') ?? at('red'), g: at('g') ?? at('green'), b: at('b') ?? at('blue')})
   : point(v[0], v[1], v[2], {intensity: v.length === 4 || v.length === 7 ? v[3] : 0, cls: 2, ...(v.length >= 6 ? {r: v[v.length - 3], g: v[v.length - 2], b: v[v.length - 1]} : {})}));
 }
 if (!pts.length) throw Error('This text file holds no points (x y z on each line).');
 return pts;
}

// ---- PTS: a count, then x y z intensity [r g b] (Leica).
export function readPts(bytes) {
 const L = lines(bytes), pts = [];
 for (const raw of L) {
  const v = nums(raw);
  if (v.length < 3) continue;
  pts.push(point(v[0], v[1], v[2], {intensity: v[3] ?? 0, cls: 1, ...(v.length >= 7 ? {r: v[4], g: v[5], b: v[6]} : {})}));
 }
 return pts;
}

// ---- PTX: scans, each a ten-line header (columns, rows, scanner position and
// axes, then a 4x4 transform whose last row is the translation), then points
// in the scanner's frame, a zero point where nothing returned.
export function readPtx(bytes) {
 const L = lines(bytes), pts = [];
 let i = 0;
 while (i < L.length) {
  if (!L[i].trim()) { i++; continue; }
  const cols = +L[i], rows = +L[i + 1];
  if (!cols || !rows) break;
  const m = [6, 7, 8, 9].map(k => nums(L[i + k]));
  i += 10;
  for (let n = 0; n < cols * rows && i < L.length; n++, i++) {
   const v = nums(L[i]);
   if (v.length < 3 || (v[0] === 0 && v[1] === 0 && v[2] === 0)) continue;
   const x = v[0] * m[0][0] + v[1] * m[1][0] + v[2] * m[2][0] + m[3][0], y = v[0] * m[0][1] + v[1] * m[1][1] + v[2] * m[2][1] + m[3][1], z = v[0] * m[0][2] + v[1] * m[1][2] + v[2] * m[2][2] + m[3][2];
   pts.push(point(x, y, z, {intensity: v[3] ?? 0, cls: 1, ...(v.length >= 7 ? {r: v[4], g: v[5], b: v[6]} : {})}));
  }
 }
 return pts;
}

// ---- PLY: an ASCII header naming the vertex properties, then ASCII or binary.
const PLY_TYPE = {char: [1, 'Int8'], int8: [1, 'Int8'], uchar: [1, 'Uint8'], uint8: [1, 'Uint8'], short: [2, 'Int16'], int16: [2, 'Int16'], ushort: [2, 'Uint16'], uint16: [2, 'Uint16'],
 int: [4, 'Int32'], int32: [4, 'Int32'], uint: [4, 'Uint32'], uint32: [4, 'Uint32'], float: [4, 'Float32'], float32: [4, 'Float32'], double: [8, 'Float64'], float64: [8, 'Float64']};
export function readPly(bytes) {
 const headEnd = dec.decode(bytes.subarray(0, Math.min(bytes.length, 65536))).indexOf('end_header');
 if (headEnd < 0) throw Error('This PLY file has no header end.');
 const head = dec.decode(bytes.subarray(0, headEnd)).split(/\r?\n/), format = (head.find(l => l.startsWith('format')) || '').split(/\s+/)[1];
 const elements = [];
 for (const l of head) {
  const p = l.trim().split(/\s+/);
  if (p[0] === 'element') elements.push({name: p[1], count: +p[2], props: []});
  else if (p[0] === 'property' && elements.length) elements.at(-1).props.push(p[1] === 'list' ? {name: p[4], list: [p[2], p[3]]} : {name: p[2], type: p[1]});
 }
 let at = headEnd + 'end_header'.length;
 while (bytes[at] === 13 || bytes[at] === 10) { at++; if (bytes[at - 1] === 10) break; }
 const vertex = elements.find(e => e.name === 'vertex');
 if (!vertex) throw Error('This PLY file has no vertices.');
 const pts = [], get = (o, n) => o[n] ?? o[n === 'r' ? 'red' : n === 'g' ? 'green' : n === 'b' ? 'blue' : n];
 const make = o => point(o.x, o.y, o.z, {intensity: o.intensity ?? o.scalar_intensity ?? 0, cls: o.classification ?? o.scalar_classification ?? 1, r: get(o, 'r'), g: get(o, 'g'), b: get(o, 'b')});
 if (format === 'ascii') {
  const L = dec.decode(bytes.subarray(at)).split(/\r?\n/);
  let li = 0;
  for (const e of elements) for (let n = 0; n < e.count; n++, li++) {
   if (e !== vertex) continue;
   const v = nums(L[li] || ''), o = {};
   e.props.forEach((p, i) => { o[p.name] = v[i]; });
   pts.push(make(o));
  }
  return pts;
 }
 const le = format === 'binary_little_endian', v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 for (const e of elements) for (let n = 0; n < e.count; n++) {
  const o = {};
  for (const p of e.props) {
   if (p.list) { const [cn, ct] = [PLY_TYPE[p.list[0]], PLY_TYPE[p.list[1]]], c = v['get' + cn[1]](at, le); at += cn[0] + c * ct[0]; continue; }
   const [size, kind] = PLY_TYPE[p.type] || [4, 'Float32'];
   o[p.name] = v['get' + kind](at, le); at += size;
  }
  if (e === vertex) pts.push(make(o));
 }
 return pts;
}

// ---- Esri float grid (.flt) and BIL, from their .hdr text (the caller hands
// it in as `header`); SRTM HGT (1 or 3 arc-second, big-endian 16-bit, named
// for its south-west corner).
export function readFloatGrid(bytes, header, {bil = false} = {}) {
 const h = {};
 for (const l of String(header || '').split(/\r?\n/)) { const m = l.trim().match(/^(\S+)\s+(\S+)/); if (m) h[m[1].toLowerCase()] = m[2]; }
 const w = +(h.ncols ?? h.samples), rows = +(h.nrows ?? h.lines), c = +(h.cellsize ?? h.xdim), bits = +(h.nbits ?? 32), le = !/^(msbfirst|m)/i.test(h.byteorder ?? 'lsbfirst');
 if (!w || !rows || !c) throw Error('This grid\'s .hdr has no size or cell size.');
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), data = new Float32Array(w * rows), nodata = h.nodata_value != null ? +h.nodata_value : h.nodata != null ? +h.nodata : null;
 for (let k = 0; k < w * rows; k++) {
  const x = bil && bits === 16 ? (/(signed|int)/i.test(h.pixeltype ?? 'signedint') ? v.getInt16(k * 2, le) : v.getUint16(k * 2, le)) : v.getFloat32(k * 4, le);
  data[k] = nodata != null && x === nodata ? NaN : x;
 }
 const ulx = h.ulxmap != null ? +h.ulxmap : +(h.xllcenter ?? (+h.xllcorner + c / 2)), uly = h.ulymap != null ? +h.ulymap : +(h.yllcenter ?? (+h.yllcorner + c / 2)) + (rows - 1) * c;
 return {width: w, height: rows, data, x0: ulx, y0: uly, dx: c, dy: -c, crs: crsOf()};
}
export function readHgt(bytes, name) {
 const n = Math.round(Math.sqrt(bytes.length / 2)), m = String(name).toUpperCase().match(/([NS])(\d{2})([EW])(\d{3})/);
 if (!m || n * n * 2 !== bytes.length) throw Error('This is not an SRTM .hgt file (its name gives its corner, like N43W096.hgt).');
 const lat = (m[1] === 'S' ? -1 : 1) * +m[2], lon = (m[3] === 'W' ? -1 : 1) * +m[4], v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), data = new Float32Array(n * n);
 for (let k = 0; k < n * n; k++) { const x = v.getInt16(k * 2, false); data[k] = x === -32768 ? NaN : x; }
 return {width: n, height: n, data, x0: lon, y0: lat + 1, dx: 1 / (n - 1), dy: -1 / (n - 1), crs: {epsg: 4326, units: {h: 'degree', v: 'metre'}, geographic: true}};
}

// ---- E57 (ASTM E2807): 1024-byte pages each ending in a CRC, an XML
// description, and point records as compressed-vector data packets whose
// fields are bit-packed. Read: every data3D scan, cartesian or spherical,
// Float, ScaledInteger and Integer fields, intensity and colour, each scan's
// pose (a rotation quaternion and a translation).
export function readE57(bytes) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 if (dec.decode(bytes.subarray(0, 8)) !== 'ASTM-E57') throw Error('This is not an E57 file.');
 const page = Number(v.getBigUint64(40, true)) || 1024, logical = page - 4;
 // Physical offsets carry a 4-byte CRC every page; a logical read skips them.
 const readLogical = (phys, len) => {
  const out = new Uint8Array(len);
  let o = 0, p = phys;
  while (o < len) { const inPage = p % page, take = Math.min(len - o, logical - inPage); out.set(bytes.subarray(p, p + take), o); o += take; p += take; if (p % page === logical) p += 4; }
  return out;
 };
 const physToLogical = phys => Math.floor(phys / page) * logical + phys % page, logicalToPhys = log => Math.floor(log / logical) * page + log % logical;
 const xml = dec.decode(readLogical(Number(v.getBigUint64(24, true)), Number(v.getBigUint64(32, true))));
 const pts = [];
 const scans = [...xml.matchAll(/<vectorChild type="Structure">([\s\S]*?)<\/vectorChild>/g)].map(m => m[1]).filter(s => /<points[^>]*type="CompressedVector"/.test(s));
 for (const scan of scans) {
  const pm = scan.match(/<points[^>]*fileOffset="(\d+)"[^>]*recordCount="(\d+)"/) || scan.match(/<points[^>]*recordCount="(\d+)"[^>]*fileOffset="(\d+)"/);
  if (!pm) continue;
  const fileOffset = +(pm[0].match(/fileOffset="(\d+)"/)[1]), count = +(pm[0].match(/recordCount="(\d+)"/)[1]);
  const proto = (scan.match(/<prototype type="Structure">([\s\S]*?)<\/prototype>/) || [])[1] || '';
  const fields = [...proto.matchAll(/<(\w+) type="(Float|ScaledInteger|Integer)"([^>]*?)\/?>/g)].map(m => {
   const a = n => { const q = m[3].match(new RegExp(n + '="([^"]+)"')); return q ? +q[1] : undefined; };
   return {name: m[1], type: m[2], precision: /precision="single"/.test(m[3]) ? 32 : 64, min: a('minimum') ?? 0, max: a('maximum') ?? 0, scale: a('scale') ?? 1, offset: a('offset') ?? 0};
  });
  for (const f of fields) f.bits = f.type === 'Float' ? f.precision : Math.max(0, Math.ceil(Math.log2(f.max - f.min + 1)));
  const pose = scan.match(/<pose type="Structure">([\s\S]*?)<\/pose>/)?.[1] || '';
  const num = (s, tag) => +((s.match(new RegExp(`<${tag} type="Float"[^>]*>([^<]+)<`)) || [])[1] ?? 0);
  const q = {w: num(pose, 'w') || 1, x: num(pose, 'x'), y: num(pose, 'y'), z: num(pose, 'z')}, tr = (pose.match(/<translation[\s\S]*?<\/translation>/) || [''])[0];
  const t = {x: num(tr, 'x'), y: num(tr, 'y'), z: num(tr, 'z')};
  // The section header: then data packets, each with a bytestream per field.
  const sec = readLogical(fileOffset, 32), sv = new DataView(sec.buffer), dataLogical = physToLogical(Number(sv.getBigUint64(8, true)));
  const cols = fields.map(() => []);
  let logicalAt = dataLogical;
  const bitBuf = fields.map(() => ({bytes: [], bit: 0}));
  let got = 0;
  while (got < count) {
   const hd = readLogical(logicalToPhys(logicalAt), 6), hv = new DataView(hd.buffer);
   if (hd[0] !== 1) break;
   const len = hv.getUint16(2, true) + 1, nStreams = hv.getUint16(4, true), pkt = readLogical(logicalToPhys(logicalAt), len), pv = new DataView(pkt.buffer);
   let p = 6 + nStreams * 2;
   for (let s = 0; s < nStreams; s++) { const bl = pv.getUint16(6 + s * 2, true); for (let k = 0; k < bl; k++) bitBuf[s].bytes.push(pkt[p + k]); p += bl; }
   logicalAt += len;
   // Decode what whole records the buffers now hold.
   for (let s = 0; s < fields.length; s++) {
    const f = fields[s], b = bitBuf[s];
    for (;;) {
     if (b.bit + f.bits > b.bytes.length * 8) break;
     let value;
     if (f.type === 'Float') {
      const at = b.bit >> 3, dv = new DataView(Uint8Array.from(b.bytes.slice(at, at + f.bits / 8)).buffer);
      value = f.bits === 32 ? dv.getFloat32(0, true) : dv.getFloat64(0, true);
     } else {
      let raw = 0;
      for (let k = 0; k < f.bits; k++) { const bit = b.bit + k; raw += ((b.bytes[bit >> 3] >> (bit & 7)) & 1) * 2 ** k; }
      value = (raw + f.min) * (f.type === 'ScaledInteger' ? f.scale : 1) + (f.type === 'ScaledInteger' ? f.offset : 0);
     }
     cols[s].push(value); b.bit += f.bits;
    }
    const drop = b.bit >> 3; if (drop) { b.bytes.splice(0, drop); b.bit -= drop * 8; }
   }
   got = Math.min(...cols.map(c => c.length));
  }
  const col = n => cols[fields.findIndex(f => f.name === n)];
  const [X, Y, Z, R, A, E, I, CR, CG, CB] = ['cartesianX', 'cartesianY', 'cartesianZ', 'sphericalRange', 'sphericalAzimuth', 'sphericalElevation', 'intensity', 'colorRed', 'colorGreen', 'colorBlue'].map(col);
  for (let k = 0; k < Math.min(count, got); k++) {
   let x, y, z;
   if (X) { x = X[k]; y = Y[k]; z = Z[k]; } else { const r = R[k], az = A[k], el = E[k]; x = r * Math.cos(el) * Math.cos(az); y = r * Math.cos(el) * Math.sin(az); z = r * Math.sin(el); }
   // Rotated by the pose quaternion (v + 2w(q x v) + 2 q x (q x v)), then translated.
   const {w, x: qx, y: qy, z: qz} = q, cx = qy * z - qz * y, cy = qz * x - qx * z, cz = qx * y - qy * x;
   const rx = x + 2 * w * cx + 2 * (qy * cz - qz * cy), ry = y + 2 * w * cy + 2 * (qz * cx - qx * cz), rz = z + 2 * w * cz + 2 * (qx * cy - qy * cx);
   pts.push(point(rx + t.x, ry + t.y, rz + t.z, {intensity: I?.[k] ?? 0, cls: 1, r: CR?.[k] ?? 0, g: CG?.[k] ?? 0, b: CB?.[k] ?? 0}));
  }
 }
 if (!pts.length) throw Error('This E57 file holds no point scans Fairway can read.');
 return pts;
}

// What a file is, from its name and first bytes.
export function formOf(name, bytes) {
 const e = ext(name), head = dec.decode(bytes.subarray(0, Math.min(16, bytes.length)));
 if (REFUSED[e]) return e;
 if (head.startsWith('LASF')) return e === 'laz' || /copc/.test(String(name).toLowerCase()) ? 'laz' : 'las';
 if (head.startsWith('ASTM-E57')) return 'e57';
 if (head.startsWith('ply')) return 'ply';
 if (isTiff(bytes)) return 'tiff';
 if (e === 'hgt') return 'hgt';
 if (e === 'flt' || e === 'bil') return e;
 if (e === 'asc' || /^\s*ncols/i.test(head)) return 'asc';
 if (e === 'pts') return 'pts';
 if (e === 'ptx') return 'ptx';
 if (['xyz', 'txt', 'csv'].includes(e)) return 'xyz';
 return null;
}

// Opens any form. `sidecar`: the text of a .hdr for .flt/.bil, a .prj's WKT.
export async function openSource(name, bytes, {lazModule = null, sidecar = null, prj = null} = {}) {
 const form = formOf(name, bytes), withPrj = c => prj ? {...c, ...crsOf({wkt: prj})} : c;
 if (!form) throw Error(`Fairway does not know what ${name} is. It reads LAS, LAZ, COPC, E57, PLY, PTS, PTX, XYZ/TXT/CSV, GeoTIFF, ASCII grids, Esri float grids, BIL and SRTM HGT.`);
 if (REFUSED[form]) throw Error(REFUSED[form]);
 if (form === 'las' || form === 'laz') {
  const header = parseHeader(bytes);
  return {kind: 'points', form: header.copc ? 'copc' : form, count: header.count, crs: prj ? withPrj(header.crs) : header.crs, bounds: header.bounds, header,
   each: (f, opts = {}) => readPoints(bytes, header, f, {lazModule, ...opts})};
 }
 if (form === 'tiff') { const r = await readGeoTiff(bytes); return {kind: 'raster', form: 'geotiff', raster: {...r, crs: prj ? withPrj(r.crs) : r.crs}}; }
 if (form === 'asc') { const r = readAsciiGrid(bytes); return {kind: 'raster', form, raster: {...r, crs: withPrj(r.crs)}}; }
 if (form === 'flt' || form === 'bil') { const r = readFloatGrid(bytes, sidecar, {bil: form === 'bil'}); return {kind: 'raster', form, raster: {...r, crs: withPrj(r.crs)}}; }
 if (form === 'hgt') return {kind: 'raster', form, raster: readHgt(bytes, name)};
 const pts = form === 'ply' ? readPly(bytes) : form === 'pts' ? readPts(bytes) : form === 'ptx' ? readPtx(bytes) : form === 'e57' ? readE57(bytes) : readXyz(bytes);
 return cloud(form, pts, withPrj(crsOf()));
}
