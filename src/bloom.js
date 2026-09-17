import * as T from 'three';

// Bloom. The one effect that cannot avoid a render target, because unlike the
// god rays and the ambient occlusion it needs the rendered colour back.
//
// The scene therefore no longer draws straight to the canvas. It draws to a
// **multisampled** target (`samples: 4`) which resolves with its anti-aliasing
// intact -- get that wrong and the high tier looks softer than medium, which
// would be a bad trade for a glow. Everything that composites over the frame
// (occlusion, god rays) is drawn into the same target before the bright pass
// runs, so they bloom along with the scene rather than being pasted on after.

const BLUR = `
 varying vec2 vUv;uniform sampler2D tSource;uniform vec2 direction;
 void main(){
  // Nine-tap gaussian, separable, run once per axis at quarter resolution.
  vec4 sum=texture2D(tSource,vUv)*.227027;
  sum+=texture2D(tSource,vUv+direction*1.3846)*.316216;
  sum+=texture2D(tSource,vUv-direction*1.3846)*.316216;
  sum+=texture2D(tSource,vUv+direction*3.2308)*.070270;
  sum+=texture2D(tSource,vUv-direction*3.2308)*.070270;
  gl_FragColor=sum;
 }`;

const quadVertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

export function makeBloom(view, scale = .25) {
 const scene = new T.WebGLRenderTarget(2, 2, {samples: 4, depthBuffer: true, stencilBuffer: false});
 scene.texture.minFilter = scene.texture.magFilter = T.LinearFilter;
 const bright = new T.WebGLRenderTarget(2, 2, {depthBuffer: false, stencilBuffer: false});
 const blur = new T.WebGLRenderTarget(2, 2, {depthBuffer: false, stencilBuffer: false});
 for (const t of [bright, blur]) t.texture.minFilter = t.texture.magFilter = T.LinearFilter;

 const brightMaterial = new T.ShaderMaterial({
  uniforms: {tSource: {value: null}, threshold: {value: 1.05}, knee: {value: .3}},
  vertexShader: quadVertex,
  fragmentShader: `
   varying vec2 vUv;uniform sampler2D tSource;uniform float threshold,knee;
   void main(){
    vec3 c=texture2D(tSource,vUv).rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));
    // Soft knee, so a highlight eases into blooming instead of switching on.
    float w=smoothstep(threshold-knee,threshold+knee,l);
    gl_FragColor=vec4(c*w,1.);
   }`,
 });
 const blurMaterial = new T.ShaderMaterial({
  uniforms: {tSource: {value: null}, direction: {value: new T.Vector2()}},
  vertexShader: quadVertex, fragmentShader: BLUR,
 });
 const compositeMaterial = new T.ShaderMaterial({
  uniforms: {tScene: {value: scene.texture}, tBloom: {value: blur.texture}, strength: {value: 0}},
  vertexShader: quadVertex,
  fragmentShader: `
   // No _pars_ includes: three already injects both declaration chunks into the
   // fragment prefix of a ShaderMaterial, and including them again is a
   // redefinition of toneMappingExposure that fails to compile.
   varying vec2 vUv;uniform sampler2D tScene,tBloom;uniform float strength;
   void main(){
    // Additive: the scene passes through untouched and the glow is laid over
    // it, so nothing about the underlying image is softened.
    gl_FragColor=vec4(texture2D(tScene,vUv).rgb+texture2D(tBloom,vUv).rgb*strength,1.);
    // Rendering to a target costs the scene BOTH of the steps a normal material
    // ends with, and this composite has to put them back. three skips tone
    // mapping entirely unless the render target is null (WebGLPrograms: "if
    // currentRenderTarget === null"), and writes the working colour space --
    // linear -- rather than sRGB (WebGLRenderer: the colorSpace ternary). Miss
    // them and the whole tier renders untonemapped and ungamma'd, which reads
    // as a much darker, oddly warm picture. Both chunks resolve correctly here
    // because this pass draws to the canvas.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
  depthTest: false, depthWrite: false,
 });

 const quad = new T.Mesh(new T.PlaneGeometry(2, 2), brightMaterial);
 quad.frustumCulled = false;
 const quadScene = new T.Scene();
 quadScene.add(quad);
 const quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
 const draw = (renderer, material, target) => {
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.clear(true, false, false);
  renderer.render(quadScene, quadCamera);
 };

 // Bind before the scene is drawn.
 function begin(renderer) {
  const size = renderer.getSize(new T.Vector2());
  const pixel = renderer.getPixelRatio();
  const w = Math.max(2, Math.floor(size.x * pixel)), h = Math.max(2, Math.floor(size.y * pixel));
  if (scene.width !== w || scene.height !== h) {
   scene.setSize(w, h);
   bright.setSize(Math.max(2, Math.floor(w * scale)), Math.max(2, Math.floor(h * scale)));
   blur.setSize(Math.max(2, Math.floor(w * scale)), Math.max(2, Math.floor(h * scale)));
  }
  renderer.setRenderTarget(scene);
  return scene;
 }

 // Bright pass, two-axis blur, then the composite that finally reaches the
 // canvas. Called after everything that composites over the frame has run.
 function finish(renderer) {
  const strength = view.quality.bloom || 0;
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  brightMaterial.uniforms.tSource.value = scene.texture;
  draw(renderer, brightMaterial, bright);
  blurMaterial.uniforms.tSource.value = bright.texture;
  blurMaterial.uniforms.direction.value.set(1 / bright.width, 0);
  draw(renderer, blurMaterial, blur);
  blurMaterial.uniforms.tSource.value = blur.texture;
  blurMaterial.uniforms.direction.value.set(0, 1 / blur.height);
  draw(renderer, blurMaterial, bright);
  compositeMaterial.uniforms.tBloom.value = bright.texture;
  compositeMaterial.uniforms.strength.value = strength;
  draw(renderer, compositeMaterial, null);
  renderer.autoClear = autoClear;
 }

 function dispose() {
  scene.dispose(); bright.dispose(); blur.dispose();
  brightMaterial.dispose(); blurMaterial.dispose(); compositeMaterial.dispose();
  quad.geometry.dispose();
 }

 return {begin, finish, dispose};
}
