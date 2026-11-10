// Door 2's LIDAR folder and finding (the owner, 1 November 2026: downloads
// "go somewhere local always. We don't want the user needing to re download
// the files"; results that read as clickable; a tooltip on every button; the
// files' coverage in yellow). A place found -- its result a button -- every
// source over it searched (the National Map, Hobu's Entwine index and USGS's
// Entwine copy stood in for by the journey: one piece of points over the
// square); the square downloaded, written to the LIDAR folder as its ZIP and
// shown yellow over the relief; door 2 opened again and the same square
// read from the folder with nothing asked of USGS; Load from the folder
// lists it, ticked as over the place. The folder is a stand-in in the page
// (showDirectoryPicker is a dialog a script cannot answer), so the browser
// remembering it between visits (IndexedDB) is not driven here.
// Registered by tools/builder-smoke.mjs.
const GEO = {lat: 43.63, lon: -95.62}, R = 6378137;
const merc = (lon, lat) => ({x: lon * Math.PI / 180 * R, y: R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))});
// One Entwine piece: 200 x 200 points over the 1.8 km square, in Web Mercator
// (a LAS 1.2 file, point format 0; the builder reads it as it reads LAZ).
export function piece() {
 const h = 900 / 111320, w = h / Math.cos(GEO.lat * Math.PI / 180), a = merc(GEO.lon - w, GEO.lat - h), b = merc(GEO.lon + w, GEO.lat + h), n = 200;
 const head = 227, len = 20, buf = new ArrayBuffer(head + len * n * n), v = new DataView(buf), u = new Uint8Array(buf);
 u.set(new TextEncoder().encode('LASF'), 0); u[24] = 1; u[25] = 2; v.setUint16(94, head, true); v.setUint32(96, head, true); u[104] = 0; v.setUint16(105, len, true); v.setUint32(107, n * n, true);
 for (const k of [131, 139, 147]) v.setFloat64(k, .01, true);
 v.setFloat64(155, a.x, true); v.setFloat64(163, a.y, true); v.setFloat64(179, b.x, true); v.setFloat64(187, a.x, true); v.setFloat64(195, b.y, true); v.setFloat64(203, a.y, true); v.setFloat64(211, 310, true); v.setFloat64(219, 300, true);
 for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const o = head + (i * n + j) * len, x = (b.x - a.x) * (i + .5) / n, y = (b.y - a.y) * (j + .5) / n;
  v.setInt32(o, Math.round(x / .01), true); v.setInt32(o + 4, Math.round(y / .01), true); v.setInt32(o + 8, Math.round((5 + Math.sin(i / 20) * 2) / .01), true); v.setUint16(o + 12, 40000, true); u[o + 14] = 1 | 1 << 3; u[o + 15] = 2; }
 return {bytes: Buffer.from(buf), cube: [a.x - 500, a.y - 500, 0, a.x + 4000, a.y + 4000, 4500]};
}

