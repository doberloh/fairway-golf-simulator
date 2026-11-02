// LIFE ON THE COURSE (architect-courses, phase 6; the study, workstream M;
// docs/ARCHITECT_COURSES.md, *Phase 6*): animals, cartoon and calm, and
// people far off.
//
//   grazers     sheep on Links; deer at the wood's edge (Midwest, Autumn, PNW,
//               Mountain); elk (Redwood, Mountain); a roadrunner (Desert)
//   water birds geese on the far bank of a pond; a heron by a pond or creek
//   fliers      gulls circling over Links, Lakeshore and Island; ravens over
//               nowhere else
//   people      a group of three walking a stretch of the cart path; a
//               greenkeeper on a ride-on mower in the rough between holes
//
// Everything stands or moves out of play: grazers 30 m outside every
// corridor, people on the path or in the rough well away from it, birds 25 m
// up. Decoration: nothing here is solid or changes a lie, and the study's
// rule -- never in the line of a shot -- holds by placement. Drawn and moved
// by renderer.js `addLife`, never on Low. All counts PLACED. Architect only;
// rendering only, so no version moves for it (the fingerprint reads ground).
// Pure: tests/life.test.mjs.
import {archStream} from './architect-styles.js';
import {ARCHITECT, biomeOf} from './biomes.js';
import {ovalRadius} from './course.js';

// Each landscape's animals are its architect block's (biomes.js).
export const LIFE_SET = Object.fromEntries(Object.entries(ARCHITECT).map(([k, a]) => [k, a.life]));
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path']);

export function placeLife({holes, s, surface, nearest, halfX, halfZ, paths = [], trees = []}) {
 const out = [], set = LIFE_SET[s.biome] || {};
 const rnd = archStream(s.seed || 'EVERGREEN', 'arch', 'life', s.biome || '');
 // Clear of trunks too (iteration 7: the mower was put in a wood). The trees
 // are planted by now; a coarse grid of them, built once.
 const cell = 8, grid = new Map();
 for (const t of trees) { const k = Math.floor(t.x / cell) + ',' + Math.floor(t.z / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); }
 const wooded = (x, z, r) => { const i = Math.floor(x / cell), j = Math.floor(z / cell); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const t of grid.get(a + ',' + b) || []) if (!t.under && Math.hypot(t.x - x, t.z - z) < r + (t.r || 2) * .6) return true; return false; };
 const open = (x, z, clear, room = 3) => !PLAYED.has(surface(x, z)) && (nearest(x, z)?.d ?? 999) > clear && !wooded(x, z, room);
 const spot = (clear, max = 300) => { for (let i = 0; i < max; i++) { const x = (rnd() * 2 - 1) * halfX * .9, z = (rnd() * 2 - 1) * halfZ * .9; if (open(x, z, clear) && (nearest(x, z)?.d ?? 999) < clear + 60) return {x, z}; } return null; };
 // Grazers: one herd or flock, round a spot 30 m outside play.
 if (set.grazers) {
  const [kind, n] = set.grazers, at = spot(30);
  if (at) for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
   const x = at.x + (rnd() - .5) * (kind === 'sheep' ? 26 : 18), z = at.z + (rnd() - .5) * (kind === 'sheep' ? 26 : 18);
   if (!open(x, z, 24)) continue;
   out.push({kind, x, z, rot: rnd() * Math.PI * 2, phase: rnd() * 10}); k++;
  }
 }
 // Water birds on a pond's far bank: the side away from play.
 const ponds = holes.flatMap(h => h.ponds.map(p => ({h, p})));
 const bank = (h, p, away = true) => {
  const zc = Math.max(0, Math.min(h.length, p.z)), tx = h.center(zc) - p.x, tz = zc - p.z, tl = Math.hypot(tx, tz) || 1;
  for (let i = 0; i < 40; i++) {
   const a = rnd() * Math.PI * 2, e = ovalRadius(p, a), l = Math.hypot(e.x, e.z) || 1;
   if (away && (e.x * tx + e.z * tz) / (l * tl) > -.3) continue;
   const k = 1 + (3 + rnd() * 4) / l, w = h.toWorld({x: p.x + e.x * k, z: p.z + e.z * k});
   const c = h.toWorld(p);
   if (!PLAYED.has(surface(w.x, w.z))) return {x: w.x, z: w.z, face: Math.atan2(c.x - w.x, c.z - w.z)};
  }
  return null;
 };
 if (set.geese && ponds.length) {
  const {h, p} = ponds[Math.floor(rnd() * ponds.length)];
  for (let k = 0; k < set.geese; k++) { const b = bank(h, p); if (b) out.push({kind: 'goose', x: b.x + (rnd() - .5) * 3, z: b.z + (rnd() - .5) * 3, rot: rnd() * Math.PI * 2, phase: rnd() * 10}); }
 }
 if (set.heron && ponds.length) {
  const {h, p} = ponds[Math.floor(rnd() * ponds.length)], b = bank(h, p);
  if (b) out.push({kind: 'heron', x: b.x, z: b.z, rot: b.face, phase: rnd() * 10});
 }
 // Fliers: circling 25-40 m up over the course.
 if (set.fliers) {
  const [kind, n] = set.fliers;
  for (let k = 0; k < n; k++) out.push({kind, x: (rnd() * 2 - 1) * halfX * .6, z: (rnd() * 2 - 1) * halfZ * .6, r: 30 + rnd() * 40, up: 25 + rnd() * 15, speed: (.12 + rnd() * .08) * (rnd() < .5 ? -1 : 1), phase: rnd() * Math.PI * 2});
 }
 // People: three walking one way along the longest piece of the path, from
 // its start to its end and round again (the owner: "no reason they would be
 // walking reverse"; out and back, they turned and walked home).
 const piece = paths.slice().sort((p, q) => q.points.length - p.points.length)[0];
 if (piece?.points.length > 6) {
  const line = piece.points.map(p => ({x: p.x, z: p.z})), w = piece.width ?? 2.5;
  // A fourball (the owner's review: four bodies to show, was three).
  for (let k = 0; k < 4; k++) out.push({kind: 'walker', line, loop: true, side: (k - 1.5) * Math.min(.8, w * .22), lag: k * .9, speed: 1.2, phase: rnd() * 30});
 }
 // A greenkeeper mowing the rough between holes, back and forth.
 // Iteration 7: tried at up to forty spots, each run clear of trees and of
 // play all along (one try left most wooded courses without one). The
 // owner's review, iteration 10: its whole run on mown rough -- it waded
 // through native prairie on Midwest and marram on Links -- and none on a
 // landscape whose rough all grows tall (`scatter.tallGrass`).
 const mown = (x, z) => surface(x, z) === 'rough';
 for (let k = 0; k < (biomeOf(s.biome).scatter?.tallGrass ? 0 : 80); k++) {
  const m = spot(28, 60), a = rnd() * Math.PI;
  if (m && Array.from({length: 11}, (_, i) => i / 10).every(u => { const x = m.x + Math.sin(a) * 30 * u, z = m.z + Math.cos(a) * 30 * u; return open(x, z, 24, 4) && mown(x, z); })) { out.push({kind: 'mower', ax: m.x, az: m.z, bx: m.x + Math.sin(a) * 30, bz: m.z + Math.cos(a) * 30, side: 0, lag: 0, speed: 1.8, phase: rnd() * 30}); break; }
 }
 return out;
}
