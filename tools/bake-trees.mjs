// BAKING TREES INSTEAD OF SHOPPING FOR THEM.
//
// Run: node tools/bake-trees.mjs [--report] [name...]
// Writes: vendor/eztree-redwood/*.obj + .mtl + the textures they name
//
// Every conifer in the CC0 packs is conical to the ground, so a redwood had to
// be faked: a drawn cylinder with a borrowed crown balanced on top. That gets
// the silhouette roughly right and gets the branches entirely wrong -- there
// are none. ez-tree (MIT) generates a tree from parameters, which means we can
// SPECIFY a species rather than hunt for one that nobody has made.
//
// It runs here, at bake time, not in the game. The library never ships: what
// ships is the geometry it produced, sitting in vendor/ like any other model
// pack and going through exactly the same ingest. ez-tree is a devDependency
// and is only needed by whoever re-bakes.
//
// The output is OBJ because that is what the ingest already reads, and because
// an OBJ with named materials carries the one thing we need from a model file:
// which surface is bark and which is leaf.
import {writeFileSync, mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {extractObj} from './mesh-read.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'baked_assets');
const args = process.argv.slice(2);
const report = args.includes('--report');
const only = args.filter(a => !a.startsWith('--')).map(a => a.toLowerCase());

// ez-tree loads its bark and leaf textures at import time through three's
// TextureLoader, which wants a DOM. We copy the images we want from disk
// ourselves, so an image that never loads is fine -- this is just enough of a
// document for the loader not to throw.
globalThis.document = {
 createElementNS: () => ({addEventListener() {}, removeEventListener() {}, set src(_) {}, get src() { return ''; }, width: 1, height: 1, style: {}}),
 createElement: () => ({getContext: () => null, style: {}, addEventListener() {}}),
};
globalThis.self = globalThis;
globalThis.window = globalThis;

const {Tree} = await import('@dgreenheck/ez-tree');

// ---------------------------------------------------------------- textures
//
// Colour maps only: the game is toon shaded and reads no normal, roughness or
// ambient-occlusion map.
//
// Both barks are Poly Haven and CC0. ez-tree also ships birch and pine bark
// from texturecan, whose terms have not been checked, so those are NOT taken
// however well the pine one would suit. See ATTRIBUTION.md.
const ASSETS = join(ROOT, 'node_modules', '@dgreenheck', 'ez-tree', 'src', 'lib', 'assets');
// LEAVES ONLY. A leaf billboard is a cut-out and is nothing without its alpha
// mask; bark is a surface, and a surface is what this project paints from the
// biome palette. Trunks state a COLOUR instead -- see SPECIES below -- which
// also means no bark image has to be carried, credited or tiled.
const TEXTURES = {
 'needles.png': ['leaves', 'pine_color.png'],
 'broadleaf.png': ['leaves', 'ash_color.png'],
};

// The stylized pack's own conifer sheet, for the hybrids below. Copied from
// where it is already vendored rather than from ez-tree.
const STYLIZED = join(ROOT, 'vendor', 'quaternius-ultimate-stylized-nature');
const STYLIZED_SHEET = 'stylized_needles.png';

// -------------------------------------------------------------------- UVs
//
// THE BARK UVs ARE REBUILT FROM THE GEOMETRY, because ez-tree's are not what
// they look like and cannot be scaled.
//
// What it generates for a trunk is:
//
//     u = 0  0.167  0.333  0.5  0.667  0.833  1      once around the ring
//     v = 0  0      0      0    0      0      0      the ring at the foot
//     v = 1  1      1      1    1      1      1      the next ring up
//     v = 0  0      0      0    0      0      0      the one after
//
// `v` is 0,1,0,1 -- one tile per ring, MIRRORED each time. That is a sensible
// way to hide the seam between rings, and it is useless to us for two reasons.
// Multiplying it does not stretch the tile, it crams that many tiles into
// every section (the first bake asked for 22 and got fine horizontal banding).
// And the mirroring puts a reflection axis at every single ring: forty of them
// up a trunk, which the eye reads as horizontal banding however correctly the
// furrows are oriented.
//
// So `v` is rebuilt as ARC LENGTH ALONG THE BRANCH, measured ring by ring from
// the geometry, divided by the tile size. That gives a plain, un-mirrored
// repeat of a stated real-world size, and it follows a branch rather than
// assuming everything is vertical. Poly Haven's barks tile seamlessly, so a
// plain repeat has no seam to hide.
//
// `u` is rebuilt the same way and for the same reason. A FIXED number of tiles
// around only squares up one thickness of trunk: eight around a redwood gave a
// tile 1.72 x 1.71, and the same eight around a cedar's thinner bole gave
// 0.44 x 1.70 -- the texture squeezed four-to-one, which is its own kind of
// wrong stripe. So the count comes from each ring's own circumference, and
// every tile on every branch of every species comes out square.
//
// TILE is in the library's units, where the trunk is 100 long and stands about
// 115 m tall in game -- so 1.7 here is a bark tile about two metres across.
const BARK_TILE = 1.7;

// Vertices come out ring by ring, and `u` runs 0..1 within each ring, so a drop
// in `u` is the start of the next ring. A jump much bigger than the PREVIOUS
// step means a new branch rather than the next section of this one.
//
// That comparison has to be local. The first version compared each step
// against the median spacing of every ring in the mesh, and on a tree with
// many short branches the median IS the branch spacing -- so the trunk's own
// longer sections all looked like new branches, reset to zero one after
// another, and the trunk ended up with the same `v` from top to bottom. That
// is a texture smeared the entire length of the tree, which is what the young
// redwoods were showing.
function rebuildBarkUVs(mesh) {
 const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
 if (!uv) return;
 const ringOf = new Int32Array(uv.count);
 const centre = [];
 let ring = -1, prev = Infinity;
 for (let i = 0; i < uv.count; i++) {
  const u = uv.getX(i);
  if (u < prev - 1e-6) { ring++; centre.push([0, 0, 0, 0]); }
  prev = u;
  ringOf[i] = ring;
  const c = centre[ring];
  c[0] += pos.getX(i); c[1] += pos.getY(i); c[2] += pos.getZ(i); c[3]++;
 }
 for (const c of centre) { c[0] /= c[3]; c[1] /= c[3]; c[2] /= c[3]; }

 // How many tiles fit around each ring, from its own circumference. Between
 // two rings of different girth the texture shears very slightly, which is
 // what tapering wood does and is invisible; a fixed count instead squeezes
 // the tile on anything thinner than whatever it was tuned for.
 const around = centre.map(() => 1);
 {
  const sum = new Float64Array(centre.length);
  for (let i = 0; i < uv.count; i++) {
   const r = ringOf[i], c = centre[r];
   sum[r] += Math.hypot(pos.getX(i) - c[0], pos.getY(i) - c[1], pos.getZ(i) - c[2]);
  }
  for (let r = 0; r < centre.length; r++)
   // The floor only guards against a ring of zero radius at a branch tip.
   // At .35 it was squeezing every twig to a third of square.
   around[r] = Math.max(.04, 2 * Math.PI * (sum[r] / centre[r][3]) / BARK_TILE);
 }

 const steps = [];
 for (let r = 1; r < centre.length; r++)
  steps.push(Math.hypot(centre[r][0] - centre[r - 1][0], centre[r][1] - centre[r - 1][1], centre[r][2] - centre[r - 1][2]));

 const along = new Float64Array(centre.length);
 let last = 0;
 for (let r = 1; r < centre.length; r++) {
  const step = steps[r - 1], jumped = last > 0 && step > last * 4;
  // Never advance by nothing: two rings can land on top of each other, and a
  // pair of rings sharing a `v` gives triangles with no texture direction at
  // all. Six of Douglas fir's 7,560 came out that way before this floor.
  along[r] = jumped ? 0 : along[r - 1] + Math.max(step, BARK_TILE * .02);
  last = jumped ? 0 : step;
 }

 for (let i = 0; i < uv.count; i++)
  uv.setXY(i, uv.getX(i) * around[ringOf[i]], along[ringOf[i]] / BARK_TILE);
 uv.needsUpdate = true;
}

// Bark colours, as the eye sees them rather than as the palette will paint
// them: the game still tints by role, and these are what the model states for
// anything reading it directly, the asset previewer included.
// Written as the colour you would pick in any image editor, and converted,
// because MTL `Kd` is LINEAR -- Blender's exporter writes it that way and
// Quaternius's own files confirm it. Putting sRGB numbers straight in makes
// every trunk a pale washed tan, which is what the first attempt produced.
const srgbToLinear = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
const linear = hex => [1, 3, 5].map(i => +srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));
const BARK = {
 redwood: linear('#7a4a33'),   // cinnamon red-brown, darkening with weather
 young:   linear('#8a5439'),   // brighter; the colour is freshest on young bark
 fir:     linear('#55483c'),   // dark grey-brown
 cedar:   linear('#7d5440'),   // reddish and fibrous
 maple:   linear('#6b6653'),   // grey, and mossy in this climate
 snag:    linear('#8e8478'),   // weathered silver, all colour gone
};

