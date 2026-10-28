#!/usr/bin/env node
// THE MENUS' MOTION, CHECKED (the 1.0 polish; docs/UI_POLISH.md, *Animation*).
// Each animation in src/ui-motion.css, against the checklist's M1-M4:
//   M1  it runs, and lasts 100-300 ms (the picture fade excepted: ambient);
//   M3  interrupted -- Esc while a sheet arrives, two presses on Next, a box
//       closed at once -- it ends in the right state: nothing left see-through,
//       no animation still running, the keys still answering;
//   M4  with the system's reduced motion on, nothing moves at all.
// M2 (transform and opacity only) is read from the animations themselves:
// every keyframe may name only opacity, transform, translate or scale.
//
//   node tools/capture/build-hooked.mjs && node tools/ui-motion-check.mjs [--out r1]
// Writes bench/shots/ui-motion/<out>/report.json and a picture per check; exits
// non-zero on any failure.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', 'bench/shots/dist-exp/index.html'));
const OUT = path.resolve('bench/shots/ui-motion', opt('out', 'latest'));
const CHEAP = new Set(['opacity', 'transform', 'translate', 'scale', 'offset', 'easing', 'composite', 'computedOffset']);
fs.mkdirSync(OUT, {recursive: true});

async function open(browser, reduced, size = {width: 1280, height: 720}) {
 const ctx = await browser.newContext({viewport: size, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: size.width < 600});
 const p = await ctx.newPage();
 await p.addInitScript(() => { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0, textSize: 100})); localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pa', profiles: [{id: 'pa', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]})); });
 p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
 await p.goto(pathToFileURL(GAME).href);
 await p.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
 await p.waitForTimeout(800);
 return p;
}
// The animations running now (CSS animations and transitions), described.
const running = p => p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => {
 const t = a.effect?.getTiming?.() || {}, kf = a.effect?.getKeyframes?.() || [];
 const props = [...new Set(kf.flatMap(k => Object.keys(k)))];
 const el = a.effect?.target;
 return {name: a.animationName || a.transitionProperty || 'animation', duration: Number(t.duration) || 0, props, target: el ? (el.id ? '#' + el.id : el.className?.toString?.().split(' ')[0] || el.tagName) : '?'};
}).filter(a => !/pic-loop|generating|splash|sm-|spin|turn|xp|level|hole-out|monitor|read-pulse|frame-|tp-|fx-|slide|scene-shade/.test(a.target + a.name) && !(a.name === 'filter' || (a.name === 'opacity' && !/drawer|sx-|version/.test(a.target)))));
const settled = p => p.evaluate(() => {
 const d = document.getElementById('drawer');
 const vis = el => el && !el.hidden && el.checkVisibility();
 const op = el => el ? Number(getComputedStyle(el).opacity) : 1;
 const page = d.querySelector('.sx-page:not([hidden])');
 return {drawer: vis(d), drawerOpacity: op(d), pageOpacity: op(page), pageTransform: page ? getComputedStyle(page).transform : 'none', anims: document.getAnimations().filter(a => a.playState === 'running' && /ui-/.test(a.animationName || '')).length};
});

