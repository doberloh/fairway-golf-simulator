// AN ARCHITECT COURSE'S MARKINGS (architect-courses, phase 2; the study,
// workstream I): what a club puts out on a course it looks after.
//
//   stakes      red stakes round every pond and along creeks near play, the
//               penalty areas' edge (every water body here is red: relief.js);
//               white stakes where the property's boundary -- out of bounds --
//               comes within sight of play
//   posts       yardage posts beside the fairway at 100, 150 and 200 yd from
//               the green's centre (red, white and blue), the commonest scheme
//   rakes       one rake on the grass beside each bunker, on its far side from
//               the green, lying along the bunker's edge
//
// Decoration: nothing here is solid or changes a lie (a real stake is a
// movable obstruction, and a ball rarely meets one). Placed in world
// coordinates, as `{kind, x, z, rot}`; renderer.js `addMarkings` draws them
// instanced. Architect only. Pure: tests/markings.test.mjs.
import {ovalRadius} from './course.js';

const YARD = .9144;
const STAKE_GAP = 11, BOUNDARY_GAP = 13, POST_YARDS = [100, 150, 200];

// The point on a hole's centre line `yards` from the green's centre, walked
// back down the line.
function backFromGreen(h, yards) {
 let d = 0, z = h.length;
 const want = yards * YARD;
 while (z > 0 && d < want) { const prev = Math.max(0, z - 1); d += Math.hypot(h.center(z) - h.center(prev), z - prev); z = prev; }
 return z;
}

export function placeMarkings({holes, surface, nearest, halfX, halfZ, streams}) {
 const out = [];
 const dry = (x, z) => { const s = surface(x, z); return s !== 'water' && s !== 'path' && s !== 'green' && s !== 'tee' && s !== 'sand'; };
 for (const h of holes) {
  // Round each pond, a stake every STAKE_GAP metres, 1.8 m outside the water.
  for (const p of h.ponds) {
   let run = 0, last = null;
   for (let k = 0; k < 160; k++) {
    const a = k / 160 * Math.PI * 2, e = ovalRadius(p, a), l = Math.hypot(e.x, e.z) || 1;
    const q = {x: p.x + e.x * (1 + 1.8 / l), z: p.z + e.z * (1 + 1.8 / l)};
    if (last) run += Math.hypot(q.x - last.x, q.z - last.z);
    last = q;
    if (run < STAKE_GAP) continue;
    run = 0;
    const w = h.toWorld(q);
    if (dry(w.x, w.z)) out.push({kind: 'stake', x: w.x, z: w.z, rot: a});
   }
  }
  // Yardage posts: both sides of a par 4 or 5, a couple of metres into the rough.
  if (h.par > 3) for (const yd of POST_YARDS) {
   const z = backFromGreen(h, yd);
   if (z < h.fairwayStart + 10) continue;
   for (const side of [1, -1]) {
    const w = side > 0 ? h.leftWidth(z) : h.rightWidth(z), q = h.toWorld({x: h.center(z) + side * (w + 2.5), z});
    if (dry(q.x, q.z)) out.push({kind: `post${yd}`, x: q.x, z: q.z, rot: h.rotation || 0});
   }
  }
  // A rake beside each bunker, on its far side from the green, lying along
  // the line out of the sand.
  for (const b of h.bunkers) {
   const g = h.green, dx = b.x - g.x, dz = b.z - g.z, l = Math.hypot(dx, dz) || 1, a = Math.atan2(dz / l, dx / l);
   const e = ovalRadius(b, a), r = Math.hypot(e.x, e.z) + 1.3;
   const q = h.toWorld({x: b.x + dx / l * r, z: b.z + dz / l * r});
   // Laid along the bunker's edge, as a greenkeeper leaves one (iteration 6:
   // pointing out of the sand it was seen end-on from play).
   if (dry(q.x, q.z)) out.push({kind: 'rake', x: q.x, z: q.z, rot: Math.atan2(dx / l, dz / l) + Math.PI / 2 + (h.rotation || 0)});
  }
 }
 // Creeks near play: red stakes on each bank, every STAKE_GAP * 1.4 m, only
 // within 60 m of a hole's corridor.
 for (const st of streams?.streams || []) {
  let run = 0;
  for (let i = 1; i < st.points.length; i++) {
   const a = st.points[i - 1], b = st.points[i];
   run += Math.hypot(b.x - a.x, b.z - a.z);
   if (run < STAKE_GAP * 1.4) continue;
   run = 0;
   if (nearest(b.x, b.z).d > 60) continue;
   const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, half = (b.width || 3) / 2 + 1.6;
   for (const s of [1, -1]) {
    const x = b.x - dz / l * half * s, z = b.z + dx / l * half * s;
    if (dry(x, z)) out.push({kind: 'stake', x, z, rot: Math.atan2(dx, dz)});
   }
  }
 }
 // The boundary: white stakes where the property's edge comes within 120 m
 // of a corridor.
 const edge = [];
 for (let x = -halfX; x <= halfX; x += BOUNDARY_GAP) edge.push({x, z: -halfZ + 1}, {x, z: halfZ - 1});
 for (let z = -halfZ; z <= halfZ; z += BOUNDARY_GAP) edge.push({x: -halfX + 1, z}, {x: halfX - 1, z});
 for (const q of edge) if (nearest(q.x, q.z).d < 120 && dry(q.x, q.z)) out.push({kind: 'obstake', x: q.x, z: q.z, rot: 0});
 return out;
}
