// AERIAL IMAGERY FROM GOOGLE OR BING (the owner's amended goal, 31 October
// 2026: "build in google and bing imagery search to use for the picture
// overlay, along with auto sizing and the ability to manually align if
// needed by dragging"; docs/COURSE_BUILDER.md *The amended goal*).
//
// THE ONE PLACE THE BUILDER GOES ONLINE, and only when the player asks: the
// builder otherwise makes no request at all. The player brings their own key
// (Google Maps Platform with the Map Tiles API, or Bing Maps), kept in this
// browser only, never in a file; nothing is sent anywhere but to the provider.
// A fetched picture is kept in the player's own saved files, so a course
// reopens with it (the owner, 5 November 2026), and left out of the copy made
// to share and of what the game keeps. The providers' terms limit tracing their
// pictures into other products and keeping them: the builder says so where the
// key is asked for, and the choice is the player's.
//
// AUTO SIZING: both serve the world as Web Mercator tiles, so every pixel
// has a known latitude and longitude, and a survey with a known map grid
// (geo.js) puts every cell of the land on one -- the picture lands sized and
// placed. Off by a few metres (a survey's datum, the imagery's own error), it
// is dragged into line by hand: `offset` (metres) shifts it.
//
// The tile maths are pure and tested in Node (tests/imagery.test.mjs); the
// fetching and decoding need a browser.

