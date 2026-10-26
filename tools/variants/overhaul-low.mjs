// The cartoon overhaul's frame-rate pass, Low and Medium: how soon the
// painted trees could swap to their far twins. For tools/frame-variants.mjs;
// `v` is the renderer. Diagnostics, not changes.
export const variants = [
 {name: 'far twins below 25% of the screen', apply: 'v.cull.tune({farPainted: .25});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'far twins below 40% of the screen', apply: 'v.cull.tune({farPainted: .4});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'far twins everywhere', apply: 'v.cull.tune({farPainted: 100});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'long grass hidden', apply: 'v._lg = v.group.getObjectByName("Long grass"); if (v._lg) v._lg.visible = false;', undo: 'if (v._lg) v._lg.visible = true;'},
];
