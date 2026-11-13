// THE FAR TREES, DRAWN AS PICTURES OF THE COURSE'S OWN MODELS (the surroundings
// rework, 12 November 2026).
//
// Past the near band (surround.js) every tree to the tier's reach is a site,
// and each site is drawn as two triangles standing upright, turned about its
// trunk to face the camera, wearing a picture of its own species' model. The
// pictures are taken here when the course is built: each model the course
// drew (vegetation.js records one `specimen` a model, with the colours that
// tree was given -- the round's season, a bare tree in winter, the snow on
// its top) is drawn from the side into one atlas. So a palm is a palm and a
// saguaro a saguaro, in this round's colours, where the far woods drew a
// dome (the owner: "the 'tree domes' we added look way out of place").
//
// WHY PICTURES. A crown 2 km off is a dozen pixels high. Drawn as its model it
// would be hundreds of triangles a tree and tens of thousands of trees; as a
// lump it is what the owner turned down. Two triangles a tree is fewer than
// the domes took (20 a site, 60 a cluster), which is how the far land holds
// three times as many trees for less than the far woods cost.
//
// LIT AS THE GROUND IS: every normal straight up, through the scene's own toon
// ramp, fog and grade, so a far wood darkens and warms with the hour as the
// land under it does. The picture carries the crown's own shading (its paint,
// and a little more light on what faces the sky).
//
// No shadow cast or received (past every shadow map). Drawn after everything
// solid and before the ground, so neither a picture behind the course's own
// trees nor the ground behind a picture is shaded.
import * as T from 'three';
import {toonRamp} from './textures.js';

const GUTTER = 2, ATLAS_WIDTH = 2048;