// ------------------------------------------------------------- the species
//
// Matched against published descriptions rather than against a memory of the
// tree (see RESEARCH.md for the sources).
const BASE = tree => {
 const o = tree.options;
 o.type = 'evergreen';
 o.bark.textured = true;
 o.bark.flatShading = true;   // matches the game's toon shading
 return o;
};

// A coast redwood: "remarkably straight" with minimal taper, 3-6 m across
// ABOVE a swollen base, "a conical crown, with horizontal to slightly drooping
// branches", and a long branch-free bole that self-pruning lifts with age.
function redwood(o) {
 o.bark.type = 'willow';
 o.branch.levels = 2;
 o.branch.length[0] = 100;
 o.branch.radius[0] = 100 * .026;
 o.branch.taper[0] = .90;
 // Forty rings: one bark tile each, so the texture repeats about every three
 // metres, and the buttress at the foot has three of them inside it.
 o.branch.sections[0] = 40;
 o.branch.segments[0] = 10;
 o.branch.gnarliness[0] = .005;

 o.branch.start[1] = .60;
 o.branch.children[0] = 30;
 o.branch.length[1] = 17;     // a wider canopy than the first bake
 o.branch.radius[1] = .44;
 o.branch.angle[1] = 96;      // horizontal, tipping to slightly drooping
 o.branch.taper[1] = .42;
 o.branch.sections[1] = 6;
 o.branch.segments[1] = 5;
 o.branch.gnarliness[1] = .16;

 o.branch.start[2] = .3;
 o.branch.children[1] = 6;
 o.branch.length[2] = 6.5;
 o.branch.radius[2] = .45;
 o.branch.angle[2] = 64;
 o.branch.sections[2] = 3;
 o.branch.segments[2] = 3;
 o.branch.gnarliness[2] = .2;

 o.leaves.type = 'pine';
 o.leaves.billboard = 'double';
 // Out towards the ends, not along the whole branch. This is the single
 // setting that most decides whether a canopy reads as airy or as a hedge.
 o.leaves.start = .40;
 o.leaves.count = 13;
 o.leaves.size = 3.3;
 o.leaves.sizeVariance = .3;
 o.leaves.angle = 14;
 o.leaves.alphaTest = .35;
 return {bark: BARK.redwood, leaf: 'needles.png', flare: 1.42};
}

