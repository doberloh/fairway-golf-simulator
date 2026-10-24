// Where an Ultra frame goes: each pass switched off or cut back, alone.
// For tools/frame-variants.mjs; `v` is the renderer (GolfView).
const resize = size => `for (const l of v.csm?.lights ?? []) { l.shadow.mapSize.set(${size}, ${size}); l.shadow.map?.dispose(); l.shadow.map = null; }`;
export const variants = [
 {name: 'shadow maps frozen (all)', apply: 'for (const l of v.csm.lights) l.shadow.autoUpdate = false;', undo: 'for (const l of v.csm.lights) l.shadow.autoUpdate = true;'},
 {name: 'far cascade (3) frozen', apply: 'v.csm.lights[2].shadow.autoUpdate = false;', undo: 'v.csm.lights[2].shadow.autoUpdate = true;'},
 {name: 'mid cascade (2) frozen', apply: 'v.csm.lights[1].shadow.autoUpdate = false;', undo: 'v.csm.lights[1].shadow.autoUpdate = true;'},
 {name: 'near cascade (1) frozen', apply: 'v.csm.lights[0].shadow.autoUpdate = false;', undo: 'v.csm.lights[0].shadow.autoUpdate = true;'},
 {name: 'shadow maps 4096', apply: resize(4096), undo: resize(6144)},
 {name: 'bloom off', apply: 'v._bloom = v.bloom; v.bloom = null;', undo: 'v.bloom = v._bloom;'},
 {name: 'terrain casts no shadow', apply: 'v.terrain.castShadow = false;', undo: 'v.terrain.castShadow = true;'},
 {name: 'planting hidden (view + shadows)', apply: 'v._hid = []; v.group.traverse(o => { if (o.isInstancedMesh && o.visible && (o.userData.cullTotal !== undefined || o.name === "shadow twin")) { o.visible = false; v._hid.push(o); } });',
  undo: 'for (const o of v._hid) o.visible = true;'},
 {name: 'pixel ratio 1.5', apply: 'v.renderer.setPixelRatio(1.5);', undo: 'v.renderer.setPixelRatio(2);'},
];