// Web Mercator: degrees to fractional tile coordinates at a zoom, and back.
export function tileOf(lon, lat, z) {
 const n = 2 ** z, s = Math.sin(lat * Math.PI / 180);
 return {x: (lon + 180) / 360 * n, y: (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n};
}
export function lonLatOf(x, y, z) {
 const n = 2 ** z, lon = x / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
 return {lon, lat};
}
// The box of a block of w by h tiles from tile (x, y) at zoom z, in Web
// Mercator metres (EPSG:3857): [xmin, ymin, xmax, ymax], for an image
// service asked for any box (USGS NAIP Plus's exportImage).
export function mercatorBox(x, y, z, w = 1, h = 1) {
 const R = 6378137, span = 2 * Math.PI * R / 2 ** z;
 return [-Math.PI * R + x * span, Math.PI * R - (y + h) * span, -Math.PI * R + (x + w) * span, Math.PI * R - y * span];
}
// Metres a pixel of a 256-pixel tile covers at a latitude and zoom.
export const metresPerPixel = (lat, z) => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
// Bing's tile address.
export function quadkey(x, y, z) { let q = ''; for (let i = z; i > 0; i--) { const m = 1 << (i - 1); q += ((x & m ? 1 : 0) + (y & m ? 2 : 0)); } return q; }
// The zoom for a box (degrees): fine enough for `want` metres a pixel (PLACED:
// 0.3 m, about what the providers serve over US golf courses), coarser until
// the box needs at most `maxTiles` tiles.
export function zoomFor(box, {want = .3, maxTiles = 400, maxZoom = 20} = {}) {
 const lat = (box.lat0 + box.lat1) / 2;
 let z = maxZoom; while (z > 1 && metresPerPixel(lat, z) < want) z--;
 if (metresPerPixel(lat, z) > want && z < maxZoom) z++;
 const count = z => { const a = tileOf(box.lon0, box.lat1, z), b = tileOf(box.lon1, box.lat0, z); return (Math.floor(b.x) - Math.floor(a.x) + 1) * (Math.floor(b.y) - Math.floor(a.y) + 1); };
 while (z > 1 && count(z) > maxTiles) z--;
 return z;
}
// The tiles covering a box at a zoom.
export function tilesFor(box, z) {
 const a = tileOf(box.lon0, box.lat1, z), b = tileOf(box.lon1, box.lat0, z), out = [];
 for (let y = Math.floor(a.y); y <= Math.floor(b.y); y++) for (let x = Math.floor(a.x); x <= Math.floor(b.x); x++) out.push({x, y, z});
 return {tiles: out, x0: Math.floor(a.x), y0: Math.floor(a.y), nx: Math.floor(b.x) - Math.floor(a.x) + 1, ny: Math.floor(b.y) - Math.floor(a.y) + 1};
}

// THE PROVIDERS. Each: `start(key)` whatever a session needs, `tile(x, y, z)`
// a tile's URL, `search(text)` a place by name -> {lon, lat, label}, and the
// credit to show. Google: the Map Tiles API (a session, then 2D satellite
// tiles) and the Geocoding API. Bing: the REST Imagery Metadata (the tile
// URL pattern) and the Locations API.
export const PROVIDERS = {
 google: {
  name: 'Google', keyHelp: 'A Google Maps Platform key with the Map Tiles API (and the Geocoding API to search) turned on.',
  // How to get one, step by step (the owner, 1 November 2026: "Need better
  // instructions for how to enable google satellite map image pulling";
  // Google's own setup page, REFERENCES). Shown under the key box.
  howTo: ['Sign in at console.cloud.google.com and create a project (any name).',
   'Billing: link a billing account to the project. Google asks for one even within its free monthly allowance.',
   'APIs and services, Library: turn on the Map Tiles API, and the Geocoding API if you want to search for a place by name.',
   'APIs and services, Credentials: Create credentials, API key. Copy it into the box above; it stays in this browser only.',
   'Restrict the key to those two APIs (Edit key, API restrictions). A website restriction will not work when the game is opened as a file, which sends no website address.',
   'Optional: set a daily quota on the Map Tiles API so a mistake cannot cost much. One fetch for a course is a few hundred tiles.'],
  terms: 'Google\'s terms (Maps Platform, section 3.2.3) forbid creating content from its imagery outside Google\'s own products, and limit keeping it. Using it to trace a course, and keeping it in your saved file, is your decision and your account\'s; Save a copy to share leaves it out.',
  async start(key, get = fetch) {
   const r = await get(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({mapType: 'satellite', language: 'en-US', region: 'US'})});
   if (!r.ok) throw Error(`Google refused the key (${r.status}). Is the Map Tiles API on for it?`);
   const j = await r.json();
   return {tile: (x, y, z) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(j.session)}&key=${encodeURIComponent(key)}`, credit: 'Imagery © Google', maxZoom: 21};
  },
  async search(key, text, get = fetch) {
   const j = await (await get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${encodeURIComponent(key)}`)).json();
   return (j.results || []).slice(0, 5).map(r => ({lon: r.geometry.location.lng, lat: r.geometry.location.lat, label: r.formatted_address}));
  },
 },
 bing: {
  name: 'Bing', keyHelp: 'A Bing Maps key.',
  howTo: ['Microsoft no longer gives out Bing Maps keys to new users: free and Basic accounts ended on 30 June 2025, and Enterprise accounts run to 30 June 2028 (Microsoft\'s notice, REFERENCES).',
   'If you already have a Bing Maps key (from bingmapsportal.com), paste it above and it works as before.',
   'Otherwise use Google, or the free national imagery where it covers the course.'],
  terms: 'Microsoft\'s Bing Maps terms limit what may be made from its imagery; Microsoft has let OpenStreetMap trace it, but a course you share is your decision and your account\'s. It is kept in your saved file; Save a copy to share leaves it out.',
  async start(key, get = fetch) {
   const r = await get(`https://dev.virtualearth.net/REST/v1/Imagery/Metadata/Aerial?key=${encodeURIComponent(key)}&uriScheme=https&output=json`);
   if (!r.ok) throw Error(`Bing refused the key (${r.status}).`);
   const res = (await r.json()).resourceSets?.[0]?.resources?.[0];
   if (!res?.imageUrl) throw Error('Bing sent no imagery address for that key.');
   const subs = res.imageUrlSubdomains || ['t0'];
   return {tile: (x, y, z) => res.imageUrl.replace('{subdomain}', subs[(x + y) % subs.length]).replace('{quadkey}', quadkey(x, y, z)).replace('{culture}', 'en-US'), credit: 'Imagery © Microsoft (Bing)', maxZoom: res.zoomMax ?? 19};
  },
  async search(key, text, get = fetch) {
   const j = await (await get(`https://dev.virtualearth.net/REST/v1/Locations?q=${encodeURIComponent(text)}&key=${encodeURIComponent(key)}&output=json`)).json();
   return (j.resourceSets?.[0]?.resources || []).slice(0, 5).map(r => ({lat: r.point.coordinates[0], lon: r.point.coordinates[1], label: r.name}));
  },
 },
};

