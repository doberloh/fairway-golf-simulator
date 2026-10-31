#!/usr/bin/env node
// A GENERATED COURSE AND ITS FROZEN COPY, PHOTOGRAPHED FROM THE SAME PLACES
// (the course builder, stage 1; docs/COURSE_BUILDER.md).
//
//   node tools/gpu-run.mjs --goal course-builder --util 30 --temp 80 --rest 1 -- node tools/freeze-capture.mjs
//   node tools/freeze-capture.mjs --biome desert --seed FREEZE-DESERT-1 --quality low
//
// Freezes the course in Node (freeze.js) and writes its file, opens the BUILT
// game (dist/index.html) by file:// in a real browser, plays the generated
// course (lab.course) and photographs fixed poses, then hands the file in
// (lab.built) and plays the built course from it and photographs the same
// poses. Pictures, and each pair's share of pixels that changed beyond a
// small tolerance (tools/png-diff.mjs), go to bench/shots/freeze/ (not
// committed). Fails on any page error or network request, like the smoke test.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {writeBuiltFile} from '../src/course-doc.js';
import {BUILT_VERSION} from '../src/settings-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'bench', 'shots', 'freeze');
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const biome = opt('biome', 'midwest'), seed = opt('seed', `FREEZE-${biome.toUpperCase()}-1`), holes = Number(opt('holes', 9)), quality = opt('quality', 'high');
const settings = {seed, biome, holes};

fs.mkdirSync(OUT, {recursive: true});
const file = path.join(OUT, `${biome}-${seed}.fairway`);
{
 const w = generateWorld({...DEFAULT_COURSE, ...settings});
 fs.writeFileSync(file, await writeBuiltFile(freezeWorld(w, {name: `${biome} ${seed} frozen`}), BUILT_VERSION));
 console.log(`froze ${seed} (${biome}): ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
}

const POSES = [
 ['tee-1', {hole: 0, along: -8, across: 0, height: 1.8, look: 'pin'}],
 ['green-1', {hole: 0, fromGreen: 28, height: 6}],
 ['approach-3', {hole: 2, along: 120, across: 0, height: 12, look: 'pin'}],
 ['green-5', {hole: 4, fromGreen: 22, around: 40, height: 5}],
 ['above', {x: 0, z: 0, height: 900, yaw: 0, pitch: -89}],
];

const browser = await chromium.launch({args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
const errors = [], requests = [];
try {
 const page = await (await browser.newContext({viewport: {width: 1600, height: 900}})).newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
 page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) requests.push(u); });
 await page.addInitScript(q => {
  localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: q, autoResolution: false, frameCap: 0, textSize: 100}));
  if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pcap', profiles: [{id: 'pcap', name: 'Capture', created: 1, xp: 0}]}));
 }, quality);
 await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href);
 await page.waitForFunction(() => window.lab && !document.getElementById('splash'), null, {timeout: 120000});
 await page.addStyleTag({content: '#world>*:not(#scene){display:none!important}header.topbar{display:none!important}#toast{display:none!important}'});
 // The generated run places each pose in its hole's frame and keeps the
 // world pose it used; the built run takes those world poses, because a built
 // hole's frame is turned to point at its green and "along" would differ.
 const used = {};
 const shoot = async tag => {
  for (const [name, pose] of POSES) {
   const got = await page.evaluate(p => window.lab.camera(p), used[name] ?? pose);
   used[name] ??= {x: got.x, z: got.z, yaw: got.yaw, pitch: got.pitch, height: pose.height ?? 2};
   await page.waitForTimeout(1500);
   await page.screenshot({path: path.join(OUT, `${biome}-${tag}-${name}.png`)});
  }
 };
 await page.evaluate(s => window.lab.course(s), settings);
 await page.waitForTimeout(2500);
 await shoot('generated');
 const bytes = [...fs.readFileSync(file)];
 const hash = await page.evaluate(b => window.lab.built(b), bytes);
 await page.evaluate(s => window.lab.course(s), {...settings, built: hash});
 await page.waitForTimeout(2500);
 await shoot('built');
 const state = await page.evaluate(() => ({mode: document.getElementById('app').dataset.mode}));
 console.log('built course loaded, app mode', state.mode, 'hash', hash);
} finally { await browser.close(); }
const {diffPng, writeDiffPng} = await import('./png-diff.mjs');
for (const [name] of POSES) {
 const a = path.join(OUT, `${biome}-generated-${name}.png`), b = path.join(OUT, `${biome}-built-${name}.png`);
 const d = diffPng(a, b); writeDiffPng(a, b, path.join(OUT, `${biome}-diff-${name}.png`));
 console.log(`${name}: ${(100 * d.share).toFixed(2)}% of pixels changed, mean ${d.mean.toFixed(2)}`);
}
if (errors.length) { console.log('PAGE ERRORS:\n ' + errors.join('\n ')); process.exitCode = 1; }
if (requests.length) { console.log('NETWORK REQUESTS: ' + requests.join(', ')); process.exitCode = 1; }
