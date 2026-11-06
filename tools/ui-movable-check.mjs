#!/usr/bin/env node
// THE PIECES A PLAYER MOVES STAY MOVABLE (the 1.0 polish; docs/UI_POLISH.md,
// checklist T3). In a round the map (by its header) and the shot numbers (Tab,
// the tiles) can be dragged anywhere in the playing area, and are kept there
// (main.js `dragPiece`, `drawHudPlaces`). This drags each, at every screen size
// the audit uses for its pictures plus a sideways phone and a tablet, and checks:
//   - it moved with the pointer;
//   - dragged far past the edge, it stops inside the playing area;
//   - after the window changes size it is still inside;
//   - a double click puts it back where it started.
//
//   node tools/capture/build-hooked.mjs
//   node tools/ui-movable-check.mjs                 every size
//   node tools/ui-movable-check.mjs --only 390x844
//   node tools/ui-movable-check.mjs --game bench/ab/main-ui/index.html --out main
//
// Uses the graphics card (AGENTS.md says when). Pictures and results go to
// bench/shots/ui-movable/ (not committed).
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv0 = process.argv.slice(2);
const GAME = argv0.includes('--game') ? path.resolve(ROOT, argv0[argv0.indexOf('--game') + 1]) : path.join(ROOT, 'bench', 'shots', 'dist-exp', 'index.html');
const OUT = path.join(ROOT, 'bench', 'shots', 'ui-movable', argv0.includes('--out') ? argv0[argv0.indexOf('--out') + 1] : 'now');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const SIZES = [
 {w: 1920, h: 1080}, {w: 1280, h: 720}, {w: 3840, h: 2160}, {w: 1024, h: 768, touch: true},
 // A phone keeps its own places (PLAYING.md, *Move the map and the shot
 // numbers*): there the check is that a drag leaves the map where it is.
 {w: 390, h: 844, touch: true, phone: true}, {w: 844, h: 390, touch: true, phone: true},
].filter(s => !only || `${s.w}x${s.h}` === only);
const wait = (p, ms) => p.waitForTimeout(ms);

// The piece's box and the playing area's, in screen pixels.
const boxes = (p, sel) => p.evaluate(s => {
 const el = document.querySelector(s), w = document.getElementById('world');
 if (!el || !w) return null;
 const r = el.getBoundingClientRect(), a = w.getBoundingClientRect();
 const shown = !el.hidden && r.width > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
 return {shown, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, area: {l: a.left, t: a.top, r: a.right, b: a.bottom}};
}, sel);
const inside = (b, slack = 1) => b.l >= b.area.l - slack && b.t >= b.area.t - slack && b.r <= b.area.r + slack && b.b <= b.area.b + slack;

async function drag(p, x, y, dx, dy) {
 await p.mouse.move(x, y);
 await p.mouse.down();
 for (let i = 1; i <= 8; i++) await p.mouse.move(x + dx * i / 8, y + dy * i / 8);
 await p.mouse.up();
 await wait(p, 300);
}

// One piece: `grab` is where the pointer takes it (a selector inside it).
// Where the pointer takes hold: near the left end of the map's title bar (its
// buttons are on the right), the middle of a tile for the shot numbers (their
// box has gaps between the tiles, which the course under them takes).
const hold = (p, s) => p.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? {x: r.left + (s.includes('shot-tile') ? r.width / 2 : Math.min(20, r.width / 2)), y: r.top + r.height / 2} : null; }, s);

