#!/usr/bin/env node
// THE GRID EACH TREE'S MIDDLE VERSION IS MADE ON (the frame-rate pass, 13
// November 2026). The game makes a painted tree's middle version from its
// full model when a course is built (src/mesh-assets.js midParts): the model
// merged on a grid. Which grid is decided here, once, for every model and
// every graphics tier that asks for middle versions, and written to
// src/mid-cells.js; the game then simplifies once, with no search.
//
// THE OUTLINE IS KEPT, MODEL BY MODEL (the owner's rule for far versions, 9
// November 2026; tools/far-cluster.mjs outlineScore). A quarter of the
// triangles is right for a crown of soft lobes and wrong for thin wood: at
// that share a palo verde kept 0.75 of its outline and 0.64 of its area at
// 300 pixels, a creosote 0.73 and 0.67. So each model is drawn beside its
// middle version at the size the tier swaps at, at the tier's own share and
// then at finer ones (LADDER), and takes the coarsest that passes MID_OUTLINE
// -- stricter than the far versions' rule, a middle version being seen two and
// three times as large. A model none passes for has no middle version: it is
// drawn whole down to its far twin's own line, as before the pass.
//
//   node tools/mid-cells.mjs          write src/mid-cells.js
//   node tools/mid-cells.mjs --check  exit 1 if it is out of date
//   node tools/mid-cells.mjs --list   what each model got, and why
//
// Run it after tools/build-meshes.mjs changes a model, or after a tier's
// `midTrees` (src/graphics.js) changes. A test runs the check.
import fs from 'node:fs';
import path from 'node:path';
import {MESH_MODELS} from '../src/asset-meshes.js';
import {modelParts, hasShippedTwin, simplifierInput, midWorthy} from '../src/mesh-assets.js';
import {simplifyCells} from '../src/mesh-simplify.js';
import {outlineScore} from './far-cluster.mjs';
import {TIERS} from '../src/graphics.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT = path.join(ROOT, 'src', 'mid-cells.js');

// PLACED: the far versions' rule is kept .85, extra .10, area .80 at 100 pixels.
export const MID_OUTLINE = {kept: .9, extra: .08, area: .85};
// The shares tried after the tier's own. (The simplifier gives up where a
// part would keep over .6 of its triangles: nothing finer is worth a mesh.)
export const LADDER = [.4, .5];

// Every {share, px} a tier asks for, once.
export const midTiers = () => [...new Map(Object.values(TIERS).filter(q => q.midTrees).map(q => [q.midTrees.share, q.midTrees])).values()].sort((a, b) => a.share - b.share);

const arrays = g => ({position: g.attributes.position.array, index: g.index.array});
// One model at one share: each worthy part's grid and what it was merged to.
function attempt(parts, share) {
 const cells = [], made = [];
 let any = false;
 for (const p of parts) {
  const s = midWorthy(p.geometry) ? simplifyCells(simplifierInput(p.geometry), share, 60) : null;
  cells.push(s?.cells ?? 0); made.push(s ? {position: s.part.position, index: s.part.index} : arrays(p.geometry));
  if (s) any = true;
 }
 return any ? {cells, made} : null;
}

export function midCells({list = false} = {}) {
 const table = {}, notes = [];
 for (const {share, px} of midTiers()) {
  const rows = table[share] = {};
  for (const name of Object.keys(MESH_MODELS)) {
   // Only a model with a far version of its own is ever swapped (instance-cull.js `painted`).
   if (name.endsWith('_Far') || !hasShippedTwin(name)) continue;
   const parts = modelParts(name);
   if (!parts.some(p => midWorthy(p.geometry))) continue;
   const whole = parts.map(p => arrays(p.geometry));
   let took = null;
   for (const s of [share, ...LADDER.filter(l => l > share)]) {
    const a = attempt(parts, s);
    if (!a) continue;
    const score = outlineScore(whole, a.made, px);
    if (score.kept >= MID_OUTLINE.kept && score.extra <= MID_OUTLINE.extra && score.area >= MID_OUTLINE.area) { took = {s, cells: a.cells, score}; break; }
   }
   // (A model with no row is searched for by the game; one with zeros is left whole.)
   rows[name] = took ? took.cells : parts.map(() => 0);
   if (list) notes.push(`${share} at ${px} px  ${name.padEnd(34)} ${took ? `share ${took.s}  kept ${took.score.kept.toFixed(2)} extra ${took.score.extra.toFixed(2)} area ${took.score.area.toFixed(2)}` : 'WHOLE: no share keeps its outline'}`);
  }
 }
 return list ? {table, notes} : table;
}

export function render(table) {
 return ['// WRITTEN BY tools/mid-cells.mjs -- do not edit. The grid each painted model\'s',
  '// parts are merged on for its middle version, by the share of triangles a',
  '// graphics tier asks for (src/graphics.js midTrees; src/mesh-assets.js',
  '// midParts). 0: the part is drawn whole; every part 0: the model has no',
  '// middle version (none keeps its outline) and swaps to its far twin as before.',
  'export const MID_CELLS = ' + JSON.stringify(table) + ';', ''].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tools', 'mid-cells.mjs')) {
 const listing = process.argv.includes('--list'), out = midCells({list: listing}), table = listing ? out.table : out, text = render(table);
 if (listing) {
  for (const n of out.notes) console.log(n);
  for (const [share, rows] of Object.entries(table)) { const all = Object.values(rows), none = all.filter(c => c.every(x => !x)).length; console.log(`share ${share}: ${all.length} models, ${all.length - none} with a middle version, ${none} left whole`); }
 } else if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== text) { console.error('src/mid-cells.js is out of date: run node tools/mid-cells.mjs'); process.exit(1); }
  console.log('src/mid-cells.js is up to date');
 } else { fs.writeFileSync(OUT, text); console.log(OUT + ': ' + text.length + ' bytes'); }
}
