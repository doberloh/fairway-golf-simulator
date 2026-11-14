#!/usr/bin/env node
// WHICH SHADER IS BUILT AFTER A COURSE APPEARS (the frame-rate pass, 13
// November 2026). The smoke journey `no-late-shaders` says THAT a lit shader
// was built late, on whatever course "Surprise me" drew; this loads a named
// course on the capture build and says WHICH: every program first used after
// the course is up, with the defines and the telling names in its text, while
// the camera stands at the tee, turns right round, and looks from above.
//
//   node tools/capture/build-hooked.mjs
//   node tools/late-shaders.mjs --goal <goal> --biome lowgulf --seed HOLLOW-1812 [--tier ultra] [--holes 9]
//
// Goes through the card's gate and the run log like the frame tools.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gpuGate, logRun, readCard} from './gpu-gate.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : fallback; };
const BUILD = flag('build', 'bench/shots/dist-exp/index.html'), TIER = flag('tier', 'ultra'), BIOME = flag('biome', 'lowgulf'), SEED = flag('seed', 'PROFILE'), HOLES = Number(flag('holes', 9));
const html = fs.readFileSync(path.resolve(ROOT, BUILD));
if (!/window[.]__view *=/.test(html)) throw Error(`${BUILD} has no window.__view; build it with tools/capture/build-hooked.mjs`);
const before = gpuGate({goal: flag('goal', null), cap: Infinity, utilMax: Number(flag('util', 30)), tempMax: Number(flag('temp', 75)), restMin: Number(flag('rest', 0)), lookSeconds: 6});
const started = new Date().toISOString();
const server = await new Promise(resolve => { const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => resolve(s)); });
const browser = await chromium.launch({headless: true, args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
let result = 'ok';
try {
 const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
 await page.addInitScript(p => {
  try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); localStorage.removeItem('fairway-round-v1'); } catch {}
  const P = WebGL2RenderingContext.prototype, create = P.createProgram, use = P.useProgram, shaderSource = P.shaderSource, attach = P.attachShader;
  const src = new WeakMap(), parts = new WeakMap();
  let late = new WeakSet();
  window.__watch = false; window.__late = [];
  P.shaderSource = function (shader, text) { src.set(shader, text); return shaderSource.call(this, shader, text); };
  P.attachShader = function (program, shader) { (parts.get(program) || parts.set(program, []).get(program)).push(shader); return attach.call(this, program, shader); };
  P.createProgram = function () { const program = create.call(this); if (window.__watch) late.add(program); return program; };
  P.useProgram = function (program) {
   if (program && late.has(program)) {
    late.delete(program);
    const text = (parts.get(program) || []).map(s => src.get(s) || '').join('\n');
    const defines = [...new Set((text.match(/#define (USE_\w+|\w*INSTANC\w*|DOUBLE_SIDED|FLAT_SHADED|SHADER_TYPE \w+|NUM_\w+ \d+|CSM_\w+( \d+)?)/g) || []).map(d => d.replace('#define ', '')))];
    const names = ['farNormals', 'vFarAcross', 'vThin', 'thinLvl', 'windTime', 'treeRoot', 'flex', 'snowTop', 'vMistWorld', 'cloudShadowAt', 'groundPoint', 'mirrorMap', 'rimLit', 'aFoot'].filter(n => text.includes(n));
    window.__late.push({after: Math.round(performance.now() - window.__since), stage: window.__stage, defines, names});
   }
   return use.call(this, program);
  };
 }, {quality: TIER, frameCap: 0, autoResolution: false});
 const errors = [];
 page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
 await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
 await page.waitForFunction(() => window.lab && window.lab.course, null, {timeout: 60000});
 await page.evaluate(o => window.lab.course(o), {biome: BIOME, holes: HOLES, seed: SEED});
 const frames = n => page.evaluate(n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); }), n);
 await page.evaluate(() => { window.__watch = true; window.__since = performance.now(); window.__stage = 'arrival'; });
 await frames(120);
 for (const [stage, cam] of [['turning', null], ['from above', {hole: 0, along: -150, height: 250, look: 'pin'}], ['tee 5', {hole: 4, along: -4, height: 1.8, look: 'pin'}]]) {
  await page.evaluate(s => { window.__stage = s; }, stage);
  if (cam) await page.evaluate(c => window.lab.camera(c), cam);
  else for (let yaw = 0; yaw < 360; yaw += 45) { await page.evaluate(y => { const w = window.__view.world, h = w.holes[0]; const t = h.toWorld ? h.toWorld(h.tee ?? {x: 0, z: 0}) : {x: 0, z: 0}; window.lab.camera({x: t.x, z: t.z, yaw: y, height: 1.8, pitch: -2}); }, yaw); await frames(20); }
  await frames(90);
 }
 const late = await page.evaluate(() => window.__late);
 console.log(`\n${BIOME} ${SEED}, ${TIER}: ${late.length} program(s) first used after the course was up${errors.length ? `; ${errors.length} page error(s): ${errors[0]}` : ''}`);
 for (const l of late) console.log(`  ${String(l.after).padStart(6)} ms  ${l.stage.padEnd(11)} ${l.defines.filter(d => d.startsWith('SHADER_TYPE')).join(' ') || '(a ShaderMaterial)'}  names: ${l.names.join(', ') || '-'}\n           ${l.defines.filter(d => !d.startsWith('SHADER_TYPE')).join(' ')}`);
 result = `${late.length} late`;
} finally {
 await browser.close(); server.close();
 logRun({goal: flag('goal', null), what: `late-shaders ${BIOME} ${SEED} ${TIER}`, started, before, after: readCard(), result});
}
