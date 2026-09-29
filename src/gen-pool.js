import GenWorker from './gen-worker.js?worker&inline';
import {ownerAtlasSize} from './owner-atlas.js';

// THE WORKERS THAT COMPUTE GROUND HEIGHTS (B2 in TODO). Started when a course
// starts generating, so each builds its copy of the world while the main thread
// builds its own, and asked for heights when the main thread reaches the grid.
// Every call resolves to null rather than failing: a pool that cannot help
// sends the grid back to the main thread (makeGroundGridPooled), which is how
// a browser that refuses workers, a worker that throws, or one that takes too
// long all end in the same course.
//
// How many: one fewer than the cores the browser reports, at most eight -- the
// main thread is still busy with its own generation until the grid, and past
// eight the round trips and the copies of the world (each worker holds one)
// cost more than the rows they save.
const TIMEOUT = 60000;
export function makeGridPool(settings, {count} = {}) {
 if (typeof Worker === 'undefined') return null;
 const n = Math.max(1, Math.min(8, count ?? ((navigator.hardwareConcurrency || 2) - 1)));
 let workers = [];
 try { for (let i = 0; i < n; i++) workers.push(new GenWorker()); }
 catch { for (const w of workers) w.terminate(); return null; }
 let seq = 0, atlas = Promise.resolve(null);
 const call = (w, msg, transfer = []) => new Promise((ok, no) => {
  const id = ++seq, timer = setTimeout(() => done(new Error('worker timed out')), TIMEOUT);
  const done = (err, data) => { clearTimeout(timer); w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); err ? no(err) : ok(data); };
  const onMessage = e => { if (e.data?.id === id) e.data.ok ? done(null, e.data) : done(new Error(e.data.error)); };
  const onError = e => done(new Error(e.message || 'worker failed'));
  w.addEventListener('message', onMessage); w.addEventListener('error', onError);
  try { w.postMessage({...msg, id}, transfer); } catch (err) { done(err); }
 });
 // Started now, awaited at the grid.
 const ready = Promise.all(workers.map(w => call(w, {type: 'init', settings})));
 ready.catch(() => {});
 const split = (total, parts) => Array.from({length: parts + 1}, (_, k) => Math.round(total * k / parts));
 return {
  count: n,
  async rows(dims) {
   try {
    await ready;
    const {nx, nz} = dims, rows = nz + 1, edges = split(rows, workers.length);
    const bands = await Promise.all(workers.map((w, b) => call(w, {type: 'rows', dims, j0: edges[b], j1: edges[b + 1]})));
    const values = new Float64Array((nx + 1) * rows), mask = new Uint8Array(nx * nz);
    bands.forEach((band, b) => { values.set(band.values, edges[b] * (nx + 1)); mask.set(band.mask, edges[b] * nx); });
    return {values, mask};
   } catch (err) { console.warn('Fairway: ground workers unavailable, building here', err); return null; }
  },
  async extras(at) {
   try {
    const count = at.length / 2, edges = split(count, workers.length);
    const parts = await Promise.all(workers.map((w, c) => {
     const slice = at.slice(edges[c] * 2, edges[c + 1] * 2);
     return call(w, {type: 'extras', at: slice}, [slice.buffer]);
    }));
    const out = new Float64Array(count);
    parts.forEach((p, c) => out.set(p.values, edges[c]));
    return out;
   } catch (err) { console.warn('Fairway: ground workers unavailable, building here', err); return null; }
  },
  // The ground's ownership atlas (owner-atlas.js), asked for as soon as the
  // grid's heights are in and collected when generation ends. Null if it
  // failed; the ground material then fills it itself.
  prefetchAtlas(ex, ez) {
   const {Sx, Sz} = ownerAtlasSize(ex, ez), edges = split(Sz, workers.length);
   atlas = Promise.all(workers.map((w, b) => call(w, {type: 'atlas', ex, ez, Sx, Sz, j0: edges[b], j1: edges[b + 1]})))
    .then(parts => {const data = new Float32Array(Sx * Sz * 4); parts.forEach((p, b) => data.set(p.values, edges[b] * Sx * 4)); return {Sx, Sz, data};})
    .catch(err => {console.warn('Fairway: ground atlas workers unavailable, building here', err); return null;});
  },
  atlas: () => atlas,
  dispose() { for (const w of workers) w.terminate(); workers = []; },
 };
}
