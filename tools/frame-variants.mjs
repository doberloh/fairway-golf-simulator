#!/usr/bin/env node
// Many ideas, one course load: what each would save, before any is built.
//
//   node tools/capture/build-hooked.mjs          (once: the game with window.__view)
//   node tools/frame-variants.mjs --goal <name> --cap 40 --variants tools/variants/ultra.mjs
//   ... --tier ultra --spots tee1,tee5 --frames 120 --repeat 2
//
// A variants file exports `variants`: [{name, apply, undo}], where `apply` and
// `undo` are JavaScript run in the page with `v` bound to the renderer
// (window.__view) -- switch a pass off, shrink a map, skip a cascade. Each is
// measured BETWEEN two measurements of the unchanged frame (base, v1, base, v2,
// base ...), at every spot, and reported against the mean of the base
// measurements either side of it. That cancels the slow drift a page shows
// over its life (RESEARCH.md: in one browser every case got worse the later it
// ran), which is what made a single-page ablation untrustworthy before.
//
// It answers "how much is this worth", not "is the built change faster" --
// that is tools/frame-ab.mjs, on two real builds. Goes through the GPU gate and
// the run log like frame-ab.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';
import {DEVICES} from './devices.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
 const i = argv.indexOf('--' + name);
 return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback;
};
const BUILD = flag('build', 'bench/shots/dist-exp/index.html');
const DEVICE = DEVICES[flag('device', 'desktop')];
const TIER = flag('tier', DEVICE.tier);
const BIOME = flag('biome', 'redwood'), HOLES = Number(flag('holes', 9)), SEED = flag('seed', 'PROFILE');
const FRAMES = Number(flag('frames', 120)), SETTLE = Number(flag('settle', 30)), REPEAT = Number(flag('repeat', 1));
const LABEL = flag('label', new Date().toISOString().replace(/[:.]/g, '-'));
const {variants} = await import(pathToFileURL(path.resolve(ROOT, flag('variants'))).href);
const SPOTS = {
 tee1: {hole: 0, along: -4, height: 1.8, look: 'pin'},
 tee5: {hole: 4, along: -4, height: 1.8, look: 'pin'},
 tee9: {hole: 8, along: -4, height: 1.8, look: 'pin'},
 sun: {hole: 0, along: 60, height: 3, look: 'sun', pitch: 'sun'},
 // The play camera behind the ball on that tee (frame-ab.mjs says why).
 play1: {play: 0}, play5: {play: 4}, play9: {play: 8},
};
const spotNames = String(flag('spots', 'tee1,tee5')).split(',');
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const PROBE = fs.readFileSync(path.join(ROOT, 'tools', 'profile-probe.js'), 'utf8');

const html = fs.readFileSync(path.resolve(ROOT, BUILD));
if (!/window[.]__view *=/.test(html)) throw Error(`${BUILD} has no window.__view; build it with tools/capture/build-hooked.mjs`);
const frames = (page, n) => page.evaluate(n => new Promise(done => {
 let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step);
}), n);

