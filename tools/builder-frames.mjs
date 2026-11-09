#!/usr/bin/env node
// THE COURSE BUILDER'S WAIT AND FRAMES, ON A REAL COURSE FILE.
//
//   node tools/builder-frames.mjs --goal <name> --file "bench/courses/dinosaur-mountain/Dinosaur Mountain.fairway"
//   ... --tier low|medium|high|ultra   the game view's graphics setting (default high)
//   ... --page dist/builder.html       another build of the builder
//   ... --frames 150 --label x         frames a sample; where the results go (bench/ab)
//   ... --util 45 --temp 80 --rest 1   the gate's limits (tools/gpu-gate.mjs)
//   ... --profile                      DevTools' sampling profiler over Game view's opening:
//                                      the processor's self time by function, heaviest first
//
// WHY (the frame-rate goal, 9 November 2026). The owner: "i saw the slowdown
// when loading the game view in the builder for the dinosaur mountain course".
// The game's tools (frame-ab.mjs, profile.mjs) play Fairway.html; this opens
// the builder's own page as a player does (file://), opens the course with
// "Open a course file", and times what the owner waits through: the editor
// coming up, and Game view's phases as the builder names them on its busy
// notice ("Building the course...", "Drawing the course...", "Preparing the
// graphics..."). Then frames with the probe (profile-probe.js, the same
// numbers as frame-ab): the editor's 3D view, the game view where it opened,
// at holes 1, 5 and 9 (the Hole picker's flight, landed), and flying forward
// fast with W and Shift held -- the free flight that brings new ground in.
//
// Uses the graphics card: through the gate, one job at a time.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gpuGate, logRun} from './gpu-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? (argv[i + 1] ?? true) : fallback; };
const FILE = flag('file', null);
if (!FILE) throw Error('--file <course.fairway> is needed');
const PAGE = path.resolve(ROOT, flag('page', 'dist/builder.html'));
const TIER = flag('tier', 'high'), FRAMES = Number(flag('frames', 150)), SETTLE = Number(flag('settle', 40));
const LABEL = flag('label', 'builder-' + new Date().toISOString().replace(/[:.]/g, '-'));
const OUT = path.join(ROOT, 'bench', 'ab');
const PROBE = fs.readFileSync(path.join(ROOT, 'tools', 'profile-probe.js'), 'utf8');
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];

const goal = flag('goal', null);
const gate = gpuGate({goal, cap: Number(flag('cap', 6)), utilMax: Number(flag('util', 10)), tempMax: Number(flag('temp', 60)), restMin: Number(flag('rest', 5))});

