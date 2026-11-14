import * as T from 'three';
import {MESH_MODELS, MESH_ATLASES, meshBytes} from './asset-meshes.js';
import {growTwigs, twigMesh} from './twigs.js';
import {FAMILY_OF} from './plant-families.js';
import {simplifyCells, clusterSimplify} from './mesh-simplify.js';
import {MID_CELLS} from './mid-cells.js';
export {FAMILY_OF};

// Runtime side of tools/build-meshes.mjs. Decodes the packed CC0 geometry and
// hands the game instanced meshes it can paint from the biome palette.
//
// The imported models bring no materials and no colour of their own -- every
// part carries a role (bark, leaf, stone, dirt, accent) and nothing else, so a
// single pine serves the Pacific Northwest and autumn alike. That is the whole
// reason the ingestion throws the source materials away: an imported albedo
// would fight world.bio rather than serve it.

const cache = new Map();

// Positions are int16 against a model normalised to unit height, sitting on
// y=0 and centred on x/z, so the game scales each instance the same way it
// scales its procedural shapes.
const SCALE = 16384;

export function modelParts(name) {
 if (cache.has(name)) return cache.get(name);
 const model = MESH_MODELS[name];
 if (!model) return null;
 const bytes = meshBytes(), buffer = bytes.buffer;
 const parts = model.parts.map(p => {
  const quantised = new Int16Array(buffer, p.positionAt, p.count * 3);
  const packedNormal = new Int8Array(buffer, p.normalAt, p.count * 3);
  const position = new Float32Array(p.count * 3), normal = new Float32Array(p.count * 3);
  for (let i = 0; i < position.length; i++) {
   position[i] = quantised[i] / (model.q ?? SCALE);
   normal[i] = packedNormal[i] / 127;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new T.BufferAttribute(normal, 3));
  // Textured parts: house atlases, and bark and leaf sheets on the generated
  // trees. `uvSpan` is the largest coordinate the part uses -- an atlas stays
  // inside the unit square and has none, while bark tiles far past it.
  if (p.uvAt !== undefined) {
   const packed = new Uint16Array(buffer, p.uvAt, p.count * 2), uv = new Float32Array(p.count * 2);
   const span = p.uvSpan || 1;
   for (let i = 0; i < uv.length; i++) uv[i] = packed[i] / 65535 * span;
   geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }
  // THE CARTOON PAINT (tools/blender/cartoon.py): RGB a multiplier on the
  // colour the role is painted with -- stored halved, so a byte of 128 is
  // "as painted" -- and alpha how freely the vertex moves in the wind. As
  // `color` it multiplies the instance colour in every stock shader; `flex`
  // is read by the wind (textures.js windMaterial).
  if (p.paintAt !== undefined) {
   const bytes4 = new Uint8Array(buffer, p.paintAt, p.count * 4), color = new Float32Array(p.count * 3), flex = new Float32Array(p.count);
   for (let i = 0; i < p.count; i++) {
    color[i * 3] = bytes4[i * 4] / 127.5; color[i * 3 + 1] = bytes4[i * 4 + 1] / 127.5; color[i * 3 + 2] = bytes4[i * 4 + 2] / 127.5;
    flex[i] = bytes4[i * 4 + 3] / 255;
   }
   geometry.setAttribute('color', new T.BufferAttribute(color, 3));
   geometry.setAttribute('flex', new T.BufferAttribute(flex, 1));
  }
  geometry.setIndex(new T.BufferAttribute(new Uint16Array(buffer, p.indexAt, p.index).slice(), 1));
  geometry.computeBoundingSphere();
  return {role: p.role, geometry, painted: p.paintAt !== undefined};
 });
 cache.set(name, parts);
 return parts;
}

