#!/usr/bin/env node
// A CONTROLLER ALONE, AT EVERY SIZE (the 1.0 polish; docs/UI_POLISH.md,
// checklist T2: every screen works with the keyboard alone and a controller
// alone). The game reads a standard pad once a frame (main.js `tick`,
// `menuPad`): the d-pad moves the menus' focus by the same rule as the arrows
// (moveFocus), A presses what is focused, B backs out of a sheet or the pause
// list, Start pauses a round. A browser test cannot plug a pad in, so this
// stands a pretend one in `navigator.getGamepads` and presses its buttons a
// frame at a time, as a pad's state arrives. At each size it checks:
//   - the d-pad moves the main menu's focus, down and back up;
//   - A on Play opens it, and the d-pad moves inside the sheet;
//   - B closes the sheet and the main menu is back;
//   - A alone, from the main menu, starts the course of the week (the way
//     tools/ui-flows.mjs counts "by Enter") and a swing can start;
//   - Start opens the pause list, the d-pad moves in it, B resumes.
// Any page error fails it.
//
//   node tools/capture/build-hooked.mjs
//   node tools/ui-pad-check.mjs [--game bench/ab/main-ui/index.html] [--only 390x844]
//
// Uses the graphics card (AGENTS.md says when). Results and a picture per size
// in bench/shots/ui-pad/ (not committed).
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = n => (argv.includes('--' + n) ? argv[argv.indexOf('--' + n) + 1] : null);
const GAME = path.resolve(ROOT, flag('game') || 'bench/shots/dist-exp/index.html');
const OUT = path.join(ROOT, 'bench', 'shots', 'ui-pad', flag('out') || 'now');
const SIZES = [
 {w: 1920, h: 1080}, {w: 1280, h: 720}, {w: 3840, h: 2160}, {w: 1024, h: 768, touch: true},
 {w: 390, h: 844, touch: true}, {w: 844, h: 390, touch: true},
].filter(s => !flag('only') || `${s.w}x${s.h}` === flag('only'));
// The standard mapping's buttons.
const A = 0, B = 1, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

const frames = (p, n) => p.evaluate(n => new Promise(done => { let i = 0; const f = () => (++i < n ? requestAnimationFrame(f) : done()); requestAnimationFrame(f); }), n);
// A press: down for a few frames, up for a few (the game acts on the edge), and
// past menuPad's 220 ms repeat guard for the d-pad.
async function press(p, i) {
 await p.evaluate(i => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; window.__pad.timestamp++; }, i);
 await frames(p, 4);
 await p.evaluate(i => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; window.__pad.timestamp++; }, i);
 await frames(p, 4);
 await p.waitForTimeout(240);
}
const focused = p => p.evaluate(() => { const e = document.activeElement; return e && e !== document.body ? (e.id || e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)) : null; });
const state = p => p.evaluate(() => ({
 menu: !document.getElementById('mainMenu').hidden,
 sheet: !document.getElementById('drawer').hidden,
 paused: document.getElementById('app').classList.contains('rh-paused'),
 swing: !!window.lab?.state?.().canSwing,
}));

fs.mkdirSync(OUT, {recursive: true});
const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const results = [];
try {
 for (const size of SIZES) {
  const ctx = await browser.newContext({viewport: {width: size.w, height: size.h}, deviceScaleFactor: 1, hasTouch: !!size.touch, isMobile: !!size.touch && size.w < 1024});
  const p = await ctx.newPage();
  const name = `${size.w}x${size.h}`, errors = [], checks = [];
  const ok = (what, pass, note = '') => checks.push({what, pass: !!pass, note});
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  await p.addInitScript(() => {
   localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0}));
   if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pp', profiles: [{id: 'pp', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]}));
   const pad = {id: 'Pretend pad (standard)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0}))};
   window.__pad = pad;
   navigator.getGamepads = () => [pad, null, null, null];
  });
  await p.goto(pathToFileURL(GAME).href);
  await p.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
  await p.waitForTimeout(800);
  try {
   // The main menu: down, then up again.
   const f0 = await focused(p);
   await press(p, DOWN);
   const f1 = await focused(p);
   ok('d-pad down moves the main menu', f1 && f1 !== f0, `${f0} -> ${f1}`);
   await press(p, UP);
   const f2 = await focused(p);
   ok('d-pad up moves back', f2 && f2 !== f1, `${f1} -> ${f2}`);
   // Onto Play (the first tile) and A.
   for (let i = 0; i < 3 && (await focused(p)) !== 'menuPlay'; i++) await press(p, UP);
   ok('Play is reached by the d-pad', (await focused(p)) === 'menuPlay', String(await focused(p)));
   await press(p, A);
   await p.waitForTimeout(400);
   ok('A opens Play', (await state(p)).sheet);
   const s0 = await focused(p);
   await press(p, RIGHT);
   const s1 = await focused(p);
   ok('d-pad moves inside the sheet', s1 && s1 !== s0, `${s0} -> ${s1}`);
   await press(p, LEFT);
   await press(p, B);
   await p.waitForTimeout(400);
   let st = await state(p);
   ok('B closes the sheet, the main menu is back', !st.sheet && st.menu);
   // A alone into the course of the week: Play, the week's card, its start.
   for (let i = 0; i < 3 && (await focused(p)) !== 'menuPlay'; i++) await press(p, UP);
   const trail = [];
   for (let i = 0; i < 4; i++) {
    const on = await focused(p);
    trail.push(on);
    await press(p, A);
    await p.waitForTimeout(500);
    st = await state(p);
    // A start button pressed: the course grows now; pressing on would open
    // Play again over the growing course.
    if (on === 'startRound' || (!st.menu && !st.sheet)) break;
   }
   if (argv.includes('--trace')) console.log(`  ${name} A pressed on: ${trail.join(' | ')}`);
   await p.waitForFunction(() => window.lab.state().canSwing && document.getElementById('mainMenu').hidden && document.getElementById('drawer').hidden, null, {timeout: 120000}).catch(() => {});
   st = await state(p);
   ok('A alone starts the course of the week', !st.menu && !st.sheet && st.swing);
   await p.waitForTimeout(1500);
   // The pause list.
   await press(p, START);
   await p.waitForTimeout(300);
   ok('Start pauses the round', (await state(p)).paused);
   const q0 = await focused(p);
   await press(p, DOWN);
   const q1 = await focused(p);
   ok('d-pad moves in the pause list', q1 && q1 !== q0, `${q0} -> ${q1}`);
   await p.screenshot({path: path.join(OUT, `${name}-pause.png`)});
   await press(p, B);
   await p.waitForTimeout(300);
   st = await state(p);
   ok('B resumes', !st.paused && st.swing);
  } catch (e) {
   ok('ran to the end', false, e.message.split('\n')[0]);
  }
  ok('no page errors', !errors.length, errors[0] || '');
  results.push({size: name, checks, errors});
  const failed = checks.filter(c => !c.pass);
  console.log(`${name.padEnd(10)} ${checks.length - failed.length}/${checks.length}` + failed.map(c => `  [FAIL ${c.what}${c.note ? ' -- ' + c.note : ''}]`).join(''));
  await ctx.close();
 }
} finally {
 await browser.close();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const bad = results.some(r => r.checks.some(c => !c.pass));
console.log(`\n${bad ? 'SOMETHING FAILED' : 'all pass'}; ${path.relative(ROOT, path.join(OUT, 'results.json'))}`);
process.exit(bad ? 1 : 0);