const frames = (page, n) => page.evaluate(n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); }), n);
const out = {label: LABEL, file: path.basename(FILE), tier: TIER, phases: [], spots: {}};
const browser = await chromium.launch({headless: true, args: GPU_ARGS});
let failed = null;
try {
 const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 2});
 const errors = [];
 page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
 page.on('console', m => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });
 await page.addInitScript(PROBE);
 await page.addInitScript(p => { try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {} }, {quality: TIER, frameCap: 0, autoResolution: false});
 // Every change of the busy notice, on the page's clock: the phases of a wait.
 await page.addInitScript(() => {
  window.__busyLog = [];
  const watch = () => {
   const words = document.querySelector('.cb-busywords');
   if (!words) return requestAnimationFrame(watch);
   new MutationObserver(() => window.__busyLog.push([performance.now(), words.textContent])).observe(words, {childList: true, characterData: true, subtree: true});
  };
  addEventListener('DOMContentLoaded', watch);
 });
 await page.goto(pathToFileURL(PAGE).href);
 await page.getByRole('button', {name: /Open a course file/}).waitFor({timeout: 120000});
 const renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
 if (/swiftshader|llvmpipe|software/i.test(renderer)) throw Error('got a software rasteriser, not the card');
 out.renderer = renderer;

 // Two drawing contexts on one page: the probe is told which to time.
 const measure = async (name, during = null, canvas = '.cb-gamecanvas') => {
  const found = await page.evaluate(sel => {
   const c = sel === 'editor' ? [...document.querySelectorAll('canvas')].find(x => !x.classList.contains('cb-gamecanvas') && x.width > 300) : document.querySelector(sel);
   return window.__profUse(c);
  }, canvas);
  if (!found) console.log(`  (no drawing context found for ${canvas})`);
  await frames(page, SETTLE);
  await page.evaluate(() => window.__profStart());
  if (during) await during.start();
  await frames(page, FRAMES);
  if (during) await during.stop();
  const st = await page.evaluate(() => window.__profStop());
  out.spots[name] = st;
  console.log(`  ${name.padEnd(12)} cpu ${st.median?.toFixed(2)} (p95 ${st.p95?.toFixed(1)}, p99 ${st.p99?.toFixed(1)}, worst ${st.worst?.toFixed(1)})  gpu ${st.gpuMedian?.toFixed(2)} (p95 ${st.gpuP95?.toFixed(1)})  draws ${Math.round(st.callsPerFrame ?? 0)}  triangles ${Math.round(st.trisPerFrame ?? 0).toLocaleString('en')}`);
 };
 const phases = async (from, to) => (await page.evaluate(() => window.__busyLog)).filter(([t]) => t >= from && t <= to);
 const report = (title, from, to, log) => {
  console.log(`  ${title}: ${((to - from) / 1000).toFixed(2)} s`);
  for (let i = 0; i < log.length; i++) if (log[i][1]) console.log(`    ${log[i][1].padEnd(36)} ${(((log[i + 1]?.[0] ?? to) - log[i][0]) / 1000).toFixed(2)} s`);
  out.phases.push({title, seconds: (to - from) / 1000, log});
 };

 // THE EDITOR: from the file handed in to the Game view button there.
 const t0 = await page.evaluate(() => performance.now());
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Open a course file/}).click()]);
 await chooser.setFiles(path.resolve(ROOT, FILE));
 await page.locator('[data-gameview]').waitFor({timeout: 600000});
 await page.waitForFunction(() => document.querySelector('.cb-busy')?.hidden !== false, null, {timeout: 600000});
 const t1 = await page.evaluate(() => performance.now());
 report('open the course into the editor', t0, t1, await phases(t0, t1));
 await measure('editor', null, 'editor');

 // GAME VIEW: the button pressed to the game's picture shown and settled.
 const cdp = flag('profile', false) ? await page.context().newCDPSession(page) : null;
 if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start'); }
 const t2 = await page.evaluate(() => performance.now());
 await page.locator('[data-gameview]').click();
 await page.waitForFunction(() => document.querySelector('[data-gameview]')?.textContent === 'Back to editor', null, {timeout: 600000});
 const t3 = await page.evaluate(() => performance.now());
 if (cdp) {
  const {profile} = await cdp.send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n])), dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => { const n = byId.get(id).callFrame, key = `${n.functionName || '(anon)'} ${n.url.split('/').pop()}:${n.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
  console.log('  Game view opening, processor self time, heaviest first');
  for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`   ${(us / 1e6).toFixed(2).padStart(6)} s  ${k}`);
  await cdp.detach();
 }
 report('open Game view', t2, t3, await phases(t2, t3));
 await measure('game-open');
 const holes = await page.evaluate(() => document.querySelector('.cb-gamehole')?.options.length ?? 0);
 for (const n of [0, 4, 8].filter(n => n < holes)) {
  await page.evaluate(n => { const s = document.querySelector('.cb-gamehole'); s.value = String(n); s.dispatchEvent(new Event('change')); }, n);
  await frames(page, 240);   // the flight there
  await measure(`game-hole${n + 1}`);
 }
 // Flying ahead fast: new ground comes into view every frame.
 await page.locator('.cb-gamecanvas').focus();
 await measure('game-flying', {start: async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); }, stop: async () => { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }});
 out.errors = errors;
 if (errors.length) console.log(`  page errors: ${errors.length}: ${errors.slice(0, 3).join(' | ')}`);
} catch (e) { failed = String(e.message).split('\n')[0]; console.log(`FAILED ${failed}`); }
finally { await browser.close(); }
logRun({goal, run: gate.run, tool: 'builder-frames', label: LABEL, tier: TIER, file: out.file, failed});
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(out, null, 1));
console.log(`wrote bench/ab/${LABEL}.json`);
if (failed) process.exitCode = 1;
