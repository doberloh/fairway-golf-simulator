// Turns the vendored CC0 model packs into one compact binary that the single
// file build can carry.
//
// Run: node tools/build-meshes.mjs
// Reads:  vendor/<pack>/*.glb
//
// A PICK entry is a model's file name. Three of the vendored packs are
// Quaternius nature packs and 31 names appear in more than one of them --
// `Plant_1` is in all three and means something different in each. A bare name
// that is ambiguous is an ERROR rather than first-pack-wins, because the
// silent version of that bug swaps the model under an existing biome and
// nothing tells you. Write `megakit:Pine_1` to say which pack you meant; the
// part before the colon just has to appear in the directory name.
// Writes: src/asset-meshes.js
//
// Nothing from the packs ships as-is. Textures are irrelevant (Kenney's models
// carry none -- colour is a baseColorFactor per material), and the material
// colours themselves are dropped too: every surface is classified into a role
// (bark, leaf, stone, dirt, accent) by its material name, and the running game
// paints those roles from the biome palette. That is what lets one imported
// mesh serve seven biomes instead of dragging its own art direction in.
//
// Positions are quantised to int16 against each model's own bounds and normals
// to int8, which is roughly a third of the float encoding and visually free at
// the sizes these are drawn.
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const VENDOR = join(ROOT, 'vendor');

import {ROLE_OF, ROLES, extract, extractObj} from './mesh-read.mjs';
export {ROLE_OF, ROLES} from './mesh-read.mjs';


// Which models we actually take, and what each stands in for in the game.
const PICK = {
 conifer: ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD',
  'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineRoundE',
  'tree_pineSmallA', 'tree_pineSmallC', 'tree_pineDefaultA', 'tree_pineDefaultB'],
 broadleaf: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall',
  'tree_thin', 'tree_simple', 'tree_small', 'tree_blocks', 'tree_plateau'],
 palm: ['tree_palm', 'tree_palmBend', 'tree_palmShort', 'tree_palmTall'],
 cactus: ['cactus_short', 'cactus_tall', 'Cactus_1', 'Cactus_2', 'Cactus_3', 'Cactus_4', 'Cactus_5'],
 rock: ['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_largeE', 'rock_largeF',
  'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD', 'rock_smallE',
  'rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallE'],
 bush: ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall'],
 grass: ['grass', 'grass_large', 'grass_leafs'],
 flower: ['flower_purpleA', 'flower_redA', 'flower_yellowA'],
 // Quaternius (OBJ). Taken only where the Kenney kit has no counterpart: its
 // models carry several times the vertices, so duplicating coverage we already
 // have costs about a megabyte of packed geometry for no visible gain. The
 // desert is the gap -- Kenney has two cacti and nothing arid.
 arid: ['CommonTree_Dead_1', 'CommonTree_Dead_3', 'CommonTree_Dead_5'],
 // Houses. Unlike the nature kits these carry a texture atlas rather than a
 // colour per material, so they keep their UVs and ship the atlas with them --
 // role tinting alone would flatten a whole house to one colour.
 // THE FOREST FLOOR, and all of it was already vendored. Old-growth reads from
 // what has fallen as much as from what is standing -- mossy logs, stumps and
 // boulders -- and none of it was being shipped because PICK only ever took
 // what the biomes of the day asked for. No new pack, no new licence: Kenney's
 // Nature Kit and Quaternius's Ultimate Nature Pack are both already credited.
 // The forest floor is grown too, and the pack logs and mossy rocks that used
 // to fill it are no longer taken -- a nurse log with moss only along its
 // upper flank, a stump with root buttresses and a springboard notch, and a
 // boulder that is a boulder rather than a sphere, all beat what was there.
 log: ['grown:NurseLog_1', 'grown:NurseLog_2', 'grown:NurseLog_3', 'grown:NurseLog_4', 'grown:FallenLog_1', 'grown:FallenLog_2'],
 stump: ['grown:Stump_1', 'grown:Stump_2', 'grown:Stump_3', 'grown:Stump_Bare_1', 'grown:Stump_Bare_2', 'grown:RootWad_1'],
 mossrock: ['grown:Boulder_1', 'grown:Boulder_2', 'grown:Boulder_3', 'grown:MossMound_1', 'grown:MossMound_2', 'grown:MossMound_3'],
 litter: ['grown:Litter_1', 'grown:Litter_2', 'grown:Litter_3'],
 // The MegaKit fern is no longer taken: `swordfern` above is a grown
 // shuttlecock of once-pinnate fronds, which is what the plant actually is.
 // THE REDWOOD GROVE IS GROWN, NOT IMPORTED. Everything below comes out of
 // tools/grow.mjs: whole trees with their own fluted, buttressed trunks, so
 // there is no borrowed crown to balance on a drawn cylinder any more.
 //
 // The `_Far` twins tools/grow.mjs also bakes are NOT taken. Swapping by
 // distance was measured to save half a millisecond a frame and to cost the
 // look entirely -- see the note at the top of src/vegetation.js.
 redwood: ['grown:Redwood_Giant_1', 'grown:Redwood_Giant_2', 'grown:Redwood_Giant_3', 'grown:Redwood_Giant_4',
  'grown:Redwood_Mature_1', 'grown:Redwood_Mature_2', 'grown:Redwood_Mature_3', 'grown:Redwood_Mature_4'],
 dougfir: ['grown:DouglasFir_1', 'grown:DouglasFir_2', 'grown:DouglasFir_3', 'grown:DouglasFir_4'],
 hemlock: ['grown:Hemlock_1', 'grown:Hemlock_2', 'grown:Hemlock_3'],
 redcedar: ['grown:RedCedar_1', 'grown:RedCedar_2', 'grown:RedCedar_3'],
 tanoak: ['grown:Tanoak_1', 'grown:Tanoak_2', 'grown:Tanoak_3'],
 swordfern: ['grown:SwordFern_1', 'grown:SwordFern_2', 'grown:SwordFern_3', 'grown:SwordFern_4', 'grown:SwordFern_5', 'grown:SwordFern_6'],
 salal: ['grown:Salal_1', 'grown:Salal_2', 'grown:Salal_3', 'grown:Salal_4'],
 sorrel: ['grown:Sorrel_1', 'grown:Sorrel_2', 'grown:Sorrel_3', 'grown:Sorrel_4'],
 seedling: ['grown:Seedling_1', 'grown:Seedling_2', 'grown:Seedling_3', 'grown:Seedling_4'],
 house: ['building-type-a', 'building-type-c', 'building-type-e', 'building-type-g',
  'building-type-i', 'building-type-k', 'building-type-m', 'building-type-o',
  'building-type-q', 'building-type-s'],
};

