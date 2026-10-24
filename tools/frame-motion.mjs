#!/usr/bin/env node
// The same round, frame for frame, in two builds -- with the camera moving.
//
//   node tools/frame-motion.mjs --goal <name> --cap 40 --a bench/ab/hooked-base/index.html --b bench/ab/hooked-final/index.html --tier ultra
//
// tools/frame-look.mjs stops the clock, so it cannot see what only happens in
// motion: the far shadow maps that now wait up to three frames, the cloud
// shadows packed for the view, the map redrawn as the ball flies. This runs
// the clock instead, but a VIRTUAL one: every animation frame is exactly 1/60
// s on performance.now and on the frame's timestamp, and the clock only moves
// when the tool steps it. So both builds play an identical round -- the same
// wind, the same clouds, the same driver off the first tee, the same
// television cameras -- and frame N of one can be compared with frame N of the
// other.
//
// THE PICTURE IS TAKEN INSIDE THE FRAME IT SHOWS. A screenshot makes the page
// draw again, and with the clock stopped a few more frames would let every
// waiting shadow map catch up -- hiding exactly what this is for. So the
// canvas is read (toDataURL) right after the game's own frame, in the same
// animation callback, before anything else can draw.
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
const A = flag('a'), B = flag('b'), TIER = flag('tier', 'ultra'), LABEL = flag('label', 'motion-' + TIER);
const OUT = path.join(ROOT, 'bench', 'ab', 'motion', LABEL);
// A driver off the first tee (launch-monitor numbers: m/s, degrees, rpm).
const SHOT = {speed: 70, vla: 12, hla: -1, spin: 2700, spinAxis: 2};
// Frames after the shot at which to look: the swing, the tee camera turning
// with the ball, the landing camera, the roll, the whole-shot view.
const AFTER_SHOT = [10, 40, 90, 160, 260, 420];
// Then the overview: the camera flying up over the hole.
const INTO_OVERVIEW = [8, 20, 45];
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
 '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
 '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];

// The virtual clock. Free-running (a 60th of a second a frame) while the
// course loads, so the game's own timers finish; the renderer is handed dt 0
// meanwhile (`__vhold`), so clouds stay where the seed put them. Then it holds,
// and moves only by `__step(n)`.
// `steps`: -1 free-running, 0 held, n > 0 frames still to step. The step ends
// in the renderer's own draw call (see `play`), which reads the canvas when
// asked and settles `__stepDone`.
const CLOCK = () => {
 const realRAF = window.requestAnimationFrame.bind(window);
 let vnow = 1000, lastT = null, steps = -1;
 window.__vhold = true;
 performance.now = () => vnow;
 window.__step = (n, grab) => new Promise(resolve => {
  window.__grabbed = null;
  if (n <= 0) { steps = 0; resolve(); return; }
  steps = n; window.__grabWanted = !!grab; window.__stepDone = resolve;
  setTimeout(() => { if (window.__stepDone === resolve) { window.__stepDone = null; window.__grabbed = 'timeout'; resolve(); } }, 15000);
 });
 window.requestAnimationFrame = cb => realRAF(t => {
  if (t !== lastT) {
   lastT = t;
   if (steps < 0) vnow += 1000 / 60;
   else if (steps > 0) { vnow += 1000 / 60; steps--; window.__finalFrame = steps === 0; }
  }
  return cb(vnow);
 });
};

