// A CONTACT SHEET FOR EVERY MODEL IN vendor/, so choosing one is looking
// rather than guessing.
//
// Run:  node tools/asset-preview.mjs                 every pack
//       node tools/asset-preview.mjs megakit         one pack
//       node tools/asset-preview.mjs pine fern       anything matching
// Writes: preview/assets-data.js, then `npm run assets` builds dist/assets.html
// -- one self-contained file. Open it in a browser directly: no server, no
// network.
//
// Why this exists: the packs hold 729 models and 96 ship. Picking the wrong one
// costs a build, a look and a round trip, and it has already cost several --
// the tiered "wedding cake" pines went in and had to come out again. The page
// shows each model at a stated size beside a 1.8 m human, painted with the same
// role colours the game paints it with, and gives you the exact `pack:Name`
// string a PICK entry wants.
//
// Nothing here ships. dist/assets.html is a local tool.
import {readdirSync, writeFileSync, mkdirSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extract, extractObj} from './mesh-read.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor');
const filters = process.argv.slice(2).map(a => a.toLowerCase());
const wanted = (pack, name) => !filters.length
 || filters.some(f => pack.toLowerCase().includes(f) || name.toLowerCase().includes(f));

// Same normalisation the game uses: centred on x/z, sitting on y=0, one unit
// tall, so what you see here is the shape the game will draw.
const models = [];
let skipped = 0;
for (const pack of readdirSync(VENDOR)) {
 const dir = join(VENDOR, pack);
 // A pack shipping both formats for one model only needs reading once, and
 // GLB is preferred: it carries the node transform that the OBJ has baked.
 const found = new Map();
 for (const file of readdirSync(dir)) {
  const dot = file.lastIndexOf('.'), ext = file.slice(dot + 1).toLowerCase();
  if (ext !== 'glb' && ext !== 'obj') continue;
  const name = file.slice(0, dot);
  if (ext === 'glb' || !found.has(name)) found.set(name, ext);
 }
 for (const [name, ext] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (!wanted(pack, name)) continue;
  let byRole;
  try { byRole = ext === 'glb' ? extract(join(dir, name + '.glb')) : extractObj(join(dir, name + '.obj')); }
  catch { skipped++; continue; }
  if (!byRole || !byRole.size) { skipped++; continue; }

  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const g of byRole.values())
   for (let i = 0; i < g.position.length; i += 3) {
    minX = Math.min(minX, g.position[i]); maxX = Math.max(maxX, g.position[i]);
    minY = Math.min(minY, g.position[i + 1]); maxY = Math.max(maxY, g.position[i + 1]);
    minZ = Math.min(minZ, g.position[i + 2]); maxZ = Math.max(maxZ, g.position[i + 2]);
   }
  const height = Math.max(maxY - minY, 1e-6), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

  // The profile that catches a tiered crown: widest radius in each of twenty
  // bands from the ground up. A single peak is a plume; alternating high and
  // low is a stack of plates, which is what a wedding-cake pine looks like in
  // numbers. Leaf geometry only, since that is the part with a silhouette.
  const bands = new Array(20).fill(0);
  for (const [role, g] of byRole) {
   if (role !== 'leaf' && byRole.has('leaf')) continue;
   for (let i = 0; i < g.position.length; i += 3) {
    const y = (g.position[i + 1] - minY) / height;
    const r = Math.hypot(g.position[i] - cx, g.position[i + 2] - cz) / height;
    const b = Math.min(19, Math.max(0, Math.floor(y * 20)));
    bands[b] = Math.max(bands[b], r);
   }
  }
  const peak = Math.max(...bands) || 1;

  const parts = [];
  let verts = 0;
  for (const [role, g] of byRole) {
   const count = g.position.length / 3;
   verts += count;
   const position = new Int16Array(count * 3);
   for (let i = 0; i < count; i++) {
    position[i * 3] = Math.round(((g.position[i * 3] - cx) / height) * 16384);
    position[i * 3 + 1] = Math.round(((g.position[i * 3 + 1] - minY) / height) * 16384);
    position[i * 3 + 2] = Math.round(((g.position[i * 3 + 2] - cz) / height) * 16384);
   }
   parts.push({role, p: Buffer.from(position.buffer).toString('base64'),
    i: Buffer.from(new Uint16Array(g.index).buffer).toString('base64')});
  }
  models.push({name, pack, ext, verts,
   radius: +(Math.max(maxX - minX, maxZ - minZ) / 2 / height).toFixed(4),
   profile: bands.map(b => Math.round(b / peak * 15)),
   parts});
 }
}
models.sort((a, b) => a.pack.localeCompare(b.pack) || a.name.localeCompare(b.name));
if (!models.length) {
 console.error(`nothing matched ${filters.join(', ')}`);
 process.exit(1);
}

// The page itself lives in preview/ and is built by vite, exactly the way the
// game is -- `vite-plugin-singlefile` already solves "one HTML file with
// everything inlined" for this project. Inlining three by hand does not work:
// since r17x it ships as three.module.js plus three.core.js, and concatenating
// the two rollup bundles collides on their internal names.
const dataPath = join(ROOT, 'preview', 'assets-data.js');
mkdirSync(dirname(dataPath), {recursive: true});
writeFileSync(dataPath, '// GENERATED by tools/asset-preview.mjs -- do not edit by hand.\n'
 + 'export const MODELS = ' + JSON.stringify(models) + ';\n');
console.log(`${models.length} models${filters.length ? ' matching ' + filters.join(', ') : ''}`
 + (skipped ? `, ${skipped} unreadable` : ''));
console.log(`${dataPath}  ${(statSync(dataPath).size / 1048576).toFixed(1)} MB`);
console.log('now: npx vite build --config vite.assets.config.js   (or use npm run assets)');
