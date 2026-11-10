// BUILD IT FOR ME (the builder-ux goal, item 6, 10 November 2026): a course's
// name typed, one press, and door 2 runs its own steps -- the place, the
// newest USGS survey over the square downloaded, the land, the sharpest
// picture, OpenStreetMap's course lined up with the LIDAR, its holes, its name
// -- to the review. Every service is stood in for (page.route): the place
// search answers a town and the golf course named after it (the course wins
// without asking), USGS's Entwine copy one piece of points
// (lidar-folder.mjs), USGS NAIP a picture, OpenStreetMap the nine-hole club of
// door-real-osm.mjs. The same run on a real course, against the real
// services, is bench/shots/build-for-me.mjs (local): Worthington Country Club
// in 3 min 52 s.
// Registered by tools/builder-smoke.mjs.
import {piece} from './lidar-folder.mjs';
import {answer} from './door-real-osm.mjs';
import {tilePng} from './door-real.mjs';

const GEO = {lat: 43.63, lon: -95.62};

export default function ({journey}) {
 journey('builder-build-for-me', 'Build it for me: a course name, one press, door 2\'s steps run to the review -- the club chosen over its town, the survey downloaded, the land, the picture, OpenStreetMap\'s nine holes lined up', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  const EPT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/MN_TEST_1_B21/';
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/tnmaccess\.nationalmap\.gov\//, /^https:\/\/raw\.githubusercontent\.com\/hobuinc\//, /^https:\/\/s3-us-west-2\.amazonaws\.com\/usgs-lidar-public\//, /^https:\/\/imagery\.nationalmap\.gov\//, /^https:\/\/overpass-api\.de\//);
  const json = body => ({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(body)});
  const {bytes, cube} = piece(); const asked = {place: 0, osm: 0, picture: 0, pieces: 0};
  await page.route(/nominatim\.openstreetmap\.org/, r => { asked.place++; return r.fulfill(json([
   {lon: '-95.60', lat: '43.62', display_name: 'Testville, Nobles County, Minnesota', class: 'place', type: 'town'},
   {lon: String(GEO.lon), lat: String(GEO.lat), display_name: 'Testville Golf Club, Testville, Minnesota', class: 'leisure', type: 'golf_course'}])); });
  await page.route(/raw\.githubusercontent\.com\/hobuinc/, r => r.fulfill(json({features: [{properties: {name: 'MN_TEST_1_B21', url: EPT + 'ept.json', count: 4e4}, geometry: {type: 'Polygon', coordinates: [[[-96, 43], [-95, 43], [-95, 44], [-96, 44], [-96, 43]]]}}]})));
  await page.route(/tnmaccess\.nationalmap\.gov/, r => r.fulfill(json({items: []})));
  await page.route(/usgs-lidar-public\/MN_TEST_1_B21\//, r => {
   const u = r.request().url();
   if (u.endsWith('ept.json')) return r.fulfill(json({dataType: 'laszip', bounds: cube}));
   if (u.includes('ept-hierarchy/')) return r.fulfill(json({'0-0-0-0': 40000}));
   asked.pieces++; return r.fulfill({status: 200, contentType: 'application/octet-stream', headers: {'Access-Control-Allow-Origin': '*'}, body: bytes});
  });
  await page.route(/imagery\.nationalmap\.gov/, r => { asked.picture++; return r.fulfill({status: 200, contentType: 'image/png', headers: {'Access-Control-Allow-Origin': '*'}, body: tilePng([96, 140, 74])}); });
  await page.route(/overpass-api\.de/, r => { asked.osm++; return r.fulfill(json(answer())); });
  // No folder picker in a script: the square is saved the browser's way.
  await page.evaluate(() => { window.showDirectoryPicker = undefined; });
  page.on('download', d => d.cancel().catch(() => {}));

  await page.getByRole('button', {name: /Generate a real life course/}).click();
  await page.locator('.cb-buildname').fill('Testville Golf Club');
  await t.shot('start');
  const t0 = Date.now();
  await page.getByRole('button', {name: 'Build it for me', exact: true}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.built || /OpenStreetMap has no course|No USGS|Nothing found|failed|Could not/.test(document.querySelector('.cb-note')?.textContent ?? ''), null, {timeout: 600000});
  await page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  const st = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return {step: s.step, find: s.find?.label, name: s.name, holesN: s.holesN, marked: s.holes.slice(0, s.holesN).filter(h => h?.green && h.tees.length).length, pics: s.pics.map(p => p.group), land: !!s.land, trace: s.traceMode, built: s.built, note: document.querySelector('.cb-note').textContent}; });
  if (!st.built) throw Error(`Build it for me stopped: ${st.note}`);
  if (!/Golf Club/.test(st.find)) throw Error(`the golf course should win over the town: ${st.find}`);
  if (!st.land || !st.pics.includes('naip') || !/^openstreetmap\+lidar$/.test(st.trace)) throw Error(`every step should have run: ${JSON.stringify(st)}`);
  if (st.holesN !== 9 || st.marked !== 9) throw Error(`OpenStreetMap's nine holes should be marked: ${st.marked} of ${st.holesN}`);
  if (st.step !== 5) throw Error(`a complete course should land on the review, not step ${st.step + 1}`);
  if (asked.place !== 1 || !asked.pieces || !asked.picture || asked.osm !== 1) throw Error(`each service asked once (the picture in blocks): ${JSON.stringify(asked)}`);
  console.log(`       built in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${st.built.steps.join(' ')}`);
  await t.shot('review');
 });
}
