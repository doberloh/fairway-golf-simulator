// BAKING TREES INSTEAD OF SHOPPING FOR THEM.
//
// Run: node tools/bake-trees.mjs [--report]
// Writes: vendor/eztree-redwood/*.obj + .mtl + the leaf texture
//
// Every conifer in the CC0 packs is conical to the ground, so a redwood had to
// be faked: a drawn cylinder with a borrowed crown balanced on top. That gets
// the silhouette roughly right and gets the branches entirely wrong -- there
// are none. ez-tree (MIT) generates a tree from parameters, which means we can
// SPECIFY a redwood rather than hunt for one that nobody has made.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'eztree-redwood');
const report = process.argv.includes('--report');

// ez-tree loads its bark and leaf textures at import time through three's
// TextureLoader, which wants a DOM. We are not keeping the bark textures and
// the leaf one is copied from disk, so an image that never loads is fine --
// this is just enough of a document for the loader not to throw.
globalThis.document = {
 createElementNS: () => ({addEventListener() {}, removeEventListener() {}, set src(_) {}, get src() { return ''; }, width: 1, height: 1, style: {}}),
 createElement: () => ({getContext: () => null, style: {}, addEventListener() {}}),
};
globalThis.self = globalThis;
globalThis.window = globalThis;

const {Tree} = await import('@dgreenheck/ez-tree');

// WHAT MAKES A REDWOOD, in this library's terms.
//
// Matched against descriptions of mature Sequoia sempervirens rather than
// against a memory of one (see RESEARCH.md for the sources):
//
//  - the trunk is "remarkably straight" with minimal taper, 3-6 m across
//    ABOVE a swollen base -- so: near-zero gnarliness, taper .90, and a flare
//    added at the foot afterwards, since the library tapers uniformly
//  - "a conical crown, with horizontal to slightly drooping branches" -- so
//    branch angle just past horizontal, and a crown widest at its base
//  - old-growth trees carry FEW, THICK branches, not a brush of thin ones
//  - foliage sits out towards the branch ends, leaving the inner branch bare,
//    which is most of why a redwood canopy looks airy rather than solid
//  - bark is bright red-brown, soft and fibrous, up to 35 cm thick, in long
//    vertical furrows
//
// Lengths are in the library's own units. The ingest normalises every model to
// unit height, so only the RATIOS here matter: trunk radius against trunk
// length is what decides how thick the tree reads.
function redwood(seed, tweak = {}) {
 const tree = new Tree();
 tree.loadPreset('Pine Large');
 const o = tree.options;
 o.seed = seed;
 o.type = 'evergreen';
 o.bark.type = 'pine';
 o.bark.textured = false;   // bark takes the biome's colour, as every model does
 o.bark.flatShading = true; // matches the game's toon shading

 o.branch.levels = 2;
 o.branch.length[0] = 100;
 o.branch.radius[0] = 100 * .026;  // 3-6 m across on a 115 m tree, above the flare
 o.branch.taper[0] = .90;          // "remarkably straight ... minimal taper"
 // Enough rings that the buttress at the foot has two or three inside it --
 // at eleven the flare jumped from the ground ring to the next one and read
 // as a cone stuck on the bottom.
 o.branch.sections[0] = 26;
 o.branch.segments[0] = 10;
 o.branch.gnarliness[0] = .005;    // dead straight

 // Few, thick, roughly horizontal, and only in the top third.
 o.branch.start[1] = .63;
 o.branch.children[0] = 26;
 o.branch.length[1] = 13;
 o.branch.radius[1] = .44;
 o.branch.angle[1] = 96;           // horizontal, tipping to slightly drooping
 o.branch.taper[1] = .42;
 o.branch.sections[1] = 6;
 o.branch.segments[1] = 5;
 o.branch.gnarliness[1] = .16;     // the branches are the irregular part

 o.branch.start[2] = .3;
 o.branch.children[1] = 6;
 o.branch.length[2] = 5.5;
 o.branch.radius[2] = .45;
 o.branch.angle[2] = 64;
 o.branch.sections[2] = 3;
 o.branch.segments[2] = 3;
 o.branch.gnarliness[2] = .2;

 o.leaves.type = 'pine';
 o.leaves.billboard = 'double';
 // Out towards the ends, not along the whole branch. This is the single
 // setting that most changes whether the canopy reads as airy or as a hedge.
 o.leaves.start = .42;
 o.leaves.count = 12;
 o.leaves.size = 3.1;
 o.leaves.sizeVariance = .3;
 o.leaves.angle = 14;
 o.leaves.alphaTest = .35;
 o.bark.textured = true;

 for (const [path, value] of Object.entries(tweak)) {
  const keys = path.split('.');
  let at = o;
  while (keys.length > 1) at = at[keys.shift()];
  at[keys[0]] = value;
 }
 tree.generate();
 flareTheBase(tree);
 return tree;
}

