// The website's gallery: each landscape at two times of day, plus floodlit
// nights, interface hidden, into site/media/gallery/ (1600x900 and a 640 thumb).
// Needs the capture build first: node tools/site-media/build-hooked.mjs
//   node tools/site-media/gallery.mjs [name...]     (no names: all of them)
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const OUT = 'site/media/gallery';
fs.mkdirSync(OUT, {recursive: true});
const behind = {fromPin: 70, around: 170, height: 22, pitch: -14};
const tee = h => ({hole: h, along: 0, height: 9, look: 'pin', pitch: -6});
export const SHOTS = [
 {name: 'sitka-bluff-morning', biome: 'pnw', seed: 'CEDAR', hole: 1, hour: 8.2, cam: behind},
 {name: 'sitka-bluff-evening', biome: 'pnw', seed: 'CEDAR', hole: 3, hour: 17.8, cam: tee(3)},
 {name: 'vermilion-basin-golden', biome: 'desert', seed: 'MESA', hole: 1, hour: 17.8, cam: behind},
 {name: 'vermilion-basin-midday', biome: 'desert', seed: 'MESA', hole: 2, hour: 12.6, cam: tee(2)},
 {name: 'alpine-reserve-morning', biome: 'mountain', seed: 'SUMMIT', hole: 1, hour: 8.2, cam: tee(1)},
 {name: 'alpine-reserve-afternoon', biome: 'mountain', seed: 'SUMMIT', hole: 4, hour: 15.1, cam: {...behind, around: 205, height: 28}},
 {name: 'north-sea-links-golden', biome: 'links', seed: 'DUNE', hole: 1, hour: 17.8, cam: behind},
 {name: 'north-sea-links-morning', biome: 'links', seed: 'DUNE', hole: 2, hour: 7.3, cam: tee(2)},
 {name: 'prairie-run-midday', biome: 'midwest', seed: 'MEADOW', hole: 1, hour: 12.6, cam: behind},
 {name: 'prairie-run-evening', biome: 'midwest', seed: 'MEADOW', hole: 3, hour: 17.8, cam: tee(3)},
 {name: 'leeward-cay-afternoon', biome: 'island', seed: 'LAGOON', hole: 1, hour: 16.5, cam: {...behind, around: 150}},
 {name: 'leeward-cay-morning', biome: 'island', seed: 'LAGOON', hole: 2, hour: 10.5, cam: {hole: 2, along: 18, height: 13, look: 'pin', pitch: -8}},
 {name: 'cathedral-grove-morning', biome: 'redwood', seed: 'GIANT', hole: 1, hour: 10.5, cam: tee(1)},
 {name: 'cathedral-grove-afternoon', biome: 'redwood', seed: 'GIANT', hole: 2, hour: 16.5, cam: {hole: 2, along: 30, height: 5, look: 'pin', pitch: -3}},
 {name: 'copper-hollow-afternoon', biome: 'autumn', seed: 'MAPLE', hole: 1, hour: 15.1, cam: behind},
 {name: 'copper-hollow-golden', biome: 'autumn', seed: 'MAPLE', hole: 2, hour: 17.8, cam: tee(2)},
 {name: 'night-north-sea-links', biome: 'links', seed: 'DUNE', hole: 3, hour: 22, flood: true, cam: {...behind, height: 16}},
 {name: 'night-sitka-bluff', biome: 'pnw', seed: 'CEDAR', hole: 2, hour: 21.5, flood: true, cam: tee(2)},
];
const want = process.argv.slice(2);
const b = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
for (const s of SHOTS.filter(s => !want.length || want.includes(s.name))) {
 const p = await (await b.newContext({viewport: {width: 1600, height: 900}})).newPage();
 await p.addInitScript(() => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'ultra', autoResolution: false, frameCap: 0, textSize: 100})));
 await p.goto(pathToFileURL(path.resolve('bench/shots/dist-exp', 'index.html')).href);
 await p.waitForFunction(() => window.lab && window.__view && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
 await p.evaluate(c => window.lab.course(c), {biome: s.biome, holes: 9, seed: s.seed});
 await p.evaluate(h => window.lab.hole(h), s.hole);
 await p.waitForTimeout(7000);
 await p.addStyleTag({content: '#world>*:not(#scene){display:none!important}header.topbar{display:none!important}'});
 await p.evaluate(([s]) => {
  const v = window.__view; v.daylight.hour = s.hour; v.daylight.rate = 0;
  if (s.flood) v.setFloodlights(true);
  for (const o of [v.aimLine, v.aimRing, v.ballRing]) if (o) o.visible = false;
  window.lab.camera(s.cam);
 }, [s]);
 await p.waitForTimeout(s.flood ? 4000 : 2600);
 const full = await p.screenshot({type: 'jpeg', quality: 80});
 fs.writeFileSync(`${OUT}/${s.name}.jpg`, full);
 // The thumbnail, scaled in the browser (there is no image library here).
 const thumb = await p.evaluate(async src => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  c.getContext('2d').drawImage(img, 0, 0, 640, 360);
  return c.toDataURL('image/jpeg', .78).split(',')[1];
 }, 'data:image/jpeg;base64,' + full.toString('base64'));
 fs.writeFileSync(`${OUT}/${s.name}-thumb.jpg`, Buffer.from(thumb, 'base64'));
 console.log(s.name, (full.length / 1024).toFixed(0) + ' KB');
 await p.close();
}
await b.close();
