// Injected into the page before anything else runs. Measures the frame from
// OUTSIDE the game: it wraps WebGL and requestAnimationFrame rather than asking
// the renderer for its own numbers, so it keeps working whatever the renderer
// is rewritten into, and it cannot be fooled by the app reporting on itself.
//
// THE ONE RULE THIS HAS TO OBEY: it must be able to report a frame time BELOW
// the display's refresh interval. A timer wrapped around a render call reads
// the vsync wait, not the work -- that mistake cost this project a fortnight
// and a forest that looked dead. `profile.mjs` proves the property on a blank
// page before it trusts a single number here.
(() => {
 const state = {
  frames: [],          // ms between animation frames -- PACING, not cost
  cpu: [],             // ms inside the frame callback: the game's own work
  gpu: [],             // GPU ms per frame, where the timer query exists
  calls: 0, tris: 0, programs: 0, textures: 0, frameCount: 0,
  gl: null, ext: null, pool: [], pending: [], active: null,
  running: false,
 };
 window.__prof = state;

 // ---- catch the context on its way out, whoever asks for it
 const realGetContext = HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
  const ctx = realGetContext.call(this, type, ...rest);
  if (ctx && /webgl/i.test(type) && !state.gl) { state.gl = ctx; instrument(ctx); }
  return ctx;
 };

 const TRI = {};
 function instrument(gl) {
  for (const k of ['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN']) TRI[gl[k]] = k;
  state.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
           || gl.getExtension('EXT_disjoint_timer_query') || null;

  const perDraw = (mode, count, instances = 1) => {
   if (!state.running) return;
   state.calls++;
   // Strips and fans make count-2 triangles; lists make count/3. Anything
   // that is not a triangle mode contributes no triangles at all.
   const t = TRI[mode] === 'TRIANGLES' ? count / 3 : TRI[mode] ? Math.max(0, count - 2) : 0;
   state.tris += t * instances;
  };
  const wrap = (name, fn) => {
   const real = gl[name];
   if (typeof real !== 'function') return;
   gl[name] = function (...a) { fn(...a); return real.apply(this, a); };
  };
  wrap('drawElements', (mode, count) => perDraw(mode, count));
  wrap('drawArrays', (mode, first, count) => perDraw(mode, count));
  wrap('drawElementsInstanced', (mode, count, type, offset, n) => perDraw(mode, count, n));
  wrap('drawArraysInstanced', (mode, first, count, n) => perDraw(mode, count, n));
  wrap('drawRangeElements', (mode, s, e, count) => perDraw(mode, count));
  wrap('useProgram', () => { if (state.running) state.programs++; });
  wrap('bindTexture', () => { if (state.running) state.textures++; });
 }

 // ---- GPU time: a TIME_ELAPSED query around every animation callback,
 // summed into the ANIMATION FRAME it ran in.
 //
 // ONE FRAME IS EVERY CALLBACK THAT SHARES A TIMESTAMP, not every callback.
 // This file used to treat each callback as a frame of its own, and the
 // harness that drives it counts frames with a requestAnimationFrame of its
 // own -- so every real frame arrived as two samples: the game's, and a
 // near-empty one from the counter. Frame counts doubled (a 300-frame sample
 // reported 602), draws and triangles per frame came out at HALF their true
 // value, and every median was taken over a 50/50 mix of real frames and
 // nothing, which put it at the boundary between the two -- close to the
 // fastest real frame, and liable to jump. Found 28 September 2026 while
 // timing tree shadows, when a control row kept reporting the previous row's
 // time. See RESEARCH.md *The profiler counted every frame twice*.
 //
 // A query per callback rather than one spanning the frame: on Direct3D the
 // elapsed time is two GPU timestamps, so a query left open across the gap
 // between frames would time the wait for the display, which is exactly the
 // mistake this file exists to make impossible.
 let run = 0, frame = -1, frameT = null, cpuNow = 0;
 const gpuByFrame = new Map(), spoiled = new Set();
 function gpuBegin() {
  const {gl, ext} = state;
  if (!gl || !ext || state.active) return;
  const q = state.pool.pop() || gl.createQuery();
  try { gl.beginQuery(ext.TIME_ELAPSED_EXT, q); state.active = {q, run, frame}; } catch { state.active = null; }
 }
 function gpuEnd() {
  const {gl, ext} = state;
  if (!gl || !ext || !state.active) return;
  try { gl.endQuery(ext.TIME_ELAPSED_EXT); state.pending.push(state.active); } catch {}
  state.active = null;
 }
 function gpuDrain() {
  const {gl, ext} = state;
  if (!gl || !ext) return;
  const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
  for (let i = state.pending.length - 1; i >= 0; i--) {
   const {q, run: r, frame: f} = state.pending[i];
   if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
   // A query from an earlier sample is recycled and not counted.
   if (r === run) {
    // A disjoint GPU (a context switch, a power state change) invalidates the
    // reading rather than merely perturbing it, so its frame is dropped.
    if (disjoint) spoiled.add(f);
    else gpuByFrame.set(f, (gpuByFrame.get(f) || 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
   }
   state.pending.splice(i, 1);
   state.pool.push(q);
  }
 }

 // ---- the frame clock: deltas between successive animation frames
 // THE INTERVAL BETWEEN FRAMES IS NOT THE COST OF A FRAME, and on this
 // harness it cannot be made to be: headless Chromium paces animation frames
 // to a virtual 60 Hz display whatever `--disable-gpu-vsync` is told to do, so
 // a blank page reads 17 ms. Measured it, found 17 ms, refused to build on it
 // -- which is the same trap that produced the dead forest, caught this time
 // by the check that runs before any number is believed.
 //
 // So the frame is measured as WORK rather than as pacing. `cpu` is the time
 // spent inside the frame's animation callbacks, which is the game's whole
 // tick. `gpu` is TIME_ELAPSED queries spanning the same callbacks. Neither can
 // be padded by a wait for the display, and both collapse toward zero on an
 // idle page, which is how the harness proves it is looking at the right thing.
 let last = 0;
 const realRAF = window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame = cb => realRAF(t => {
  if (!state.running) { last = 0; return cb(t); }
  if (t !== frameT) {
   // The first callback of a new animation frame closes the last one.
   if (frameT !== null) state.cpu.push(cpuNow);
   frameT = t; cpuNow = 0; frame++;
   gpuDrain();
   if (last) state.frames.push(t - last);
   last = t;
   state.frameCount++;
  }
  gpuBegin();
  const a = performance.now();
  try { return cb(t); } finally {
   cpuNow += performance.now() - a;
   gpuEnd();
  }
 });

 window.__profStart = () => {
  Object.assign(state, {frames: [], cpu: [], gpu: [], calls: 0, tris: 0, programs: 0,
   textures: 0, frameCount: 0, running: true});
  last = 0; run++; frame = -1; frameT = null; cpuNow = 0;
  gpuByFrame.clear(); spoiled.clear();
 };
 window.__profStop = () => {
  state.running = false; gpuEnd(); gpuDrain();
  if (frameT !== null) state.cpu.push(cpuNow);
  frameT = null;
  // The last few frames' queries may not have resolved yet, and a frame with
  // half its callbacks counted would read short, so they are left out.
  for (const [f, ms] of gpuByFrame) if (f < frame - 3 && !spoiled.has(f)) state.gpu.push(ms);
  const f = [...state.frames].sort((a, b) => a - b), g = [...state.gpu].sort((a, b) => a - b);
  const c = [...state.cpu].sort((a, b) => a - b);
  const at = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null;
  const n = Math.max(1, state.frameCount);
  return {
   frames: c.length,
   // The headline numbers. `median` is CPU work per frame; `gpuMedian` is the
   // card's own time for the same frame. The larger of the two is what the
   // frame is actually waiting on.
   median: at(c, .5), p95: at(c, .95), p99: at(c, .99), worst: c[c.length - 1] ?? null,
   fps: at(c, .5) ? 1000 / Math.max(at(c, .5), at(g, .5) ?? 0) : null,
   interval: at(f, .5),
   gpuFrames: g.length, gpuMedian: at(g, .5), gpuP95: at(g, .95),
   callsPerFrame: state.calls / n, trisPerFrame: state.tris / n,
   programsPerFrame: state.programs / n, texturesPerFrame: state.textures / n,
  };
 };
})();
