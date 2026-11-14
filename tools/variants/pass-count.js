// WHICH PASS A FRAME'S TRIANGLES ARE DRAWN IN (the frame-rate pass, 13
// November 2026). For tools/capture/overhaul.mjs --eval: from hole 1's back
// tee and from 250 m over it, one whole frame's triangles and draws as it is,
// with the shadow maps not redrawn, and with the sun's rays (and so their
// mask, a second drawing of everything solid) off. Counts, a few frames.
//
//   node tools/capture/overhaul.mjs <label> <landscapes> --views h1-tee --tier high
//     --goal surroundings --eval "$(cat tools/variants/pass-count.js)"
async v => {
 const r = v.renderer, frames = n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); });
 const auto = r.info.autoReset, m = n => (n / 1e6).toFixed(1) + ' M';
 const count = async () => {
  await frames(25);
  r.info.autoReset = false; r.info.reset();
  await frames(1);
  const out = {triangles: r.info.render.triangles, draws: r.info.render.calls};
  r.info.autoReset = auto;
  return out;
 };
 const out = {};
 for (const [spot, cam] of [['tee 1', {hole: 0, along: -4, height: 1.8, look: 'pin'}], ['250 m up', {hole: 0, along: -150, height: 250, look: 'pin'}]]) {
  window.lab.camera(cam);
  await frames(90);
  const whole = await count();
  const shadows = r.shadowMap.autoUpdate;
  r.shadowMap.autoUpdate = false;
  const still = await count();
  r.shadowMap.autoUpdate = shadows;
  const rays = v.quality.godRays;
  let noRays = null;
  try { v.quality.godRays = 0; noRays = await count(); v.quality.godRays = rays; } catch (e) { noRays = null; }
  out[spot] = `whole ${m(whole.triangles)} in ${whole.draws} draws; shadow maps ${m(whole.triangles - still.triangles)} in ${whole.draws - still.draws}; ` +
   (noRays ? `the rays' mask ${m(whole.triangles - noRays.triangles)} in ${whole.draws - noRays.draws}` : 'the rays could not be switched off') + `; cull ${JSON.stringify(v.cull?.stats?.().shadow)}`;
 }
 return out;
}
