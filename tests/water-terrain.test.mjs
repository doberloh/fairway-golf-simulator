// What water is allowed to do to the ground it sits in.
//
// Three rules: water bodies belong on land, a pond is allowed to reach into
// SPLIT FROM water-terrain.test.mjs BECAUSE THE RUNNER PARALLELISES BY FILE.
// Tests inside one file run on one thread, so a file that builds forty courses
// is a forty-course serial queue however many cores are idle. This file and
// its sibling were one 326-second file -- the single longest in the suite, and
// therefore the suite's entire wall time.
// play, and a fairway that meets water stops behind a band of semi-rough.
//
// The third is HALF testable here. This file checks the lie; the matching paint
// is in ground.js and no test can see it, which is exactly how the first attempt
// shipped a perfect measurement and zero visible change. If you change one, go
// and look at the other.
// SPLIT AGAIN, THREE WAYS (the testing audit, 31 October 2026): the coast
// and the beach stay here; water-shore.test.mjs holds a pond reaching into
// play and the semi-rough band, water-lakes.test.mjs a lake landing on a
// pond. Tests that read the same courses stay in one file, so nothing is
// built twice; each file is under a minute, and they run side by side.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ovalRadius, insideOval, fairwayWidth, NO_INLAND_WATER, BEACH_RISE} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {shoreBands} from '../src/streams.js';

// (The Keys, the only ring island, left for Florida Palms on 7 November 2026: no landscape builds an
// island now, so the island-only test that stood here went with it. TODO *The island code has no landscape*.)

test('no watercourse is drawn on the seabed', () => {
 // Links has a coast too, and channels are laid across a span reaching well past
 // the course while the profile only ever trimmed them for the CUT budget. On a
 // coast that put stations out at sea -- 87 to 95% of them on island seeds
 // before islands stopped carrying channels at all.
 const w = buildWorld({seed: 'SEA', biome: 'seaside', holes: 9, rivers: 2, creeks: 3});
 let total = 0, drowned = 0;
 for (const stream of w.streams.streams || []) for (const p of stream.points || []) {
  total++;
  if (w.land(p.x, p.z) < 0) drowned++;
 }
 assert.equal(drowned, 0, `${drowned} of ${total} stream stations at sea`);
});

test('a channel is chosen for crossing the course, not for being long', () => {
 // Once runs are trimmed at the shoreline, an attempt lying entirely off the map
 // is untrimmed and therefore longest, so length alone selected it: both channels
 // on a measured links seed came back about a kilometre outside the course.
 const w = buildWorld({seed: 'TFLCsss', biome: 'seaside', holes: 9,
  rivers: 1, creeks: 1, elevation: 75});
 let best = 0;
 for (const stream of w.streams.streams || []) {
  const inside = stream.points.filter(p => Math.abs(p.x) <= w.halfX && Math.abs(p.z) <= w.halfZ);
  best = Math.max(best, inside.length);
 }
 assert.ok(best > 30, `no channel has more than ${best} stations on the course`);
});

test('no pond sits in the sea on a coastal course', () => {
 for (const seed of ['A', 'B', 'C', 'D']) {
  const w = buildWorld({seed, biome: 'seaside', holes: 9, water: 100});
  for (const h of w.holes) for (const p of h.ponds) {
   const c = h.toWorld(p);
   assert.ok(w.land(c.x, c.z) >= 0, 'a pond centre in open water');
   for (let i = 0; i < 12; i++) {
    const e = ovalRadius(p, i * Math.PI / 6, 2);
    const q = h.toWorld({x: p.x + e.x, z: p.z + e.z});
    assert.ok(w.land(q.x, q.z) >= 0, 'a pond rim reaching into open water');
   }
  }
 }
});

test('the beach claims rough only, never mown turf', () => {
 // Letting it take the corridor as well seemed right -- a fairway running to the
 // sea ought to have sand between it and the water -- and turned a fifth of every
 // island hole into beach, because the foreshore lowers a lot of coastal ground
 // below the sand line. Reported as "sand fairways".
 //
 // Asserted on the mown CENTRELINE, which is unambiguously fairway unless a
 // hazard is sitting on it. Lateral proxies for "this ought to be fairway" all
 // leak: the stretch between the tee and mowStart is genuinely rough, and a
 // point inside one hole's corridor can be owned by a neighbouring hole.
 for (const biome of ['flpalms', 'seaside']) {
  let cells = 0;
  for (const seed of ['A', 'B', 'C']) {
   const w = buildWorld({seed, biome, holes: 9, trees: 0});
   for (const h of w.holes) for (let z = h.mowStart + 2; z < h.length - 2; z += 2) {
    const x = h.center(z);
    if (h.bunkers.some(b => insideOval(x, z, b, 0))) continue;
    if (h.ponds.some(p => insideOval(x, z, p, 0))) continue;
    cells++;
    assert.notEqual(h.surface(x, z), 'sand', `${biome} hole ${h.hole} at z=${z}`);
   }
  }
  assert.ok(cells > 500, 'not enough centreline sampled to mean anything');
 }
});

test('and there is still a beach to walk on', () => {
 // The obvious way to fix sand fairways is to stop making sand.
 const w = buildWorld({seed: 'A', biome: 'flpalms', holes: 9, trees: 0});
 // From the sea inward, from whichever side it lies (Florida Palms has it along one side; the
 // Keys, an island, had it on all four): each line walks in from past the edge to the first
 // shore and measures the sand behind it.
 let widths = [];
 const at = (u, v, alongX) => alongX ? w.surface(u, v) : w.surface(v, u);
 for (const alongX of [true, false]) for (const dir of [1, -1]) {
  const half = alongX ? w.halfX : w.halfZ, across = alongX ? w.halfZ : w.halfX;
  for (let v = -across + 40; v < across; v += 160) {
   for (let s = -half - 400; s < half + 400; s += 4) {
    const u = s * dir;
    if (at(u, v, alongX) === 'water' && at(u + 4 * dir, v, alongX) !== 'water') {
     let run = 0;
     for (let d = 4; d < 120; d += 2) { if (at(u + d * dir, v, alongX) === 'sand') run += 2; else break; }
     if (run > 0) widths.push(run);
     break;
    }
   }
  }
 }
 assert.ok(widths.length > 4, 'no shoreline found to measure');
 widths.sort((a, b) => a - b);
 assert.ok(widths[Math.floor(widths.length / 2)] >= 6,
  `median beach only ${widths[Math.floor(widths.length / 2)]} m`);
 assert.ok(BEACH_RISE > 0);
});
