// What every capture of the game shares: the browser, the game on Ultra, and how a
// picture is saved.
//
// RESOLUTION IS THE WHOLE POINT OF THIS FILE. The game never draws more pixels
// than the screen's pixel density allows (`pixelCeiling` in renderer.js: the
// lesser of devicePixelRatio and the tier's own ratio, which is 2 on Ultra).
// The first set of website pictures was taken on a density-1 page, so Ultra was
// on and the pictures were still drawn at plain 1x -- soft edges, visible
// stair-steps, and they looked it. Here the page has density 2: a 1920x1080
// page renders 3840x2160, and saving it at 2560x1440 scales it down, which is
// what makes the edges clean.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {hourForElevation, peakElevation, SUNRISE, SUNSET} from '../../src/daylight.js';
import {BIOMES} from '../../src/biomes.js';

export const GAME = path.resolve('bench/shots/dist-exp', 'index.html');

// A TIME OF DAY IS A SUN HEIGHT, NOT A CLOCK READING. The game's warm light
// follows the sun's elevation (`warmth` in daylight.js builds below 26 degrees
// and peaks at the horizon), and each biome's sun climbs to a different noon,
// so a fixed clock time is a different light in every landscape. The first
// website set took "golden hour" at 5:48 PM: the sun was still 19 degrees up,
// which is plain afternoon, and the owner spotted it on the links picture.
// `dawn` is the one keyed by clock: the morning mist is (mistAmount), thickest
// at first light and burnt off about three hours later.
export function hourFor(biome, when) {
 const peak = peakElevation(BIOMES[biome].sun), evening = e => hourForElevation(e, peak), morning = e => SUNRISE + SUNSET - evening(e);
 const at = {dawn: SUNRISE + .7, morning: morning(18), noon: (SUNRISE + SUNSET) / 2, afternoon: evening(32), golden: evening(5), dusk: evening(-1.5), night: 22}[when];
 if (at === undefined) throw Error(`unknown time of day "${when}"`);
 return at;
}

export const launch = () => chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});

// The game, opened to its main menu on Ultra with automatic resolution off, so
// it can never quietly draw fewer pixels to keep the frame rate up. `quality`
// picks a lighter tier for clips that study the ball rather than the scenery.
// `virtualClock` puts the stepped clock in before the game starts (record.mjs:
// frame-by-frame clips); `shots` stores pictures for `saveStill`.
export async function openGame(browser, {width = 1920, height = 1080, density = 2, game = GAME, quality = 'ultra', virtualClock = false} = {}) {
 if (!fs.existsSync(game)) throw Error(`No capture build at ${game}. Run: node tools/capture/build-hooked.mjs`);
 const page = await (await browser.newContext({viewport: {width, height}, deviceScaleFactor: density})).newPage();
 if (virtualClock) await page.addInitScript((await import('./record.mjs')).virtualClock);
 page.errors = [];
 page.on('pageerror', e => page.errors.push(e.message));
 page.on('console', m => m.type() === 'error' && page.errors.push(m.text().slice(0, 160)));
 await page.addInitScript(q => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: q, autoResolution: false, frameCap: 0, textSize: 100})), quality);
 // A named player, or the first-visit welcome sits over every picture.
 // In the profile store's own current format (3): an older one is upgraded on
 // load and the upgrade announces "New: XP and levels" over every picture
 // (seen 18 October 2026). A golfer with a name a seat can show and some XP,
 // so the profile, the seats and the golfer chips look played-in.
 await page.addInitScript(() => { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pfair', profiles: [{id: 'pfair', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}, {id: 'psam', name: 'Sam', created: Date.now(), xp: 3100, counters: {}, bests: {}, rounds: []}, {id: 'pjo', name: 'Jordan', created: Date.now(), xp: 18800, counters: {}, bests: {}, rounds: []}]})); });
 await page.goto(pathToFileURL(game).href);
 await page.waitForFunction(() => window.lab && window.__view && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
 return page;
}

// Fails the capture rather than saving a picture taken below Ultra or at 1x.
// A clip passes 1: it is recorded from the canvas itself, so the canvas is
// sized to the video (1920x1080) rather than drawn large and scaled down.
export async function assertUltra(page, minRatio = 2) {
 const r = await page.evaluate(() => ({shadow: window.__view.quality?.shadow?.size, ratio: window.__view.renderer.getPixelRatio(), scale: window.__view.resolutionScale}));
 if (r.shadow !== 6144 || r.ratio < minRatio || r.scale !== 1) throw Error(`Not rendering Ultra at full resolution: ${JSON.stringify(r)}`);
 return r;
}

export const HIDE_HUD = '#world>*:not(#scene){display:none!important}header.topbar{display:none!important}#toast{display:none!important}';

// Screenshot at full density, then scale in the browser (there is no image
// library in this toolchain) to each requested size: [{file, width, quality}].
export async function save(page, outputs) {
 const png = await page.screenshot({type: 'png'});
 const sizes = [];
 for (const {file, width, quality = .88} of outputs) {
  const b64 = await page.evaluate(async ([src, width, quality]) => {
   const img = new Image(); img.src = src; await img.decode();
   // Halve in steps rather than in one jump: a single large reduction
   // samples too few source pixels and brings the stair-steps back.
   let c = document.createElement('canvas'), w = img.width, h = img.height;
   c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0);
   while (w / 2 >= width) {
    const n = document.createElement('canvas'); n.width = w / 2; n.height = h / 2;
    const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height);
    c = n; w = n.width; h = n.height;
   }
   const out = document.createElement('canvas'); out.width = width; out.height = Math.round(width * h / w);
   const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, out.width, out.height);
   return out.toDataURL('image/jpeg', quality).split(',')[1];
  }, ['data:image/png;base64,' + png.toString('base64'), width, quality]);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  sizes.push(`${path.basename(file)} ${(b64.length * .75 / 1024).toFixed(0)} KB`);
 }
 return sizes.join(', ');
}

