#!/usr/bin/env node
// THE BUILDER GUIDE'S PICTURES (the builder-ux goal, item 22, 10 November
// 2026; the owner: "Include screenshots and make sure that future changes also
// update this doc"). The built builder (dist/builder.html) photographed at
// 1440 x 900 on the same screens every time, saved small as WebP in
// docs/builder-guide/, which tools/builder-guide.mjs inlines into the guide.
// Re-run it after any builder change that alters a screen the guide shows.
//
//   node tools/gpu-run.mjs --goal <goal> -- node tools/capture/builder-guide.mjs
//
// The real-course pictures come from a door 2 draft of a real course, local
// (bench/courses/worthington-builder.fairway-draft, made by Build it for me on
// Worthington Country Club: bench/shots/build-for-me.mjs with BFM_DRAFT set);
// `--draft <file>` names another. It goes online for nothing.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'docs', 'builder-guide');
const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const DRAFT = path.resolve(ROOT, opt('draft') ?? 'bench/courses/worthington-builder.fairway-draft');
if (!fs.existsSync(path.join(ROOT, 'dist', 'builder.html'))) throw Error('No dist/builder.html: npm run build first.');
if (!fs.existsSync(DRAFT)) throw Error(`No draft at ${DRAFT}: make one with bench/shots/build-for-me.mjs (BFM_DRAFT), or pass --draft.`);
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch({args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, acceptDownloads: true});
await ctx.addInitScript(() => { window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined; });
const page = await ctx.newPage(), conv = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// The map before the LIDAR (10 November 2026): Worthington's place search and
// the USGS tiles round it, kept locally by bench/shots/map-first.mjs (run once
// on real services) in bench/shots/map-tiles, are served from there -- so
// this still goes online for nothing. Without them that screen is skipped.
const TILES = path.join(ROOT, 'bench', 'shots', 'map-tiles'), haveMap = fs.existsSync(path.join(TILES, 'place.json'));
const kept = u => /^https:[/][/](basemap[.]nationalmap[.]gov|nominatim[.]openstreetmap[.]org)[/]/.test(u);
await page.route(/nominatim[.]openstreetmap[.]org/, r => r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: haveMap ? fs.readFileSync(path.join(TILES, 'place.json')) : '[]'}));
await page.route(/basemap[.]nationalmap[.]gov/, r => {
 const m = r.request().url().match(/tile[/]([0-9]+)[/]([0-9]+)[/]([0-9]+)/), f = m && path.join(TILES, m[1], m[2], m[3] + '.jpg');
 return f && fs.existsSync(f) ? r.fulfill({status: 200, contentType: 'image/jpeg', headers: {'Access-Control-Allow-Origin': '*'}, body: fs.readFileSync(f)}) : r.fulfill({status: 404, headers: {'Access-Control-Allow-Origin': '*'}, body: ''});
});
page.on('request', r => { const u = r.url(); if (/^https?:/.test(u) && !kept(u)) errors.push('request ' + u); });
page.on('dialog', d => d.accept());
const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy')?.hidden !== false, null, {timeout: 300000});
// A screenshot as a WebP (quality .82), through a canvas in a second page.
async function shot(name, clip = null) {
 await page.waitForTimeout(500);
 const png = await page.screenshot(clip ? {clip} : {});
 const webp = await conv.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/webp', .82).split(',')[1]; }, png.toString('base64'));
 fs.writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(webp, 'base64'));
 console.log(`${name}.webp ${(Buffer.from(webp, 'base64').length / 1024).toFixed(0)} KB`);
}

