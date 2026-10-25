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
// The limits are AGENTS.md's, placed rather than measured: under 10% busy for
// the whole 30-second look, below 60 °C, 5 minutes since the last run ended,
// and a cap per goal (6 unless the owner named another; the 22 October
// frame-rate goal: 40). Busy: wait a minute and look again (the owner's
// instruction for that goal), for at most an hour, then give up.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

// Fifteen readings two seconds apart: the highest use and temperature seen.
export function look(seconds = 30) {
 let util = 0, temp = 0, mem = 0;
 for (let i = 0; i < seconds / 2; i++) {
  if (i) sleep(2000);
  const r = readCard();
  util = Math.max(util, r.util); temp = Math.max(temp, r.temp); mem = Math.max(mem, r.mem);
 }
 return {util, temp, mem};
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
 const started = Date.now();
 for (;;) {
  const r = look(lookSeconds), others = foreignJobs();
  if (r.util < utilMax && r.temp < tempMax && !others.length) {
   console.log(`gate: card ${r.util}% busy, ${r.temp} °C over ${lookSeconds} s -- starting (run ${mine.length + 1} of ${cap})`);
   return {...r, run: mine.length + 1};
  }
  if (Date.now() - started > giveUpMin * 60000) throw Error(`The card stayed busy (${r.util}%, ${r.temp} °C${others.length ? ', ' + others.map(o => o.name).join(', ') : ''}) for an hour; not starting.`);
  console.log(`gate: card ${r.util}% busy, ${r.temp} °C${others.length ? `, another job on it (${others.map(o => o.name.split(/[\\/]/).pop()).join(', ')})` : ''} -- waiting a minute`);
  sleep(60000);
 }
}

export function logRun(entry) {
 fs.mkdirSync(path.dirname(LOG), {recursive: true});
 fs.appendFileSync(LOG, JSON.stringify({...entry, ended: new Date().toISOString()}) + '\n');
}