// THE FREE ONES (RESEARCH, *Free aerial imagery for the builder*): national
// aerial photography with no key, each offered only where it covers the land
// ([lon0, lat0, lon1, lat1], loose). A WMTS's tile at a Web Mercator zoom.
const wmts = (base, layer, matrixSet, style = 'default', format = 'image/jpeg') => (x, y, z) => `${base}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=${style}&TILEMATRIXSET=${matrixSet}&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=${encodeURIComponent(format)}`;
const free = o => ({...o, free: true, async start() { return {tile: o.tile, credit: o.credit, maxZoom: o.maxZoom, block: o.block ?? 1}; }, search: nominatim});
// A place by name through OpenStreetMap's Nominatim (its policy: light use, a
// search a second at most -- one press of Search is one request).
async function nominatim(_key, text, get = fetch) {
 const j = await (await get(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(text)}`)).json();
 // `golf`: the place is a golf course on the map (leisure=golf_course), so Build
 // it for me can tell the club from the town it is named after (builder-ux).
 return j.map(r => ({lon: +r.lon, lat: +r.lat, label: r.display_name, ...(r.type === 'golf_course' ? {golf: true} : {})}));
}
Object.assign(PROVIDERS, {
// THE SHARPEST FREE US PICTURE (the builder-ux goal, 10 November 2026; the
 // owner: "our images that get overlayed onto the course are not very high
 // resolution"): USGS's NAIP Plus image service, the same NAIP and
 // high-resolution photographs as the USGS tiles below but at their own
 // resolution (30 cm a pixel at its finest, 60 cm for most of NAIP) instead
 // of stopping at about 1.7 m. It is not a tile cache: it exports any box, up
 // to 4,000 pixels square, so it is asked for a block of four by four tiles
 // (1,024 pixels) at a time. It allows any origin, so the page fetches it
 // directly. RESEARCH, *Sharper pictures for the builder*.
 naip: free({name: 'USGS NAIP, sharpest (United States)', covers: [-180, 17, -64, 72], maxZoom: 20, block: 4, credit: 'USDA NAIP, USGS The National Map: Orthoimagery',
  terms: 'United States government imagery (NAIP and high-resolution orthoimagery): free to use. The sharpest free source here: 60 cm a pixel or finer.',
  tile: (x, y, z, w = 1, h = 1) => `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox=${mercatorBox(x, y, z, w, h).map(v => v.toFixed(2)).join(',')}&bboxSR=3857&imageSR=3857&size=${256 * w},${256 * h}&format=jpg&f=image`}),
 usgs: free({name: 'USGS tiles (United States)', covers: [-180, 17, -64, 72], maxZoom: 16, credit: 'USDA, USGS The National Map: Orthoimagery',
  terms: 'United States government imagery (NAIP): free to use. Its tiles stop at about 1.7 m a pixel: USGS NAIP, sharpest, is the same photographs at their own sharpness.',
  tile: (x, y, z) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`}),
 ign: free({name: 'IGN (France)', covers: [-5.5, 41, 10, 51.5], maxZoom: 19, credit: '© IGN, BD ORTHO (Licence Ouverte 2.0)',
  terms: 'Licence Ouverte 2.0: free to use, the source credited.', tile: wmts('https://data.geopf.fr/wmts', 'ORTHOIMAGERY.ORTHOPHOTOS', 'PM', 'normal')}),
 pdok: free({name: 'PDOK (Netherlands)', covers: [3.2, 50.7, 7.3, 53.6], maxZoom: 19, credit: '© Beeldmateriaal.nl, PDOK (CC BY 4.0)',
  terms: 'CC BY 4.0: free to use, the source credited.', tile: (x, y, z) => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/${z}/${x}/${y}.jpeg`}),
 pnoa: free({name: 'PNOA (Spain)', covers: [-18.5, 27.5, 4.5, 44], maxZoom: 19, credit: 'PNOA cedido por © Instituto Geográfico Nacional (CC BY 4.0)',
  terms: 'CC BY 4.0: free to use, the source credited.', tile: wmts('https://www.ign.es/wmts/pnoa-ma', 'OI.OrthoimageCoverage', 'GoogleMapsCompatible')}),
 swisstopo: free({name: 'swisstopo (Switzerland)', covers: [5.9, 45.8, 10.5, 47.9], maxZoom: 19, credit: '© swisstopo, SWISSIMAGE',
  terms: 'Free for every use since March 2021, the source credited.', tile: (x, y, z) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`}),
});
// The providers that cover a point: the free ones there, then Google and Bing.
export const providersAt = (lon, lat) => Object.entries(PROVIDERS).filter(([, p]) => !p.covers || (lon >= p.covers[0] && lon <= p.covers[2] && lat >= p.covers[1] && lat <= p.covers[3])).sort((a, b) => (b[1].free ? 1 : 0) - (a[1].free ? 1 : 0)).map(([k]) => k);

