// WHERE AN OPEN LANDSCAPE'S FRAME GOES (the frame-rate pass, 14 November 2026).
// Prairie & Sand Hills on Ultra read 58 to 67% more card time than 0.9.14 with
// the card's clock held equal, for fewer triangles and draws; hiding the
// planting, the far ground or the far trees had explained little. Each thing
// that fills pixels or runs each frame is switched off alone, between
// unchanged frames:
//
//   node tools/frame-variants.mjs --goal surroundings --variants tools/variants/open-country.mjs
//     --tier ultra --biome prairie --spots tee1,flyhigh --frames 200 --repeat 2
//
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const hide = (store, test) => ({
 apply: `v.${store} = []; v.group.traverse(o => { if (o.visible && (${test})) { o.visible = false; v.${store}.push(o); } });`,
 undo: `for (const o of v.${store} || []) o.visible = true;`,
});
const quality = (key, off) => ({apply: `v._ocq = v.quality.${key}; v.quality.${key} = ${off};`, undo: `v.quality.${key} = v._ocq;`});
export const variants = [
 {name: 'pixel ratio 1', apply: 'v._ocRatio = v.renderer.getPixelRatio(); v.renderer.setPixelRatio(1);', undo: 'v.renderer.setPixelRatio(v._ocRatio);'},
 {name: 'far ground hidden', ...hide('_ocFar', 'o.name === "Far ground"')},
 {name: 'course ground hidden', ...hide('_ocGround', 'o.name === "Continuous ground"')},
 {name: 'every instanced mesh hidden', ...hide('_ocInst', 'o.isInstancedMesh')},
 {name: 'planting through the cull hidden', ...hide('_ocPlant', 'o.isInstancedMesh && (o.userData.cullTotal !== undefined || o.name === "shadow twin" || o.name === "far trees" || o.name === "fading trees")')},
 {name: 'far trees hidden', ...hide('_ocTrees', 'o.name === "Far trees"')},
 {name: 'shadow maps frozen (all)', apply: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = false;', undo: 'for (const l of v.csm?.lights ?? []) l.shadow.autoUpdate = true;'},
 {name: 'sun rays off', ...quality('godRays', 0)},
 {name: 'bloom off', apply: 'v._ocBloom = v.bloom; v.bloom = null;', undo: 'v.bloom = v._ocBloom;'},
 {name: 'water hidden', ...hide('_ocWater', '/water|pond|lake|sea|stream|foam/i.test(o.name)')},
];
