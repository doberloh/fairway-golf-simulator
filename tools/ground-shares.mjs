// WHAT A COURSE IS MADE OF, by ground type (the cartoon overhaul).
//
//   node tools/ground-shares.mjs [biome ...] [--seed s] [--holes 9]
//
// Samples every 6 m of a generated course and prints the share of each
// surface -- fairway, rough, and the overhaul's ground types (grounds.js) --
// with the time the course took to build. Run it after a landform recipe
// changes, to see that each landscape got the ground it was asked for and no
// more: a mountain with no rock, or a desert that is all hardpan to the
// fringe, shows here before it shows in a picture.
import {generateWorld} from '../src/course.js';
import {BIOMES} from '../src/biomes.js';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seed = opt('--seed', 'overhaul'), holes = Number(opt('--holes', 9));
for (const biome of argv.length ? argv : Object.keys(BIOMES)) {
 const t0 = performance.now();
 const w = generateWorld({seed, biome, holes, trees: 60, homes: true});
 const ms = performance.now() - t0, shares = {};
 let n = 0;
 for (let x = -w.halfX; x < w.halfX; x += 6) for (let z = -w.halfZ; z < w.halfZ; z += 6) { const s = w.surface(x, z); shares[s] = (shares[s] || 0) + 1; n++; }
 const line = Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / n).toFixed(1)}%`).join(', ');
 console.log(`${biome.padEnd(10)} ${(ms / 1000).toFixed(2)} s  ${line}`);
}
