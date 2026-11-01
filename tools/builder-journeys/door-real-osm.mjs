// Door 2 from OpenStreetMap (the owner, 1 November 2026: "Pull in the open
// maps tracing first. Give the user the option to keep it"): the made-up
// survey of door-real.mjs, the place searched for, OpenStreetMap fetched --
// stood in for by the journey (page.route) with the survey's nine holes drawn
// as a mapper would: greens, fairways, a bunker, numbered hole lines with par
// -- kept as drawn; the holes' markers already set from the map; the name;
// the painted review; the editor; saved; and the game plays it.
// Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import {surveyLas} from './door-real.mjs';
import {playOneShot} from './door-generate.mjs';

const GEO = {lat: 43.63, lon: -95.62};
// Local metres to degrees as door 2 does round a place found by name.
const ll = (x, z) => ({lat: GEO.lat - z / 111320, lon: GEO.lon + x / (111320 * Math.cos(GEO.lat * Math.PI / 180))});
const way = (tags, pts) => ({type: 'way', tags, geometry: pts.map(([x, z]) => ll(x, z))});
const disc = (x, z, r) => { const p = Array.from({length: 24}, (_, k) => [x + r * Math.cos(k / 24 * 2 * Math.PI), z + r * Math.sin(k / 24 * 2 * Math.PI)]); return [...p, p[0]]; };
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
function answer() {
 const elements = [];
 for (let n = 0; n < 9; n++) {
  const x = -160 + n * 40;
  elements.push(way({golf: 'green'}, disc(x, -110, 11)), way({golf: 'fairway'}, rect(x - 12, -95, x + 12, 95)), way({golf: 'tee'}, rect(x - 3, 115, x + 3, 125)),
   way({golf: 'hole', ref: String(n + 1), par: '4'}, [[x, 120], [x, -110]]));
 }
 elements.push(way({golf: 'bunker'}, disc(-148, -104, 4)));
 return {elements};
}

export default function ({journey, SHOTS}) {
 journey('builder-door-2-osm', 'door 2 from OpenStreetMap: the map fetched (stood in for), kept as drawn, its nine numbered holes set as markers; reviewed, edited, saved and played', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/overpass-api\.de\//);
  let asked = 0;
  await page.route(/nominatim\.openstreetmap\.org/, r => r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify([{lon: String(GEO.lon), lat: String(GEO.lat), display_name: 'A test place, Minnesota'}])}));
  await page.route(/overpass-api\.de/, r => { asked++; return r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(answer())}); });
  const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  const las = path.join(SHOTS, 'door-2-osm-survey.las');
  fs.writeFileSync(las, surveyLas());
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: 'Choose LIDAR files'}).click()]);
  await chooser.setFiles(las);
  await page.waitForFunction(() => window.fairwayBuilder.door2?.preview, null, {timeout: 60000}); await idle();
  await page.getByRole('button', {name: 'Next: build the land'}).click();
  await page.getByRole('button', {name: 'Build the land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.land, null, {timeout: 120000}); await idle();
  await page.getByRole('button', {name: 'Next: trace the course'}).click();
  // The place, then OpenStreetMap.
  await page.locator('.cb-provider').selectOption('usgs');
  await page.getByPlaceholder(/A place/).fill('A test place');
  await page.getByRole('button', {name: 'Find', exact: true}).click();
  await page.getByText('A test place, Minnesota').click();
  await page.getByRole('button', {name: 'Fetch OpenStreetMap'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.osm, null, {timeout: 60000}); await idle();
  if (asked !== 1) throw Error(`OpenStreetMap should be asked once, not ${asked}`);
  const got = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {layers: st.model.layersPresent(), green: st.model.kindAt(-160, -110), sand: st.model.kindAt(-148, -104), fairway: st.model.kindAt(-160, 0), holes: st.holes.filter(h => h?.green).length, credits: st.credits}; });
  if (got.green !== 'green' || got.sand !== 'sand' || got.fairway !== 'fairway') throw Error(`the map's surfaces should be laid where it draws them: ${JSON.stringify(got)}`);
  if (got.holes !== 9) throw Error(`the map's nine numbered holes should be set as markers, not ${got.holes}`);
  if (!got.credits.some(c => /OpenStreetMap/.test(c))) throw Error('OpenStreetMap should be credited');
  await page.getByRole('button', {name: 'Keep it as drawn'}).click();
  await t.shot('osm');
  await page.getByRole('button', {name: 'Next: the holes'}).click();
  await page.getByRole('button', {name: 'Next: the name'}).click();
  await page.locator('.cb-name').fill('Door 2 from the map');
  await page.getByRole('button', {name: 'Next: review the course'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.doc, null, {timeout: 120000}); await idle();
  const doc = await page.evaluate(() => { const d = window.fairwayBuilder.door2.doc; return {holes: d.holes.length, par: d.holes[0].par, credits: d.credits}; });
  if (doc.holes !== 9) throw Error(`the course should have nine holes, not ${doc.holes}`);
  console.log(`       OpenStreetMap laid: ${got.layers.join(', ')}; ${got.holes} holes from its numbered lines`);
  await t.shot('review');
  await page.getByRole('button', {name: 'Open in the editor'}).click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.getByRole('button', {name: 'Save as a .fairway file'}).click()]);
  const file = path.join(SHOTS, 'builder-door-2-osm.fairway');
  await download.saveAs(file);
  await playOneShot(t, fs.readFileSync(file), 'builder-door-2-osm');
 });
}
