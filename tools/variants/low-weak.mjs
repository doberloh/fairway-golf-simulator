// What Low could still give back for a weak laptop (the frame-rate goal, 9
// November 2026: Dinosaur Mountain on Low, 15 M triangles a frame, estimated
// 112-362 ms on an Intel UHD 620). For tools/frame-variants.mjs --tier low.
const low = (name, rules) => ({name, apply: `v.cull.tune({lowTrees: ${JSON.stringify(rules)}});`, undo: 'v.cull.tune({lowTrees: null});'});
const tol = px => ({name: `ground tolerance ${px} px`, apply: `v._tol = v.quality.groundTolerance; v.quality.groundTolerance = ${px}; v.groundLod.key = '';`, undo: `v.quality.groundTolerance = v._tol; v.groundLod.key = '';`});
const each = (code) => `v.group.traverse(o => { ${code} });`;
export const variants = [
 low('trees: a tenth kept far off', {minKeep: .1}),
 low('trees: thinned from 60 m, to a tenth by 400 m', {nearAll: 60, thinTo: 400, minKeep: .1}),
 tol(8), tol(16),
 {name: 'no shadow maps at all', apply: 'v._sm = v.renderer.shadowMap.autoUpdate; v.renderer.shadowMap.autoUpdate = false;', undo: 'v.renderer.shadowMap.autoUpdate = v._sm;'},
 {name: 'far versions from 50% of screen', apply: 'v.cull.tune({farPainted: .5, farTrees: .5});', undo: 'v.cull.tune({farPainted: null, farTrees: null});'},
 {name: 'no model trees drawn', apply: each('if (o.isInstancedMesh && o.userData.model) { o.userData._v = o.visible; o.visible = false; }'), undo: each('if (o.isInstancedMesh && o.userData.model) o.visible = o.userData._v ?? true;')},
 {name: 'no ground drawn', apply: 'v.groundLod.group.visible = false;', undo: 'v.groundLod.group.visible = true;'},
];
