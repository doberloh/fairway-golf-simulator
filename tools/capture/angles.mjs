// FINDING A CAMERA: quick, small test pictures of one landscape from many
// views, at noon, for picking the one a 4K set (times.mjs, gallery.mjs) should
// use. 1280x720 at density 1 on Ultra, interface and ball hidden, a contact
// sheet at the end. Light on the graphics card (about a second a view).
//   node tools/capture/angles.mjs <biome> <seed> [holes 1,2,3]
// Writes bench/shots/media/angles/<biome>/<hole>-<view>.jpg and _contact.jpg;
// each picture's name is the view to copy into the script.
import fs from 'node:fs';
import {execSync} from 'node:child_process';
import {launch, openGame, save, HIDE_HUD, hourFor, hideBallAndAim, gpuGate} from './capture.mjs';

const [biome, seed, holesArg = '1,2,3'] = process.argv.slice(2);
if (!biome || !seed) throw Error('usage: node tools/capture/angles.mjs <biome> <seed> [holes]');
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/angles/${biome}`;
fs.rmSync(OUT, {recursive: true, force: true});
const VIEWS = [];
for (const around of [130, 170, 210]) for (const height of [22, 34]) VIEWS.push({tag: `behind-a${around}-h${height}`, cam: {fromPin: height > 30 ? 95 : 70, around, height, pitch: height > 30 ? -18 : -14}});
VIEWS.push({tag: 'tee-high', cam: h => ({hole: h, along: 0, height: 24, look: 'pin', pitch: -10})});
VIEWS.push({tag: 'mid-high', cam: h => ({hole: h, along: 120, height: 30, look: 'pin', pitch: -14})});
console.log(`card ${gpuGate(80, 1000)}% before`);
const b = await launch();
try {
 const p = await openGame(b, {width: 1280, height: 720, density: 1});
 await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed});
 for (const hole of holesArg.split(',').map(Number)) {
  await p.evaluate(h => window.lab.hole(h), hole);
  await p.waitForTimeout(5000);
  await p.addStyleTag({content: HIDE_HUD});
  for (const v of VIEWS) {
   const cam = typeof v.cam === 'function' ? v.cam(hole) : v.cam;
   await p.evaluate(([cam, at]) => { const w = window.__view; w.daylight.hour = at; w.daylight.rate = 0; window.lab.camera(cam); }, [cam, hourFor(biome, 'noon')]);
   await hideBallAndAim(p);
   await p.waitForTimeout(900);
   await save(p, [{file: `${OUT}/${hole}-${v.tag}.jpg`, width: 640, quality: .8}]);
  }
 }
} finally { await b.close(); }
execSync(`node tools/capture/contact-sheet.mjs "${OUT}" 4`, {stdio: 'inherit'});
