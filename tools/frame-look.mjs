#!/usr/bin/env node
// Does the new build LOOK like the old one -- with the clock stopped, so the
// only differences left are the ones the code makes.
//
//   OUT=bench/ab/hooked-base SWAP="src/x.js=<old x.js>;..." node tools/capture/build-hooked.mjs
//   OUT=bench/ab/hooked-final node tools/capture/build-hooked.mjs
//   node tools/frame-look.mjs --goal <name> --cap 40 --a bench/ab/hooked-base/index.html --b bench/ab/hooked-final/index.html --tiers ultra,low
//
// WHY. tools/frame-ab.mjs --shots compares screenshots taken at different
// moments, so wind, drifting clouds, water and the map's moving dash differ
// between ANY two shots and hide a small real change. Here both builds run
// with the renderer's clock held at zero from before the course is built
// (window.__view.render is handed dt = 0): clouds stay where the seed put
// them, the trees stop swaying, the water and the dash stand still. Two shots
// of one build are then identical, and every pixel that differs between the
// builds is the code.
//
// It also checks the interface the frame-rate work touched, which no test
// sees: the pin label placed and shown, the wind arrows carrying their
// bearing, the map drawn (not one flat colour) and labelled, and no page
// errors. Goes through the GPU gate and the run log like the other frame tools.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';
import {diffPng, writeDiffPng} from './png-diff.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
 const i = argv.indexOf('--' + name);
 return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback;
};
const A = flag('a'), B = flag('b'), TIERS = String(flag('tiers', 'ultra')).split(',');
const BIOME = flag('biome', 'redwood'), SEED = flag('seed', 'PROFILE'), LABEL = flag('label', 'look');
const OUT = path.join(ROOT, 'bench', 'ab', 'look', LABEL);
// The play camera as the course opens, then fixed free-camera poses.
const SPOTS = [
 ['play1', null],
 ['tee5', {hole: 4, along: -4, height: 1.8, look: 'pin'}],
 ['tee9', {hole: 8, along: -4, height: 1.8, look: 'pin'}],
 ['sun', {hole: 0, along: 60, height: 3, look: 'sun', pitch: 'sun'}],
 ['high', {hole: 2, along: 120, height: 160, look: 'pin', pitch: -35}],
];
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
for (const f of [A, B]) {
 const html = fs.readFileSync(path.resolve(ROOT, f), 'utf8');
 if (!/window[.]__view *=/.test(html)) throw Error(`${f} has no window.__view; build it with tools/capture/build-hooked.mjs`);
}
const frames = (page, n) => page.evaluate(n => new Promise(done => {
 let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step);
}), n);

async function shoot(file, tag, tier) {
 const html = fs.readFileSync(path.resolve(ROOT, file));
 const server = await new Promise(r => { const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => r(s)); });
 const browser = await chromium.launch({headless: true, args: GPU_ARGS});
 const out = {errors: [], checks: {}};
 try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 2});
  await page.addInitScript(p => {
   try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
   try { localStorage.removeItem('fairway-round-v1'); } catch {}
   try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pprof', profiles: [{id: 'pprof', name: 'Profiler', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
  }, {quality: tier, frameCap: 0, autoResolution: false});
  page.on('pageerror', e => out.errors.push(String(e.message).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') out.errors.push(m.text().split('\n')[0]); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.__view && window.lab && window.lab.course, null, {timeout: 60000});
  // THE CLOCK STOPS before the course exists, so its clouds start where the
  // seed puts them and never move.
  await page.evaluate(() => { const v = window.__view, r = v.render; v.render = function () { return r.call(this, 0); }; });
  await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: 9, seed: SEED});
  await page.evaluate(() => { const v = window.__view; v.elapsed = 0; if (v.waterTime) v.waterTime.value = 0; });
  // The interface's own timers (the hole's quiet start, label fades) run on
  // the page's clock, not the renderer's: let them finish.
  await page.waitForTimeout(4000);
  await frames(page, 40);
  for (const [name, pose] of SPOTS) {
   if (pose) await page.evaluate(o => window.lab.camera(o), pose);
   await frames(page, 30);
   const file = path.join(OUT, `${tier}-${tag}-${name}.png`);
   fs.mkdirSync(path.dirname(file), {recursive: true});
   await page.screenshot({path: file});
   if (name === 'play1') {
    // Ten frames later, the same picture: the clock really is stopped.
    await frames(page, 10);
    await page.screenshot({path: file.replace('.png', '-again.png')});
    out.checks = await page.evaluate(() => {
     const flag = document.getElementById('flagLabel'), map = document.getElementById('map');
     const subs = [...document.querySelectorAll('#roundHud .rh-sub')];
     let shades = 0;
     try { const d = map.getContext('2d').getImageData(0, 0, map.width, map.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]); shades = seen.size; } catch {}
     return {
      flagLabel: {left: flag?.style.left, top: flag?.style.top, visibility: flag?.style.visibility, text: flag?.textContent.trim().slice(0, 40)},
      windArrows: subs.length, windBearing: subs.map(s => s.style.getPropertyValue('--wind')).filter(Boolean)[0] ?? null,
      map: {label: map?.getAttribute('aria-label'), hole: map?.dataset.holeNumber, colours: shades},
     };
    });
   }
  }
 } finally { await browser.close(); server.close(); }
 return out;
}

