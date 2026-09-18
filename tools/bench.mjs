#!/usr/bin/env node
// Measure the generator, over many courses, in parallel, against a baseline.
//
//   node tools/bench.mjs                          every metric, standard tier
//   node tools/bench.mjs tees blind --tier quick  two metrics, fast
//   node tools/bench.mjs --set blindTees=50       sweep one control
//   node tools/bench.mjs --save                   store this run as the baseline
//   node tools/bench.mjs --since                  print what moved since it
//
// WHY THIS EXISTS. The generator is judged by measurement -- there is no other
// way to know whether a change to the terrain made it better -- and for a long
// time each question was answered by a throwaway script that rebuilt the same
// two dozen courses for itself, single-threaded. One session spent most of an
// hour regenerating identical terrain roughly twenty-five times over. Two
// multipliers were going unused: share one generation pass between every
// metric, and use more than one of the machine's cores. Together they take a
// full sweep from minutes to seconds, which is what makes it reasonable to
// measure before AND after every change instead of only when something looks
// wrong.
import {Worker} from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture, TIER_NAMES} from './fixtures.mjs';
import {METRIC_NAMES} from './metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(here, '..', 'bench', 'baseline.json');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const opts = {tier: 'standard', metrics: [], set: {}, save: false, since: false, json: false};
for (let i = 0; i < argv.length; i++) {
 const a = argv[i];
 if (a === '--tier') opts.tier = argv[++i];
 else if (a === '--save') opts.save = true;
 else if (a === '--since') opts.since = true;
 else if (a === '--json') opts.json = true;
 else if (a === '--set') {
  const [k, v] = argv[++i].split('=');
  opts.set[k] = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
 } else if (a.startsWith('--')) {
  console.error(`unknown flag ${a}`); process.exit(2);
 } else opts.metrics.push(a);
}
if (!opts.metrics.length) opts.metrics = METRIC_NAMES;
for (const m of opts.metrics) if (!METRIC_NAMES.includes(m)) {
 console.error(`unknown metric "${m}" (${METRIC_NAMES.join(', ')})`); process.exit(2);
}
if (!TIER_NAMES.includes(opts.tier)) {
 console.error(`unknown tier "${opts.tier}" (${TIER_NAMES.join(', ')})`); process.exit(2);
}

// -------------------------------------------------------------------- run
const tasks = fixture(opts.tier, opts.set);
// One worker per core is not one per task: a worker pays its module-loading
// cost once and then reuses it, so slicing the work is cheaper than spawning
// a thread per course.
const workers = Math.max(1, Math.min(tasks.length, (os.cpus().length || 4) - 1));
const slices = Array.from({length: workers}, () => []);
tasks.forEach((t, i) => slices[i % workers].push(t));

const started = performance.now();
const results = (await Promise.all(slices.filter(s => s.length).map(slice =>
 new Promise((resolve, reject) => {
  const w = new Worker(path.join(here, 'bench-worker.mjs'),
   {workerData: {tasks: slice, metrics: opts.metrics}});
  w.on('message', resolve);
  w.on('error', reject);
  w.on('exit', code => {if (code) reject(new Error(`worker exited ${code}`));});
 })))).flat();
const wall = (performance.now() - started) / 1000;

// ----------------------------------------------------------------- reduce
const failed = results.filter(r => r.failed);
const series = {}, counts = {}, invariants = {};
let buildTotal = 0;
for (const r of results) {
 buildTotal += r.built || 0;
 for (const [k, v] of Object.entries(r.series || {})) (series[k] ??= []).push(...v);
 for (const [k, v] of Object.entries(r.counts || {})) counts[k] = (counts[k] || 0) + v;
 for (const [k, v] of Object.entries(r.invariants || {})) invariants[k] = (invariants[k] || 0) + v;
}
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
const summary = {};
for (const [k, raw] of Object.entries(series)) {
 const a = [...raw].sort((x, y) => x - y);
 summary[k] = {n: a.length, min: a[0], p05: q(a, .05), median: q(a, .5), p95: q(a, .95), max: a[a.length - 1]};
}
const report = {
 tier: opts.tier, metrics: opts.metrics, set: opts.set, courses: tasks.length,
 wallSeconds: +wall.toFixed(1), buildSeconds: +(buildTotal / 1000).toFixed(1),
 invariants, counts, summary,
};