// A TREE SEEN FROM FAR OFF, OR ONLY AS A SHADOW. The same tree with a share of
// its leaf sprays, each enlarged about its own centre so the crown keeps its
// fullness. Built here from the full model rather than shipped: the grower's
// `_Far` twins would add megabytes to a single-file game for geometry this
// derives in milliseconds.
//
// SAME TREE, SAME SILHOUETTE. A spray is a connected piece of the leaf part
// (12-16 triangles on the grown trees, 2,000-4,200 of them a tree), and the
// pieces kept are every nth in the order the grower laid them down -- which is
// along the branches -- so what is left is spread over the whole crown rather
// than thinned from one side. A level of detail that changes shape pops when
// it swaps; one that changes only density does not (tools/grow.mjs says the
// same about its own twins).
//
// Everything that is not foliage is shared with the full model as it is: the
// trunk is about 5% of a grown tree and the part a player looks at.
const farCache = new Map();
//
// A PAINTED MODEL SHIPS ITS TWIN (the cartoon overhaul): its crown is thirty
// soft lobes, not thousands of sprays, so thinning would leave bubbles
// floating apart. Blender builds it again with every lobe an icosahedron
// (`<name>_Far`, tools/blender/cartoon.py `far_twin`) -- the same lobes in
// the same places, a twelfth of the triangles, kilobytes rather than the
// megabytes of a grown tree's twin. Part for part, the twin replaces the
// whole model, trunk included.
export const hasShippedTwin = name => !!MESH_MODELS[name + '_Far'];
export function farParts(name, keep = 1 / 3) {
 const key = name + '|' + keep;
 if (farCache.has(key)) return farCache.get(key);
 const parts = modelParts(name);
 if (!parts) return null;
 const shipped = hasShippedTwin(name) ? modelParts(name + '_Far') : null;
 const far = shipped && shipped.length === parts.length && shipped.every((p, i) => p.role === parts[i].role) ? shipped
  : parts.map(p => p.role === 'leaf' ? {role: p.role, geometry: thinSprays(p.geometry, keep)} : p);
 farCache.set(key, far);
 return far;
}

// A TREE'S MIDDLE VERSION (the frame-rate pass, 13 November 2026). A painted
// tree is some 12,000 triangles and its far twin some 300: the twin is right
// under about a hundred pixels tall and plainly lumps above that, so on High
// and Ultra -- where the twin was kept for crowns under 5% and 3% of the
// screen -- nearly every tree in view was the whole model: 3,500 of them from
// Mountain's first tee, 49 million triangles, three fifths of the frame.
// This is the model itself made coarser, each part merged on a grid until
// `share` of its triangles are left (mesh-simplify.js: paint, wind and
// normals kept), for the sizes between. Made the first time a model asks,
// from the model's own decoded parts: nothing more is shipped. A part too
// small to gain, or one that carries a texture (the simplifier keeps none),
// stays as it is; null when nothing in the model was made coarser.
const midCache = new Map();
// (1,500: a part under that -- most trunks -- stays whole at every distance.
// Split, each was a far mesh, a fading mesh and a shadow stand-in of its own,
// seven or eight draws a trunk for a few hundred triangles: at a tee with
// little in view the frame's draws rose by half and the frame with them.)
export const MID_MIN_TRIANGLES = 1500;
// The arrays the simplifier takes, from a part's geometry.
export function simplifierInput(g) {
 const a = g.attributes, n = a.position.count, color = a.color ? new Float32Array(n * 4) : null;
 if (color) for (let i = 0; i < n; i++) { color[i * 4] = a.color.array[i * 3]; color[i * 4 + 1] = a.color.array[i * 3 + 1]; color[i * 4 + 2] = a.color.array[i * 3 + 2]; color[i * 4 + 3] = a.flex ? a.flex.array[i] : 0; }
 return {position: a.position.array, normal: a.normal?.array, color, index: g.index.array};
}
// Which of a model's parts get a middle version at all.
export const midWorthy = g => !!g.index && g.index.count / 3 >= MID_MIN_TRIANGLES && !g.attributes.uv;
export function midParts(name, share = 1 / 5) {
 const key = name + '|' + share;
 if (midCache.has(key)) return midCache.get(key);
 const parts = modelParts(name);
 let made = 0;
 const mid = parts?.map((p, index) => {
  const g = p.geometry, a = g.attributes;
  if (!midWorthy(g)) return p;
  // THE GRID IS KNOWN (src/mid-cells.js, written by tools/mid-cells.mjs): one
  // simplification, where finding the grid is seven or eight. A model or a
  // share the table has not got is searched for, as the table's maker does.
  const input = simplifierInput(g), known = MID_CELLS[share]?.[name]?.[index];
  const s = known === 0 ? null : known ? clusterSimplify(input, known) : simplifyCells(input, share, 60)?.part;
  if (!s) return p;
  const out = new T.BufferGeometry(), m = s.position.length / 3;
  out.setAttribute('position', new T.BufferAttribute(s.position, 3));
  if (s.normal) out.setAttribute('normal', new T.BufferAttribute(s.normal, 3));
  if (s.color) {
   const rgb = new Float32Array(m * 3), flex = new Float32Array(m);
   for (let i = 0; i < m; i++) { rgb[i * 3] = s.color[i * 4]; rgb[i * 3 + 1] = s.color[i * 4 + 1]; rgb[i * 3 + 2] = s.color[i * 4 + 2]; flex[i] = s.color[i * 4 + 3]; }
   out.setAttribute('color', new T.BufferAttribute(rgb, 3));
   if (a.flex) out.setAttribute('flex', new T.BufferAttribute(flex, 1));
  }
  out.setIndex(new T.BufferAttribute(m > 65535 ? s.index : Uint16Array.from(s.index), 1));
  out.computeBoundingSphere();
  made++;
  return {...p, geometry: out};
 }) ?? null;
 const result = made ? mid : null;
 midCache.set(key, result);
 return result;
}

