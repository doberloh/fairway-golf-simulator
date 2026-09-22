#!/usr/bin/env node
// What a frame actually costs, and what it is spent on.
//
//   node tools/profile.mjs                 the default sweep
//   node tools/profile.mjs --only tiers    one group (tiers, views, biomes,
//                                          ablation, weak)
//   node tools/profile.mjs --save          store the run as the baseline
//   node tools/profile.mjs --since         compare against the stored baseline
//   node tools/profile.mjs --frames 600    longer samples, steadier numbers
//
// WHY THIS EXISTS, AND THE ONE THING IT MUST NOT DO. `tools/bench.mjs` measures
// generation and says nothing about drawing. The only frame numbers this
// project ever had were taken by hand with a probe pasted into renderer.js,
// on one machine, on one course -- and the first of them was wrong: a timer
// around `renderer.render()` reads the vsync wait rather than the work, so it
// returned 8.3 ms on a 120 Hz display whatever it was asked to draw. An LOD was
// built on that number and the forest looked dead for a fortnight.
//
// So the harness proves, on a blank page, that it can report a frame time far
// below the refresh interval before it trusts a single measurement. If it
// cannot, it refuses to run.
//
// TWO ARMS, ON PURPOSE. The real GPU answers "how much headroom is there on
// this machine". A software rasteriser answers "what happens on a computer with
// no graphics card", which is the low tier's actual audience. They are
// different questions and the report always says which one it is answering.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const STORE = path.join(ROOT, 'bench', 'profile-baseline.json');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
 const i = argv.indexOf('--' + name);
 return i >= 0 ? (argv[i + 1] ?? true) : fallback;
};
const FRAMES = Number(flag('frames', 420));
const WARMUP = Number(flag('warmup', 90));
const ONLY = flag('only', null);

// GPU flags matter more than they look: without them Chromium quietly uses
// SwiftShader and every number below describes a software rasteriser. Run
// tools/gpu-probe.mjs if in doubt; it prints the renderer for each arm.
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const SOFTWARE_ARGS = ['--use-gl=swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit',
 '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];

const PROBE = fs.readFileSync(path.join(ROOT, 'tools', 'profile-probe.js'), 'utf8');

// ---------------------------------------------------------------- the sweep
//
// A FEW DOZEN CHOSEN CASES, NOT THE PRODUCT OF EVERY OPTION. Eight biomes by
// fourteen footprints by four tiers by every slider is a sweep nobody runs
// twice. Each case below is here for a stated reason, and a run that takes a
// few minutes is a run that gets used.
const BIOMES = ['pnw', 'desert', 'mountain', 'links', 'midwest', 'island', 'redwood', 'autumn'];
const TIERS = ['low', 'medium', 'high', 'ultra'];

function matrix() {
 const cases = [];
 const base = {biome: 'redwood', holes: 9, seed: 'PROFILE'};
 // The tier ladder on the heaviest biome, which is what the tiers exist for.
 for (const quality of TIERS)
  cases.push({group: 'tiers', name: quality, arm: 'gpu', quality, ...base});
 // Overview is the whole hole at once and is the heaviest view in the game.
 for (const quality of TIERS)
  cases.push({group: 'views', name: `${quality} · overview`, arm: 'gpu', quality, view: 'overview', ...base});
 // Every biome at one tier, to find which content is expensive rather than
 // which setting is.
 for (const biome of BIOMES)
  cases.push({group: 'biomes', name: biome, arm: 'gpu', quality: 'high', ...base, biome});
 // Ablation: the same frame with one thing switched off. Whatever gives back
 // the most time is what the frame is spent on -- which no amount of staring
 // at a profiler tells you as directly.
 for (const [name, prefs] of [
  ['ultra, everything on', {}],
  ['no terrain shadows', {terrainShadows: false}],
  ['no reflections', {reflections: false}],
  ['no relief shading', {relief: false}],
  ['no slope tint', {slopeTint: false}],
  ['no mowing stripes', {stripes: false}],
 ]) cases.push({group: 'ablation', name, arm: 'gpu', quality: 'ultra', prefs, ...base});
 // The reflection toggle again, on a course covered in water. The redwood
 // course has three small ponds that may not even be in shot from the tee, so
 // a reflection row showing nothing there proves nothing about reflections.
 for (const [name, prefs] of [['water course, all on', {}],
                              ['water course, no reflections', {reflections: false}]])
  cases.push({group: 'water', name, arm: 'gpu', quality: 'ultra', prefs,
   biome: 'midwest', holes: 9, seed: 'PROFILE', course: {water: 100, lakes: 3, rivers: 2, creeks: 3}});
 // Pixel ratio on its own. It is the biggest fill lever the tiers have and
 // the easiest to measure wrongly, so it gets its own group rather than being
 // inferred from the tier ladder.
 for (const dpr of [1, 1.5, 2])
  cases.push({group: 'pixels', name: `high · dpr ${dpr}`, arm: 'gpu', quality: 'high', dpr, ...base});
 // The weak arm. A software rasteriser is not a phone GPU, but it is a fair
 // stand-in for "no graphics card", and it is the only arm on this machine
 // that can fail to hold a budget.
 for (const quality of ['low', 'medium'])
  cases.push({group: 'weak', name: `${quality} · software`, arm: 'software', quality, ...base, biome: 'pnw'});
 return ONLY ? cases.filter(c => c.group === ONLY) : cases;
}

// ------------------------------------------------------------------ plumbing
function serve() {
 const html = fs.readFileSync(DIST);
 return new Promise(resolve => {
  const server = createServer((_, res) => {
   res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
   res.end(html);
  });
  server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port}));
 });
}

