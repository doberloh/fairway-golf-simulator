#!/usr/bin/env node
// THE COURSE BUILDER ON THE WEBSITE (13 November 2026, for the website's
// Course Builder section). The builder guide's own trace picture
// (tools/capture/builder-guide.mjs) has the brush on semi-rough, so the model
// of the surface stands open over the plan; the owner: "Dont have the material
// pop up open. retake that." This takes the same trace step of the real
// course draft with the Select tool in hand -- the preview shows only for the
// tools that paint or place (door-real.js, showModel) -- at the website's size:
// 1920x1080 at density 2, saved like the other screens.
//   bench/shots/media/screens/course-builder.png (4K master) / .jpg (2560) / -thumb.jpg (960)
// (or under $MEDIA_OUT/screens/). Not committed; the owner picks for the site.
//
//   node tools/gpu-run.mjs --goal <goal> -- node tools/capture/builder-site.mjs [--draft <file>]
//
// Needs dist/builder.html (npm run build) and the real-course draft
// bench/courses/worthington-builder.fairway-draft (builder-guide.mjs says how
// it is made). It goes online for nothing.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {launch, saveStill} from './capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const DRAFT = path.resolve(ROOT, opt('draft') ?? 'bench/courses/worthington-builder.fairway-draft');
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/screens`;
if (!fs.existsSync(path.join(ROOT, 'dist', 'builder.html'))) throw Error('No dist/builder.html: npm run build first.');
if (!fs.existsSync(DRAFT)) throw Error(`No draft at ${DRAFT}: make one with bench/shots/build-for-me.mjs (BFM_DRAFT), or pass --draft.`);

const browser = await launch();
const errors = [];
try {
 const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 2});
 await ctx.addInitScript(() => { window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined; });
 const page = await ctx.newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('request', r => { if (/^https?:/.test(r.url())) errors.push('request ' + r.url()); });
 page.on('dialog', d => d.accept());
 const idle = () => page.waitForFunction(() => document.querySelector('.cb-busy')?.hidden !== false, null, {timeout: 300000});
 await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'builder.html')).href);
 await page.getByRole('button', {name: /Generate a real life course/}).waitFor();
 await page.getByRole('button', {name: /Generate a real life course/}).click();
 await page.locator('.cb-menuhead', {hasText: 'File'}).click();
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('menuitem', {name: /Open a course file/}).click()]);
 await chooser.setFiles(DRAFT);
 await page.waitForFunction(() => window.fairwayBuilder.door2?.land && window.fairwayBuilder.door2.step >= 2, null, {timeout: 300000}); await idle();
 await page.locator('.cb-stepchip', {hasText: 'Trace'}).click(); await idle();
 await page.locator('[data-tool="select"]').click();
 await page.keyboard.press('F');
 await page.waitForTimeout(1500);
 if (await page.evaluate(() => { const b = document.querySelector('.cb-preview'); return !!b && !b.hidden; })) throw Error('the surface preview is open');
 // Any "Got it" tip left open covers part of the panel: close it.
 await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^got it$/i.test(b.textContent.trim()) && b.offsetParent) b.click(); });
 await page.waitForTimeout(800);
 await saveStill(page, `${OUT}/course-builder`);
 console.log(`saved ${OUT}/course-builder`);
} finally { await browser.close(); }
if (errors.length) { console.error('errors:', errors.join(' | ')); process.exit(1); }
