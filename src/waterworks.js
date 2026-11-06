// WATER MADE BY PEOPLE (architect-courses, phase 5; the study, workstream E;
// docs/ARCHITECT_COURSES.md, *Phase 5*): what a builder does to a pond on an
// course, by its landscape (biomes.js WORLD `edge` and `fountain`, PLACED from
// each landscape's leading Architect style when the designer was removed, 2
// November 2026).
//
//   rip-rap     a band of rough stones along the waterline on the side of a
//               pond that faces play: Modern (the study), Parkland, Tropical,
//               Desert, Mountain (each its landscape's own stone)
//   bulkhead    railway-tie walls along the same edge, the Stadium signature
//               (Dye's sleepers; the study's timber bulkheads)
//   none        soft grass banks: Golden Age and Raynor (the study), Links,
//               Sandhills, Minimalist, Heathland
//   fountain    an aerating fountain in a large open pond on a resort or a
//               members' club of a dressed style, two a course at most
//
// The faced side is where play comes from: the arc of the edge within 75
// degrees of the nearest point of the hole's line (of the green, for a pond
// near it). All PLACED.
//
// Decoration: the stones and the ties sit at the water's edge, below the
// bank's top, and nothing here is solid or changes a lie (a ball reaching
// them is in the water either way). Placed in world coordinates as
// `{kind, x, z, y, rot, size}`; renderer.js `addWaterworks` draws them
// instanced. Every generated course. Pure: tests/waterworks.test.mjs.
import {ovalRadius} from './course.js';
import {worldStream} from './world-stream.js';
import {worldOf} from './biomes.js';

const FACING = Math.cos(75 * Math.PI / 180);
// A section of ties is 2.4 m long; a stone about 0.8 m across.
// Sections laid 2.2 m apart overlap a little, so a curve shows no gaps.
const TIE_RUN = 2.2, STONE_GAP = .6;

export function placeWaterworks({holes, s, surface}) {
 const look = worldOf(s.biome), edge = look.edge, out = [];
 const seen = new Set();
 let fountains = 0;
 for (const h of holes) for (const p of h.ponds) {
  if (p.level == null) continue;
  const c = h.toWorld(p), key = Math.round(c.x) + ',' + Math.round(c.z);
  if (seen.has(key)) continue;
  seen.add(key);
  const rnd = worldStream(s.seed || 'EVERGREEN', 'world', 'waterworks', s.biome || '', key);
  // Where play comes from, in the hole's frame.
  const zc = Math.max(0, Math.min(h.length, p.z)), nearGreen = Math.hypot(p.x - h.green.x, p.z - h.green.z) < Math.max(p.rx, p.rz) + 45;
  const target = nearGreen ? h.green : {x: h.center(zc), z: zc};
  const tx = target.x - p.x, tz = target.z - p.z, tl = Math.hypot(tx, tz) || 1;
  if (edge) {
   let run = 0, last = null;
   const step = edge === 'bulkhead' ? .25 : .12;
   for (let a = 0; a < Math.PI * 2; a += step / Math.max(p.rx, p.rz)) {
    const e = ovalRadius(p, a), l = Math.hypot(e.x, e.z) || 1;
    if ((e.x * tx + e.z * tz) / (l * tl) < FACING) { last = null; run = 0; continue; }
    const q = {x: p.x + e.x, z: p.z + e.z};
    if (last) run += Math.hypot(q.x - last.x, q.z - last.z);
    else run = edge === 'bulkhead' ? TIE_RUN : STONE_GAP;
    last = q;
    const gap = edge === 'bulkhead' ? TIE_RUN : STONE_GAP;
    if (run < gap) continue;
    run = 0;
    const w = h.toWorld(q), out2 = h.toWorld({x: q.x + e.x / l, z: q.z + e.z / l});
    // The outward normal, in the world. A section's face (+x in its model)
    // turns to the water: a turn of `rot` about the vertical carries +x to
    // (cos rot, -sin rot), which is -normal at rot = atan2(nz, -nx).
    const nx = out2.x - w.x, nz = out2.z - w.z;
    const ground = surface(w.x, w.z);
    if (ground === 'green' || ground === 'tee' || ground === 'sand' || ground === 'path') continue;
    if (edge === 'bulkhead') {
     out.push({kind: 'bulkhead', x: w.x, z: w.z, y: p.level - .4, rot: Math.atan2(nz, -nx), size: 1});
    } else {
     // A stone on the waterline, and a smaller one behind every other.
     out.push({kind: 'riprap', x: w.x, z: w.z, y: p.level - .12, rot: rnd() * Math.PI * 2, size: .9 + rnd() * .55, variant: Math.floor(rnd() * 3)});
     if (rnd() < .5) out.push({kind: 'riprap', x: w.x + nx * .55, z: w.z + nz * .55, y: p.level + .05, rot: rnd() * Math.PI * 2, size: .55 + rnd() * .35, variant: Math.floor(rnd() * 3)});
    }
   }
  }
  // A fountain in a big open pond, at its middle if that is water.
  if (look.fountain && fountains < 2 && Math.PI * p.rx * p.rz > 700 && surface(c.x, c.z) === 'water') {
   out.push({kind: 'fountain', x: c.x, z: c.z, y: p.level, rot: rnd() * Math.PI * 2, size: 1});
   fountains++;
  }
 }
 return out;
}
