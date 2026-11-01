// FINDING LIDAR FOR A PLACE (the owner, 1 November 2026: "Add searching for
// LIDAR files before the first step in the builder using all known sources.
// add the ability to download in the builder as well"). Door 2's first step:
// a place by name, a square round it, and every source that covers it --
// searched and downloaded in the page where the source lets a page read it
// (it answers any origin), offered as a link to its own portal where it does
// not. Online only when the player presses. Pure but for `fetch` (passed in;
// tests/lidar-search.test.mjs fakes it).
//
// Downloaded here (checked 1 November 2026, RESEARCH *Finding LIDAR from the
// builder*):
//   usgs  USGS 3DEP, the United States: the National Map's product search
//         finds the surveys; the points come from USGS's Entwine copy on
//         Amazon's open data (rockyweb, where the LAZ tiles are, does not
//         answer a page), only the octree's pieces over the square.
//   ign   IGN LiDAR HD, France: its tile index (WFS) and COPC tiles.
// Linked: Washington DNR, swisstopo (Swiss grid not worked yet), AHN, the
// Environment Agency, Dataforsyningen, CNIG, ELVIS, LINZ, NRCan,
// OpenTopography.
import {nodesFor, nodeBox, lonLatToMerc, mercToLonLat} from '../lidar/ept.js';
import {toUtm, zoneOf} from '../lidar/geo.js';
import {parseHeader, readPoints} from '../lidar/las.js';

