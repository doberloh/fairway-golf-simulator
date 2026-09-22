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

 // ---- GPU time, one TIME_ELAPSED query spanning each frame
 function gpuBegin() {
  const {gl, ext} = state;
  if (!gl || !ext || state.active) return;
  const q = state.pool.pop() || gl.createQuery();
  try { gl.beginQuery(ext.TIME_ELAPSED_EXT, q); state.active = q; } catch { state.active = null; }
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
   const q = state.pending[i];
   if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
   // A disjoint GPU (a context switch, a power state change) invalidates the
   // reading rather than merely perturbing it, so it is dropped, not kept.
   if (!disjoint) state.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
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
 // spent inside the animation callback, which is the game's whole tick. `gpu`
 // is a TIME_ELAPSED query spanning the same callback. Neither can be padded
 // by a wait for the display, and both collapse toward zero on an idle page,
 // which is how the harness proves it is looking at the right thing.
 let last = 0;
 const realRAF = window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame = cb => realRAF(t => {
  if (!state.running) { last = 0; return cb(t); }
  gpuDrain();
  if (last) state.frames.push(t - last);
  last = t;
  state.frameCount++;
  gpuBegin();
  const a = performance.now();
  try { return cb(t); } finally {
   state.cpu.push(performance.now() - a);
   gpuEnd();
  }
 });

 window.__profStart = () => {
  Object.assign(state, {frames: [], cpu: [], gpu: [], calls: 0, tris: 0, programs: 0,
   textures: 0, frameCount: 0, running: true});
  last = 0;
 };
 window.__profStop = () => {
  state.running = false; gpuEnd(); gpuDrain();
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