// The same tree at eighty years rather than eight hundred: half the girth for
// its height, branches nearly to the ground, and a proper cone, because
// nothing has self-pruned yet.
function youngRedwood(o) {
 const spec = redwood(o);
 o.branch.radius[0] = 100 * .013;
 o.branch.taper[0] = .80;
 o.branch.sections[0] = 26;
 o.branch.gnarliness[0] = .02;
 o.branch.start[1] = .16;
 o.branch.children[0] = 46;
 o.branch.length[1] = 13;
 o.branch.radius[1] = .3;
 o.branch.angle[1] = 88;
 o.leaves.start = .25;
 o.leaves.count = 15;
 o.leaves.size = 2.6;
 return {...spec, bark: BARK.young, flare: 1.12};
}

// Douglas fir: narrower and spikier than a redwood, branches most of the way
// down, and the drooping habit that makes a fir read as a fir.
function douglasFir(o) {
 o.bark.type = 'willow';
 o.branch.levels = 2;
 o.branch.length[0] = 100;
 o.branch.radius[0] = 100 * .018;
 o.branch.taper[0] = .74;
 o.branch.sections[0] = 30;
 o.branch.segments[0] = 9;
 o.branch.gnarliness[0] = .02;

 o.branch.start[1] = .26;
 o.branch.children[0] = 54;
 o.branch.length[1] = 15;
 o.branch.radius[1] = .26;
 o.branch.angle[1] = 112;     // distinctly drooping
 o.branch.taper[1] = .4;
 o.branch.sections[1] = 5;
 o.branch.segments[1] = 4;
 o.branch.gnarliness[1] = .18;

 o.branch.start[2] = .25;
 o.branch.children[1] = 5;
 o.branch.length[2] = 5;
 o.branch.radius[2] = .4;
 o.branch.angle[2] = 70;
 o.branch.sections[2] = 3;
 o.branch.segments[2] = 3;
 o.branch.gnarliness[2] = .2;

 o.leaves.type = 'pine';
 o.leaves.billboard = 'double';
 o.leaves.start = .2;
 o.leaves.count = 14;
 o.leaves.size = 2.8;
 o.leaves.sizeVariance = .3;
 o.leaves.angle = 26;
 o.leaves.alphaTest = .35;
 return {bark: BARK.fir, leaf: 'needles.png', flare: 1.18};
}

// Western red cedar: the mid-storey. Branches almost to the ground, heavily
// drooping, dense -- the tree that fills the gap between the ferns and the
// giants, and the one you actually walk past.
function redCedar(o) {
 o.bark.type = 'willow';
 o.branch.levels = 2;
 o.branch.length[0] = 100;
 o.branch.radius[0] = 100 * .022;
 o.branch.taper[0] = .66;
 o.branch.sections[0] = 22;
 o.branch.segments[0] = 8;
 o.branch.gnarliness[0] = .035;

 o.branch.start[1] = .10;
 o.branch.children[0] = 58;
 o.branch.length[1] = 19;
 o.branch.radius[1] = .24;
 o.branch.angle[1] = 118;
 o.branch.taper[1] = .35;
 o.branch.sections[1] = 5;
 o.branch.segments[1] = 4;
 o.branch.gnarliness[1] = .22;

 o.branch.start[2] = .2;
 o.branch.children[1] = 6;
 o.branch.length[2] = 6;
 o.branch.radius[2] = .4;
 o.branch.angle[2] = 76;
 o.branch.sections[2] = 3;
 o.branch.segments[2] = 3;
 o.branch.gnarliness[2] = .2;

 o.leaves.type = 'pine';
 o.leaves.billboard = 'double';
 o.leaves.start = .15;
 o.leaves.count = 16;
 o.leaves.size = 3.0;
 o.leaves.sizeVariance = .3;
 o.leaves.angle = 30;
 o.leaves.alphaTest = .35;
 return {bark: BARK.cedar, leaf: 'needles.png', flare: 1.25};
}

