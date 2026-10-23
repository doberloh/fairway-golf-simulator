// Low and Medium have one sun shadow map, redrawn every frame, and none of the
// passes the Ultra work made cheaper (run 24 of the frame-rate goal). For
// tools/frame-variants.mjs; `v` is the renderer.
export const variants = [
 {name: 'sun map frozen', apply: 'v.sun.shadow.autoUpdate = false;', undo: 'v.sun.shadow.autoUpdate = true;'},
 {name: 'sun map every other frame', apply: 'v._r = v.render; let f = 0; v.render = function (dt) { this.sun.shadow.autoUpdate = (++f % 2) === 0; return v._r.call(this, dt); };',
  undo: 'v.render = v._r; v.sun.shadow.autoUpdate = true;'},
 {name: 'planting hidden (diagnostic)', apply: 'v._hid = []; v.group.traverse(o => { if (o.isInstancedMesh && o.visible && o.userData.cullTotal !== undefined) { o.visible = false; v._hid.push(o); } });',
  undo: 'for (const o of v._hid) o.visible = true;'},
];
