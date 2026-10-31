// GEOTIFF HEIGHT GRIDS, READ BY HAND (the course builder, stage 6;
// docs/COURSE_BUILDER.md, *Real land: LIDAR*). A LIDAR survey's bare-earth or
// surface model (a DTM or DSM: USGS 3DEP's 1 m and 0.5 m DEMs, England's
// composite, the Netherlands' AHN) and an orthophoto both arrive as GeoTIFF.
// What a height grid needs of the format is small, so it is read here rather
// than through a library with eight dependencies: classic TIFF and BigTIFF,
// strips or tiles (a Cloud Optimized GeoTIFF is a tiled one), no compression,
// LZW, Deflate or PackBits, the horizontal and floating-point predictors,
// 8-64-bit samples, unsigned, signed or float, chunky or planar; the
// GeoTIFF tie point and pixel scale (or a transformation matrix), the GeoKeys
// (EPSG code, units) and GDAL's no-data value. LERC, ZSTD and JPEG are named
// and refused. Pure; tested in Node (tests/lidar-readers.test.mjs).
import {parseGeoKeys, crsOf} from './las.js';

const TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8};
const COMPRESSION = {1: 'none', 5: 'lzw', 8: 'deflate', 32946: 'deflate', 32773: 'packbits', 7: 'JPEG', 34887: 'LERC', 50000: 'ZSTD', 34925: 'LZMA', 50001: 'WebP'};

export const isTiff = b => b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && (b[2] === 42 || b[2] === 43) && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && (b[3] === 42 || b[3] === 43)));

function ifd(bytes) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), le = bytes[0] === 0x49, big = (le ? bytes[2] : bytes[3]) === 43;
 const u16 = a => v.getUint16(a, le), u32 = a => v.getUint32(a, le), u64 = a => Number(v.getBigUint64(a, le));
 let at = big ? u64(8) : u32(4);
 const n = big ? u64(at) : u16(at), entry = big ? 20 : 12, tags = {};
 at += big ? 8 : 2;
 for (let k = 0; k < n; k++, at += entry) {
  const tag = u16(at), type = u16(at + 2), count = big ? u64(at + 4) : u32(at + 4), size = (TYPE_SIZE[type] || 1) * count;
  const inline = big ? 8 : 4, data = size <= inline ? at + (big ? 12 : 8) : (big ? u64(at + 12) : u32(at + 8));
  const read = i => { const o = data + i * (TYPE_SIZE[type] || 1);
   switch (type) { case 1: case 7: return v.getUint8(o); case 6: return v.getInt8(o); case 3: return u16(o); case 8: return v.getInt16(o, le); case 4: return u32(o); case 9: return v.getInt32(o, le);
    case 11: return v.getFloat32(o, le); case 12: return v.getFloat64(o, le); case 16: case 18: return u64(o); case 17: return Number(v.getBigInt64(o, le));
    case 5: return u32(o) / u32(o + 4); case 10: return v.getInt32(o, le) / v.getInt32(o + 4, le); default: return 0; } };
  tags[tag] = type === 2 ? new TextDecoder().decode(bytes.subarray(data, data + count)).replace(/\0+$/, '') : count === 1 ? read(0) : Array.from({length: count}, (_, i) => read(i));
 }
 return {tags, le};
}

// TIFF's LZW: codes MSB first, 9 to 12 bits, the width growing one code early.
function lzw(src) {
 const out = [], dict = [];
 const reset = () => { dict.length = 258; for (let i = 0; i < 256; i++) dict[i] = [i]; };
 reset();
 let bits = 9, pos = 0, prev = null;
 const get = () => { let c = 0; for (let k = 0; k < bits; k++) { const byte = src[(pos + k) >> 3]; if (byte === undefined) return 257; c = (c << 1) | ((byte >> (7 - ((pos + k) & 7))) & 1); } pos += bits; return c; };
 for (;;) {
  const code = get();
  if (code === 257) break;
  if (code === 256) { reset(); bits = 9; prev = null; continue; }
  let entry;
  if (code < dict.length) entry = dict[code];
  else if (prev) entry = [...prev, prev[0]];
  else break;
  for (const b of entry) out.push(b);
  if (prev) dict.push([...prev, entry[0]]);
  prev = entry;
  if (dict.length + 1 >= (1 << bits) && bits < 12) bits++;
 }
 return Uint8Array.from(out);
}
function packbits(src, size) {
 const out = new Uint8Array(size);
 let i = 0, o = 0;
 while (i < src.length && o < size) {
  const n = (src[i++] << 24) >> 24;
  if (n >= 0) { out.set(src.subarray(i, i + n + 1), o); i += n + 1; o += n + 1; }
  else if (n !== -128) { out.fill(src[i++], o, o - n + 1); o += -n + 1; }
 }
 return out;
}
async function inflate(src) {
 const s = new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate'));
 return new Uint8Array(await new Response(s).arrayBuffer());
}

