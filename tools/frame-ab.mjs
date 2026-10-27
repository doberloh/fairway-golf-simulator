#!/usr/bin/env node
// Two builds of the game, the same frames, measured alternately on the card.
//
//   node tools/frame-ab.mjs --goal <name> --cap 40 --a bench/ab/base.html --b dist/index.html
//   node tools/frame-ab.mjs --goal <name> --a bench/ab/base.html            one build alone
//   ... --tier ultra --biome redwood --rounds 2 --frames 150 --spots tee1,tee5,tee9
//   ... --device iphone-13      that device's screen and processor, its graphics scaled
//   ... --shots                 a screenshot per spot, compared A against B
//
// WHY NOT tools/profile.mjs. The profiler measures ONE build against a saved
// baseline from another day, and on this card that comparison is mostly noise:
// one build read Ultra 6.4 ms in one round and 10.7 ms in the next (RESEARCH.md,
// *Final profile before the merge*), and tee 1, the only spot it measures,
// looks across the whole course (the cull's worst case). So this one:
//   - runs the two builds ALTERNATELY (A B B A ...), each in a fresh browser, so
//     the card's clocks and anything else on the machine fall on both alike;
//   - measures several tees from ONE course load, because a load is most of the
//     cost of a case and the frames themselves are cheap;
//   - reports draws and triangles too, which are exact and need no repeats;
//   - with --shots, the share of pixels that changed between A and B beside the
//     same share between two runs of one build, which is the noise floor.
// Every run goes through tools/gpu-gate.mjs first (AGENTS.md, *A `/goal` that
// says "GPU allowed"*) and is logged to bench/ab/gpu-runs.jsonl.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';
import {DEVICES, gpuScale, cpuThrottle} from './devices.mjs';
import {diffPng} from './png-diff.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
 const i = argv.indexOf('--' + name);
 return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback;
};
const A = flag('a', 'bench/ab/base.html'), B = flag('b', null);
const DEVICE = DEVICES[flag('device', 'desktop')];
if (!DEVICE) throw Error(`No device ${flag('device')}; one of ${Object.keys(DEVICES).join(', ')}`);
const TIER = flag('tier', DEVICE.tier);
const BIOME = flag('biome', 'redwood'), HOLES = Number(flag('holes', 9)), SEED = flag('seed', 'PROFILE');
const ROUNDS = Number(flag('rounds', 2)), FRAMES = Number(flag('frames', 150)), SETTLE = Number(flag('settle', 40));
const SHOTS = !!flag('shots', false), LABEL = flag('label', new Date().toISOString().replace(/[:.]/g, '-'));
const PREFS = JSON.parse(flag('prefs', '{}'));

// Where the camera stands. A tee, 4 m behind it at eye height, looking at the
// pin: what a player sees most. Tees 1, 5 and 9 of seed PROFILE span the cull's
// worst case (tee 1 sees the whole course) to its usual one.
const SPOTS = {
 tee1: {camera: {hole: 0, along: -4, height: 1.8, look: 'pin'}},
 tee5: {camera: {hole: 4, along: -4, height: 1.8, look: 'pin'}},
 tee9: {camera: {hole: 8, along: -4, height: 1.8, look: 'pin'}},
 sun: {camera: {hole: 0, along: 60, height: 3, look: 'sun', pitch: 'sun'}},
 overview: {view: 'overview'},
 // THE PLAY CAMERA, behind the ball on the tee: what a round actually draws,
 // HUD and all. The free camera above redraws the map every frame, which play
 // does every 60-80 ms, so the two cost differently on the processor.
 play1: {hole: 0, view: 'player'},
 play5: {hole: 4, view: 'player'},
 play9: {hole: 8, view: 'player'},
};
const spotNames = String(flag('spots', 'tee1,tee5,tee9')).split(',');
for (const s of spotNames) if (!SPOTS[s]) throw Error(`No spot ${s}; one of ${Object.keys(SPOTS).join(', ')}`);

const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const PROBE = fs.readFileSync(path.join(ROOT, 'tools', 'profile-probe.js'), 'utf8');
const OUT = path.join(ROOT, 'bench', 'ab');

function serve(file) {
 const html = fs.readFileSync(path.resolve(ROOT, file));
 return new Promise(resolve => {
  const server = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
  server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port}));
 });
}

