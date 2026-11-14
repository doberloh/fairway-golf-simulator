// WHICH MESHES DRAW A FRAME'S TRIANGLES, PASS BY PASS (the frame-rate pass,
// 13 November 2026). For tools/capture/overhaul.mjs --eval: from hole 1's
// back tee, every instanced mesh's triangles in the picture and in each
// shadow map (asked of the mesh's own before-shadow rule, as the renderer
// asks it), heaviest first. `?farPx=` or `window.__farPx` moves the middle
// version's line (150 on a 900-line picture stands for 300 on 1,800 lines).
async v => {
 const frames = n => new Promise(done => { let i = 0; const step = () => (++i < n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); });
 v.cull.tune({farPaintedPx: window.__farPx || 150});
 window.lab.camera({hole: 0, along: -4, height: 1.8, look: 'pin'});
 await frames(120);
 const maps = (v.csm?.lights ?? []).map(l => l.shadow.camera), by = new Map();
 v.group.traverse(o => {
  if (!o.isInstancedMesh || !o.visible) return;
  const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  const kind = o.name === 'far trees' ? 'far/middle' : o.name === 'fading trees' ? 'fading' : o.name === 'shadow twin' ? 'stand-in' : 'whole';
  const key = `${o.userData.model ?? o.userData.fadeOf?.userData.model ?? o.userData.farOf?.userData.model ?? o.parent?.name ?? o.name} [${kind}]`;
  const row = by.get(key) ?? {key, picture: 0, maps: maps.map(() => 0), tris: 0};
  // The picture: a stand-in draws none (its before-render rule), the rest their count.
  row.picture += kind === 'stand-in' ? 0 : o.count * tris;
  if (o.castShadow) maps.forEach((cam, k) => {
   const held = o.count;
   o.onBeforeShadow?.(null, o, null, cam);
   row.maps[k] += o.count * tris;
   if (o.onAfterShadow) o.onAfterShadow(); else o.count = held;
   o.count = held; o.userData.cullHeld = undefined;
  });
  row.tris = Math.max(row.tris, tris);
  by.set(key, row);
 });
 const rows = [...by.values()].map(r => ({...r, all: r.picture + r.maps.reduce((a, b) => a + b, 0)})).sort((a, b) => b.all - a.all);
 const m = n => (n / 1e6).toFixed(2);
 const sum = k => rows.reduce((a, r) => a + (k < 0 ? r.picture : r.maps[k]), 0);
 return {total: `picture ${m(sum(-1))} M; shadow maps ${maps.map((_, k) => m(sum(k))).join(' / ')} M`,
  top: rows.slice(0, 22).map(r => `${r.key.padEnd(44)} ${String(Math.round(r.tris)).padStart(6)} tris  picture ${m(r.picture).padStart(6)}  maps ${r.maps.map(x => m(x).padStart(6)).join(' ')}`)};
}
