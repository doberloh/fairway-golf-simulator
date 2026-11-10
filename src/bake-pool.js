// A BUILT COURSE'S FIELD, BAKED ON OTHER CORES (the frame-rate goal, 9
// November 2026). Baking the distances to every outline (built-field.js) was
// 16 of the 21 seconds the Course Builder's Game view took to build Dinosaur
// Mountain, and seconds of every large built course's load in the game, on one
// core. Each texel is worked out on its own, so the field is cut into bands of
// rows, one a worker, and put back together: the same bytes as baking it whole
// (tests/built-field.test.mjs).
//
// Resolves to null rather than failing -- no workers, a worker that throws or
// takes too long -- and worldFromDoc then bakes it here, as before.
import BakeWorker from './bake-worker.js?worker&inline';
import {fieldSize} from './built-field.js';

const TIMEOUT = 120000;

// The field for `doc` over ground running `ex`, `ez` either side of the centre
// (built-world.js `builtExtent`), or null.
export async function bakeBuiltFieldPooled(doc, ex, ez, {count} = {}) {
 if (typeof Worker === 'undefined') return null;
 const {Sx, Sz, cell} = fieldSize(ex, ez);
 const n = Math.max(1, Math.min(8, count ?? ((navigator.hardwareConcurrency || 2) - 1), Sz));
 const workers = [];
 try {
  for (let i = 0; i < n; i++) workers.push(new BakeWorker());
  // Only what the bake reads: the outlines.
  const slim = {surfaces: doc.surfaces, water: (doc.water || []).map(w => ({rings: w.rings}))};
  const edges = Array.from({length: n + 1}, (_, k) => Math.round(Sz * k / n));
  const parts = await Promise.all(workers.map((w, k) => new Promise((ok, no) => {
   const timer = setTimeout(() => no(new Error('bake worker timed out')), TIMEOUT);
   w.onmessage = e => { clearTimeout(timer); e.data.ok ? ok(e.data) : no(new Error(e.data.error)); };
   w.onerror = e => { clearTimeout(timer); no(new Error(e.message || 'bake worker failed')); };
   w.postMessage({id: k, doc: slim, ex, ez, r0: edges[k], r1: edges[k + 1]});
  })));
  const a = new Uint8Array(Sx * Sz * 4), b = new Uint8Array(Sx * Sz * 4);
  parts.forEach((p, k) => { a.set(p.a, edges[k] * Sx * 4); b.set(p.b, edges[k] * Sx * 4); });
  return {Sx, Sz, ex, ez, cell, a, b};
 } catch (err) {
  console.warn('Fairway: field workers unavailable, baking here', err);
  return null;
 } finally { for (const w of workers) w.terminate(); }
}