const frames = (page, n) => page.evaluate(n => new Promise(done => {
 let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step);
}), n);

async function measureBuild(file, tag, round) {
 const {server, port} = await serve(file);
 const browser = await chromium.launch({headless: true, args: GPU_ARGS});
 const out = {};
 try {
  const page = await browser.newPage({viewport: {width: DEVICE.viewport[0], height: DEVICE.viewport[1]}, deviceScaleFactor: DEVICE.dpr});
  await page.addInitScript(PROBE);
  await page.addInitScript(p => {
   try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
   try { localStorage.removeItem('fairway-round-v1'); } catch {}
   try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pprof', profiles: [{id: 'pprof', name: 'Profiler', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
  }, {quality: TIER, frameCap: 0, autoResolution: false, ...PREFS});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
  await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: HOLES, seed: SEED});
  const renderer = await page.evaluate(() => {
   const gl = document.createElement('canvas').getContext('webgl2');
   const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
   return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  if (/swiftshader|llvmpipe|software/i.test(renderer)) throw Error('got a software rasteriser, not the card');
  await frames(page, 60);
  const throttle = cpuThrottle(DEVICE);
  if (throttle > 1.01) {
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle});
  }
  for (const name of spotNames) {
   const s = SPOTS[name];
   if (s.hole !== undefined) await page.evaluate(n => window.lab.hole(n), s.hole);
   if (s.view) await page.evaluate(v => window.lab.view(v), s.view);
   if (s.camera) await page.evaluate(o => window.lab.camera(o), s.camera);
   await frames(page, SETTLE);
   await page.evaluate(() => window.__profStart());
   await frames(page, FRAMES);
   const st = await page.evaluate(() => window.__profStop());
   let shot = null;
   if (SHOTS) {
    shot = path.join(OUT, 'shots', LABEL, `${tag}-${round}-${name}.png`);
    fs.mkdirSync(path.dirname(shot), {recursive: true});
    await page.screenshot({path: shot});
   }
   out[name] = {...st, shot};
  }
  out.errors = errors;
 } finally {
  await browser.close();
  server.close();
 }
 return out;
}

const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const builds = B ? [['A', A], ['B', B]] : [['A', A]];
// A B B A A B ...: each build gets the early and the late slot equally.
const order = [];
for (let r = 0; r < ROUNDS; r++) order.push(...(r % 2 ? [...builds].reverse() : builds).map(b => [...b, r]));

const goal = flag('goal', null);
// The gate's limits from the command line, as frame-variants takes them (the
// polish goal: a remote-desktop session held the card at 30-40%).
const gate = gpuGate({goal, cap: Number(flag('cap', 6)), utilMax: Number(flag('util', 10)), tempMax: Number(flag('temp', 60)), restMin: Number(flag('rest', 5))});
const results = {A: [], B: []};
const started = Date.now();
let failed = null;
try {
 for (const [tag, file, round] of order) {
  process.stdout.write(`  ${tag} round ${round + 1} (${path.basename(file)}) ... `);
  const r = await measureBuild(file, tag, round);
  results[tag].push(r);
  console.log(spotNames.map(n => `${n} ${r[n].median?.toFixed(2)}/${r[n].gpuMedian?.toFixed(2)}`).join('  ') + (r.errors.length ? `  ERRORS ${r.errors.length}` : ''));
 }
} catch (e) { failed = String(e.message).split('\n')[0]; console.log(`FAILED ${failed}`); }
const after = (() => { try { return readCard(); } catch { return null; } })();
logRun({goal, run: gate.run, tool: 'frame-ab', label: LABEL, tier: TIER, device: flag('device', 'desktop'), spots: spotNames,
 a: A, b: B, before: {util: gate.util, temp: gate.temp}, after, seconds: Math.round((Date.now() - started) / 1000), failed});
if (failed) process.exit(1);

// ------------------------------------------------------------------ report
const scale = gpuScale(DEVICE);
console.log(`\n${TIER} · ${BIOME} ${SEED} · ${DEVICE.label} · ${DEVICE.viewport.join('x')} @${DEVICE.dpr}` +
 (scale > 1.01 ? ` · CPU throttled ${cpuThrottle(DEVICE).toFixed(1)}x, GPU estimate = card ms x ${scale.toFixed(0)}` : ''));