// A TREE BARE IN WINTER (the seasons; twigs.js): the model with its leaf and
// flowers left out and the branches they hid grown into its bark -- into it,
// so the wood costs no draw call of its own, and the tree stays cheaper than
// in leaf (a maple's 4,560 leaf triangles against some 1,700 of twigs). Part
// for part what `instanceModels` takes as an entry's `parts`. Each bark
// carries its twin in `far`: the twin's trunk and the stronger branches, which
// instance-cull.js draws where it would draw the leafy tree's twin. `keep`:
// roles that stay on a bare tree (an aspen's "eyes" are on its trunk, not its
// crown). `width`, `shade` and `tip`: twigs.js `twigMesh`.
const bareCache = new Map();
export function bareParts(name, {keep = [], ...twig} = {}) {
 const key = name + JSON.stringify([keep, twig]);
 if (bareCache.has(key)) return bareCache.get(key);
 const parts = modelParts(name);
 if (!parts) return null;
 const leaf = parts.find(p => p.role === 'leaf'), bark = parts.find(p => p.role === 'bark');
 const stays = parts.map((p, index) => ({...p, index})).filter(p => keep.includes(p.role));
 let bare = stays;
 if (leaf) {
  const nodes = growTwigs({leaf: leaf.geometry.attributes.position.array, bark: bark?.geometry.attributes.position.array ?? [], seed: name});
  const twinBark = hasShippedTwin(name) ? modelParts(name + '_Far')?.find(p => p.role === 'bark') : null;
  bare = [{role: 'bark', painted: bark ? bark.painted : true, index: parts.indexOf(bark),
   geometry: withTwigs(bark?.geometry, twigMesh(nodes, {...twig, seed: name})),
   far: withTwigs((twinBark || bark)?.geometry, twigMesh(nodes, {...twig, seed: name, far: true}))}, ...stays];
 }
 bareCache.set(key, bare);
 return bare;
}

