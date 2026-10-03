// What every website capture shares: the browser, the game on Ultra, and how a
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
 const at = {dawn: SUNRISE + .7, morning: morning(18), noon: (SUNRISE + SUNSET) / 2, afternoon: evening(32), golden: evening(5), night: 22}[when];
 if (at === undefined) throw Error(`unknown time of day "${when}"`);
 return at;
}

export const launch = () => chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});

// The game, opened to its main menu on Ultra with automatic resolution off, so
// it can never quietly draw fewer pixels to keep the frame rate up.
export async function openGame(browser, {width = 1920, height = 1080, density = 2} = {}) {
 if (!fs.existsSync(GAME)) throw Error('No capture build. Run: node tools/site-media/build-hooked.mjs');
 const page = await (await browser.newContext({viewport: {width, height}, deviceScaleFactor: density})).newPage();
 page.errors = [];
 page.on('pageerror', e => page.errors.push(e.message));
 page.on('console', m => m.type() === 'error' && page.errors.push(m.text().slice(0, 160)));
 await page.addInitScript(() => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'ultra', autoResolution: false, frameCap: 0, textSize: 100})));
 await page.goto(pathToFileURL(GAME).href);
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
