#!/usr/bin/env node
// A GENERATED COURSE AGAINST ITS FROZEN COPY (the course builder, stage 1;
// docs/COURSE_BUILDER.md, *The game: a world from a file*).
//
//   node tools/freeze-compare.mjs                     every landscape, one 9-hole seed
//   node tools/freeze-compare.mjs midwest links       some of them
//   node tools/freeze-compare.mjs --holes 18 --seeds 2 --golf
//   node tools/freeze-compare.mjs --set creeks=2 --set lakes=1
//   node tools/freeze-compare.mjs --json out.json
//
// Generates a course, freezes it (freeze.js), writes and reads the file
// (course-doc.js), builds the world from it (built-world.js) and compares the
// two worlds the way a ball meets them: the surface at every 2 m over the
// property (the share that agrees, and what the rest became), the ground's
// height (median, 95th and 99th percentile, worst, and on greens), every
// hole's par and yards, the trees, and with --golf the virtual golfer's
// strokes on both (tests/virtual-golfer.mjs, the round's own rules). The
// numbers it prints are what tests/freeze.test.mjs holds.
import {generateWorld, BIOMES, DEFAULT_COURSE} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {worldFromDoc} from '../src/built-world.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {BUILT_VERSION} from '../src/settings-schema.js';
import {Round} from '../src/game.js';
import {virtualGolfer} from '../tests/virtual-golfer.mjs';
import {writeFileSync} from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = name => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
const holesN = Number(opt('--holes', 9)), seeds = Number(opt('--seeds', 1)), json = opt('--json', null), golf = flag('--golf');
const set = {};
for (let i = argv.indexOf('--set'); i >= 0; i = argv.indexOf('--set')) { const [k, v] = argv[i + 1].split('='); set[k] = isNaN(+v) ? v : +v; argv.splice(i, 2); }
const biomes = argv.length ? argv : Object.keys(BIOMES);

