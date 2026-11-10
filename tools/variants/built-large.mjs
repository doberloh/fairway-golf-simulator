// Where a large built course's frame goes (the frame-rate goal, 9 November
// 2026: Dinosaur Mountain, 233 M triangles a frame on High). For
// tools/frame-variants.mjs --built; `v` is the renderer (GolfView). Each is a
// price, not a change: what the frame would cost without that piece, or with
// the trees swapped to their far versions sooner.
const each = (code) => `v.group.traverse(o => { ${code} });`;
export const variants = [
 // The ground is drawn as squares since 9 November (ground-lod.js): its group.
 {name: 'no ground drawn', apply: 'v.groundLod.group.visible = false;', undo: 'v.groundLod.group.visible = true;'},
 {name: 'ground casts no shadow', apply: 'v.terrain.castShadow = false;', undo: 'v.terrain.castShadow = true;'},
 {name: 'no shadow maps at all', apply: 'v._sm = v.renderer.shadowMap.autoUpdate; v.renderer.shadowMap.autoUpdate = false;', undo: 'v.renderer.shadowMap.autoUpdate = v._sm;'},
 {name: 'no model trees drawn', apply: each('if (o.isInstancedMesh && o.userData.model) { o.userData._v = o.visible; o.visible = false; }'), undo: each('if (o.isInstancedMesh && o.userData.model) o.visible = o.userData._v ?? true;')},
 {name: 'no homes or buildings', apply: each('if (o.isMesh && !o.isInstancedMesh && o !== v.terrain && !String(o.name).startsWith("ground,")) { o.userData._v = o.visible; o.visible = false; }'), undo: each('if (o.isMesh && !o.isInstancedMesh && o.userData._v !== undefined) { o.visible = o.userData._v; delete o.userData._v; }')},
 {name: 'far versions from 15% of screen', apply: 'v.cull.tune({farPainted: .15});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'far versions from 34% of screen', apply: 'v.cull.tune({farPainted: .34});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'tree shadows thinned from map 0', apply: 'v.cull.tune({thinShadowsFrom: 0});', undo: 'v.cull.tune({thinShadowsFrom: null});'},
];
