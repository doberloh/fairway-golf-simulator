import * as T from 'three';
import {farParts} from './mesh-assets.js';

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
// `shadowMaps: false` gives every shadow map every held tree, as before 28 September.
const tune = {near: 60, margin: 7, shadows: true, shadowCap: 1000, shadowMaps: true, thinShadowsFrom: null, farTrees: null};  // metres, degrees, metres
const MOVE = 4;           // metres of camera travel before a rebuild
const TURN = Math.cos(4 * Math.PI / 180);
const SUN_TURN = Math.cos(.75 * Math.PI / 180);
const MARGIN = () => tune.margin * Math.PI / 180;

// `thinShadowsFrom`: the first shadow map (0 = nearest) whose trees are drawn
// as their thinned twins (`farParts`) rather than in full. Infinity: never.
// `farTrees`: a crown drawn smaller than this share of the screen's height is
// drawn as its thinned twin (F2). 0: never.
export function cullInstances(root, {minInstances = 2, thinShadowsFrom = Infinity, farTrees = 0} = {}) {
 const meshes = [];
 root.traverse(o => {
  if (o.isInstancedMesh && o.count >= minInstances && !o.userData.noCull) meshes.push(o);
 });
 if (!meshes.length) return null;

 const restore = function () {
  if (this.userData.cullHeld === undefined) return;
  this.count = this.userData.cullHeld;
  this.userData.cullHeld = undefined;
 };
 // Every instance's bounding sphere, and the square it stands in.
 const cellOf = new Map(), boxes = [];
 const sphere = new T.Sphere(), m = new T.Matrix4(), corner = new T.Vector3();
 const records = meshes.flatMap(mesh => {
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
  // A procedural tree's pieces carry the root of the tree they belong to
  // (`treeRoot`, for the wind -- textures.js); it is per instance, so it is
  // packed with the matrices or a leaf would bend about another tree's root.
  const rootAttr = geo.attributes.treeRoot, root = rootAttr?.array, srcRoot = root ? new Float32Array(n * 4) : null;
  const runs = [];
  for (let k = 0; k < n; k++) {
   const i = order[k];
   src.set(matrix.subarray(i * 16, i * 16 + 16), k * 16);
   if (srcColour) srcColour.set(colour.subarray(i * 3, i * 3 + 3), k * 3);
   if (srcRoot) srcRoot.set(root.subarray(i * 4, i * 4 + 4), k * 4);
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
  const record = {mesh, n, order, src, srcColour, srcRoot, rootAttr, runs: Int32Array.from(runs), drawn: n, cum: null, twin: null, near: false, far: false};
  const thinFrom = () => tune.thinShadowsFrom ?? thinShadowsFrom;
  // A SHADOW OF THE SAME TREE, DRAWN CHEAPER. From map `thinShadowsFrom` out,
  // a crown's shadow comes from its thinned twin -- a third of the sprays,
  // each grown to keep the crown as full -- which a shadow texel of half a
  // metre or more cannot tell from the whole tree. It shares this mesh's
  // instance buffer, so it costs no upload and always holds the same trees.
  // It is never drawn into the picture: only into shadow maps.
  const far = mesh.userData.role === 'leaf' && (thinShadowsFrom !== Infinity || farTrees > 0)
   ? farParts(mesh.userData.model)?.[mesh.userData.part]?.geometry : null;
  const thins = far && far.index.count < geo.index.count * .6;
  if (thins && thinShadowsFrom !== Infinity && mesh.castShadow) {
   const twin = new T.InstancedMesh(far, mesh.material, n);
   twin.instanceMatrix = mesh.instanceMatrix;
   // ITS COLOURS TOO, though a shadow ignores them. The twin shares the tree's
   // material, and instance colours are part of which program that material
   // needs: a twin without them flipped the program twice per twin in every
   // pass that met it -- the picture, the god-ray mask, the water probes -- 57
   // program checks a frame on Redwood Ultra, each a full parameter rebuild in
   // three (RESEARCH, *Wasted drawing*). Shared, it is the same program.
   if (mesh.instanceColor) twin.instanceColor = mesh.instanceColor;
   twin.castShadow = true; twin.receiveShadow = false; twin.frustumCulled = false;
   twin.userData.noCull = true; twin.name = 'shadow twin';
   // Kept out of the picture (and the god-ray mask, and the water probes):
   // every render that is not a shadow map sees no instances.
   twin.onBeforeRender = function () { this.userData.cullHeld = this.count; this.count = 0; };
   twin.onAfterRender = function () { this.count = this.userData.cullHeld; this.userData.cullHeld = undefined; };
   twin.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
    const k = shadowOf.get(shadowCamera);
    this.userData.cullHeld = this.count;
    this.count = k === undefined || k < thinFrom() ? 0 : all || !record.cum ? mesh.count : record.cum[k];
   };
   twin.onAfterShadow = function () { this.count = this.userData.cullHeld; this.userData.cullHeld = undefined; };
   mesh.parent.add(twin);
   record.twin = twin;
  }
  // Before each shadow map draws this mesh, cut it to that map's prefix -- or
  // to nothing, where its twin stands in; put it back after. A shadow camera
  // the cull was not told about -- a floodlight's -- draws everything, as it
  // always did.
  mesh.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
   const k = shadowOf.get(shadowCamera);
   if (k === undefined) return;
   if (record.twin && k >= thinFrom()) { this.userData.cullHeld = this.count; this.count = 0; return; }
   if (all || !record.cum) return;
   this.userData.cullHeld = this.count;
   this.count = record.cum[k];
  };
  mesh.onAfterShadow = restore;
  if (!thins || farTrees <= 0) return [record];
  // A CROWN FAR ENOUGH AWAY TO BE SMALL ON SCREEN IS DRAWN AS ITS TWIN (F2).
  // Its own mesh with its own buffer, holding the squares whose trees are
  // small on screen while the full mesh holds the rest. It casts its own
  // shadows with the same thinned shape, so a thinned crown shades itself
  // from the shape it is drawn with: a crown shaded by a DIFFERENT shape goes
  // dark, which is what threw the twin out of Low's shadow map (F3).
  const farMesh = new T.InstancedMesh(far, mesh.material, n);
  if (srcColour) farMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  farMesh.castShadow = mesh.castShadow; farMesh.receiveShadow = mesh.receiveShadow; farMesh.frustumCulled = false;
  farMesh.userData = {noCull: true, cullHidden: mesh.userData.cullHidden, farOf: mesh};
  farMesh.name = 'far trees'; farMesh.count = 0; farMesh.visible = false;
  mesh.parent.add(farMesh);
  const farRecord = {mesh: farMesh, n, order, src, srcColour, runs: record.runs, drawn: 0, cum: null, twin: null, near: false, far: true};
  record.near = true;
  farMesh.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
   const k = shadowOf.get(shadowCamera);
   if (k === undefined || all || !farRecord.cum) return;
   this.userData.cullHeld = this.count;
   this.count = farRecord.cum[k];
  };
  farMesh.onAfterShadow = restore;
  return [record, farRecord];
 });

 const visible = new Uint8Array(boxes.length).fill(1);
 // WHICH SHADOW MAP A SQUARE IS FIRST NEEDED BY. Three draws a shadow caster
 // into every shadow map whose volume it overlaps, testing the object's
 // bounding sphere -- and a culled mesh has no sphere worth testing, so without
 // this every tree in view went into every map: all three cascades on High and
 // Ultra, near one included, and the single map on Low and Medium that covers
 // only the ground around the player. Measured, each cascade was drawing the
 // same ~35 M triangles (Redwood, first tee).
 //
 // A mesh has ONE instance buffer, so the maps cannot each get their own list.
 // Instead the squares are written in order of the first map that needs them --
 // map 0's squares first, then those map 1 needs and map 0 does not, and so on,
 // with squares that only the camera needs last -- and each map draws a prefix.
 // Map i's prefix holds every square any map up to i needs, which is every
 // square map i needs plus a few it does not; never fewer. `pass` is that group;
 // `cum` in each record is where each group ends.
 let casters = [];                    // the shadow cameras, nearest map first
 const thin = new Uint8Array(boxes.length);  // 1: this square's crowns are drawn as twins
 const pass = new Uint8Array(boxes.length), shadowOf = new Map(), shadowFrustum = new T.Frustum();
 const casterPos = new T.Vector3(), casterAim = new T.Vector3();
 const wide = new T.PerspectiveCamera(), frustum = new T.Frustum(), vp = new T.Matrix4();
 const lastPos = new T.Vector3(Infinity, 0, 0), lastFwd = new T.Vector3(), lastSun = new T.Vector3();
 const fwd = new T.Vector3(), away = new T.Vector3(), box = new T.Box3();
 let lastFov = 0, lastAspect = 0, stale = true, all = true, rebuilds = 0, rebuildMs = 0;

 const write = () => {
  for (const r of records) {
   const {mesh, order, src, srcColour, srcRoot, rootAttr, runs} = r, hidden = mesh.userData.cullHidden;
   const dst = mesh.instanceMatrix.array, dstColour = mesh.instanceColor?.array, dstRoot = srcRoot ? rootAttr.array : null;
   const groups = all ? 0 : casters.length;
   if (!r.cum || r.cum.length !== groups + 1) r.cum = new Int32Array(groups + 1);
   let out = 0;
   for (let g = 0; g <= groups; g++) {
    for (let j = 0; j < runs.length; j += 3) {
     if (!all && (!visible[runs[j]] || pass[runs[j]] !== g)) continue;
     if (r.near && thin[runs[j]] && !all) continue;
     if (r.far && (all || !thin[runs[j]])) continue;
     const start = runs[j + 1], end = start + runs[j + 2];
     for (let k = start; k < end; k++) {
      if (hidden && hidden[order[k]]) continue;
      for (let q = 0; q < 16; q++) dst[out * 16 + q] = src[k * 16 + q];
      if (dstColour) {
       dstColour[out * 3] = srcColour[k * 3];
       dstColour[out * 3 + 1] = srcColour[k * 3 + 1];
       dstColour[out * 3 + 2] = srcColour[k * 3 + 2];
      }
      if (dstRoot) for (let q = 0; q < 4; q++) dstRoot[out * 4 + q] = srcRoot[k * 4 + q];
      out++;
     }
    }
    r.cum[g] = out;
   }
   r.drawn = out; mesh.count = out; mesh.visible = out > 0;
   if (r.twin) { r.twin.count = out; r.twin.visible = out > 0; }
   // Only the part in use goes to the graphics card.
   const im = mesh.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, out * 16); im.needsUpdate = true;
   const ic = mesh.instanceColor;
   if (ic) { ic.clearUpdateRanges(); ic.addUpdateRange(0, out * 3); ic.needsUpdate = true; }
   if (dstRoot) { rootAttr.clearUpdateRanges(); rootAttr.addUpdateRange(0, out * 4); rootAttr.needsUpdate = true; }
  }
 };

 return {
  has: mesh => meshes.includes(mesh),
  // Something changed that the camera test cannot see: a tree hidden or shown.
  dirty() { stale = true; },
  // Everything back in the buffer, for a render from somewhere else.
  showAll() { all = true; write(); stale = true; },
  // `lights`: the shadow-casting lights to sort for, nearest map first (the
  // cascades, or the one sun). Their shadow cameras must already be placed for
  // this frame -- the renderer calls this after the cascades have moved.
  update(camera, sunDir, lights = []) {
   if (!tune.shadowMaps) lights = [];
   camera.updateMatrixWorld();
   camera.getWorldDirection(fwd);
   if (lights.length !== casters.length || lights.some((l, i) => l.shadow.camera !== casters[i])) {
    casters = lights.map(l => l.shadow.camera);
    shadowOf.clear(); casters.forEach((c, i) => shadowOf.set(c, i));
    stale = true;
   }
   const moved = lastPos.distanceToSquared(camera.position) > MOVE * MOVE || fwd.dot(lastFwd) < TURN ||
    camera.fov !== lastFov || camera.aspect !== lastAspect || (sunDir && sunDir.dot(lastSun) < SUN_TURN);
   if (!moved && !stale) return false;
   lastPos.copy(camera.position); lastFwd.copy(fwd); lastFov = camera.fov; lastAspect = camera.aspect;
   if (sunDir) lastSun.copy(sunDir);
   stale = false; all = false;
   const started = performance.now();

   // The same view, wider by MARGIN on every side.
   // A bay's lens shift (renderer.js, applyLensShift) moves the frustum sideways;
   // widened on both sides by that much, so nothing on the far side is culled.
   const shift = Math.abs(camera.filmOffset || 0) / (camera.getFilmWidth?.() || 1);
   const half = T.MathUtils.degToRad(camera.fov) / 2, across = Math.atan(Math.tan(half) * camera.aspect + shift);
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
   // Which squares are small enough on screen to draw as twins: the tallest
   // thing in the square over its distance, as a share of the screen's height.
   // A square stays thin until it grows 15% past the line, so a camera
   // hovering at the boundary does not swap it back and forth.
   const small = tune.farTrees ?? farTrees;
   if (small > 0) {
    const focal = 1 / (2 * Math.tan(T.MathUtils.degToRad(camera.fov) / 2));
    for (let c = 0; c < boxes.length; c++) {
     const b = boxes[c], d = b.distanceToPoint(camera.position);
     if (d < tune.near) { thin[c] = 0; continue; }
     const share = (b.max.y - b.min.y) / d * focal;
     thin[c] = share < small * (thin[c] ? 1.15 : 1) ? 1 : 0;
    }
   } else thin.fill(0);
   // Each square's first shadow map. The maps move with the camera as it
   // does, so between rebuilds a map can drift by the camera's allowance of
   // travel and turn; each volume is grown by that much before it is tested.
   pass.fill(casters.length);
   for (let i = casters.length - 1; i >= 0; i--) {
    const cam = casters[i];
    shadowFrustum.setFromProjectionMatrix(vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    casterPos.setFromMatrixPosition(cam.matrixWorld);
    // A turn swings a map sideways by its distance from the camera times the
    // angle; its light-ward margin makes this distance an overestimate.
    const reach = casterAim.copy(casterPos).sub(camera.position).length();
    const grow = MOVE + Math.sin(Math.acos(TURN)) * reach;
    for (const plane of shadowFrustum.planes) plane.constant += grow;
    for (let c = 0; c < boxes.length; c++) if (visible[c] && shadowFrustum.intersectsBox(boxes[c])) pass[c] = i;
   }
   write();
   rebuilds++; rebuildMs = performance.now() - started;
   return true;
  },
  tune(next = {}) { Object.assign(tune, next); stale = true; return {...tune}; },
  // For the lab: how much is being drawn.
  stats() {
   let instances = 0, drawn = 0;
   for (const r of records) { if (!r.far) instances += r.n; drawn += r.drawn; }
   let shown = 0; for (const x of visible) shown += x;
   const shadow = casters.map((_, k) => records.reduce((a, r) => a + (r.cum?.[k] ?? r.drawn), 0));
   // Of the crowns that have a twin, how many are drawn as it: the guard
   // against the forest going dead, which is what the first distance swap did.
   let nearCrowns = 0, farCrowns = 0;
   for (const r of records) { if (r.near) nearCrowns += r.drawn; if (r.far) farCrowns += r.drawn; }
   return {meshes: records.length, squares: boxes.length, squaresDrawn: shown, instances, drawn, shadow,
    thinCrowns: nearCrowns + farCrowns ? +(farCrowns / (nearCrowns + farCrowns)).toFixed(3) : 0,
    rebuilds, lastRebuildMs: +rebuildMs.toFixed(2)};
  }
 };
}