const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export async function compare(settings, {golfRounds = golf} = {}) {
 const t0 = performance.now();
 const w = generateWorld(settings);
 const t1 = performance.now();
 const doc = freezeWorld(w, {name: `${settings.biome} ${settings.seed}`});
 const t2 = performance.now();
 const bytes = await writeBuiltFile(doc, BUILT_VERSION);
 const b = worldFromDoc(await readBuiltFile(bytes), {});
 const t3 = performance.now();
 // Surfaces over the property, every 2 m.
 let n = 0, same = 0;
 const conf = {}, count = {};
 for (let z = -w.halfZ; z < w.halfZ; z += 2) for (let x = -w.halfX; x < w.halfX; x += 2) {
  const a = w.surface(x, z), c = b.surface(x, z);
  n++; count[a] = (count[a] || 0) + 1;
  if (a === c) same++; else { const k = `${a}>${c}`; conf[k] = (conf[k] || 0) + 1; }
 }
 // Heights over the property, every 5 m, and on every green every 0.5 m.
 const err = [], greenErr = [];
 let worst = {e: 0};
 for (let z = -w.halfZ; z < w.halfZ; z += 5) for (let x = -w.halfX; x < w.halfX; x += 5) {
  const e = Math.abs(w.height(x, z) - b.height(x, z)); err.push(e);
  if (e > worst.e) worst = {e, x, z, on: w.surface(x, z)};
 }
 for (const h of w.holes) {
  const g = h.worldGreen, R = (h.greenSize ?? 15) * 1.4;
  for (let z = g.z - R; z < g.z + R; z += .5) for (let x = g.x - R; x < g.x + R; x += .5) if (w.surface(x, z) === 'green') greenErr.push(Math.abs(w.height(x, z) - b.height(x, z)));
 }
 const holes = w.holes.map((h, i) => ({n: i + 1, par: [h.par, b.holes[i].par], yards: [Math.round(h.tees.white.yards), Math.round(b.holes[i].tees.white.yards)]}));
 const out = {biome: settings.biome, seed: settings.seed, holes: w.holes.length,
  seconds: {generate: +((t1 - t0) / 1000).toFixed(1), freeze: +((t2 - t1) / 1000).toFixed(1), build: +((t3 - t2) / 1000).toFixed(1)}, fileMB: +(bytes.length / 1e6).toFixed(2),
  surfaceAgree: +(100 * same / n).toFixed(2), wrong: Object.entries(conf).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, v]) => `${k} ${(100 * v / n).toFixed(2)}%`),
  heightCm: {median: +(pct(err, .5) * 100).toFixed(1), p95: +(pct(err, .95) * 100).toFixed(1), p99: +(pct(err, .99) * 100).toFixed(1), worst: +(worst.e * 100).toFixed(0), worstOn: worst.on, worstAt: [Math.round(worst.x), Math.round(worst.z)]},
  greenCm: {median: +(pct(greenErr, .5) * 100).toFixed(2), p99: +(pct(greenErr, .99) * 100).toFixed(1), worst: +(Math.max(0, ...greenErr) * 100).toFixed(1)},
  parsDiffer: holes.filter(h => h.par[0] !== h.par[1]).length, yardsWorst: Math.max(...holes.map(h => Math.abs(h.yards[0] - h.yards[1]))), holeYards: holes.map(h => h.yards),
  trees: [w.trees.length, b.trees.length]};
 if (golfRounds) {
  // The same cups on both: a built course's pins are chosen per round
  // (stage 2), so the generated course's are copied across to compare only
  // the ground.
  w.holes.forEach((h, i) => { const bh = b.holes[i]; bh.pin = bh.toLocal(h.worldPin); bh.worldPin = h.worldPin; });
  const play = (world, skill, seed) => {
   const r = new Round({players: [{name: 'V', team: 'A'}], mode: 'stroke', holes: world.holes.length, putting: {mode: 'holeout'}, tee: 'white'});
   const g = virtualGolfer({seed, skill, settings: world.settings});
   for (let i = 0; i < world.holes.length; i++) {
    const h = world.holes[i];
    r.pars[r.hole] = h.par; if (!r.teePlaced) r.placeTee(h.tees);
    for (let guard = 0; !r.holeComplete && guard < 40; guard++) {
     if (r.relief) { r.takeRelief({spot: {...r.relief.from}, penalty: 1}, h.pin); continue; }
     const lie = h.surface(r.position.x, r.position.z), s = g.shot({hole: h, from: {...r.position}});
     r.takeShot({...s.result, puttStroke: lie === 'green', onGreen: s.result.onGreen}, h.pin);
    }
    if (!r.finished) r.nextHole();
   }
   return r.cards[0].reduce((a, c) => a + (Number.isFinite(c) ? c : 0), 0);
  };
  out.strokes = {generated: [], built: []};
  // EIGHT GOLFERS, AND A MEAN WITH ITS ERROR. One round is chaos: the club
  // flights are memoised by a rounded key (swing-meter.js, physics.js), so
  // the order rounds are played in nudges a flight by a hair, and a round
  // amplifies a hair into strokes -- the same golfer on the same generated
  // course scored 85 and 74 in two runs that differed only in what was
  // played before it. What a frozen copy owes is no difference in the mean.
  for (let k = 0; k < 8; k++) { const skill = k % 2 ? .018 : .010, seed = `golfer-${k}`; out.strokes.generated.push(play(w, skill, seed)); out.strokes.built.push(play(b, skill, seed)); }
  const d = out.strokes.built.map((v, i) => v - out.strokes.generated[i]), mean = d.reduce((x, y) => x + y, 0) / d.length;
  const se = Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / (d.length - 1) / d.length);
  out.strokes.meanDiff = +mean.toFixed(2); out.strokes.se = +se.toFixed(2);
 }
 return out;
}

if (process.argv[1]?.endsWith('freeze-compare.mjs')) {
 const all = [];
 for (const biome of biomes) for (let k = 0; k < seeds; k++) {
  const r = await compare({...DEFAULT_COURSE, ...set, seed: `FREEZE-${biome.toUpperCase()}-${k + 1}`, biome, holes: holesN});
  all.push(r);
  console.log(`${r.biome.padEnd(10)} ${r.seed.padEnd(22)} agree ${r.surfaceAgree}%  height cm med ${r.heightCm.median} p95 ${r.heightCm.p95} p99 ${r.heightCm.p99} worst ${r.heightCm.worst} (${r.heightCm.worstOn})  greens med ${r.greenCm.median} worst ${r.greenCm.worst}  yards worst ${r.yardsWorst}  trees ${r.trees.join('/')}  ${r.fileMB} MB  freeze ${r.seconds.freeze}s build ${r.seconds.build}s${r.strokes ? `  strokes ${r.strokes.generated.join(',')} vs ${r.strokes.built.join(',')} (mean ${r.strokes.meanDiff > 0 ? '+' : ''}${r.strokes.meanDiff} ± ${r.strokes.se})` : ''}`);
  console.log(`           wrong: ${r.wrong.join(', ')}`);
 }
 if (json) writeFileSync(json, JSON.stringify(all, null, 1));
}