const openBrowser = arm => chromium.launch({headless: true,
 args: arm === 'software' ? SOFTWARE_ARGS : GPU_ARGS});

// A FRESH PAGE PER CASE. Init scripts accumulate on a page -- reusing one left
// every previous case's localStorage writer still registered and firing on the
// next load, which happened to work only because the last one registered wins.
// A page per case also keeps sockets from piling up, which is what exhausted
// them and ended the first full run with ERR_NO_BUFFER_SPACE.
async function newPage(browser, prefs, dpr = 2) {
 // DEVICE SCALE FACTOR MATTERS MORE THAN ANY OTHER SETTING HERE, and getting
 // it wrong silently flattens the tier ladder. `applyQuality` does
 // `setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio))`, and headless
 // Chromium reports devicePixelRatio 1 -- so low (1), medium (1.75) and ultra
 // (2) all clamp to 1 and render the identical number of pixels. The first
 // sweep showed low and medium as indistinguishable for exactly this reason,
 // which was the harness, not the game. 2 is what a modern laptop panel
 // reports; the weak arm uses 1, which is what a cheap one reports.
 const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: dpr});
 await page.addInitScript(PROBE);
 await page.addInitScript(p => {
  try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
  try { localStorage.removeItem('fairway-round-v1'); } catch {}
 }, prefs);
 return page;
}

const rendererOf = page => page.evaluate(() => {
 const gl = document.createElement('canvas').getContext('webgl2');
 const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
 return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
});

// THE PROPERTY, CHECKED BEFORE ANYTHING IS BELIEVED. A blank page doing
// nothing must produce frames far faster than the display refreshes. If it
// comes out at the refresh rate, vsync is still in the way and every number
// this tool could print would be the monitor's, not the renderer's.
async function proveItCanSeeBelowVsync(page) {
 await page.goto('about:blank');
 await page.evaluate(() => window.__profStart());
 await page.evaluate(() => new Promise(done => {
  let i = 0; const step = () => (++i < 150 ? requestAnimationFrame(step) : done());
  requestAnimationFrame(step);
 }));
 const s = await page.evaluate(() => window.__profStop());
 // An idle page must cost almost nothing. If this comes back at the refresh
 // interval the measure is pacing rather than work, and nothing below it means
 // anything. The interval is printed beside it so the difference between the
 // two is visible rather than assumed.
 return {work: s.median ?? 0, interval: s.interval, ok: (s.median ?? 0) < 2};
}

async function runCase(page, port, c) {
 await page.goto(`http://127.0.0.1:${port}/`, {waitUntil: 'load'});
 await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
 await page.evaluate(o => window.lab.course(o),
  {biome: c.biome, holes: c.holes, seed: c.seed, ...(c.course || {})});
 if (c.view) await page.evaluate(v => window.lab.view(v), c.view);
 // Let shaders compile and the first textures upload before anything counts.
 await page.evaluate(n => new Promise(done => {
  let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done());
  requestAnimationFrame(step);
 // A SOFTWARE FRAME TAKES SECONDS, NOT MILLISECONDS. At three seconds a
 // frame a 300-frame sample is fifteen minutes for one case, so this arm gets
 // a short sample -- which is plenty, because its numbers are enormous and
 // their spread is tiny.
 }), c.arm === 'software' ? Math.min(WARMUP, 8) : WARMUP);
 await page.evaluate(() => window.__profStart());
 await page.evaluate(n => new Promise(done => {
  let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done());
  requestAnimationFrame(step);
 }), c.arm === 'software' ? Math.min(FRAMES, 30) : FRAMES);
 return page.evaluate(() => window.__profStop());
}

// ------------------------------------------------------------------- output
const n2 = v => v == null ? '   -' : v.toFixed(2).padStart(6);
const n0 = v => v == null ? '   -' : Math.round(v).toLocaleString('en-US').padStart(7);

function table(title, rows, budget) {
 console.log(`\n${title}`);
 console.log('                            ---- CPU ms in the frame ----   --- GPU ms ---');
 console.log('  case                     median    p95    p99   worst   median     p95   gap    draws    triangles');
 for (const r of rows) {
  const s = r.stats;
  const over = budget && s.median > budget ? ' !' : '  ';
  console.log(`  ${r.name.padEnd(22)}${over}${n2(s.median)} ${n2(s.p95)} ${n2(s.p99)} ${n2(s.worst)} `
   + `${n2(s.gpuMedian)} ${n2(s.gpuP95)} ${n2(s.interval)} ${n0(s.callsPerFrame)} ${n0(s.trisPerFrame)}`);
 }
 if (budget) console.log(`  ! = over the ${budget} ms budget`);
}