// The tiles over a box, fetched and stitched: a picture {width, height, rgb,
// nir: null, toPixel(lon, lat) -> [col, row]}. `onProgress(f)`; `get` and
// `decode` stand in for fetch and createImageBitmap in a test.
// A session with a `block` (USGS NAIP Plus) is asked for blocks of that many
// tiles a side, `tile(x, y, z, w, h)` a block's URL; the rest tile by tile.
// `maxTiles` (PLACED: 640, up from 400 on 10 November 2026, the builder-ux
// goal) bounds the picture: 640 tiles is about 42 million pixels, the size of
// a 3 km square at half a metre a pixel.
export async function mosaic(session, box, {want = .3, maxTiles = 640, onProgress = () => {}, get = fetch, decode = b => createImageBitmap(b)} = {}) {
 const z = Math.min(session.maxZoom ?? 20, zoomFor(box, {want, maxTiles})), t = tilesFor(box, z), n = Math.max(1, session.block ?? 1);
 const canvas = new OffscreenCanvas(t.nx * 256, t.ny * 256), cx = canvas.getContext('2d');
 const blocks = [];
 for (let by = 0; by < t.ny; by += n) for (let bx = 0; bx < t.nx; bx += n) blocks.push({x: t.x0 + bx, y: t.y0 + by, w: Math.min(n, t.nx - bx), h: Math.min(n, t.ny - by)});
 let done = 0, missing = 0;
 const queue = blocks.slice(), work = async () => {
  for (let q; (q = queue.shift());) {
   try { const r = await get(n > 1 ? session.tile(q.x, q.y, z, q.w, q.h) : session.tile(q.x, q.y, z)); if (!r.ok) throw Error(r.status); cx.drawImage(await decode(await r.blob()), (q.x - t.x0) * 256, (q.y - t.y0) * 256); }
   catch { missing++; }
   onProgress(++done / blocks.length);
  }
 };
 await Promise.all(Array.from({length: 6}, work));
 if (missing === blocks.length) throw Error('No imagery came back for this place.');
 const d = cx.getImageData(0, 0, canvas.width, canvas.height).data, N = canvas.width * canvas.height, rgb = new Uint8Array(N * 3);
 for (let k = 0; k < N; k++) { rgb[k * 3] = d[k * 4]; rgb[k * 3 + 1] = d[k * 4 + 1]; rgb[k * 3 + 2] = d[k * 4 + 2]; }
 const tile = {z, x0: t.x0, y0: t.y0};
 return {width: canvas.width, height: canvas.height, rgb, nir: null, z, missing, credit: session.credit, tile, toPixel: tilePixel(tile)};
}
// A mosaic's pixel for a longitude and latitude, from its zoom and its first tile.
export const tilePixel = ({z, x0, y0}) => (lon, lat) => { const p = tileOf(lon, lat, z); return [(p.x - x0) * 256 - .5, (p.y - y0) * 256 - .5]; };
