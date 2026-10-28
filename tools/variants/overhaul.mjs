// The cartoon overhaul's frame-rate pass: what each lever would save on a
// High frame, before any is built. For tools/frame-variants.mjs; `v` is the
// renderer. Diagnostics, not changes.
const BRUSH = /Blender_(Creosote|Brittlebush|Sagebrush|Bracken|Huckleberry|Shrub|Gorse|Heather|Fern|Bramble|Naupaka|Agave|Cholla)/;
const brush = 'const list = []; v.group.traverse(o => { if (o.isInstancedMesh && (BRUSH.test(o.userData.model ?? "") || BRUSH.test(o.userData.farOf?.userData.model ?? ""))) list.push(o); });';
const withBrush = code => `const BRUSH = ${BRUSH}; ${brush} ${code}`;
export const variants = [
 {name: 'far twins below 8% of the screen', apply: 'v.cull.tune({farPainted: .08});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'far twins below 12% of the screen', apply: 'v.cull.tune({farPainted: .12});', undo: 'v.cull.tune({farPainted: null});'},
 {name: 'brush casts no shadow', apply: withBrush('v._bs = list.filter(o => o.castShadow); for (const o of v._bs) o.castShadow = false;'),
  undo: 'for (const o of v._bs) o.castShadow = true;'},
 {name: 'brush hidden', apply: withBrush('v._bh = list.filter(o => o.visible); for (const o of v._bh) o.visible = false;'),
  undo: 'for (const o of v._bh) o.visible = true;'},
 {name: 'long grass hidden', apply: 'v._lg = v.group.getObjectByName("Long grass"); v._lg.visible = false;', undo: 'v._lg.visible = true;'},
 {name: 'trees cast no shadow', apply: 'v._ts = []; v.group.traverse(o => { if (o.isInstancedMesh && o.userData.cullTotal !== undefined && o.castShadow) { o.castShadow = false; v._ts.push(o); } });',
  undo: 'for (const o of v._ts) o.castShadow = true;'},
];
