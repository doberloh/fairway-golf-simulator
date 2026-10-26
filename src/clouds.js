import * as T from 'three';
import {random} from './course.js';

// Cartoon clouds: actual objects in the sky, each casting its own shadow.
//
// This replaces a noise field that shaded the ground from a function nobody
// could point at. The field was soft, global and untestable -- the only way to
// tell whether it was working was to watch frame luminance wobble, which is why
// it took several rounds to establish that it was not. A cloud you can see,
// whose shadow you can find on the ground beneath it, is both better art and
// something a test can check.
//
// Shapes are generated rather than imported. A cartoon cloud is a cluster of
// blobs, so a model buys nothing here (unlike a pine, which is genuinely hard to
// fake), and generating them means each cloud's shadow disc matches the shape
// that cast it, for no bytes and no licence.

// The ground shader reads this many discs. Costs a handful of distance tests per
// fragment, all against the same projected point, so the loop is cheap.
export const MAX_CLOUDS = 16;
// How long a cloud spends fading, at either end. Long enough that neither the
// arrival nor the departure is an event; short enough that the sky is not
// visibly thin behind it.
export const CLOUD_FADE_SECONDS = 5;

// A CLOUD ARRIVES AND LEAVES; IT DOES NOT APPEAR AND VANISH.
//
// Clouds wrap inside a box rather than being recycled, which keeps the sky
// full without spawning anything near the camera -- but a wrap is still a
// teleport, and at this size and distance the jump is plainly visible on both
// the cloud and the shadow it drags across the course.
//
// Per-instance opacity, so the puffs of one cloud fade together while the rest
// of the sky is untouched. Installed from the renderer AFTER the cascade
// shadow setup, because CSM assigns `onBeforeCompile` rather than wrapping it
// and anything put there first is silently lost -- the same trap cloud
// shadows document.
export function applyCloudFade(material) {
 // `cloudMesh`, not `cloudShadowed`: this must reach the cloud material and
 // nothing else. Only its geometry carries the per-instance fade attribute,
 // and a material reading an attribute that is not there reads ZERO, which is
 // fully transparent.
 if (!material || !material.userData.cloudMesh || material.userData.cloudFaded) return;
 material.userData.cloudFaded = true;
 const previous = material.onBeforeCompile;
 material.onBeforeCompile = function (shader, renderer) {
  previous?.call(this, shader, renderer);
  // `begin_vertex` and `dithering_fragment` are the two chunks nothing else
  // claims on this material: mist holds common/fog in both stages, and cloud
  // shadows skip a cloud entirely.
  // A CLOUD LIGHTS AS ONE BODY (the cartoon overhaul's lighting, round 6).
  // Each puff's normals lean toward the direction from its cloud's centre, as
  // a painted crown's do, so the cloud has one lit side and one shaded side
  // instead of a lit facet on every puff; the underside, below the cloud's
  // base, takes a cool grey-blue; and the edge turned from the eye catches the
  // sky, brighter where the sun stands behind -- the silver lining. Here, with
  // the fade, because the cascade setup replaces anything installed earlier.
  shader.vertexShader = 'attribute float aFade;\nattribute vec3 aCentre;\nattribute vec2 aBase;\nvarying float vFade;\nvarying float vCloudUp;\n' + shader.vertexShader
   .replace('#include <begin_vertex>', '#include <begin_vertex>\n vFade=aFade;')
   .replace('#include <defaultnormal_vertex>', `vec4 cloudAt=instanceMatrix*vec4(position,1.);
 vCloudUp=clamp((cloudAt.y-aBase.x)/aBase.y,0.,1.);
 vec3 cloudOut=normalize(cloudAt.xyz-aCentre),puffOut=normalize(mat3(instanceMatrix)*objectNormal);
 vec3 transformedNormal=normalMatrix*normalize(mix(puffOut,cloudOut,.62));
 #ifdef FLIP_SIDED
 transformedNormal=-transformedNormal;
 #endif`);
  shader.fragmentShader = 'varying float vFade;\nvarying float vCloudUp;\n' + shader.fragmentShader
   .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb*=mix(vec3(.66,.72,.86),vec3(1.03),smoothstep(0.,.7,vCloudUp));')
   .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
 #if NUM_HEMI_LIGHTS>0
 {vec3 toEye=normalize(vViewPosition);float edge=1.-clamp(dot(normal,toEye),0.,1.);edge*=edge*edge;edge*=edge;vec3 rim=hemisphereLights[0].skyColor*.4;
  #if NUM_DIR_LIGHTS>0
  float behind=clamp(dot(-toEye,directionalLights[0].direction),0.,1.);rim+=directionalLights[0].color*behind*behind*behind*.8;
  #endif
  reflectedLight.indirectDiffuse+=diffuseColor.rgb*rim*edge;}
 #endif`)
   .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a*=vFade;');
 };
 material.transparent = true;
 material.needsUpdate = true;
}