// Families that use only part of a model. A crown is foliage only, so the
// trunk geometry inside those models is dropped here rather than shipped and
// skipped at draw time.
const KEEP_ROLES = {conifercrown: new Set(['leaf'])};

// Families whose texture the game actually ships, and therefore the only ones
// whose texture coordinates are worth carrying. Houses have their atlas;
// nothing else does. Several packs ship leaf sheets their OBJ exports never
// reference, and finding one only attaches UVs to geometry that will never
// sample them. When the generated trees go in, their family joins this set
// and their sheets have to be carried alongside -- one or the other alone is
// either wasted bytes or an untextured quad.
const TEXTURED_FAMILIES = new Set(['house']);

const models = {}, chunks = [];
let cursor = 0;
const push = typed => {
 const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
 // Every block starts 4-byte aligned so the runtime can view it directly.
 const pad = (4 - (cursor % 4)) % 4;
 if (pad) { chunks.push(Buffer.alloc(pad)); cursor += pad; }
 const at = cursor;
 chunks.push(bytes); cursor += bytes.length;
 return at;
};

// One listing per pack, compared EXACTLY. existsSync would do, but Windows
// matches file names case-insensitively and Linux does not, so `grass` would
// find Quaternius's `Grass.obj` on one machine and not the other -- a build
// that differs by operating system, which is the worst kind.
const PACKS = readdirSync(VENDOR).map(pack => ({pack, files: new Set(readdirSync(join(VENDOR, pack)))}));
// vendor/grown-redwood-forest is gitignored -- 94 MB this repo's own code
// reproduces in seconds -- so on a fresh clone it is simply absent, and the
// error for that should say what to run rather than 'no pack matching'.
if (!PACKS.some(p => p.pack.includes('grown')))
 throw Error('vendor/grown-redwood-forest is missing. Run: node tools/grow.mjs');

// Every pack holding this model, so an ambiguous name can say so rather than
// quietly taking whichever the filesystem listed first.
function locate(entry) {
 const colon = entry.indexOf(':');
 const hint = colon < 0 ? null : entry.slice(0, colon), name = colon < 0 ? entry : entry.slice(colon + 1);
 const found = [];
 for (const {pack, files} of PACKS) {
  if (hint && !pack.includes(hint)) continue;
  for (const ext of ['.glb', '.obj'])
   if (files.has(name + ext)) { found.push({pack, file: join(VENDOR, pack, name + ext), glb: ext === '.glb'}); break; }
 }
 if (found.length > 1)
  throw Error(`"${entry}" matches ${found.length} packs (${found.map(f => f.pack).join(', ')}). `
   + `Say which one, e.g. "${found[0].pack}:${name}".`);
 return {name, hit: found[0] || null};
}

