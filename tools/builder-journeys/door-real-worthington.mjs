// Door 2 on the real test course, through the page (the course builder,
// stage 7; docs/COURSE_BUILDER.md, *The test course*): Worthington's four raw
// LAZ tiles chosen in the builder, the property dragged round the club, the
// land built, four NAIP tiles laid by their position, eighteen holes clicked
// on the plan where OpenStreetMap's greens and the card's tees are
// (osm-holes.mjs, the same marks as the scripted build), the trace LIDAR
// first, the editor, the file saved -- then that file measured against USGS's
// DEM, the other pipeline's terrain model, OpenStreetMap and the card
// (built-compare.mjs), and played in the game.
//
// LOCAL ONLY: registered when FAIRWAY_LIDAR_TEST names the owner's folder
// (raw/*.laz, course.json, terrain/dtm_0p5m.tif) and the NAIP tiles, the DEM,
// the OpenStreetMap extract and the card are in bench/shots/lidar/ (ignored).
// Nothing it reads or writes is committed.
import path from 'node:path';
import fs from 'node:fs';
import {toUtm, utmOfEpsg} from '../../src/lidar/geo.js';
import {osmWays, holesFromOsm} from '../osm-holes.mjs';
import {compareBuilt} from '../built-compare.mjs';
import {playOneShot} from './door-generate.mjs';