// ------------------------------------------------------------------ print
const n = v => Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : String(v);
if (opts.json) console.log(JSON.stringify(report, null, 1));
else {
 console.log(`${tasks.length} courses, ${opts.metrics.join(' ')}, tier ${opts.tier}` +
  (Object.keys(opts.set).length ? `, ${JSON.stringify(opts.set)}` : ''));
 console.log(`${wall.toFixed(1)}s wall across ${workers} workers, ` +
  `${(buildTotal / 1000).toFixed(1)}s of generation -- ${(buildTotal / 1000 / wall).toFixed(1)}x\n`);

 // Rules first, and loudly. These are not readings; they are meant to be zero.
 const broken = Object.entries(invariants).filter(([, v]) => v > 0);
 console.log(broken.length ? 'BROKEN RULES' : 'rules: all clear');
 for (const [k, v] of broken) {
  console.log(`  ${k.padEnd(38)} ${v}`);
  // WHICH COURSE. A total tells you a rule is broken; it does not tell you
  // where to look, and finding that by hand is the slow part.
  const who = results.filter(r => (r.invariants || {})[k] > 0)
   .map(r => `${r.settings.biome}/${r.settings.seed} x${r.invariants[k]}`);
  console.log(`  ${''.padEnd(38)} ${who.slice(0, 8).join('  ')}${who.length > 8 ? ` +${who.length - 8} more` : ''}`);
 }
 if (Object.keys(invariants).length && !broken.length)
  console.log(`  ${Object.keys(invariants).join(', ')}`);

 console.log('\ncounts');
 for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(38)} ${v}`);

 console.log('\ndistributions        ' + ['n', 'min', 'p05', 'median', 'p95', 'max'].map(s => s.padStart(9)).join(''));
 for (const [k, s] of Object.entries(summary))
  console.log('  ' + k.padEnd(20) + [s.n, s.min, s.p05, s.median, s.p95, s.max].map(v => n(v).padStart(9)).join(''));
}
if (failed.length) {
 console.error(`\n${failed.length} course(s) failed:`);
 for (const f of failed.slice(0, 3)) console.error(`  ${JSON.stringify(f.settings)}\n  ${f.failed.split('\n')[0]}`);
}

// --------------------------------------------------------------- baseline
if (opts.save) {
 fs.mkdirSync(path.dirname(BASELINE), {recursive: true});
 fs.writeFileSync(BASELINE, JSON.stringify(report, null, 1) + '\n');
 console.log(`\nsaved as the baseline (${path.relative(process.cwd(), BASELINE)})`);
}
if (opts.since) {
 if (!fs.existsSync(BASELINE)) {console.error('\nno baseline yet -- run with --save first'); process.exit(1);}
 const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
 if (base.tier !== report.tier || String(base.set) !== String(report.set))
  console.log(`\nNOTE: baseline was tier ${base.tier} ${JSON.stringify(base.set)}, this run is ${report.tier} ${JSON.stringify(report.set)}`);
 const lines = [];
 for (const [k, v] of Object.entries(invariants)) {
  const was = base.invariants?.[k] ?? 0;
  if (v !== was) lines.push(`  ${(v > was ? 'WORSE' : 'better').padEnd(7)} ${k.padEnd(34)} ${was} -> ${v}`);
 }
 for (const [k, v] of Object.entries(counts)) {
  const was = base.counts?.[k];
  if (was !== undefined && was !== v) lines.push(`  ${'count'.padEnd(7)} ${k.padEnd(34)} ${was} -> ${v}`);
 }
 for (const [k, s] of Object.entries(summary)) {
  const was = base.summary?.[k];
  if (!was) continue;
  // A median that has not moved by 2% has not moved.
  const a = was.median, b = s.median, scale = Math.max(Math.abs(a), Math.abs(b), 1e-6);
  if (Math.abs(b - a) / scale > .02)
   lines.push(`  ${'median'.padEnd(7)} ${k.padEnd(34)} ${n(a)} -> ${n(b)}`);
 }
 console.log(lines.length ? '\nchanged since the baseline\n' + lines.join('\n') : '\nnothing moved since the baseline');
}

process.exit(broken_exit());
function broken_exit() {
 if (failed.length) return 1;
 return Object.values(invariants).some(v => v > 0) ? 1 : 0;
}
