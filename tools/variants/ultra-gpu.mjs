// What is left of an Ultra frame once the processor stopped setting it
// (after the 22 October checkpoint): the graphics passes, one at a time.
// For tools/frame-variants.mjs; `v` is the renderer (GolfView). The cascades
// are scheduled each frame (scheduleCascades), so a cascade is frozen by
// wrapping the schedule, not by setting autoUpdate once.
const freeze = i => ({
 apply: `v._sched = v.scheduleCascades; v.scheduleCascades = function () { v._sched.call(this); this.csm.lights[${i}].shadow.autoUpdate = false; };`,
 undo: 'v.scheduleCascades = v._sched;',
});
const resize = (size, which = 'all') => `for (const [i, l] of (v.csm?.lights ?? []).entries()) { if (${JSON.stringify(which)} !== 'all' && i !== ${which === 'all' ? -1 : which}) continue; l.shadow.mapSize.set(${size}, ${size}); l.shadow.map?.dispose(); l.shadow.map = null; } v.cascadeForce = true;`;
export const variants = [
 {name: 'far cascade frozen', ...freeze(2)},
 {name: 'mid cascade frozen', ...freeze(1)},
 {name: 'near cascade frozen', ...freeze(0)},
 {name: 'near map 4096', apply: resize(4096, 0), undo: resize(6144, 0)},
 {name: 'all maps 4096', apply: resize(4096), undo: resize(6144)},
 {name: 'terrain casts no shadow', apply: 'v.terrain.castShadow = false;', undo: 'v.terrain.castShadow = true;'},
 {name: 'bloom off', apply: 'v._bloom = v.bloom; v.bloom = null;', undo: 'v.bloom = v._bloom;'},
 {name: 'planting hidden', apply: 'v._hid = []; v.group.traverse(o => { if (o.isInstancedMesh && o.visible && (o.userData.cullTotal !== undefined || o.name === "shadow twin")) { o.visible = false; v._hid.push(o); } });',
  undo: 'for (const o of v._hid) o.visible = true;'},
 {name: 'planting casts no shadow', apply: 'v._cast = []; v.group.traverse(o => { if (o.isInstancedMesh && o.castShadow) { o.castShadow = false; v._cast.push(o); } });',
  undo: 'for (const o of v._cast) o.castShadow = true;'},
];