const gate = gpuGate({goal: flag('goal', null), cap: Number(flag('cap', 6))});
const started = Date.now();
const server = await new Promise(resolve => {
 const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
 s.listen(0, '127.0.0.1', () => resolve(s));
});
const browser = await chromium.launch({headless: true, args: GPU_ARGS});
const rows = [];
let failed = null;
try {
 const page = await browser.newPage({viewport: {width: DEVICE.viewport[0], height: DEVICE.viewport[1]}, deviceScaleFactor: DEVICE.dpr});
 await page.addInitScript(PROBE);
 await page.addInitScript(p => {
  try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
  try { localStorage.removeItem('fairway-round-v1'); } catch {}
  try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pprof', profiles: [{id: 'pprof', name: 'Profiler', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
 }, {quality: TIER, frameCap: 0, autoResolution: false});
 const errors = [];
 page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
 await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
 await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
 await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: HOLES, seed: SEED});
 await frames(page, 60);
 const sample = async () => {
  await frames(page, SETTLE);
  await page.evaluate(() => window.__profStart());
  await frames(page, FRAMES);
  return page.evaluate(() => window.__profStop());
 };
 const run = code => page.evaluate(c => { const v = window.__view; return new Function('v', c)(v); }, code);
 for (const spot of spotNames) {
  if (SPOTS[spot].play !== undefined) { await page.evaluate(n => window.lab.hole(n), SPOTS[spot].play); await page.evaluate(() => window.lab.view('player')); }
  else await page.evaluate(o => window.lab.camera(o), SPOTS[spot]);
  await frames(page, 30);
  // WHERE THE PROCESSOR'S TIME GOES, from DevTools' sampling profiler over the
  // unchanged frame: self time per function, heaviest first. Build with
  // MINIFY=0 (tools/capture/build-hooked.mjs) or the names are one letter.
  // WHAT MAKES THE PAGE LAY ITSELF OUT AGAIN: every change to the page over
  // the same frames, by element, and the browser's own count and time of style
  // recalculations and layouts (DevTools' Performance metrics).
  if (flag('dom', false)) {
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Performance.enable');
   const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
   await page.evaluate(() => {
    const name = n => n.nodeType === 1 ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.classList?.length ? '.' + [...n.classList].slice(0, 2).join('.') : ''}` : name(n.parentNode);
    window.__mut = new Map();
    window.__mo = new MutationObserver(list => { for (const m of list) { const k = `${m.type} ${name(m.target)}${m.attributeName ? ' [' + m.attributeName + ']' : ''}`; window.__mut.set(k, (window.__mut.get(k) || 0) + 1); } });
    window.__mo.observe(document, {subtree: true, attributes: true, childList: true, characterData: true});
   });
   const m0 = await metric();
   await frames(page, FRAMES);
   const m1 = await metric();
   const muts = await page.evaluate(() => { window.__mo.disconnect(); return [...window.__mut].sort((a, b) => b[1] - a[1]).slice(0, 25); });
   const per = k => ((m1[k] - m0[k]) / FRAMES);
   console.log(`\n  ${spot}: per frame -- layouts ${per('LayoutCount').toFixed(2)} (${(per('LayoutDuration') * 1000).toFixed(3)} ms), style recalcs ${per('RecalcStyleCount').toFixed(2)} (${(per('RecalcStyleDuration') * 1000).toFixed(3)} ms), script ${(per('ScriptDuration') * 1000).toFixed(3)} ms, task ${(per('TaskDuration') * 1000).toFixed(3)} ms`);
   for (const [k, n] of muts) console.log(`   ${(n / FRAMES).toFixed(2).padStart(6)}/frame  ${k}`);
   await cdp.detach();
  }
  if (flag('cpuprofile', false)) {
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Profiler.enable');
   await cdp.send('Profiler.setSamplingInterval', {interval: 100});
   await cdp.send('Profiler.start');
   await frames(page, FRAMES * 2);
   const {profile} = await cdp.send('Profiler.stop');
   const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
   const dt = profile.timeDeltas, total = profile.endTime - profile.startTime;
   profile.samples.forEach((id, i) => { const n = byId.get(id).callFrame, key = `${n.functionName || '(anon)'} ${n.url.split('/').pop()}:${n.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
   console.log(`\n  ${spot}: processor self time over ${(total / 1000).toFixed(0)} ms, ${FRAMES * 2} frames`);
   for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30))
    console.log(`   ${(us / 1000 / (FRAMES * 2)).toFixed(3).padStart(7)} ms/frame  ${(us / total * 100).toFixed(1).padStart(5)}%  ${k}`);
   await cdp.detach();
  }
  for (let r = 0; r < REPEAT; r++) {
   let before = await sample();
   for (const vr of variants) {
    if (vr.apply) await run(vr.apply);
    const s = await sample();
    if (vr.undo) await run(vr.undo);
    const after = await sample();
    rows.push({spot, name: vr.name, r, s, base: {cpu: (before.median + after.median) / 2, gpu: ((before.gpuMedian ?? 0) + (after.gpuMedian ?? 0)) / 2,
     draws: before.callsPerFrame, tris: before.trisPerFrame}});
    before = after;
   }
  }
 }
 if (errors.length) console.log(`page errors: ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
} catch (e) { failed = String(e.message).split('\n')[0]; console.log(`FAILED ${failed}`); }
finally { await browser.close(); server.close(); }
logRun({goal: flag('goal', null), run: gate.run, tool: 'frame-variants', label: LABEL, tier: TIER, spots: spotNames,
 variants: variants.map(v => v.name), before: {util: gate.util, temp: gate.temp}, after: (() => { try { return readCard(); } catch { return null; } })(),
 seconds: Math.round((Date.now() - started) / 1000), failed});
if (failed) process.exit(1);

console.log(`\n${TIER} · ${BIOME} ${SEED} · ${DEVICE.viewport.join('x')} @${DEVICE.dpr} · each against the frames either side of it`);
console.log('  spot   variant                          base CPU/GPU     variant CPU/GPU    GPU change   draws     triangles');
for (const row of rows) {
 const {s, base} = row, d = ((s.gpuMedian ?? 0) - base.gpu) / base.gpu * 100;
 console.log(`  ${row.spot.padEnd(6)} ${row.name.slice(0, 32).padEnd(32)} ${base.cpu.toFixed(2).padStart(6)}/${base.gpu.toFixed(2).padEnd(7)}  ${s.median.toFixed(2).padStart(6)}/${(s.gpuMedian ?? 0).toFixed(2).padEnd(7)}  ${(d >= 0 ? '+' : '') + d.toFixed(1)}%`.padEnd(100)
  + `${Math.round(base.draws)}->${Math.round(s.callsPerFrame)}`.padEnd(10) + `${(base.tris / 1e6).toFixed(1)}->${(s.trisPerFrame / 1e6).toFixed(1)} M`);
}
fs.mkdirSync(path.join(ROOT, 'bench', 'ab'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'bench', 'ab', `${LABEL}.json`), JSON.stringify({label: LABEL, tier: TIER, rows}, null, 1));
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)} s on the card; saved bench/ab/${LABEL}.json`);
