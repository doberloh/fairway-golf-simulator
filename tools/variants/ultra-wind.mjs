// What the trees' wind costs per vertex (run 10 of the frame-rate goal). For
// tools/frame-variants.mjs; `v` is the renderer. Each patches the tree
// materials' vertex shader through their own onBeforeCompile -- called WITH
// the material as `this`, which the cascade wrapper needs (run 7's attempt
// called it bare and the programs failed to build).
const patch = (tag, from, to) => ({
 apply: `const list = []; v.group.traverse(o => { if (o.isInstancedMesh && o.userData.cullTotal !== undefined) list.push(o); }); v._wm = new Map();
  for (const o of list) { const m = o.material; if (v._wm.has(m) || !m.onBeforeCompile) continue; const was = m.onBeforeCompile, key = m.customProgramCacheKey; v._wm.set(m, [was, key]);
   m.onBeforeCompile = function (s, r) { was.call(this, s, r); s.vertexShader = s.vertexShader.replace(${from}, ${JSON.stringify(to)}); };
   m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + ${JSON.stringify('-' + tag)}; }; m.needsUpdate = true; }`,
 undo: 'for (const [m, [was, key]] of v._wm) { m.onBeforeCompile = was; m.customProgramCacheKey = key; m.needsUpdate = true; }',
});
export const variants = [
 {name: 'gust constant', ...patch('flatgust', '/float gust=smoothstep[^;]*;/', 'float gust=.5;')},
 {name: 'gust one octave', ...patch('onegust', '/float gust=smoothstep[(][.]35,[.]8,(gustNoise[(]vec2[(]downwind[/]45[.],crossing[/]160[.][)][)])[*][.]75[^;]*;/', 'float gust=smoothstep(.35,.8,$1);')},
];
