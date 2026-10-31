// The Node test suite, run so the wait is short (the testing audit, 31
// October 2026; docs/TESTING.md, *Running the Node tests*).
//
//   node tools/test.mjs                   every file, longest first
//   node tools/test.mjs --changed         only files that can see a change since the last commit
//   node tools/test.mjs --changed main    ... or since another commit or branch
//   node tools/test.mjs --fast            only files that build no course (seconds)
//   node tools/test.mjs paths water       only files whose names hold these words
//   node tools/test.mjs --save-times      every file, then store each one's time
//   --jobs N                              files at once (default: cores - 1)
//   --list                                name the files it would run, and stop
//
// WHY NOT `node --test tests/*.test.mjs`. That runner takes its files in
// alphabetical order, so a three-minute file named water-* started last and
// the suite waited for it alone; files are scheduled here longest first, from
// the times in bench/test-times.json (a file it has no time for goes first).
// Ordering changes nothing a test checks.
//
// --changed follows each test file's imports (static and dynamic, relative
// paths) to every module it can reach, and runs the files that reach a file
// changed in the working tree, staged, untracked, or since the commit named.
// A change to docs alone runs nothing. It is a quick check while working, not
// the gate: a commit still gets the whole suite.
import {execSync, spawn} from 'node:child_process';
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {availableParallelism} from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMES = join(ROOT, 'bench', 'test-times.json');
// A file this quick builds no course: `--fast`. PLACED from the timings (the
// quickest course-building file took 5 s; nearly every other under 1).
const FAST = 3;

const argv = process.argv.slice(2), words = [];
const opt = {jobs: Math.max(1, availableParallelism() - 1)};
for (let i = 0; i < argv.length; i++) {
 const a = argv[i];
 if (a === '--changed') {opt.changed = true; if (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.since = argv[++i];}
 else if (a === '--fast') opt.fast = true;
 else if (a === '--save-times') opt.save = true;
 else if (a === '--list') opt.list = true;
 else if (a === '--jobs') opt.jobs = +argv[++i];
 else if (a.startsWith('--')) {console.error(`unknown flag ${a}`); process.exit(2);}
 else words.push(a);
}

const all = readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => join(ROOT, 'tests', f));
const times = existsSync(TIMES) ? JSON.parse(readFileSync(TIMES, 'utf8')) : {};
const name = f => relative(join(ROOT, 'tests'), f).replace(/\\/g, '/');
let files = all;

if (words.length) files = files.filter(f => words.some(w => name(f).includes(w)));
if (opt.fast) files = files.filter(f => (times[name(f)] ?? Infinity) < FAST);
if (opt.changed) {
 const git = cmd => execSync(cmd, {cwd: ROOT, encoding: 'utf8'}).split('\n').map(s => s.trim()).filter(Boolean);
 const changed = new Set([
  ...git('git diff --name-only HEAD'),
  ...git('git ls-files --others --exclude-standard'),
  ...(opt.since ? git(`git diff --name-only ${opt.since}...HEAD`) : []),
 ].map(f => resolve(ROOT, f)));
 // Every module each test can reach, by its relative imports.
 const reach = new Map();
 const imports = file => {
  if (reach.has(file)) return reach.get(file);
  const seen = new Set([file]);
  reach.set(file, seen);
  if (!existsSync(file) || !/\.m?js$/.test(file)) return seen;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
   const dep = resolve(dirname(file), m[1]);
   for (const d of imports(dep)) seen.add(d);
  }
  // `measured` names its measuring module by a relative path in a string.
  for (const m of src.matchAll(/['"](\.\/measure\/[^'"]+\.mjs)['"]/g)) for (const d of imports(resolve(dirname(file), m[1]))) seen.add(d);
  return seen;
 };
 // The worker `measured` starts is reached through worlds.mjs's URL.
 const worker = join(ROOT, 'tests', 'measure-worker.mjs');
 files = files.filter(f => {const r = imports(f); if (r.has(join(ROOT, 'tests', 'worlds.mjs'))) for (const d of imports(worker)) r.add(d); return [...r].some(d => changed.has(d));});
 console.log(`${changed.size} changed file(s); ${files.length} of ${all.length} test files can see them`);
}
if (!files.length) {console.log('nothing to run'); process.exit(0);}

// Longest first; a file with no time yet first of all.
files.sort((a, b) => (times[name(b)] ?? Infinity) - (times[name(a)] ?? Infinity));
if (opt.list) {for (const f of files) console.log(`${String(times[name(f)] ?? '?').padStart(6)} s  ${name(f)}`); process.exit(0);}

// Each file in its own `node --test` process, as the plain runner does, and
// `--jobs` at a time. (Not node:test's `run()`: it reports a file's result
// only when every file before it in the list has reported, so under load
// every file seemed to take the whole run, and nothing could be timed.) A
// passing file is one line; a failing one prints its whole report.
const t0 = performance.now(), took = {}, totals = {tests: 0, pass: 0, fail: 0};
const failedFiles = [];
let next = 0;
const one = f => new Promise(done => {
 const start = performance.now();
 const child = spawn(process.execPath, ['--test', '--test-reporter=spec', f], {cwd: ROOT});
 let out = '';
 child.stdout.on('data', d => out += d);
 child.stderr.on('data', d => out += d);
 child.on('close', code => {
  const s = (performance.now() - start) / 1000;
  took[name(f)] = s;
  const count = key => +(out.match(new RegExp(`ℹ ${key} (\\d+)`))?.[1] ?? 0);
  for (const k of Object.keys(totals)) totals[k] += count(k);
  if (code) {failedFiles.push(name(f)); process.stdout.write(`\n✖ ${name(f)} (${s.toFixed(1)} s)\n${out}\n`);}
  else process.stdout.write(`✔ ${name(f)} (${s.toFixed(1)} s, ${count('tests')} tests)\n`);
  done();
 });
});
const worker = async () => {while (next < files.length) await one(files[next++]);};
await Promise.all(Array.from({length: Math.min(opt.jobs, files.length)}, worker));

const wall = (performance.now() - t0) / 1000;
const slow = Object.entries(took).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, s]) => `${f} ${s.toFixed(0)} s`).join(', ');
console.log(`\n${totals.tests} tests, ${totals.pass} pass, ${totals.fail} fail; ${files.length} file(s) in ${wall.toFixed(0)} s, ${opt.jobs} at a time; slowest: ${slow}`);
if (failedFiles.length) console.log(`failed: ${failedFiles.join(', ')}`);
if (opt.save) {
 if (files.length !== all.length) console.log('times not stored: only a full run stores them');
 else {
  const out = Object.fromEntries(Object.entries(took).sort(([a], [b]) => a < b ? -1 : 1).map(([f, s]) => [f, +s.toFixed(1)]));
  writeFileSync(TIMES, JSON.stringify(out, null, 1) + '\n');
  console.log(`stored ${Object.keys(out).length} times in bench/test-times.json`);
 }
}
if (failedFiles.length) process.exitCode = 1;
