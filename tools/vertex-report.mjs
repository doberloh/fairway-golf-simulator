// How well a pack's models suit the graphics card's vertex cache, and how much
// joining their vertices could save (docs/IDEAS.md, *Join and reorder every
// shipped model's vertices*).
//
//   node tools/vertex-report.mjs                     every folder in vendor/
//   node tools/vertex-report.mjs blender-meshy_redwood blender-cartoon_redwood
//   ... --models                                     a line for each model too
//
// shaded/tri  vertices the card shades per triangle on a 32-entry cache. About 0.6
//             is good; 3.0 means nothing is ever reused. This is the figure that
//             moved the frame on the Redwood Coast.
// vertices    as shipped.
// exact       left after joining vertices identical in position, normal and paint:
//             safe, nothing can look different.
// position    left after joining by position alone: the most that could be had,
//             at the price of smoothing every facet.
// A model cannot shade fewer than vertices/triangles per triangle, so reordering
// alone does nothing for a model whose triangles each own their vertices.
import {readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extract} from './mesh-read.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), perModel = argv.includes('--models');
const named = argv.filter(a => !a.startsWith('--'));
const packs = named.length ? named : readdirSync(join(ROOT, 'vendor'));

export function shadedPerTriangle(index, size = 32) {
 const fifo = [], seen = new Set();
 let miss = 0;
 for (const v of index) {
  if (seen.has(v)) continue;
  miss++;
  fifo.push(v);
  seen.add(v);
  if (fifo.length > size) seen.delete(fifo.shift());
 }
 return miss / (index.length / 3);
}

function count(g) {
 const exact = new Set(), place = new Set(), n = g.position.length / 3;
 for (let i = 0; i < n; i++) {
  const p = [g.position[i * 3], g.position[i * 3 + 1], g.position[i * 3 + 2]].map(v => v.toFixed(4)).join();
  const nrm = [g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]].map(v => v.toFixed(3)).join();
  const c = g.color?.length ? [g.color[i * 4], g.color[i * 4 + 1], g.color[i * 4 + 2], g.color[i * 4 + 3]].map(v => v.toFixed(3)).join() : '';
  place.add(p);
  exact.add(`${p}|${nrm}|${c}`);
 }
 return {vertices: n, exact: exact.size, position: place.size};
}

const line = (name, t) => `${name.padEnd(34)} ${String(t.tris).padStart(9)} tris  shaded/tri ${(t.shaded / t.tris).toFixed(2)}  vertices ${String(t.vertices).padStart(9)}  exact ${String(t.exact).padStart(9)}  position ${String(t.position).padStart(9)}`;
const all = {tris: 0, shaded: 0, vertices: 0, exact: 0, position: 0};
for (const pack of packs) {
 let files;
 try { files = readdirSync(join(ROOT, 'vendor', pack)).filter(f => f.endsWith('.glb')); } catch { continue; }
 const sum = {tris: 0, shaded: 0, vertices: 0, exact: 0, position: 0};
 for (const f of files) {
  const one = {tris: 0, shaded: 0, vertices: 0, exact: 0, position: 0};
  for (const g of extract(join(ROOT, 'vendor', pack, f)).values()) {
   const t = g.index.length / 3, c = count(g);
   one.tris += t;
   one.shaded += shadedPerTriangle(g.index) * t;
   one.vertices += c.vertices;
   one.exact += c.exact;
   one.position += c.position;
  }
  for (const k in sum) sum[k] += one[k];
  if (perModel) console.log(line(`  ${f.replace('.glb', '')}`, one));
 }
 if (!sum.tris) continue;
 console.log(line(pack, sum));
 for (const k in all) all[k] += sum[k];
}
if (packs.length > 1) console.log(line('ALL', all));
