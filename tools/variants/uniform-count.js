// WHAT THE PROCESSOR SENDS THE CARD EACH FRAME, BY WHAT IS BEING DRAWN (the
// frame-rate pass, 13 November 2026). A processor profile of Prairie & Sand
// Hills on Ultra put a third of the frame in uniform4fv and uniformMatrix4fv:
// whole arrays of shader settings sent again and again. This counts, over one
// frame from hole 1's back tee and one from 250 m over it, the array-setting
// calls and the numbers they carry, by the mesh being drawn when they are made.
//
//   node tools/capture/overhaul.mjs <label> <landscapes> --views h1-tee --tier ultra
//     --goal surroundings --eval "$(cat tools/variants/uniform-count.js)"
async v => {
 const r = v.renderer, gl = r.getContext();
 const frames = n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); });
 const NAMES = ['uniform4fv', 'uniformMatrix4fv', 'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniformMatrix3fv'];
 let on = false, now = '(none)', tally = new Map();
 const kept = {};
 for (const n of NAMES) {
  kept[n] = gl[n];
  gl[n] = function (loc, a, b) {
   if (on) { const data = n.startsWith('uniformMatrix') ? b : a, t = tally.get(now) ?? {calls: 0, numbers: 0, draws: 0}; t.calls++; t.numbers += data?.length ?? 0; tally.set(now, t); }
   return kept[n].apply(this, arguments);
  };
 }
 const direct = r.renderBufferDirect;
 r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
  if (on) { now = `${object.name || object.type} / ${material.name || material.type}${material.isShaderMaterial ? '' : ''}`; const t = tally.get(now) ?? {calls: 0, numbers: 0, draws: 0}; t.draws++; tally.set(now, t); }
  return direct.apply(this, arguments);
 };
 const out = {};
 for (const [spot, cam] of [['tee 1', {hole: 0, along: -4, height: 1.8, look: 'pin'}], ['250 m up', {hole: 0, along: -150, height: 250, look: 'pin'}]]) {
  window.lab.camera(cam);
  await frames(90);
  tally = new Map(); on = true;
  await frames(4);
  on = false;
  const rows = [...tally].sort((a, b) => b[1].numbers - a[1].numbers), all = rows.reduce((t, [, e]) => ({calls: t.calls + e.calls, numbers: t.numbers + e.numbers, draws: t.draws + e.draws}), {calls: 0, numbers: 0, draws: 0});
  out[spot] = [`ALL: ${Math.round(all.numbers / 4)} numbers in ${Math.round(all.calls / 4)} array calls over ${Math.round(all.draws / 4)} draws a frame`,
   ...rows.slice(0, 14).map(([k, e]) => `${Math.round(e.numbers / 4)} numbers, ${Math.round(e.calls / 4)} calls, ${(e.draws / 4).toFixed(1)} draws: ${k}`)];
 }
 for (const n of NAMES) gl[n] = kept[n];
 r.renderBufferDirect = direct;
 return out;
}
