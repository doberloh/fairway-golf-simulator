// WHERE ON EARTH (the course builder, stage 6; docs/COURSE_BUILDER.md, *Where
// it is, and in what units*). UTM to latitude and longitude and back, on the
// GRS80 ellipsoid (which NAD83, NAD83(2011) and ETRS89 use, and WGS84 differs
// from by under a millimetre at these scales) -- the transverse Mercator
// series of Snyder (USGS Professional Paper 1395, pp. 61-64), good to well
// under a millimetre within a zone. Enough to line up a LIDAR survey and a
// picture that came in UTM or in degrees, which is most open data; a grid the
// file describes in its WKT as Lambert conformal conic or transverse Mercator
// (a US State Plane, the British grid) is worked from that (`projectionOf`);
// any other lines up by matching points by hand in the builder. Pure;
// tests/lidar-geo.test.mjs.

const A = 6378137, F = 1 / 298.257222101, E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = .9996;
const M = phi => A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
 + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi));
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

// The UTM zone a longitude falls in, and an EPSG code's zone and hemisphere:
// WGS84 326xx/327xx, NAD83 269xx, NAD83(2011) 6330-6359, NAD83(CSRS) 2955-...,
// ETRS89 258xx.
export const zoneOf = lon => Math.floor((lon + 180) / 6) + 1;
export function utmOfEpsg(epsg) {
 if (!epsg) return null;
 if (epsg >= 32601 && epsg <= 32660) return {zone: epsg - 32600, south: false};
 if (epsg >= 32701 && epsg <= 32760) return {zone: epsg - 32700, south: true};
 if (epsg >= 26901 && epsg <= 26923) return {zone: epsg - 26900, south: false};
 if (epsg >= 6330 && epsg <= 6348) return {zone: epsg - 6330 + 1, south: false};
 if (epsg >= 25828 && epsg <= 25838) return {zone: epsg - 25800, south: false};
 return null;
}

export function toUtm(lat, lon, zone = zoneOf(lon)) {
 const phi = rad(lat), lam = rad(lon), lam0 = rad((zone - 1) * 6 - 180 + 3);
 const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = EP2 * Math.cos(phi) ** 2, Aa = Math.cos(phi) * (lam - lam0);
 const x = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
 let y = K0 * (M(phi) + N * Math.tan(phi) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
 if (lat < 0) y += 10000000;
 return {x, y, zone};
}

export function fromUtm(x, y, zone, south = false) {
 const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2)), m = ((south ? y - 10000000 : y)) / K0;
 const mu = m / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
 const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
 const N1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = EP2 * Math.cos(p1) ** 2, R1 = A * (1 - E2) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5, D = (x - 500000) / (N1 * K0);
 const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
 const lon = rad((zone - 1) * 6 - 180 + 3) + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
 return {lat: deg(lat), lon: deg(lon)};
}

