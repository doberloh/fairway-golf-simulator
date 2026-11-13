// The surroundings' far trees (far-trees.js; until the surroundings rework of
// 12 November 2026 this hid the polish goal's far woods and groves): what they
// cost a frame, measured by hiding them on the same page, between base frames.
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const meshes = 'const list = []; v.group.traverse(o => { if (o.name === "Far trees") list.push(o); });';
export const variants = [
 {name: 'far trees hidden', apply: `${meshes} v._ft = list.filter(o => o.visible); for (const o of v._ft) o.visible = false;`, undo: 'for (const o of v._ft || []) o.visible = true;'},
 {name: 'far ground hidden', apply: 'v._fg = []; v.group.traverse(o => { if (o.name === "Far ground" && o.visible) { o.visible = false; v._fg.push(o); } });', undo: 'for (const o of v._fg || []) o.visible = true;'},
];