const EPT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public';
// EVERY STATE'S OWN SURVEY (the owner, 1 November 2026: "add sources for each
// states survey as well. Washington has one, i bet other states do too"): the
// states with a LIDAR programme or portal of their own -- often newer or
// denser than what 3DEP holds, and in State Plane, which the builder places --
// each address checked to answer on 1 November 2026 (RESEARCH, *Finding LIDAR
// from the builder*). [state, name, its box (loose), link, note?]. States
// without one of their own get 3DEP and NOAA. None of these lets a page read
// it, so each is a link.
const STATE_PORTALS = [
 ['AK', 'Alaska DGGS Elevation Portal', [-180, 51, -129, 72], 'https://elevation.alaska.gov/'],
 ['AR', 'Arkansas GIS Office (GeoStor)', [-94.62, 33, -89.64, 36.5], 'https://gis.arkansas.gov/'],
 ['CO', 'Colorado Hazard Mapping LiDAR download', [-109.06, 36.99, -102.04, 41], 'https://coloradohazardmapping.com/lidarDownload'],
 ['CT', 'CT ECO LiDAR (Connecticut)', [-73.73, 40.98, -71.79, 42.05], 'https://cteco.uconn.edu/data/lidar/'],
 ['DE', 'FirstMap Delaware', [-75.79, 38.45, -75.05, 39.84], 'https://firstmap.delaware.gov/'],
 ['FL', 'Florida GIO LiDAR resources', [-87.63, 24.4, -80.03, 31], 'https://www.floridagio.gov/pages/lidar-resources'],
 ['ID', 'Idaho LiDAR Consortium', [-117.24, 41.99, -111.04, 49], 'https://www.idaholidar.org/data/'],
 ['IL', 'ISGS Clearinghouse (Illinois)', [-91.51, 36.97, -87.02, 42.51], 'https://clearinghouse.isgs.illinois.edu/'],
 ['IN', 'IndianaMap', [-88.1, 37.77, -84.78, 41.76], 'https://www.indianamap.org/'],
 ['IA', 'Iowa Geospatial Data: Lidar', [-96.64, 40.38, -90.14, 43.5], 'https://geodata.iowa.gov/pages/lidar'],
 ['KS', 'Kansas GIS (DASC)', [-102.05, 36.99, -94.59, 40], 'https://www.kansasgis.org/'],
 ['KY', 'KyFromAbove (Kentucky)', [-89.57, 36.5, -81.96, 39.15], 'https://kyfromabove.ky.gov/'],
 ['LA', 'Atlas: The Louisiana Statewide GIS', [-94.04, 28.93, -88.82, 33.02], 'https://atlas.ga.lsu.edu/'],
 ['MD', 'MD iMap LiDAR (Maryland)', [-79.49, 37.91, -75.05, 39.72], 'https://imap.maryland.gov/pages/lidar'],
 ['MA', 'MassGIS Lidar Terrain Data', [-73.51, 41.24, -69.93, 42.89], 'https://www.mass.gov/info-details/massgis-data-lidar-terrain-data', 'Its point clouds come through NOAA\'s Data Access Viewer.'],
 ['MN', 'MnGeo Lidar (Minnesota)', [-97.24, 43.5, -89.49, 49.38], 'https://mn.gov/mngeo/gis-data-and-maps/info-by-topic/elevation/lidar/'],
 ['MO', 'MSDIS (Missouri)', [-95.77, 35.99, -89.1, 40.61], 'https://msdis.missouri.edu/'],
 ['MT', 'Montana State Library elevation', [-116.05, 44.36, -104.04, 49], 'https://msl.mt.gov/geoinfo/msdi/elevation/', 'Its point clouds by request.'],
 ['NH', 'NH GRANIT', [-72.56, 42.7, -70.61, 45.31], 'https://granit.unh.edu/'],
 ['NJ', 'NJGIN (New Jersey)', [-75.56, 38.93, -73.89, 41.36], 'https://njgin.nj.gov/'],
 ['NY', 'NYS GIS Clearinghouse elevation', [-79.76, 40.5, -71.86, 45.02], 'https://gis.ny.gov/elevation/'],
 ['NC', 'NC Spatial Data Download', [-84.32, 33.84, -75.46, 36.59], 'https://sdd.nc.gov/'],
 ['ND', 'North Dakota LiDAR dissemination', [-104.05, 45.94, -96.55, 49], 'https://lidar.dwr.nd.gov/'],
 ['OH', 'OGRIP Geodata Download (Ohio)', [-84.82, 38.4, -80.52, 41.98], 'https://gis1.oit.ohio.gov/geodatadownload/'],
 ['OR', 'DOGAMI Lidar Viewer (Oregon)', [-124.57, 41.99, -116.46, 46.29], 'https://gis.dogami.oregon.gov/maps/lidarviewer/'],
 ['PA', 'PASDA (Pennsylvania)', [-80.52, 39.72, -74.69, 42.27], 'https://www.pasda.psu.edu/'],
 ['RI', 'RIGIS (Rhode Island)', [-71.91, 41.15, -71.12, 42.02], 'https://www.rigis.org/'],
 ['SC', 'SC DNR LiDAR', [-83.35, 32.03, -78.54, 35.22], 'https://www.dnr.sc.gov/GIS/lidar.html'],
 ['TN', 'TNMap (Tennessee)', [-90.31, 34.98, -81.65, 36.68], 'https://tnmap.tn.gov/'],
 ['TX', 'TxGIO DataHub (Texas, StratMap)', [-106.65, 25.84, -93.51, 36.5], 'https://data.geographic.texas.gov/'],
 ['UT', 'Utah SGID elevation', [-114.05, 37, -109.04, 42], 'https://gis.utah.gov/products/sgid/elevation/'],
 ['VT', 'VCGI Lidar Program (Vermont)', [-73.44, 42.73, -71.46, 45.02], 'https://vcgi.vermont.gov/data-and-programs/lidar-program'],
 ['VA', 'VGIN (Virginia)', [-83.68, 36.54, -75.24, 39.47], 'https://vgin.vdem.virginia.gov/pages/cl-appsmaps'],
 ['WA', 'Washington DNR LiDAR Portal', [-124.85, 45.54, -116.92, 49], 'https://lidarportal.dnr.wa.gov/', 'Draw a box, download the LAZ, and bring the files here (State Plane feet: placed by the builder).'],
 ['WV', 'WV Elevation and LiDAR Download Tool', [-82.64, 37.2, -77.72, 40.64], 'https://data.wvgis.wvu.edu/elevation/'],
 ['WI', 'Wisconsin SCO elevation and lidar', [-92.89, 42.49, -86.25, 47.31], 'https://www.sco.wisc.edu/data/elevationlidar/'],
];
// [lon0, lat0, lon1, lat1], loose.
export const LIDAR_SOURCES = [
 {key: 'usgs', name: 'USGS 3DEP (United States)', covers: [[-180, 17, -64, 72]], online: true, licence: 'United States government work: public domain.'},
 {key: 'ign', name: 'IGN LiDAR HD (France)', covers: [[-5.5, 41, 10, 51.5]], online: true, licence: 'Licence Ouverte 2.0 (Etalab): free to use, IGN credited.'},
 {key: 'noaa', name: 'NOAA Digital Coast Data Access Viewer (US coasts)', covers: [[-180, 17, -64, 72]], link: 'https://coast.noaa.gov/dataviewer/', note: 'Coastal surveys, and states that send point clouds there (Massachusetts).'},
 ...STATE_PORTALS.map(([st, name, box, link, note]) => ({key: 'state-' + st, name, covers: [box], link, note: note ?? 'Download the LAZ there and bring the files here (Choose LIDAR files); State Plane feet are placed by the builder.'})),
 {key: 'swisstopo', name: 'swisstopo swissSURFACE3D (Switzerland)', covers: [[5.9, 45.8, 10.5, 47.9]], link: 'https://www.swisstopo.admin.ch/en/height-model-swisssurface3d', note: 'Its Swiss grid is not yet placed by the builder: pictures and OpenStreetMap need lining up by points.'},
 {key: 'ahn', name: 'AHN (the Netherlands)', covers: [[3.2, 50.7, 7.3, 53.6]], link: 'https://www.ahn.nl/'},
 {key: 'ea', name: 'Environment Agency LIDAR (England)', covers: [[-6.5, 49.8, 1.9, 55.9]], link: 'https://environment.data.gov.uk/survey'},
 {key: 'dk', name: 'Dataforsyningen (Denmark)', covers: [[8, 54.5, 15.3, 57.8]], link: 'https://dataforsyningen.dk/'},
 {key: 'cnig', name: 'CNIG PNOA LiDAR (Spain)', covers: [[-9.4, 35.9, 4.4, 43.9]], link: 'https://centrodedescargas.cnig.es/CentroDescargas/'},
 {key: 'elvis', name: 'ELVIS (Australia)', covers: [[112, -44, 154, -10]], link: 'https://elevation.fsdf.org.au/'},
 {key: 'linz', name: 'LINZ Data Service (New Zealand)', covers: [[166, -47.5, 179, -34]], link: 'https://data.linz.govt.nz/'},
 {key: 'nrcan', name: 'NRCan CanElevation point clouds (Canada)', covers: [[-141, 49, -52, 70], [-83.1, 42, -74.4, 49], [-74.4, 45, -59, 49]], link: 'https://ftp.maps.canada.ca/pub/elevation/pointclouds_nuagespoints/'},
 {key: 'opentopo', name: 'OpenTopography (worldwide)', covers: [[-180, -90, 180, 90]], link: 'https://portal.opentopography.org/', note: 'Point clouds from many countries; a free account.'},
];
export const sourcesAt = (lon, lat) => LIDAR_SOURCES.filter(s => s.covers.some(([a, b, c, d]) => lon >= a && lon <= c && lat >= b && lat <= d));

