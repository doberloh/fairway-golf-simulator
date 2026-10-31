// WHERE ON EARTH (the course builder, stage 6; docs/COURSE_BUILDER.md, *Where
// it is, and in what units*). UTM to latitude and longitude and back, on the
// GRS80 ellipsoid (which NAD83, NAD83(2011) and ETRS89 use, and WGS84 differs
// from by under a millimetre at these scales) -- the transverse Mercator
// series of Snyder (USGS Professional Paper 1395, pp. 61-64), good to well
// under a millimetre within a zone. Enough to line up a LIDAR survey and a
// picture that came in UTM or in degrees, which is most open data; other map
// grids (a US State Plane, the British grid) line up by matching points by
// hand in the builder. Pure; tested in Node.

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

// A point in one source's map grid into another's, where Fairway can: the
// same grid (by EPSG, or both UTM in one zone), or degrees and UTM. Null when
// it cannot -- the builder then asks for matching points.
export function converter(from, to) {
 const same = from.epsg && from.epsg === to.epsg;
 if (same) return (x, y) => ({x, y});
 const uf = utmOfEpsg(from.epsg), ut = utmOfEpsg(to.epsg), gf = from.geographic || from.epsg === 4326 || from.epsg === 4269, gt = to.geographic || to.epsg === 4326 || to.epsg === 4269;
 if (uf && ut && uf.zone === ut.zone && uf.south === ut.south) return (x, y) => ({x, y});
 if (gf && ut) return (x, y) => { const p = toUtm(y, x, ut.zone); return {x: p.x, y: p.y}; };
 if (uf && gt) return (x, y) => { const p = fromUtm(x, y, uf.zone, uf.south); return {x: p.lon, y: p.lat}; };
 if (uf && ut) return (x, y) => { const g = fromUtm(x, y, uf.zone, uf.south), p = toUtm(g.lat, g.lon, ut.zone); return {x: p.x, y: p.y}; };
 return null;
}
