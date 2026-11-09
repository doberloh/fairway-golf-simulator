// What the ground's shader spends a frame on (the frame-rate goal, 9 November
// 2026: on Dinosaur Mountain, High, drawing the ground was 40-65% of the
// card's frame once its triangles were cut -- its shading, not its geometry).
// For tools/frame-variants.mjs; `v` is the renderer. Each switches one of the
// ground's own cues off (renderer.js setGroundCues), or its shadows.
const cue = (k, off) => ({name: `ground ${k} off`, apply: `v._cue = {...v.groundCues}; v.setGroundCues({${k}: ${off}});`, undo: 'v.setGroundCues(v._cue);'});
export const variants = [
 {name: 'no ground drawn', apply: 'v.groundLod.group.visible = false;', undo: 'v.groundLod.group.visible = true;'},
 cue('relief', false), cue('slopeTint', false), cue('stripes', false), cue('sheen', false), cue('patches', 0), cue('shade', 0),
 {name: 'ground receives no shadow', apply: 'for (const m of v.groundLod.group.children) m.receiveShadow = false; v.terrain.material.needsUpdate = true;', undo: 'for (const m of v.groundLod.group.children) m.receiveShadow = true; v.terrain.material.needsUpdate = true;'},
 {name: 'half the pixels (dpr x 0.7)', apply: 'v._pr = v.renderer.getPixelRatio(); v.renderer.setPixelRatio(v._pr * .7);', undo: 'v.renderer.setPixelRatio(v._pr);'},
];
