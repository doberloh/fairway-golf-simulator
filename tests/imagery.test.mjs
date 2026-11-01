// Google and Bing imagery's tile maths (src/builder/imagery.js): Web
// Mercator both ways, Bing's quadkeys, the zoom chosen for a course, and the
// providers' addresses -- against a fake fetch, never the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tileOf, lonLatOf, metresPerPixel, quadkey, zoomFor, tilesFor, PROVIDERS} from '../src/builder/imagery.js';

test('Web Mercator tiles round-trip, and match the published examples', () => {
 // The tile holding a point at zoom 1, and Bing's documented quadkey example.
 assert.deepEqual([Math.floor(tileOf(-1, 1, 1).x), Math.floor(tileOf(-1, 1, 1).y)], [0, 0]);
 assert.equal(quadkey(3, 5, 3), '213');
 const p = tileOf(-95.624, 43.627, 18), back = lonLatOf(p.x, p.y, 18);
 assert.ok(Math.abs(back.lon + 95.624) < 1e-9 && Math.abs(back.lat - 43.627) < 1e-9);
 // About 0.43 m a pixel at zoom 18 over Worthington.
 assert.ok(Math.abs(metresPerPixel(43.627, 18) - .432) < .005);
});

test('a course gets fine tiles, and a big box coarser ones under the cap', () => {
 const course = {lon0: -95.629, lat0: 43.624, lon1: -95.619, lat1: 43.631};
 const z = zoomFor(course);
 assert.ok(metresPerPixel(43.627, z) <= .45, `zoom ${z}`);
 assert.ok(tilesFor(course, z).tiles.length <= 400);
 const county = {lon0: -96, lat0: 43.4, lon1: -95.4, lat1: 43.8};
 assert.ok(tilesFor(county, zoomFor(county)).tiles.length <= 400);
});

test('the providers ask for a session or metadata with the key, then build tile addresses', async () => {
 const seen = [];
 const fake = body => async (url, opts) => { seen.push({url, opts}); return {ok: true, json: async () => body}; };
 const g = await PROVIDERS.google.start('K E Y', fake({session: 'S1'}));
 assert.match(seen[0].url, /createSession\?key=K%20E%20Y/);
 assert.equal(JSON.parse(seen[0].opts.body).mapType, 'satellite');
 assert.equal(g.tile(1, 2, 3), 'https://tile.googleapis.com/v1/2dtiles/3/1/2?session=S1&key=K%20E%20Y');
 const b = await PROVIDERS.bing.start('k', fake({resourceSets: [{resources: [{imageUrl: 'https://{subdomain}.example/tiles/a{quadkey}.jpeg?g=1', imageUrlSubdomains: ['t0', 't1'], zoomMax: 19}]}]}));
 assert.equal(b.tile(3, 5, 3), 'https://t0.example/tiles/a213.jpeg?g=1');
 assert.equal(b.maxZoom, 19);
 const found = await PROVIDERS.bing.search('k', 'Worthington', fake({resourceSets: [{resources: [{name: 'Worthington, MN', point: {coordinates: [43.62, -95.6]}}]}]}));
 assert.deepEqual(found[0], {lat: 43.62, lon: -95.6, label: 'Worthington, MN'});
 await assert.rejects(PROVIDERS.google.start('bad', async () => ({ok: false, status: 403})), /refused the key/);
});

test('the free providers need no key, cover their own country, and build tile addresses', async () => {
 const {providersAt} = await import('../src/builder/imagery.js');
 assert.deepEqual(providersAt(-95.6, 43.6).slice(0, 1), ['usgs']);
 assert.ok(providersAt(2.35, 48.85).includes('ign') && !providersAt(2.35, 48.85).includes('usgs'));
 assert.ok(providersAt(-95.6, 43.6).includes('google') && providersAt(-95.6, 43.6).includes('bing'));
 const s = await PROVIDERS.usgs.start();
 assert.equal(s.tile(30720, 47848, 16), 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/16/47848/30720');
 assert.equal(s.maxZoom, 16);
 assert.match((await PROVIDERS.ign.start()).tile(1, 2, 17), /LAYER=ORTHOIMAGERY\.ORTHOPHOTOS.*TILEMATRIX=17&TILEROW=2&TILECOL=1/);
 const found = await PROVIDERS.pdok.search(null, 'Amsterdam', async () => ({json: async () => [{lon: '4.9', lat: '52.37', display_name: 'Amsterdam'}]}));
 assert.deepEqual(found[0], {lon: 4.9, lat: 52.37, label: 'Amsterdam'});
});
