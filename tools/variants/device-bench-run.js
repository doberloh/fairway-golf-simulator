// MEASURE THIS DEVICE, RUN ON THIS MACHINE (branch phone-performance, 14
// November 2026): the button's tour (src/device-bench.js) driven through
// window.lab.bench(), to see it finish, put the camera back and have every
// part switch take effect, before the owner runs it on a phone. For
// tools/capture/overhaul.mjs --eval; `v` is the renderer.
//
//   node tools/capture/build-hooked.mjs
//   node tools/capture/overhaul.mjs bench parkland --views h1-tee --tier medium
//     --goal phone-performance --eval "$(cat tools/variants/device-bench-run.js)"
async v => {
 const pose = () => ({mode: v.config.mode, x: +v.camera.position.x.toFixed(1), y: +v.camera.position.y.toFixed(1), z: +v.camera.position.z.toFixed(1)});
 const before = pose(), canvas = [v.renderer.domElement.width, v.renderer.domElement.height];
 const t0 = performance.now();
 const b = await window.lab.bench();
 if (!b) return 'lab.bench() returned null';
 // The play camera flies home (main.js cameraMode); give it three seconds.
 await new Promise(done => setTimeout(done, 3000));
 return {
  seconds: Math.round((performance.now() - t0) / 1000), tier: b.tier, ratio: b.ratio, canvas, canvasAfter: [v.renderer.domElement.width, v.renderer.domElement.height],
  notes: b.notes, before, after: pose(),
  rows: b.rows.map(r => `${r.spot} ${r.part ?? 'whole'}: ${r.fps} fps, worst ${r.worstMs}, work ${r.workMs}${r.baseWork ? ` (whole ${r.baseWork.toFixed(1)})` : ''}, ${r.draws} draws, ${((r.triangles ?? 0) / 1e6).toFixed(1)} M, ${r.canvas?.join('x')}`),
  diagnostic: window.lab.diagnostic?.() ?? null,
 };
}
