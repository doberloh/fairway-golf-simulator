#!/usr/bin/env node
// THE HOME-SCREEN ICONS, DRAWN FROM THE LOGO THAT IS ALREADY IN THE PAGE.
//
//   node tools/make-icons.mjs        writes public/*.png
//
// The flag is the same stroked path as the brandmark in index.html -- the
// project's own drawing, so nothing here needs a credit. The one addition is a
// light-green dot at the flag's foot: the full stop from the "fairway."
// wordmark, sitting where a ball would.
//
// Rendered by the headless browser Playwright already provides for the smoke
// test and the profiler, so no image library is added to the project just to
// turn one SVG into four PNGs. The PNGs are committed; this only needs running
// again if the mark changes.
//
// WHAT EACH ONE IS FOR
//   apple-touch-icon.png  180 px  what an iPhone puts on the home screen. iOS
//                                  rounds the corners itself, so it is drawn
//                                  full-bleed, square.
//   icon-192.png          192 px  the manifest's small icon (Android, Chrome)
//   icon-512.png          512 px  the manifest's large icon
//   icon-maskable.png     512 px  the same, with the mark inside the central
//                                  80% "safe zone" -- Android crops maskable
//                                  icons to a circle or a squircle, and a mark
//                                  drawn edge to edge loses its corners.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');
fs.mkdirSync(OUT, {recursive: true});

// The game's own colours: the theme green and the deep ground behind it, the
// cream the HUD writes in, and the brand dot's light green.
const DEEP = '#0f2419', THEME = '#234d3a', CREAM = '#eef3e6', DOT = '#a8c98a';

// The mark's own extent inside its 32-unit box is 4 to 25 across and 6 to
// 27.6 down, so its middle sits 1.5 units left of the box's middle and 0.8
// below it. Drawn as-is it looked left-heavy on a home screen; the extra
// translate centres the drawing itself rather than the box around it.
//
// `scale` is how much of the tile the 32-unit logo box fills. 0.62 reads well
// at 180 px on a home screen; 0.46 keeps the maskable one inside the safe zone.
const svg = (size, scale) => {
 const box = size * scale, off = (size - box) / 2;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="${THEME}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(${off} ${off}) scale(${box / 32}) translate(1.5 -0.8)">
   <path d="M8 26V6l17 5-17 6M4 27h12" fill="none" stroke="${CREAM}" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round"/>
   <circle cx="21.5" cy="25.6" r="1.9" fill="${DOT}"/>
  </g></svg>`;
};

const ICONS = [
 ['apple-touch-icon.png', 180, 0.62],
 ['icon-192.png', 192, 0.62],
 ['icon-512.png', 512, 0.62],
 ['icon-maskable.png', 512, 0.46],
];

const browser = await chromium.launch({headless: true});
const page = await browser.newPage();
for (const [name, size, scale] of ICONS) {
 await page.setViewportSize({width: size, height: size});
 await page.setContent(`<html><body style="margin:0;background:#000">${svg(size, scale)}</body></html>`);
 await page.locator('svg').screenshot({path: path.join(OUT, name), omitBackground: false});
 console.log(`wrote public/${name}  ${size}x${size}`);
}
await browser.close();

// The favicon, as an SVG data URL, printed rather than written: it lives
// INLINE in index.html so the page carries its own tab icon and never asks a
// server for /favicon.ico -- which a browser otherwise does on its own, and
// which on a host with no such file is a 404 in the console.
const fav = svg(32, 0.86).replace(/\s+/g, ' ').replace(/"/g, "'");
console.log(`\nfavicon for index.html:\n<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(fav).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%22/g, "'")}">`);