// A redwood stands on a swollen, buttressed foot, and every published diameter
// is quoted "above the swollen base" for exactly that reason. The library
// tapers a branch uniformly and has no way to express it, so the bottom of the
// trunk is pushed outward here: a 40% flare at ground level easing to nothing
// by a twentieth of the tree's height.
const FLARE = 1.42, FLARE_TO = .07;
function flareTheBase(tree) {
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
   const k = 1 + (FLARE - 1) * (1 - up) * (1 - up);
   p.setX(i, p.getX(i) * k);
   p.setZ(i, p.getZ(i) * k);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
 });
}

// The silhouette check the asset previewer applies, run here so a bad shape is
// caught before anybody opens anything: leaf radius in twenty bands from the
// ground up, and how many times it reverses direction.
function profile(tree) {
 // Bands span the WHOLE TREE, not the leaf geometry's own extent -- the
 // question is how far up the trunk the crown begins, and measuring the leaves
 // against themselves always answers "at the bottom".
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
 for (const [x, y, z] of pts) bands[Math.min(19, Math.floor((y - lo) / h * 20))] =
  Math.max(bands[Math.min(19, Math.floor((y - lo) / h * 20))], Math.hypot(x, z));
 const peak = Math.max(...bands) || 1;
 const scaled = bands.map(b => Math.round(b / peak * 15));
 let turns = 0;
 for (let i = 1; i < 19; i++) {
  const a = scaled[i - 1], b = scaled[i], c = scaled[i + 1];
  if ((b > a + 1 && b > c + 1) || (b < a - 1 && b < c - 1)) turns++;
 }
 return {bands: scaled, turns, crownStart: scaled.findIndex(b => b > 2) / 20, peak};
}

// Trunk radius at each vertex ring, as a percentage of the radius just above
// the buttress. A coast redwood is described as having minimal taper, so these
// should fall slowly; anything that halves by mid-height is a pine.
function trunkProfile(tree) {
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
 const rows = [...rings].sort((a, b) => a[0] - b[0]).filter(([k]) => k <= .5);
 const base = rows.find(([k]) => k > .08)?.[1] || rows[0][1];
 return rows.filter((_, i) => i % 2 === 0).slice(0, 9)
  .map(([k, r]) => `${(k * 100) | 0}%:${Math.round(r / base * 100)}`).join(' ');
}

// ez-tree names its two meshes nothing at all, so tell them apart by material:
// the leaves are the alpha-tested one.
const isLeaf = mesh => !!(mesh.material && (mesh.material.alphaTest > 0 || mesh.material.transparent));

// OBJ, with a material name the ingest's ROLE_OF already understands.
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
  const leaf = isLeaf(mesh);
  // The leaf sheet's coordinates are sprite positions and must not be touched.
  // Bark tiles, and the repeat is baked into the coordinates rather than left
  // as a material setting, so it travels with the file: roughly one tile every
  // five metres up a 115 m trunk, and eight around it.
  const su = leaf ? 1 : BARK_REPEAT.u, sv = leaf ? 1 : BARK_REPEAT.v;
  for (let i = 0; i < pos.count; i++)
   lines.push(`v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`);
  if (uv) for (let i = 0; i < uv.count; i++)
   lines.push(`vt ${(uv.getX(i) * su).toFixed(4)} ${(uv.getY(i) * sv).toFixed(4)}`);
  if (nor) for (let i = 0; i < nor.count; i++)
   lines.push(`vn ${nor.getX(i).toFixed(4)} ${nor.getY(i).toFixed(4)} ${nor.getZ(i).toFixed(4)}`);

  body.push(`usemtl ${leaf ? 'Redwood_Leaves' : 'Redwood_Bark'}`);
  const index = g.index ? g.index.array : null;
  const count = index ? index.length : pos.count;
  for (let i = 0; i < count; i += 3) {
   const f = [0, 1, 2].map(k => {
    const at = index ? index[i + k] : i + k;
    const v = vBase + at, t = uv ? vtBase + at : '', n = nor ? vnBase + at : '';
    return `${v}/${t}/${n}`;
   });
   body.push(`f ${f[0]} ${f[1]} ${f[2]}`);
  }
  vBase += pos.count;
  if (uv) vtBase += uv.count;
  if (nor) vnBase += nor.count;
 }
 return lines.concat(body).join('\n') + '\n';
}

