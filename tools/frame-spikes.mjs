#!/usr/bin/env node
// WHAT A LONG FRAME WAS DOING (the cartoon overhaul's frame-rate pass, 25
// October 2026).
//
//   node tools/frame-spikes.mjs --goal <name> [--util 30 --temp 80 --rest 1]
//        [--build bench/shots/dist-exp/index.html] [--tier high] [--biome autumn]
//        [--frames 600] [--over 20] [--orbit]
//
// The profiler reports a 99th percentile and a worst frame, and on this card
// those moved from 12 ms to 270 ms between two runs of the same build -- on
// main's build as well as the branch's. This says where the time of each long
// frame went. It wraps, in the page, the renderer's `render` and the parts of
// it that can stall -- the instance cull's rebuild, the near-field grass, the
// draw itself -- and counts, per frame, programs compiled (renderer.info) and
// the time between animation frames that was spent OUTSIDE the game's frame
// (a garbage collection, the page, the harness). Every frame longer than
// `--over` ms is listed with its parts. `--orbit` turns the camera slowly
// round the first green, so the cull rebuilds as it does in play.
// Goes through the GPU gate like the other frame tools.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };
const BUILD = flag('build', 'bench/shots/dist-exp/index.html'), TIER = flag('tier', 'high'), BIOME = flag('biome', 'autumn');
const FRAMES = Number(flag('frames', 600)), OVER = Number(flag('over', 20)), ORBIT = !!flag('orbit', false);
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
 '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const html = fs.readFileSync(path.resolve(ROOT, BUILD));
if (!/window[.]__view *=/.test(html)) throw Error(`${BUILD} has no window.__view; build it with tools/capture/build-hooked.mjs`);
const before = gpuGate({goal: flag('goal', null), cap: Infinity, utilMax: Number(flag('util', 10)), tempMax: Number(flag('temp', 60)), restMin: Number(flag('rest', 5))});
const started = new Date().toISOString();
const server = await new Promise(resolve => { const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => resolve(s)); });
const browser = await chromium.launch({headless: true, args: GPU_ARGS});
const frames = (page, n) => page.evaluate(n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); }), n);
let result = 'ok';
try {
 const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 2});
 await page.addInitScript(p => { try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); localStorage.removeItem('fairway-round-v1'); } catch {} }, {quality: TIER, frameCap: 0, autoResolution: false});
 await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
 await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
 await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: 9, seed: 'PROFILE'});
 await frames(page, 90);
 const rows = await page.evaluate(async ([n, orbit]) => {
  const v = window.__view, gl = v.renderer, out = [];
  let cur = null;
  const wrap = (obj, name, key) => {
   const was = obj?.[name];
   if (typeof was !== 'function') return;
   obj[name] = function (...a) { const t = performance.now(); try { return was.apply(this, a); } finally { if (cur) cur[key] = (cur[key] ?? 0) + performance.now() - t; } };
  };
  wrap(v, 'render', 'frame');
  wrap(v.cull, 'update', 'cull');
  if (v.updateGrass) wrap(v, 'updateGrass', 'grass');
  wrap(gl, 'render', 'draws');
  wrap(v, 'updateDaylight', 'daylight');
  let last = performance.now(), programs = gl.info.programs?.length ?? 0, k = 0;
  const pin = v.course?.toWorld?.(v.course.pin) ?? {x: 0, z: 0};
  await new Promise(done => {
   const step = now => {
    if (cur) {
     cur.interval = now - last;
     const p = gl.info.programs?.length ?? 0; cur.programs = p - programs; programs = p;
     cur.rebuilds = v.cull?.stats().rebuilds;
     out.push(cur);
    }
    last = now;
    if (k++ >= n) return done();
    cur = {i: k};
    if (orbit) { const a = k / n * Math.PI * 2, t0 = performance.now(); cur.camera = 0; window.lab.camera({x: pin.x + Math.sin(a) * 90, z: pin.z + Math.cos(a) * 90, height: 12, yaw: a * 180 / Math.PI + 180, pitch: -8}); cur.camera = performance.now() - t0; }
    requestAnimationFrame(step);
   };
   requestAnimationFrame(step);
  });
  return out;
 }, [FRAMES, ORBIT]);
 const sorted = rows.map(r => r.interval).sort((a, b) => a - b), q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
 console.log(`\n${BIOME}, ${TIER}${ORBIT ? ', orbiting' : ', still'}: ${rows.length} frames, interval median ${q(.5).toFixed(1)} ms, p95 ${q(.95).toFixed(1)}, p99 ${q(.99).toFixed(1)}, worst ${sorted.at(-1).toFixed(1)}`);
 const rebuilt = rows.at(-1)?.rebuilds - rows[0]?.rebuilds;
 console.log(`cull rebuilds in the run: ${rebuilt}; programs compiled in the run: ${rows.reduce((a, r) => a + (r.programs > 0 ? r.programs : 0), 0)}`);
 const f = x => (x ?? 0).toFixed(1).padStart(6);
 console.log(`  frame  interval   game  draws   cull  grass  daylight  camera-move  outside-game  programs`);
 for (const r of rows.filter(r => r.interval > OVER))
  console.log(`  ${String(r.i).padStart(5)} ${f(r.interval)}  ${f(r.frame)} ${f(r.draws)} ${f(r.cull)} ${f(r.grass)}    ${f(r.daylight)}       ${f(r.camera)}        ${f(r.interval - (r.frame ?? 0) - (r.camera ?? 0))}   ${r.programs || ''}`);
} catch (e) { result = String(e.message).split('\n')[0]; throw e; } finally {
 await browser.close(); server.close();
 logRun({goal: flag('goal', null), what: `frame-spikes ${BIOME} ${TIER}${ORBIT ? ' orbit' : ''}`, started, before, after: readCard(), result});
}
