// WHAT A WIDE VIEW DRAWS, BY COUNT (the surroundings rework, round 11; the
// owner, 13 November 2026: "framerates when looking across a whole landscape
// are tending to tank"). For tools/capture/overhaul.mjs --eval: a function of
// the renderer, run once the course is built. It stands 250 m over the first
// tee looking down the course (the frame tools' `flyhigh`), and counts the
// triangles and draws of one whole frame -- every pass: the picture, the
// shadow maps, the reflections -- as it is, and again with each part hidden.
//
//   node tools/capture/overhaul.mjs <label> <landscapes> --views overview --tier ultra
//     --goal surroundings --eval "$(cat tools/variants/wide-count.js)"
//
// Counts, not times: a few frames on the card, so it runs when a frame-rate
// comparison (minutes of the card flat out) cannot. A count says where the
// work is; only tools/frame-ab.mjs says what a change is worth.
async v => {
 const r = v.renderer, frames = n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); });
 window.lab.camera({hole: 0, along: -150, height: 250, look: 'pin'});
 await frames(90);
 const auto = r.info.autoReset;
 const count = async () => {
  await frames(20);
  r.info.autoReset = false; r.info.reset();
  await frames(1);
  const out = {triangles: r.info.render.triangles, draws: r.info.render.calls};
  r.info.autoReset = auto;
  return out;
 };
 const hide = test => { const list = []; v.group.traverse(o => { if (o.visible && test(o)) { o.visible = false; list.push(o); } }); return () => { for (const o of list) o.visible = true; }; };
 const out = {};
 out.whole = await count();
 for (const [name, test] of [
  ['far trees', o => o.name === 'Far trees'],
  ['far ground', o => o.name === 'Far ground'],
  ['course planting', o => o.isInstancedMesh && (o.userData.cullTotal !== undefined || o.name === 'shadow twin' || o.name === 'far trees')],
 ]) {
  const show = hide(test), c = await count();
  show();
  out[name] = {triangles: out.whole.triangles - c.triangles, draws: out.whole.draws - c.draws};
 }
 out.farTreeSites = v.farTrees?.count ?? 0;
 const m = n => (n / 1e6).toFixed(2) + ' M';
 return Object.fromEntries(Object.entries(out).map(([k, c]) => [k, typeof c === 'number' ? c : `${m(c.triangles)} triangles, ${c.draws} draws`]));
}
