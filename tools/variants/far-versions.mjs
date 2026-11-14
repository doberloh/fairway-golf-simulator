// WHERE A TREE TURNS TO ITS FAR VERSION (the frame-rate pass, 13 November
// 2026): the line -- a crown's height as a share of the screen's, graphics.js
// `farPainted` -- moved on one page, each setting between unchanged frames.
//
//   node tools/frame-variants.mjs --goal surroundings --variants tools/variants/far-versions.mjs
//     --tier high --biome mountains --spots tee1,tee5,flyhigh
//
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const at = share => ({name: `far versions from ${share} of the screen`, apply: `v.cull.tune({farPainted: ${share}});`, undo: 'v.cull.tune({farPainted: null});'});
export const variants = [at(.08), at(.12), at(.18), at(.25), at(.4)];