// Bigleaf maple: the broadleaf in the understorey, and the only thing in the
// grove that is not a conifer. Short, leaning, with a wide open crown.
function bigleafMaple(o) {
 o.type = 'deciduous';
 o.bark.type = 'oak';
 o.branch.levels = 3;
 o.branch.length[0] = 100;
 o.branch.radius[0] = 100 * .035;
 o.branch.taper[0] = .6;
 o.branch.sections[0] = 14;
 o.branch.segments[0] = 8;
 o.branch.gnarliness[0] = .12;

 o.branch.start[1] = .3;
 o.branch.children[0] = 7;
 o.branch.length[1] = 55;
 o.branch.radius[1] = .6;
 o.branch.angle[1] = 62;
 o.branch.taper[1] = .6;
 o.branch.sections[1] = 8;
 o.branch.segments[1] = 6;
 o.branch.gnarliness[1] = .2;

 o.branch.start[2] = .2;
 o.branch.children[1] = 5;
 o.branch.length[2] = 26;
 o.branch.radius[2] = .55;
 o.branch.angle[2] = 58;
 o.branch.sections[2] = 5;
 o.branch.segments[2] = 4;
 o.branch.gnarliness[2] = .3;

 o.leaves.type = 'ash';
 o.leaves.billboard = 'double';
 o.leaves.start = .1;
 o.leaves.count = 10;
 o.leaves.size = 11;
 o.leaves.sizeVariance = .35;
 o.leaves.angle = 20;
 o.leaves.alphaTest = .35;
 return {bark: BARK.maple, leaf: 'broadleaf.png', flare: 1.3};
}

// The redwood skeleton with no foliage of its own, for a hybrid to dress. Same
// proportions; ez-tree's billboards simply switched off.
function redwoodBare(o) {
 const spec = redwood(o);
 o.leaves.count = 0;
 return spec;
}

// The fir skeleton, likewise: more limbs, starting lower, drooping.
function firBare(o) {
 const spec = douglasFir(o);
 o.leaves.count = 0;
 return spec;
}

// A standing dead redwood. Old-growth groves are full of them, and this is the
// cheapest model here -- no foliage at all -- while being unmistakably ancient.
function snag(o) {
 const spec = redwood(o);
 o.branch.taper[0] = .72;      // tapering to the stump of a broken top
 o.branch.start[1] = .5;
 o.branch.children[0] = 11;
 o.branch.length[1] = 12;
 o.branch.radius[1] = .5;
 o.branch.angle[1] = 84;
 o.branch.gnarliness[1] = .4;
 o.branch.children[1] = 2;
 o.branch.length[2] = 4;
 o.leaves.count = 0;
 return {...spec, bark: BARK.snag, leaf: null, flare: 1.5};
}


// ------------------------------------------------------ the stylized hybrids
//
// ez-tree's structure wearing Quaternius's foliage.
//
// The two have opposite strengths. ez-tree gives a trunk and a branch skeleton
// that no pack contains -- a bare column with a buttress and short limbs only
// near the top. Quaternius gives foliage that already looks like this game:
// chunky, stylized, a solid mass rather than ez-tree's alpha-cut billboards,
// and `PineTree_2` and `PineTree_4` are the two crowns whose silhouette rises
// to a single peak rather than stacking into tiers.
//
// Proportions come from the redwood research, not from either source: a bare
// trunk to 64% of height, a crown half as wide as 0.085 of the tree's height,
// a trunk a thirty-eighth as thick as it is tall, and a 42% buttress.
const CROWN_SOURCES = new Map();
function stylizedCrown(name) {
 if (!CROWN_SOURCES.has(name)) {
  const file = join(STYLIZED, name + '.obj');
  if (!existsSync(file)) throw Error(`no stylized crown called ${name}`);
  const leaf = extractObj(file, true).get('leaf');
  if (!leaf) throw Error(`${name} has no leaf geometry`);
  // Normalised the way the ingest normalises everything: centred on x/z,
  // sitting on y=0, one unit tall. Placement below is then in tree units.
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < leaf.position.length; i += 3) {
   minX = Math.min(minX, leaf.position[i]); maxX = Math.max(maxX, leaf.position[i]);
   minY = Math.min(minY, leaf.position[i + 1]); maxY = Math.max(maxY, leaf.position[i + 1]);
   minZ = Math.min(minZ, leaf.position[i + 2]); maxZ = Math.max(maxZ, leaf.position[i + 2]);
  }
  const height = Math.max(maxY - minY, 1e-6);
  const position = new Float32Array(leaf.position.length);
  for (let i = 0; i < leaf.position.length; i += 3) {
   position[i] = (leaf.position[i] - (minX + maxX) / 2) / height;
   position[i + 1] = (leaf.position[i + 1] - minY) / height;
   position[i + 2] = (leaf.position[i + 2] - (minZ + maxZ) / 2) / height;
  }
  CROWN_SOURCES.set(name, {
   position, normal: new Float32Array(leaf.normal), uv: new Float32Array(leaf.uv),
   index: leaf.index, radius: Math.max(maxX - minX, maxZ - minZ) / 2 / height,
  });
 }
 return CROWN_SOURCES.get(name);
}

