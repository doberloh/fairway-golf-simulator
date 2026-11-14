// The graphics card's gate for unattended runs (AGENTS.md, *A `/goal` that
// says "GPU allowed"*). Every GPU run a goal starts goes through `gpuGate`
// first, and `logRun` afterwards.
//
// WHY: this machine has crashed four times around GPU work (RULES_HISTORY.md,
// *The graphics card*), twice while the owner was gaming. A busy card is how a
// script can tell the owner is playing, so a run starts only on an idle, cool
// card; runs are spaced and capped because the 18 October crash came from
// volume, not from any single run.
//
// The limits are AGENTS.md's, placed rather than measured: under 10% of real
// work for the whole 30-second look (`look` says what "work" is and why it is
// not nvidia-smi's figure), no one program taking 15% (a game), below 60 °C, 5 minutes since the last run ended,
// and a cap per goal (6 unless the owner named another; the 22 October
// frame-rate goal: 40). Busy: wait a minute and look again (the owner's
// instruction for that goal), for at most an hour, then give up.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {holdCard} from './gpu-lock.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
// Git-ignored: a record for the owner, not source.
export const LOG = path.join(ROOT, 'bench', 'ab', 'gpu-runs.jsonl');

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function readCard() {
 const line = execSync('nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used --format=csv,noheader,nounits',
  {encoding: 'utf8'}).trim().split(/\r?\n/)[0];
 const [util, temp, mem] = line.split(',').map(s => Number(s.trim()));
 return {util, temp, mem};
}

// WHAT THE CARD IS DOING, NOT HOW SLOWLY IT IS IDLING (13 November 2026; the
// owner: "Fix the gate"). The gate read nvidia-smi's busy figure, which is
// the share of time the card was busy AT ITS CURRENT CLOCK. This card idles
// in a low power state at a third of its clock (P5, 810 MHz for 2,520), and
// there a launcher's animation and a chat window read 18 to 50%: the gate
// stood shut for most of a day on a card doing about 6% of anything, and the
// reading was taken for the owner at the machine (docs/SURROUNDINGS.md, *What
// the gate has been reading*). Windows keeps the real account: the GPU
// Engine counters, each program's share of each engine, which do not move
// with the clock. So:
//
//  - the card's WORK is the sum of every program's share (every engine, both
//    adapters), the highest of the samples taken two seconds apart;
//  - A GAME is one program taking GAME percent or more by itself (a desktop's
//    programs take one to four each), and it refuses the run whatever the
//    total and whatever limit the run asked for: that is what "the owner is
//    playing" looks like, which is the thing the gate is for;
//  - where the counters cannot be read (another system, a failed call) the
//    gate falls back to nvidia-smi's figure, as it was, and says so.
//
// PLACED: 15%. Pure, so it is tested: tests/gpu-gate.test.mjs.
export const GAME = 15;
// `lines`: "sample|instance name|value" for each counter, as COUNTERS prints
// them; `names`: {pid: program}. Returns the highest total seen, and the
// busiest single program in any sample.
export function loadFrom(lines, names = {}) {
 const samples = new Map();
 for (const line of lines) {
  const [k, instance, value] = line.split('|'), v = Number(value), pid = /pid_(\d+)/.exec(instance || '')?.[1];
  if (!pid || !(v > 0)) continue;
  const by = samples.get(k) ?? new Map(); samples.set(k, by);
  by.set(pid, (by.get(pid) ?? 0) + v);
 }
 let util = 0, top = {pid: null, name: null, util: 0};
 for (const by of samples.values()) {
  let total = 0;
  for (const [pid, v] of by) { total += v; if (v > top.util) top = {pid: Number(pid), name: names[pid] ?? null, util: v}; }
  util = Math.max(util, total);
 }
 return {util: Math.round(util * 10) / 10, top: {...top, util: Math.round(top.util * 10) / 10}, samples: samples.size};
}
// May a run start? `load`: loadFrom's answer, or null where only nvidia-smi could be read (`smi`, its figure).
export function mayStart({load, smi, temp, utilMax, tempMax, others = 0}) {
 if (others) return {ok: false, why: 'another graphics job is on the card'};
 if (temp >= tempMax) return {ok: false, why: `the card is at ${temp} °C (limit ${tempMax})`};
 if (!load) return smi < utilMax ? {ok: true} : {ok: false, why: `nvidia-smi reads ${smi}% busy (limit ${utilMax}; the real counters could not be read)`};
 if (load.top.util >= GAME) return {ok: false, why: `${load.top.name ?? 'a program'} is taking ${load.top.util}% of the card by itself: a game`};
 if (load.util >= utilMax) return {ok: false, why: `the card is doing ${load.util}% (limit ${utilMax})`};
 return {ok: true};
}

