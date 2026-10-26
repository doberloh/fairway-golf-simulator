#!/usr/bin/env node
// WHERE A FRAME'S TRIANGLES COME FROM, model by model (the cartoon overhaul's
// frame-rate pass, 25 October 2026).
//
//   node tools/frame-tris.mjs --goal <name> [--build bench/shots/dist-exp/index.html]
//        [--tier high] [--biome autumn] [--spot tee1] [--top 25]
//
// The profiler counts the triangles a frame draws (all passes); frame-variants
// --scene counts what a course BUILT, by group. Neither says which model. This
// loads one course, stands at one spot, lets the instance cull settle, and
// lists every instanced mesh by what it holds NOW (instances in the buffer
// times triangles a model) -- the picture's share; each shadow map draws a
// prefix of the same buffer, so a model's shadow cost follows its picture
// cost. Grouped by model (or by the mesh's name when it has none).
// Goes through the GPU gate like the other frame tools.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : fallback; };
const BUILD = flag('build', 'bench/shots/dist-exp/index.html'), TIER = flag('tier', 'high'), BIOME = flag('biome', 'autumn');
const SPOT = flag('spot', 'tee1'), TOP = Number(flag('top', 25));
const SPOTS = {tee1: {hole: 0, along: -4, height: 1.8, look: 'pin'}, tee5: {hole: 4, along: -4, height: 1.8, look: 'pin'},
 side2: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}};
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const html = fs.readFileSync(path.resolve(ROOT, BUILD));
if (!/window[.]__view *=/.test(html)) throw Error(`${BUILD} has no window.__view; build it with tools/capture/build-hooked.mjs`);
const before = gpuGate({goal: flag('goal', null), cap: Infinity, utilMax: Number(flag('util', 10)), tempMax: Number(flag('temp', 60)), restMin: Number(flag('rest', 5))});
const started = new Date().toISOString();
const server = await new Promise(resolve => { const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => resolve(s)); });
const browser = await chromium.launch({headless: true, args: GPU_ARGS});
const frames = (page, n) => page.evaluate(n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); }), n);
try {
 const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
 await page.addInitScript(p => { try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); localStorage.removeItem('fairway-round-v1'); } catch {} }, {quality: TIER, frameCap: 0, autoResolution: false});
 await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
 await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
 await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: 9, seed: 'PROFILE'});
 await page.evaluate(o => window.lab.camera(o), SPOTS[SPOT]);
 await frames(page, 90);
 const rows = await page.evaluate(() => {
  const v = window.__view, by = new Map();
  v.group.traverse(o => {
   if (!o.isInstancedMesh || !o.visible || !o.count) return;
   const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
   const key = (o.userData.model ?? o.parent?.name ?? o.name) + (o.name === 'far trees' ? ' (far)' : o.name === 'shadow twin' ? ' (shadow twin)' : '');
   const r = by.get(key) ?? {key, meshes: 0, instances: 0, triangles: 0, per: 0};
   r.meshes++; r.instances = Math.max(r.instances, o.count); r.triangles += tris * o.count; r.per += tris;
   by.set(key, r);
  });
  return {stats: v.cull?.stats(), rows: [...by.values()].sort((a, b) => b.triangles - a.triangles)};
 });
 const total = rows.rows.reduce((a, r) => a + r.triangles, 0);
 console.log(`\n${BIOME}, ${TIER}, ${SPOT}: ${(total / 1e6).toFixed(2)} M triangles in the picture's buffers (shadow twins only draw into shadow maps)`);
 console.log(`cull: ${JSON.stringify(rows.stats)}`);
 console.log('  model                                   instances  tris/model   M tris   share');
 for (const r of rows.rows.slice(0, TOP)) console.log(`  ${r.key.slice(0, 40).padEnd(40)} ${String(r.instances).padStart(8)} ${String(Math.round(r.per)).padStart(10)} ${(r.triangles / 1e6).toFixed(2).padStart(8)} ${(r.triangles / total * 100).toFixed(1).padStart(6)}%`);
} finally {
 await browser.close(); server.close();
 logRun({goal: flag('goal', null), what: `frame-tris ${BIOME} ${TIER} ${SPOT}`, started, before, after: readCard(), result: 'ok'});
}