// The first image of a GeoTIFF as heights: {width, height, data: Float32Array
// (NaN where there is none), x0, y0, dx, dy (map units: x0, y0 the CENTRE of
// the first pixel; dy is negative for a north-up image), crs}. `bands`: which
// samples to read (data is the first; `datas` all of them); `window`: {col0,
// row0, col1, row1}, only that part, decoding only the chunks it touches -- an
// aerial picture is a quarter-quad of 10,000 x 13,000 pixels and a course is
// a sliver of it.
export async function readGeoTiff(bytes, {band = 0, bands = [band], window = null} = {}) {
 if (!isTiff(bytes)) throw Error('This is not a TIFF file.');
 const {tags: t, le} = ifd(bytes);
 const fullW = t[256], fullH = t[257], spp = t[277] ?? 1, planar = t[284] ?? 1;
 const bits = [].concat(t[258] ?? 8)[0], fmt = [].concat(t[339] ?? 1)[0], comp = COMPRESSION[t[259] ?? 1] ?? `compression ${t[259]}`, pred = t[317] ?? 1;
 if (!['none', 'lzw', 'deflate', 'packbits'].includes(comp)) throw Error(`This GeoTIFF is compressed with ${comp}, which Fairway cannot read yet. Save it uncompressed, LZW or Deflate (for example with GDAL: gdal_translate -co COMPRESS=DEFLATE).`);
 if (bands.some(b => b >= spp)) throw Error('This GeoTIFF has no such band.');
 const win = window ? {col0: Math.max(0, Math.floor(window.col0)), row0: Math.max(0, Math.floor(window.row0)), col1: Math.min(fullW, Math.ceil(window.col1)), row1: Math.min(fullH, Math.ceil(window.row1))} : {col0: 0, row0: 0, col1: fullW, row1: fullH};
 const width = Math.max(0, win.col1 - win.col0), height = Math.max(0, win.row1 - win.row0);
 const tiled = t[322] != null, tw = tiled ? t[322] : fullW, th = tiled ? t[323] : (t[278] ?? fullH);
 const offsets = [].concat(tiled ? t[324] : t[273]), counts = [].concat(tiled ? t[325] : t[279]);
 const bps = bits / 8, across = Math.ceil(fullW / tw), perPlane = across * Math.ceil(fullH / th);
 const datas = bands.map(() => new Float32Array(width * height).fill(NaN));
 const nodata = t[42113] != null ? parseFloat(t[42113]) : null;
 const chunkSamples = planar === 2 ? 1 : spp, wrap = bits === 8 ? 0xff : bits === 16 ? 0xffff : 0;
 const decode = async idx => {
  let raw = bytes.subarray(offsets[idx], offsets[idx] + counts[idx]);
  if (comp === 'lzw') raw = lzw(raw); else if (comp === 'deflate') raw = await inflate(raw); else if (comp === 'packbits') raw = packbits(raw, tw * th * chunkSamples * bps);
  if (pred === 3) {
   // Floating point: bytes split by significance across the row, differenced.
   const rowBytes = tw * chunkSamples * bps, fixed = new Uint8Array(raw.length);
   for (let r = 0; r < th; r++) {
    const row = raw.subarray(r * rowBytes, (r + 1) * rowBytes);
    for (let k = 1; k < row.length; k++) row[k] = (row[k] + row[k - 1]) & 255;
    const n = tw * chunkSamples;
    for (let s = 0; s < n; s++) for (let b = 0; b < bps; b++) fixed[r * rowBytes + s * bps + (le ? bps - 1 - b : b)] = row[b * n + s];
   }
   raw = fixed;
  }
  return raw;
 };
 for (let c = 0; c < perPlane; c++) {
  const cx = (c % across) * tw, cy = Math.floor(c / across) * th;
  if (cx >= win.col1 || cx + tw <= win.col0 || cy >= win.row1 || cy + th <= win.row0) continue;
  const planes = planar === 2 ? bands.map(b => b * perPlane + c) : [c];
  for (let pi = 0; pi < planes.length; pi++) {
   const raw = await decode(planes[pi]), v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
   const get = o => bits === 8 ? (fmt === 2 ? v.getInt8(o) : v.getUint8(o)) : bits === 16 ? (fmt === 2 ? v.getInt16(o, le) : v.getUint16(o, le))
    : bits === 32 ? (fmt === 3 ? v.getFloat32(o, le) : fmt === 2 ? v.getInt32(o, le) : v.getUint32(o, le)) : bits === 64 ? (fmt === 3 ? v.getFloat64(o, le) : Number(v.getBigInt64(o, le))) : NaN;
   const which = planar === 2 ? [[pi, 0]] : bands.map((b, i) => [i, b]);
   for (const [i, s0] of which) {
    const out = datas[i];
    for (let r = 0; r < th; r++) {
     const row = cy + r; if (row >= fullH) break;
     let acc = 0;
     for (let k = 0; k < tw; k++) {
      let value = get(((r * tw + k) * chunkSamples + s0) * bps);
      // The horizontal predictor differences each sample along its own row.
      if (pred === 2) { acc = k === 0 ? value : acc + value; if (wrap && fmt !== 2) acc &= wrap; value = acc; }
      const col = cx + k;
      if (row < win.row0 || row >= win.row1 || col < win.col0 || col >= win.col1) continue;
      out[(row - win.row0) * width + col - win.col0] = nodata != null && value === nodata ? NaN : value;
     }
    }
   }
  }
 }
 // Where it is: a tie point and pixel scale, or a matrix.
 const geoKeys = t[34735] ? parseGeoKeys([].concat(t[34735]), [].concat(t[34736] ?? []), t[34737] ?? '') : null;
 const isPoint = geoKeys?.[1025] === 2;
 let x0 = 0, y0 = 0, dx = 1, dy = -1;
 if (t[33922] && t[33550]) {
  const [I, J, , X, Y] = t[33922], [sx, sy] = t[33550];
  dx = sx; dy = -sy;
  x0 = X + (0 - I) * sx + (isPoint ? 0 : sx / 2); y0 = Y - (0 - J) * sy - (isPoint ? 0 : sy / 2);
 } else if (t[34264]) {
  const m = t[34264]; dx = m[0]; dy = m[5]; x0 = m[3] + (isPoint ? 0 : m[0] / 2); y0 = m[7] + (isPoint ? 0 : m[5] / 2);
 }
 return {width, height, data: datas[0], datas, x0: x0 + win.col0 * dx, y0: y0 + win.row0 * dy, dx, dy, crs: crsOf({geoKeys}), bands: spp, full: {width: fullW, height: fullH, x0, y0}};
}

