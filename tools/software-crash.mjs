// WHY MEDIUM CRASHES ON THE SOFTWARE RENDERER (the profile of 3 November 2026:
// "Target crashed" at weak/medium on Puget Sound, every time; Low runs).
// SwiftShader (no graphics card), one case a fresh browser, each case logging
// how far it got before the page died:
//
//   node tools/software-crash.mjs                 every case
//   node tools/software-crash.mjs low-then-medium  one
//
// Cases: `medium` (load straight at Medium), `low` (at Low: the control),
// `low-then-medium` (built at Low, Medium's drawing switched on live -- if
// this crashes, the cause is how Medium draws, not what it builds), and
// `medium-small` (Medium in a 960x540 window: if this lives, the cause is
// the size of Medium's buffers). Run it ALONE: software rendering took the
// machine down on 13 October 2026. Uses the hooked capture build.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const GAME = path.join(ROOT, 'bench', 'shots', 'dist-exp', 'index.html');
const ARGS = ['--use-gl=swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
const CASES = {
 low: {quality: 'low'},
 medium: {quality: 'medium'},
 'low-then-medium': {quality: 'low', then: 'medium'},
 'medium-small': {quality: 'medium', width: 960, height: 540},
};

async function run(name, c) {
 const browser = await chromium.launch({args: ARGS});
 const steps = [];
 const say = s => { steps.push(s); console.log(`  ${name}: ${s}`); };
 try {
  const page = await (await browser.newContext({viewport: {width: c.width || 1600, height: c.height || 900}, deviceScaleFactor: 1})).newPage();
  let crashed = false;
  page.on('crash', () => { crashed = true; say('PAGE CRASHED'); });
  page.on('pageerror', e => say(`page error: ${e.message.slice(0, 140)}`));
  await page.addInitScript(q => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: q, autoResolution: false, frameCap: 0, textSize: 100})), c.quality);
  await page.addInitScript(() => localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'p1', profiles: [{id: 'p1', name: 'Test', created: Date.now()}]})));
  await page.goto(pathToFileURL(GAME).href);
  await page.waitForFunction(() => window.lab && window.__view && !document.getElementById('splash'), null, {timeout: 300000});
  const mem = () => page.evaluate(() => ({heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6), renderer: window.__view.renderer.getContext().getParameter(window.__view.renderer.getContext().RENDERER)}));
  say(`menu up ${JSON.stringify(await mem())}`);
  await page.evaluate(() => window.lab.course({biome: 'puget', holes: 9, seed: 'WEAK', season: 'summer'}));
  say(`course built at ${c.quality}; heap ${(await mem()).heap} MB`);
  await page.waitForTimeout(8000);
  if (crashed) return {name, steps, crashed};
  const info = await page.evaluate(() => ({info: window.__view.renderer.info.render, mem: window.__view.renderer.info.memory}));
  say(`drawing: ${JSON.stringify(info)}`);
  if (c.then) {
   await page.evaluate(q => window.__view.applyQuality(q), c.then);
   say(`switched to ${c.then} live`);
   await page.waitForTimeout(10000);
   if (!crashed) say(`still alive at ${c.then}: ${JSON.stringify(await page.evaluate(() => window.__view.renderer.info.render))}`);
  }
  return {name, steps, crashed};
 } catch (e) {
  say(`stopped: ${e.message.split('\n')[0].slice(0, 160)}`);
  return {name, steps, crashed: /crash|closed/i.test(e.message)};
 } finally { await browser.close(); }
}

const want = process.argv.slice(2);
const out = [];
for (const [name, c] of Object.entries(CASES)) if (!want.length || want.includes(name)) out.push(await run(name, c));
console.log('\n' + out.map(r => `${r.name.padEnd(16)} ${r.crashed ? 'CRASHED' : 'ran'}`).join('\n'));