// Ring centres grouped into runs -- the trunk first, then one run per branch.
// Same boundary rule the bark coordinates use: a step much longer than the one
// before it is a new branch.
function branchRuns(mesh) {
 const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
 const centre = [];
 let prev = Infinity;
 for (let i = 0; i < uv.count; i++) {
  const u = uv.getX(i);
  if (u < prev - 1e-6) centre.push([0, 0, 0, 0]);
  prev = u;
  const c = centre[centre.length - 1];
  c[0] += pos.getX(i); c[1] += pos.getY(i); c[2] += pos.getZ(i); c[3]++;
 }
 for (const c of centre) { c[0] /= c[3]; c[1] /= c[3]; c[2] /= c[3]; }
 const runs = [];
 let run = [centre[0]], last = 0;
 for (let r = 1; r < centre.length; r++) {
  const step = Math.hypot(centre[r][0] - centre[r - 1][0], centre[r][1] - centre[r - 1][1], centre[r][2] - centre[r - 1][2]);
  if (last > 0 && step > last * 4) { runs.push(run); run = []; last = 0; } else last = step;
  run.push(centre[r]);
 }
 runs.push(run);
 return runs;
}

// Copy the crown geometry once per placement into one merged mesh, and hand it
// to the tree as an alpha-tested mesh so everything downstream -- the OBJ
// writer, the profile, the flare -- already treats it as foliage.
function attachCrowns(tree, placements, sheet, rng) {
 const src = stylizedCrown(sheet);
 const verts = src.position.length / 3;
 const position = new Float32Array(verts * 3 * placements.length);
 const normal = new Float32Array(verts * 3 * placements.length);
 const uv = new Float32Array(verts * 2 * placements.length);
 const index = new Uint32Array(src.index.length * placements.length);
 const m = new T.Matrix4(), nm = new T.Matrix3(), v = new T.Vector3(), n = new T.Vector3();
 const dummy = new T.Object3D();
 dummy.rotation.order = 'YXZ';
 placements.forEach((p, k) => {
  dummy.position.set(p.x, p.y, p.z);
  dummy.rotation.set(p.tilt || 0, rng() * 6.283, p.roll || 0);
  dummy.scale.set(p.width, p.height, p.width);
  dummy.updateMatrix();
  m.copy(dummy.matrix);
  nm.getNormalMatrix(m);
  for (let i = 0; i < verts; i++) {
   v.set(src.position[i * 3], src.position[i * 3 + 1], src.position[i * 3 + 2]).applyMatrix4(m);
   n.set(src.normal[i * 3], src.normal[i * 3 + 1], src.normal[i * 3 + 2]).applyMatrix3(nm).normalize();
   const at = (k * verts + i) * 3;
   position[at] = v.x; position[at + 1] = v.y; position[at + 2] = v.z;
   normal[at] = n.x; normal[at + 1] = n.y; normal[at + 2] = n.z;
   uv[(k * verts + i) * 2] = src.uv[i * 2];
   uv[(k * verts + i) * 2 + 1] = src.uv[i * 2 + 1];
  }
  for (let i = 0; i < src.index.length; i++)
   index[k * src.index.length + i] = src.index[i] + k * verts;
 });
 const g = new T.BufferGeometry();
 g.setAttribute('position', new T.BufferAttribute(position, 3));
 g.setAttribute('normal', new T.BufferAttribute(normal, 3));
 g.setAttribute('uv', new T.BufferAttribute(uv, 2));
 g.setIndex(new T.BufferAttribute(index, 1));
 tree.add(new T.Mesh(g, new T.MeshStandardMaterial({alphaTest: .35})));
}

// A cap: one crown sitting on the bare trunk, the shape the first redwoods
// had, but on a trunk with actual branches inside it.
function capPlacements(tree, height, opts) {
 const base = height * opts.trunk;
 return [{x: 0, y: base, z: 0, width: height * opts.wide * 2, height: height - base}];
}

// Tufts: a crown at the end of every limb, which is what a conifer's foliage
// actually is -- sprays at the branch ends with the branch bare behind them.
function tuftPlacements(tree, height, opts, rng) {
 let wood = null;
 tree.traverse(mesh => { if (mesh.isMesh && !isLeaf(mesh) && !wood) wood = mesh; });
 // Longest runs first, which puts the main limbs ahead of their twigs -- a
 // level-1 branch has six rings and its children three. Then a hard cap,
 // because one crown is about a thousand vertices and a fir has a hundred and
 // fifty tips: dressing every one of them cost 155k vertices and a 20 MB file
 // for foliage nobody would pick out.
 const runs = branchRuns(wood).slice(1)   // drop the trunk
  .filter(run => run[run.length - 1][1] >= height * opts.from)
  .sort((a, b) => b.length - a.length)
  .slice(0, opts.tufts || 40);
 const out = [];
 for (const run of runs) {
  const tip = run[run.length - 1];
  const size = height * opts.tuft * (.75 + rng() * .5);
  out.push({x: tip[0], y: tip[1] - size * .35, z: tip[2],
   width: size * 1.25, height: size,
   tilt: (rng() - .5) * .5, roll: (rng() - .5) * .5});
 }
 return out;
}

