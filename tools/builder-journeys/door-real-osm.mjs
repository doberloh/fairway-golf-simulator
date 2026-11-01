// Door 2 from OpenStreetMap (the owner, 1 November 2026: "Pull in the open
// maps tracing first. Give the user the option to keep it"): the made-up
// survey of door-real.mjs, the place searched for, OpenStreetMap fetched --
// stood in for by the journey (page.route) with the survey's nine holes drawn
// as a mapper would: greens, fairways, a bunker, numbered hole lines with par
// -- kept as drawn; the holes' markers already set from the map; whose trees
// (the survey's and the map's two, merged, or either alone); outside the
// boundary filled keeping the map's pond and house there, undone, and filled
// removing them; the name; the painted review; the editor; saved; and the
// game plays it.
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
 // The course's boundary, and a house beside the eighth.
 elements.push(way({leisure: 'golf_course'}, rect(-190, -140, 190, 140)), way({building: 'house'}, rect(108, 20, 126, 34)));
 // Outside the boundary, a pond and a neighbour's house (kept or removed when
 // filling outside); two single trees, one 2 m from a tree the survey found
 // (left out when merged), one in the open rough.
 elements.push(way({natural: 'water'}, disc(200, 80, 6)), way({building: 'house'}, rect(195, -6, 209, 6)));
 for (const [x, z] of [[-160, 152], [20, 60]]) elements.push({type: 'node', tags: {natural: 'tree'}, ...ll(x, z)});
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
  // Whose trees (the owner, 1 November 2026: the survey's trees were lost
  // when OpenStreetMap had any of its own): merged by default -- every tree
  // the survey found, and the map's one in the open; the map's other stands
  // 2 m from a survey tree and is left out.
  const trees = () => page.evaluate(() => { const st = window.fairwayBuilder.door2; return {lidar: st.trees.length, now: st.model.state.trees.length}; });
  const t0 = await trees();
  if (!(t0.lidar > 0) || t0.now !== t0.lidar + 1) throw Error(`the survey's trees should stay, with the map's one in the open: ${JSON.stringify(t0)}`);
  await page.locator('.cb-treesfrom').selectOption('osm');
  if ((await trees()).now !== 2) throw Error('OpenStreetMap\'s only should be its two trees');
  await page.locator('.cb-treesfrom').selectOption('lidar');
  if ((await trees()).now !== t0.lidar) throw Error('the LIDAR\'s only should be the survey\'s trees');
  await page.locator('.cb-treesfrom').selectOption('merge');
  // The trees choice stays inside the steps' column (it ran off it).
  const fits = await page.evaluate(() => { const s = document.querySelector('.cb-treesfrom').getBoundingClientRect(), c = document.querySelector('.cb-steps').getBoundingClientRect(); return s.right <= c.right + 1 && s.left >= c.left - 1; });
  if (!fits) throw Error('the trees choice should fit inside the steps\' column');
  await page.getByRole('button', {name: 'Keep it as drawn'}).click();
  if ((await trees()).now !== t0.lidar + 1) throw Error('Keep it as drawn should keep the merged trees');
  // Its boundary and its houses came with it; outside the boundary, filled
  // keeping what the map put there, then (after Undo) removing it.
  const kept = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {boundary: st.boundary?.length ?? 0, homes: st.model.state.homes.length, trees: st.model.state.trees.length, pond: st.model.kindAt(200, 80)}; });
  if (!kept.boundary || kept.homes !== 2 || kept.pond !== 'water') throw Error(`OpenStreetMap's boundary, houses and pond should come with it: ${JSON.stringify(kept)}`);
  await page.locator('.cb-outside').selectOption('keep');
  await page.getByRole('button', {name: 'Fill outside it'}).click(); await idle();
  const keptOut = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {homes: st.model.state.homes.length, pond: st.model.kindAt(200, 80), out: st.model.kindAt(-200, 0)}; });
  if (keptOut.homes !== 2 || keptOut.pond !== 'water' || keptOut.out === 'fairway') throw Error(`filling outside and keeping should leave the map's pond and house: ${JSON.stringify(keptOut)}`);
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  await page.locator('.cb-outside').selectOption('remove');
  await page.getByRole('button', {name: 'Fill outside it'}).click(); await idle();
  const gone = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {homes: st.model.state.homes.length, pond: st.model.kindAt(200, 80)}; });
  if (gone.homes !== 1 || gone.pond === 'water') throw Error(`filling outside and removing should take the map's pond and the house outside: ${JSON.stringify(gone)}`);
  const filled = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {trees: st.model.state.trees.length, out: st.model.kindAt(-200, 0), inside: st.model.kindAt(-160, 0)}; });
  if (!(filled.trees > kept.trees) || filled.inside !== 'fairway' || ['fairway', 'green', 'tee'].includes(filled.out)) throw Error(`outside the boundary should become the landscape's wood: ${JSON.stringify(filled)}`);
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
  // The house OpenStreetMap gave is drawn in the editor; the House tool
  // stands another where clicked.
  const drawn = () => page.evaluate(() => { const v = window.fairwayBuilder.editor.view; let n = 0; v.scene.traverse(o => { if (o.isInstancedMesh && o.material.color?.getHexString() === 'd67860') n += o.count; }); return {drawn: n, stored: window.fairwayBuilder.editor.editor.state.homes.length}; });
  const h0 = await drawn();
  if (h0.stored < 1 || h0.drawn !== h0.stored) throw Error(`the editor should draw the course's houses: ${JSON.stringify(h0)}`);
  await page.getByRole('button', {name: 'House', exact: true}).click();
  const vb = await page.locator('.cb-view canvas').boundingBox();
  // On the fairway it is refused; on the rough at the side it stands.
  await page.mouse.click(vb.x + vb.width / 2, vb.y + vb.height * .7);
  if ((await drawn()).stored !== h0.stored) throw Error('a house on the fairway should be refused');
  await page.mouse.click(vb.x + vb.width * .28, vb.y + vb.height * .62);
  const h1 = await drawn();
  if (h1.stored !== h0.stored + 1 || h1.drawn !== h1.stored) throw Error(`the House tool should stand a house where clicked: ${JSON.stringify([h0, h1])}`);
  await t.shot('editor-houses');
  // Undo takes it away again (it stood in front of hole 1's tee, where the
  // game's tee shot below would hit it).
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  const h2 = await drawn();
  if (h2.stored !== h0.stored || h2.drawn !== h0.stored) throw Error(`Undo should take the house away: ${JSON.stringify([h1, h2])}`);
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const file = path.join(SHOTS, 'builder-door-2-osm.fairway');
  await download.saveAs(file);
  await playOneShot(t, fs.readFileSync(file), 'builder-door-2-osm');
 });
}