const gate = gpuGate({goal: flag('goal', null), cap: Number(flag('cap', 6))});
const started = Date.now(), report = {};
let failed = null;
try {
 for (const tier of TIERS) {
  const a = await shoot(A, 'A', tier), b = await shoot(B, 'B', tier);
  report[tier] = {a, b, spots: {}};
  for (const [name] of SPOTS) {
   const fa = path.join(OUT, `${tier}-A-${name}.png`), fb = path.join(OUT, `${tier}-B-${name}.png`);
   const d = diffPng(fa, fb);
   writeDiffPng(fa, fb, path.join(OUT, `${tier}-diff-${name}.png`));
   report[tier].spots[name] = d;
  }
  for (const tag of ['A', 'B']) report[tier]['still' + tag] = diffPng(path.join(OUT, `${tier}-${tag}-play1.png`), path.join(OUT, `${tier}-${tag}-play1-again.png`));
 }
} catch (e) { failed = String(e.message).split('\n')[0]; console.log(`FAILED ${failed}`); }
logRun({goal: flag('goal', null), run: gate.run, tool: 'frame-look', label: LABEL, tiers: TIERS, a: A, b: B,
 before: {util: gate.util, temp: gate.temp}, after: (() => { try { return readCard(); } catch { return null; } })(),
 seconds: Math.round((Date.now() - started) / 1000), failed});
if (failed) process.exit(1);

for (const tier of TIERS) {
 const r = report[tier];
 console.log(`\n${tier} · ${BIOME} ${SEED} · clock stopped`);
 console.log(`  still: two shots of one build 10 frames apart differ by ${(r.stillA.share * 100).toFixed(3)}% (A), ${(r.stillB.share * 100).toFixed(3)}% (B)`);
 for (const [name] of SPOTS) {
  const d = r.spots[name];
  console.log(`  ${name.padEnd(6)} A vs B: ${(d.share * 100).toFixed(3)}% of pixels changed, mean difference ${d.mean.toFixed(3)} of 255`);
 }
 for (const tag of ['a', 'b']) {
  const c = r[tag].checks;
  console.log(`  ${tag.toUpperCase()} interface: pin label ${c.flagLabel?.visibility} at ${c.flagLabel?.left},${c.flagLabel?.top} "${c.flagLabel?.text}"; wind arrows ${c.windArrows} at ${c.windBearing}; map "${c.map?.label}" hole ${c.map?.hole}, ${c.map?.colours} colours sampled; page errors ${r[tag].errors.length}${r[tag].errors.length ? ': ' + [...new Set(r[tag].errors)].slice(0, 3).join(' | ') : ''}`);
 }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)} s on the card; pictures and differences in bench/ab/look/${LABEL}/`);
