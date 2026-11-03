// ONE GRAPHICS JOB AT A TIME, ACROSS PROCESSES (the US landscapes goal, 2
// November 2026). The goal's model packs are worked by several agents at once,
// each rendering in Blender, while the main thread runs smoke, captures and
// frame A/Bs; AGENTS.md allows one graphics job at a time. The gate
// (gpu-gate.mjs) reads the card, which cannot see a job that has not started
// drawing yet, nor reliably a Blender (it draws; it is no compute process). So
// every graphics job also holds this lock: a directory made atomically,
// bench/ab/gpu.lock/, its owner.json naming the process and the job.
//
//   const release = holdCard('blender cartoon_keys r3');  ... release();
//
// Waits (polling every 5 s) while another live process holds it; a holder
// whose process is gone is cleared. A job's children inherit the hold
// (FAIRWAY_GPU_LOCK), so `gpu-run.mjs -- node tools/capture/x.mjs`, whose
// capture gates itself, does not wait on its own parent. Released when the
// holder calls release() or exits.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
export const LOCK = path.join(ROOT, 'bench', 'ab', 'gpu.lock');
const OWNER = path.join(LOCK, 'owner.json');
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const owner = () => { try { return JSON.parse(fs.readFileSync(OWNER, 'utf8')); } catch { return null; } };

export function holdCard(what, {giveUpMin = 180} = {}) {
 const inherited = process.env.FAIRWAY_GPU_LOCK, held = owner();
 if (inherited && held?.token === inherited) return () => {};
 fs.mkdirSync(path.dirname(LOCK), {recursive: true});
 const token = `${process.pid}-${Date.now()}`, started = Date.now();
 let said = false;
 for (;;) {
  try {
   fs.mkdirSync(LOCK);
   fs.writeFileSync(OWNER, JSON.stringify({pid: process.pid, token, what, started: new Date().toISOString()}));
   break;
  } catch (e) {
   if (e.code !== 'EEXIST') throw e;
   const o = owner();
   // A holder that died, or one that made the directory and has not yet
   // written its name (give it 10 s), is cleared.
   const stale = o ? !alive(o.pid) : Date.now() - fs.statSync(LOCK).mtimeMs > 10000;
   if (stale) { fs.rmSync(LOCK, {recursive: true, force: true}); continue; }
   if (!said) { console.log(`gpu lock: waiting for ${o?.what ?? 'another job'} (pid ${o?.pid ?? '?'})`); said = true; }
   if (Date.now() - started > giveUpMin * 60000) throw Error(`gpu lock: still held by ${o?.what} after ${giveUpMin} min`);
   sleep(5000);
  }
 }
 process.env.FAIRWAY_GPU_LOCK = token;
 let done = false;
 const release = () => {
  if (done) return; done = true;
  if (owner()?.token === token) fs.rmSync(LOCK, {recursive: true, force: true});
  if (process.env.FAIRWAY_GPU_LOCK === token) delete process.env.FAIRWAY_GPU_LOCK;
 };
 process.on('exit', release);
 return release;
}
