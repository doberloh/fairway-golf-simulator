#!/usr/bin/env node
// FAIRWAY COURSE BUILDER, OPENED IN A REAL BROWSER AND DRIVEN
// (docs/COURSE_BUILDER.md; docs/TESTING.md, *The builder's smoke journeys*).
//
//   node tools/builder-smoke.mjs                 every journey against dist/builder.html
//   node tools/builder-smoke.mjs --only builder-opens
//   node tools/builder-smoke.mjs --headed        watch it
//   node tools/builder-smoke.mjs --list
//
// The game's harness (tools/smoke.mjs) plays Fairway.html; this one drives the
// builder's page the same way and on the same terms: opened by file:// URL as
// a player opens it, and a journey FAILS on any uncaught error, any
// console.error, or ANY network request -- the builder promises none, like
// the game. Each journey a fresh page. It uses the graphics card (the
// builder draws the land), so main's rules decide when it runs; on the
// course-builder branch it runs without asking, through tools/gpu-run.mjs.
//
// Journeys that need a course file make it with the game's own code in Node
// first (tools/builder-fixtures.mjs), so a journey never depends on another.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'dist', 'builder.html');
const SHOTS = path.join(ROOT, 'bench', 'shots', 'builder-smoke');
const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const option = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

export const JOURNEYS = {};
const journey = (name, what, fn) => { JOURNEYS[name] = {what, fn}; };

journey('builder-opens', 'the builder opens offline on its three doors, each answers, Back returns', async t => {
 await t.page.getByRole('button', {name: /Generate and modify a course/}).waitFor();
 await t.page.getByRole('button', {name: /Generate a real life course/}).waitFor();
 await t.page.getByRole('button', {name: /Open a course file/}).waitFor();
 const versions = await t.page.locator('meta[name="fairway-builder-versions"]').getAttribute('content');
 if (!/generator=\d+ schema=\d+ built=\d+/.test(versions || '')) throw Error(`version line missing: ${versions}`);
 await t.page.getByRole('button', {name: /Generate and modify a course/}).click();
 await t.page.getByRole('button', {name: /^Back$/}).first().click();
 await t.page.getByRole('button', {name: /Generate a real life course/}).waitFor();
});

// Extra journeys register from modules beside this one as stages add them.
for (const f of fs.existsSync(path.join(ROOT, 'tools', 'builder-journeys')) ? fs.readdirSync(path.join(ROOT, 'tools', 'builder-journeys')) : []) {
 if (f.endsWith('.mjs')) (await import(pathToFileURL(path.join(ROOT, 'tools', 'builder-journeys', f)))).default({journey, ROOT, SHOTS});
}

async function run() {
 if (flag('list')) { for (const [k, j] of Object.entries(JOURNEYS)) console.log(`${k.padEnd(22)} ${j.what}`); return; }
 if (!fs.existsSync(PAGE)) { console.error('No dist/builder.html. Run `npm run build` first.'); process.exit(2); }
 fs.mkdirSync(SHOTS, {recursive: true});
 const only = option('only')?.split(',');
 const names = Object.keys(JOURNEYS).filter(n => !only || only.includes(n));
 const browser = await chromium.launch({headless: !flag('headed'), args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
 let failed = 0;
 try {
  for (const name of names) {
   const context = await browser.newContext({viewport: {width: 1600, height: 900}, acceptDownloads: true});
   const page = await context.newPage();
   const errors = [], requests = [], allow = [];
   page.on('pageerror', e => errors.push('pageerror: ' + e.message));
   page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
   // A journey that stands in for an imagery provider (page.route) names its
   // addresses in `t.allow`; every other request fails it, as ever.
   page.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:') && !allow.some(a => a.test(u))) requests.push(u); });
   const t = {page, context, ROOT, SHOTS, allow, shot: n => page.screenshot({path: path.join(SHOTS, `${name}-${n}.png`)})};
   const start = Date.now();
   try {
    await page.goto(pathToFileURL(PAGE).href);
    await JOURNEYS[name].fn(t);
    if (errors.length) throw Error(errors.join('\n'));
    if (requests.length) throw Error('network requests: ' + requests.join(', '));
    console.log(`PASS ${name} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
   } catch (e) {
    failed++;
    await page.screenshot({path: path.join(SHOTS, `${name}-FAIL.png`)}).catch(() => {});
    console.log(`FAIL ${name}: ${e.message}${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
   } finally { await context.close(); }
  }
 } finally { await browser.close(); }
 console.log(failed ? `${failed} of ${names.length} journeys failed` : `all ${names.length} journeys passed`);
 process.exit(failed ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
