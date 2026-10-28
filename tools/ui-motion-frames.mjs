#!/usr/bin/env node
// THE MENUS' MOTION, FRAME BY FRAME (the 1.0 polish; docs/UI_POLISH.md,
// *Animation*, round 4): each animation stopped at fixed moments and pictured,
// so a jump, a flicker or a piece arriving out of step shows on a contact
// sheet (tools/capture/contact-sheet.mjs), which timings alone do not show.
//   node tools/ui-motion-frames.mjs [--out r4]  -> bench/shots/ui-motion/<out>/frames/<what>-<ms>.png
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve('bench/shots/ui-motion', opt('out', 'latest'), 'frames');
fs.mkdirSync(OUT, {recursive: true});
const TIMES = [0, 45, 90, 135, 180, 220];
const b = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await (await b.newContext({viewport: {width: 1280, height: 720}})).newPage();
await p.addInitScript(() => { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0, textSize: 100})); localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pa', profiles: [{id: 'pa', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]})); });
await p.goto(pathToFileURL(path.resolve('bench/shots/dist-exp/index.html')).href);
await p.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
await p.waitForTimeout(800);
// Stop every interface animation at `ms` (the pictures' fade and the game's own left alone).
const at = ms => p.evaluate(ms => { for (const a of document.getAnimations()) if (/ui-|transform|scale/.test(a.animationName || a.transitionProperty || '')) { a.pause(); a.currentTime = ms; } }, ms);
const film = async (what, start) => {
 for (const ms of TIMES) { await start(); await at(ms); await p.waitForTimeout(60); await p.screenshot({path: path.join(OUT, `${what}-${String(ms).padStart(3, '0')}.png`)}); await reset(); }
};
const reset = async () => { for (let i = 0; i < 4 && await p.evaluate(() => document.getElementById('mainMenu').hidden || !document.getElementById('drawer').hidden); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); } await p.evaluate(() => { document.getElementById('versionNotice').hidden = true; for (const a of document.getAnimations()) a.finish?.(); }); };
await film('sheet', () => p.evaluate(() => document.getElementById('menuPlay').click()));
await film('box', () => p.evaluate(() => { document.getElementById('versionNotice').hidden = false; }));
await film('cursor', async () => { await p.focus('#menuPlay'); await p.keyboard.press('ArrowDown'); });
await b.close();
console.log(OUT);
