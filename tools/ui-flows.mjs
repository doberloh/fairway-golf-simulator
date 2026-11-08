#!/usr/bin/env node
// HOW MANY PRESSES FROM THE MAIN MENU TO PLAYING, PER MODE (the 1.0 polish;
// docs/UI_POLISH.md, *The way into every mode*). The checklist's G1: the
// fewest presses from the main menu to the first shot, counted, before and
// after each round of condensing.
//
//   node tools/capture/build-hooked.mjs
//   node tools/ui-flows.mjs                         the current build, its paths
//   node tools/ui-flows.mjs --game bench/ab/main-ui/index.html --paths before
//
// Each mode is a path: the buttons a player presses, in order, from the main
// menu, and how to tell it arrived. For every press it counts:
//   - with a mouse or a finger: one;
//   - with the keyboard or a controller: the fewest arrow presses from where
//     the focus is to that button, by the game's own rule (src/ui-focus.js
//     `nextFocus`, over the same buttons main.js `moveFocus` walks), plus
//     Enter -- then it presses it that way, so a path the keys cannot finish
//     fails here as it would for a player.
// A path is only counted when it arrives. The paths are written per build
// (PATHS below): when a round changes the way in, the new shortest path is
// written beside the old, so both numbers stay true.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {nextFocus, DIRS} from '../src/ui-focus.js';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', 'bench/shots/dist-exp/index.html'));
const WHICH = opt('paths', 'after');
const ONLY = opt('only', null)?.split(',');

// A press: a CSS selector, or {text} for a visible button by its words.
// Arrived means the main menu is gone, no sheet is open, nothing is growing,
// and a swing can start. A swing can start behind the menu too (its backdrop
// is a real hole), so `canSwing` alone passed paths that never left it.
const inRound = () => document.getElementById('mainMenu').hidden && document.getElementById('drawer').hidden
 && document.getElementById('generating').hidden !== false && window.lab?.state?.().canSwing === true;
const ARRIVE = {
 round: inRound,
 range: inRound,
 studio: () => document.getElementById('mainMenu').hidden && document.getElementById('world')?.dataset.mode === 'studio' && document.getElementById('generating')?.hidden !== false,
 challenge: inRound,
};
// What a path needs that a fresh player would not have (a saved course, a
// saved round), set before the page opens.
const SEED = {
 lastPlay: () => localStorage.setItem('fairway-last-play-v1', JSON.stringify({version: 1, kind: 'weekly', courseId: null, group: {players: [{name: 'Alex', team: 'A'}], mode: 'stroke', tee: 'white'}})),
 savedCourse: () => localStorage.setItem('fairway-courses-v1', JSON.stringify({version: 1, courses: [{id: 'cflow', name: 'Flow Test', created: 1, generator: 0, schema: 1, settings: {seed: 'FLOW', biome: 'seaside', holes: 9}}]})),
};

