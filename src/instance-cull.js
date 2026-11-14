import {treeHash, squareKeep, LOW_TREES} from './low-trees.js';

// A TREE FADES IN, IT DOES NOT POP (the owner, 9 November 2026: "i would like
// to see things fade in not pop in"). On Low a tree whose place in the order
// (`treeHash`) is within the fade band of its square's share is drawn
// dissolved: each pixel in or out by a fixed screen pattern, so it needs no
// sorting and no blending, and costs a compare. The amount rides in the
// instance colour's red, in steps of four (a tint is never above about 1.5),
// so it needs no attribute of its own -- a tree's parts share their geometry
// between meshes, and an attribute is the geometry's. Every other instance
// carries none and draws as before.
// THE SAME DISSOLVE CROSS-FADES A TREE INTO ITS FAR VERSION, on every tier:
// across SWAP_BAND of the swap line both are drawn, the near version leaving
// the pixels the pattern gives the far one -- levels 16 and up are the far
// version's half, drawn exactly where the near one is not.
const FADE_STEPS = 16, SWAP_BAND = 1.15;  // 1.3 drew a wide ring of crowns twice on the Redwood Coast (its line is a third of the screen)
const fadeWrapped = new WeakSet();
// THE DISSOLVE ONLY WHERE SOMETHING DISSOLVES (9 November 2026): a shader that
// can discard a pixel keeps the card from skipping hidden pixels early, so a
// tree material carrying the dissolve made every tree dearer to draw behind
// another -- 6% of an Ultra frame on the generated Redwood Coast, 14% of its
// heavy frames, with nothing fading. So the dissolve lives on a copy of each
// material, drawn by a fade mesh holding only the trees inside a fade (cull
// `write`); every other tree is drawn with the material as it was.
// Copied with the patches already on it (wind, rim, snow -- three's clone
// leaves out an assigned onBeforeCompile and cache key), and before the
// renderer's cascades, mist and cloud shadows register the scene, which then
// register the copy as a material of its own.
const fadeCopies = new WeakMap();
function fadeMaterial(material) {
 let copy = fadeCopies.get(material);
 if (copy) return copy;
 copy = material.clone();
 if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) copy.onBeforeCompile = material.onBeforeCompile;
 if (Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')) copy.customProgramCacheKey = material.customProgramCacheKey;
 ditherFade(copy);
 fadeCopies.set(material, copy);
 return copy;
}
function ditherFade(material) {
 if (fadeWrapped.has(material)) return;
 fadeWrapped.add(material);
 const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
 material.customProgramCacheKey = () => (key ? key.call(material) : '') + '-thinfade';
 material.onBeforeCompile = (shader, renderer) => {
  compile?.call(material, shader, renderer);
  shader.vertexShader = 'varying float vThin;\n' + shader.vertexShader.replace('void main() {', 'void main() {\n vThin = 0.;')
   .replace('#include <color_vertex>', `#ifdef USE_INSTANCING_COLOR
 float thinLvl = floor(instanceColor.r * .25 + .001);
 vThin = thinLvl < ${FADE_STEPS}. ? thinLvl / ${FADE_STEPS}. : -(thinLvl - ${FADE_STEPS}.) / ${FADE_STEPS}.;
 vec3 thinColor = vec3(instanceColor.r - thinLvl * 4., instanceColor.gb);
 #define instanceColor thinColor
#endif
#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
 #undef instanceColor
#endif`);
  shader.fragmentShader = 'varying float vThin;\n' + shader.fragmentShader.replace('void main() {',
   'void main() {\n if (vThin != 0.) { float thinN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); if (vThin > 0. ? thinN < vThin : thinN >= -vThin) discard; }');
 };
 material.needsUpdate = true;
}
import * as T from 'three';
import {farParts, midParts, modelParts, hasShippedTwin} from './mesh-assets.js';

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
const tune = {near: 60, margin: 7, shadows: true, shadowCap: 1000, shadowMaps: true, thinShadowsFrom: null, farTrees: null, farPainted: null, farPaintedPx: null};  // metres, degrees, metres
const MOVE = 4;           // metres of camera travel before a rebuild
// The fewest leaf triangles a crown needs before it gets a thinned twin. The
// grown trees have 13-53 thousand; the Kenney cartoon crowns 40-170.
export const TWIN_MIN_TRIANGLES = 2000;
const TURN = Math.cos(4 * Math.PI / 180);
const SUN_TURN = Math.cos(.75 * Math.PI / 180);
const MARGIN = () => tune.margin * Math.PI / 180;

