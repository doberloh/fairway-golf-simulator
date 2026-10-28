// THE WIND IN STILLS (the cartoon overhaul's lighting rounds): one camera, a
// windy course, a picture every `--every` seconds, laid side by side -- how
// far crowns and grass move between frames, and whether a gust crosses the
// view as a front, which a single still cannot show.
//
//   node tools/capture/wind-sequence.mjs <label> <biome> [--wind 22] [--frames 6] [--every 0.7] [--cam <json>]
//
// Pictures: bench/shots/overhaul/<label>/<biome>/wind-<n>.jpg, and a sheet in
// bench/shots/overhaul/compare/. Goes through the GPU gate (the overhaul's
// limits) and is logged, like overhaul.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, save, HIDE_HUD, hourFor, hideBallAndAim} from './capture.mjs';
import {gpuGate, logRun, readCard} from '../gpu-gate.mjs';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const wind = Number(opt('--wind', 22)), frames = Number(opt('--frames', 6)), every = Number(opt('--every', .7));
// `--cam '{"hole":1,"fromPin":14,"around":40,"height":2,"pitch":3}'`: another
// camera (window.lab.camera's fields) -- the flag against the trees, say.
const cam = JSON.parse(opt('--cam', 'null')) || {hole: 1, fromPin: 95, around: 130, height: 12, pitch: -6};
const [label, biome] = argv;
if (!label || !biome) throw Error('usage: node tools/capture/wind-sequence.mjs <label> <biome> [--wind 22] [--frames 6] [--every 0.7]');
const dir = path.join('bench', 'shots', 'overhaul', label, biome);
fs.mkdirSync(dir, {recursive: true});
const card = gpuGate({goal: 'cartoon-overhaul', cap: Infinity, restMin: 1, utilMax: 30, tempMax: 80, lookSeconds: 30});
const started = new Date().toISOString();
const b = await launch();
let result = 'ok';
try {
 const p = await openGame(b, {width: 1600, height: 900, density: 1});
 await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed: 'overhaul', wind});
 await p.addStyleTag({content: HIDE_HUD});
 await p.evaluate(([at, cam]) => { const v = window.__view; v.daylight.hour = at; v.daylight.rate = 0;
  window.lab.camera(cam); }, [hourFor(biome, 'afternoon'), cam]);
 await hideBallAndAim(p);
 await p.waitForTimeout(2500);
 for (let i = 0; i < frames; i++) {
  await save(p, [{file: path.join(dir, `wind-${i + 1}.jpg`), width: 1600, quality: .88}]);
  await p.waitForTimeout(every * 1000);
 }
 await p.context().close();
} catch (e) { result = String(e.message).split('\n')[0]; throw e; } finally {
 await b.close();
 logRun({goal: 'cartoon-overhaul', what: `wind sequence ${label} ${biome} ${wind} mph`, started, before: card, after: readCard(), result});
}
console.log(`${dir}: ${frames} frames, ${every} s apart, ${wind} mph`);