async function play(file, tag) {
 const html = fs.readFileSync(path.resolve(ROOT, file));
 const server = await new Promise(r => { const s = createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => r(s)); });
 const browser = await chromium.launch({headless: true, args: GPU_ARGS});
 const out = {errors: [], grabs: {}};
 try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 2});
  await page.addInitScript(CLOCK);
  await page.addInitScript(p => {
   try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
   try { localStorage.removeItem('fairway-round-v1'); } catch {}
   try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pprof', profiles: [{id: 'pprof', name: 'Profiler', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
  }, {quality: TIER, frameCap: 0, autoResolution: false});
  page.on('pageerror', e => out.errors.push(String(e.message).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') out.errors.push(m.text().split('\n')[0]); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.__view && window.lab && window.lab.course, null, {timeout: 60000});
  // The renderer is handed dt 0 while the course loads, and the picture of a
  // step's last frame is read the moment that frame is drawn.
  await page.evaluate(() => {
   const v = window.__view, r = v.render;
   v.render = function (dt) {
    const out = r.call(this, window.__vhold ? 0 : dt);
    if (window.__finalFrame) {
     window.__finalFrame = false;
     if (window.__grabWanted) { try { window.__grabbed = this.canvas.toDataURL('image/png'); } catch (e) { window.__grabbed = 'error ' + e.message; } }
     const d = window.__stepDone; window.__stepDone = null; d && d();
    }
    return out;
   };
  });
  await page.evaluate(o => window.lab.course(o), {biome: 'redwood', holes: 9, seed: 'PROFILE'});
  await page.waitForTimeout(4000);
  // Hold the clock, put the moving things back to their start, and from here
  // on move only by steps.
  await page.evaluate(() => window.__step(0));
  await page.evaluate(() => { const v = window.__view; v.elapsed = 0; if (v.waterTime) v.waterTime.value = 0; window.__vhold = false; });
  await page.evaluate(() => window.__step(30));
  const grab = async (name, n) => {
   await page.evaluate(n => window.__step(n, true), n);
   const url = await page.evaluate(() => window.__grabbed);
   if (!url || !url.startsWith('data:image/png')) throw Error(`no picture at ${name}: ${String(url).slice(0, 80)}`);
   const file = path.join(OUT, `${tag}-${name}.png`);
   fs.mkdirSync(path.dirname(file), {recursive: true});
   fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
   out.grabs[name] = file;
  };
  const fired = await page.evaluate(s => window.__takeShot(s), SHOT);
  if (fired === false) throw Error('the shot was refused');
  let at = 0;
  for (const n of AFTER_SHOT) { await grab(`shot+${n}`, n - at); at = n; }
  // The interface mid-round, after the ball has stopped: a screenshot is fine
  // here, the clock is held.
  await page.screenshot({path: path.join(OUT, `${tag}-hud-after-shot.png`)});
  await page.evaluate(() => window.lab.view('overview'));
  at = 0;
  for (const n of INTO_OVERVIEW) { await grab(`overview+${n}`, n - at); at = n; }
 } finally { await browser.close(); server.close(); }
 return out;
}

const gate = gpuGate({goal: flag('goal', null), cap: Number(flag('cap', 6))});
const started = Date.now();
let failed = null, a, b;
try { a = await play(A, 'A'); b = await play(B, 'B'); }
catch (e) { failed = String(e.message).split('\n')[0]; console.log(`FAILED ${failed}`); }
logRun({goal: flag('goal', null), run: gate.run, tool: 'frame-motion', label: LABEL, tier: TIER, a: A, b: B,
 before: {util: gate.util, temp: gate.temp}, after: (() => { try { return readCard(); } catch { return null; } })(),
 seconds: Math.round((Date.now() - started) / 1000), failed});
if (failed) process.exit(1);

console.log(`\n${TIER} · redwood PROFILE · virtual clock, a driver off tee 1 and the overview, frame for frame`);
const report = {};
for (const name of Object.keys(a.grabs)) {
 const d = diffPng(a.grabs[name], b.grabs[name]);
 writeDiffPng(a.grabs[name], b.grabs[name], path.join(OUT, `diff-${name}.png`));
 report[name] = d;
 console.log(`  ${name.padEnd(13)} A vs B: ${(d.share * 100).toFixed(3)}% of pixels changed, mean difference ${d.mean.toFixed(3)} of 255`);
}
const hud = diffPng(path.join(OUT, 'A-hud-after-shot.png'), path.join(OUT, 'B-hud-after-shot.png'));
console.log(`  screen after the shot, interface included: ${(hud.share * 100).toFixed(3)}% changed`);
console.log(`  page errors: A ${a.errors.length}, B ${b.errors.length}${[...a.errors, ...b.errors].length ? ' -- ' + [...new Set([...a.errors, ...b.errors])].slice(0, 3).join(' | ') : ''}`);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({report, hud, errors: {a: a.errors, b: b.errors}}, null, 1));
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)} s on the card; pictures in bench/ab/motion/${LABEL}/`);