console.log('  spot      build   CPU ms   GPU ms   draws   triangles' + (scale > 1.01 ? '   est. device GPU ms' : ''));
const summary = {};
for (const name of spotNames) {
 for (const [tag] of builds) {
  const rs = results[tag].map(r => r[name]);
  const s = {cpu: med(rs.map(r => r.median)), gpu: med(rs.map(r => r.gpuMedian)), cpuP95: med(rs.map(r => r.p95)),
   draws: med(rs.map(r => r.callsPerFrame)), tris: med(rs.map(r => r.trisPerFrame)),
   runs: rs.map(r => [+r.median.toFixed(2), +(r.gpuMedian ?? 0).toFixed(2)])};
  (summary[name] ??= {})[tag] = s;
  console.log(`  ${name.padEnd(9)} ${tag}     ${s.cpu.toFixed(2).padStart(6)}   ${(s.gpu ?? 0).toFixed(2).padStart(6)}  ${Math.round(s.draws).toString().padStart(6)}  ${(s.tris / 1e6).toFixed(1).padStart(8)} M`
   + (scale > 1.01 ? `   ${((s.gpu ?? 0) * scale).toFixed(0).padStart(8)}` : '') + `   runs ${s.runs.map(r => r.join('/')).join(' ')}`);
 }
 if (B) {
  const a = summary[name].A, b = summary[name].B, pct = (x, y) => ((y - x) / x * 100).toFixed(1) + '%';
  console.log(`  ${''.padEnd(9)} B vs A  ${pct(a.cpu, b.cpu).padStart(6)}   ${pct(a.gpu, b.gpu).padStart(6)}  ${pct(a.draws, b.draws).padStart(6)}  ${pct(a.tris, b.tris).padStart(9)}`);
 }
}
if (B) {
 // The headline: the mean over the spots of each build's frame (the slower of
 // CPU and GPU, which is what the frame waits on).
 const frame = tag => spotNames.reduce((t, n) => t + Math.max(summary[n][tag].cpu, summary[n][tag].gpu ?? 0), 0) / spotNames.length;
 console.log(`\n  frame, mean of spots: A ${frame('A').toFixed(2)} ms  B ${frame('B').toFixed(2)} ms  (${((frame('B') - frame('A')) / frame('A') * 100).toFixed(1)}%)`);
 // The same with each spot's MEAN and its 95th percentile instead of its
 // median (profile-probe.js says why): the average cost, and the heavy frame
 // a display waits for.
 const by = (tag, cpuKey, gpuKey) => spotNames.reduce((t, n) => t + Math.max(med(results[tag].map(r => r[n][cpuKey])) ?? 0, med(results[tag].map(r => r[n][gpuKey])) ?? 0), 0) / spotNames.length;
 for (const [label, c, g] of [['mean', 'mean', 'gpuMean'], ['p95', 'p95', 'gpuP95']]) {
  const a = by('A', c, g), b = by('B', c, g);
  console.log(`  frame by ${label}: A ${a.toFixed(2)} ms  B ${b.toFixed(2)} ms  (${((b - a) / a * 100).toFixed(1)}%)`);
 }
}
if (SHOTS) {
 console.log('\n  picture: share of pixels changed (summed RGB difference over 24)');
 for (const name of spotNames) {
  const shot = (tag, r) => results[tag][r]?.[name]?.shot;
  const line = [];
  if (results.A.length > 1) line.push(`A vs A ${(diffPng(shot('A', 0), shot('A', 1)).share * 100).toFixed(2)}%`);
  if (B) {
   if (results.B.length > 1) line.push(`B vs B ${(diffPng(shot('B', 0), shot('B', 1)).share * 100).toFixed(2)}%`);
   line.push(`A vs B ${(diffPng(shot('A', 0), shot('B', 0)).share * 100).toFixed(2)}%`);
  }
  console.log(`  ${name.padEnd(9)} ${line.join('   ')}`);
 }
}
const errs = [...results.A, ...results.B].flatMap(r => r.errors);
if (errs.length) console.log(`\n  page errors: ${[...new Set(errs)].slice(0, 5).join(' | ')}`);
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify({label: LABEL, tier: TIER, device: DEVICE, biome: BIOME, seed: SEED,
 a: A, b: B, summary, results}, null, 1));
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)} s on the card; saved bench/ab/${LABEL}.json`);