let taken = 0, missing = [];
for (const [family, entries] of Object.entries(PICK)) {
 for (const entry of entries) {
  const {name, hit} = locate(entry);
  if (!hit) { missing.push(entry); continue; }
  if (models[name]) throw Error(`two PICK entries both end up called "${name}".`);
  const byRole = hit.glb ? extract(hit.file) : extractObj(hit.file, TEXTURED_FAMILIES.has(family));
  const keep = KEEP_ROLES[family];
  if (keep) for (const role of [...byRole.keys()]) if (!keep.has(role)) byRole.delete(role);
  if (!byRole.size) throw Error(`"${entry}" has no ${[...(keep || [])].join('/')} part to keep.`);
  // Normalise: centred on x/z, sitting on y=0, one unit tall. The game then
  // scales every instance itself, exactly as it does its procedural shapes.
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const g of byRole.values())
   for (let i = 0; i < g.position.length; i += 3) {
    minX = Math.min(minX, g.position[i]); maxX = Math.max(maxX, g.position[i]);
    minY = Math.min(minY, g.position[i + 1]); maxY = Math.max(maxY, g.position[i + 1]);
    minZ = Math.min(minZ, g.position[i + 2]); maxZ = Math.max(maxZ, g.position[i + 2]);
   }
  const height = Math.max(maxY - minY, 1e-6), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2 / height;
  // Half-extents on each axis, relative to height. Houses are fitted to a
  // width x height x depth box so the drawn building matches the oriented box
  // physics collides against; a single radius cannot express that.
  const rx = (maxX - minX) / 2 / height, rz = (maxZ - minZ) / 2 / height;
  const parts = [];
  for (const [role, g] of byRole) {
   const count = g.position.length / 3;
   const position = new Int16Array(count * 3), normal = new Int8Array(count * 3);
   for (let i = 0; i < count; i++) {
    // Quantised against a fixed +-2 unit box in normalised space, which every
    // one of these models sits inside once scaled to unit height.
    position[i * 3] = Math.round(((g.position[i * 3] - cx) / height) * 16384);
    position[i * 3 + 1] = Math.round(((g.position[i * 3 + 1] - minY) / height) * 16384);
    position[i * 3 + 2] = Math.round(((g.position[i * 3 + 2] - cz) / height) * 16384);
    for (let k = 0; k < 3; k++) normal[i * 3 + k] = Math.max(-127, Math.min(127, Math.round(g.normal[i * 3 + k] * 127)));
   }
   const index = new Uint16Array(g.index);
   const part = {role, count, index: index.length, positionAt: push(position), normalAt: push(normal), indexAt: push(index)};
   if (TEXTURED_FAMILIES.has(family) && g.uv && g.uv.length === count * 2) {
   // A TILING UV DOES NOT FIT IN 0..1, which is what this used to assume.
   // House UVs are atlas coordinates and never leave the unit square, so
   // `uv * 65535` was fine for them and quietly clamped everything else: bark
   // that tiles nine times around and fifty-eight times up arrived with every
   // coordinate pinned at 1.0, which draws one row of pixels smeared the whole
   // length of a trunk. That is what five attempts at "the bark is wrong" were
   // actually chasing, and none of them was in the bake.
   // So the range is recorded per part and the quantisation is against that.
    let span = 1;
    for (let i = 0; i < g.uv.length; i++) span = Math.max(span, g.uv[i]);
    const uv = new Uint16Array(count * 2);
    for (let i = 0; i < uv.length; i++)
     uv[i] = Math.max(0, Math.min(65535, Math.round(g.uv[i] / span * 65535)));
    part.uvAt = push(uv);
    if (span !== 1) part.uvSpan = +span.toFixed(4);
   }
   parts.push(part);
  }
  models[name] = {family, height: 1, radius: +radius.toFixed(4), rx: +rx.toFixed(4), rz: +rz.toFixed(4), textured: parts.some(p => p.uvAt !== undefined), parts};
  taken++;
 }
}

// The house atlases. These are palette grids, so a house takes all of its colour
// from one of them -- every roof in a given atlas is the same swatch. Kenney
// ships three recoloured variations alongside the default for exactly that
// reason, and carrying all four is what stops a street being one colour.
// 12 KB each.
const atlases = [];
for (const pack of readdirSync(VENDOR))
 for (const file of ['colormap.png', 'variation-a.png', 'variation-b.png', 'variation-c.png']) {
  const candidate = join(VENDOR, pack, file);
  if (existsSync(candidate)) atlases.push(readFileSync(candidate).toString('base64'));
 }
const binary = Buffer.concat(chunks);
const out = `// GENERATED by tools/build-meshes.mjs -- do not edit by hand.
// Geometry distilled from the CC0 packs in vendor/, stripped of all materials:
// each part carries only a role that the biome palette paints at runtime.
// Positions are int16 against a unit-height model, normals int8. See
// ATTRIBUTION.md for the sources and their licences.
export const MESH_ROLES=${JSON.stringify(ROLES)};
export const MESH_MODELS=${JSON.stringify(models)};
export const MESH_ATLASES=${JSON.stringify(atlases.map(a => 'data:image/png;base64,' + a))};
const B64="${binary.toString('base64')}";
let bytes=null;
export function meshBytes(){
 if(bytes)return bytes;
 const raw=atob(B64);bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}
`;
writeFileSync(join(ROOT, 'src', 'asset-meshes.js'), out);
console.log(`models: ${taken}${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
console.log(`binary: ${(binary.length / 1024).toFixed(1)} KB -> base64 ${(binary.toString('base64').length / 1024).toFixed(1)} KB`);
console.log(`module: ${(out.length / 1024).toFixed(1)} KB`);
