#!/usr/bin/env node
// EVERY LANDSCAPE, TWO BUILDS, ONE TABLE (the frame-rate pass, 13 November
// 2026; the owner: "improve the framerates of all of our landscapes").
// tools/frame-ab.mjs compares two builds on one landscape and tier; this runs
// it for each landscape and each tier asked for, one after another through
// the card's gate, and prints what each came to -- card time and the whole
// frame, B against A, at each spot -- as it goes and as a table at the end.
//
//   node tools/frame-sweep.mjs --goal surroundings --a bench/ab/base-0914.html --b dist/index.html
//        [--tiers high,ultra] [--biomes mountains,parkland] [--spots tee1,flyhigh]
//        [--rounds 2] [--label sweep] [--util 30 --temp 75 --rest 1]
//        [--settle 600 --frames 400]   frames drawn before timing, and timed
//   node tools/frame-sweep.mjs --table --label sweep [--tiers ...] [--biomes ...]
//        the table again from the saved runs, starting nothing
//
// Each run is saved by frame-ab as bench/ab/<label>-<biome>-<tier>.json (not
// committed). A run already saved is not made again unless --again is given,
// so a sweep that was stopped carries on where it stopped.
//
// CARD TIME AT FULL CLOCK ("work"). This card picks its clock from how hard it
// is pushed, so raw card time does not fall when a frame gets lighter: the
// card slows down instead (frame-ab.mjs, cardDuring). Where a run recorded the
// clock, the row and the tier's mean give card time x clock / top clock, which
// repeated to 1 or 2% between rounds where the raw figure moved by 30. Raw
// card time and the whole frame are printed beside it: they are what this
// machine did, in the power mode it was in.
// (14 November 2026: neither figure is safe from one or two rounds. A load of
// either build runs card-bound or held up on the processor's side, at up to
// twice the frame; run with --rounds 4 and read frame-ab's best-load line.)
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {BIOMES} from '../src/biomes.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback; };
const LABEL = flag('label', 'sweep'), TIERS = String(flag('tiers', 'high,ultra')).split(',');
const all = Object.keys(BIOMES).filter(k => BIOMES[k].studio !== false && !BIOMES[k].hidden);
const NAMED = flag('biomes', null), LANDSCAPES = NAMED ? String(NAMED).split(',') : all;
const SPOTS = String(flag('spots', 'tee1,flyhigh')), saved = (b, t) => path.join(ROOT, 'bench', 'ab', `${LABEL}-${b}-${t}.json`);

// One run's row: for each spot, card time and the whole frame, A to B.
export function rowOf(j) {
 const out = {};
 for (const [spot, s] of Object.entries(j.summary)) {
  out[spot] = {gpuA: s.A.gpu, gpuB: s.B.gpu, pageA: s.A.page, pageB: s.B.page, drawsA: s.A.draws, drawsB: s.B.draws, trisA: s.A.tris, trisB: s.B.tris,
   workA: s.A.gpuFull ?? null, workB: s.B.gpuFull ?? null, clockA: s.A.clock ?? null, clockB: s.B.clock ?? null};
 }
 const med = xs => { const v = xs.slice().sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
 out.load = {a: med(j.results.A.map(r => r.loadMs)) / 1000, b: med(j.results.B.map(r => r.loadMs)) / 1000};
 return out;
}
const pct = (a, b) => `${((b - a) / a * 100 >= 0 ? '+' : '') + ((b - a) / a * 100).toFixed(0)}%`;
export function line(biome, tier, row) {
 const spots = Object.keys(row).filter(k => k !== 'load');
 return `${(BIOMES[biome]?.name ?? biome).padEnd(24)} ${tier.padEnd(6)} ` + spots.map(k => `${k}: ` + (row[k].workA != null && row[k].workB != null ? `work ${row[k].workA.toFixed(2)}->${row[k].workB.toFixed(2)} ms (${pct(row[k].workA, row[k].workB)}) at ${Math.round(row[k].clockA)}/${Math.round(row[k].clockB)} MHz, ` : '') + `card ${row[k].gpuA.toFixed(2)}->${row[k].gpuB.toFixed(2)} ms (${pct(row[k].gpuA, row[k].gpuB)}), frame ${pct(row[k].pageA, row[k].pageB)}, draws ${Math.round(row[k].drawsA)}->${Math.round(row[k].drawsB)}`).join(' | ') +
  ` | load ${row.load.a.toFixed(1)}->${row.load.b.toFixed(1)} s`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tools', 'frame-sweep.mjs')) {
 const only = !!flag('table', false), again = !!flag('again', false), rows = [];
 for (const tier of TIERS) for (const biome of LANDSCAPES) {
  const file = saved(biome, tier);
  if (!only && (again || !fs.existsSync(file))) {
   const args = ['tools/frame-ab.mjs', '--goal', String(flag('goal', '')), '--cap', '1000', '--util', String(flag('util', 30)), '--temp', String(flag('temp', 75)), '--rest', String(flag('rest', 1)),
    '--a', String(flag('a')), '--b', String(flag('b')), '--rounds', String(flag('rounds', 2)), '--biome', biome, '--tier', tier, '--spots', SPOTS, '--label', `${LABEL}-${biome}-${tier}`,
    ...(flag('settle', null) ? ['--settle', String(flag('settle'))] : []), ...(flag('frames', null) ? ['--frames', String(flag('frames'))] : [])];
   const r = spawnSync(process.execPath, args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20});
   if (r.status !== 0 || !fs.existsSync(file)) { console.log(`${biome} ${tier}: the run failed -- ${(r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-2).join(' / ')}`); continue; }
  }
  if (!fs.existsSync(file)) continue;
  const row = rowOf(JSON.parse(fs.readFileSync(file, 'utf8')));
  rows.push([biome, tier, row]);
  console.log(line(biome, tier, row));
 }
 // What it came to, over every run: the mean change at each spot.
 for (const tier of TIERS) {
  const mine = rows.filter(r => r[1] === tier);
  if (!mine.length) continue;
  const spots = Object.keys(mine[0][2]).filter(k => k !== 'load');
  const mean = f => mine.reduce((a, r) => a + f(r[2]), 0) / mine.length;
  const worked = mine.every(r => spots.every(k => r[2][k].workA != null && r[2][k].workB != null));
  console.log(`\n${tier}, ${mine.length} landscapes: ` + spots.map(k => `${k} ` + (worked ? `work ${(mean(r => (r[k].workB - r[k].workA) / r[k].workA) * 100).toFixed(0)}% (worst ${Math.max(...mine.map(r => (r[2][k].workB - r[2][k].workA) / r[2][k].workA * 100)).toFixed(0)}%), ` : '') + `card ${(mean(r => (r[k].gpuB - r[k].gpuA) / r[k].gpuA) * 100).toFixed(0)}%, frame ${(mean(r => (r[k].pageB - r[k].pageA) / r[k].pageA) * 100).toFixed(0)}% (worst ${Math.max(...mine.map(r => (r[2][k].pageB - r[2][k].pageA) / r[2][k].pageA * 100)).toFixed(0)}%)`).join('; ') +
   `; load ${mean(r => r.load.b - r.load.a) >= 0 ? '+' : ''}${mean(r => r.load.b - r.load.a).toFixed(2)} s`);
 }
}
