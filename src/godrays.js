import * as T from 'three';

// Crepuscular rays, composited additively over the finished frame.
//
// Deliberately not built on EffectComposer. Routing the scene through a render
// target costs the canvas its MSAA, and the high tier looking *more* jagged than
// medium would be a poor trade for some light shafts. So the scene still renders
// straight to the canvas exactly as it always has, and this draws one extra
// full-screen quad on top with additive blending. Nothing reads the scene colour
// back, and nothing blurs it -- the turf boundaries the art direction is built
// on are untouched, which is the narrow condition postprocessing was allowed
// under.
//
// The shafts come from an occlusion mask rendered at a fraction of the screen
// size: sky cleared to white, every solid thing drawn flat black. Radially
// smearing that mask away from the sun is what makes the beams.

const SAMPLES = 48;

const COMPOSITE = {
 uniforms: {
  tMask: {value: null}, sunPos: {value: new T.Vector2(.5, .5)},
  sunColor: {value: new T.Color('#ffe6b8')}, intensity: {value: 0},
  decay: {value: .955}, density: {value: .9}, weight: {value: .038},
 },
 vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader: `
  varying vec2 vUv;uniform sampler2D tMask;uniform vec2 sunPos;uniform vec3 sunColor;
  uniform float intensity,decay,density,weight;
  void main(){
   if(intensity<=0.){discard;}
   vec2 delta=(vUv-sunPos)*(density/float(${SAMPLES}));
   vec2 coord=vUv;float illum=1.,acc=0.;
   for(int i=0;i<${SAMPLES};i++){
    coord-=delta;
    // Weighting each tap by its distance from the sun is what makes this a sun
    // rather than a glowing sky. Treating the whole sky as the emitter floods
    // the frame with a flat wash and no beams at all.
    float near=1.-smoothstep(0.,.26,distance(coord,sunPos));
    // Clamping rather than discarding keeps a shaft that runs off the edge of
    // the screen from ending in a hard line.
    acc+=texture2D(tMask,clamp(coord,0.,1.)).r*illum*weight*near;
    illum*=decay;
   }
   // Roll the accumulated light off so it approaches, rather than reaches, full
   // brightness. Adding it raw clipped the whole area round the sun to flat
   // white and took the sky gradient and the clouds with it.
   acc=acc/(1.+acc);
   gl_FragColor=vec4(sunColor*acc*intensity,1.);
  }`,
};

export function makeGodRays(view, scale = .25) {
 const target = new T.WebGLRenderTarget(2, 2, {depthBuffer: true, stencilBuffer: false});
 target.texture.minFilter = target.texture.magFilter = T.LinearFilter;
 const black = new T.MeshBasicMaterial({color: '#000'});
 const material = new T.ShaderMaterial({
  ...COMPOSITE, uniforms: T.UniformsUtils.clone(COMPOSITE.uniforms),
  transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false,
 });
 const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
 quad.frustumCulled = false;
 const quadScene = new T.Scene();
 quadScene.add(quad);
 const quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
 const sunPoint = new T.Vector3(), toSun = new T.Vector3(), forward = new T.Vector3();

 // `warm`: run the whole pass whatever the sun is doing, drawing nothing. For
 // the one frame drawn behind the loading screen (GolfView.ready), so the mask's
 // black programs and the composite are built AND drawn there. Skipped while
 // the sun is out of shot, they were built the first time a player turned to
 // face it -- 8 s frozen in the owner's Chrome on Ultra, 9 October (RESEARCH,
 // *The studio froze when the camera turned to the sun*).
 function render(renderer, scene, camera, sunDir, sunColor, warm = false) {
  const size = renderer.getSize(new T.Vector2());
  const w = Math.max(2, Math.floor(size.x * scale)), h = Math.max(2, Math.floor(size.y * scale));
  if (target.width !== w || target.height !== h) target.setSize(w, h);

  // The shafts only exist where the sun is actually in shot. Behind the camera
  // there is nothing to smear, and a sun far outside the frame would drag a
  // bright wash across the screen from nowhere.
  camera.getWorldDirection(forward);
  toSun.copy(sunDir).normalize();
  const facing = forward.dot(toSun);
  sunPoint.copy(camera.position).addScaledVector(toSun, 8000).project(camera);
  const sx = sunPoint.x * .5 + .5, sy = sunPoint.y * .5 + .5;
  const offScreen = Math.max(Math.abs(sx - .5), Math.abs(sy - .5));
  const strength = Math.max(0, facing) * (1 - T.MathUtils.smoothstep(offScreen, .5, 1.15));
  material.uniforms.intensity.value = warm ? 0 : strength * view.quality.godRays;
  if (material.uniforms.intensity.value <= 0 && !warm) return;
  material.uniforms.sunPos.value.set(sx, sy);
  material.uniforms.sunColor.value.copy(sunColor);

  // Sky out, everything else flat black on white: that is the occlusion mask.
  const sky = view.sky, skyWasVisible = sky?.visible;
  if (sky) sky.visible = false;
  scene.overrideMaterial = black;
  const previousTarget = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new T.Color()), clearAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(target);
  renderer.setClearColor(0xffffff, 1);
  renderer.clear(true, true, false);
  // ONLY SOLID THINGS GO IN THE MASK. Lines, points and sprites -- the aim line,
  // tracers, markers -- block no sunlight, and each is a kind of object the
  // black material needs a program of its own for: the aim line appears only
  // once a round is in play, so its program was built the first time a player
  // faced the sun, after the warm frame below had come and gone.
  //
  // Warming, everything solid is drawn, not only what this camera sees: the
  // black material takes a program per KIND of object (instanced or not, with
  // normals or not), and a kind behind the camera would still be built late.
  const hidden = [], culled = [];
  scene.traverseVisible(o => {
   if (o.isLine || o.isPoints || o.isSprite || o.isLineSegments2) { o.visible = false; hidden.push(o); }
   else if (warm && o.isMesh && o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
  });
  // THE SHADOW MAPS ARE NOT DRAWN AGAIN. Every `render` redraws them while
  // `autoUpdate` is on, and the frame's own render has just done so -- the mask
  // is flat black and reads none of them. Left on, every frame with the sun in
  // shot drew all the cascades twice.
  const shadows = renderer.shadowMap, autoUpdate = shadows.autoUpdate, needsUpdate = shadows.needsUpdate;
  shadows.autoUpdate = false; shadows.needsUpdate = false;
  try { renderer.render(scene, camera); }
  finally {
   shadows.autoUpdate = autoUpdate; shadows.needsUpdate = needsUpdate;
   for (const o of hidden) o.visible = true; for (const o of culled) o.frustumCulled = true;
  }
  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(clear, clearAlpha);
  scene.overrideMaterial = null;
  if (sky) sky.visible = skyWasVisible;

  // Additive, over the finished frame, with the depth buffer left alone.
  material.uniforms.tMask.value = target.texture;
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(quadScene, quadCamera);
  renderer.autoClear = autoClear;
 }

 function dispose() {
  target.dispose(); black.dispose(); material.dispose(); quad.geometry.dispose();
 }

 return {render, dispose};
}