// One tree part drawn flat for the atlas: its tint times its paint, lighter
// toward the sky, snow on what faces up in a snowy winter (vegetation.js
// snowTopped, the same numbers).
function bakeMaterial(tint, painted, snow, side, ramp) {
 return new T.ShaderMaterial({
  uniforms: {tint: {value: tint}, snow: {value: snow ? 1 : 0}, ramp: {value: ramp}}, side,
  vertexShader: (painted ? 'attribute vec3 color;\n' : '') + `uniform vec3 tint;varying vec3 vTint;varying vec3 vUp;
void main(){vTint=tint${painted ? '*color' : ''};vUp=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  // SHADED AS THE MODEL IS IN THE GAME: through the scene's own coloured ramp
  // (textures.js toonRamp), from a sun high over the viewer's left shoulder,
  // so a crown has its lit side and its blue shade. Flat tint, the first
  // round's pictures stood out vivid against the real trees beside them.
  fragmentShader: `uniform float snow;uniform sampler2D ramp;varying vec3 vTint;varying vec3 vUp;
void main(){vec3 n=normalize(vUp);vec3 c=mix(vTint,vec3(.93,.95,.97),snow*smoothstep(.45,.8,n.y)*.85);
float lit=dot(n,normalize(vec3(-.5,.62,.6)));c*=texture2D(ramp,vec2(lit*.5+.5,.5)).rgb;gl_FragColor=vec4(c,1.);}`,
 });
}

// THE ATLAS. `specimens`: [{kind, parts: [{role, geometry, painted}], color: {leaf, bark, ...}, thin}],
// each model one unit high with its foot at the origin. Returns the texture
// and a cell a specimen: where it is in the atlas, and the model's half-width
// and its foot and top in units of its height.
export function bakeTreeAtlas(renderer, specimens, {cell = 192, snow = false, ramp = null} = {}) {
 const cells = [];
 let x = GUTTER, y = GUTTER;
 for (const s of specimens) {
  const box = new T.Box3();
  for (const p of s.parts) { if (!p.geometry.boundingBox) p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
  const y0 = Math.min(0, box.min.y), y1 = Math.max(y0 + .05, box.max.y), halfW = Math.max(.03, Math.abs(box.min.x), Math.abs(box.max.x)), aspect = 2 * halfW / (y1 - y0);
  // A low wide plant takes a shorter cell rather than a wider one.
  const ch = Math.max(8, Math.round(cell * Math.min(1, 2.5 / aspect))), cw = Math.max(8, Math.round(ch * aspect));
  if (x + cw + GUTTER > ATLAS_WIDTH) { x = GUTTER; y += cell + GUTTER; }
  cells.push({kind: s.kind, spread: s.spread || 0, x, y, cw, ch, y0, y1, halfW, specimen: s});
  x += cw + GUTTER;
 }
 const height = y + cell + GUTTER;
 const target = new T.WebGLRenderTarget(ATLAS_WIDTH, height, {samples: 4, depthBuffer: true, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, colorSpace: T.SRGBColorSpace});
 target.texture.anisotropy = 4;
 const old = {target: renderer.getRenderTarget(), color: renderer.getClearColor(new T.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear};
 const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 200), made = [];
 camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0);
 renderer.autoClear = false;
 target.scissorTest = true;
 for (const c of cells) {
  const scene = new T.Scene(), s = c.specimen;
  for (const p of s.parts) {
   const tint = s.color[p.role] || s.color.accent || s.color.leaf;
   const m = bakeMaterial(tint, !!p.painted && !!p.geometry.attributes.color, snow, s.thin && p.role === 'leaf' ? T.DoubleSide : T.FrontSide, ramp);
   made.push(m); scene.add(new T.Mesh(p.geometry, m));
  }
  camera.left = -c.halfW; camera.right = c.halfW; camera.bottom = c.y0; camera.top = c.y1; camera.updateProjectionMatrix();
  target.viewport.set(c.x, c.y, c.cw, c.ch); target.scissor.set(c.x - 1, c.y - 1, c.cw + 2, c.ch + 2);
  renderer.setRenderTarget(target);
  // Cleared to the crown's own colour with no alpha, so the edge of a
  // picture blends toward leaf, never toward black.
  renderer.setClearColor(s.color.leaf, 0); renderer.clear(true, true, false);
  renderer.render(scene, camera);
  c.u0 = (c.x + .5) / ATLAS_WIDTH; c.u1 = (c.x + c.cw - .5) / ATLAS_WIDTH; c.v0 = (c.y + .5) / height; c.v1 = (c.y + c.ch - .5) / height;
  delete c.specimen;
 }
 renderer.setRenderTarget(old.target); renderer.setClearColor(old.color, old.alpha); renderer.autoClear = old.auto;
 for (const m of made) m.dispose();
 return {target, texture: target.texture, cells};
}

// The material every far tree shares: a toon material whose vertex stage
// stands each instance's quad up at its foot, turned to the camera.
export function farTreeMaterial(view, texture) {
 const mat = new T.MeshToonMaterial({map: texture, alphaTest: .5, vertexColors: true, gradientMap: toonRamp(view)});
 // NO PROGRAM KEY OF ITS OWN. The renderer wraps this material's
 // onBeforeCompile afterwards (the haze, the cascades' lighting, the clouds'
 // shadows), and three tells one program from another by that function's
 // text. With a fixed key here the unwrapped program, built by an early probe
 // of the scene, was reused: far trees three times too bright, in front of
 // the haze (the first round's pictures).
 mat.onBeforeCompile = shader => {
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nattribute vec3 aFoot;attribute vec3 aSize;attribute vec4 aCell;')
   .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv=mix(aCell.xy,aCell.zw,uv);')
   .replace('#include <beginnormal_vertex>', 'vec3 objectNormal=vec3(0.,1.,0.);')
   // <begin_vertex> is kept, not replaced: the haze (mist.js applyMistTo) patches
   // only a shader that still includes it, and the second round's far trees
   // stood crisp in front of the haze for want of it.
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 toEye=cameraPosition-aFoot;vec3 across=normalize(vec3(toEye.z,0.,-toEye.x)+vec3(1e-5,0.,0.));transformed=aFoot+across*mix(aSize.x,aSize.y,position.x)+vec3(0.,position.y*aSize.z,0.);');
 };
 return mat;
}

const SECTORS = 12, BANDS = [700, 2000];
// `sites`: surround.js's far list. `cells`: the atlas's. Returns the meshes
// made, one a piece of the country (a twelfth of the compass, three distances)
// so the card skips what is out of view.
export function farTreeMeshes(sites, cells, material, {spreadOf = () => 0} = {}) {
 const byKind = new Map();
 cells.forEach((c, i) => { if (!byKind.has(c.kind)) byKind.set(c.kind, []); byKind.get(c.kind).push(i); });
 const tiles = new Map();
 for (const s of sites) {
  const list = byKind.get(s.kind); if (!list) continue;
  const band = s.d < BANDS[0] ? 0 : s.d < BANDS[1] ? 1 : 2, key = Math.floor((Math.atan2(s.z, s.x) / (2 * Math.PI) + 1) * SECTORS) % SECTORS * 3 + band;
  if (!tiles.has(key)) tiles.set(key, []); tiles.get(key).push(s);
 }
 const quad = {position: new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3), uv: new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2), normal: new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)};
 const meshes = [];
 // NEAREST FIRST (the third measurement: one Ultra view was 5% slower than
 // 0.9.14 with fewer triangles -- a wooded hillside is ten pictures deep, and
 // in no order every one of them was shaded). The camera stands on the
 // course, so nearer the property line is nearer the eye, near enough: each
 // piece's trees are drawn in that order, and the pieces themselves nearest
 // band first, so a picture behind another fails the depth test unshaded.
 // AND AFTER THE COURSE'S OWN TREES, BEFORE THE GROUND (render order .5 to .7;
 // everything solid is 0, the ground 1): from a tee most of the far wood is
 // behind the course's own stands, and drawn first -- as the far woods were,
 // at -1 -- every picture was shaded and then painted over. Measured on Ultra
 // (tools/frame-variants.mjs, far trees hidden): 2.5% of a frame drawn first.
 for (const [key, list] of tiles) {
  list.sort((a, b) => a.d - b.d);
  const n = list.length, foot = new Float32Array(n * 3), size = new Float32Array(n * 3), cell = new Float32Array(n * 4), tint = new Float32Array(n * 3);
  const box = new T.Box3();
  list.forEach((s, i) => {
   const mine = byKind.get(s.kind), c = cells[mine[Math.floor(s.pick * 7919) % mine.length]];
   // A tree is its model scaled by its height; a ground cover by its spread.
   // FAR OFF, A WOOD IS ITS CROWNS. From above, thinned pictures of tall
   // bare-boled trees (Hawaii's Cook pines, Mountain's ponderosas) stood as a
   // field of sticks: in a real wood the crowns hide the trunks. So with
   // distance (full at 700 m) a picture is drawn a quarter wider and let a
   // sixth of its height into the ground. PLACED.
   const off = Math.min(1, (s.d ?? 0) / 700), tree = !c.spread && s.h > 4 ? off : 0;
   const k = (c.spread ? s.r / c.spread : s.h) * s.grow, flip = (s.pick * 31 % 1) < .5, w = c.halfW * k * (1 + .25 * tree), tall = (c.y1 - c.y0) * k, y = s.y + c.y0 * k - (.03 + .16 * tree) * tall;
   foot.set([s.x, y, s.z], i * 3); size.set([-w, w, tall], i * 3);
   cell.set(flip ? [c.u1, c.v0, c.u0, c.v1] : [c.u0, c.v0, c.u1, c.v1], i * 4);
   const shade = .88 + .24 * (s.pick * 131 % 1); tint.set([shade, shade, shade], i * 3);
   box.expandByPoint({x: s.x - w, y, z: s.z - w}); box.expandByPoint({x: s.x + w, y: y + tall, z: s.z + w});
  });
  const geo = new T.InstancedBufferGeometry();
  geo.setAttribute('position', quad.position); geo.setAttribute('uv', quad.uv); geo.setAttribute('normal', quad.normal); geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aFoot', new T.InstancedBufferAttribute(foot, 3)); geo.setAttribute('aSize', new T.InstancedBufferAttribute(size, 3));
  geo.setAttribute('aCell', new T.InstancedBufferAttribute(cell, 4)); geo.setAttribute('color', new T.InstancedBufferAttribute(tint, 3));
  geo.instanceCount = n;
  geo.boundingBox = box; geo.boundingSphere = box.getBoundingSphere(new T.Sphere());
  const mesh = new T.Mesh(geo, material);
  mesh.name = 'Far trees'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = .5 + .1 * (key % 3); mesh.userData.noSunMask = true;
  meshes.push(mesh);
 }
 return meshes;
}

// Called by vegetation.js once every species is in the scene.
export function addFarTrees(view, sites) {
 const specimens = view.specimens || [];
 if (!sites?.length || !specimens.length || !view.renderer) return;
 const wanted = new Set(sites.map(s => s.kind)), used = specimens.filter(s => wanted.has(s.kind));
 if (!used.length) return;
 const atlas = bakeTreeAtlas(view.renderer, used, {cell: view.quality?.surround?.cell ?? 192, snow: !!view.snowTops, ramp: toonRamp(view)});
 const material = farTreeMaterial(view, atlas.texture);
 const meshes = farTreeMeshes(sites, atlas.cells, material);
 for (const m of meshes) { view.group.add(m); view.resources?.push(m.geometry); }
 view.resources?.push(atlas.target, material);
 view.farTrees = {atlas, meshes, count: sites.length};
}
