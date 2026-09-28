import * as T from 'three';

// DRAW ONLY THE PLANTING THAT CAN BE SEEN.
//
// Every tree model is ONE InstancedMesh spread over the whole course, so its
// bounding sphere is the course, three's frustum cull never rejects it, and every
// instance is drawn every frame -- the trees behind the camera included, and
// again into each shadow cascade. On Redwood that was 181 M triangles a frame on
// High from any tee, against about 6.6 M on the Pacific Northwest.
//
// NOT ONE MESH PER AREA. Splitting each model into a mesh per square of the
// course lets three cull the squares, but Redwood has ~80 model/role buckets, so
// ~25 squares turns 80 draw calls into 2000 -- which moves the cost to the
// processor, and a weak laptop has less of that to spare than graphics. Instead
// each mesh keeps its single draw call and this rewrites WHICH instances it
// holds: the ones standing in squares the camera can see are copied to the front
// of the instance buffer and `count` stops there.
//
// Squares are tested, not instances. The instances of every mesh are stored
// sorted by square, so a visible square is one contiguous run to copy and the
// visibility test is a few hundred boxes however many trees there are.
//
// THE SHADOW IS PART OF THE TREE. A tree just out of view still throws its
// shadow into view, and at a low sun that shadow is long. Each square's box is
// stretched away from the sun by the length of the shadow its tallest thing
// casts, so a tree is kept while its shadow can be seen. Without that the
// shadows at the edge of the screen pop in as the camera turns.
//
// NOT EVERY FRAME. A rebuild costs a copy and an upload, so it only happens when
// the camera has moved or turned enough; the view it is tested against is wider
// than the real one by MARGIN, and everything within NEAR of the camera is always
// kept, so the few metres and degrees between rebuilds never uncover a gap. The
// same goes for the sun.
//
// RENDERING ONLY. `world.trees` and everything physics reads are untouched: a
// tree that is not drawn is still exactly where it was.
//
// Anything else that renders the scene from somewhere other than the camera --
// the water's reflection probes -- must call `showAll()` first, or it
// photographs a course with the back half missing. The next `update` puts the
// cull back.

const CELL = 64;          // metres on a side
// Live-tunable from the lab (`view.cull.tune`), which is how these were chosen.
const tune = {near: 60, margin: 7, shadows: true, shadowCap: 1000};  // metres, degrees, metres
const MOVE = 4;           // metres of camera travel before a rebuild
const TURN = Math.cos(4 * Math.PI / 180);
const SUN_TURN = Math.cos(.75 * Math.PI / 180);
const MARGIN = () => tune.margin * Math.PI / 180;

