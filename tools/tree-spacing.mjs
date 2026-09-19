// HOW CLOSE DO TREES ACTUALLY STAND, against how wide their crowns are?
//
// Run: node tools/tree-spacing.mjs [biome] [seed]
//
// Written when a 380-foot redwood grove came out mangled. It is the answer
// to 'is this too dense' that does not depend on how a screenshot looks:
// before the spacing rule the median tree stood 8.6 m from its neighbour
// with a 6.5 m crown radius, so the median canopy overlapped its neighbour's
// by 42% and the worst pair of trunks intersected by 5.4 m.
//
// Keep an eye on the trunk-gap row in particular: it is the one that can go
// negative, and a negative there is two trees in the same place.
import {generateWorld} from '../src/course.js';
import {DEFAULT_COURSE} from '../src/settings-schema.js';
import {crownFraction, crownRadius} from '../src/species.js';
import {trunkRadius} from '../src/physics.js';

const [biome = 'redwood', seed = 'LOOK-1'] = process.argv.slice(2);
const settings = {...DEFAULT_COURSE, seed, biome, holes: 9};
console.log('tree slider', settings.trees);
const w = generateWorld(settings);

// The same rules the drawing uses, from the modules that own them.
const WIDE = {redwood: crownFraction('redwood'), fir: crownFraction('fir')};
const crown = t => crownRadius(t);
const trunk = t => trunkRadius(t);

const tall = w.trees.filter(t => WIDE[t.kind]);
const others = w.trees.filter(t => !WIDE[t.kind] && t.h > 4);
console.log('trees', w.trees.length, ' tall conifers', tall.length, ' other trees', others.length);
const area = (w.halfX * 2) * (w.halfZ * 2) / 1e6;
console.log('map', (w.halfX * 2).toFixed(0), 'x', (w.halfZ * 2).toFixed(0), 'm =', area.toFixed(2), 'km2');

function stats(label, list) {
 const v = list.slice().sort((a, b) => a - b);
 const q = p => v[Math.floor(p * (v.length - 1))].toFixed(1);
 console.log(`  ${label.padEnd(34)} n=${String(v.length).padStart(5)}  min ${q(0)}  p05 ${q(.05)}  med ${q(.5)}  p95 ${q(.95)}  max ${q(1)}`);
}

// Nearest neighbour for every tall conifer, and how much its crown overlaps.
const near = [], overlapFrac = [], trunkGap = [], cedarGap = [];
for (const t of tall) {
 let best = Infinity, bestT = null;
 for (const o of w.trees) {
  if (o === t || o.h < 4) continue;
  const d = Math.hypot(o.x - t.x, o.z - t.z);
  if (d < best) { best = d; bestT = o; }
 }
 if (!bestT) continue;
 near.push(best);
 const want = crown(t) + (crown(bestT) || bestT.r);
 overlapFrac.push(Math.max(0, (want - best) / want) * 100);
 trunkGap.push(best - trunk(t) - trunk(bestT));
 if (!WIDE[bestT.kind]) cedarGap.push(best);
}
console.log('\nspacing, metres');
stats('distance to nearest tree', near);
stats('crown overlap, % of combined radii', overlapFrac);
stats('gap between trunk surfaces', trunkGap);
stats('nearest tree is NOT a tall conifer', cedarGap);

console.log('\ncrown half-widths');
stats('redwood crown half-width', tall.filter(t => t.kind === 'redwood').map(crown));
stats('fir crown half-width', tall.filter(t => t.kind === 'fir').map(crown));
stats('redwood trunk radius', tall.filter(t => t.kind === 'redwood').map(trunk));
const kinds = {};
for (const t of w.trees) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
console.log('\nkinds', kinds);
console.log('tall conifers per hectare', (tall.length / (area * 100)).toFixed(1),
 '   a real old-growth grove is 3 to 8');
