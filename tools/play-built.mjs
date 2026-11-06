#!/usr/bin/env node
// EVERY BUILT COURSE OPENED IN THE GAME (the owner, 1 November 2026: "build me
// a working version of every course"): each .fairway under bench/courses/
// (tools/build-courses.mjs) loaded into the built game as Saved courses does
// (lab.built), a round started on it, a picture from hole 1's tee, one tee
// shot played the way a keyboard player takes one, and a picture after.
// Fails a course on any page error, console error or network request. Uses
// the graphics card (on the course-builder branch, through tools/gpu-run.mjs).
//
//   node tools/play-built.mjs [key ...]
// Pictures to bench/courses/<key>/game-*.png (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), HOME = path.join(ROOT, 'bench', 'courses');
const want = process.argv.slice(2);
const keys = fs.readdirSync(HOME).filter(k => fs.statSync(path.join(HOME, k)).isDirectory() && (!want.length || want.includes(k)));
const browser = await chromium.launch({args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
let failed = 0;
try {
 for (const key of keys) {
  const file = fs.readdirSync(path.join(HOME, key)).find(f => f.endsWith('.fairway'));
  if (!file) { console.log(`${key}: no course built`); continue; }
  const page = await browser.newPage({viewport: {width: 1600, height: 900}}), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errors.push('request ' + r.url()); });
  const t0 = Date.now();
  try {
   await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href);
   await page.waitForFunction(() => window.lab && !document.getElementById('splash'), null, {timeout: 120000});
   const bytes = [...fs.readFileSync(path.join(HOME, key, file))];
   const hash = await page.evaluate(b => window.lab.built(b), bytes);
   await page.evaluate(h => window.lab.course({built: h}), hash);
   await page.waitForFunction(() => document.getElementById('app').dataset.mode === 'play', null, {timeout: 180000});
   await page.waitForFunction(() => window.lab.state().canSwing, null, {timeout: 60000});
   // A fresh browser is a first visit: the welcome asks a name.
   if (await page.evaluate(() => document.getElementById('welcome')?.hidden === false)) { await page.fill('#welcomeName', 'Tester'); await page.click('#welcomeGo'); }
   await page.waitForTimeout(1500);
   await page.screenshot({path: path.join(HOME, key, 'game-tee.png')});
   const from = await page.evaluate(() => window.lab.state().ballAt);
   await page.keyboard.press('Space'); await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(300); await page.keyboard.press('Space');
   await page.waitForFunction(() => window.lab.state().inFlight, null, {timeout: 10000});
   await page.keyboard.press('Enter');
   await page.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 60000});
   const to = await page.evaluate(() => window.lab.state().ballAt), went = Math.hypot(to.x - from.x, to.z - from.z);
   await page.waitForTimeout(1500);
   await page.screenshot({path: path.join(HOME, key, 'game-shot.png')});
   // A shot into water or out of bounds waits on the player's relief with the
   // ball where it was: played, and the game working (Druids Glen's 1st, a
   // pond to the right).
   const relief = await page.evaluate(() => /IN THE WATER|OUT OF BOUNDS|DROP HERE/i.test(document.body.innerText));
   if (went < 20 && !relief) throw Error(`the tee shot went ${went.toFixed(0)} m`);
   if (relief) console.log(`  ${key}: the tee shot found a penalty area; the game offered relief`);
   if (errors.length) throw Error(errors.join('; '));
   console.log(`PASS ${key}: loaded and a ${went.toFixed(0)} m tee shot played (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } catch (e) { failed++; console.log(`FAIL ${key}: ${e.message}${errors.length ? ' | ' + errors.join('; ') : ''}`); await page.screenshot({path: path.join(HOME, key, 'game-FAIL.png')}).catch(() => {}); }
  finally { await page.close(); }
 }
} finally { await browser.close(); }
console.log(failed ? `${failed} of ${keys.length} failed` : `all ${keys.length} played`);
process.exit(failed ? 1 : 0);
