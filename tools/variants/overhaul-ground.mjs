// The cartoon overhaul's frame-rate pass: what the ground costs, on main's
// build and the branch's alike. For tools/frame-variants.mjs; `v` is the
// renderer. Diagnostics, not changes.
export const variants = [
 {name: 'ground hidden', apply: 'v.terrain.visible = false; v.landscape.visible = false;', undo: 'v.terrain.visible = true; v.landscape.visible = true;'},
 {name: 'ground casts no shadow', apply: 'v._gc = v.terrain.castShadow; v.terrain.castShadow = false;', undo: 'v.terrain.castShadow = v._gc;'},
 // The ground's live uniforms, as three keeps them for the compiled program.
 {name: 'far forest off', apply: 'const u = v.renderer.properties.get(v.terrain.material).uniforms; v._ff = u.farOn; if (v._ff) { v._ffv = v._ff.value; v._ff.value = 0; }',
  undo: 'if (v._ff) v._ff.value = v._ffv;'},
];