export function cullInstances(root, {minInstances = 2} = {}) {
 const meshes = [];
 root.traverse(o => {
  if (o.isInstancedMesh && o.count >= minInstances && !o.userData.noCull) meshes.push(o);
 });
 if (!meshes.length) return null;

 // Every instance's bounding sphere, and the square it stands in.
 const cellOf = new Map(), boxes = [];
 const sphere = new T.Sphere(), m = new T.Matrix4(), corner = new T.Vector3();
 const records = meshes.map(mesh => {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const n = mesh.count, cell = new Int32Array(n);
  for (let i = 0; i < n; i++) {
   mesh.getMatrixAt(i, m);
   sphere.copy(geo.boundingSphere).applyMatrix4(m);
   const key = Math.floor(sphere.center.x / CELL) + ',' + Math.floor(sphere.center.z / CELL);
   let c = cellOf.get(key);
   if (c === undefined) { c = boxes.length; cellOf.set(key, c); boxes.push(new T.Box3()); }
   boxes[c].expandByPoint(corner.copy(sphere.center).subScalar(sphere.radius));
   boxes[c].expandByPoint(corner.copy(sphere.center).addScalar(sphere.radius));
   cell[i] = c;
  }
  // Sorted by square, so each visible square is one run.
  const order = Int32Array.from({length: n}, (_, i) => i).sort((a, b) => cell[a] - cell[b]);
  const matrix = mesh.instanceMatrix.array, colour = mesh.instanceColor?.array;
  const src = new Float32Array(n * 16), srcColour = colour ? new Float32Array(n * 3) : null;
  const runs = [];
  for (let k = 0; k < n; k++) {
   const i = order[k];
   src.set(matrix.subarray(i * 16, i * 16 + 16), k * 16);
   if (srcColour) srcColour.set(colour.subarray(i * 3, i * 3 + 3), k * 3);
   if (!runs.length || runs[runs.length - 3] !== cell[i]) runs.push(cell[i], k, 0);
   runs[runs.length - 1]++;
  }
  // THE BUFFERS KEEP THE USAGE THEY WERE BUILT WITH. Marking them all
  // DynamicDrawUsage -- the obvious thing for a buffer rewritten as the camera
  // moves -- tripled High's graphics time on Windows (12.6 -> 33 ms, Redwood,
  // RTX 4090), steadily, even in frames where nothing was rewritten, and only
  // on a page opened after another in the same browser. The driver underneath
  // (ANGLE on Direct3D 11) probably put the ground cover and the colours
  // somewhere the card reads slowly, and High reads them five times a frame:
  // the view, three shadow cascades and the god-ray mask. Left alone, the same
  // rewrites cost nothing measurable. See RESEARCH.md *Drawing only what is in
  // view*.
  // Culled here now; three's own test would only ever see the whole course.
  mesh.frustumCulled = false;
  mesh.userData.cullTotal = n;
  return {mesh, n, order, src, srcColour, runs: Int32Array.from(runs), drawn: n};
 });

 const visible = new Uint8Array(boxes.length).fill(1);
 const wide = new T.PerspectiveCamera(), frustum = new T.Frustum(), vp = new T.Matrix4();
 const lastPos = new T.Vector3(Infinity, 0, 0), lastFwd = new T.Vector3(), lastSun = new T.Vector3();
 const fwd = new T.Vector3(), away = new T.Vector3(), box = new T.Box3();
 let lastFov = 0, lastAspect = 0, stale = true, all = true, rebuilds = 0, rebuildMs = 0;

 const write = () => {
  for (const r of records) {
   const {mesh, order, src, srcColour, runs} = r, hidden = mesh.userData.cullHidden;
   const dst = mesh.instanceMatrix.array, dstColour = mesh.instanceColor?.array;
   let out = 0;
   for (let j = 0; j < runs.length; j += 3) {
    if (!all && !visible[runs[j]]) continue;
    const start = runs[j + 1], end = start + runs[j + 2];
    for (let k = start; k < end; k++) {
     if (hidden && hidden[order[k]]) continue;
     for (let q = 0; q < 16; q++) dst[out * 16 + q] = src[k * 16 + q];
     if (dstColour) {
      dstColour[out * 3] = srcColour[k * 3];
      dstColour[out * 3 + 1] = srcColour[k * 3 + 1];
      dstColour[out * 3 + 2] = srcColour[k * 3 + 2];
     }
     out++;
    }
   }
   r.drawn = out; mesh.count = out; mesh.visible = out > 0;
   // Only the part in use goes to the graphics card.
   const im = mesh.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, out * 16); im.needsUpdate = true;
   const ic = mesh.instanceColor;
   if (ic) { ic.clearUpdateRanges(); ic.addUpdateRange(0, out * 3); ic.needsUpdate = true; }
  }
 };

 return {
  has: mesh => meshes.includes(mesh),
  // Something changed that the camera test cannot see: a tree hidden or shown.
  dirty() { stale = true; },
  // Everything back in the buffer, for a render from somewhere else.
  showAll() { all = true; write(); stale = true; },
  update(camera, sunDir) {
   camera.updateMatrixWorld();
   camera.getWorldDirection(fwd);
   const moved = lastPos.distanceToSquared(camera.position) > MOVE * MOVE || fwd.dot(lastFwd) < TURN ||
    camera.fov !== lastFov || camera.aspect !== lastAspect || (sunDir && sunDir.dot(lastSun) < SUN_TURN);
   if (!moved && !stale) return false;
   lastPos.copy(camera.position); lastFwd.copy(fwd); lastFov = camera.fov; lastAspect = camera.aspect;
   if (sunDir) lastSun.copy(sunDir);
   stale = false; all = false;
   const started = performance.now();

   // The same view, wider by MARGIN on every side.
   const half = T.MathUtils.degToRad(camera.fov) / 2, across = Math.atan(Math.tan(half) * camera.aspect);
   const v = Math.min(half + MARGIN(), 1.5), h = Math.min(across + MARGIN(), 1.5);
   wide.fov = T.MathUtils.radToDeg(v * 2); wide.aspect = Math.tan(h) / Math.tan(v);
   wide.near = .1; wide.far = camera.far; wide.updateProjectionMatrix();
   frustum.setFromProjectionMatrix(vp.multiplyMatrices(wide.projectionMatrix, camera.matrixWorldInverse));

   // Where a shadow falls: away from the sun, as far as the height it falls
   // from over the tangent of the sun's elevation.
   let reach = 0;
   if (tune.shadows && sunDir && sunDir.y > 0) {
    const flat = Math.hypot(sunDir.x, sunDir.z);
    if (flat > 1e-4) { reach = flat / sunDir.y; away.set(-sunDir.x / flat, 0, -sunDir.z / flat); }
   }
   for (let c = 0; c < boxes.length; c++) {
    const b = boxes[c];
    if (b.distanceToPoint(camera.position) < tune.near) { visible[c] = 1; continue; }
    box.copy(b);
    if (reach) {
     const len = Math.min(tune.shadowCap, (b.max.y - b.min.y) * reach);
     box.min.x = Math.min(b.min.x, b.min.x + away.x * len); box.max.x = Math.max(b.max.x, b.max.x + away.x * len);
     box.min.z = Math.min(b.min.z, b.min.z + away.z * len); box.max.z = Math.max(b.max.z, b.max.z + away.z * len);
    }
    visible[c] = frustum.intersectsBox(box) ? 1 : 0;
   }
   write();
   rebuilds++; rebuildMs = performance.now() - started;
   return true;
  },
  tune(next = {}) { Object.assign(tune, next); stale = true; return {...tune}; },
  // For the lab: how much is being drawn.
  stats() {
   let instances = 0, drawn = 0;
   for (const r of records) { instances += r.n; drawn += r.drawn; }
   let shown = 0; for (const x of visible) shown += x;
   return {meshes: records.length, squares: boxes.length, squaresDrawn: shown, instances, drawn,
    rebuilds, lastRebuildMs: +rebuildMs.toFixed(2)};
  }
 };
}
