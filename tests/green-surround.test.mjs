import test from 'node:test';
import assert from 'node:assert/strict';
import {GREEN, greenApproaches, teeFans, inTeeFan} from '../src/course.js';
import {GROUND_PLANTS} from '../src/species.js';
import {world} from './worlds.mjs';

// Ground cover is exempt from both rules by design: ankle height, no trunk, so
// it can block neither a shot nor a view. A first draft of these tests forgot
// that and failed on shrubs sitting 41 m into an approach, which is exactly
// where a shrub should be allowed to sit.
const trunked = t => !GROUND_PLANTS.has(t.kind);

const BIOMES = ['midwest', 'pnw', 'redwood'];
const near = (w, g, t) => {
 const lx = t.x - g.x, lz = t.z - g.z, d = Math.hypot(lx, lz);
 return {d, onApproach: d > 1e-6 && (lx * g.dx + lz * g.dz) / d >= Math.cos(GREEN.arc)};
};

test('the approach to a green stays open at every setting of the slider', () => {
 // THE POINT OF THE WHOLE RULE. A shot has to have somewhere to land, so the
 // arc facing back down the fairway keeps its clearance whatever the slider
 // says; the slider moves the back and the flanks only.
 for (const biome of BIOMES) {
  const seen = [];
  for (const greenTrees of [0, 50, 100]) {
   const w = world({holes: 9, biome, seed: 'gs-' + biome, greenTrees});
   const gs = greenApproaches(w.holes);
   let closest = Infinity;
   for (const g of gs) for (const t of w.trees.filter(trunked)) {
    const {d, onApproach} = near(w, g, t);
    if (d <= GREEN.zone && onApproach) closest = Math.min(closest, d);
   }
   assert.ok(closest >= GREEN.open - 1,
    `${biome} at ${greenTrees}%: a tree stands ${closest.toFixed(1)} m into the approach, inside ${GREEN.open} m`);
   seen.push(closest);
  }
  // And it does not creep in as the slider rises.
  assert.ok(Math.max(...seen) - Math.min(...seen) < 2,
   `${biome}: the approach clearance moved with the slider (${seen.map(v => v.toFixed(1)).join(', ')})`);
 }
});

test('the slider moves trees behind and beside a green', () => {
 for (const biome of BIOMES) {
  const counts = [0, 50, 100].map(greenTrees => {
   const w = world({holes: 9, biome, seed: 'gs-' + biome, greenTrees});
   const gs = greenApproaches(w.holes);
   let n = 0;
   for (const g of gs) for (const t of w.trees.filter(trunked)) if (near(w, g, t).d < 40) n++;
   return n;
  });
  assert.ok(counts[2] > counts[0],
   `${biome}: 100% gave ${counts[2]} trees within 40 m of a green against ${counts[0]} at 0% -- the slider does nothing`);
  assert.ok(counts[1] >= counts[0] && counts[2] >= counts[1],
   `${biome}: not monotonic across the slider (${counts.join(', ')})`);
 }
});

test('at zero the greens keep the standoff they always had', () => {
 for (const biome of BIOMES) {
  const w = world({holes: 9, biome, seed: 'gs-' + biome, greenTrees: 0});
  const gs = greenApproaches(w.holes);
  for (const g of gs) for (const t of w.trees.filter(trunked)) {
   const {d} = near(w, g, t);
   assert.ok(d > GREEN.far - GREEN.ramp,
    `${biome}: a tree sits ${d.toFixed(1)} m from a green with the slider at zero`);
  }
 }
});

test('the tee fan keeps planting out of the view from every tee, not just its own', () => {
 // A tree can miss the back tee's own wedge and still stand in what you SEE
 // from it, because the three tees are staggered and can be ninety metres apart
 // across a hole. The fan is the convex hull of all three wedges.
 for (const biome of BIOMES) {
  const w = world({holes: 9, biome, seed: 'fan-' + biome});
  const fans = teeFans(w.holes);
  const inside = w.trees.filter(t => trunked(t) && !t.feature && inTeeFan(fans, t.x, t.z));
  assert.deepEqual(inside.map(t => `${t.kind} at ${t.x.toFixed(0)},${t.z.toFixed(0)}`), [],
   `${biome}: trees stand inside the tee fan`);
 }
});

test('the fan does not simply clear everything round a tee', () => {
 // It is forward-only. Ground behind and outside the widest tee still plants,
 // which is what stops this undoing the encroachment work.
 const w = world({holes: 9, biome: 'pnw', seed: 'fan-pnw'});
 const fans = teeFans(w.holes);
 const tees = w.holes.flatMap(h => Object.values(h.tees).map(t => h.toWorld(t)));
 let close = 0;
 for (const t of w.trees.filter(trunked))
  if (tees.some(p => Math.hypot(p.x - t.x, p.z - t.z) < 30)) close++;
 assert.ok(close > 20, `only ${close} trees stand within 30 m of any tee -- the fan has cleared the complex`);
});
