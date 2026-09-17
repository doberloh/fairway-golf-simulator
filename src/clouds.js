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
 // One blob geometry, instanced per puff. Low detail on purpose: the silhouette
 // is the whole point and a smooth sphere reads as a balloon.
 const blob = new T.IcosahedronGeometry(1, 1);

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
  // Four to seven blobs in a squat cluster: wider than tall, flat underneath,
  // which is what makes a cloud read as a cloud rather than a lump.
  const count = 4 + Math.floor(rng() * 4);
  for (let p = 0; p < count; p++) {
   const angle = p / count * Math.PI * 2 + rng() * .8;
   const reach = radius * (.18 + rng() * .46);
   const size = radius * (.36 + rng() * .30);
   dummy.position.set(
    cloud.x + Math.cos(angle) * reach,
    cloud.y + (rng() - .3) * radius * .16,
    cloud.z + Math.sin(angle) * reach * .7);
   dummy.scale.set(size, size * (.62 + rng() * .22), size * (.86 + rng() * .28));
   dummy.rotation.set(0, rng() * 6.28, 0);
   dummy.updateMatrix();
   puffs.push({cloud, offset: dummy.matrix.clone()});
  }
  clouds.push(cloud);
 }

 const mesh = new T.InstancedMesh(blob, material, puffs.length);
 mesh.frustumCulled = false;
 // Their own shadow discs do the shading; casting into the shadow map as well
 // would double it, and at this altitude the cascade would only smear it.
 mesh.castShadow = false;
 mesh.receiveShadow = false;
 // Skip the cloud-shadow patch: a cloud is above the weather, not under it.
 material.userData.clouds = true;
 group.add(mesh);

 const discs = Array.from({length: MAX_CLOUDS}, () => new T.Vector4());
 const matrix = new T.Matrix4(), shift = new T.Matrix4();

 function sync() {
  puffs.forEach((puff, i) => {
   shift.makeTranslation(puff.cloud.driftX || 0, 0, puff.cloud.driftZ || 0);
   matrix.multiplyMatrices(shift, puff.offset);
   mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  clouds.forEach((cloud, i) => discs[i].set(
   cloud.x + (cloud.driftX || 0), cloud.y, cloud.z + (cloud.driftZ || 0), cloud.radius));
 }

 // Drift is in metres per second, straight from the course's own wind, with a
 // floor so a still day still moves. The previous attempt took three minutes to
 // move one cloud, which reads as painted on.
 const windRadians = (world.settings.windDirection || 0) * Math.PI / 180;
 const speed = 9 + (world.settings.wind || 0) * 1.6;
 const dx = Math.sin(windRadians) * speed, dz = Math.cos(windRadians) * speed;

 function update(dt) {
  for (const cloud of clouds) {
   cloud.driftX = (cloud.driftX || 0) + dx * dt;
   cloud.driftZ = (cloud.driftZ || 0) + dz * dt;
   // Wrap inside the box so the sky never empties out.
   while (cloud.x + cloud.driftX > spanX) cloud.driftX -= spanX * 2;
   while (cloud.x + cloud.driftX < -spanX) cloud.driftX += spanX * 2;
   while (cloud.z + cloud.driftZ > spanZ) cloud.driftZ -= spanZ * 2;
   while (cloud.z + cloud.driftZ < -spanZ) cloud.driftZ += spanZ * 2;
  }
  sync();
 }

 sync();

 function dispose() { blob.dispose(); material.dispose(); }

 return {group, update, dispose, discs, clouds, altitude, count: MAX_CLOUDS};
}
