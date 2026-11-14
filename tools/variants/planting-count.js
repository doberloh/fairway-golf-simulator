// WHAT THE COURSE'S PLANTING DRAWS, BY KIND OF MESH (the frame-rate pass, 13
// November 2026). For tools/capture/overhaul.mjs --eval: from hole 1's back
// tee and from 250 m over it, one whole frame's triangles (every pass) with
// each kind hidden in turn -- the whole models, their far or middle versions,
// the meshes that carry a tree across the swap, the shadow maps' stand-ins.
// `window.__farPx` (set with the capture tool's page, or left unset) moves the
// middle version's line, to stand in for a screen of another height: 150 on a
// 900-line picture is 300 on 1,800 lines.
//
//   node tools/capture/overhaul.mjs <label> <landscapes> --views h1-tee --tier high
//     --goal surroundings --eval "$(cat tools/variants/planting-count.js)"
async v => {
 const r = v.renderer, frames = n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); });
 const auto = r.info.autoReset, m = n => (n / 1e6).toFixed(1) + ' M';
 const px = Number(new URLSearchParams(location.search).get('farPx')) || window.__farPx || 150;
 v.cull.tune({farPaintedPx: px});
 const count = async () => {
  await frames(25);
  r.info.autoReset = false; r.info.reset();
  await frames(1);
  const out = r.info.render.triangles;
  r.info.autoReset = auto;
  return out;
 };
 const hide = test => { const list = []; v.group.traverse(o => { if (o.visible && o.isInstancedMesh && test(o)) { o.visible = false; list.push(o); } }); return () => { for (const o of list) o.visible = true; }; };
 const kinds = [
  ['whole models', o => o.userData.cullTotal !== undefined && (!!o.userData.model || o.userData.role === 'leaf')],
  ['other instanced things (grass, rough, rocks)', o => o.userData.cullTotal !== undefined && !(o.userData.model || o.userData.role === 'leaf')],
  ['far and middle versions', o => o.name === 'far trees'],
  ['fading across a swap', o => o.name === 'fading trees'],
  ['shadow stand-ins', o => o.name === 'shadow twin'],
 ];
 const out = {line: px + ' px'};
 for (const [spot, cam] of [['tee 1', {hole: 0, along: -4, height: 1.8, look: 'pin'}], ['250 m up', {hole: 0, along: -150, height: 250, look: 'pin'}]]) {
  window.lab.camera(cam);
  await frames(90);
  const whole = await count(), parts = [];
  for (const [name, test] of kinds) { const show = hide(test), c = await count(); show(); parts.push(`${name} ${m(whole - c)}`); }
  const shadows = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
  const still = await count(); r.shadowMap.autoUpdate = shadows;
  out[spot] = `whole ${m(whole)}; ${parts.join('; ')}; of all that, in shadow maps ${m(whole - still)}`;
 }
 return out;
}