const PATHS = {
 // main, 0.9.5: Play's start button only on its last step.
 before: [
  {mode: 'Course of the week', arrive: 'round', steps: ['#menuPlay', {last: true}, '#startRound']},
  {mode: 'Endless', arrive: 'round', steps: ['#menuPlay', '#drawer [data-game="endless"]', {last: true}, '#startRound']},
  {mode: 'Saved course', arrive: 'round', seed: 'savedCourse', steps: ['#menuPlay', '#drawer [data-game="saved"]', '#drawer [data-course="cflow"]', {last: true}, '#startRound']},
  {mode: 'Surprise me', arrive: 'round', steps: ['#menuPlay', '#drawer [data-game="surprise"]', {last: true}, '#startRound']},
  {mode: 'New course in studio', arrive: 'studio', steps: ['#menuStudio', '#growStudio']},
  {mode: 'Driving range', arrive: 'range', steps: ['#menuRange', {last: true}, {text: 'Open the driving range'}]},
  {mode: 'A challenge', arrive: 'challenge', steps: ['#menuChallenges', {last: true}, '#challengeGo']},
  {mode: 'Studio, on Seaside Links', arrive: 'studio', steps: ['#menuStudio', {last: false, text: 'Landscape'}, '#drawer [data-biome="seaside"]', '#growStudio']},
 ],
 // Play round 1 (the 1.0 polish): Tee off on every step of Play.
 after: [
  {mode: 'Course of the week', arrive: 'round', steps: ['#menuPlay', '#startRound']},
  {mode: 'Play again (last setup)', arrive: 'round', seed: 'lastPlay', steps: ['#menuAgain']},
  {mode: 'Endless', arrive: 'round', steps: ['#menuPlay', '#drawer [data-game="endless"]', '#startRound']},
  {mode: 'Saved course', arrive: 'round', seed: 'savedCourse', steps: ['#menuPlay', '#drawer [data-game="saved"]', '#drawer [data-course="cflow"]', '#startRound']},
  {mode: 'Surprise me', arrive: 'round', steps: ['#menuPlay', '#drawer [data-game="surprise"]', '#startRound']},
  {mode: 'New course in studio', arrive: 'studio', steps: ['#menuStudio', '#growStudio']},
  {mode: 'Studio, on Seaside Links', arrive: 'studio', steps: ['#menuStudio', '#drawer [data-biome="seaside"]', '#growStudio']},
  // Round 3: the range and Challenges start from their first step.
  {mode: 'Driving range', arrive: 'range', steps: ['#menuRange', '#rangeGo']},
  {mode: 'A challenge', arrive: 'challenge', steps: ['#menuChallenges', '#challengeGo']},
  // Round 5: the keys' own path -- Enter on the card the keys start on, which
  // (round 4) puts them on the start button.
  {mode: 'Course of the week, by Enter', arrive: 'round', steps: ['#menuPlay', '#drawer [data-game="weekly"]', '#startRound']},
  {mode: 'A challenge, by Enter', arrive: 'challenge', steps: ['#menuChallenges', '#drawer .chal-card.on', '#challengeGo']},
 ],
};