// Windows' own account, over `seconds`: one call, a sample every two seconds.
const COUNTERS = seconds => `$ErrorActionPreference='Stop'
$s = Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -SampleInterval 2 -MaxSamples ${Math.max(1, Math.round(seconds / 2))}
$k = 0; $pids = @{}
foreach ($set in $s) { foreach ($c in $set.CounterSamples) { if ($c.CookedValue -gt 0.01) { "$k|$($c.InstanceName)|$([math]::Round($c.CookedValue, 2))"; if ($c.InstanceName -match 'pid_(\\d+)') { $pids[$Matches[1]] = 1 } } }; $k++ }
foreach ($p in $pids.Keys) { $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; if ($n) { "name|$p|$n" } }`;
export function readLoad(seconds = 30) {
 if (process.platform !== 'win32') return null;
 try {
  const out = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(COUNTERS(seconds), 'utf16le').toString('base64')}`, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: (seconds + 30) * 1000});
  const lines = out.split(/\r?\n/).filter(Boolean), names = {};
  for (const l of lines) if (l.startsWith('name|')) { const [, pid, name] = l.split('|'); names[pid] = name; }
  const load = loadFrom(lines.filter(l => !l.startsWith('name|')), names);
  return load.samples ? load : null;
 } catch { return null; }
}

// The card over `seconds`: its real work (`load`, null where it cannot be
// read), nvidia-smi's own figure beside it (`smi`, the highest of the
// readings before and after), and the highest temperature. `util` is the
// figure the gate judges by: the real work where there is one.
export function look(seconds = 30) {
 const before = readCard(), load = readLoad(seconds);
 // (No real account: fifteen nvidia-smi readings two seconds apart, as it was.)
 let smi = before.util, temp = before.temp, mem = before.mem;
 if (!load) for (let i = 1; i < seconds / 2; i++) { sleep(2000); const r = readCard(); smi = Math.max(smi, r.util); temp = Math.max(temp, r.temp); mem = Math.max(mem, r.mem); }
 const after = readCard();
 smi = Math.max(smi, after.util); temp = Math.max(temp, after.temp); mem = Math.max(mem, after.mem);
 return {util: load ? load.util : smi, temp, mem, smi, load};
}

// GPU JOBS SOMEBODY ELSE STARTED (the cartoon-overhaul goal, 25 October 2026).
// Two goals can run at once in two folders, and each keeps its own log, so a
// log cannot say the other one is drawing. The card's own process list can: a
// Playwright browser or a Blender that is not ours is another goal's job. The
// owner's ordinary desktop Chrome is not counted -- it is always there.
export function foreignJobs(ours = new Set()) {
 let out = '';
 try { out = execSync('nvidia-smi --query-compute-apps=pid,process_name --format=csv,noheader', {encoding: 'utf8'}); }
 catch { return []; }
 return out.split(/\r?\n/).filter(Boolean).map(l => { const [pid, ...name] = l.split(','); return {pid: Number(pid), name: name.join(',').trim()}; })
  .filter(p => !ours.has(p.pid) && /ms-playwright|chrome-headless|headless_shell|blender/i.test(p.name));
}

export function runs() {
 try { return fs.readFileSync(LOG, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)); }
 catch { return []; }
}

export function gpuGate({goal, cap = 6, restMin = 5, utilMax = 10, tempMax = 60, giveUpMin = 60, lookSeconds = 30} = {}) {
 if (!goal) throw Error('gpuGate needs the goal this run belongs to (--goal).');
 const mine = runs().filter(r => r.goal === goal);
 if (mine.length >= cap) throw Error(`This goal has used its ${cap} GPU runs; stop and ask the owner.`);
 const last = mine.at(-1)?.ended;
 if (last) {
  const wait = restMin * 60000 - (Date.now() - Date.parse(last));
  if (wait > 0) { console.log(`gate: resting ${Math.ceil(wait / 1000)} s since the last run`); sleep(wait); }
 }
 // One graphics job at a time across processes (gpu-lock.mjs), held until
 // this process exits; taken before the look, so the look sees no job of ours.
 holdCard(`${goal} ${path.basename(process.argv[1] || 'job')}`);
 const started = Date.now();
 for (;;) {
  const r = look(lookSeconds), others = foreignJobs();
  const verdict = mayStart({load: r.load, smi: r.smi, temp: r.temp, utilMax, tempMax, others: others.length});
  const reading = r.load ? `card doing ${r.load.util}% (busiest: ${r.load.top.name ?? '?'} ${r.load.top.util}%; nvidia-smi ${r.smi}%)` : `card ${r.smi}% busy by nvidia-smi`;
  if (verdict.ok) {
   console.log(`gate: ${reading}, ${r.temp} °C over ${lookSeconds} s -- starting (run ${mine.length + 1} of ${cap})`);
   const {load, ...flat} = r;
   return {...flat, top: load?.top.name ?? null, run: mine.length + 1};
  }
  if (Date.now() - started > giveUpMin * 60000) throw Error(`The card stayed busy (${verdict.why}; ${r.temp} °C${others.length ? ', ' + others.map(o => o.name).join(', ') : ''}) for an hour; not starting.`);
  console.log(`gate: ${verdict.why}${others.length ? ` (${others.map(o => o.name.split(/[\\/]/).pop()).join(', ')})` : ''}; ${reading}, ${r.temp} °C -- waiting a minute`);
  sleep(60000);
 }
}

export function logRun(entry) {
 fs.mkdirSync(path.dirname(LOG), {recursive: true});
 fs.appendFileSync(LOG, JSON.stringify({...entry, ended: new Date().toISOString()}) + '\n');
}

// RUN BY HAND: what the card is doing, in place of reading nvidia-smi.
//   node tools/gpu-gate.mjs [seconds]
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tools', 'gpu-gate.mjs')) {
 const r = look(Number(process.argv[2]) || 10);
 console.log(r.load ? `the card is doing ${r.load.util}% (busiest: ${r.load.top.name ?? '?'} ${r.load.top.util}%); nvidia-smi calls it ${r.smi}% busy; ${r.temp} °C` : `nvidia-smi: ${r.smi}% busy, ${r.temp} °C (the real counters could not be read)`);
 const said = mayStart({load: r.load, smi: r.smi, temp: r.temp, utilMax: 10, tempMax: 60, others: foreignJobs().length});
 console.log(said.ok ? 'a run may start under the strictest limits (10%, 60 °C)' : 'a run would wait: ' + said.why);
}