// name, builder, seed, and whatever that variant does differently.
const VARIANTS = [
 ['Redwood_1', redwood, 1207, {}],
 // Oldest: self-pruned nearly bare to two thirds of its height.
 ['Redwood_2', redwood, 5533, {'branch.start.1': .72, 'branch.children.0': 22, 'branch.length.1': 14}],
 // TWO OF THE FOUR carry their branches much lower. A grove is a spread of
 // ages, and an unbroken line of bare trunks all ending at the same height
 // reads as a colonnade rather than a wood.
 ['Redwood_3', redwood, 8891, {'branch.start.1': .44, 'branch.radius.0': 3.0, 'branch.length.1': 19}],
 ['Redwood_4', redwood, 3120, {'branch.start.1': .36, 'branch.children.0': 38, 'branch.taper.0': .86}],
 ['RedwoodYoung_1', youngRedwood, 4410, {}],
 ['RedwoodYoung_2', youngRedwood, 7782, {'branch.start.1': .24, 'branch.radius.0': 1.6}],
 ['DouglasFir_1', douglasFir, 2299, {}],
 ['DouglasFir_2', douglasFir, 6640, {'branch.start.1': .34, 'branch.length.1': 13}],
 ['RedCedar_1', redCedar, 9014, {}],
 ['RedCedar_2', redCedar, 1855, {'branch.length.1': 22, 'branch.angle.1': 124}],
 ['BigleafMaple_1', bigleafMaple, 5127, {}],
 ['RedwoodSnag_1', snag, 3344, {}],

 // THE STYLIZED HYBRIDS. ez-tree's trunk and limbs, Quaternius's foliage,
 // redwood proportions throughout. `crown` names a model in
 // vendor/quaternius-ultimate-stylized-nature and `dress` how it is worn:
 // one mass capping the bare trunk, or a spray at the end of every limb.
 ['StylizedRedwood_Cap_1', redwoodBare, 1207, {},
  {crown: 'PineTree_2', dress: 'cap', trunk: .64, wide: .085}],
 ['StylizedRedwood_Cap_2', redwoodBare, 8891, {'branch.start.1': .52},
  {crown: 'PineTree_4', dress: 'cap', trunk: .56, wide: .10}],
 ['StylizedRedwood_Tufts_1', redwoodBare, 1207, {},
  {crown: 'PineTree_2', dress: 'tufts', from: .55, tuft: .085, tufts: 30}],
 ['StylizedRedwood_Tufts_2', redwoodBare, 5533, {'branch.children.0': 22, 'branch.length.1': 20},
  {crown: 'PineTree_4', dress: 'tufts', from: .58, tuft: .105, tufts: 22}],
 // Lower, denser, wider: the fir skeleton wearing the same foliage.
 ['StylizedFir_Tufts_1', firBare, 2299, {},
  {crown: 'PineTree_2', dress: 'tufts', from: .28, tuft: .075, tufts: 46}],
 ['StylizedFir_Cap_1', firBare, 6640, {'branch.start.1': .44},
  {crown: 'PineTree_4', dress: 'cap', trunk: .46, wide: .13}],
];

function build(builder, seed, tweak, dress) {
 const tree = new Tree();
 tree.loadPreset('Pine Large');
 const o = BASE(tree);
 o.seed = seed;
 const spec = builder(o);
 for (const [path, value] of Object.entries(tweak)) {
  const keys = path.split('.');
  let at = o;
  while (keys.length > 1) at = at[keys.shift()];
  at[keys[0]] = value;
 }
 tree.generate();
 flareTheBase(tree, spec.flare);
 tree.traverse(mesh => { if (mesh.isMesh && !isLeaf(mesh)) rebuildBarkUVs(mesh); });
 if (dress) {
  // After the flare and the bark coordinates, so the crowns are placed on the
  // wood as it finally stands.
  let lo = Infinity, hi = -Infinity;
  tree.traverse(mesh => {
   if (!mesh.isMesh) return;
   const p = mesh.geometry.attributes.position;
   for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
  });
  const height = hi - lo, rng = seeded(seed);
  const places = dress.dress === 'cap'
   ? capPlacements(tree, height, dress)
   : tuftPlacements(tree, height, dress, rng);
  attachCrowns(tree, places, dress.crown, rng);
  spec.leaf = STYLIZED_SHEET;
  spec.crowns = places.length;
 }
 let bad = 0, all = 0;
 tree.traverse(mesh => {
  if (!mesh.isMesh || isLeaf(mesh)) return;
  bad += degenerateUVs(mesh);
  all += mesh.geometry.index ? mesh.geometry.index.count / 3 : 0;
 });
 return {tree, spec, bad, all};
}