// Where a box in the picture's own map units falls in its pixels, for `window`.
export function windowOf(r, box) {
 const c = [(box.x0 - r.x0) / r.dx, (box.x1 - r.x0) / r.dx], w = [(box.y1 - r.y0) / r.dy, (box.y0 - r.y0) / r.dy];
 return {col0: Math.min(...c) - 1, col1: Math.max(...c) + 2, row0: Math.min(...w) - 1, row1: Math.max(...w) + 2};
}

// Every band of a picture (an orthophoto), as 8-bit RGB for tracing.
// `box` in the picture's map units reads only that part. A picture's fourth
// band (NAIP's near-infrared) comes too where there is one: green turf shines
// in it, sand and roads do not.
export async function readGeoTiffRgb(bytes, {box = null} = {}) {
 let window = null;
 if (box) { const whole = await readGeoTiff(bytes, {window: {col0: 0, row0: 0, col1: 1, row1: 1}}); window = windowOf({...whole.full, dx: whole.dx, dy: whole.dy}, box); }
 const head = await readGeoTiff(bytes, {window: {col0: 0, row0: 0, col1: 1, row1: 1}});
 const bands = head.bands >= 4 ? [0, 1, 2, 3] : head.bands >= 3 ? [0, 1, 2] : [0];
 const r = await readGeoTiff(bytes, {bands, window});
 if (bands.length < 3) return {...r, rgb: null, nir: null};
 const n = r.width * r.height, rgb = new Uint8ClampedArray(n * 3), nir = bands.length > 3 ? new Uint8ClampedArray(n) : null;
 for (let k = 0; k < n; k++) { rgb[k * 3] = r.datas[0][k]; rgb[k * 3 + 1] = r.datas[1][k]; rgb[k * 3 + 2] = r.datas[2][k]; if (nir) nir[k] = r.datas[3][k]; }
 return {...r, rgb, nir};
}
