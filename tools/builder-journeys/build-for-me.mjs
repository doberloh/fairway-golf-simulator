// BUILD IT FOR ME (the builder-ux goal, item 6, 10 November 2026): a course
// found by name in door 2's one search bar, boxed on the map round it, Build
// it for me and its warning (it may not get it right), Build it -- and door 2
// runs its own steps: the newest USGS survey over the box downloaded, the
// land (the box as the property), the sharpest
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
import {playOneShot} from './door-generate.mjs';

const GEO = {lat: 43.63, lon: -95.62};

export default function ({journey}) {
 journey('builder-build-for-me', 'Build it for me: a course found by name and boxed on the map, its warning, Build it, and door 2\'s steps run to the review -- the club chosen over its town, the survey downloaded, the land, the picture, OpenStreetMap\'s nine holes lined up', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  const EPT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/MN_TEST_1_B21/';
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/tnmaccess\.nationalmap\.gov\//, /^https:\/\/raw\.githubusercontent\.com\/hobuinc\//, /^https:\/\/s3-us-west-2\.amazonaws\.com\/usgs-lidar-public\//, /^https:\/\/imagery\.nationalmap\.gov\//, /^https:\/\/overpass-api\.de\//, /^https:\/\/basemap\.nationalmap\.gov\//);
  // The map the course is boxed on: the USGS tile cache stood in for.
  let maps = 0;
  await page.route(/basemap\.nationalmap\.gov/, r => { maps++; return r.fulfill({status: 200, contentType: 'image/png', headers: {'Access-Control-Allow-Origin': '*'}, body: tilePng([92, 138, 72])}); });
  const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  // The one search bar (the owner, 10 November 2026): the name typed and
  // Find -- the golf course taken over the town of the same name without
  // asking -- the map shown, a 1.5 km box dragged round the course on it,
  // then Build it for me, its warning, and Build it.
  async function findAndBox() {
   await page.locator('.cb-lidarplace').fill('Testville Golf Club');
   await page.getByRole('button', {name: 'Find', exact: true}).click();
   await page.waitForFunction(() => window.fairwayBuilder.door2.map, null, {timeout: 30000}); await idle();
   if (await page.getByRole('button', {name: 'Build it for me', exact: true}).isEnabled()) throw Error('Build it for me should wait for a box on the map');
   const plan = page.locator('canvas.cb-plan'), at = async (x, z) => { const b = await plan.boundingBox(), [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]), r = await plan.evaluate(c => c.width / c.getBoundingClientRect().width); return [b.x + cx / r, b.y + cy / r]; };
   const here = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return s.map.toLocal(s.find.lon, s.find.lat); });
   const [ax, ay] = await at(here.x - 750, here.z - 750), [bx, by] = await at(here.x + 750, here.z + 750);
   await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, {steps: 6}); await page.mouse.up();
   await page.getByRole('button', {name: 'Build it for me', exact: true}).click();
   const warn = await page.locator('.cb-formeask').textContent().catch(() => '');
   if (!/might not always get it right/.test(warn)) throw Error(`Build it for me should first warn that it might not get it right: ${warn}`);
  }
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
  // FIRST-VISIT TIPS (item 13): the step's tip shows until Got it closes it.
  if (!await page.locator('.cb-intro').count()) throw Error('the first step should open on its tip');
  await page.locator('.cb-gotit').click();
  if (await page.locator('.cb-intro').count()) throw Error('Got it should close the tip');
  await findAndBox();
  if (!/Golf Club/.test(await page.evaluate(() => window.fairwayBuilder.door2.find?.label))) throw Error('the golf course should be taken over its town without asking');
  await t.shot('start');
  // Cancel leaves it; pressed again, Build it builds.
  await page.locator('[data-build="no"]').click();
  if (await page.locator('.cb-formeask').count()) throw Error('Cancel should close the warning');
  await page.getByRole('button', {name: 'Build it for me', exact: true}).click();
  const t0 = Date.now();
  await page.getByRole('button', {name: 'Build it', exact: true}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.built || /OpenStreetMap has no course|No USGS|Nothing found|failed|Could not/.test(document.querySelector('.cb-note')?.textContent ?? ''), null, {timeout: 600000});
  await page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  const st = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return {step: s.step, find: s.find?.label, name: s.name, holesN: s.holesN, marked: s.holes.slice(0, s.holesN).filter(h => h?.green && h.tees.length).length, pics: s.pics.map(p => p.group), land: !!s.land, trace: s.traceMode, built: s.built, note: document.querySelector('.cb-note').textContent}; });
  if (!st.built) throw Error(`Build it for me stopped: ${st.note}`);
  if (!/Golf Club/.test(st.find)) throw Error(`the golf course should win over the town: ${st.find}`);
  if (!st.land || !st.pics.includes('naip') || !/^openstreetmap\+lidar$/.test(st.trace)) throw Error(`every step should have run: ${JSON.stringify(st)}`);
  if (st.holesN !== 9 || st.marked !== 9) throw Error(`OpenStreetMap's nine holes should be marked: ${st.marked} of ${st.holesN}`);
  if (st.step !== 5) throw Error(`a complete course should land on the review, not step ${st.step + 1}`);
  if (asked.place !== 1 || !asked.pieces || !asked.picture || asked.osm !== 1 || !maps) throw Error(`each service asked once (the picture in blocks, the map in tiles): ${JSON.stringify({...asked, maps})}`);
  // The box drawn on the map is the property built (1.5 km, a little more in
  // the survey's grid, turned about 1.8 degrees from north here).
  const prop = await page.evaluate(() => { const b = window.fairwayBuilder.door2.box; return {w: b.x1 - b.x0, h: b.y1 - b.y0}; });
  if (prop.w < 1495 || prop.w > 1580 || prop.h < 1495 || prop.h > 1580) throw Error(`the box drawn on the map should be the property built: ${JSON.stringify(prop)}`);
  console.log(`       built in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${st.built.steps.join(' ')}`);
  await t.shot('review');
  // INTO THE GAME (item 21): Save the course for Fairway on the review, and
  // the game opens the file and a tee shot is played on it.
  await page.locator('[data-togame="save"]').click();
  await page.waitForFunction(() => /Saved .*\.fairway/.test(document.querySelector('.cb-togamesaid')?.textContent ?? ''), null, {timeout: 60000});
  const saved = Buffer.from(await page.evaluate(() => { const b = window.fairwayBuilder.lastSaved; let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return btoa(s); }), 'base64');
  await playOneShot(t, saved, 'builder-build-for-me');
  console.log(`       saved for Fairway (${(saved.length / 1e6).toFixed(1)} MB); the game opened it and a tee shot was played`);
  // SCREENS THAT FIT (item 15): on a small laptop's 1366 x 768 and a large
  // 2560 x 1440, the step bar's Next, the status bar and the panel stay in
  // the window, and nothing makes the page scroll sideways.
  for (const [w, h] of [[1366, 768], [2560, 1440]]) {
   await page.setViewportSize({width: w, height: h}); await page.waitForTimeout(400);
   await page.locator('.cb-stepchip', {hasText: 'Trace'}).click(); await page.waitForTimeout(300);
   const fit = await page.evaluate(() => { const r = q => document.querySelector(q)?.getBoundingClientRect(); return {next: r('.cb-next'), status: r('.cb-statusbar'), side: r('.cb-sidepanel'), palette: r('.cb-palette'), wide: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight}; });
   const inside = b => b && b.left >= 0 && b.top >= 0 && b.right <= fit.vw + 1 && b.bottom <= fit.vh + 1;
   if (!inside(fit.next) || !inside(fit.status) || !inside(fit.side) || !inside(fit.palette) || fit.wide > fit.vw + 1) throw Error(`at ${w} x ${h} something leaves the window: ${JSON.stringify(fit)}`);
   await t.shot(`fit-${w}`);
  }
  await page.setViewportSize({width: 1600, height: 1000}); await page.locator('.cb-stepchip', {hasText: 'Review'}).click();
  // THE HOLE NAVIGATOR (item 19): back on the holes step, "." frames the next
  // hole; zoomed in, the overview map shows in the corner.
  await page.locator('.cb-stepchip', {hasText: 'Holes'}).click();
  await page.locator('canvas.cb-plan').click({position: {x: 5, y: 5}, trial: true});
  await page.keyboard.press('.');
  await page.waitForFunction(() => !document.querySelector('.cb-mini').hidden, null, {timeout: 5000}).catch(() => {});
  const nav = await page.evaluate(() => { const s = window.fairwayBuilder.door2, h = s.holes[s.hole], v = s.plan.view; return {hole: s.hole, cx: v.cx, gx: h.green.x, tx: h.tees[0].x, mini: !document.querySelector('.cb-mini').hidden}; });
  if (nav.hole !== 1 || Math.abs(nav.cx - (nav.gx + nav.tx) / 2) > 30) throw Error(`"." should frame hole 2: ${JSON.stringify(nav)}`);
  if (!nav.mini) throw Error('zoomed in on a hole, the overview map should show');
  await t.shot('navigator');

  // A WRONG MAP (item 24; the owner: Worthington's "holes pointing to the
  // wrong place"): the same club with hole 3's line drawn to hole 7's green.
  // The build stops on the holes step with the doubt and a fix offered; the
  // fix puts hole 3 back on its own green, down its fairway.
  await page.unroute(/overpass-api\.de/);
  await page.route(/overpass-api\.de/, r => {
   const a = answer(), three = a.elements.find(e => e.tags?.golf === 'hole' && e.tags.ref === '3'), seven = a.elements.find(e => e.tags?.golf === 'hole' && e.tags.ref === '7');
   three.geometry = [three.geometry[0], seven.geometry.at(-1)];
   return r.fulfill(json(a));
  });
  page.on('dialog', d => d.accept());
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  // THE KEPT DRAFT (item 12): door 2 opened again offers back the course built a moment ago.
  await page.locator('.cb-recover').waitFor({timeout: 10000});
  { const kept = await page.locator('.cb-recover').textContent(); if (!/Testville Golf Club/.test(kept)) throw Error(`the kept work should name the course: ${kept}`); }
  await t.shot('recover');
  await page.locator('[data-recover="no"]').click();
  if (await page.locator('.cb-intro').count()) throw Error('a tip closed once should not show again');
  await findAndBox();
  await page.getByRole('button', {name: 'Build it', exact: true}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.built, null, {timeout: 600000});
  await page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  const wrong = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return {step: s.step, doubts: (s.doubts ?? []).map(q => ({hole: q.hole, kind: q.kind, fix: !!q.fix}))}; });
  if (wrong.step !== 3) throw Error(`a map with doubts should stop on the holes step, not step ${wrong.step + 1}`);
  const three = wrong.doubts.filter(q => q.hole === 2);
  if (!three.some(q => q.fix)) throw Error(`hole 3 pointing the wrong way should be caught, with a fix: ${JSON.stringify(wrong.doubts)}`);
  await t.shot('wrong-map');
  await page.getByRole('button', {name: /^Take the [0-9]+ fixes offered$|^Fix$/}).first().click();
  const after = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return {green: s.holes[2].green, doubts: (s.doubts ?? []).filter(q => q.hole === 2 && q.fix).length}; });
  if (after.doubts || Math.abs(after.green.x - (-80)) > 6) throw Error(`the fix should put hole 3 back on its own green: ${JSON.stringify(after)}`);
  // THE CARD AS A WITNESS (item 24): a card saying hole 1 is 420 yards (it
  // measures about 251) flags hole 1, and only hole 1.
  await page.locator('.cb-cardbox summary').click();
  await page.locator('.cb-cardtext').fill('1 420\n2 251\n3 251\n4 251\n5 251\n6 251\n7 251\n8 251\n9 251\nOut 2428');
  await page.locator('[data-card="check"]').click();
  const cardDoubts = await page.evaluate(() => window.fairwayBuilder.door2.doubts.filter(q => q.kind === 'card').map(q => q.hole));
  if (cardDoubts.length !== 1 || cardDoubts[0] !== 0) throw Error(`the card should flag hole 1 alone: ${JSON.stringify(cardDoubts)}`);
  await t.shot('card');
  console.log(`       a wrong map: ${wrong.doubts.length} doubt${wrong.doubts.length === 1 ? '' : 's'} (${[...new Set(wrong.doubts.map(q => q.kind))].join(', ')}); the fix put hole 3 back on its own green`);
 });
}