// Placement jitter needs its own stream: ez-tree's rng is inside the library
// and has already been consumed by the time the crowns go on.
function seeded(seed) {
 let x = (seed * 1103515245 + 12345) >>> 0;
 return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

// A redwood stands on a swollen, buttressed foot, and every published diameter
// is quoted "above the swollen base" for exactly that reason. The library
// tapers a branch uniformly and has no way to express it, so the bottom of the
// trunk is pushed outward here, easing to nothing by a fourteenth of the
// tree's height.
const FLARE_TO = .07;
function flareTheBase(tree, flare) {
 if (!flare || flare <= 1) return;
 let lo = Infinity, hi = -Infinity;
 tree.traverse(o => {
  if (!o.isMesh) return;
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
 });
 const span = (hi - lo) * FLARE_TO || 1;
 tree.traverse(mesh => {
  if (!mesh.isMesh || isLeaf(mesh)) return;   // wood only; a leaf down there is not on the trunk
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
   const up = (p.getY(i) - lo) / span;
   if (up >= 1) continue;
   // Smooth, so the flare meets the trunk without a crease.
   const k = 1 + (flare - 1) * (1 - up) * (1 - up);
   p.setX(i, p.getX(i) * k);
   p.setZ(i, p.getZ(i) * k);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
 });
}

// How many triangles have a UV basis that collapses -- two of their three
// corners sharing a texture coordinate, so the image is smeared across them
// rather than mapped.
//
// This exists because the measurement I was using to check the bark SKIPPED
// exactly these triangles, as a divide-by-zero guard, and then reported the
// average of the ones that survived. A third of the young redwood's trunk was
// degenerate and the number still came back healthy. A check that quietly
// drops its failures is worse than no check.
function degenerateUVs(mesh) {
 const uv = mesh.geometry.attributes.uv, index = mesh.geometry.index;
 if (!uv || !index) return 0;
 let bad = 0;
 for (let i = 0; i < index.count; i += 3) {
  const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
  const du1 = uv.getX(b) - uv.getX(a), dv1 = uv.getY(b) - uv.getY(a);
  const du2 = uv.getX(c) - uv.getX(a), dv2 = uv.getY(c) - uv.getY(a);
  if (Math.abs(du1 * dv2 - du2 * dv1) < 1e-9) bad++;
 }
 return bad;
}

// ez-tree names its meshes nothing at all, so tell them apart by material:
// the leaves are the alpha-tested one.
const isLeaf = mesh => !!(mesh.material && (mesh.material.alphaTest > 0 || mesh.material.transparent));

// Leaf radius in twenty bands from the ground up, and how many times it
// reverses direction -- the same silhouette check the asset previewer applies,
// run here so a bad shape is caught before anybody opens anything.
function profile(tree) {
 let lo = Infinity, hi = -Infinity;
 tree.traverse(o => {
  if (!o.isMesh) return;
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
 });
 const pts = [];
 tree.traverse(o => {
  if (!o.isMesh || !isLeaf(o)) return;
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) pts.push([p.getX(i), p.getY(i), p.getZ(i)]);
 });
 if (!pts.length) return null;
 const h = hi - lo || 1;
 const bands = new Array(20).fill(0);
 for (const [x, y, z] of pts) {
  const b = Math.min(19, Math.floor((y - lo) / h * 20));
  bands[b] = Math.max(bands[b], Math.hypot(x, z));
 }
 const peak = Math.max(...bands) || 1;
 const scaled = bands.map(b => Math.round(b / peak * 15));
 let turns = 0;
 for (let i = 1; i < 19; i++) {
  const a = scaled[i - 1], b = scaled[i], c = scaled[i + 1];
  if ((b > a + 1 && b > c + 1) || (b < a - 1 && b < c - 1)) turns++;
 }
 return {bands: scaled, turns, crownStart: scaled.findIndex(b => b > 2) / 20, width: peak / h};
}

// Trunk radius at each vertex ring below the crown, as a percentage of the
// radius just above the buttress. A coast redwood has minimal taper, so these
// should fall slowly; anything that halves by mid-height is a pine.
function trunkProfile(tree, crownStart) {
 let lo = Infinity, hi = -Infinity;
 const pts = [];
 tree.traverse(mesh => {
  if (!mesh.isMesh || isLeaf(mesh)) return;
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
   lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i));
   pts.push([p.getY(i), Math.hypot(p.getX(i), p.getZ(i))]);
  }
 });
 const h = hi - lo || 1, rings = new Map();
 for (const [y, r] of pts) {
  const k = Math.round((y - lo) / h * 200) / 200;
  rings.set(k, Math.max(rings.get(k) || 0, r));
 }
 // Below the crown only: above it these rings are branches, not the bole.
 const top = Math.max(.12, Math.min(.5, crownStart || .5));
 const rows = [...rings].sort((a, b) => a[0] - b[0]).filter(([k]) => k <= top);
 if (!rows.length) return '';
 const base = rows.find(([k]) => k > FLARE_TO)?.[1] || rows[0][1];
 const step = Math.max(1, Math.round(rows.length / 8));
 return rows.filter((_, i) => i % step === 0).slice(0, 9)
  .map(([k, r]) => `${(k * 100) | 0}%:${Math.round(r / base * 100)}`).join(' ');
}

