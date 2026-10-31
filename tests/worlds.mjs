// One world per distinct set of settings, per test file.
//
// Building a 9-hole course takes three to five seconds, and the suite's wall
// time is not its total work -- the runner puts each FILE in its own process
// and runs them in parallel, so the wall is whatever the slowest single file
// takes. Measured, that was `water-terrain.test.mjs` at 326 seconds, almost all
// of it spent rebuilding terrain that an earlier test in the same file had
// already built.
//
// Generation is deterministic in its settings, so a second call with the same
// settings can only produce the same course. Caching it is free correctness.
//
// THE ONE RULE: a test must not mutate the world it is handed. Everything here
// reads -- heights, surfaces, hole geometry -- and a test that needs to change
// a course should call `generateWorld` directly and keep it to itself.
import {generateWorld} from '../src/course.js';

const cache = new Map();

export function world(settings) {
 // Key on sorted entries, so the same settings written in a different order
 // are the same course -- which they are.
 const key = JSON.stringify(Object.entries(settings).sort(([a], [b]) => a < b ? -1 : 1));
 if (!cache.has(key)) cache.set(key, generateWorld(settings));
 return cache.get(key);
}

// Several courses at once, deduplicated, for a test that sweeps seeds or biomes.
export function worlds(list) {
 return list.map(world);
}

export const cacheSize = () => cache.size;

// MANY COURSES, BUILT AT ONCE (31 October 2026, the testing audit). A file
// that builds dozens of courses is a serial queue on one thread however many
// cores sit idle -- water-keep-out's 48 were three minutes, the whole suite's
// wall. `measured` builds them on worker threads, up to `MEASURE_THREADS` at a
// time, and runs `name` from `module` (a file under tests/measure/, which may
// not import node:test) on each world where it was built; only what that
// returns comes back -- plain data, since a world holds functions and cannot
// cross a thread. The test then asserts on the numbers, as it did on the
// worlds. Results come back in the order of `list`.
export const MEASURE_THREADS = 6;
export async function measured(list, module, name = 'measure') {
 const {Worker} = await import('node:worker_threads');
 const out = new Array(list.length);
 let next = 0;
 const run = () => new Promise((resolve, reject) => {
  const worker = new Worker(new URL('./measure-worker.mjs', import.meta.url), {workerData: {module: new URL(module, import.meta.url).href, name}});
  const take = () => {
   if (next >= list.length) {worker.terminate().then(resolve); return;}
   const i = next++;
   worker.once('message', m => {if (m.error) {worker.terminate(); reject(new Error(`${JSON.stringify(list[i])}: ${m.error}`));} else {out[i] = m.result; take();}});
   worker.postMessage(list[i]);
  };
  worker.once('error', reject);
  take();
 });
 await Promise.all(Array.from({length: Math.min(MEASURE_THREADS, list.length)}, run));
 return out;
}