async function check(p, name, sel, grab, {fixed = false} = {}) {
 const res = {piece: name, checks: []};
 const ok = (what, pass, note = '') => res.checks.push({what, pass: !!pass, note});
 const start = await boxes(p, sel);
 if (!start?.shown) { res.skipped = 'not shown at this size'; return res; }
 const g = await hold(p, grab);
 if (!g) { res.skipped = 'nothing to take it by'; return res; }
 // A move toward the middle of the screen, so it has room to go.
 const dx = (start.area.l + start.area.r) / 2 > start.l + start.w / 2 ? 120 : -120;
 const dy = (start.area.t + start.area.b) / 2 > start.t + start.h / 2 ? 80 : -80;
 await drag(p, g.x, g.y, dx, dy);
 const moved = await boxes(p, sel);
 if (fixed) {
  ok('stays in its own place (a phone)', Math.abs(moved.l - start.l) < 2 && Math.abs(moved.t - start.t) < 2,
   `moved ${(moved.l - start.l).toFixed(0)}, ${(moved.t - start.t).toFixed(0)}`);
  ok('inside', inside(moved));
  return res;
 }
 ok('moves with the pointer', Math.abs(moved.l - start.l - dx) < 6 && Math.abs(moved.t - start.t - dy) < 6,
  `by ${(moved.l - start.l).toFixed(0)}, ${(moved.t - start.t).toFixed(0)} for ${dx}, ${dy}`);
 ok('inside after the move', inside(moved));
 // Far past the edge: it must stop inside.
 const g2 = {x: g.x + (moved.l - start.l), y: g.y + (moved.t - start.t)};
 await drag(p, g2.x, g2.y, 4000 * Math.sign(-dx), 4000 * Math.sign(-dy));
 const far = await boxes(p, sel);
 ok('stops inside when dragged past the edge', inside(far), `at ${far.l.toFixed(0)}, ${far.t.toFixed(0)}`);
 await p.screenshot({path: path.join(OUT, `${p.sizeName}-${name}-edge.png`)});
 // The window changes size (a phone turned part-way, a desk window narrowed).
 const vp = p.viewportSize();
 await p.setViewportSize({width: Math.round(vp.width * .85), height: Math.round(vp.height * .85)});
 await wait(p, 600);
 const resized = await boxes(p, sel);
 ok('inside after the window shrinks', resized.shown ? inside(resized) : true, resized.shown ? '' : 'hidden at the smaller size');
 await p.setViewportSize(vp);
 await wait(p, 600);
 // Double click: back to where it started.
 const now = await boxes(p, sel);
 if (now.shown) {
  const g3 = await hold(p, grab);
  await p.mouse.dblclick(g3.x, g3.y);
  await wait(p, 400);
  const back = await boxes(p, sel);
  ok('a double click puts it back', Math.abs(back.l - start.l) < 3 && Math.abs(back.t - start.t) < 3,
   `${(back.l - start.l).toFixed(0)}, ${(back.t - start.t).toFixed(0)} from where it began`);
 }
 return res;
}

fs.mkdirSync(OUT, {recursive: true});
const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const results = [];
try {
 for (const size of SIZES) {
  const ctx = await browser.newContext({viewport: {width: size.w, height: size.h}, deviceScaleFactor: 1, hasTouch: !!size.touch, isMobile: !!size.touch && size.w < 1024});
  const p = await ctx.newPage();
  p.sizeName = `${size.w}x${size.h}`;
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  await p.addInitScript(() => {
   localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0}));
   if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pm', profiles: [{id: 'pm', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]}));
  });
  await p.goto(pathToFileURL(GAME).href);
  await p.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
  await p.evaluate(() => window.lab.course({biome: 'newengland', holes: 9, seed: 'MOVE'}));
  await p.waitForFunction(() => window.lab.state().canSwing && document.getElementById('mainMenu').hidden, null, {timeout: 90000});
  await wait(p, 1500);
  const row = {size: p.sizeName, pieces: []};
  // A phone's map is behind the MAP chip (28 October 2026): show it first.
  if (size.phone) { await p.evaluate(() => { const b = document.getElementById('rhMap'); if (b?.checkVisibility() && b.getAttribute('aria-pressed') !== 'true') b.click(); }); await wait(p, 400); }
  row.pieces.push(await check(p, 'map', '#world .minimap', '#world .minimap .map-header', {fixed: !!size.phone}));
  // The shot numbers: Tab shows every number as tiles.
  await p.keyboard.press('Tab');
  await wait(p, 600);
  const tiles = await p.evaluate(() => document.getElementById('world').classList.contains('rh-tiles'));
  if (tiles) row.pieces.push(await check(p, 'shot numbers', '#shotTiles', '#shotTiles .shot-tile'));
  else row.pieces.push({piece: 'shot numbers', skipped: 'Tab did not show the tiles at this size'});
  await p.screenshot({path: path.join(OUT, `${p.sizeName}-end.png`)});
  row.errors = errors;
  results.push(row);
  const line = row.pieces.map(x => x.skipped ? `${x.piece}: ${x.skipped}` : `${x.piece}: ${x.checks.filter(c => c.pass).length}/${x.checks.length}` + x.checks.filter(c => !c.pass).map(c => ` [FAIL ${c.what}${c.note ? ' -- ' + c.note : ''}]`).join('')).join('  ');
  console.log(`${p.sizeName.padEnd(10)} ${line}${errors.length ? `  ERRORS ${errors.length}: ${errors[0]}` : ''}`);
  await ctx.close();
 }
} finally {
 await browser.close();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const failed = results.some(r => r.errors.length || r.pieces.some(x => x.checks?.some(c => !c.pass)));
console.log(`\n${failed ? 'SOMETHING FAILED' : 'all pass'}; ${path.relative(ROOT, path.join(OUT, 'results.json'))}`);
process.exit(failed ? 1 : 0);