// OBJ, with material names the ingest's ROLE_OF already understands.
function toObj(tree, name) {
 const lines = [`# ${name} -- generated by tools/bake-trees.mjs from @dgreenheck/ez-tree (MIT).`,
  '# Do not edit by hand: re-run the baker.', `mtllib ${name}.mtl`, `o ${name}`];
 const groups = [];
 tree.updateMatrixWorld(true);
 tree.traverse(mesh => { if (mesh.isMesh) groups.push(mesh); });
 groups.sort((a, b) => Number(isLeaf(a)) - Number(isLeaf(b)));

 let vBase = 1, vtBase = 1, vnBase = 1;
 const body = [];
 for (const mesh of groups) {
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  if (!pos.count) continue;
  const leaf = isLeaf(mesh);
  // Bark coordinates were rebuilt above; leaf ones are sprite positions in a
  // sheet and must not be touched. Either way they are written as they stand.
  for (let i = 0; i < pos.count; i++)
   lines.push(`v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`);
  if (uv) for (let i = 0; i < uv.count; i++)
   lines.push(`vt ${uv.getX(i).toFixed(4)} ${uv.getY(i).toFixed(4)}`);
  if (nor) for (let i = 0; i < nor.count; i++)
   lines.push(`vn ${nor.getX(i).toFixed(4)} ${nor.getY(i).toFixed(4)} ${nor.getZ(i).toFixed(4)}`);

  body.push(`usemtl ${leaf ? 'Tree_Leaves' : 'Tree_Bark'}`);
  const index = g.index ? g.index.array : null;
  const count = index ? index.length : pos.count;
  for (let i = 0; i < count; i += 3) {
   const f = [0, 1, 2].map(k => {
    const at = index ? index[i + k] : i + k;
    return `${vBase + at}/${uv ? vtBase + at : ''}/${nor ? vnBase + at : ''}`;
   });
   body.push(`f ${f[0]} ${f[1]} ${f[2]}`);
  }
  vBase += pos.count;
  if (uv) vtBase += uv.count;
  if (nor) vnBase += nor.count;
 }
 return lines.concat(body).join('\n') + '\n';
}

// The game paints every surface from the biome palette by the material's NAME,
// so these colours are what anything reading the model directly should show --
// the asset previewer, or another engine entirely.
const mtl = spec => `# Generated by tools/bake-trees.mjs.
newmtl Tree_Bark
Kd ${spec.bark.map(v => v.toFixed(3)).join(' ')}
${spec.leaf ? `
newmtl Tree_Leaves
Kd 1.000 1.000 1.000
map_Kd ${spec.leaf}
` : ''}`;

mkdirSync(OUT, {recursive: true});
for (const [out, [folder, file]] of Object.entries(TEXTURES)) {
 const from = join(ASSETS, folder, file);
 if (!existsSync(from)) { console.error('ez-tree not installed: npm install'); process.exit(1); }
 copyFileSync(from, join(OUT, out));
}
const stylizedSheet = join(STYLIZED, 'PineTree_Leaves.png');
if (!existsSync(stylizedSheet)) { console.error('stylized leaf sheet is not vendored'); process.exit(1); }
copyFileSync(stylizedSheet, join(OUT, STYLIZED_SHEET));

writeFileSync(join(OUT, 'README.md'),
`# baked_assets

Generated, not vendored. \`node tools/bake-trees.mjs\` produces these from
[ez-tree](https://github.com/dgreenheck/ez-tree) (MIT) by
[dgreenheck](https://github.com/dgreenheck), which is a devDependency and never
ships. The geometry is ours to use under that licence; the textures are
ez-tree's own leaf sheets and its copies of two CC0 Poly Haven barks. See
ATTRIBUTION.md.

Re-bake after changing the parameters in tools/bake-trees.mjs. Nothing here
should be edited by hand.
`);

let total = 0, made = 0;
for (const [name, builder, seed, tweak, dress] of VARIANTS) {
 if (only.length && !only.some(f => name.toLowerCase().includes(f))) continue;
 const {tree, spec, bad, all} = build(builder, seed, tweak, dress);
 if (bad) {
  console.error(`${name}: ${bad} of ${all} bark triangles have a collapsed UV basis -- `
   + 'the texture would smear across them. Check the ring/branch split in rebuildBarkUVs.');
  process.exitCode = 1;
 }
 let verts = 0;
 tree.traverse(o => { if (o.isMesh) verts += o.geometry.attributes.position.count; });
 total += verts; made++;
 const obj = toObj(tree, name);
 writeFileSync(join(OUT, name + '.obj'), obj);
 writeFileSync(join(OUT, name + '.mtl'), mtl(spec));
 const p = profile(tree);
 console.log(`${name.padEnd(15)} ${String(verts).padStart(6)} verts  ${(obj.length / 1024).toFixed(0).padStart(4)} KB`
  + (p ? `  crown from ${String((p.crownStart * 100) | 0).padStart(2)}%  ${String(Math.round(p.width * 200)).padStart(3)}% as wide as tall  reversals ${p.turns}`
       : '  no foliage')
  + (spec.crowns ? `  ${spec.crowns} stylized crown${spec.crowns > 1 ? 's' : ''}` : ''));
 if (report) {
  if (p) console.log('                crown ' + p.bands.map(b => b.toString(16).toUpperCase()).join(' '));
  console.log('                trunk ' + trunkProfile(tree, p?.crownStart));
 }
}
console.log(`\n${total.toLocaleString()} vertices over ${made} models`);
console.log(OUT);
console.log('now: npm run assets   (to look at them)');