// `thinShadowsFrom`: the first shadow map (0 = nearest) whose trees are drawn
// as their thinned twins (`farParts`) rather than in full. Infinity: never.
// `farTrees`: a crown drawn smaller than this share of the screen's height is
// drawn as its thinned twin (F2). 0: never.
// `thinTrees`: Low's rule (low-trees.js) -- outside the hole's trees, each
// square draws only the share of its trees its distance allows. The trees in
// a square are stored in the order they leave (`treeHash`), so the share is a
// prefix of the square's run and a tree never flickers.
// `midShare`, `farPaintedPx`, `screenPx` (the frame-rate pass, 13 November
// 2026; High and Ultra): what a painted tree is drawn as when it is small is
// its MIDDLE version -- the model itself at `midShare` of its triangles
// (mesh-assets.js midParts) -- in place of its far twin, and the line is a
// size in the picture's own pixels (`screenPx()` its height) where that is
// more of the screen than `farPainted`: what a coarser model may be drawn at
// is a matter of pixels, whatever the screen. The shadow maps' stand-in is
// still the twin.
const RISES = new Map();
function modelRise(name) {
 if (RISES.has(name)) return RISES.get(name);
 let top = 0, foot = 0;
 for (const p of modelParts(name) ?? []) { const g = p.geometry; if (!g.boundingBox) g.computeBoundingBox(); top = Math.max(top, g.boundingBox.max.y); foot = Math.min(foot, g.boundingBox.min.y); }
 RISES.set(name, top - foot);
 return top - foot;
}
export function cullInstances(root, {minInstances = 2, thinShadowsFrom = Infinity, farTrees = 0, farPainted = 0, thinTrees = false, midShare = 0, farPaintedPx = 0, screenPx = null} = {}) {
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
 // THE TALLEST THING IN EACH SQUARE (the frame-rate pass, 13 November 2026):
 // what a square's size on screen is judged by. Until then it was the height
 // of the square's box, which holds the GROUND's rise across the square as
 // well as its trees: on Mountain a 64 m square is often 60 m from its lowest
 // root to its highest tip, three trees tall, so every square read three
 // times its size and nearly no tree was ever drawn as its far version (36 of
 // 3,500 from the first tee on High, 49 million triangles of full models).
 // A model's height from its foot to its top, as the instance is scaled.
 const cellOf = new Map(), boxes = [], tall = [];
 const sphere = new T.Sphere(), m = new T.Matrix4(), corner = new T.Vector3();
 const records = meshes.flatMap(mesh => {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  if (!geo.boundingBox) geo.computeBoundingBox();
  const rise = geo.boundingBox.max.y - Math.min(0, geo.boundingBox.min.y);
  const n = mesh.count, cell = new Int32Array(n), hashOf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
   mesh.getMatrixAt(i, m);
   // Where the instance stands: every part of one tree has the same, so its
   // bark and leaves leave together.
   hashOf[i] = treeHash(m.elements[12], m.elements[14]);
   sphere.copy(geo.boundingSphere).applyMatrix4(m);
   const key = Math.floor(sphere.center.x / CELL) + ',' + Math.floor(sphere.center.z / CELL);
   let c = cellOf.get(key);
   if (c === undefined) { c = boxes.length; cellOf.set(key, c); boxes.push(new T.Box3()); tall.push(0); }
   tall[c] = Math.max(tall[c], rise * Math.hypot(m.elements[4], m.elements[5], m.elements[6]));
   boxes[c].expandByPoint(corner.copy(sphere.center).subScalar(sphere.radius));
   boxes[c].expandByPoint(corner.copy(sphere.center).addScalar(sphere.radius));
   cell[i] = c;
  }
  // Sorted by square, so each visible square is one run -- and within a
  // square by the order trees leave on Low (`treeHash`), so Low's share of a
  // square is a prefix of its run.
  const order = Int32Array.from({length: n}, (_, i) => i).sort((a, b) => cell[a] - cell[b] || hashOf[a] - hashOf[b]);
  const hash = Float32Array.from(order, i => hashOf[i]);
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
  // Which of the course's instanced things Low may thin: the trees and plants
  // (a model's part, or a grown tree's bark and leaves) -- not the long grass,
  // which has its own reach, nor anything else.
  const thinnable = thinTrees && !mesh.userData.cullReach && (!!mesh.userData.model || mesh.userData.role === 'leaf' || !!rootAttr);
  // THE TALLEST OF THIS MODEL IN EACH SQUARE (the frame-rate pass, 13 November
  // 2026): what a painted tree's swap is judged by. Judged by the tallest
  // thing in the square, one 35 m ponderosa kept thirty aspens a third its
  // height whole until IT was small: from Mountain's first tee 750 trees were
  // whole models where a few dozen stood near enough to need it. The model's
  // height, not the part's, so a trunk and its crown still leave together.
  const whole = mesh.userData.model ? modelRise(mesh.userData.model) : 0, tallRun = new Float32Array(runs.length / 3);
  for (let j = 0; j < runs.length; j += 3) {
   let most = 0;
   for (let k = runs[j + 1], e = k + runs[j + 2]; k < e; k++) most = Math.max(most, Math.hypot(src[k * 16 + 4], src[k * 16 + 5], src[k * 16 + 6]));
   tallRun[j / 3] = (whole || rise) * most;
  }
  const record = {mesh, n, order, hash, thinnable, src, srcColour, srcRoot, rootAttr, runs: Int32Array.from(runs), tallRun, lvl: null, drawn: n, cum: null, twin: null, near: false, far: false,
   reach: mesh.userData.cullReach ?? 0, shadowNear: !!mesh.userData.shadowNear};
  const thinFrom = () => tune.thinShadowsFrom ?? thinShadowsFrom;
  // A SHADOW OF THE SAME TREE, DRAWN CHEAPER. From map `thinShadowsFrom` out,
  // a crown's shadow comes from its thinned twin -- a third of the sprays,
  // each grown to keep the crown as full -- which a shadow texel of half a
  // metre or more cannot tell from the whole tree. It shares this mesh's
  // instance buffer, so it costs no upload and always holds the same trees.
  // It is never drawn into the picture: only into shadow maps.
  // A PAINTED TREE SHIPS ITS TWIN (mesh-assets.js `hasShippedTwin`): every
  // part of it, trunk too, swaps -- by its own line, `farPainted`.
  // A BARE TREE BRINGS ITS OWN (mesh-assets.js `bareParts`): its bark and
  // twigs are one part, so its twin is too, and every bare species has one.
  const own = mesh.userData.farGeometry, painted = !!own || !!mesh.userData.model && hasShippedTwin(mesh.userData.model);
  const far = (painted || mesh.userData.role === 'leaf') && (thinShadowsFrom !== Infinity || farTrees > 0 || farPainted > 0)
   ? own ?? farParts(mesh.userData.model)?.[mesh.userData.part]?.geometry : null;
  record.painted = painted;
  // What the far mesh is drawn with: the middle version where the tier asks
  // for one and the model has one, else the twin. A part the middle version
  // left as it was (a small trunk) has no far mesh and is drawn whole.
  const mids = midShare > 0 && painted && !own && mesh.userData.model ? midParts(mesh.userData.model, midShare) : null;
  const midGeo = mids?.[mesh.userData.part]?.geometry;
  const shown = mids ? (midGeo && midGeo !== geo ? midGeo : null) : far;
  record.mid = !!mids;
  // ONLY A CROWN OF MANY SPRAYS HAS A TWIN. Thinning keeps a third of the
  // pieces and grows each, which a grown redwood's thousands of sprays survive
  // and a cartoon crown does not: Kenney's oak is 64 triangles in a handful of
  // flat faces, its twin 16 of them floating apart -- the shards that made Low
  // and Medium's trees a "mangled mess" (16 October) -- and it saved 48
  // triangles a tree. RESEARCH.md *Low and Medium trees: striped crowns and shards*.
  // A PAINTED CROWN (the cartoon overhaul) is never thinned either, however
  // many triangles it has: it is thirty-odd soft lobes, not thousands of
  // sprays, and keeping a third of the lobes leaves bubbles floating apart.
  // It carries `flex` (mesh-assets.js), which is how it is known.
  const thins = far && far.index.count < geo.index.count * .6 && (painted || !geo.attributes.flex && geo.index.count >= TWIN_MIN_TRIANGLES * 3);
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
    this.count = k === undefined || k < thinFrom() || record.shadowNear ? 0 : all || !record.cum ? mesh.count : record.cum[k];
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
   // Only the nearest map for a plant whose shadow is near work (`shadowNear`).
   if (record.twin && k >= thinFrom() || record.shadowNear && k > 0) { this.userData.cullHeld = this.count; this.count = 0; return; }
   if (all || !record.cum) return;
   this.userData.cullHeld = this.count;
   this.count = record.cum[k];
  };
  mesh.onAfterShadow = restore;
  const swaps = mids ? !!shown : thins;
  if (!swaps || (painted ? Math.max(farPainted, farPaintedPx) : farTrees) <= 0) return [record];
  // A CROWN FAR ENOUGH AWAY TO BE SMALL ON SCREEN IS DRAWN AS ITS TWIN (F2).
  // Its own mesh with its own buffer, holding the squares whose trees are
  // small on screen while the full mesh holds the rest. It casts its own
  // shadows with the same thinned shape, so a thinned crown shades itself
  // from the shape it is drawn with: a crown shaded by a DIFFERENT shape goes
  // dark, which is what threw the twin out of Low's shadow map (F3).
  const farMesh = new T.InstancedMesh(shown, mesh.material, n);
  if (srcColour) farMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  farMesh.castShadow = mesh.castShadow; farMesh.receiveShadow = mesh.receiveShadow; farMesh.frustumCulled = false;
  farMesh.userData = {noCull: true, cullHidden: mesh.userData.cullHidden, farOf: mesh};
  farMesh.name = 'far trees'; farMesh.count = 0; farMesh.visible = false;
  mesh.parent.add(farMesh);
  const farRecord = {mesh: farMesh, n, order, hash: record.hash, thinnable: record.thinnable, src, srcColour, runs: record.runs, drawn: 0, cum: null, twin: null, near: false, far: true, painted, shadowNear: record.shadowNear};
  record.near = true;
  // A painted pair is swapped run by run, by its own height (`tallRun`): the
  // two share one list of levels, 0 the far version to FADE_STEPS the whole.
  if (painted) { record.lvl = new Uint8Array(tallRun.length).fill(FADE_STEPS); record.lvlWas = new Uint8Array(tallRun.length); farRecord.lvl = record.lvl; }
  farMesh.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
   const k = shadowOf.get(shadowCamera);
   if (k === undefined) return;
   if (farRecord.twin && k >= thinFrom() || farRecord.shadowNear && k > 0) { this.userData.cullHeld = this.count; this.count = 0; return; }
   if (all || !farRecord.cum) return;
   this.userData.cullHeld = this.count;
   this.count = farRecord.cum[k];
  };
  farMesh.onAfterShadow = restore;
  // A MIDDLE VERSION'S SHADOW, FAR OFF, IS ITS TWIN'S (the frame-rate pass).
  // The whole tree hands its far shadow maps to its twin, above; drawn as its
  // middle version the tree had no such stand-in, and a few thousand trees at
  // 2,700 triangles went into every map where 300 had gone: 23 of the 42
  // million triangles of a frame from Mountain's first tee. The same twin, the
  // same rule, riding the far mesh's own buffer.
  if (mids && thins && thinShadowsFrom !== Infinity && farMesh.castShadow) {
   const twin = new T.InstancedMesh(far, mesh.material, n);
   twin.instanceMatrix = farMesh.instanceMatrix;
   if (farMesh.instanceColor) twin.instanceColor = farMesh.instanceColor;
   twin.castShadow = true; twin.receiveShadow = false; twin.frustumCulled = false;
   twin.userData.noCull = true; twin.name = 'shadow twin';
   twin.onBeforeRender = function () { this.userData.cullHeld = this.count; this.count = 0; };
   twin.onAfterRender = function () { this.count = this.userData.cullHeld; this.userData.cullHeld = undefined; };
   twin.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
    const k = shadowOf.get(shadowCamera);
    this.userData.cullHeld = this.count;
    this.count = k === undefined || k < thinFrom() || farRecord.shadowNear ? 0 : all || !farRecord.cum ? farMesh.count : farRecord.cum[k];
   };
   twin.onAfterShadow = function () { this.count = this.userData.cullHeld; this.userData.cullHeld = undefined; };
   mesh.parent.add(twin);
   farRecord.twin = twin;
  }
  // THE TWIN AGAIN, WHERE A TREE IS SMALL ENOUGH FOR IT (the frame-rate pass).
  // With a middle version there are three: whole, middle, and under the far
  // twin's own old line (`farPainted`) the twin, which is right at that size
  // and a tenth of the middle version's triangles. Without this step a
  // course seen from 250 m up -- every tree 50 to 150 pixels tall -- was all
  // middle versions where 0.9.14 had drawn twins. A second pair on the same
  // runs: the middle version is its near side, by levels of its own (`lvl2`).
  if (!(mids && thins && painted)) return [record, farRecord];
  const tinyMesh = new T.InstancedMesh(far, mesh.material, n);
  if (srcColour) tinyMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  tinyMesh.castShadow = mesh.castShadow; tinyMesh.receiveShadow = mesh.receiveShadow; tinyMesh.frustumCulled = false;
  tinyMesh.userData = {noCull: true, cullHidden: mesh.userData.cullHidden, farOf: mesh, twinOf: mesh};
  tinyMesh.name = 'far trees'; tinyMesh.count = 0; tinyMesh.visible = false;
  mesh.parent.add(tinyMesh);
  record.lvl2 = new Uint8Array(tallRun.length).fill(FADE_STEPS); record.lvl2Was = new Uint8Array(tallRun.length);
  farRecord.lvl2 = record.lvl2;
  const tinyRecord = {mesh: tinyMesh, n, order, hash: record.hash, thinnable: record.thinnable, src, srcColour, runs: record.runs, drawn: 0, cum: null, twin: null, near: false, far: true, painted, shadowNear: record.shadowNear, lvl: record.lvl2};
  tinyMesh.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
   const k = shadowOf.get(shadowCamera);
   if (k === undefined) return;
   if (tinyRecord.shadowNear && k > 0) { this.userData.cullHeld = this.count; this.count = 0; return; }
   if (all || !tinyRecord.cum) return;
   this.userData.cullHeld = this.count;
   this.count = tinyRecord.cum[k];
  };
  tinyMesh.onAfterShadow = restore;
  return [record, farRecord, tinyRecord];
 });

 for (const r of records) {
  if (!r.srcColour || !(r.thinnable || r.near || r.far)) continue;
  // A grown tree's pieces carry their root on the geometry (`treeRoot`), which
  // a second mesh would share in another order: those keep the dissolve on
  // their own material.
  if (r.rootAttr || Array.isArray(r.mesh.material)) { ditherFade(r.mesh.material); continue; }
  const fade = new T.InstancedMesh(r.mesh.geometry, fadeMaterial(r.mesh.material), r.n);
  fade.instanceMatrix.setUsage(T.DynamicDrawUsage);
  fade.instanceColor = new T.InstancedBufferAttribute(new Float32Array(r.n * 3), 3);
  // A near crown fading out casts no shadow: its far half, fading in, casts it --
  // a shape a shadow far off cannot tell apart, and a draw saved in every map.
  fade.castShadow = r.mesh.castShadow && !r.near; fade.receiveShadow = r.mesh.receiveShadow; fade.frustumCulled = false;
  fade.userData = {noCull: true, fadeOf: r.mesh, model: r.mesh.userData.model, role: r.mesh.userData.role};
  fade.name = 'fading trees'; fade.count = 0; fade.visible = false;
  fade.onBeforeShadow = function (renderer, object, camera, shadowCamera) {
   const k = shadowOf.get(shadowCamera);
   if (k === undefined) return;
   this.userData.cullHeld = this.count;
   this.count = r.shadowNear && k > 0 ? 0 : all || !r.fadeCum ? this.count : r.fadeCum[k];
  };
  fade.onAfterShadow = restore;
  r.mesh.parent.add(fade);
  r.fade = fade;
 }
 const visible = new Uint8Array(boxes.length).fill(1);
 // Low's share of each square's trees (`thinTrees`), 1 where all are drawn.
 const keep = new Float32Array(boxes.length).fill(1);
 let region = null, regionKey = '';
 // Each square's distance from the camera at the last rebuild, for a mesh
 // drawn only so far (`cullReach`, metres: the long grass).
 const dist = new Float32Array(boxes.length);
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
 // How near each square's crowns are drawn: 1 near, 0 as their twins, and
 // between, inside SWAP_BAND of the line, the two cross-faded.
 const thin = new Float32Array(boxes.length).fill(1);
 const thinPainted = new Float32Array(boxes.length).fill(1);  // the same, for painted trees (`farPainted`)
 // For a painted pair's own levels: a height times this is its size on screen
 // over the swap line (Infinity: near the camera, or no line -- always whole).
 const scaleP = new Float32Array(boxes.length).fill(Infinity);
 // The same against the far twin's own line, for a model with no middle
 // version (none keeps its outline: tools/mid-cells.mjs): the line in pixels
 // is the middle versions', and a twin drawn that large is lumps.
 const scaleT = new Float32Array(boxes.length).fill(Infinity);
 // OUT OF THE PICTURE, KEPT FOR ITS SHADOW (the frame-rate pass): a square the
 // widened view does not hold, drawn only because its shadow may fall into
 // it. Nobody sees its trees, so a painted pair there is its far version
 // whatever its size: from a tee most of the trees near enough to be whole
 // models stand beside and behind the player, and each was drawn whole into
 // the picture's buffer and the nearest shadow map for a shadow that a model
 // a quarter the size casts the same. It turns whole again inside the view's
 // margin, before it is on screen.
 const unseen = new Uint8Array(boxes.length);
 const paired = records.filter(r => r.near && r.lvl);
 const pass = new Uint8Array(boxes.length), shadowOf = new Map(), shadowFrustum = new T.Frustum();
 const casterPos = new T.Vector3(), casterAim = new T.Vector3();
 const wide = new T.PerspectiveCamera(), frustum = new T.Frustum(), vp = new T.Matrix4();
 const lastPos = new T.Vector3(Infinity, 0, 0), lastFwd = new T.Vector3(), lastSun = new T.Vector3();
 const fwd = new T.Vector3(), away = new T.Vector3(), box = new T.Box3();
 let lastFov = 0, lastAspect = 0, stale = true, all = true, rebuilds = 0, rebuildMs = 0, skipped = 0;
 // What every square was last written by: in view, its first shadow map, its
 // two swap mixes, Low's share, and for each reach a mesh has, past it or not.
 const reaches = [...new Set(records.map(r => r.reach).filter(Boolean))];
 const sig = new Uint8Array(boxes.length * (5 + reaches.length)), was = new Uint8Array(sig.length);
 let written = false;
 const same = () => {
  const w = 5 + reaches.length;
  for (let c = 0; c < boxes.length; c++) {
   const o = c * w;
   sig[o] = visible[c]; sig[o + 1] = pass[c]; sig[o + 2] = Math.round(thin[c] * FADE_STEPS); sig[o + 3] = Math.round(thinPainted[c] * FADE_STEPS); sig[o + 4] = Math.round(keep[c] * 64);
   for (let r = 0; r < reaches.length; r++) sig[o + 5 + r] = dist[c] > reaches[r] ? 1 : 0;
  }
  let equal = written;
  if (equal) for (let k = 0; k < sig.length; k++) if (sig[k] !== was[k]) { equal = false; break; }
  was.set(sig); written = true;
  // Each painted pair's levels, run by run; any that moved is a change.
  for (const r of paired) {
   const {runs, tallRun, lvl, lvlWas} = r, scale = r.mid ? scaleP : scaleT;
   for (let i = 0; i < lvl.length; i++) {
    const ratio = unseen[runs[i * 3]] ? 0 : tallRun[i] * scale[runs[i * 3]];
    const l = ratio <= 1 ? 0 : ratio >= SWAP_BAND ? FADE_STEPS : Math.round((ratio - 1) / (SWAP_BAND - 1) * FADE_STEPS);
    if (l !== lvlWas[i]) equal = false;
    lvl[i] = l;
   }
   lvlWas.set(lvl);
   // The middle version against its twin, by the twin's own line.
   if (r.lvl2) {
    const {lvl2, lvl2Was} = r;
    for (let i = 0; i < lvl2.length; i++) {
     const ratio = tallRun[i] * scaleT[runs[i * 3]];
     const l = ratio <= 1 ? 0 : ratio >= SWAP_BAND ? FADE_STEPS : Math.round((ratio - 1) / (SWAP_BAND - 1) * FADE_STEPS);
     if (l !== lvl2Was[i]) equal = false;
     lvl2[i] = l;
    }
    lvl2Was.set(lvl2);
   }
  }
  return equal;
 };

 const write = () => {
  for (const r of records) {
   const {mesh, order, src, srcColour, srcRoot, rootAttr, runs} = r, hidden = mesh.userData.cullHidden;
   const dst = mesh.instanceMatrix.array, dstColour = mesh.instanceColor?.array, dstRoot = srcRoot ? rootAttr.array : null;
   const fade = r.fade, fDst = fade?.instanceMatrix.array, fColour = fade?.instanceColor.array;
   const groups = all ? 0 : casters.length;
   if (!r.cum || r.cum.length !== groups + 1) r.cum = new Int32Array(groups + 1);
   if (fade && (!r.fadeCum || r.fadeCum.length !== groups + 1)) r.fadeCum = new Int32Array(groups + 1);
   let out = 0, fo = 0;
   for (let g = 0; g <= groups; g++) {
    for (let j = 0; j < runs.length; j += 3) {
     if (!all && (!visible[runs[j]] || pass[runs[j]] !== g)) continue;
     // Past a mesh's reach -- by its nearest point, so a square only goes once
     // all of it is beyond, where the clumps have sunk away.
     if (!all && r.reach && dist[runs[j]] > r.reach) continue;
     const th = r.painted ? thinPainted : thin, own = r.lvl ? r.lvl[j / 3] / FADE_STEPS : th[runs[j]];
     const mix = all ? 1 : r.srcColour ? own : own >= .5 ? 1 : 0;  // no colours to carry a dissolve: switched at the middle
     if (r.near && mix <= 0) continue;
     if (r.far && mix >= 1) continue;
     // A middle version below its twin's line is the twin's; inside that
     // band it is the near side of the second pair. (The two bands are a
     // factor of three and more apart: a run is never in both.)
     let asFar = r.far, side = mix;
     if (r.lvl2 && r.far && !all) { const raw = r.lvl2[j / 3] / FADE_STEPS, low = r.srcColour ? raw : raw >= .5 ? 1 : 0; if (low <= 0) continue; if (low < 1) { asFar = false; side = low; } }
     // Inside the band: the near version leaves (1 - mix) of its pixels, the
     // far version draws exactly those (levels 16 and up).
     const swapQ = (r.near || r.far) && side > 0 && side < 1 ? Math.round((1 - side) * (FADE_STEPS - 1)) : 0;
     const start = runs[j + 1];
     let end = start + runs[j + 2];
     // Low: the square's trees up to its share -- a prefix, by hash.
     const k0 = r.thinnable && !all ? keep[runs[j]] : 1;
     if (k0 < 1) { let e = start; while (e < end && r.hash[e] < k0) e++; end = e; }
     for (let k = start; k < end; k++) {
      if (hidden && hidden[order[k]]) continue;
      // Within the fade band of the share: dissolved by how far in (ditherFade).
      const thin = k0 < 1 ? Math.round(Math.max(0, Math.min(1, 1 - (k0 - r.hash[k]) / LOW_TREES.fade)) * FADE_STEPS) : 0;
      const level = !dstColour ? 0 : asFar ? (swapQ ? FADE_STEPS + swapQ : 0) : Math.max(thin < FADE_STEPS ? thin : FADE_STEPS - 1, swapQ);
      if (level && fade) {
       for (let q = 0; q < 16; q++) fDst[fo * 16 + q] = src[k * 16 + q];
       fColour[fo * 3] = srcColour[k * 3] + level * 4; fColour[fo * 3 + 1] = srcColour[k * 3 + 1]; fColour[fo * 3 + 2] = srcColour[k * 3 + 2];
       fo++;
       continue;
      }
      for (let q = 0; q < 16; q++) dst[out * 16 + q] = src[k * 16 + q];
      if (dstColour) {
       dstColour[out * 3] = srcColour[k * 3] + level * 4;
       dstColour[out * 3 + 1] = srcColour[k * 3 + 1];
       dstColour[out * 3 + 2] = srcColour[k * 3 + 2];
      }
      if (dstRoot) for (let q = 0; q < 4; q++) dstRoot[out * 4 + q] = srcRoot[k * 4 + q];
      out++;
     }
    }
    r.cum[g] = out;
    if (fade) r.fadeCum[g] = fo;
   }
   if (fade) {
    fade.count = fo; fade.visible = fo > 0;
    const fm = fade.instanceMatrix, fc = fade.instanceColor;
    fm.clearUpdateRanges(); fm.addUpdateRange(0, fo * 16); fm.needsUpdate = true;
    fc.clearUpdateRanges(); fc.addUpdateRange(0, fo * 3); fc.needsUpdate = true;
   }
   r.drawn = out + fo; mesh.count = out; mesh.visible = out > 0;
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
  // EVERY MESH VISIBLE FOR A SHADER COMPILE. three's compile skips a hidden
  // object, and the cull hides any mesh with nothing in view -- and starts
  // every far twin hidden -- so a tree first in view during the hole-out
  // flyover had its program built mid-play, on some courses only (the smoke
  // journey ball-light-hole-out: 3 runs in 8 failing, on main as on the
  // architect branch; the late program instanced, two-sided, vertex-coloured
  // toon). Every mesh shown for `fn`, then each put back as it was; the
  // instance counts are untouched -- a compile needs only the object.
  forCompile(fn) {
   const was = records.map(r => [r.mesh.visible, r.twin ? r.twin.visible : null, r.fade ? r.fade.visible : null]);
   for (const r of records) { r.mesh.visible = true; if (r.twin) r.twin.visible = true; if (r.fade) r.fade.visible = true; }
   try { return fn(); }
   finally { records.forEach((r, i) => { r.mesh.visible = was[i][0]; if (r.twin) r.twin.visible = was[i][1]; if (r.fade) r.fade.visible = was[i][2]; }); }
  },
  // `lights`: the shadow-casting lights to sort for, nearest map first (the
  // cascades, or the one sun). Their shadow cameras must already be placed for
  // this frame -- the renderer calls this after the cascades have moved.
  // `lowRegion` (Low only, `thinTrees`): {path, ball, camera, flying} --
  // low-trees.js says what each is. A new hole, a ball moved 10 m or a change
  // into or out of free flight rebuilds, as a camera move does.
  update(camera, sunDir, lights = [], lowRegion = null) {
   if (!tune.shadowMaps) lights = [];
   if (thinTrees && lowRegion) {
    const b = lowRegion.ball, key = `${lowRegion.path?.length}:${lowRegion.path?.[0]}:${lowRegion.path?.[1]}:${b ? Math.round(b.x / 10) + ',' + Math.round(b.z / 10) : '-'}:${lowRegion.flying ? 1 : 0}`;
    if (key !== regionKey) { regionKey = key; stale = true; }
    region = lowRegion;
   }
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
   // A rebuild something asked for (a tree hidden, a tune, Low's hole moved)
   // always writes; one the camera's travel set off writes only if a square's
   // decision changed (`same` below).
   const forced = stale || all;
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
   if (thinTrees && region) {
    const cam = {x: camera.position.x, z: camera.position.z}, reg = {...region, camera: cam};
    const rules = tune.lowTrees ? {...LOW_TREES, ...tune.lowTrees} : LOW_TREES;
    // Rounded up to 64ths: never under the share, and steady between rebuilds.
    for (let c = 0; c < boxes.length; c++) keep[c] = Math.min(1, Math.ceil(squareKeep(reg, {x0: boxes[c].min.x, x1: boxes[c].max.x, z0: boxes[c].min.z, z1: boxes[c].max.z}, rules) * 64) / 64);
   }
   for (let c = 0; c < boxes.length; c++) {
    const b = boxes[c];
    dist[c] = b.distanceToPoint(camera.position);
    if (dist[c] < tune.near) { visible[c] = 1; unseen[c] = 0; continue; }
    box.copy(b);
    if (reach) {
     const len = Math.min(tune.shadowCap, (b.max.y - b.min.y) * reach);
     box.min.x = Math.min(b.min.x, b.min.x + away.x * len); box.max.x = Math.max(b.max.x, b.max.x + away.x * len);
     box.min.z = Math.min(b.min.z, b.min.z + away.z * len); box.max.z = Math.max(b.max.z, b.max.z + away.z * len);
    }
    visible[c] = frustum.intersectsBox(box) ? 1 : 0;
    unseen[c] = visible[c] && reach && !frustum.intersectsBox(b) ? 1 : 0;
   }
   // Which squares are small enough on screen to draw as twins: the tallest
   // thing in the square over its distance, as a share of the screen's height.
   // A square stays thin until it grows 15% past the line, so a camera
   // hovering at the boundary does not swap it back and forth.
   const focal = 1 / (2 * Math.tan(T.MathUtils.degToRad(camera.fov) / 2));
   const mark = (into, small) => {
    if (!(small > 0)) { into.fill(1); return; }
    for (let c = 0; c < boxes.length; c++) {
     const b = boxes[c], d = b.distanceToPoint(camera.position);
     if (d < tune.near) { into[c] = 1; continue; }
     const share = Math.min(tall[c], b.max.y - b.min.y) / d * focal;
     into[c] = share <= small ? 0 : share >= small * SWAP_BAND ? 1 : Math.round((share - small) / (small * (SWAP_BAND - 1)) * FADE_STEPS) / FADE_STEPS;
    }
   };
   mark(thin, tune.farTrees ?? farTrees);
   // (The painted line in pixels, where the tier gives one: see `farPaintedPx`.)
   const px = tune.farPaintedPx ?? farPaintedPx, line = tune.farPainted ?? farPainted;
   const paintedLine = px > 0 && screenPx ? Math.max(line, px / Math.max(1, screenPx())) : line;
   mark(thinPainted, paintedLine);
   for (let c = 0; c < boxes.length; c++) {
    const d = boxes[c].distanceToPoint(camera.position);
    scaleP[c] = !(paintedLine > 0) || d < tune.near ? Infinity : focal / (d * paintedLine);
    scaleT[c] = !(line > 0) || d < tune.near ? Infinity : focal / (d * line);
   }
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
   // NOTHING CHANGED, NOTHING WRITTEN (the frame-rate goal, 9 November 2026):
   // every decision a square's trees are written by, compared with the last
   // write's. A camera drifting across the overview rewrote and uploaded every
   // tree in view every frame (1.8 ms of a Medium frame on Dinosaur Mountain)
   // for squares that had not changed.
   // (Asked every time, forced or not: it is also what works the painted pairs' levels out.)
   const unchanged = same();
   if (!forced && unchanged) { skipped++; return false; }
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
    rebuilds, skipped, lastRebuildMs: +rebuildMs.toFixed(2)};
  }
 };
}
