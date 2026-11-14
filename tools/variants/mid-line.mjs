// WHAT THE MIDDLE VERSIONS COST OR SAVE ON ONE PAGE (the frame-rate pass, 13
// November 2026: Prairie & Sand Hills on Ultra read 25% SLOWER than 0.9.14
// with 40% fewer triangles). Each line of the tree ladder is moved alone,
// between unchanged frames, with the parts of a wide view hidden beside them:
//
//   node tools/frame-variants.mjs --goal surroundings --variants tools/variants/mid-line.mjs
//     --tier ultra --biome prairie --spots tee1,flyhigh --frames 120 --repeat 2
//
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const hide = (store, test) => ({
 apply: `v.${store} = []; v.group.traverse(o => { if (o.visible && (${test})) { o.visible = false; v.${store}.push(o); } });`,
 undo: `for (const o of v.${store} || []) o.visible = true;`,
});
const px = n => ({name: `middle versions under ${n} px`, apply: `v.cull.tune({farPaintedPx: ${n}});`, undo: 'v.cull.tune({farPaintedPx: null});'});
export const variants = [
 {name: 'no middle versions (whole, then the twin on the old line)', apply: 'v.cull.tune({farPaintedPx: 0});', undo: 'v.cull.tune({farPaintedPx: null});'},
 px(100), px(400),
 {name: 'course planting hidden (view + shadows)', ...hide('_mlPlant', 'o.isInstancedMesh && (o.userData.cullTotal !== undefined || o.name === "shadow twin")')},
 {name: 'far trees hidden', ...hide('_mlTrees', 'o.name === "Far trees"')},
 {name: 'far ground hidden', ...hide('_mlGround', 'o.name === "Far ground"')},
 {name: 'shadow maps frozen (all)', apply: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = false;', undo: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = true;'},
];
