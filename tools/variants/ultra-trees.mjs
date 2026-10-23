// What a tree costs to draw, part by part (run 7 of the frame-rate goal).
// For tools/frame-variants.mjs; `v` is the renderer. Diagnostics: each says how
// much one part of the trees' work is worth, not a change to make.
const trees = 'v.group.traverse(o => { if (o.isInstancedMesh && o.userData.cullTotal !== undefined) list.push(o); });';
export const variants = [
 // The gust field is two octaves of hashed noise PER VERTEX, though it only
 // depends on the plant's root: a constant gust says what that costs.
 {name: 'trees: gust noise constant',
  apply: `const list = []; ${trees} v._gm = new Map(); for (const o of list) { const m = o.material; if (v._gm.has(m) || !m.onBeforeCompile) continue; const was = m.onBeforeCompile, key = m.customProgramCacheKey; v._gm.set(m, [was, key]); m.onBeforeCompile = (s, r) => { was(s, r); s.vertexShader = s.vertexShader.replace(/float gust=smoothstep[^;]*;/, 'float gust=.5;'); }; m.customProgramCacheKey = () => key() + '-flatgust'; m.needsUpdate = true; }`,
  undo: 'for (const [m, [was, key]] of v._gm) { m.onBeforeCompile = was; m.customProgramCacheKey = key; m.needsUpdate = true; }'},
 {name: 'trees: receive no shadows', apply: `const list = []; ${trees} v._rs = list.filter(o => o.receiveShadow); for (const o of v._rs) o.receiveShadow = false;`,
  undo: 'for (const o of v._rs) o.receiveShadow = true;'},
 {name: 'ground cover hidden', apply: 'v._gc = []; v.group.traverse(o => { if ((o.name === "Living rough" || o.name === "Deadfall") && o.visible) { o.visible = false; v._gc.push(o); } });',
  undo: 'for (const o of v._gc) o.visible = true;'},
 {name: 'far cascade every 4th frame', apply: 'v._sched = v.scheduleCascades; v.scheduleCascades = function () { v._sched.call(this); const l = this.csm.lights[2]; if (this.cascadeFrame % 4 !== 2 && l.shadow.map) l.shadow.autoUpdate = false; };',
  undo: 'v.scheduleCascades = v._sched;'},
];