const centreOf = r => ({x: r.x + r.width / 2, y: r.y + r.height / 2});
// The buttons the arrows move between, as main.js moveFocus finds them, and
// which is focused.
const focusables = page => page.evaluate(() => {
 const app = document.getElementById('app');
 const scope = app.classList.contains('rh-paused') ? document.querySelector('.topbar')
  : !document.getElementById('drawer').hidden ? document.getElementById('drawer')
  : !document.getElementById('mainMenu').hidden ? document.getElementById('mainMenu') : null;
 if (!scope) return null;
 // main.js moveFocus's filter (since the 1.0 polish: never tabindex -1 or
 // aria-hidden, the drop-downs' hidden selects). A build from before it is
 // walked with its own rule -- `OLD_FILTER` -- or the count would be of a
 // path its players could not take.
 const old = window.__flowsOldFilter;
 const els = [...scope.querySelectorAll('button,select,a[href],summary')].filter(el => !el.disabled && (old || (el.tabIndex !== -1 && !el.closest('[aria-hidden="true"]'))) && el.offsetParent !== null && el.getBoundingClientRect().width > 0);
 els.forEach((el, i) => el.dataset.flowIx = i);
 return {rects: els.map(el => { const r = el.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; }), focus: els.indexOf(document.activeElement)};
});
// The fewest arrows from `from` to `to` (breadth first over the four keys).
function arrows(rects, from, to) {
 if (from === to) return [];
 const seen = new Map([[from, []]]), todo = [from];
 while (todo.length) {
  const i = todo.shift();
  for (const dir of Object.keys(DIRS)) {
   const j = nextFocus(rects, i < 0 ? 0 : i, dir);
   if (seen.has(j)) continue;
   const route = [...seen.get(i), dir];
   if (j === to) return route;
   seen.set(j, route); todo.push(j);
  }
 }
 return null;
}
const KEY = {up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'};

async function target(page, step) {
 return page.evaluate(step => {
  const shown = e => e && !e.disabled && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  let el = null;
  if (typeof step === 'string') el = [...document.querySelectorAll(step)].find(shown);
  else if (step.last) { const chips = [...document.querySelectorAll('#drawer .sx-steps .sx-step')].filter(shown); el = chips[chips.length - 1]; }
  else if (step.text) { const words = [].concat(step.text).map(t => t.toLowerCase()); el = [...document.querySelectorAll('button')].find(b => shown(b) && words.some(w => b.textContent.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(w))); }
  if (!el) return null;
  return el.dataset.flowIx !== undefined ? Number(el.dataset.flowIx) : -1;
 }, step);
}

async function open(browser, seed) {
 const page = await (await browser.newContext({viewport: {width: 1280, height: 720}})).newPage();
 await page.addInitScript(() => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0, textSize: 100})));
 await page.addInitScript(() => { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pa', profiles: [{id: 'pa', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]})); });
 if (seed) await page.addInitScript(SEED[seed]);
 if (WHICH === 'before') await page.addInitScript(() => { window.__flowsOldFilter = true; });
 page.errors = [];
 page.on('pageerror', e => page.errors.push(e.message));
 await page.goto(pathToFileURL(GAME).href);
 await page.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
 await page.waitForTimeout(600);
 return page;
}

// One path, pressed by keys (and counted for the mouse alongside).
async function run(browser, p) {
 const page = await open(browser, p.seed);
 let keys = 0, clicks = 0, note = '';
 try {
  for (const step of p.steps) {
   const f = await focusables(page);
   let ix = await target(page, step);
   if (ix === null) throw Error(`no ${JSON.stringify(step)} on screen`);
   clicks++;
   const route = f && ix >= 0 ? arrows(f.rects, f.focus, ix) : null;
   if (route) {
    for (const d of route) { await page.keyboard.press(KEY[d]); await page.waitForTimeout(60); }
    keys += route.length + 1;
    await page.keyboard.press('Enter');
   } else {
    // Not reachable by arrows from here: counted, and pressed as a click so
    // the rest of the path can still be measured.
    note += ` [${JSON.stringify(step)} not reachable by arrows]`;
    keys = NaN;
    await page.evaluate(step => { const shown = e => e && e.offsetParent !== null; const el = typeof step === 'string' ? [...document.querySelectorAll(step)].find(shown) : step.last ? [...document.querySelectorAll('#drawer .sx-steps .sx-step')].filter(shown).pop() : [...document.querySelectorAll('button')].find(b => shown(b) && [].concat(step.text).some(w => b.textContent.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(w.toLowerCase()))); el.click(); }, step);
   }
   await page.waitForTimeout(700);
  }
  await page.waitForFunction(ARRIVE[p.arrive], null, {timeout: 90000});
  return {mode: p.mode, clicks, keys, ok: true, note: note.trim(), errors: page.errors.slice(0, 2)};
 } catch (e) {
  // Where it ended up, so a failure says what the player would be looking at.
  const at = await page.evaluate(() => JSON.stringify({menu: !document.getElementById('mainMenu').hidden, sheet: document.getElementById('drawer').hidden ? null : document.getElementById('drawer').dataset.panel, growing: document.getElementById('generating').hidden === false, swing: window.lab?.state?.().canSwing, focus: document.activeElement?.id || document.activeElement?.textContent?.trim().slice(0, 30)})).catch(() => '');
  return {mode: p.mode, clicks, keys, ok: false, note: (note + ' ' + e.message.split('\n')[0] + ' at ' + at).trim(), errors: page.errors.slice(0, 2)};
 } finally { await page.context().close(); }
}

const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const out = [];
try {
 for (const p of PATHS[WHICH].filter(p => !ONLY || ONLY.some(o => p.mode.toLowerCase().includes(o.toLowerCase())))) {
  const r = await run(browser, p);
  out.push(r);
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.mode.padEnd(22)} mouse ${String(r.clicks).padStart(2)}  keys ${String(r.keys).padStart(3)}  ${r.note}${r.errors.length ? ' errors: ' + r.errors.join(' | ') : ''}`);
 }
} finally { await browser.close(); }
const file = path.join('bench', 'shots', 'ui-flows', `${WHICH}-${path.basename(path.dirname(GAME))}.json`);
fs.mkdirSync(path.dirname(file), {recursive: true});
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`\n${file}`);
process.exit(out.every(r => r.ok) ? 0 : 1);