const BARK_REPEAT = {u: 8, v: 22};

const MTL = `# Generated by tools/bake-trees.mjs. The colours are placeholders: the game
# paints every surface from the biome palette by the material's NAME.
newmtl Redwood_Bark
Kd 0.42 0.25 0.18
map_Kd redwood_bark.jpg

newmtl Redwood_Leaves
Kd 0.20 0.33 0.22
map_Kd redwood_leaves.png
`;

mkdirSync(OUT, {recursive: true});

// Two textures, colour only -- no normal, roughness or ambient-occlusion maps,
// because the game is toon shaded and reads none of them.
//
// The bark is ez-tree's WILLOW, not its pine: willow is the deeply, vertically
// furrowed one of the four, which is what redwood bark looks like, and it
// comes from Poly Haven (bark_willow_02) which is CC0. The pine bark is from
// texturecan, whose terms would need checking first. See ATTRIBUTION.md.
const ASSETS = join(ROOT, 'node_modules', '@dgreenheck', 'ez-tree', 'src', 'lib', 'assets');
const leafSource = join(ASSETS, 'leaves', 'pine_color.png');
const barkSource = join(ASSETS, 'bark', 'willow_color_1k.jpg');
if (!existsSync(leafSource) || !existsSync(barkSource)) {
 console.error('ez-tree not installed: npm install');
 process.exit(1);
}
copyFileSync(leafSource, join(OUT, 'redwood_leaves.png'));
copyFileSync(barkSource, join(OUT, 'redwood_bark.jpg'));

writeFileSync(join(OUT, 'README.md'),
`# eztree-redwood

Generated, not vendored. \`node tools/bake-trees.mjs\` produces these from
[ez-tree](https://github.com/dgreenheck/ez-tree) (MIT) by
[dgreenheck](https://github.com/dgreenheck), which is a devDependency and never
ships. The geometry is ours to use under that licence; \`redwood_leaves.png\` is
ez-tree's own leaf sprite sheet, copied unchanged.

Re-bake after changing the parameters in tools/bake-trees.mjs. Nothing here
should be edited by hand.
`);

// Four variants, so a grove is not one tree repeated. Same rules, different
// seeds, plus a deliberate spread of trunk thickness and crown depth.
const VARIANTS = [
 ['Redwood_1', 1207, {}],
 // Older: branches start higher, fewer of them, shorter. Self-pruning lifts
 // the crown as a redwood ages, and the oldest are nearly bare to 50 m.
 ['Redwood_2', 5533, {'branch.start.1': .72, 'branch.children.0': 19, 'branch.length.1': 11}],
 // Thicker in the bole, deeper crown.
 ['Redwood_3', 8891, {'branch.radius.0': 3.0, 'branch.length.1': 15, 'branch.start.1': .58}],
 // Younger, so a longer crown and more of it.
 ['Redwood_4', 3120, {'branch.start.1': .52, 'branch.children.0': 34, 'branch.taper.0': .86}],
];

let mtlWritten = false;
for (const [name, seed, tweak] of VARIANTS) {
 const tree = redwood(seed, tweak);
 let verts = 0;
 tree.traverse(o => { if (o.isMesh) verts += o.geometry.attributes.position.count; });
 const obj = toObj(tree, name);
 writeFileSync(join(OUT, name + '.obj'), obj);
 writeFileSync(join(OUT, name + '.mtl'), MTL);
 mtlWritten = true;
 const p = profile(tree);
 console.log(`${name.padEnd(11)} ${String(verts).padStart(6)} verts  ${(obj.length / 1024).toFixed(0).padStart(4)} KB`
  + (p ? `  crown starts ${(p.crownStart * 100).toFixed(0)}%  reversals ${p.turns}` : '  no leaves'));
 if (report && p) console.log('            crown ' + p.bands.map(b => b.toString(16).toUpperCase()).join(' '));
 if (report) console.log('            trunk ' + trunkProfile(tree));
}
if (mtlWritten) console.log(`\n${OUT}`);
console.log('now: node tools/build-meshes.mjs   (and npm run assets to look at them)');
