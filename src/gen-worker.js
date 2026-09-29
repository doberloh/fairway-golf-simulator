// A GENERATION WORKER (B2 in TODO): computes ground heights for the grid on
// another processor core.
//
// It holds its own copy of the world, generated from the same settings as the
// main thread's -- generation is deterministic, so the copy is the same land --
// and stops at the ground grid (`capture`), keeping only the two questions the
// grid asks: a height at a point, and whether a cell is refined. The main
// thread then asks it for rows and for single points, and assembles the grid
// itself in its own order (makeGroundGridPooled), so which worker answered
// which question never shows in the result.
//
// Built by Vite as a classic script embedded in the single file (`?worker&inline`
// in gen-pool.js): a page opened from disk may start a classic worker from a
// blob, and Chromium refuses a module one.
import {generateWorldSteps} from './course.js';
import {sampleRows, sampleExtras} from './terrain-grid.js';
import {ownerRows} from './owner-atlas.js';

let grid = null;
self.onmessage = e => {
 const m = e.data;
 try {
  if (m.type === 'init') {
   const it = generateWorldSteps(m.settings, {capture: true});
   let r = it.next();
   while (!r.done && !r.value?.capture) r = it.next();
   grid = r.value?.capture ?? null;
   if (!grid) throw new Error('this world has no ground grid');
   self.postMessage({id: m.id, ok: true});
  } else if (m.type === 'rows') {
   const out = sampleRows(grid.sample, grid.refine, m.dims, m.j0, m.j1);
   self.postMessage({id: m.id, ok: true, values: out.values, mask: out.mask}, [out.values.buffer, out.mask.buffer]);
  } else if (m.type === 'atlas') {
   const out = ownerRows(grid, m.ex, m.ez, m.Sx, m.Sz, m.j0, m.j1);
   self.postMessage({id: m.id, ok: true, values: out}, [out.buffer]);
  } else if (m.type === 'extras') {
   const out = sampleExtras(grid.sample, m.at);
   self.postMessage({id: m.id, ok: true, values: out}, [out.buffer]);
  }
 } catch (err) {
  self.postMessage({id: m.id, ok: false, error: String(err?.message || err)});
 }
};