export default function ({journey}) {
 journey('builder-lidar-folder', 'door 2\'s LIDAR folder: a place found (results as buttons), the square downloaded and kept in the folder, its coverage yellow; opened again, read from the folder with no download; listed by Load from the folder; every button with a tooltip', async t => {
  const {page} = t;
  await page.setViewportSize({width: 1600, height: 1000});
  const EPT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/MN_TEST_1_B21/';
  t.allow.push(/^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/tnmaccess\.nationalmap\.gov\//, /^https:\/\/raw\.githubusercontent\.com\/hobuinc\//, /^https:\/\/s3-us-west-2\.amazonaws\.com\/usgs-lidar-public\//);
  const json = body => ({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(body)});
  const {bytes, cube} = piece(); let pieces = 0;
  await page.route(/nominatim\.openstreetmap\.org/, r => r.fulfill(json([{lon: String(GEO.lon), lat: String(GEO.lat), display_name: 'A test place, Minnesota'}])));
  await page.route(/raw\.githubusercontent\.com\/hobuinc/, r => r.fulfill(json({features: [{properties: {name: 'MN_TEST_1_B21', url: EPT + 'ept.json', count: 4e4}, geometry: {type: 'Polygon', coordinates: [[[-96, 43], [-95, 43], [-95, 44], [-96, 44], [-96, 43]]]}}]})));
  await page.route(/tnmaccess\.nationalmap\.gov/, r => r.fulfill(json({items: [1, 2].map(n => ({publicationDate: '2023-02-10', sizeInBytes: 6e7, downloadLazURL: `https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/MN_TEST/MN_TEST_1_B21/LAZ/USGS_LPC_MN_TEST_${n}.laz`}))})));
  await page.route(/usgs-lidar-public\/MN_TEST_1_B21\//, r => {
   const u = r.request().url();
   if (u.endsWith('ept.json')) return r.fulfill(json({dataType: 'laszip', bounds: cube}));
   if (u.includes('ept-hierarchy/')) return r.fulfill(json({'0-0-0-0': 40000}));
   pieces++; return r.fulfill({status: 200, contentType: 'application/octet-stream', headers: {'Access-Control-Allow-Origin': '*'}, body: bytes});
  });
  // The LIDAR folder: a stand-in for the folder showDirectoryPicker hands
  // back, its files kept in the page.
  await page.evaluate(() => {
   const files = new Map();
   const dir = {name: 'Downloads', kind: 'directory', files,
    async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; },
    async getFileHandle(n, {create = false} = {}) {
     if (!files.has(n) && !create) throw new DOMException('not found', 'NotFoundError');
     return {kind: 'file', name: n, getFile: async () => new File([files.get(n) ?? new Uint8Array()], n),
      createWritable: async () => { const parts = []; return {write: async b => { parts.push(b); }, close: async () => { files.set(n, new Uint8Array(await new Blob(parts).arrayBuffer())); }, abort: async () => {}}; }};
    },
    async *entries() { for (const n of files.keys()) yield [n, await dir.getFileHandle(n)]; }};
   window.__lidarFolder = dir; window.__picks = 0;
   window.showDirectoryPicker = async () => { window.__picks++; return dir; };
  });
  const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy').hidden, null, {timeout: 120000});
  async function findAndSearch() {
   await page.locator('.cb-lidarplace').fill('A test place');
   await page.getByRole('button', {name: 'Find', exact: true}).click();
   // The result is a button, under a line saying to click one.
   await page.waitForSelector('.cb-result');
   const head = await page.locator('.cb-resulthead').textContent(), res = page.locator('.cb-result');
   if (await res.count() !== 1 || !/click one to use it/.test(head) || !/Use/.test(await res.textContent()) || !await res.getAttribute('title')) throw Error(`the place found should be a button to click: ${head}`);
   await res.click();
   await page.getByRole('button', {name: 'Search for LIDAR'}).click();
   await page.waitForSelector('[data-download="MN_TEST_1_B21"]', {timeout: 30000});
  }
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  await findAndSearch();
  const all = page.locator('[data-rocky="MN_TEST_1_B21"]');
  if (await all.textContent() !== 'Download all tiles' || !/LIDAR folder/.test(await all.getAttribute('title'))) throw Error('the whole tiles should be offered as Download all tiles, with a tooltip');
  // Every button door 2 shows now has a tooltip.
  const bare = await page.evaluate(() => [...document.querySelectorAll('.cb-door2 button, .cb-top button')].filter(b => b.offsetParent && !b.title).map(b => b.textContent));
  if (bare.length) throw Error(`every button should have a tooltip; these have none: ${bare.join(', ')}`);
  // Downloaded: written to the folder as its ZIP, read, shown yellow.
  await page.locator('[data-download="MN_TEST_1_B21"]').click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.sources.length === 1, null, {timeout: 60000}); await idle();
  const kept = await page.evaluate(() => [...window.__lidarFolder.files].map(([n, b]) => [n, b.length]));
  if (pieces !== 1 || kept.length !== 1 || !/^MN_TEST_1_B21_43\.6300_-95\.6200_1800m\.ept\.zip$/.test(kept[0][0]) || !(kept[0][1] > 4e4 * 20)) throw Error(`the square should be downloaded once and kept in the folder: ${pieces} pieces, ${JSON.stringify(kept)}`);
  const said = await page.locator('.cb-note').textContent();
  if (!/Saved to your LIDAR folder \(Downloads\)/.test(said)) throw Error(`door 2 should say where the download was saved: ${said}`);
  const cover = await page.evaluate(() => { const v = window.fairwayBuilder.door2.plan.view, c = v.layers.coverage; if (!c) return {layer: false}; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) n++; return {layer: true, shown: v.show.coverage, share: n / (c.width * c.height)}; });
  if (!cover.layer || !cover.shown || !(cover.share > .5)) throw Error(`the files' coverage should show yellow over the relief: ${JSON.stringify(cover)}`);
  await t.shot('coverage');
  // Door 2 again: the same square read from the folder, nothing downloaded.
  // Back asks twice when door 2 holds work (both answered yes).
  const asked = []; page.on('dialog', d => { asked.push(d.message()); d.accept(); });
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  if (asked.length !== 2) throw Error(`leaving door 2 with work in it should ask twice: ${JSON.stringify(asked)}`);
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  if (!/Downloads/.test(await page.locator('.cb-foldername').textContent())) throw Error('door 2 should remember the LIDAR folder');
  await findAndSearch();
  await page.locator('[data-download="MN_TEST_1_B21"]').click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.sources.length === 1, null, {timeout: 60000}); await idle();
  const again = await page.evaluate(() => ({kept: window.fairwayBuilder.door2.sources[0].kept, list: document.querySelector('.cb-door2 ul:not(.cb-found)')?.textContent ?? '', picks: window.__picks}));
  if (pieces !== 1 || !again.kept || again.picks !== 1) throw Error(`the second time the square should be read from the folder, not downloaded: ${pieces} pieces, ${JSON.stringify(again)}`);
  // Load from the folder: the square listed, ticked as over the place.
  await page.getByRole('button', {name: 'Load from the folder'}).click(); await idle();
  const listed = await page.evaluate(() => [...document.querySelectorAll('.cb-folderfiles li')].map(li => ({text: li.textContent, on: li.querySelector('input').checked})));
  if (listed.length !== 1 || !listed[0].on || !/over this place/.test(listed[0].text)) throw Error(`Load from the folder should list the kept square, ticked: ${JSON.stringify(listed)}`);
  // A long file name must not squeeze a row's tick box away (the owner, 5
  // November 2026: one box showing in a list of USGS tiles).
  const box = await page.evaluate(() => { const b = document.querySelector('.cb-folderfiles input'); return {shrink: getComputedStyle(b).flexShrink, width: b.getBoundingClientRect().width}; });
  if (box.shrink !== '0' || box.width < 12) throw Error(`a tick box must keep its size: ${JSON.stringify(box)}`);
  await t.shot('folder');
 });
}
