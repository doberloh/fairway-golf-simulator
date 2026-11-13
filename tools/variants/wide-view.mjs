// Where a WIDE view's frame goes (the surroundings rework, round 11; the owner,
// 13 November 2026: "framerates when looking across a whole landscape are
// tending to tank"). Each part of what such a view draws is hidden alone,
// between base frames, from a spot that looks across the whole course:
//
//   node tools/frame-variants.mjs --goal surroundings --variants tools/variants/wide-view.mjs
//     --tier ultra --biome mountains --spots flyhigh,overview --frames 120 --repeat 2
//
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const hide = (store, test) => ({
 apply: `v.${store} = []; v.group.traverse(o => { if (o.visible && (${test})) { o.visible = false; v.${store}.push(o); } });`,
 undo: `for (const o of v.${store} || []) o.visible = true;`,
});
export const variants = [
 {name: 'far trees hidden', ...hide('_wvTrees', 'o.name === "Far trees"')},
 {name: 'far ground hidden', ...hide('_wvGround', 'o.name === "Far ground"')},
 {name: 'course planting hidden (view + shadows)', ...hide('_wvPlant', 'o.isInstancedMesh && (o.userData.cullTotal !== undefined || o.name === "shadow twin")')},
 {name: 'shadow maps frozen (all)', apply: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = false;', undo: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = true;'},
 {name: 'bloom off', apply: 'v._wvBloom = v.bloom; v.bloom = null;', undo: 'v.bloom = v._wvBloom;'},
 {name: 'pixel ratio 1', apply: 'v._wvRatio = v.renderer.getPixelRatio(); v.renderer.setPixelRatio(1);', undo: 'v.renderer.setPixelRatio(v._wvRatio);'},
];