// The wood of `mesh` (twigs.js) added to a bark geometry, in that geometry's
// attributes (a texture coordinate a twig has no use for stays zero), or on
// its own for a plant with no bark.
function withTwigs(base, mesh) {
 const old = base?.attributes.position.count ?? 0, added = mesh.position.length / 3, n = old + added;
 const own = {position: mesh.position, normal: mesh.normal, color: mesh.shade, flex: mesh.flex};
 const g = new T.BufferGeometry();
 for (const name of base ? Object.keys(base.attributes) : Object.keys(own)) {
  const src = base?.attributes[name], size = src?.itemSize ?? (name === 'position' || name === 'normal' || name === 'color' ? 3 : 1), to = new Float32Array(n * size);
  if (src) to.set(src.array);
  if (name === 'color') for (let i = 0; i < added; i++) to.fill(mesh.shade[i], (old + i) * 3, (old + i + 1) * 3);
  else if (own[name]) to.set(own[name], old * size);
  g.setAttribute(name, new T.BufferAttribute(to, size));
 }
 const oldIndex = base?.index?.array ?? [], index = new (n > 65535 ? Uint32Array : Uint16Array)(oldIndex.length + mesh.index.length);
 index.set(oldIndex);
 for (let i = 0; i < mesh.index.length; i++) index[oldIndex.length + i] = mesh.index[i] + old;
 g.setIndex(new T.BufferAttribute(index, 1));
 g.computeBoundingSphere();
 return g;
}

export function thinSprays(geometry, keep) {
 const index = geometry.index.array, n = geometry.attributes.position.count;
 const parent = Int32Array.from({length: n}, (_, i) => i);
 const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
 for (let t = 0; t < index.length; t += 3) {
  const a = find(index[t]); parent[find(index[t + 1])] = a; parent[find(index[t + 2])] = a;
 }
 // Pieces numbered in the order their first triangle appears.
 const pieceOfRoot = new Int32Array(n).fill(-1), piece = new Int32Array(n).fill(-1);
 let pieces = 0;
 for (let t = 0; t < index.length; t += 3) {
  const r = find(index[t]);
  if (pieceOfRoot[r] < 0) pieceOfRoot[r] = pieces++;
 }
 for (let v = 0; v < n; v++) piece[v] = pieceOfRoot[find(v)];
 const step = 1 / keep, kept = new Uint8Array(pieces);
 for (let k = 0; k < pieces; k++) kept[k] = Math.floor(k / step) !== Math.floor((k + 1) / step) ? 1 : 0;
 // Each kept piece grows about its own centre so the crown keeps its area.
 const grow = Math.sqrt(step), pos = geometry.attributes.position.array;
 const centre = new Float64Array(pieces * 3), count = new Uint32Array(pieces);
 for (let v = 0; v < n; v++) {
  const k = piece[v];
  if (k < 0) continue;
  centre[k * 3] += pos[v * 3]; centre[k * 3 + 1] += pos[v * 3 + 1]; centre[k * 3 + 2] += pos[v * 3 + 2]; count[k]++;
 }
 const remap = new Int32Array(n).fill(-1);
 let next = 0;
 for (let v = 0; v < n; v++) if (piece[v] >= 0 && kept[piece[v]]) remap[v] = next++;
 const g = new T.BufferGeometry();
 for (const [a, src] of Object.entries(geometry.attributes)) {
  const size = src.itemSize, dst = new Float32Array(next * size);
  for (let v = 0; v < n; v++) {
   const to = remap[v];
   if (to < 0) continue;
   for (let c = 0; c < size; c++) {
    let x = src.array[v * size + c];
    if (a === 'position') { const m = centre[piece[v] * 3 + c] / count[piece[v]]; x = m + (x - m) * grow; }
    dst[to * size + c] = x;
   }
  }
  g.setAttribute(a, new T.BufferAttribute(dst, size));
 }
 let tris = 0;
 for (let t = 0; t < index.length; t += 3) if (remap[index[t]] >= 0) tris++;
 const newIndex = next > 65535 ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
 for (let t = 0, o = 0; t < index.length; t += 3) if (remap[index[t]] >= 0) {
  newIndex[o++] = remap[index[t]]; newIndex[o++] = remap[index[t + 1]]; newIndex[o++] = remap[index[t + 2]];
 }
 g.setIndex(new T.BufferAttribute(newIndex, 1));
 g.computeBoundingSphere();
 return g;
}

