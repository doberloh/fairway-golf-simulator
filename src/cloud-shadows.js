import * as T from 'three';
import {MAX_CLOUDS} from './clouds.js';

// The shadow a cloud casts on the course.
//
// Patched into every lit material, so no extra render pass: the cost is one
// projection plus MAX_CLOUDS distance tests per fragment, all against the same
// projected point.
//
// It reads the positions of the actual cloud meshes rather than a noise field.
// That is the whole point of the rewrite -- the shadow provably belongs to a
// cloud you can see overhead, it follows the terrain for free, and a test can
// put a cloud at a known place and check the ground went dark in the right one.
//
// Chunk ownership is three deep. CSM holds <lights_fragment_begin> and
// <lights_pars_begin>; ground.js holds <common>, <color_fragment> and
// <begin_vertex>; this holds <lights_fragment_end> and <project_vertex>. Check
// that list before adding a fourth patch.

export const cloudShadowUniforms = () => ({
 // xyz is the cloud's centre, w its radius.
 cloudDiscs: {value: Array.from({length: MAX_CLOUDS}, () => new T.Vector4(0, 1e6, 0, 1))},
 cloudSun: {value: new T.Vector3(0, 1, 0)},
 // How much of the direct sun a cloud takes directly beneath it.
 cloudDepth: {value: .45},
 // Fraction of the radius over which the edge softens. A hard core with a quick
 // rim is what makes the shadow read as drawn rather than as haze.
 cloudEdge: {value: .15},
});

const SHADOW_GLSL = `
uniform vec4 cloudDiscs[${MAX_CLOUDS}];
uniform vec3 cloudSun;
uniform float cloudDepth,cloudEdge;
float cloudShadowAt(vec3 world){
 float shade=0.;
 for(int i=0;i<${MAX_CLOUDS};i++){
  vec4 disc=cloudDiscs[i];
  // Where the ray from here toward the sun reaches this cloud's altitude. This
  // is what puts the shadow where the sun would actually throw it, offset from
  // the cloud rather than directly underneath.
  float t=(disc.y-world.y)/max(cloudSun.y,.08);
  if(t<=0.)continue;
  vec2 hit=world.xz+cloudSun.xz*t;
  float d=length(hit-disc.xz)/max(disc.w,1.);
  shade=max(shade,1.-smoothstep(1.-cloudEdge,1.,d));
 }
 return 1.-shade*cloudDepth;
}
`;

export function applyCloudShadows(material, uniforms) {
 if (!material || material.userData.clouds) return;
 const previous = material.onBeforeCompile;
 material.onBeforeCompile = function (shader, renderer) {
  // CSM assigns onBeforeCompile rather than wrapping it, so whatever was here
  // first has to be called explicitly or it is lost.
  previous?.call(this, shader, renderer);
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;')
   // After <project_vertex>, because an instanced mesh carries its transform in
   // instanceMatrix and a world position taken before it is the wrong position
   // for every instance but the first.
   .replace('#include <project_vertex>', `#include <project_vertex>
   #ifdef USE_INSTANCING
    vCloudWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
   #else
    vCloudWorld=(modelMatrix*vec4(transformed,1.)).xyz;
   #endif`);
  shader.fragmentShader = shader.fragmentShader
   .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;' + SHADOW_GLSL)
   // After the lights have accumulated, where "how much sun reaches here" is a
   // single number. Ambient is left alone: a cloud blocks the sun, not the sky.
   .replace('#include <lights_fragment_end>',
    'reflectedLight.directDiffuse*=cloudShadowAt(vCloudWorld);\n#include <lights_fragment_end>');
 };
 material.userData.clouds = true;
 material.needsUpdate = true;
}
