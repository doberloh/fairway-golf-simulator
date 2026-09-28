import * as T from 'three';
import {MESH_MODELS, MESH_ATLASES, meshBytes} from './asset-meshes.js';

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
   position[i] = quantised[i] / SCALE;
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
  geometry.setIndex(new T.BufferAttribute(new Uint16Array(buffer, p.indexAt, p.index).slice(), 1));
  geometry.computeBoundingSphere();
  return {role: p.role, geometry};
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
export function farParts(name, keep = 1 / 3) {
 const key = name + '|' + keep;
 if (farCache.has(key)) return farCache.get(key);
 const parts = modelParts(name);
 if (!parts) return null;
 const far = parts.map(p => p.role === 'leaf' ? {role: p.role, geometry: thinSprays(p.geometry, keep)} : p);
 farCache.set(key, far);
 return far;
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

// Our tree kinds mapped onto the families the packs actually cover. Anything
// absent here keeps its procedural shape: the desert species in particular have
// no counterpart in these packs, and a wrong silhouette is worse than a simple
// one.
export const FAMILY_OF = {
 pine: 'conifer', spruce: 'conifer', cedar: 'conifer',
 // The redwood grove's species are whole grown trees -- trunk, limbs and
 // foliage in one model -- so nothing is borrowed and nothing is drawn.
 // `redcedar` rather than `cedar` because Pacific Northwest plants `cedar` and
 // must keep its Kenney conifer.
 redwood: 'redwood', fir: 'dougfir', hemlock: 'hemlock',
 redcedar: 'redcedar', tanoak: 'tanoak', seedling: 'seedling',
 swordfern: 'swordfern', salal: 'salal', sorrel: 'sorrel',
 oak: 'broadleaf', maple: 'broadleaf', aspen: 'broadleaf', alder: 'broadleaf',
 palm: 'palm',
 cactus: 'cactus',
 // Desert trees have no leafy counterpart in the packs; the arid dead-tree
 // silhouettes read far closer than a green canopy would. Ocotillo and agave
 // stay procedural -- spindly canes and a ground rosette are shapes these packs
 // simply do not contain, and a wrong silhouette is worse than a simple one.
 palo: 'arid', mesquite: 'arid',
 shrub: 'bush', gorse: 'bush', heather: 'bush', naupaka: 'bush', fern: 'bush',
};

// Builds one InstancedMesh per (model, role). Instances carry their own colour,
// so a stand varies in tint as well as in shape without costing a draw call.
export function instanceModels(group, entries, materialFor, onMesh) {
 const buckets = new Map();
 for (const entry of entries) {
  const parts = modelParts(entry.model);
  if (!parts) continue;
  for (const part of parts) {
   const key = `${entry.model}|${part.role}|${entry.variant ?? 0}`;
   const bucket = buckets.get(key) || {part, model: entry.model, partIndex: parts.indexOf(part), variant: entry.variant ?? 0, matrices: [], colors: [], owners: []};
   bucket.matrices.push(entry.matrix);
   bucket.colors.push(entry.color[part.role] || entry.color.accent);
   bucket.owners.push(entry.owner);
   buckets.set(key, bucket);
  }
 }
 const meshes = [];
 for (const {part, model, partIndex, variant, matrices, colors, owners} of buckets.values()) {
  if (!matrices.length) continue;
  const mesh = new T.InstancedMesh(part.geometry, materialFor(part.role, variant), matrices.length);
  matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colors[i]); });
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  // What it draws, so the renderer can find this part's thinned twin
  // (`farParts`) without reverse-engineering it from the geometry.
  mesh.userData.model = model; mesh.userData.part = partIndex; mesh.userData.role = part.role;
  group.add(mesh);
  meshes.push(mesh);
  onMesh?.({mesh, matrices, owners});
 }
 return meshes;
}