await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'builder.html')).href);
await page.getByRole('button', {name: /Generate a real life course/}).waitFor();
await shot('home');
// Door 2, its first step: the course found by name (a golf course is taken
// at once), the map round it, a box dragged round the course; then Build it
// for me and its warning.
await page.getByRole('button', {name: /Generate a real life course/}).click();
await page.locator('.cb-lidarplace').fill('Worthington Country Club, Minnesota');
if (haveMap) {
 await page.getByRole('button', {name: 'Find', exact: true}).click();
 await page.waitForFunction(() => window.fairwayBuilder.door2.map, null, {timeout: 60000}); await idle();
 const plan = page.locator('canvas.cb-plan'), at = async (x, z) => { const b = await plan.boundingBox(), [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]), r = await plan.evaluate(c => c.width / c.getBoundingClientRect().width); return [b.x + cx / r, b.y + cy / r]; };
 const here = await page.evaluate(() => { const s = window.fairwayBuilder.door2; return s.map.toLocal(s.find.lon, s.find.lat); });
 await page.evaluate(h => window.fairwayBuilder.door2.plan.look(h.x + 200, h.z + 150, window.fairwayBuilder.door2.plan.view.scale * 1.6), here);
 const [ax, ay] = await at(here.x - 700, here.z - 450), [bx, by] = await at(here.x + 520, here.z + 800);
 await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, {steps: 8}); await page.mouse.up();
 await shot('map-box');
 await page.getByRole('button', {name: 'Build it for me', exact: true}).click();
 await page.locator('.cb-formeask').waitFor();
 await shot('build-it-for-me');
 await page.locator('[data-build="no"]').click();
} else {
 await shot('build-it-for-me');
 console.log('map-box skipped, and build-it-for-me shows only the name: no bench/shots/map-tiles (run bench/shots/map-first.mjs once)');
}
// The real course, from its draft: the holes step and the map checks.
await page.locator('.cb-menuhead', {hasText: 'File'}).click();
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('menuitem', {name: /Open a course file/}).click()]);
await chooser.setFiles(DRAFT);
await page.waitForFunction(() => window.fairwayBuilder.door2?.land && window.fairwayBuilder.door2.step >= 2, null, {timeout: 300000}); await idle();
await page.locator('.cb-stepchip', {hasText: 'Holes'}).click(); await idle();
await page.keyboard.press('F');
await shot('holes-checks');
// The trace step: the palette, the tool's options, the layers.
await page.locator('.cb-stepchip', {hasText: 'Trace'}).click(); await idle();
await page.locator('[data-tool="brush"]').click();
await page.locator('.cb-kind').selectOption('semi');
await page.keyboard.press('F');
await shot('trace');
await shot('layers', {x: 1080, y: 96, width: 360, height: 600});
// The pen, part way round a green, the pointer on its first node.
const green = await page.evaluate(() => { const s = window.fairwayBuilder.door2, h = s.holes.find(h => h?.green); return h.green; });
await page.evaluate(g => window.fairwayBuilder.door2.plan.look(g.x, g.z, 5), green);
await page.locator('[data-tool="outline"]').click();
const at = async (x, z) => { const box = await page.locator('canvas.cb-plan').boundingBox(), [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]), r = await page.locator('canvas.cb-plan').evaluate(c => c.width / c.getBoundingClientRect().width); return [box.x + cx / r, box.y + cy / r]; };
for (const [dx, dz] of [[-16, -6], [-4, -18], [14, -10], [16, 8], [0, 18]]) { const [x, y] = await at(green.x + dx, green.z + dz); await page.mouse.click(x, y); }
{ const [x, y] = await at(green.x - 15.7, green.z - 5.8); await page.mouse.move(x, y); }
await shot('pen');
await page.keyboard.press('Escape');
await page.keyboard.press('F');
// The keyboard shortcuts.
await page.keyboard.press('?');
await shot('keys');
await page.keyboard.press('Escape');
// The review, and Play it in Fairway.
await page.locator('.cb-stepchip', {hasText: 'Review'}).click();
await page.waitForFunction(() => window.fairwayBuilder.door2.doc, null, {timeout: 300000}); await idle();
await shot('review');
// The 3D editor.
await page.getByRole('button', {name: 'Open in the editor'}).click();
await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 300000}); await idle();
await page.waitForTimeout(2500);
await shot('editor');
await browser.close();
if (errors.length) { console.error('errors:', errors.join(' | ')); process.exit(1); }
console.log('done: docs/builder-guide/');
