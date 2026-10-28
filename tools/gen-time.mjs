// HOW LONG A PLAYER WAITS FOR A COURSE, per landscape (the cartoon overhaul,
// 25 October 2026).
//
//   node tools/gen-time.mjs                 every landscape, 18 holes, 3 seeds
//   node tools/gen-time.mjs mountain links  some of them
//   node tools/gen-time.mjs --holes 9 --seeds 5 --json out.json
//
// Generation here is one Node process doing the whole course in order -- the
// game spreads the ground grid over workers (gen-pool.js), so the browser's
// wait is shorter than this by about the share the grid takes. The number to
// compare is this one against itself, before and after a change: the overhaul
// may make generation slower (the owner allows it), and this is how it says by
// how much. Each landscape runs in a fresh process so one cannot warm the next.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {BIOMES} from '../src/biomes.js';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const holes = Number(opt('--holes', 18)), seeds = Number(opt('--seeds', 3)), json = opt('--json', null);

if (argv[0] === '--one') {
 // The child: one landscape, timed course by course.
 const {generateWorld} = await import('../src/course.js');
 const [, biome, h, n] = argv;
 const times = [];
 for (let i = 0; i < Number(n); i++) {
  const t0 = performance.now();
  generateWorld({seed: `gen-time-${i + 1}`, biome, holes: Number(h), trees: 60, homes: true});
  times.push(performance.now() - t0);
 }
 process.stdout.write(JSON.stringify(times));
 process.exit(0);
}

const biomes = argv.length ? argv : Object.keys(BIOMES);
const self = fileURLToPath(import.meta.url), rows = {};
for (const biome of biomes) {
 if (!BIOMES[biome]) throw Error(`unknown landscape "${biome}"`);
 const times = JSON.parse(execFileSync(process.execPath, [self, '--one', biome, String(holes), String(seeds)], {encoding: 'utf8', maxBuffer: 1 << 24}));
 const sorted = [...times].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
 rows[biome] = {median: +median.toFixed(0), min: +sorted[0].toFixed(0), max: +sorted.at(-1).toFixed(0)};
 console.log(`${biome.padEnd(10)} ${holes} holes  median ${(median / 1000).toFixed(2)} s  (${(sorted[0] / 1000).toFixed(2)}-${(sorted.at(-1) / 1000).toFixed(2)} s over ${seeds})`);
}
if (json) fs.writeFileSync(json, JSON.stringify({holes, seeds, at: new Date().toISOString(), rows}, null, 1));
