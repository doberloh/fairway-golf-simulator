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
// A coast redwood is a column: barely tapered, bare for most of its height,
// with short branches only in the top third and a crown far narrower than a
// pine's. Those are four numbers -- `taper`, `start[1]`, `length[1]` and
// `children[0]` -- and they are the whole reason for generating rather than
// importing, because no pack contains this shape at any size.
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
 o.branch.radius[0] = 100 * .028;  // a redwood is about a thirty-fifth as thick as it is tall
 o.branch.taper[0] = .82;          // a column, not a spike
 o.branch.sections[0] = 10;
 o.branch.segments[0] = 9;
 o.branch.gnarliness[0] = .012;    // very straight

 // Branches only in the top third, short, and swept slightly up.
 o.branch.start[1] = .64;
 o.branch.children[0] = 42;
 o.branch.length[1] = 11;
 o.branch.radius[1] = .28;
 o.branch.angle[1] = 102;
 o.branch.taper[1] = .5;
 o.branch.sections[1] = 5;
 o.branch.segments[1] = 4;
 o.branch.gnarliness[1] = .12;

 o.branch.start[2] = .2;
 o.branch.children[1] = 4;
 o.branch.length[2] = 4.5;
 o.branch.radius[2] = .5;
 o.branch.angle[2] = 58;
 o.branch.sections[2] = 3;
 o.branch.segments[2] = 3;

 o.leaves.type = 'pine';
 o.leaves.billboard = 'double';
 o.leaves.start = .1;
 o.leaves.count = 14;
 o.leaves.size = 3.4;
 o.leaves.sizeVariance = .25;
 o.leaves.angle = 22;
 o.leaves.alphaTest = .35;

 for (const [path, value] of Object.entries(tweak)) {
  const keys = path.split('.');
  let at = o;
  while (keys.length > 1) at = at[keys.shift()];
  at[keys[0]] = value;
 }
 tree.generate();
 return tree;
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
  for (let i = 0; i < pos.count; i++)
   lines.push(`v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`);
  if (uv) for (let i = 0; i < uv.count; i++) lines.push(`vt ${uv.getX(i).toFixed(4)} ${uv.getY(i).toFixed(4)}`);
  if (nor) for (let i = 0; i < nor.count; i++)
   lines.push(`vn ${nor.getX(i).toFixed(4)} ${nor.getY(i).toFixed(4)} ${nor.getZ(i).toFixed(4)}`);

  body.push(`usemtl ${isLeaf(mesh) ? 'Redwood_Leaves' : 'Redwood_Bark'}`);
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

const MTL = `# Generated by tools/bake-trees.mjs. The colours are placeholders: the game
# paints every surface from the biome palette by the material's NAME.
newmtl Redwood_Bark
Kd 0.42 0.25 0.18

newmtl Redwood_Leaves
Kd 0.20 0.33 0.22
map_Kd redwood_leaves.png
`;

mkdirSync(OUT, {recursive: true});

// One leaf texture, and only one. Bark stays untextured because the game
// already paints it, and a bark image is the part of this library whose
// upstream licensing needs checking; the leaf sprites are the repo's own.
const leafSource = join(ROOT, 'node_modules', '@dgreenheck', 'ez-tree',
 'src', 'lib', 'assets', 'leaves', 'pine_color.png');
if (!existsSync(leafSource)) { console.error('ez-tree not installed: npm install'); process.exit(1); }
copyFileSync(leafSource, join(OUT, 'redwood_leaves.png'));

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
 ['Redwood_2', 5533, {'branch.start.1': .70, 'branch.children.0': 34, 'branch.length.1': 9.5}],
 ['Redwood_3', 8891, {'branch.taper.0': .88, 'branch.radius.0': 3.1, 'branch.length.1': 12.5}],
 ['Redwood_4', 3120, {'branch.start.1': .58, 'branch.gnarliness.0': .03, 'branch.children.0': 50}],
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
 if (report && p) console.log('            ' + p.bands.map(b => b.toString(16).toUpperCase()).join(' '));
}
if (mtlWritten) console.log(`\n${OUT}`);
console.log('now: node tools/build-meshes.mjs   (and npm run assets to look at them)');
