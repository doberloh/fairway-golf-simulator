// Door 2 end to end, in the owner's order (the course builder, stage 7; the
// amended goal, 31 October 2026): a LIDAR survey brought in, the property
// boxed by a left drag, the land built; the survey says nothing of where it
// is, so the place is searched for and imagery fetched, sized onto the land
// and dragged into line; the auto trace, then corrected by hand -- a brush
// stroke, an outline, a tree zone, Undo -- with the view zoomed and dragged;
// nine holes marked with tees, an aim point and greens; the name; the course
// reviewed painted; the editor; the file saved; and the game plays it. The
// survey is made here (a LAS 1.2 file, point format 2 with colour, a
// nine-hole parkland in made-up map coordinates); the place search and the
// imagery are stood in for by the journey (page.route), so it needs nothing
// from outside. Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {playOneShot} from './door-generate.mjs';

const E0 = 400000, N0 = 4800000, W = 420, H = 320;
// Local metres as door 2 lays them: x east of the middle, z south of it.
const HOLES = Array.from({length: 9}, (_, n) => ({x: -160 + n * 40, tee: 120, green: -110}));
export function surfaceAt(x, z) {
 if (Math.hypot(x - 175, z - 10) < 14) return 'water';
 for (const h of HOLES) {
  if (Math.hypot(x - h.x, z - h.green) < 11) return 'green';
  if (Math.hypot(x - h.x - 12, z - h.green - 6) < 4) return 'sand';
  if (Math.abs(x - h.x) < 3 && Math.abs(z - h.tee) < 5) return 'tee';
  if (Math.abs(x - h.x) < 12 && z > h.green + 15 && z < h.tee - 25) return 'fairway';
 }
 return 'rough';
}
export function surveyLas() {
 let s = 3; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
 const COL = {green: [70, 170, 70], fairway: [80, 150, 60], tee: [80, 150, 60], rough: [100, 115, 65], sand: [225, 212, 180]};
 const pts = [];
 for (let n = 0; n <= H; n++) for (let e = 0; e <= W; e++) {
  const x = e - W / 2, z = H / 2 - n, t = surfaceAt(x, z);
  if (t === 'water') continue;
  const mown = t !== 'rough' && t !== 'sand', g = 300 + Math.sin(x / 60) * 2 + Math.cos(z / 45) * 1.5 + (mown ? 0 : (rnd() - .5) * (t === 'sand' ? .2 : .14)) - (t === 'sand' ? .4 : 0);
  pts.push([e, n, g, 2, t === 'sand' ? 44000 : mown ? 52000 : 46000, ...COL[t]]);
  if (t === 'rough' && Math.abs(((x + 180) % 40) - 20) < 1 && Math.abs(z % 30) < 1) for (let a = 0; a < 12; a++) pts.push([e + Math.cos(a) * 2, n + Math.sin(a) * 2, g + 11 - a % 3, 5, 20000, 30, 90, 40]);
 }
 const len = 26, head = 227, buf = new ArrayBuffer(head + len * pts.length), v = new DataView(buf), b = new Uint8Array(buf);
 b.set(new TextEncoder().encode('LASF'), 0); b[24] = 1; b[25] = 2; v.setUint16(94, head, true); v.setUint32(96, head, true); b[104] = 2; v.setUint16(105, len, true); v.setUint32(107, pts.length, true);
 for (const k of [131, 139, 147]) v.setFloat64(k, .001, true);
 v.setFloat64(155, E0, true); v.setFloat64(163, N0, true); v.setFloat64(171, 0, true);
 v.setFloat64(179, E0 + W, true); v.setFloat64(187, E0, true); v.setFloat64(195, N0 + H, true); v.setFloat64(203, N0, true); v.setFloat64(211, 320, true); v.setFloat64(219, 290, true);
 pts.forEach(([e, n, z, cls, inten, r, g, bl], i) => { const at = head + i * len;
  v.setInt32(at, Math.round(e / .001), true); v.setInt32(at + 4, Math.round(n / .001), true); v.setInt32(at + 8, Math.round(z / .001), true); v.setUint16(at + 12, inten, true);
  b[at + 14] = 1 | (1 << 3); b[at + 15] = cls; v.setUint16(at + 20, r * 257, true); v.setUint16(at + 22, g * 257, true); v.setUint16(at + 24, bl * 257, true); });
 return new Uint8Array(buf);
}
// A plain 256-pixel tile, for the stand-in imagery provider.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const chunk = (type, data) => { const tb = Buffer.from(type, 'latin1'), body = Buffer.concat([tb, data]); let c = -1; for (const v of body) c = CRC[(c ^ v) & 255] ^ (c >>> 8); const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); body.copy(o, 4); o.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length); return o; };
export function tilePng(rgb) {
 const raw = Buffer.alloc((256 * 3 + 1) * 256);
 for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) raw.set((x >> 5 & 1) ^ (y >> 5 & 1) ? rgb : rgb.map(v => v * .8), y * (256 * 3 + 1) + 1 + x * 3);
 const head = Buffer.alloc(13); head.writeUInt32BE(256, 0); head.writeUInt32BE(256, 4); head[8] = 8; head[9] = 2;
 return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export default function ({journey, SHOTS}) {
 journey('builder-door-2', 'door 2 in order: LIDAR and the property boxed, land, place searched and imagery fetched and dragged, auto trace corrected by hand, nine holes with an aim point, name, the painted review, editor, saved; the game plays the file', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  const asked = []; page.on('dialog', d => { asked.push(d.message()); d.accept(); });
  // The stand-ins: OpenStreetMap's place search and USGS's tiles.
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/basemap\.nationalmap\.gov\//, /^https:\/\/imagery\.nationalmap\.gov\//);
  let tiles = 0; const blocks = [];
  // USGS NAIP Plus (builder-ux): blocks of tiles, asked for by their box.
  await page.route(/imagery\.nationalmap\.gov/, r => { blocks.push(r.request().url()); return r.fulfill({status: 200, contentType: 'image/png', headers: {'Access-Control-Allow-Origin': '*'}, body: tilePng([92, 138, 72])}); });
  await page.route(/nominatim\.openstreetmap\.org/, r => r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify([{lon: '-95.62', lat: '43.63', display_name: 'A test place, Minnesota'}])}));
  await page.route(/basemap\.nationalmap\.gov/, r => { tiles++; return r.fulfill({status: 200, contentType: 'image/png', headers: {'Access-Control-Allow-Origin': '*'}, body: tilePng([90, 140, 70])}); });
  const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  const las = path.join(SHOTS, 'door-2-survey.las');
  fs.writeFileSync(las, surveyLas());
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  const plan = page.locator('canvas.cb-plan');
  const at = async (x, z) => { const box = await plan.boundingBox(), [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]), r = await plan.evaluate(c => c.width / c.getBoundingClientRect().width); return [box.x + cx / r, box.y + cy / r]; };
  // Find LIDAR: a place, then every source over it -- the National Map stood
  // in for (two tiles of one survey), the state's portal linked.
  t.allow.push(/^https:\/\/tnmaccess\.nationalmap\.gov\//, /^https:\/\/raw\.githubusercontent\.com\/hobuinc\//);
  await page.route(/raw\.githubusercontent\.com\/hobuinc/, r => r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify({features: [{properties: {name: 'MN_TEST_1_B21', url: 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/MN_TEST_1_B21/ept.json', count: 1e9}, geometry: {type: 'Polygon', coordinates: [[[-96, 43], [-95, 43], [-95, 44], [-96, 44], [-96, 43]]]}}]})}));
  await page.route(/tnmaccess\.nationalmap\.gov/, r => r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify({items: [1, 2].map(n => ({publicationDate: '2023-02-10', sizeInBytes: 6e7, downloadLazURL: `https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/MN_TEST/MN_TEST_1_B21/LAZ/USGS_LPC_MN_TEST_${n}.laz`}))})}));
  await page.locator('.cb-lidarplace').fill('A test place');
  await page.getByRole('button', {name: 'Find', exact: true}).click();
  await page.getByText('A test place, Minnesota').click();
  await page.getByRole('button', {name: 'Search for LIDAR'}).click();
  await page.waitForSelector('[data-download="MN_TEST_1_B21"]', {timeout: 30000});
  const found = await page.locator('.cb-lidarfound').textContent();
  if (!/MN TEST 1 B21/.test(found) || !/2 tiles/.test(found) || !/MnGeo Lidar \(Minnesota\)/.test(found) || /Iowa/.test(found)) throw Error(`the search should list the survey and Minnesota's own portal: ${found}`);
  if (!await page.locator('[data-rocky="MN_TEST_1_B21"]').count()) throw Error('the survey\'s whole tiles should be offered (rockyweb)');
  await t.shot('lidar-found');
  // 1. The LIDAR, and the property boxed with a left drag (the whole survey
  // less 20 m each side).
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: 'Choose LIDAR files'}).click()]);
  await chooser.setFiles(las);
  await page.waitForFunction(() => window.fairwayBuilder.door2?.preview, null, {timeout: 60000}); await idle();
  let [x0, y0] = await at(-190, -140), [x1, y1] = await at(190, 140);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 6}); await page.mouse.up();
  const box = await page.evaluate(() => window.fairwayBuilder.door2.box);
  if (Math.abs(box.x1 - box.x0 - 380) > 6 || Math.abs(box.y1 - box.y0 - 280) > 6) throw Error(`the dragged property should be about 380 x 280 m, not ${JSON.stringify(box)}`);
  await page.getByRole('button', {name: 'Next: build the land'}).click();
  // 2. The land.
  await page.getByRole('button', {name: 'Build the land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.land, null, {timeout: 120000}); await idle();
  await page.getByRole('button', {name: 'Next: trace the course'}).click();
  // 3. The place (the survey states no map grid), the imagery, a drag to align.
  await page.locator('.cb-provider').selectOption('usgs');
  await page.getByPlaceholder(/A place/).fill('A test place');
  await page.getByRole('button', {name: 'Find', exact: true}).click();
  await page.getByText('A test place, Minnesota').click();
  await page.locator('.cb-provider').selectOption('usgs');
  await page.getByRole('button', {name: 'Fetch imagery for this land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.pics?.length, null, {timeout: 60000}); await idle();
  if (!tiles) throw Error('no imagery tile was asked for');
  // The sharpest free US source is offered first, and asks for blocks.
  const offered = await page.locator('.cb-provider option').evaluateAll(o => o.map(x => x.value));
  if (offered[0] !== 'naip') throw Error(`USGS NAIP should be offered first: ${offered}`);
  await page.locator('.cb-provider').selectOption('naip');
  await page.getByRole('button', {name: 'Fetch imagery for this land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.pics?.some(p => p.group === 'naip'), null, {timeout: 60000}); await idle();
  // The picture's blocks (the date is asked for apart, through identify).
  const pictureBlocks = blocks.filter(u => !/[/]identify[?]/.test(u));
  if (!pictureBlocks.length || !pictureBlocks.every(u => /exportImage\?bbox=.*size=[0-9]+,[0-9]+&format=jpg/.test(u))) throw Error(`NAIP should be asked for blocks: ${pictureBlocks.slice(0, 2)}`);
  console.log(`       USGS NAIP: ${blocks.length} block request${blocks.length === 1 ? '' : 's'}, against ${tiles} tiles from the USGS tile cache`);
  await page.locator('.cb-picshow').selectOption('usgs');
  // The LIDAR and the picture together: opacities, either on top, the slope.
  const pv = () => page.evaluate(() => { const v = window.fairwayBuilder.door2.plan.view; return {alpha: {...v.alpha}, order: v.order.slice()}; });
  await page.locator('[data-alpha="picAlpha"]').fill('40');
  if (Math.abs((await pv()).alpha.picture - .4) > .01) throw Error(`the picture opacity slider should set 0.4: ${JSON.stringify(await pv())}`);
  await page.getByRole('button', {name: 'LIDAR on top'}).click();
  if ((await pv()).order.indexOf('relief') < (await pv()).order.indexOf('picture')) throw Error('LIDAR on top should draw the relief over the picture');
  await page.locator('[data-alpha="lidarAlpha"]').fill('50');
  await page.locator('.cb-lidarview').selectOption('slope');
  await t.shot('lidar-over-picture');
  await page.getByRole('button', {name: 'Picture on top'}).click();
  // Unlock, drag the picture into line, nudge it, lock it.
  await page.getByRole('button', {name: 'Unlock the picture'}).click();
  [x0, y0] = await at(0, 0); [x1, y1] = await at(6, -4);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 4}); await page.mouse.up();
  await idle();
  let off = await page.evaluate(() => window.fairwayBuilder.door2.offset);
  if (Math.abs(off.x - 6) > 1 || Math.abs(off.z + 4) > 1) throw Error(`the picture was dragged 6 m east and 4 m north, not ${JSON.stringify(off)}`);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowUp'); await idle();
  const nudged = await page.evaluate(() => window.fairwayBuilder.door2.offset);
  if (Math.abs(nudged.x - off.x - .25) > .01 || Math.abs(nudged.z - off.z + 1) > .01) throw Error(`the arrows should nudge a quarter metre east and (Shift) a metre north: ${JSON.stringify(off)} -> ${JSON.stringify(nudged)}`);
  if (!/unlocked/i.test(await page.locator('.cb-toolhint').textContent())) throw Error('the banner should say the picture is unlocked');
  await page.getByRole('button', {name: 'Lock the picture'}).click();
  off = nudged;
  [x0, y0] = await at(20, 20); [x1, y1] = await at(30, 30);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 4}); await page.mouse.up();
  await page.keyboard.press('ArrowRight'); await idle();
  const locked = await page.evaluate(() => window.fairwayBuilder.door2.offset);
  if (locked.x !== off.x || locked.z !== off.z) throw Error(`a locked picture should not move: ${JSON.stringify(off)} -> ${JSON.stringify(locked)}`);
  // Zoom with the wheel about a point, drag the view with the right button.
  const pb = await plan.boundingBox(), before = await page.evaluate(() => window.fairwayBuilder.door2.plan.view.scale);
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.mouse.wheel(0, -600); await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.fairwayBuilder.door2.plan.view.scale);
  if (!(after > before * 1.5)) throw Error(`the wheel should zoom in (${before} -> ${after})`);
  const c0 = await page.evaluate(() => window.fairwayBuilder.door2.plan.view.cx);
  await page.mouse.down({button: 'right'}); await page.mouse.move(pb.x + pb.width / 2 + 120, pb.y + pb.height / 2, {steps: 3}); await page.mouse.up({button: 'right'});
  if (Math.abs(await page.evaluate(() => window.fairwayBuilder.door2.plan.view.cx) - c0) < 1) throw Error('the right button should drag the view');
  await page.getByRole('button', {name: 'Whole land'}).click();
  // The auto trace, then corrected by hand.
  await page.getByRole('button', {name: 'Auto trace'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.model, null, {timeout: 60000}); await idle();
  const greens = await page.evaluate(() => { const st = window.fairwayBuilder.door2, c = st.model.state.codes, L = st.land; let n = 0; for (let k = 0; k < c.length; k++) if (c[k] === 4) n++; return n * L.cell * L.cell; });
  await t.shot('traced');
  const kindAt = (x, z) => page.evaluate(([x, z]) => window.fairwayBuilder.door2.model.kindAt(x, z), [x, z]);
  // Every layer the landscape offers is listed in order, rough last, the
  // empty ones said so; the tool says what it does at the top of the view.
  const rows = await page.locator('.cb-layers li').evaluateAll(ls => ls.map(l => [l.dataset.layer, l.classList.contains('cb-empty')]));
  if (rows.at(-1)?.[0] !== 'rough' || rows[0]?.[0] !== 'water' || !rows.some(r => r[1])) throw Error(`the layer list should run water to rough with empty ones marked: ${JSON.stringify(rows)}`);
  await page.locator('[data-tool="brush"]').click(); await page.locator('.cb-kind').selectOption('sand');
  const hint = await page.locator('.cb-toolhint').textContent();
  if (!/Paint brush/.test(hint) || !/sand/.test(hint)) throw Error(`the banner should say the brush paints sand: ${hint}`);
  [x0, y0] = await at(-60, 40); [x1, y1] = await at(-50, 40);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 5}); await page.mouse.up();
  if (await kindAt(-55, 40) !== 'sand') throw Error('the brush should have painted sand');
  // MEASURE (builder-ux, item 17): 100 m across the plan is 109 yards.
  await page.locator('[data-tool="measure"]').click();
  for (const [x, z] of [[-150, -60], [-50, -60]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  const measured = await page.locator('.cb-note').textContent();
  if (!/^109 yd [(]100[.][0-9] m[)]/.test(measured)) throw Error(`the measure should say 109 yd (100 m): ${measured}`);
  await t.shot('measure');
  await page.locator('[data-tool="brush"]').click(); await page.locator('.cb-kind').selectOption('sand');
  // PAINTED UNDER (builder-ux, item 1): semi-rough brushed across that sand
  // goes in under it, and the status bar says so.
  await page.locator('.cb-kind').selectOption('semi');
  if (!/Semi-rough goes under .*Sand/.test(await page.locator('.cb-under').textContent())) throw Error(`the layers panel should say semi goes under sand: ${await page.locator('.cb-under').textContent()}`);
  [x0, y0] = await at(-62, 40); [x1, y1] = await at(-48, 40);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 6}); await page.mouse.up();
  const saidUnder = await page.locator('.cb-note').textContent();
  if (!/went in under the sand/.test(saidUnder)) throw Error(`a stroke under sand should say so: ${saidUnder}`);
  if (await kindAt(-55, 40) !== 'sand') throw Error('the sand should stay on top of the semi painted under it');
  await t.shot('painted-under');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  // THE STEADIED BRUSH (builder-ux, item 2): the same shaky zig-zag, 3 m
  // either side of a line, drawn with Steadiness 0 and 90 on the tee layer;
  // the steadied stroke comes out narrower.
  await page.locator('.cb-kind').selectOption('tee');
  const shaky = async (z0, steady) => {
   await page.locator('.cb-steady').fill(String(steady));
   const pts = Array.from({length: 40}, (_, i) => [-150 + i * 2, z0 + (i % 2 ? 3 : -3)]);
   let [sx, sy] = await at(...pts[0]); await page.mouse.move(sx, sy); await page.mouse.down();
   for (const q of pts.slice(1)) { [sx, sy] = await at(...q); await page.mouse.move(sx, sy); }
   await page.mouse.up();
  };
  await shaky(-30, 0); await shaky(-70, 90);
  const spread = z0 => page.evaluate(z0 => { const st = window.fairwayBuilder.door2, L = st.land, m = st.model.state.layers.masks.get('tee'); let lo = 1e9, hi = -1e9; for (let x = -130; x <= -100; x++) { const i = Math.round((x + L.halfX) / L.cell); for (let z = z0 - 15; z <= z0 + 15; z += .5) { const j = Math.round((z + L.halfZ) / L.cell); if (m[j * L.nx + i]) { lo = Math.min(lo, z); hi = Math.max(hi, z); } } } return hi - lo; }, z0);
  const [wild, calm] = [await spread(-30), await spread(-70)];
  if (!(calm < wild - 2)) throw Error(`the steadied stroke should be narrower than the shaky one: ${calm} m against ${wild} m`);
  console.log(`       steadied brush: a shaky stroke ${wild.toFixed(1)} m wide plain, ${calm.toFixed(1)} m at Steadiness 90`);
  await t.shot('steadied');
  for (let k = 0; k < 2; k++) await page.getByRole('button', {name: 'Undo', exact: true}).click();
  await page.locator('.cb-steady').fill('50'); await page.locator('.cb-kind').selectOption('sand');
  // Select shape: the bunker clicked, then dragged 12 m south, then back by Undo.
  const sandCells = () => page.evaluate(() => window.fairwayBuilder.door2.model.state.layers.mask('sand').reduce((t, v) => t + v, 0));
  const sand0 = await sandCells();
  await page.locator('[data-tool="select"]').click();
  [x0, y0] = await at(-55, 40); [x1, y1] = await at(-55, 52);
  await page.mouse.click(x0, y0);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 5});
  if (!/Moving the sand/.test(await page.locator('.cb-toolhint').textContent())) throw Error('the banner should say the sand is being moved');
  await page.mouse.up();
  if (await kindAt(-55, 52) !== 'sand' || await kindAt(-55, 40) === 'sand' || await sandCells() !== sand0) throw Error(`the bunker should have moved 12 m whole (${sand0} -> ${await sandCells()} cells)`);
  await t.shot('shape-moved');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  if (await kindAt(-55, 40) !== 'sand') throw Error('Undo should put the bunker back');
  // Select shape again: the same east-west bunker (-64 to -46 m) turned a quarter
  // by a drag on an anchor, so it runs north-south; Undo puts it back.
  // Selected again after the Undo, then an anchor dragged round its middle.
  [x0, y0] = await at(-55, 40);
  await page.mouse.click(x0, y0);
  const [ax, az] = await page.evaluate(() => window.fairwayBuilder.door2.chosen.corners[1]), centre = await page.evaluate(() => window.fairwayBuilder.door2.chosen.mid);
  [x0, y0] = await at(ax, az);
  const swept = Math.atan2(az - centre.z, ax - centre.x), reach = Math.hypot(ax - centre.x, az - centre.z);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (const a of [.3, .6, .9, 1.2, Math.PI / 2]) { const [px, py] = await at(centre.x + reach * Math.cos(swept + a), centre.z + reach * Math.sin(swept + a)); await page.mouse.move(px, py); }
  if (!/Turning the sand/.test(await page.locator('.cb-toolhint').textContent())) throw Error('the banner should say the sand is being turned');
  await page.mouse.up();
  if (await kindAt(-62, 40) === 'sand' || await kindAt(-55, 47) !== 'sand' || await sandCells() < sand0 * .9) throw Error(`the bunker should have turned to run north-south, its area kept (${sand0} -> ${await sandCells()} cells)`);
  await t.shot('shape-turned');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  if (await kindAt(-62, 40) !== 'sand') throw Error('Undo should turn the bunker back');
  // COPY AND DELETE (builder-ux, item 18): the bunker selected, Ctrl+D lays a
  // copy beside it, selected; Delete takes the copy away again.
  { const [px, py] = await at(-62, 40); await page.mouse.click(px, py); }
  const sandA = await sandCells();
  await page.keyboard.press('Control+d');
  const sandB = await sandCells();
  if (!(sandB > sandA * 1.6)) throw Error(`Ctrl+D should lay a copy of the bunker: ${sandA} -> ${sandB} cells`);
  await page.keyboard.press('Delete');
  if (await sandCells() !== sandA) throw Error('Delete should take the copy away');
  await page.locator('[data-tool="brush"]').click();
  // The smooth view: a moment after the stroke, the trace is drawn as outlines.
  await page.waitForFunction(() => { const st = window.fairwayBuilder.door2; return st.vec && !st.plan.view.show.codes; }, null, {timeout: 10000});
  // Layers: a fairway painted over the bunker leaves the bunker on top; the
  // sand layer hidden shows the fairway under it in the view, not the course.
  await page.locator('.cb-kind').selectOption('fairway');
  [x0, y0] = await at(-62, 40); [x1, y1] = await at(-48, 40);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 5}); await page.mouse.up();
  if (await kindAt(-55, 40) !== 'sand') throw Error('painting the fairway layer should not cover the bunker');
  await page.locator('[data-eye="sand"]').click();
  const shown = await page.evaluate(() => { const st = window.fairwayBuilder.door2, L = st.land, k = Math.round((40 + L.halfZ) / L.cell) * L.nx + Math.round((-55 + L.halfX) / L.cell); return [st.model.state.layers.palette[st.model.state.layers.view[k]], st.model.kindAt(-55, 40)]; });
  if (shown[0] !== 'fairway' || shown[1] !== 'sand') throw Error(`hiding the sand layer should show the fairway in the view and keep the bunker in the course: ${shown}`);
  await page.locator('[data-eye="sand"]').click();
  // Extrapolate: semi-rough laid 4 m round the fairway.
  const semiCells = () => page.evaluate(() => window.fairwayBuilder.door2.model.state.layers.mask('semi')?.reduce((t, v) => t + v, 0) ?? 0);
  const semi0 = await semiCells();
  await page.locator('.cb-exto').selectOption('semi'); await page.locator('.cb-exwidth').fill('4');
  await page.getByRole('button', {name: 'Extrapolate', exact: true}).click();
  if (!(await semiCells() > semi0)) throw Error('Extrapolate should lay semi-rough round the fairway');
  // The landscape decides the ground types offered: heather is a links' own.
  if (await page.locator('.cb-kind option[value="heather"]').count()) throw Error('the Midwest should not offer heather');
  await page.locator('.cb-landscape').selectOption('seaside');
  await page.locator('[data-tool="outline"]').click(); await page.locator('.cb-kind').selectOption('heather');
  for (const [x, z] of [[100, 80], [130, 80], [130, 100], [100, 100]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  await page.keyboard.press('Enter');
  if (await kindAt(115, 90) !== 'heather') throw Error('the outline should have filled heather');
  // THE PEN (builder-ux, item 3): nodes at the clicks, the curve shown while
  // drawing, the first node closing the shape, a node dragged, then Enter
  // fills the curve that was shown -- rounded, so the middle of a side bows
  // out past the straight line between its nodes.
  await page.locator('.cb-kind').selectOption('sand');
  const pen = [[150, 20], [180, 20], [180, 50], [150, 50]];
  for (const [x, z] of pen) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  if (await page.evaluate(() => window.fairwayBuilder.door2.outline.length) !== 4) throw Error('the pen should hold a node a click');
  await page.keyboard.press('Backspace');
  if (await page.evaluate(() => window.fairwayBuilder.door2.outline.length) !== 3) throw Error('Backspace should take the last node off');
  { const [px, py] = await at(150, 50); await page.mouse.click(px, py); }
  { const [px, py] = await at(150.3, 20.3); await page.mouse.move(px, py); }
  await t.shot('pen-closing');
  { const [px, py] = await at(150, 20); await page.mouse.click(px, py); }
  if (!await page.evaluate(() => window.fairwayBuilder.door2.penEdit)) throw Error('a click on the first node should close the shape');
  { const [ax, ay] = await at(180, 50), [bx, by] = await at(186, 56); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, {steps: 3}); await page.mouse.up(); }
  const moved = await page.evaluate(() => window.fairwayBuilder.door2.outline[2]);
  if (Math.hypot(moved[0] - 186, moved[1] - 56) > 1.5) throw Error(`a closed shape's node should drag: ${moved}`);
  await t.shot('pen-closed');
  await page.keyboard.press('Enter');
  if (await kindAt(170, 38) !== 'sand') throw Error('the pen\'s shape should have filled sand');
  // The curve bows out between nodes (to x 146.2 m on the left side, pen.js):
  // sand lies past the straight line between the first and last nodes. (Not
  // the top side: a pond lies over its bow, and water stays on top of sand.)
  if (await kindAt(147.5, 35) !== 'sand') throw Error('the pen fills its rounded curve, not the straight lines between its nodes');
  const treesBefore =await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length);
  await page.locator('[data-tool="treeZone"]').click();
  for (const [x, z] of [[-180, -130], [-150, -130], [-150, -100], [-180, -100]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  await page.keyboard.press('Enter');
  const treesAfter = await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length);
  if (treesAfter <= treesBefore) throw Error('the tree zone should have planted trees');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  if (await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length) !== treesBefore) throw Error('Undo should take the zone\'s trees away');
  // Ctrl+Shift+Z redoes (the owner, 1 November 2026); Ctrl+Z undoes again.
  await page.locator('canvas.cb-plan').hover();
  await page.keyboard.press('Control+Shift+KeyZ');
  if (await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length) !== treesAfter) throw Error('Ctrl+Shift+Z should redo the tree zone');
  await page.keyboard.press('Control+KeyZ');
  if (await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length) !== treesBefore) throw Error('Ctrl+Z should undo it again');
  // Clear trees from tees and greens: no crown left over a traced green.
  await page.getByRole('button', {name: 'Clear trees from tees and greens'}).click();
  const over = await page.evaluate(() => { const st = window.fairwayBuilder.door2, L = st.land, g = st.model.state.layers.masks.get('green'); if (!g) return 0; let n = 0; for (const t of st.model.state.trees) { const r = Math.ceil(t.crown / L.cell); const i0 = Math.round((t.x + L.halfX) / L.cell), j0 = Math.round((t.z + L.halfZ) / L.cell); for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) if (i >= 0 && j >= 0 && i < L.nx && j < L.nz && g[j * L.nx + i] && Math.hypot((i - i0) * L.cell, (j - j0) * L.cell) < t.crown - L.cell) { n++; j = 1e9; break; } } return n; });
  if (over) throw Error(`no tree's crown should reach over a green after clearing: ${over}`);
  await page.getByRole('button', {name: 'Smooth all edges'}).click();
  await t.shot('corrected');
  await page.getByRole('button', {name: 'Next: the holes'}).click();
  // 4. Nine holes, each a left click: the back tee, an aim point on the
  // first, the green.
  await page.locator('.cb-holes').selectOption('9');
  for (const [n, h] of HOLES.entries()) {
   let [px, py] = await at(h.x, h.tee); await page.mouse.click(px, py);
   if (n === 0) { await page.locator('[data-mark="aim"]').click(); [px, py] = await at(h.x + 8, 0); await page.mouse.click(px, py); await page.locator('[data-mark="green"]').click(); }
   [px, py] = await at(h.x, h.green); await page.mouse.click(px, py);
   if (n < 8) await page.getByRole('button', {name: 'Next hole'}).click();
  }
  const holes = await page.evaluate(() => window.fairwayBuilder.door2.holes.filter(h => h?.green && h.tees.length).length);
  if (holes !== 9) throw Error(`nine holes should be marked, not ${holes}`);
  // The scorecard: nine holes and a total, the yards the game will measure;
  // par and handicap index set by hand (hole 2 a par 5, index 1).
  const card = await page.locator('.cb-card tbody tr').evaluateAll(rows => rows.map(r => [...r.children].map(c => c.querySelector('select')?.value ?? c.textContent)));
  if (card.length !== 10 || card[9][0] !== 'Total' || !(+card[0][3] > 150) || card[0][4] !== card[0][3]) throw Error(`the scorecard should list nine holes and a total, white as blue with one tee: ${JSON.stringify(card.slice(0, 2))}`);
  if (await page.locator('.cb-card input').count()) throw Error('the scorecard\'s yards are the game\'s, not typed');
  await page.locator('.cb-par[data-hole="1"]').selectOption('5');
  await page.locator('.cb-index[data-hole="1"]').selectOption('1');
  if (await page.locator('.cb-par[data-hole="1"]').inputValue() !== '5') throw Error('hole 2\'s par should be set to 5');
  await t.shot('scorecard');
  // Save from here: a stand-in save dialog (the harness hides Chrome's) -- the
  // first Save asks where, the second goes to the same file with one click.
  await page.evaluate(() => { window.__picks = 0; window.__writes = 0; window.showSaveFilePicker = async o => { window.__picks++; return {name: o.suggestedName, async createWritable() { return {async write() { window.__writes++; }, async close() {}}; }}; }; });
  await page.locator('#cbSave').click(); await page.waitForFunction(() => window.__writes === 1, null, {timeout: 60000});
  if (await page.locator('#cbSave').textContent() !== 'Save again') throw Error('after saving, the button should offer Save again');
  await page.keyboard.press('Control+s'); await page.waitForFunction(() => window.__writes === 2, null, {timeout: 60000});
  if (await page.evaluate(() => window.__picks) !== 1) throw Error('saving again should go to the same file without asking');
  if (!/My-real-course\.fairway-draft/.test(await page.locator('#cbSaveNote').textContent())) throw Error(`the bar should name the draft: ${await page.locator('#cbSaveNote').textContent()}`);
  await page.getByRole('button', {name: 'Next: the name'}).click();
  // 5. The name; 6. the review, painted.
  await page.locator('.cb-name').fill('Door 2 test');
  // Renamed: Save makes a new file.
  if (await page.locator('#cbSave').textContent() !== 'Save') throw Error('a renamed course should Save to a new file');
  await page.locator('#cbSave').click(); await page.waitForFunction(() => window.__writes === 3, null, {timeout: 60000});
  if (await page.evaluate(() => window.__picks) !== 2) throw Error('the renamed course should have asked for a new file');
  // The draft opened again, from the start page, back at this step.
  const b64 = await page.evaluate(() => { const b = window.fairwayBuilder.lastSaved; let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return btoa(s); });
  const saved = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {sand: st.model.state.layers.mask('sand').reduce((a, v) => a + v, 0), trees: st.model.state.trees.length, holes: st.holes.filter(h => h?.green).length}; });
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  const [draftChooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Open a course file/}).click()]);
  await draftChooser.setFiles({name: 'Door-2-test.fairway-draft', mimeType: 'application/zip', buffer: Buffer.from(b64, 'base64')});
  await page.waitForFunction(() => window.fairwayBuilder.door2?.step === 4 && window.fairwayBuilder.door2.model, null, {timeout: 60000}); await idle();
  const opened = await page.evaluate(() => { const st = window.fairwayBuilder.door2; return {sand: st.model.state.layers.mask('sand').reduce((a, v) => a + v, 0), trees: st.model.state.trees.length, holes: st.holes.filter(h => h?.green).length, name: st.name}; });
  if (opened.sand !== saved.sand || opened.trees !== saved.trees || opened.holes !== saved.holes || opened.name !== 'Door 2 test') throw Error(`the draft should open as saved: ${JSON.stringify(saved)} -> ${JSON.stringify(opened)}`);
  await t.shot('draft-reopened');
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });   // downloads again, as the harness set it
  await page.getByRole('button', {name: 'Next: review the course'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.doc, null, {timeout: 120000}); await idle();
  const doc = await page.evaluate(() => { const d = window.fairwayBuilder.door2.doc; return {holes: d.holes.length, line: d.holes[0].line.length, credits: d.credits, kinds: Object.entries(d.surfaces).filter(([, v]) => v.length).map(([k]) => k)}; });
  if (doc.line !== 3) throw Error(`hole 1's line should bend at its aim point: ${doc.line} points`);
  const pi = await page.evaluate(() => { const h = window.fairwayBuilder.door2.doc.holes[1]; return [h.par, h.index]; });
  if (pi[0] !== 5 || pi[1] !== 1) throw Error(`hole 2 should be a par 5, index 1, as set on the card: ${pi}`);
  if (!doc.kinds.includes('heather') || !doc.kinds.includes('green')) throw Error(`the course should carry the traced and painted surfaces: ${doc.kinds}`);
  if (!doc.credits.some(c => /USGS/.test(c))) throw Error('the imagery\'s credit should be on the course');
  console.log(`       auto trace: ${greens.toFixed(0)} m² of green; ${treesAfter - treesBefore} trees in the zone (undone); ${tiles} imagery tiles; review: ${doc.kinds.join(', ')}`);
  await t.shot('review');
  await page.getByRole('button', {name: 'Open in the editor'}).click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
  await page.waitForTimeout(800);
  await t.shot('editor');
  // The 3D view: surfaces drawn from their outlines, finer than the cells;
  // W flies forward, Q down, the orbit's centre with it.
  const tx = await page.evaluate(() => window.fairwayBuilder.editor.view.texels());
  if (!(tx.perCell > 1)) throw Error(`the 3D view's surfaces should be finer than the editing grid: ${JSON.stringify(tx)}`);
  const cam = () => page.evaluate(() => { const v = window.fairwayBuilder.editor.view; return {x: v.camera.position.x, y: v.camera.position.y, z: v.camera.position.z, tx: v.controls.target.x, tz: v.controls.target.z}; });
  const cam0 = await cam();
  await page.locator('.cb-view canvas').focus();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  const cam1 = await cam(), flown = Math.hypot(cam1.x - cam0.x, cam1.z - cam0.z);
  if (!(flown > 5) || Math.abs((cam1.tx - cam0.tx) - (cam1.x - cam0.x)) > .01) throw Error(`W should fly the camera forward with its centre: ${JSON.stringify([cam0, cam1])}`);
  await page.keyboard.down('KeyQ'); await page.waitForTimeout(400); await page.keyboard.up('KeyQ');
  if (!((await cam()).y < cam1.y)) throw Error('Q should fly down');
  console.log(`       3D view: ${tx.width} x ${tx.height} texels, ${tx.perCell.toFixed(2)} a cell; W flew ${flown.toFixed(0)} m in 0.6 s`);
  await t.shot('editor-flown');
  // The same layers in the editor, kept up to date as it is painted.
  const layers = await page.locator('.cb-layers li').evaluateAll(li => li.map(l => l.dataset.layer));
  if (!layers.includes('sand') || !layers.includes('fairway') || !layers.includes('heather')) throw Error(`the editor should list the course's layers: ${layers}`);
  await page.locator('.cb-layers [data-eye="heather"]').click();
  if (!await page.evaluate(() => window.fairwayBuilder.editor.editor.isHidden('heather'))) throw Error('the editor should hide the heather layer');
  await page.locator('.cb-layers [data-eye="heather"]').click();
  // Only the landscape's own ground types to paint (a links: heather, not
  // pine straw), its sky, its trees' shape. Seaside Links (which replaced the
  // Scottish Links on 8 November 2026) grows shore pines, so its stand-ins are
  // cones (tree-shape.js `standIn`); the journey expected the old links'
  // round shrubs until the builder-ux goal (10 November 2026). Only meshes
  // that hold trees count: an empty bushes mesh is always there.
  // The layers the brush and pen offer (builder-ux: one brush and pen, the layer chosen).
  const paints = await page.locator('.cb-layerpick option').evaluateAll(o => o.map(x => x.value));
  if (!paints.includes('heather') || paints.includes('pinestraw') || paints.includes('litter')) throw Error(`a links should offer its own ground types only: ${paints}`);
  const look = await page.evaluate(() => { const v = window.fairwayBuilder.editor.view; let shape = null; v.scene.traverse(o => { if (o.isInstancedMesh && o.count && o.geometry.type === 'ConeGeometry') shape = 'cone'; }); return {sky: '#' + v.scene.background.getHexString(), shape}; });
  if (look.sky !== '#c8d7df' || look.shape !== 'cone') throw Error(`the editor should look like Seaside Links: ${JSON.stringify(look)}`);
  // The tree height scale, at once in the view (the first crown of the cones).
  const crownTop = () => page.evaluate(() => { const v = window.fairwayBuilder.editor.view, m = new (v.camera.matrix.constructor)(); let top = 0, wide = 0; v.scene.traverse(o => { if (!top && o.isInstancedMesh && o.count && o.geometry.type === 'ConeGeometry') { o.getMatrixAt(0, m); top = m.elements[13] + m.elements[5]; wide = m.elements[0]; } }); return [top, wide]; });
  const [top0, wide0] = await crownTop();
  await page.locator('.cb-treescale').fill('1.5'); await page.waitForTimeout(200);
  const [top1, wide1] = await crownTop();
  if (await page.evaluate(() => window.fairwayBuilder.editor.editor.state.treeScale) !== 1.5 || !(top1 > top0) || !(wide1 > wide0)) throw Error(`the tree height scale should grow the trees, taller and wider, at once: ${top0} -> ${top1}, ${wide0} -> ${wide1}`);
  await page.locator('.cb-treescale').fill('1');
  // One tree sized: Size a tree, a click on a tree where the camera sees it,
  // This tree to 2 -- that tree twice as tall, the rest as they were.
  await page.locator('[data-tool="sizeTree:"]').click();
  const heights = () => page.evaluate(() => window.fairwayBuilder.editor.editor.state.trees.map(t => t[2]));
  const h0 = await heights();
  const treeAt = await page.evaluate(() => {
   const {editor, view} = window.fairwayBuilder.editor, box = view.canvas.getBoundingClientRect(), V = view.camera.position.constructor;
   for (const t of editor.state.trees) { const v = new V(t[0], editor.height(t[0], t[1]), t[1]).project(view.camera); if (Math.abs(v.x) < .8 && Math.abs(v.y) < .8 && v.z < 1) return {x: box.left + (v.x + 1) / 2 * box.width, y: box.top + (1 - v.y) / 2 * box.height}; }
   return null;
  });
  if (!treeAt) throw Error('the journey needs a tree in view to size');
  await page.mouse.click(treeAt.x, treeAt.y);
  if (await page.locator('.cb-onetree').isDisabled()) throw Error(`clicking a tree should pick it to size: ${await page.locator('.cb-status').textContent()}`);
  await page.locator('.cb-onetree').fill('2'); await page.waitForTimeout(200);
  const h1 = await heights(), grown = h1.map((h, k) => h / h0[k]).filter(r => Math.abs(r - 1) > 1e-6);
  if (grown.length !== 1 || Math.abs(grown[0] - 2) > 1e-3) throw Error(`This tree should size one tree, twice as tall: ${grown}`);
  await page.getByRole('button', {name: 'Undo'}).click();
  if ((await heights()).some((h, k) => h !== h0[k]) || !(await page.locator('.cb-onetree').isDisabled())) throw Error('Undo should put the tree back and let it go');
  await page.locator('[data-tool="navigate:"]').click();
  await page.getByRole('button', {name: 'Clear trees from tees and greens'}).click();
  if (!/greens and tees|reaches over a green/.test(await page.locator('.cb-status').textContent())) throw Error('clearing trees should say what it did');
  // The window resized: the view follows.
  await page.setViewportSize({width: 1200, height: 800}); await page.waitForTimeout(300);
  const fit = await page.evaluate(() => { const c = window.fairwayBuilder.editor.view.canvas, p = c.parentElement; return [c.width / devicePixelRatio, p.clientWidth]; });
  if (Math.abs(fit[0] - fit[1]) > 2) throw Error(`the 3D view should follow the window: ${fit}`);
  await page.setViewportSize({width: 1600, height: 1000});
  // Work in 3D to take back: sand painted and the ground raised where the
  // view's middle falls.
  const mid = await page.evaluate(() => { const v = window.fairwayBuilder.editor.view, b = v.canvas.getBoundingClientRect(), p = v.pick({clientX: b.left + b.width / 2, clientY: b.top + b.height / 2}); return {sx: b.left + b.width / 2, sy: b.top + b.height / 2, ...p}; });
  const heightAt = () => page.evaluate(([x, z]) => window.fairwayBuilder.editor.editor.height(x, z), [mid.x, mid.z]);
  const h3d0 = await heightAt();
  await page.locator('.cb-layerpick').selectOption('sand');
  for (const tool of ['brush', 'shape:raise']) {
   await page.locator(`[data-tool="${tool}"]`).click();
   await page.mouse.move(mid.sx - 20, mid.sy); await page.mouse.down(); await page.mouse.move(mid.sx + 20, mid.sy, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(150);
  }
  const h3d1 = await heightAt();
  if (!(h3d1 > h3d0 + .05) || await page.evaluate(([x, z]) => window.fairwayBuilder.editor.editor.surfaceAt(x, z), [mid.x, mid.z]) !== 'sand') throw Error(`the journey's sand and hill should be in the editor: ${h3d0} -> ${h3d1}`);
  await page.locator('[data-tool="navigate:"]').click();
  // Back to 2D (it asks nothing: the work goes with it), the review shown
  // again with the sand in the trace and the hill kept, then the editor once
  // more, which has both.
  const asked0 = asked.length;
  await page.getByRole('button', {name: 'Back to 2D'}).click();
  await page.waitForFunction(() => document.querySelector('.cb-door2') && window.fairwayBuilder.door2.step === 5 && window.fairwayBuilder.door2.doc, null, {timeout: 120000}); await idle();
  if (asked.length !== asked0) throw Error('going back to 2D should not ask: the work goes with it');
  const in2d = await page.evaluate(([x, z]) => { const st = window.fairwayBuilder.door2, L = st.land, k = Math.round((z + L.halfZ) / L.cell) * L.nx + Math.round((x + L.halfX) / L.cell); return {sand: st.model.state.layers.masks.get('sand')?.[k], edit: st.landEdits?.[k] ?? 0}; }, [mid.x, mid.z]);
  if (in2d.sand !== 1 || !(in2d.edit > .05)) throw Error(`the 3D sand and hill should come back to the trace: ${JSON.stringify(in2d)}`);
  if (!/Back from the 3D editor with .*layer/.test(await page.locator('.cb-note').textContent())) throw Error('door 2 should say what came back');
  const planFit = await page.evaluate(() => { const c = document.querySelector('canvas.cb-plan'); return [c.width, Math.round(c.getBoundingClientRect().width * devicePixelRatio)]; });
  if (Math.abs(planFit[0] - planFit[1]) > 2) throw Error(`door 2's plan should fill its place again: ${planFit}`);
  // ...and its status bar and notes inside the window (a stale canvas size
  // once pushed them below it; the plan bar became the status bar, builder-ux).
  const below = await page.evaluate(() => ['.cb-statusbar', '.cb-note'].map(q => document.querySelector(q).getBoundingClientRect().bottom - innerHeight));
  if (below.some(v => v > 1)) throw Error(`door 2's plan bar and notes should be inside the window: ${below}`);
  await t.shot('back-to-2d');
  await page.getByRole('button', {name: 'Open in the editor'}).click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view && document.querySelector('.cb-view canvas'), null, {timeout: 120000});
  const again = await page.evaluate(([x, z]) => { const e = window.fairwayBuilder.editor.editor; return {kind: e.surfaceAt(x, z), h: e.height(x, z)}; }, [mid.x, mid.z]);
  if (again.kind !== 'sand' || Math.abs(again.h - h3d1) > .05) throw Error(`the editor again should have the sand and the hill: ${JSON.stringify(again)} against ${h3d1}`);
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const file = path.join(SHOTS, 'builder-door-2.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  if (bytes[0] !== 0x50) throw Error('the saved file is not a built course');
  // Close asks twice, then the builder's start.
  const asked1 = asked.length;
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.waitForSelector('.cb-door', {timeout: 10000});
  if (asked.length !== asked1 + 2) throw Error(`Close should ask twice: ${JSON.stringify(asked.slice(asked1))}`);
  await playOneShot(t, bytes, 'builder-door-2');
 });
}
