// The polish goal's far woods (vegetation.js addFarWoods): what they cost a
// frame, measured by hiding them on the same page, between base frames. For
// tools/frame-variants.mjs; `v` is the renderer. Diagnostics, not changes.
const meshes = 'const list = []; v.group.traverse(o => { if (o.name === "Far woods" || o.name === "Far groves") list.push(o); });';
export const variants = [
 {name: 'far woods and groves hidden', apply: `${meshes} v._fw = list.filter(o => o.visible); for (const o of v._fw) o.visible = false;`, undo: 'for (const o of v._fw) o.visible = true;'},
 {name: 'far groves hidden (near crowns kept)', apply: 'v._fg = []; v.group.traverse(o => { if (o.name === "Far groves" && o.visible) { o.visible = false; v._fg.push(o); } });', undo: 'for (const o of v._fg) o.visible = true;'},
];
