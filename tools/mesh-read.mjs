// Reading a vendored model pack: GLB and OBJ in, geometry grouped by the
// palette role each material maps to.
//
// Its own module because two tools read these packs -- the ingest that builds
// what ships, and tools/asset-preview.mjs, which shows every model in vendor/
// so a human can choose. A second, subtly different copy of an OBJ parser is
// exactly the kind of thing that makes two tools disagree about what a model
// looks like.
import {readFileSync} from 'node:fs';

// Material name -> the palette role the game paints it with.
export const ROLE_OF = name => {
 const n = name.toLowerCase();
 if (n.includes('leafs') || n.includes('leaves') || n.includes('foliage') || n.startsWith('grass')
  || n.includes('corn') || n.includes('green')) return 'leaf';
 if (n.includes('wood') || n.includes('bark') || n.includes('birch')) return 'bark';
 if (n.includes('stone') || n.includes('rock')) return 'stone';
 if (n.includes('dirt') || n.includes('sand')) return 'dirt';
 return 'accent';
};
export const ROLES = ['bark', 'leaf', 'stone', 'dirt', 'accent'];

const COMPONENT = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const COUNT = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};

function readGlb(file) {
 const buf = readFileSync(file);
 if (buf.readUInt32LE(0) !== 0x46546c67) throw Error(`${file} is not a GLB`);
 const jsonLength = buf.readUInt32LE(12);
 const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
 // The binary chunk follows the JSON chunk, both 4-byte aligned.
 let offset = 20 + jsonLength;
 let bin = null;
 while (offset < buf.length) {
  const length = buf.readUInt32LE(offset), type = buf.readUInt32LE(offset + 4);
  if (type === 0x004e4942) { bin = buf.subarray(offset + 8, offset + 8 + length); break; }
  offset += 8 + length;
 }
 return {json, bin};
}

function accessor(json, bin, index) {
 const a = json.accessors[index], view = json.bufferViews[a.bufferView];
 const Type = COMPONENT[a.componentType], per = COUNT[a.type];
 const start = (view.byteOffset || 0) + (a.byteOffset || 0);
 // Copy rather than view: the GLB buffer is not guaranteed to be aligned for
 // the typed array, and a misaligned view throws.
 const bytes = bin.subarray(start, start + a.count * per * Type.BYTES_PER_ELEMENT);
 return new Type(new Uint8Array(bytes).buffer, 0, a.count * per);
}

// Pull every primitive out of a model, grouped by the role its material maps to.
export function extract(file) {
 const {json, bin} = readGlb(file);
 const byRole = new Map();
 // Models are authored with a node transform, so bake it in rather than
 // shipping a transform the runtime has to remember to apply.
 const nodeOf = new Map();
 (json.nodes || []).forEach(n => { if (n.mesh !== undefined) nodeOf.set(n.mesh, n); });
 for (const [meshIndex, mesh] of (json.meshes || []).entries()) {
  const node = nodeOf.get(meshIndex);
  const s = node?.scale || [1, 1, 1], t = node?.translation || [0, 0, 0];
  for (const prim of mesh.primitives) {
   const material = json.materials?.[prim.material]?.name || 'accent';
   const role = ROLE_OF(material);
   const position = accessor(json, bin, prim.attributes.POSITION);
   const normal = prim.attributes.NORMAL !== undefined ? accessor(json, bin, prim.attributes.NORMAL) : null;
   const index = prim.indices !== undefined ? accessor(json, bin, prim.indices) : null;
   const uv = prim.attributes.TEXCOORD_0 !== undefined && json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture
    ? accessor(json, bin, prim.attributes.TEXCOORD_0) : null;
   const group = byRole.get(role) || {position: [], normal: [], index: [], uv: []};
   const base = group.position.length / 3;
   for (let i = 0; i < position.length; i += 3) {
    group.position.push(position[i] * s[0] + t[0], position[i + 1] * s[1] + t[1], position[i + 2] * s[2] + t[2]);
    group.normal.push(normal ? normal[i] : 0, normal ? normal[i + 1] : 1, normal ? normal[i + 2] : 0);
    if (uv) group.uv.push(uv[(i / 3) * 2], uv[(i / 3) * 2 + 1]);
   }
   if (index) for (const v of index) group.index.push(base + v);
   else for (let i = 0; i < position.length / 3; i++) group.index.push(base + i);
   byRole.set(role, group);
  }
 }
 return byRole;
}

// Quaternius ships OBJ rather than GLB. Same treatment: group faces by the
// material they use, keep geometry, discard everything else. Faces may be
// quads or larger, so fan-triangulate them.
export function extractObj(file) {
 const text = readFileSync(file, 'utf8');
 const v = [], vn = [], byRole = new Map();
 let role = 'accent';
 for (const line of text.split(String.fromCharCode(10))) {
  const part = line.trim().split(/\s+/);
  if (part[0] === 'v') v.push([+part[1], +part[2], +part[3]]);
  else if (part[0] === 'vn') vn.push([+part[1], +part[2], +part[3]]);
  else if (part[0] === 'usemtl') role = ROLE_OF(part[1] || '');
  else if (part[0] === 'f') {
   const group = byRole.get(role) || {position: [], normal: [], index: [], seen: new Map()};
   const corner = part.slice(1).map(token => {
    const [vi, , ni] = token.split('/');
    // OBJ indices are 1-based and may be negative (relative to the end).
    const pi = +vi < 0 ? v.length + +vi : +vi - 1;
    const pn = ni ? (+ni < 0 ? vn.length + +ni : +ni - 1) : -1;
    // Share a vertex between the faces that reference it. Emitting one per face
    // corner instead multiplies the vertex count roughly sixfold, which showed
    // up immediately as a megabyte of packed geometry.
    const key = pi + '/' + pn;
    const hit = group.seen.get(key);
    if (hit !== undefined) return hit;
    const at = group.position.length / 3;
    group.position.push(...(v[pi] || [0, 0, 0]));
    group.normal.push(...(pn >= 0 && vn[pn] ? vn[pn] : [0, 1, 0]));
    group.seen.set(key, at);
    return at;
   });
   for (let i = 1; i + 1 < corner.length; i++) group.index.push(corner[0], corner[i], corner[i + 1]);
   byRole.set(role, group);
  }
 }
 return byRole;
}
