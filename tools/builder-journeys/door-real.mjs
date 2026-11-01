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
function tilePng(rgb) {
 const raw = Buffer.alloc((256 * 3 + 1) * 256);
 for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) raw.set((x >> 5 & 1) ^ (y >> 5 & 1) ? rgb : rgb.map(v => v * .8), y * (256 * 3 + 1) + 1 + x * 3);
 const head = Buffer.alloc(13); head.writeUInt32BE(256, 0); head.writeUInt32BE(256, 4); head[8] = 8; head[9] = 2;
 return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export default function ({journey, SHOTS}) {
 journey('builder-door-2', 'door 2 in order: LIDAR and the property boxed, land, place searched and imagery fetched and dragged, auto trace corrected by hand, nine holes with an aim point, name, the painted review, editor, saved; the game plays the file', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  // The stand-ins: OpenStreetMap's place search and USGS's tiles.
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/basemap\.nationalmap\.gov\//);
  let tiles = 0;
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
  // Move shape: the bunker picked up and put down 12 m south, then back by Undo.
  const sandCells = () => page.evaluate(() => window.fairwayBuilder.door2.model.state.layers.mask('sand').reduce((t, v) => t + v, 0));
  const sand0 = await sandCells();
  await page.locator('[data-tool="shape"]').click();
  [x0, y0] = await at(-55, 40); [x1, y1] = await at(-55, 52);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, {steps: 5});
  if (!/Moving the sand/.test(await page.locator('.cb-toolhint').textContent())) throw Error('the banner should say the sand is being moved');
  await page.mouse.up();
  if (await kindAt(-55, 52) !== 'sand' || await kindAt(-55, 40) === 'sand' || await sandCells() !== sand0) throw Error(`the bunker should have moved 12 m whole (${sand0} -> ${await sandCells()} cells)`);
  await t.shot('shape-moved');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  if (await kindAt(-55, 40) !== 'sand') throw Error('Undo should put the bunker back');
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
  await page.locator('.cb-landscape').selectOption('links');
  await page.locator('[data-tool="outline"]').click(); await page.locator('.cb-kind').selectOption('heather');
  for (const [x, z] of [[100, 80], [130, 80], [130, 100], [100, 100]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  await page.keyboard.press('Enter');
  if (await kindAt(115, 90) !== 'heather') throw Error('the outline should have filled heather');
  const treesBefore = await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length);
  await page.locator('[data-tool="treeZone"]').click();
  for (const [x, z] of [[-180, -130], [-150, -130], [-150, -100], [-180, -100]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
  await page.keyboard.press('Enter');
  const treesAfter = await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length);
  if (treesAfter <= treesBefore) throw Error('the tree zone should have planted trees');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  if (await page.evaluate(() => window.fairwayBuilder.door2.model.state.trees.length) !== treesBefore) throw Error('Undo should take the zone\'s trees away');
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
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const file = path.join(SHOTS, 'builder-door-2.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  if (bytes[0] !== 0x50) throw Error('the saved file is not a built course');
  await playOneShot(t, bytes, 'builder-door-2');
 });
}