export function makeClouds(view, seed) {
 const {world} = view;
 const rng = random(seed + ':clouds');
 const group = new T.Group();
 // Clouds live well beyond the course so none of them pops in at the edge of
 // the draw distance, and they wrap inside this box rather than being recycled
 // somewhere visible.
 // Sized for coverage, not just for margin. The first attempt scattered these
 // over a box of 44 square kilometres, which is about 9% of the sky covered --
 // so most of the time no cloud was anywhere near the course and there was
 // simply no shadow to see. This box is 14.7 km2 against 8.9 km2 of cloud, so
 // 60% of disc area; overlapping, that lands near 45% of sky actually covered.
 const spanX = world.halfX + 1200, spanZ = world.halfZ + 1200;
 const altitude = 640;

 const material = new T.MeshToonMaterial({color: '#ffffff'});
 // One blob geometry, instanced per puff. Round 6 of the overhaul's light:
 // finer (detail 2, 320 faces -- at 1 every puff's outline was a row of
 // facets), and flat underneath, so the puffs of a cloud share a level base
 // the way a fair-weather cumulus does; the puffs' own number and spread, not
 // a coarse mesh, keep it from reading as a balloon.
 const blob = new T.IcosahedronGeometry(1, 2);
 {const p = blob.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -.25) p.setY(i, -.25 + (y + .25) * .2); }}

 const clouds = [];
 const dummy = new T.Object3D();
 const puffs = [];
 for (let i = 0; i < MAX_CLOUDS; i++) {
  const radius = 300 + rng() * 240;
  const cloud = {
   x: (rng() - .5) * 2 * spanX,
   z: (rng() - .5) * 2 * spanZ,
   y: altitude + (rng() - .5) * 130,
   radius,
  };
  // Seven to twelve blobs in a squat cluster: wider than tall, flat
  // underneath, which is what makes a cloud read as a cloud rather than a
  // lump. (Four to seven before round 6: a few big balls.)
  const count = 7 + Math.floor(rng() * 6);
  for (let p = 0; p < count; p++) {
   const angle = p / count * Math.PI * 2 + rng() * .8;
   const reach = radius * (.12 + rng() * .5);
   // The middle ones taller, so the cloud domes up from its base.
   const size = radius * (.26 + rng() * .24) * (1.25 - reach / radius * .6);
   dummy.position.set(
    cloud.x + Math.cos(angle) * reach,
    cloud.y + (rng() - .3) * radius * .16,
    cloud.z + Math.sin(angle) * reach * .7);
   dummy.scale.set(size, size * (.62 + rng() * .22), size * (.86 + rng() * .28));
   dummy.rotation.set(0, rng() * 6.28, 0);
   dummy.updateMatrix();
   puffs.push({cloud: i, offset: dummy.matrix.clone()});
  }
  clouds.push(cloud);
 }

 // One opacity per cloud, shared with the shadow uniform so a fading cloud and
 // its fading shadow cannot drift apart.
 const fades = new Float32Array(MAX_CLOUDS).fill(1);
 const puffFade = new Float32Array(puffs.length).fill(1);

 const mesh = new T.InstancedMesh(blob, material, puffs.length);
 mesh.geometry.setAttribute('aFade', new T.InstancedBufferAttribute(puffFade, 1));
 // Each puff's cloud: its centre (moved with the drift in `sync`), and its
 // base and depth, for the shading above.
 const puffCentre = new Float32Array(puffs.length * 3), puffBase = new Float32Array(puffs.length * 2);
 puffs.forEach((puff, i) => { const c = clouds[puff.cloud]; puffBase[i * 2] = c.y - c.radius * .1; puffBase[i * 2 + 1] = c.radius * .45; });
 mesh.geometry.setAttribute('aCentre', new T.InstancedBufferAttribute(puffCentre, 3));
 mesh.geometry.setAttribute('aBase', new T.InstancedBufferAttribute(puffBase, 2));
 mesh.frustumCulled = false;
 // Their own shadow discs do the shading; casting into the shadow map as well
 // would double it, and at this altitude the cascade would only smear it.
 mesh.castShadow = false;
 mesh.receiveShadow = false;
 // Skip the cloud-shadow patch: a cloud is above the weather, not under it.
 material.userData.cloudMesh = true;
 group.add(mesh);

 const discs = Array.from({length: MAX_CLOUDS}, () => new T.Vector4());
 const matrix = new T.Matrix4(), shift = new T.Matrix4();

 function sync() {
  puffs.forEach((puff, i) => {
   const cloud = clouds[puff.cloud];
   shift.makeTranslation(cloud.driftX || 0, 0, cloud.driftZ || 0);
   matrix.multiplyMatrices(shift, puff.offset);
   mesh.setMatrixAt(i, matrix);
   puffFade[i] = fades[puff.cloud];
   puffCentre[i * 3] = cloud.x + (cloud.driftX || 0); puffCentre[i * 3 + 1] = cloud.y + cloud.radius * .1; puffCentre[i * 3 + 2] = cloud.z + (cloud.driftZ || 0);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.getAttribute('aFade').needsUpdate = true;
  mesh.geometry.getAttribute('aCentre').needsUpdate = true;
  clouds.forEach((cloud, i) => discs[i].set(
   cloud.x + (cloud.driftX || 0), cloud.y, cloud.z + (cloud.driftZ || 0), cloud.radius));
 }

 // Drift is in metres per second, straight from the course's own wind, with a
 // floor so a still day still moves. The previous attempt took three minutes to
 // move one cloud, which reads as painted on.
 const windRadians = (world.settings.windDirection || 0) * Math.PI / 180;
 const speed = 9 + (world.settings.wind || 0) * 1.6;
 const dx = Math.sin(windRadians) * speed, dz = Math.cos(windRadians) * speed;

 // OPACITY IS A FUNCTION OF WHERE A CLOUD IS, NOT OF WHAT JUST HAPPENED TO IT.
 //
 // The first version watched for the wrap and then faded in over a fixed time.
 // That gives an arrival and no departure: a cloud still reached the far edge
 // at full strength and blinked out of existence.
 //
 // Fading with distance to the edge of the box does both from one rule, and
 // does them continuously. A cloud approaching the boundary thins out, wraps
 // while it is invisible, and thickens again as it moves back inside -- and
 // because the distance to the NEAR edge is zero on both sides of the jump,
 // there is no step in opacity at the moment it wraps.
 //
 // The margin is a distance, but it is set from the drift speed, so the fade
 // takes the same few seconds whether the day is still or blowing.
 const marginX = Math.max(40, Math.abs(dx) * CLOUD_FADE_SECONDS);
 const marginZ = Math.max(40, Math.abs(dz) * CLOUD_FADE_SECONDS);
 const edgeFade = cloud => {
  const x = cloud.x + (cloud.driftX || 0), z = cloud.z + (cloud.driftZ || 0);
  const near = Math.min((spanX - Math.abs(x)) / marginX, (spanZ - Math.abs(z)) / marginZ);
  return Math.max(0, Math.min(1, near));
 };

 function update(dt) {
  clouds.forEach((cloud, i) => {
   cloud.driftX = (cloud.driftX || 0) + dx * dt;
   cloud.driftZ = (cloud.driftZ || 0) + dz * dt;
   // Wrap inside the box so the sky never empties out.
   while (cloud.x + cloud.driftX > spanX) cloud.driftX -= spanX * 2;
   while (cloud.x + cloud.driftX < -spanX) cloud.driftX += spanX * 2;
   while (cloud.z + cloud.driftZ > spanZ) cloud.driftZ -= spanZ * 2;
   while (cloud.z + cloud.driftZ < -spanZ) cloud.driftZ += spanZ * 2;
   fades[i] = edgeFade(cloud);
  });
  sync();
 }

 clouds.forEach((cloud, i) => { fades[i] = edgeFade(cloud); });
 sync();

 function dispose() { blob.dispose(); material.dispose(); }

 return {group, update, dispose, discs, fades, clouds, altitude, count: MAX_CLOUDS};
}