// A square `size` metres a side round a point, in degrees: {lon0, lat0, lon1, lat1}.
export function squareAround(lon, lat, size) {
 const h = size / 2, dLat = h / 111320, dLon = h / (111320 * Math.cos(lat * Math.PI / 180));
 return {lon0: lon - dLon, lat0: lat - dLat, lon1: lon + dLon, lat1: lat + dLat};
}

// ---- searching: [{source, id, title, date, tiles, points?, bytes?, ...}]
export async function searchLidar(key, box, {get = fetch} = {}) {
 if (key === 'usgs') return searchUsgs(box, get);
 if (key === 'ign') return searchIgn(box, get);
 return [];
}
async function searchUsgs(box, get) {
 const url = `https://tnmaccess.nationalmap.gov/api/v1/products?datasets=${encodeURIComponent('Lidar Point Cloud (LPC)')}&bbox=${[box.lon0, box.lat0, box.lon1, box.lat1].map(v => v.toFixed(5)).join(',')}&prodFormats=LAZ&max=200&outputFormat=JSON`;
 const r = await get(url); if (!r.ok) throw Error(`The National Map did not answer (${r.status}).`);
 const items = (await r.json()).items || [];
 // A survey is a work unit: the folder after the project in each tile's address,
 // which is the name of its Entwine copy.
 const units = new Map();
 for (const it of items) {
  const u = it.downloadLazURL || it.downloadURL || '', m = u.match(/\/Projects\/([^/]+)\/([^/]+)\/LAZ\//), unit = m?.[2] ?? m?.[1];
  if (!unit) continue;
  const g = units.get(unit) ?? {source: 'usgs', id: unit, project: m[1], title: unit.replace(/_/g, ' '), date: it.publicationDate ?? '', tiles: 0, bytes: 0, ept: null, tileUrls: []};
  g.tiles++; g.bytes += it.sizeInBytes || 0; g.tileUrls.push({url: u, name: u.split('/').pop(), bytes: it.sizeInBytes || 0}); if ((it.publicationDate ?? '') > g.date) g.date = it.publicationDate; units.set(unit, g);
 }
 // Which have an Entwine copy, and which copies the National Map did not
 // list: by the copies' own boundaries. The copy is often named for the work
 // unit, but not always (Breckenridge's 2016 survey is
 // USGS_LPC_CO_Central_Western_2016_LAS_2018), and some surveys have none
 // yet (Vermont's third statewide block, 1 November 2026).
 const copies = await entwineAt(box, get).catch(() => []), used = new Set();
 for (const g of units.values()) {
  const c = copies.find(x => x.name === g.id) ?? copies.find(x => x.name.includes(g.id.replace(/_[A-Z]?\d+$/, '')) && !used.has(x.name));
  if (c) { g.ept = c.url; g.points = c.count; used.add(c.name); }
 }
 const extra = copies.filter(c => !used.has(c.name)).map(c => ({source: 'usgs', id: c.name, title: c.name.replace(/_/g, ' '), date: (c.name.match(/(19|20)\d\d/g) ?? []).at(-1) ?? '', tiles: 0, points: c.count, ept: c.url, tileUrls: []}));
 return [...units.values(), ...extra].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
// USGS's Entwine copies over a box, from their published boundaries (Hobu's
// usgs-lidar index, about 9 MB, read once a session): [{name, url, count}].
let entwineIndex = null;
const ENTWINE_INDEX = 'https://raw.githubusercontent.com/hobuinc/usgs-lidar/master/boundaries/resources.geojson';
export async function entwineAt(box, get = fetch) {
 entwineIndex ??= (async () => { const r = await get(ENTWINE_INDEX); if (!r.ok) throw Error(`The Entwine index did not answer (${r.status}).`); return (await r.json()).features; })().catch(e => { entwineIndex = null; throw e; });
 const feats = await entwineIndex, lon = (box.lon0 + box.lon1) / 2, lat = (box.lat0 + box.lat1) / 2;
 const inRing = r => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; };
 return feats.filter(f => { const g = f.geometry; if (!g) return false; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return polys.some(p => inRing(p[0])); }).map(f => f.properties);
}
export const forgetEntwineIndex = () => { entwineIndex = null; };
async function searchIgn(box, get) {
 const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=IGNF_LIDAR-HD_METADONNEE:metadata&OUTPUTFORMAT=application/json&COUNT=200&BBOX=${[box.lat0, box.lon0, box.lat1, box.lon1].map(v => v.toFixed(5)).join(',')},urn:ogc:def:crs:EPSG::4326`;
 const r = await get(url); if (!r.ok) throw Error(`IGN did not answer (${r.status}).`);
 const tiles = ((await r.json()).features || []).map(f => f.properties).filter(p => p?.url_npl);
 if (!tiles.length) return [];
 const byMission = new Map();
 for (const p of tiles) { const g = byMission.get(p.code_mission) ?? {source: 'ign', id: p.code_mission, title: `LiDAR HD ${p.code_mission}`, date: String(p.date_fin_acquisition ?? '').slice(0, 10), tiles: 0, points: 0, urls: []}; g.tiles++; g.points += +p.nombre_points || 0; g.urls.push(p.url_npl.replace(/^http:/, 'https:')); byMission.set(p.code_mission, g); }
 return [...byMission.values()];
}

// ---- downloading: a LIDAR source as door 2 reads one (formats.js openSource
// shape: {kind: 'points', form, name, crs, bounds, count, each}).
export async function downloadLidar(found, box, {get = fetch, lazModule, onProgress = () => {}} = {}) {
 if (found.source === 'usgs') return downloadEpt(found, box, {get, lazModule, onProgress});
 if (found.source === 'ign') {
  const {openSource} = await import('../lidar/formats.js'), out = [];
  for (const [n, url] of found.urls.entries()) {
   onProgress(n / found.urls.length, `tile ${n + 1} of ${found.urls.length}`);
   const r = await get(url); if (!r.ok) throw Error(`IGN would not give ${url.split('/').pop()} (${r.status}).`);
   const name = url.split('/').pop();
   out.push({...(await openSource(name, new Uint8Array(await r.arrayBuffer()), {lazModule})), name, downloaded: true});
  }
  return out;
 }
 throw Error('This source is downloaded from its own site.');
}

// The Entwine pieces over the square, their points carried from Web Mercator
// to UTM (the square's middle's zone, NAD83(2011): what 3DEP's own tiles use)
// as they are read.
async function downloadEpt(found, box, {get, lazModule, onProgress}) {
 if (!found.ept) throw Error('This survey has no copy that downloads by the square: download its whole tiles.');
 const er = await get(found.ept); if (!er.ok) throw Error(`This survey's square copy did not answer (${er.status}): download its whole tiles.`);
 const ept = await er.json(), root =found.ept.replace(/ept\.json$/, '');
 if (ept.dataType !== 'laszip') throw Error(`This survey's copy is stored as ${ept.dataType}, which the builder does not read.`);
 const a = lonLatToMerc(box.lon0, box.lat0), b = lonLatToMerc(box.lon1, box.lat1);
 const {nodes} = await nodesFor(ept.bounds, [a.x, a.y, b.x, b.y], async key => { const r = await get(`${root}ept-hierarchy/${key}.json`); if (!r.ok) throw Error(`The survey's index would not load (${r.status}).`); return r.json(); });
 if (!nodes.length) throw Error('This survey has no points over the square.');
 const parts = [];
 for (const [n, node] of nodes.entries()) {
  onProgress(n / nodes.length, `piece ${n + 1} of ${nodes.length}`);
  const r = await get(`${root}ept-data/${node.key}.laz`); if (!r.ok) throw Error(`A piece of the survey would not load (${r.status}).`);
  parts.push(new Uint8Array(await r.arrayBuffer()));
 }
 onProgress(1, 'done');
 const lon = (box.lon0 + box.lon1) / 2, zone = zoneOf(lon), epsg = 6329 + zone;
 const c0 = toUtm(box.lat0, box.lon0, zone), c1 = toUtm(box.lat1, box.lon1, zone), c2 = toUtm(box.lat0, box.lon1, zone), c3 = toUtm(box.lat1, box.lon0, zone);
 const count = nodes.reduce((s, x) => s + x.points, 0), bytes = parts.reduce((s, p) => s + p.length, 0);
 return [{kind: 'points', form: 'ept', name: `${found.title} (USGS 3DEP)`, downloaded: true, bytes, pieces: nodes.length, count,
  crs: {epsg, units: {h: 'metre', v: 'metre'}, wkt: null, geographic: false},
  bounds: {minX: Math.min(c0.x, c3.x), maxX: Math.max(c1.x, c2.x), minY: Math.min(c0.y, c2.y), maxY: Math.max(c1.y, c3.y), minZ: ept.bounds[2], maxZ: ept.bounds[5]},
  async each(f, opts = {}) {
   for (const [n, bytes] of parts.entries()) {
    const header = parseHeader(bytes);
    await readPoints(bytes, header, p => { const g = mercToLonLat(p.x, p.y), u = toUtm(g.lat, g.lon, zone); p.x = u.x; p.y = u.y; f(p); }, {lazModule, ...opts, onProgress: opts.onProgress ? q => opts.onProgress((n + q) / parts.length) : null});
   }
  }}];
}
export {nodeBox};
