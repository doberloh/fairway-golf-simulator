// A COURSE'S MARKINGS (architect-courses, phase 2; on every generated course
// since Architect was removed, 2 November 2026; the study,
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
// instanced. Every generated course. Pure: tests/markings.test.mjs.
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
    const w = side < 0 ? h.leftWidth(z) : h.rightWidth(z), q = h.toWorld({x: h.center(z) + side * (w + 2.5), z});
    if (dry(q.x, q.z)) out.push({kind: `post${yd}`, x: q.x, z: q.z, rot: h.rotation || 0});
   }
  }
  // A rake IN each bunker (the owner, 30 October 2026: "I'm a rakes go in
  // the bunker kind of person"): halfway in from the edge on the side away
  // from the green, laid across the sand, as a greenkeeper drops one where
  // the next player will find it. It was on the grass beside the sand.
  for (const b of h.bunkers) {
   if (b.lobe) continue;   // a complex has one rake, in its main bunker
   const g = h.green, dx = b.x - g.x, dz = b.z - g.z, l = Math.hypot(dx, dz) || 1, a = Math.atan2(dz / l, dx / l);
   const e = ovalRadius(b, a), r = Math.hypot(e.x, e.z) * .5;
   const q = h.toWorld({x: b.x + dx / l * r, z: b.z + dz / l * r});
   if (surface(q.x, q.z) === 'sand') out.push({kind: 'rake', x: q.x, z: q.z, rot: Math.atan2(dx / l, dz / l) + Math.PI / 2 + (h.rotation || 0)});
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

// WEAR (architect-courses, phase 3; the study, workstream N): divots where
// golf is played -- thickest on par-3 tees, where irons dig (USGA: a par 3's
// tee wants twice the area per round for that reason), a few on every back
// tee, and scattered where drives land (`landingZones`). Each is a small dark
// patch on the ground; decoration, it changes no lie. PLACED: the counts and
// sizes. (Architect wore a municipal course most and a new one least, by its
// club and age dials; since the designer went, 2 November 2026, every course
// is worn as its members' club of mature age was.)
import {GOLFER_TABLE} from './golfer-table.js';
const YD = .9144;
// Where drives come down: a good player's from the back tee, an average
// golfer's from the middle one, along the hole's line (moved here from
// architect.js with the designer's removal).
function alongLine(center, from, metres, length) {
 let d = 0, z = from;
 while (z < length && d < metres) { const next = Math.min(length, z + 1); d += Math.hypot(center(next) - center(z), next - z); z = next; }
 return z;
}
export function landingZones({center, length, tees}) {
 const T = GOLFER_TABLE;
 const good = Math.min(length - 95, alongLine(center, tees.blue?.z ?? 0, T.good.clubs.driver.total * YD, length));
 const average = Math.min(length - 110, alongLine(center, tees.white?.z ?? 0, T.average.clubs.driver.total * YD, length));
 return {good, average};
}
function stream(seed) { let a = 2166136261; for (const c of String(seed)) { a ^= c.charCodeAt(0); a = Math.imul(a, 16777619); } return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function placeWear({holes, s, surface}) {
 const out = [], k = 1;
 for (const h of holes) {
  const r = stream(`${s.seed}|world|wear|${s.biome}|${h.hole}`);
  // Each divot points where the shot went -- at the green (the owner's
  // review: they pointed all over the place). A divot is drawn long along its
  // own x, which a turn of `rot` carries to (cos rot, -sin rot); a few
  // degrees of spread, as real swings give.
  const g = h.toWorld(h.green);
  const put = (lx, lz, size) => { const p = h.toWorld({x: lx, z: lz}), sf = surface(p.x, p.z); if (sf === 'tee' || sf === 'fairway' || sf === 'semi') out.push({x: p.x, z: p.z, r: size, rot: Math.atan2(-(g.z - p.z), g.x - p.x) + (r() - .5) * .3}); };
  for (const [name, t] of Object.entries(h.tees)) {
   const n = Math.round((h.par === 3 ? 14 : name === 'blue' ? 5 : 3) * k);
   for (let i = 0; i < n; i++) put(t.x + (r() - .5) * 4.2, t.z + (r() - .5) * 5, .07 + r() * .05);
  }
  if (h.par > 3) {
   const z = landingZones(h);
   for (const zz of [z.good, z.average]) for (let i = 0, n = Math.round(9 * k); i < n; i++) {
    const at = zz + (r() - .5) * 45, half = Math.min(h.leftWidth(at), h.rightWidth(at)) * .7;
    put(h.center(at) + (r() - .5) * 2 * half, at, .08 + r() * .06);
   }
  }
 }
 return out;
}
