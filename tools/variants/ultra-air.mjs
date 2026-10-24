// What the per-pixel air costs on every lit surface: the clouds' shadows
// (MAX_CLOUDS disc tests a pixel) and the mist (three octaves of noise, the
// sheet, the water field, the aerial tint). Run 11 of the frame-rate goal.
// Diagnostics: each removes the call from every patched material's shader.
const strip = (tag, flag, from) => ({
 apply: `v._am = new Map(); v.group.traverse(o => { for (const m of [o.material].flat()) { if (!m || !m.userData?.${flag} || v._am.has(m)) continue; const was = m.onBeforeCompile, key = m.customProgramCacheKey; v._am.set(m, [was, key]);
   m.onBeforeCompile = function (s, r) { was.call(this, s, r); s.fragmentShader = s.fragmentShader.split(${JSON.stringify(from)}).join(''); };
   m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + ${JSON.stringify('-' + tag)}; }; m.needsUpdate = true; } });`,
 undo: 'for (const [m, [was, key]] of v._am) { m.onBeforeCompile = was; m.customProgramCacheKey = key; m.needsUpdate = true; }',
});
export const variants = [
 {name: 'no cloud shadows (diagnostic)', ...strip('nocloud', 'cloudShadowed', 'reflectedLight.directDiffuse*=cloudShadowAt(vCloudWorld);')},
 {name: 'no mist (diagnostic)', ...strip('nomist', 'mist', 'gl_FragColor.rgb=applyMist(gl_FragColor.rgb);')},
];
