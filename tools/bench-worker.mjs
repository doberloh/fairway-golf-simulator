// One worker: build the courses it is given and measure them.
//
// A generated world is full of closures -- `height`, `surface`, `toWorld` --
// so it cannot be posted back across a thread boundary. That is not a
// limitation to work around, it is what decides the design: the worker runs the
// METRICS too and returns plain numbers. Which is also the arrangement that
// makes a sweep cheap, because every metric shares one generation pass instead
// of each script rebuilding the same terrain for itself.
import {parentPort, workerData} from 'node:worker_threads';
import {generateWorld} from '../src/course.js';
import {METRICS} from './metrics.mjs';

const {tasks, metrics} = workerData;
const out = [];

for (const settings of tasks) {
 const started = performance.now();
 let world;
 try {
  world = generateWorld(settings);
 } catch (e) {
  out.push({settings, failed: String(e && e.stack || e)});
  continue;
 }
 const built = performance.now() - started;
 const result = {settings, built, series: {}, counts: {}, invariants: {}};
 for (const name of metrics) {
  try {
   const r = METRICS[name].run(world, settings);
   for (const [k, v] of Object.entries(r.series)) result.series[`${name}.${k}`] = v;
   for (const [k, v] of Object.entries(r.counts)) result.counts[`${name}.${k}`] = v;
   for (const [k, v] of Object.entries(r.invariants)) result.invariants[`${name}.${k}`] = v;
  } catch (e) {
   result.failed = `${name}: ${String(e && e.stack || e)}`;
  }
 }
 out.push(result);
}

parentPort.postMessage(out);
