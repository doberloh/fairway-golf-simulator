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
  // Houses carry a texture atlas rather than a colour per material, so their
  // UVs survive ingestion where the nature models' do not.
  if (p.uvAt !== undefined) {
   const packed = new Uint16Array(buffer, p.uvAt, p.count * 2), uv = new Float32Array(p.count * 2);
   for (let i = 0; i < uv.length; i++) uv[i] = packed[i] / 65535;
   geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }
  geometry.setIndex(new T.BufferAttribute(new Uint16Array(buffer, p.indexAt, p.index).slice(), 1));
  geometry.computeBoundingSphere();
  return {role: p.role, geometry};
 });
 cache.set(name, parts);
 return parts;
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
 // A redwood and a douglas fir borrow a conifer for their CROWN only; the
 // trunk beneath is drawn, because no pack has this silhouette. See
 // TALL_CONIFERS in vegetation.js.
 redwood: 'conifer', fir: 'conifer',
 // `swordfern` rather than reusing `fern`: changing what `fern` maps to would
 // silently restyle Pacific Northwest, which is signed off as it is.
 swordfern: 'fern',
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
   const bucket = buckets.get(key) || {part, variant: entry.variant ?? 0, matrices: [], colors: [], owners: []};
   bucket.matrices.push(entry.matrix);
   bucket.colors.push(entry.color[part.role] || entry.color.accent);
   bucket.owners.push(entry.owner);
   buckets.set(key, bucket);
  }
 }
 const meshes = [];
 for (const {part, variant, matrices, colors, owners} of buckets.values()) {
  if (!matrices.length) continue;
  const mesh = new T.InstancedMesh(part.geometry, materialFor(part.role, variant), matrices.length);
  matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colors[i]); });
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  group.add(mesh);
  meshes.push(mesh);
  onMesh?.({mesh, matrices, owners});
 }
 return meshes;
}
