// One thread of `measured` (worlds.mjs): builds each course it is sent and
// answers with what the measuring function makes of it.
import {parentPort, workerData} from 'node:worker_threads';
import {generateWorld} from '../src/course.js';

const measure = (await import(workerData.module))[workerData.name];
parentPort.on('message', settings => {
 try {
  parentPort.postMessage({result: measure(generateWorld(settings), settings)});
 } catch (e) {
  parentPort.postMessage({error: e?.stack || String(e)});
 }
});
