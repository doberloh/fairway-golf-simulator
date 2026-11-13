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
// LIT AS THE COURSE'S OWN TREES ARE (round 11, 13 November 2026). The owner
// asked for the far growth to be checked at different times of day, "lit the
// same way as everything else". It was not. Each picture was taken with a
// light of its own baked in -- a sun over the viewer's left shoulder, whatever
// the hour and wherever the round's sun stood -- and the upright quad was then
// lit as flat ground is, its normal straight up. So a far wood kept a lit left
// side with the sun behind it, had no lit and shaded side of its own when the
// sun was low, and went from light to shade all at once where the toon ramp
// steps, while the course's trees beside it turned a warm side to the sun.
// Now two pictures a model: its colours with no light in them, and its
// NORMALS as the camera saw them (across, up, toward the eye). The quad
// stands them back up in the world -- across is the way the quad is turned,
// mirrored where the picture is -- and the scene's own sun, sky light, toon
// ramp, fog and grade light each pixel as they light the model itself. One
// more texture read a pixel; nothing baked that the hour can contradict.
//
// No shadow cast or received (past every shadow map). Drawn after everything
// solid and before the ground, so neither a picture behind the course's own
// trees nor the ground behind a picture is shaded.
import * as T from 'three';
import {toonRamp} from './textures.js';

const GUTTER = 2, ATLAS_WIDTH = 2048;