// MAP GRIDS FROM THE FILE'S OWN DESCRIPTION (1 November 2026: the owner's
// Washington surveys came in State Plane, NAD83(HARN) / Washington South in US
// feet, and could not be placed). A WKT that names its projection -- Lambert
// conformal conic (one or two standard parallels; every US State Plane zone
// but the transverse Mercator ones, and many national grids) or transverse
// Mercator (the rest of State Plane, the British grid, Gauss-Krüger) -- is
// worked from its own parameters, ellipsoid and unit (Snyder pp. 61-64 and
// 104-110; checked against IOGP Guidance Note 7-2's worked examples).
// Datums are taken as one (NAD83 against WGS84 is about a metre).
const wktNum = (wkt, names) => { for (const n of names) { const m = wkt.match(new RegExp(`PARAMETER\\["${n}",\\s*(-?[0-9.eE+-]+)`, 'i')); if (m) return +m[1]; } return null; };
function ellipsoidOf(wkt) {
 const m = wkt?.match(/(?:SPHEROID|ELLIPSOID)\["[^"]*",\s*([0-9.]+),\s*([0-9.]+)/i);
 return m ? {a: +m[1], f: +m[2] ? 1 / +m[2] : 0} : {a: A, f: F};
}
// The projected unit: the PROJCS's own UNIT, after its PROJECTION.
const linearUnit = wkt => { const p = wkt.slice(wkt.search(/PROJECTION\[/i)), m = p.match(/(?:LENGTHUNIT|UNIT)\["[^"]*",\s*([0-9.]+)/i); return m ? +m[1] : 1; };
// THE SWISS GRID (1 November 2026: swissSURFACE3D was linked but not placed).
// LV95 (EPSG 2056) and LV03 (EPSG 21781) are an oblique Mercator on the Bessel
// ellipsoid; swisstopo's own approximate formulas (*Approximate formulas for
// the transformation between Swiss projection coordinates and WGS84*) are
// good to about a metre -- enough to line a survey up with imagery and
// OpenStreetMap, which is all placing is for. Checked against their worked
// example (tests/lidar-geo.test.mjs).
const SWISS = {
 toGeo(E, N, lv95 = true) {
  const y = ((lv95 ? E - 2600000 : E - 600000)) / 1e6, x = ((lv95 ? N - 1200000 : N - 200000)) / 1e6;
  const l = 2.6779094 + 4.728982 * y + .791484 * y * x + .1306 * y * x * x - .0436 * y * y * y;
  const p = 16.9023892 + 3.238272 * x - .270978 * y * y - .002528 * x * x - .0447 * y * y * x - .014 * x * x * x;
  return {lat: p * 100 / 36, lon: l * 100 / 36};
 },
 fromGeo(lat, lon, lv95 = true) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - .36 * l * p * p - 44.54 * l * l * l;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p;
  return lv95 ? {x: E, y: N} : {x: E - 2000000, y: N - 1000000};
 },
};
export function projectionOf(crs) {
 const wkt = crs?.wkt?.replace(/,?\s*VERT(?:_CS|CRS)\[[\s\S]*$/, '') ?? '';
 const kind = wkt.match(/PROJECTION\["([^"]+)"/i)?.[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
 const swiss = crs?.epsg === 2056 || crs?.epsg === 21781 || /^(hotineobliquemercator|swissobliquemercator|obliquemercator)/.test(kind) && /CH1903|LV95|LV03|Swiss/i.test(wkt);
 if (swiss) { const lv95 = crs?.epsg !== 21781 && !/LV03/i.test(wkt); return {toGeo: (x, y) => SWISS.toGeo(x, y, lv95), fromGeo: (lat, lon) => SWISS.fromGeo(lat, lon, lv95)}; }
 if (!kind) return null;
 const {a, f} = ellipsoidOf(wkt), e2 = f * (2 - f), e = Math.sqrt(e2), u = linearUnit(wkt);
 const lat0 = rad(wktNum(wkt, ['latitude_of_origin', 'latitude_of_center']) ?? 0), lon0 = rad(wktNum(wkt, ['central_meridian', 'longitude_of_center']) ?? 0);
 const fe = (wktNum(wkt, ['false_easting']) ?? 0) * u, fn = (wktNum(wkt, ['false_northing']) ?? 0) * u, k0 = wktNum(wkt, ['scale_factor']) ?? 1;
 if (kind.startsWith('lambertconformalconic')) {
  const m = p => Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) ** 2), t = p => Math.tan(Math.PI / 4 - p / 2) / ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2);
  const p1 = wktNum(wkt, ['standard_parallel_1']), p2 = wktNum(wkt, ['standard_parallel_2']);
  let n, Fc, k = 1;
  if (p1 != null && p2 != null) { const f1 = rad(p1), f2 = rad(p2); n = f1 === f2 ? Math.sin(f1) : (Math.log(m(f1)) - Math.log(m(f2))) / (Math.log(t(f1)) - Math.log(t(f2))); Fc = m(f1) / (n * t(f1) ** n); }
  else { n = Math.sin(lat0); Fc = m(lat0) / (n * t(lat0) ** n); k = k0; }
  const rho0 = a * Fc * k * t(lat0) ** n;
  return {
   fromGeo(lat, lon) { const rho = a * Fc * k * t(rad(lat)) ** n, th = n * (rad(lon) - lon0); return {x: (rho * Math.sin(th) + fe) / u, y: (rho0 - rho * Math.cos(th) + fn) / u}; },
   toGeo(x, y) {
    const dx = x * u - fe, dy = rho0 - (y * u - fn), s = Math.sign(n), rho = s * Math.hypot(dx, dy), th = Math.atan2(s * dx, s * dy), tt = (rho / (a * Fc * k)) ** (1 / n);
    let p = Math.PI / 2 - 2 * Math.atan(tt); for (let q = 0; q < 8; q++) p = Math.PI / 2 - 2 * Math.atan(tt * ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2));
    return {lat: deg(p), lon: deg(th / n + lon0)};
   },
  };
 }
 if (kind === 'transversemercator' || kind === 'gausskruger') {
  const ep2 = e2 / (1 - e2), Mf = p => a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p)), M0 = Mf(lat0);
  return {
   fromGeo(lat, lon) {
    const phi = rad(lat), N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, Aa = Math.cos(phi) * (rad(lon) - lon0);
    const x = k0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120) + fe;
    const y = k0 * (Mf(phi) - M0 + N * Math.tan(phi) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720)) + fn;
    return {x: x / u, y: y / u};
   },
   toGeo(x, y) {
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)), mu = (M0 + (y * u - fn) / k0) / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2, R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = (x * u - fe) / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    return {lat: deg(lat), lon: deg(lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1))};
   },
  };
 }
 return null;
}

// A point in one source's map grid into another's, where Fairway can: the
// same grid (by EPSG, or both UTM in one zone), degrees and UTM, or any grid
// whose WKT names a projection Fairway works (projectionOf). Null when it
// cannot -- the builder then asks for matching points.
export function converter(from, to) {
 const same = from.epsg && from.epsg === to.epsg;
 if (same) return (x, y) => ({x, y});
 const uf = utmOfEpsg(from.epsg), ut = utmOfEpsg(to.epsg), gf = from.geographic || from.epsg === 4326 || from.epsg === 4269, gt = to.geographic || to.epsg === 4326 || to.epsg === 4269;
 if (uf && ut && uf.zone === ut.zone && uf.south === ut.south) return (x, y) => ({x, y});
 if (gf && ut) return (x, y) => { const p = toUtm(y, x, ut.zone); return {x: p.x, y: p.y}; };
 if (uf && gt) return (x, y) => { const p = fromUtm(x, y, uf.zone, uf.south); return {x: p.lon, y: p.lat}; };
 if (uf && ut) return (x, y) => { const g = fromUtm(x, y, uf.zone, uf.south), p = toUtm(g.lat, g.lon, ut.zone); return {x: p.x, y: p.y}; };
 // Through degrees, by each side's own working.
 const side = (crs, utm, geo) => utm ? {toGeo: (x, y) => fromUtm(x, y, utm.zone, utm.south), fromGeo: (lat, lon) => toUtm(lat, lon, utm.zone)} : geo ? {toGeo: (x, y) => ({lat: y, lon: x}), fromGeo: (lat, lon) => ({x: lon, y: lat})} : projectionOf(crs);
 const pf = side(from, uf, gf), pt = side(to, ut, gt);
 if (pf && pt) return (x, y) => { const g = pf.toGeo(x, y), p = pt.fromGeo(g.lat, g.lon); return {x: p.x, y: p.y}; };
 return null;
}
