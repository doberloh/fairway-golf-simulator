// What a Blender pack actually wrote, model by model (the cartoon overhaul).
//
//   node tools/blender/inspect.mjs <pack>
//
// For each .glb in vendor/blender-<pack>/: its vertices and triangles per role,
// and the range of its cartoon paint (tools/blender/cartoon.py) -- RGB as the
// multiplier the game will apply (twice the stored value) and alpha as the
// wind flex. A paint that is missing, or flat at 1.0, is a pack whose shading
// never reached the file; this says so before a round is judged on a picture.
import {readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extract} from '../mesh-read.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pack = process.argv[2];
if (!pack) throw Error('usage: node tools/blender/inspect.mjs <pack>');
const dir = join(ROOT, 'vendor', `blender-${pack}`);
let verts = 0, tris = 0;
for (const file of readdirSync(dir).filter(f => f.endsWith('.glb')).sort()) {
 const parts = [];
 for (const [role, g] of extract(join(dir, file))) {
  const n = g.position.length / 3, t = g.index.length / 3, c = g.color;
  verts += n; tris += t;
  let paint = 'no paint';
  if (c?.length) {
   let lo = Infinity, hi = -Infinity, flo = Infinity, fhi = -Infinity;
   for (let i = 0; i < c.length; i += 4) {
    const v = (c[i] + c[i + 1] + c[i + 2]) / 3 * 2;
    lo = Math.min(lo, v); hi = Math.max(hi, v); flo = Math.min(flo, c[i + 3]); fhi = Math.max(fhi, c[i + 3]);
   }
   paint = `shade ${lo.toFixed(2)}-${hi.toFixed(2)}, flex ${flo.toFixed(2)}-${fhi.toFixed(2)}`;
  }
  parts.push(`${role} ${n}v/${t}t (${paint})`);
 }
 console.log(`${file.replace('.glb', '').padEnd(26)} ${parts.join('; ')}`);
}
console.log(`total ${verts} vertices, ${tris} triangles`);