export const modelRadius = name => MESH_MODELS[name]?.radius || .35;

export const modelTextured = name => !!MESH_MODELS[name]?.textured;
export const modelExtents = name => {
 const m = MESH_MODELS[name];
 return {rx: m?.rx || .35, rz: m?.rz || .35};
};

// The house atlases, decoded on demand. Each is a palette grid, so a building
// takes all of its colour from whichever one it is drawn with -- which is why
// there are four rather than one: with a single atlas every roof on the course
// is the same swatch.
const atlases = [];
export const atlasCount = () => MESH_ATLASES.length;
export function meshAtlas(index = 0) {
 if (!MESH_ATLASES.length) return null;
 const at = index % MESH_ATLASES.length;
 if (atlases[at]) return atlases[at];
 // Image is a browser API. Tests build the same scene under Node, where the
 // geometry and its placement are exactly what they need to check, so return no
 // texture rather than throwing and taking the whole house path down with it.
 if (typeof Image === 'undefined') return null;
 const image = new Image();
 image.src = MESH_ATLASES[at];
 const texture = new T.Texture(image);
 texture.colorSpace = T.SRGBColorSpace;
 // A grid of flat swatches: bilinear filtering bleeds one into the next.
 texture.magFilter = texture.minFilter = T.NearestFilter;
 texture.generateMipmaps = false;
 // glTF puts the UV origin at the top left; a THREE.Texture defaults to the
 // bottom left. Leaving flipY on samples the mirrored swatch, which shows up as
 // green roofs and walls.
 texture.flipY = false;
 image.onload = () => { texture.needsUpdate = true; };
 atlases[at] = texture;
 return texture;
}


const families = new Map();
export function familyModels(family) {
 if (!families.has(family))
  families.set(family, Object.keys(MESH_MODELS).filter(k => MESH_MODELS[k].family === family));
 return families.get(family);
}

// Builds one InstancedMesh per (model, role). Instances carry their own colour,
// so a stand varies in tint as well as in shape without costing a draw call.
export function instanceModels(group, entries, materialFor, onMesh) {
 const buckets = new Map();
 for (const entry of entries) {
  // An entry's own parts, if it has them (a tree bare in winter: `bareParts`).
  const parts = entry.parts ?? modelParts(entry.model);
  if (!parts) continue;
  for (const part of parts) {
   const key = `${entry.model}|${part.role}|${entry.variant ?? 0}`;
   const bucket = buckets.get(key) || {part, model: entry.model, partIndex: part.index ?? parts.indexOf(part), variant: entry.variant ?? 0, matrices: [], colors: [], owners: []};
   bucket.matrices.push(entry.matrix);
   bucket.colors.push(entry.color[part.role] || entry.color.accent);
   bucket.owners.push(entry.owner);
   buckets.set(key, bucket);
  }
 }
 const meshes = [];
 for (const {part, model, partIndex, variant, matrices, colors, owners} of buckets.values()) {
  if (!matrices.length) continue;
  // `painted`: the part carries the cartoon paint, so its material must read
  // vertex colours -- a third argument every materialFor can ignore.
  const mesh = new T.InstancedMesh(part.geometry, materialFor(part.role, variant, !!part.painted), matrices.length);
  matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colors[i]); });
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  // What it draws, so the renderer can find this part's thinned twin
  // (`farParts`) without reverse-engineering it from the geometry.
  mesh.userData.model = model; mesh.userData.part = partIndex; mesh.userData.role = part.role;
  if (part.far) mesh.userData.farGeometry = part.far;
  group.add(mesh);
  meshes.push(mesh);
  onMesh?.({mesh, matrices, owners});
 }
 return meshes;
}