// One tree part drawn flat for the atlas, twice. Its COLOUR: its tint times
// its paint and nothing else, snow on what faces up in a snowy winter
// (vegetation.js snowTopped, the same numbers). And its NORMALS, as the bake's
// camera sees them: red across, green up, blue toward the eye, the back of a
// thin leaf turned to face it.
// (The first round's pictures were flat tint and stood out vivid beside the
// real trees; the second baked a sun of its own in through the scene's ramp,
// which round 11 took out again -- the head of this file says why. What makes
// a picture sit beside the real trees is being lit as they are.)
function bakeMaterial(tint, painted, snow, side, normals) {
 return new T.ShaderMaterial({
  uniforms: {tint: {value: tint}, snow: {value: snow ? 1 : 0}}, side,
  vertexShader: (painted ? 'attribute vec3 color;\n' : '') + `uniform vec3 tint;varying vec3 vTint;varying vec3 vUp;
void main(){vTint=tint${painted ? '*color' : ''};vUp=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: normals ? `varying vec3 vUp;
void main(){vec3 n=normalize(vUp);if(!gl_FrontFacing)n=-n;gl_FragColor=vec4(n*.5+.5,1.);}`
   : `uniform float snow;varying vec3 vTint;varying vec3 vUp;
void main(){vec3 n=normalize(vUp);gl_FragColor=vec4(mix(vTint,vec3(.93,.95,.97),snow*smoothstep(.45,.8,n.y)*.85),1.);}`,
 });
}

// THE ATLAS. `specimens`: [{kind, parts: [{role, geometry, painted}], color: {leaf, bark, ...}, thin}],
// each model one unit high with its foot at the origin. Returns the texture
// and a cell a specimen: where it is in the atlas, and the model's half-width
// and its foot and top in units of its height.
export function bakeTreeAtlas(renderer, specimens, {cell = 192, snow = false} = {}) {
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
 // The normals beside it, cell for cell (numbers, not colours: no colour space).
 const normals = new T.WebGLRenderTarget(ATLAS_WIDTH, height, {samples: 4, depthBuffer: true, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter});
 normals.scissorTest = true;
 const old = {target: renderer.getRenderTarget(), color: renderer.getClearColor(new T.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear};
 const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 200), made = [];
 camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0);
 renderer.autoClear = false;
 target.scissorTest = true;
 for (const c of cells) {
  const scene = new T.Scene(), shapes = new T.Scene(), s = c.specimen;
  for (const p of s.parts) {
   const tint = s.color[p.role] || s.color.accent || s.color.leaf, side = s.thin && p.role === 'leaf' ? T.DoubleSide : T.FrontSide;
   const m = bakeMaterial(tint, !!p.painted && !!p.geometry.attributes.color, snow, side, false), n = bakeMaterial(tint, false, false, side, true);
   made.push(m, n); scene.add(new T.Mesh(p.geometry, m)); shapes.add(new T.Mesh(p.geometry, n));
  }
  camera.left = -c.halfW; camera.right = c.halfW; camera.bottom = c.y0; camera.top = c.y1; camera.updateProjectionMatrix();
  target.viewport.set(c.x, c.y, c.cw, c.ch); target.scissor.set(c.x - 1, c.y - 1, c.cw + 2, c.ch + 2);
  renderer.setRenderTarget(target);
  // Cleared to the crown's own colour with no alpha, so the edge of a
  // picture blends toward leaf, never toward black.
  renderer.setClearColor(s.color.leaf, 0); renderer.clear(true, true, false);
  renderer.render(scene, camera);
  // And its normals, cleared to one that looks up and toward the eye.
  normals.viewport.set(c.x, c.y, c.cw, c.ch); normals.scissor.set(c.x - 1, c.y - 1, c.cw + 2, c.ch + 2);
  renderer.setRenderTarget(normals);
  renderer.setClearColor(BLANK_NORMAL, 0); renderer.clear(true, true, false);
  renderer.render(shapes, camera);
  c.u0 = (c.x + .5) / ATLAS_WIDTH; c.u1 = (c.x + c.cw - .5) / ATLAS_WIDTH; c.v0 = (c.y + .5) / height; c.v1 = (c.y + c.ch - .5) / height;
  delete c.specimen;
 }
 renderer.setRenderTarget(old.target); renderer.setClearColor(old.color, old.alpha); renderer.autoClear = old.auto;
 for (const m of made) m.dispose();
 return {target, texture: target.texture, normals, cells};
}
// (0, .6, .8) as a colour: what a normal reads where no part of the tree was drawn.
const BLANK_NORMAL = new T.Color().setRGB(.5, .8, .9, T.LinearSRGBColorSpace);

// The material every far tree shares: a toon material whose vertex stage
// stands each instance's quad up at its foot, turned to the camera, and whose
// every pixel takes its normal from the model's own picture of them.
export function farTreeMaterial(view, texture, normals) {
 const mat = new T.MeshToonMaterial({map: texture, alphaTest: .5, vertexColors: true, gradientMap: toonRamp(view)});
 const farNormals = {value: normals};
 // (Where a diagnostic can reach it: tools swap it for a flat one to see what the normals do.)
 mat.userData.farNormals = farNormals;
 // NO PROGRAM KEY OF ITS OWN. The renderer wraps this material's
 // onBeforeCompile afterwards (the haze, the cascades' lighting, the clouds'
 // shadows), and three tells one program from another by that function's
 // text. With a fixed key here the unwrapped program, built by an early probe
 // of the scene, was reused: far trees three times too bright, in front of
 // the haze (the first round's pictures).
 mat.onBeforeCompile = shader => {
  shader.uniforms.farNormals = farNormals;
  // THE PICTURE'S NORMAL, STOOD UP IN THE WORLD: red along the way the quad is
  // turned (the other way where the picture is mirrored), green up, blue
  // level toward the eye; then into the view, where three lights it. The
  // include is kept for whatever else patches it.
  shader.fragmentShader = shader.fragmentShader
   .replace('#include <common>', '#include <common>\nuniform sampler2D farNormals;varying vec3 vFarAcross;')
   .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{vec3 nb=texture2D(farNormals,vMapUv).xyz*2.-1.;vec3 ax=normalize(vFarAcross.xyz*vec3(1.,0.,1.));normal=normalize(mat3(viewMatrix)*(ax*nb.x*vFarAcross.y+vec3(0.,nb.y,0.)+vec3(-ax.z,0.,ax.x)*nb.z));}');
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nattribute vec3 aFoot;attribute vec3 aSize;attribute vec4 aCell;varying vec3 vFarAcross;')
   .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv=mix(aCell.xy,aCell.zw,uv);')
   .replace('#include <beginnormal_vertex>', 'vec3 objectNormal=vec3(0.,1.,0.);')
   // <begin_vertex> is kept, not replaced: the haze (mist.js applyMistTo) patches
   // only a shader that still includes it, and the second round's far trees
   // stood crisp in front of the haze for want of it.
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 toEye=cameraPosition-aFoot;vec3 across=normalize(vec3(toEye.z,0.,-toEye.x)+vec3(1e-5,0.,0.));transformed=aFoot+across*mix(aSize.x,aSize.y,position.x)+vec3(0.,position.y*aSize.z,0.);vFarAcross=vec3(across.x,aCell.x>aCell.z?-1.:1.,across.z);');
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
   // A NARROW TREE MORE SO (Hawaii's Cook pine is a seventh as wide as it is
   // tall, and a hillside of them stayed a field of sticks at a quarter
   // wider): the narrower the picture -- from under 0.45 wide for its height,
   // most under 0.15 -- the more it is widened, up to 1.85 times.
   const off = Math.min(1, (s.d ?? 0) / 700), tree = !c.spread && s.h > 4 ? off : 0;
   const narrow = Math.min(1, Math.max(0, (.45 - 2 * c.halfW / (c.y1 - c.y0)) / .3));
   const k = (c.spread ? s.r / c.spread : s.h) * s.grow, flip = (s.pick * 31 % 1) < .5, w = c.halfW * k * (1 + (.25 + .6 * narrow) * tree), tall = (c.y1 - c.y0) * k, y = s.y + c.y0 * k - (.03 + .16 * tree) * tall;
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
 const atlas = bakeTreeAtlas(view.renderer, used, {cell: view.quality?.surround?.cell ?? 192, snow: !!view.snowTops});
 const material = farTreeMaterial(view, atlas.texture, atlas.normals.texture);
 const meshes = farTreeMeshes(sites, atlas.cells, material);
 for (const m of meshes) { view.group.add(m); view.resources?.push(m.geometry); }
 view.resources?.push(atlas.target, atlas.normals, material);
 view.farTrees = {atlas, meshes, count: sites.length};
}