// ---------------------------------------------------------------------- main
const started = Date.now();
const {server, port} = await serve();
const cases = matrix();
const results = [];
let arm = null, browser = null;

try {
 for (const c of cases) {
  if (c.arm !== arm) {
   await browser?.close();
   arm = c.arm;
   browser = await openBrowser(arm);
   // A throwaway page just to read the renderer string and prove the harness
   // can see below vsync; closed before any case opens its own.
   const probe = await newPage(browser, {quality: 'medium', frameCap: 0}, 1);
   const renderer = await rendererOf(probe);
   const software = /swiftshader|llvmpipe|software/i.test(renderer);
   const check = await proveItCanSeeBelowVsync(probe);
   console.log(`\n=== ${arm} arm`);
   console.log(`    renderer  ${renderer}`);
   console.log(`    idle page: ${check.work.toFixed(3)} ms of work per frame, presented every `
    + `${check.interval ? check.interval.toFixed(1) : '?'} ms`);
   console.log(`    ${check.ok
    ? 'work and pacing are separate, so this measures the renderer and not the display'
    : 'AN IDLE PAGE COSTS A WHOLE FRAME -- the measure is pacing, not work'}`);
   if (!check.ok) throw Error('harness is measuring the display, not the renderer -- refusing to report');
   if (arm === 'software' && !software) console.log('    note: asked for software and got a real GPU');
   if (arm === 'gpu' && software) throw Error('asked for the GPU arm and got a software rasteriser');
   await probe.close();
  }
  process.stdout.write(`    ${c.group}/${c.name} ... `);
  const prefs = {quality: c.quality, frameCap: 0, ...(c.prefs || {})};
  let page;
  try {
   page = await newPage(browser, prefs, c.dpr ?? (c.arm === 'software' ? 1 : 2));
   const stats = await runCase(page, port, c);
   results.push({...c, stats});
   console.log(`cpu ${stats.median.toFixed(2)}  gpu ${(stats.gpuMedian ?? 0).toFixed(2)} ms`);
  } catch (e) {
   // Recorded and carried on. This is left running unattended, and losing
   // twenty good cases to one bad one is not a trade worth making.
   const first = String(e.message).split(String.fromCharCode(10))[0];
   console.log(`FAILED  ${first.slice(0, 90)}`);
   results.push({...c, failed: first});
  } finally { await page?.close().catch(() => {}); }
 }
} finally {
 await browser?.close();
 server.close();
}

for (const group of [...new Set(results.map(r => r.group))]) {
 const rows = results.filter(r => r.group === group && r.stats);
 // THE WEAK ARM IS JUDGED ON THE INTERVAL, not on CPU or GPU time. A software
 // rasteriser has no timer query, and its rasterisation runs off the main
 // thread after the frame callback returns -- so the in-callback CPU measure
 // misses the actual work and reports a flattering 2 ms. The interval is
 // useless when a renderer is FASTER than vsync and is exactly right when it
 // is slower, which is the only situation this arm exists for.
 const budget = group === 'weak' ? 33.3 : null;
 if (group === 'weak') for (const r of rows) r.stats = {...r.stats, median: r.stats.interval};
 table({tiers: 'QUALITY TIERS  (redwood, player view, real GPU)',
        views: 'OVERVIEW  (the whole hole at once)',
        biomes: 'BIOMES  (high tier, player view)',
        ablation: 'ABLATION  (ultra, one thing switched off at a time)',
        pixels: 'PIXEL RATIO  (high tier, same scene, different resolutions)',
        water: 'WATER-HEAVY COURSE  (does turning reflections off save anything?)',
        weak: 'NO GRAPHICS CARD  (software rasteriser, 30 fps = 33.3 ms budget)'}[group] || group,
       rows, budget);
}

if (argv.includes('--since') && fs.existsSync(STORE)) {
 const was = JSON.parse(fs.readFileSync(STORE, 'utf8'));
 console.log('\nSINCE THE BASELINE  (median ms, + is slower)');
 for (const r of results) {
  const old = was.results.find(x => x.group === r.group && x.name === r.name);
  if (!old) continue;
  const d = r.stats.median - old.stats.median;
  if (Math.abs(d) > 0.15) console.log(`  ${(r.group + '/' + r.name).padEnd(34)} ${d > 0 ? '+' : ''}${d.toFixed(2)}`);
 }
}

// Printed so the AGENTS.md rule about when to ask for a profile can quote a
// real number rather than a guess, and so it stays true when the sweep grows.
const mins = (Date.now() - started) / 60000;
console.log(`
${results.length} cases in ${mins.toFixed(1)} minutes ` +
 `(${(mins * 60 / Math.max(1, results.length)).toFixed(0)} s a case)`);

if (argv.includes('--save')) {
 fs.mkdirSync(path.dirname(STORE), {recursive: true});
 fs.writeFileSync(STORE, JSON.stringify({taken: new Date().toISOString(), frames: FRAMES, results}, null, 1) + '\n');
 console.log(`\nstored ${results.length} cases as the baseline`);
}