// A STILL AT 4K, AND THE WEBSITE'S COPIES (18 October 2026). `saveStill` keeps
// the picture the page drew as a lossless PNG master at `master` pixels wide
// (3840 for 4K), then JPEGs at each `sizes` width for the website. With the
// page at 3840x2160 CSS pixels and density 2 the game draws 7680x4320 (Ultra's
// pixel ratio is 2), and halving that to 3840 is four samples a pixel: the
// cleanest 4K edge this renderer can make. A 1920x1080 page at density 2 draws
// exactly 3840x2160, which is what a picture WITH the interface wants (the
// interface is laid out for a 1080p screen and drawn at twice the detail).
export async function saveStill(page, base, {master = 3840, sizes = [[2560, .9], [960, .84]], suffixes = ['', '-thumb']} = {}) {
 const png = await page.screenshot({type: 'png'});
 const out = await page.evaluate(async ([src, master, sizes]) => {
  const img = new Image(); img.src = src; await img.decode();
  const down = width => {
   let c = document.createElement('canvas'), w = img.width, h = img.height;
   c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0);
   while (w / 2 >= width) {
    const n = document.createElement('canvas'); n.width = w / 2; n.height = h / 2;
    const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height);
    c = n; w = n.width; h = n.height;
   }
   if (w === width) return c;
   const o = document.createElement('canvas'); o.width = width; o.height = Math.round(width * h / w);
   const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height);
   return o;
  };
  const m = down(Math.min(master, img.width));
  const res = {master: m.toDataURL('image/png').split(',')[1], size: [m.width, m.height], jpgs: []};
  for (const [w, q] of sizes) res.jpgs.push(down(w).toDataURL('image/jpeg', q).split(',')[1]);
  return res;
 }, ['data:image/png;base64,' + png.toString('base64'), master, sizes]);
 fs.mkdirSync(path.dirname(base), {recursive: true});
 const files = [`${base}.png`];
 fs.writeFileSync(`${base}.png`, Buffer.from(out.master, 'base64'));
 out.jpgs.forEach((b64, i) => { const f = `${base}${suffixes[i] ?? '-' + sizes[i][0]}.jpg`; fs.writeFileSync(f, Buffer.from(b64, 'base64')); files.push(f); });
 return `${path.basename(base)} ${out.size.join('x')} PNG + ${sizes.map(s => s[0]).join('/')} JPG`;
}

// Hides everything drawn over the course that is not the course: the ball, its
// halo and ring, the aim line and ring. With HIDE_HUD this is a pure course
// picture.
export const hideBallAndAim = page => page.evaluate(() => {
 const v = window.__view;
 for (const o of [v.aimLine, v.aimRing, v.ballRing, v.ball, v.ballHalo, v.aimPath, v.shotTrail]) if (o) o.visible = false;
});

// GPU BATCHES (the owner, 18 October 2026: long runs have crashed this
// machine). Every script takes names, so a run can be one landscape or one
// clip; `gpuGate` refuses to start while the card is busy with something else.
import {execSync} from 'node:child_process';
// It rests first (`restMs`, so batches are spaced and the card cools between
// them) and takes the lowest of three readings a second apart: the instant one
// of our own pictures finishes, the card still reads busy with OUR work.
export function gpuGate(limit = 80, restMs = 6000) {
 const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
 sleep(restMs);
 let low = Infinity;
 try {
  for (let i = 0; i < 3; i++) {
   if (i) sleep(1000);
   low = Math.min(low, Number(execSync('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', {encoding: 'utf8'}).trim().split('\n')[0]));
  }
 } catch { return null; }
 if (low > limit) throw Error(`The graphics card is ${low}% busy with something else; not starting (gpuGate).`);
 return low;
}