const results = [];
const check = (name, ok, detail) => { results.push({name, ok, detail}); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' -- ' + detail : ''}`); };

const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
try {
 // M1 + M2: a sheet arriving.
 let p = await open(browser, false);
 await p.evaluate(() => document.getElementById('menuPlay').click());
 const a1 = await running(p);
 const sheet = a1.filter(a => /ui-fade-in|ui-rise-in/.test(a.name));
 check('a sheet comes in (fade and rise)', sheet.length >= 2, sheet.map(a => `${a.name} ${a.duration} ms on ${a.target}`).join(', '));
 for (const a of sheet) check(`  ${a.name} lasts 100-300 ms`, a.duration >= 100 && a.duration <= 300, `${a.duration} ms`);
 for (const a of a1) { const bad = a.props.filter(k => !CHEAP.has(k)); check(`  ${a.name} on ${a.target} animates only cheap properties`, !bad.length, bad.join(', ')); }
 await p.waitForTimeout(400);
 let s = await settled(p);
 check('after it, the sheet is whole', s.drawer && s.drawerOpacity === 1 && s.pageOpacity === 1 && s.anims === 0, JSON.stringify(s));
 // A step changing replays the rise.
 await p.evaluate(() => document.querySelector('#drawer .sx-next')?.click());
 const a2 = await running(p);
 check('a step coming in rises', a2.some(a => a.name === 'ui-rise-in'), a2.map(a => a.name).join(', '));
 // M3: two presses on Next at once, then nothing left mid-way.
 await p.evaluate(() => { const n = document.querySelector('#drawer .sx-next'); n?.click(); n?.click(); });
 await p.waitForTimeout(400);
 s = await settled(p);
 check('two presses on Next end on a whole page', s.pageOpacity === 1 && s.anims === 0 && /none|matrix\(1, 0, 0, 1, 0, 0\)/.test(s.pageTransform), JSON.stringify(s));
 await p.screenshot({path: path.join(OUT, 'next-twice.png')});
 // M3: Esc while the sheet is arriving.
 await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
 await p.waitForTimeout(300);
 await p.evaluate(() => document.getElementById('menuPlay').click());
 await p.keyboard.press('Escape');
 await p.waitForTimeout(400);
 s = await settled(p);
 const menu = await p.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('drawer').hidden);
 check('Esc while a sheet arrives leaves the main menu, nothing see-through', menu && s.anims === 0, JSON.stringify({menu, ...s}));
 // The keys still answer straight after (nothing waits for an animation).
 await p.evaluate(() => document.getElementById('menuPlay').click());
 await p.keyboard.press('ArrowRight');
 const focusMoved = await p.evaluate(() => document.activeElement?.closest?.('#drawer') != null);
 check('the arrows answer while the sheet is still arriving', focusMoved, '');
 await p.waitForTimeout(400);
 // The main menu's cursor slide and a press.
 for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
 await p.focus('#menuPlay'); await p.keyboard.press('ArrowDown');
 const a3 = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => ({name: a.transitionProperty || a.animationName, d: a.effect.getTiming().duration, el: a.effect.target?.id || a.effect.target?.className})));
 const slide = a3.find(a => a.name === 'transform' && /menu/.test(String(a.el)));
 check('the main menu cursor slides', !!slide && slide.d >= 100 && slide.d <= 300, JSON.stringify(slide || a3.slice(0, 3)));
 // A box settling in: the studio's leave notice is hard to reach here; the
 // version notice shares the rule, so the welcome box stands in.
 const boxRule = await p.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).flatMap(r => r.cssRules ? [...r.cssRules] : [r]).some(r => /version-notice/.test(r.selectorText || '') && /ui-settle-in/.test(r.cssText)));
 check('a box over the screen settles in (rule present)', boxRule, '');
 if (p.errors.length) check('no page errors', false, p.errors.slice(0, 3).join(' | '));
 await p.context().close();

 // ROUND 3: the same at a phone and at 4K; a box over the screen seen
 // settling in; a resize while a sheet arrives.
 for (const size of [{width: 390, height: 844}, {width: 3840, height: 2160}]) {
  const tag = size.width + 'x' + size.height;
  p = await open(browser, false, size);
  await p.evaluate(() => document.getElementById('menuPlay').click());
  const a = await running(p);
  check(tag + ': a sheet comes in', a.some(x => x.name === 'ui-fade-in') && a.some(x => x.name === 'ui-rise-in'), a.map(x => x.name).join(', '));
  await p.waitForTimeout(400);
  const w = await settled(p);
  check(tag + ': after it, the sheet is whole', w.drawerOpacity === 1 && w.pageOpacity === 1 && w.anims === 0, JSON.stringify(w));
  await p.screenshot({path: path.join(OUT, 'sheet-' + tag + '.png')});
  await p.context().close();
 }
 p = await open(browser, false);
 await p.evaluate(() => { const n = document.getElementById('versionNotice'); n.hidden = false; });
 const box = await p.evaluate(() => document.getAnimations().filter(a => a.animationName === 'ui-settle-in').map(a => a.effect.getTiming().duration));
 check('a box over the screen settles in, 100-300 ms', box.length === 1 && box[0] >= 100 && box[0] <= 300, JSON.stringify(box));
 await p.waitForTimeout(350);
 const boxOp = await p.evaluate(() => getComputedStyle(document.querySelector('#versionNotice>div,#versionNotice>form')).opacity);
 check('  and ends whole', boxOp === '1', boxOp);
 await p.evaluate(() => { document.getElementById('versionNotice').hidden = true; });
 await p.evaluate(() => document.getElementById('menuPlay').click());
 await p.setViewportSize({width: 844, height: 390});
 await p.waitForTimeout(450);
 const rs = await settled(p);
 check('a resize while a sheet arrives ends whole', rs.drawerOpacity === 1 && rs.pageOpacity === 1 && rs.anims === 0, JSON.stringify(rs));
 await p.context().close();

 // M4: reduced motion -- nothing of ours moves.
 p = await open(browser, true);
 await p.evaluate(() => document.getElementById('menuPlay').click());
 const r1 = await running(p);
 check('reduced motion: a sheet arrives without moving', !r1.some(a => /ui-/.test(a.name)), r1.map(a => a.name).join(', '));
 await p.evaluate(() => document.querySelector('#drawer .sx-next')?.click());
 const r2 = await running(p);
 check('reduced motion: a step arrives without moving', !r2.some(a => /ui-/.test(a.name)), r2.map(a => a.name).join(', '));
 for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
 await p.focus('#menuPlay'); await p.keyboard.press('ArrowDown');
 const r3 = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.transitionProperty === 'transform').length);
 check('reduced motion: the menu cursor does not slide', r3 === 0, String(r3));
 await p.context().close();
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks pass.`);
process.exit(failed ? 1 : 0);