export default function ({journey, ROOT, SHOTS}) {
 const dir = process.env.FAIRWAY_LIDAR_TEST, data = path.join(ROOT, 'bench', 'shots', 'lidar');
 const naip = fs.existsSync(data) ? fs.readdirSync(data).filter(f => /^naip-.*\.tif$/.test(f)).map(f => path.join(data, f)) : [];
 const need = [path.join(data, 'worthington-osm-golf.json'), path.join(data, 'worthington-scorecard.json')];
 if (!dir || !fs.existsSync(path.join(dir, 'raw')) || !naip.length || need.some(f => !fs.existsSync(f))) return;
 journey('builder-door-2-worthington', 'LOCAL: Worthington through door 2\'s page -- four LAZ tiles, the property, four NAIP tiles, eighteen holes clicked, the trace, saved; the file against USGS\'s DEM, OpenStreetMap and the card, and played', async t => {
  const {page} = t, T0 = Date.now(), secs = () => `${((Date.now() - T0) / 1000).toFixed(0)} s`, say = s => console.log('       ' + s);
  await page.setViewportSize({width: 1600, height: 1300});
  const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 600000});
  const course = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8')), osm = JSON.parse(fs.readFileSync(need[0], 'utf8')), card = JSON.parse(fs.readFileSync(need[1], 'utf8'));
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  // 1. The four tiles.
  const tiles = fs.readdirSync(path.join(dir, 'raw')).filter(f => /\.laz$/i.test(f)).map(f => path.join(dir, 'raw', f));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: 'Choose LIDAR files'}).click()]);
  await chooser.setFiles(tiles);
  await page.waitForFunction(() => window.fairwayBuilder.door2?.preview, null, {timeout: 600000}); await idle();
  say(`tiles read and previewed: ${secs()}`);
  // 2. The property: the club's box and 30 m, dragged on the plan.
  const epsg = await page.evaluate(() => { const s = window.fairwayBuilder.door2.sources[0]; return s.crs.epsg; }), zone = utmOfEpsg(epsg).zone;
  const [lon0, lat0, lon1, lat1] = course.bbox_lonlat, a = toUtm(lat1, lon0, zone), b = toUtm(lat0, lon1, zone);
  const plan = page.locator('canvas.cb-plan');
  await plan.scrollIntoViewIfNeeded();
  const toPlan = async (mx, my, which) => { const [cx, cy] = await page.evaluate(([mx, my, which]) => { const st = window.fairwayBuilder.door2, g = which === 'preview' ? st.preview.gridder : st.gridder, p = g.local(mx, my); return st.toCanvas(p.x, p.z); }, [mx, my, which]); const box = await plan.boundingBox(); return [box.x + cx * box.width / 900, box.y + cy * box.height / 900]; };
  const [ax, ay] = await toPlan(a.x - 30, a.y + 30, 'preview'), [bx, by] = await toPlan(b.x + 30, b.y - 30, 'preview');
  await page.mouse.move(ax, ay); await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(ax + (bx - ax) * k / 10, ay + (by - ay) * k / 10);
  await page.mouse.up();
  const boxText = await page.evaluate(() => { const b = window.fairwayBuilder.door2.box; return b; });
  if (!(boxText.x1 - boxText.x0 > 700 && boxText.x1 - boxText.x0 < 1000)) throw Error(`the property box is ${JSON.stringify(boxText)}`);
  // 3. The land.
  await page.getByRole('button', {name: 'Build the land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.land, null, {timeout: 900000}); await idle();
  const landSays = await page.locator('.cb-note').first().textContent();
  say(`land: ${landSays} (${secs()})`);
  // 4. The pictures, one tile at a time.
  for (const f of naip) {
   const [pc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: 'Choose a picture'}).click()]);
   await pc.setFiles(f); await page.waitForTimeout(500); await idle();
  }
  const cover = await page.evaluate(() => { const p = window.fairwayBuilder.door2.picture; return p.has.reduce((s, v) => s + v, 0) / p.has.length; });
  if (cover < .95) throw Error(`the pictures cover ${(100 * cover).toFixed(0)}% of the land`);
  await t.shot('worthington-picture');
  // 5. The holes, clicked.
  const origin = await page.evaluate(() => { const g = window.fairwayBuilder.door2.gridder; return {...g.center, u: g.unit.h}; });
  const ways = osmWays(osm, (lat, lon) => { const p = toUtm(lat, lon, zone); return {x: (p.x - origin.x) * origin.u, z: -(p.y - origin.y) * origin.u}; });
  const holes = holesFromOsm(ways, card);
  if (holes.length !== 18) throw Error(`OpenStreetMap and the card give ${holes.length} holes`);
  const click = async (x, z) => { await plan.scrollIntoViewIfNeeded(); const [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]); const box = await plan.boundingBox(); await page.mouse.click(box.x + cx * box.width / 900, box.y + cy * box.height / 900); };
  const mark = name => page.locator('button[data-mark="' + name + '"]').click();
  for (const [n, h] of holes.entries()) {
   for (const tee of h.tees) { await mark(tee.set); await click(tee.x, tee.z); }
   await mark('green'); await click(h.green.x, h.green.z);
   if (n < 17) await page.getByRole('button', {name: 'Next hole'}).click();
  }
  const marked = await page.evaluate(() => window.fairwayBuilder.door2.holes.filter(h => h?.green && h.tees.length).length);
  if (marked !== 18) throw Error(`eighteen holes should be marked, not ${marked}`);
  // How far the clicks landed from the marks (the plan's pixel is about 1.3 m).
  const off = await page.evaluate(hs => Math.max(...hs.map((h, n) => Math.hypot(window.fairwayBuilder.door2.holes[n].green.x - h.green.x, window.fairwayBuilder.door2.holes[n].green.z - h.green.z))), holes);
  say(`18 holes clicked; the farthest green click ${off.toFixed(2)} m from its mark`);
  // 6. The trace, the landscape, the editor, the file.
  await page.getByRole('button', {name: 'LIDAR first'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.traced, null, {timeout: 600000}); await idle();
  const traceSays = await page.locator('.cb-note').first().textContent();
  await t.shot('worthington-traced');
  await page.locator('input[maxlength="60"]').fill('Worthington (door 2)');
  await page.locator('input[placeholder^="Credit"]').fill('Elevation: USGS 3D Elevation Program');
  await page.getByRole('button', {name: 'Open in the editor'}).click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 600000});
  await page.waitForTimeout(1500);
  await t.shot('worthington-editor');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 600000}), page.getByRole('button', {name: 'Save as a .fairway file'}).click()]);
  const file = path.join(data, 'worthington-door2.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  console.log(`       built through the page in ${secs()}; ${traceSays}`);
  // The page's file, measured.
  const script = path.join(data, 'worthington-script.fairway');
  const r = await compareBuilt(new Uint8Array(bytes), {dem: fs.existsSync(path.join(data, 'usgs-1m-x28y484.tif')) ? path.join(data, 'usgs-1m-x28y484.tif') : null, dtm: path.join(dir, 'terrain', 'dtm_0p5m.tif'), osm, card,
   against: fs.existsSync(script) ? new Uint8Array(fs.readFileSync(script)) : null, log: s => console.log('       ' + s)});
  if (r.round.holes.some(h => h.stuck)) throw Error('a hole could not be finished in the test round');
  const dem = r['USGS\'s DEM'];
  if (dem) { const v = dem.slice().sort((x, y) => x - y); if (v[Math.floor(v.length / 2)] > .05) throw Error('the page\'s ground is more than 5 cm from USGS\'s DEM at the median'); }
  await playOneShot(t, bytes, 'builder-door-2-worthington');
 });
}
