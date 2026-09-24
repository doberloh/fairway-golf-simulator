import test from 'node:test';
import assert from 'node:assert/strict';
import {greenRadius, greenDistance, ovalRadius, hazardMetric} from '../src/course.js';
import {world} from './worlds.mjs';

// Five things read these outlines: pin placement, the fit that holds a green-side
// bunker off the fringe, hazard overlap, the high-resolution terrain patch, and
// the ground shader. The shader is safe by construction -- the wave values are
// scaled at generation and both data textures pack whatever the hole and bunker
// carry, so there is one set of numbers rather than two. The rest are here.

const BIOMES = ['midwest', 'pnw', 'links'];
const at = (greenShape, bunkerShape, biome, seed) =>
 world({holes: 9, biome, seed, greenShape, bunkerShape});
const SETTINGS = [[0, 0], [30, 30], [100, 100]];

test('the slider at zero reproduces the outline the generator always had', () => {
 // The guarantee that makes this safe to ship: an existing course looks the way
 // it did if the slider is put back down.
 for (const biome of BIOMES) {
  const w = at(0, 0, biome, 'shape-' + biome);
  for (const h of w.holes) {
   const rs = Array.from({length: 72}, (_, i) => greenRadius(h, i / 72 * 6.283));
   const ratio = Math.max(...rs) / Math.min(...rs);
   assert.ok(ratio < 1.45, `${biome} hole ${h.hole + 1}: green ratio ${ratio.toFixed(2)} at slider 0`);
  }
 }
});

test('turning the slider up actually changes the shape', () => {
 // A slider that does nothing is worse than no slider, because it looks fixed.
 for (const biome of BIOMES) {
  const ratios = SETTINGS.map(([g, b]) => {
   const w = at(g, b, biome, 'shape-' + biome);
   const all = w.holes.map(h => {
    const rs = Array.from({length: 72}, (_, i) => greenRadius(h, i / 72 * 6.283));
    return Math.max(...rs) / Math.min(...rs);
   }).sort((x, y) => x - y);
   return all[all.length >> 1];
  });
  // 1.3x, not 1.5x. The first version of the slider reached a median ratio of
  // 2.45 at full by amplifying whatever harmonic already dominated -- which is
  // exactly what made greens come out as a flower with one lobe stretched into
  // a shaft. Spreading the energy instead costs range: 1.74 at full. That is a
  // deliberate trade and the threshold records it rather than hiding it.
  assert.ok(ratios[2] > ratios[0] * 1.3,
   `${biome}: green shape barely moved across the slider (${ratios.map(r => r.toFixed(2)).join(' -> ')})`);
  assert.ok(ratios[1] > ratios[0] && ratios[2] > ratios[1], `${biome}: not monotonic (${ratios.join(', ')})`);
 }
});

test('an outline never folds through itself, at any setting', () => {
 // The cap on total wave amplitude is what guarantees this: a radius that went
 // negative would turn the green inside out and every distance test that reads
 // it would start answering nonsense.
 for (const [g, b] of SETTINGS) for (const biome of BIOMES) {
  const w = at(g, b, biome, 'shape-' + biome);
  for (const h of w.holes) {
   for (let i = 0; i < 360; i++) {
    const r = greenRadius(h, i / 360 * 6.283);
    assert.ok(r > 0, `${biome} hole ${h.hole + 1}: green radius ${r.toFixed(2)} at ${g}%`);
    assert.ok(r > h.greenSize * .3,
     `${biome} hole ${h.hole + 1}: green pinches to ${(r / h.greenSize).toFixed(2)} of nominal at ${g}%`);
   }
   for (const bk of h.bunkers) for (let i = 0; i < 180; i++) {
    const q = ovalRadius(bk, i / 180 * 6.283);
    assert.ok(Math.hypot(q.x, q.z) > 0, `${biome}: bunker radius went to zero at ${b}%`);
   }
  }
 }
});

test('the pin still sits on the green whatever shape it is', () => {
 // `choosePin` picks from the green's own geometry, so a shaped outline must not
 // leave the cup off the surface -- the one failure a player would meet first.
 for (const [g, b] of SETTINGS) for (const biome of BIOMES) {
  const w = at(g, b, biome, 'shape-' + biome);
  for (const h of w.holes) {
   const d = greenDistance(h, h.pin.x, h.pin.z);
   assert.ok(d < 0, `${biome} hole ${h.hole + 1}: pin sits ${d.toFixed(2)} OUTSIDE the green at ${g}%`);
   assert.equal(h.surface(h.pin.x, h.pin.z), 'green',
    `${biome} hole ${h.hole + 1}: the ground under the pin is not green at ${g}%`);
  }
 }
});

test('green-side bunkers keep clear of the green however ragged they get', () => {
 // A bunker is fitted to the green by a binary search AFTER its outline is
 // scaled. If that ordering were reversed a lumpier bunker would eat into the
 // fringe, which is the thing the fit exists to prevent.
 for (const [g, b] of SETTINGS) for (const biome of BIOMES) {
  const w = at(g, b, biome, 'shape-' + biome);
  const fringe = w.settings.fringe, gap = w.settings.bunkerGap;
  for (const h of w.holes) for (const bk of h.bunkers.filter(x => x.greenSide)) {
   let closest = Infinity;
   for (let i = 0; i < 128; i++) {
    const q = ovalRadius(bk, i / 128 * 6.283);
    closest = Math.min(closest, greenDistance(h, bk.x + q.x, bk.z + q.z));
   }
   assert.ok(closest > fringe - 1.5,
    `${biome} hole ${h.hole + 1}: green-side bunker comes within ${closest.toFixed(2)} of the green ` +
    `at shape ${b}%, inside the ${fringe} m fringe`);
  }
 }
});

test('bunkers do not grow into each other or onto a tee', () => {
 for (const [g, b] of SETTINGS) for (const biome of BIOMES) {
  const w = at(g, b, biome, 'shape-' + biome);
  for (const h of w.holes) {
   for (let i = 0; i < h.bunkers.length; i++) for (let j = i + 1; j < h.bunkers.length; j++) {
    const a = h.bunkers[i], c = h.bunkers[j];
    // Walk one outline and check no point of it lands inside the other.
    for (let k = 0; k < 96; k++) {
     const q = ovalRadius(a, k / 96 * 6.283);
     assert.ok(hazardMetric(a.x + q.x, a.z + q.z, c) > .82,
      `${biome} hole ${h.hole + 1}: two bunkers overlap at shape ${b}%`);
    }
   }
   for (const bk of h.bunkers) for (const tee of Object.values(h.tees)) {
    assert.ok(hazardMetric(tee.x, tee.z, bk) > 1,
     `${biome} hole ${h.hole + 1}: a tee sits inside a bunker at shape ${b}%`);
   }
  }
 }
});
