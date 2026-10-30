// TOURNAMENT WEEK (architect-courses, phase 7; the study, workstream Q;
// docs/ARCHITECT_COURSES.md, *Phase 7*). A Championship venue is dressed for
// its event, and the pin day says which day of it this is:
//
//   grandstands  behind and beside the last green, and beside the signature
//                par three (one with water, else the first)
//   scoreboard   by the last green; TV towers behind it and by the par three
//   marquees     hospitality, three beside the clubhouse
//   ropes        gallery ropes down both sides of the last two holes, from
//                the landing zone to the green
//   crowd        behind the ropes and in the stands, filling through the
//                week: about a third on Thursday, packed on Sunday
//
// The stands, the scoreboard, the towers and the marquees are SOLID boxes in
// `world.buildings` (physics.js's houses' routine), never out of bounds: a
// ball that reaches one bounces off and is played from where it ends -- the
// study's ruling (relief from a temporary immovable obstruction) is not
// built. The ropes and the crowd are decoration; the crowd is not drawn on
// Low. Only on a Championship venue (the goal); every size PLACED. Pure:
// tests/occasion.test.mjs.
import {archStream} from './architect-styles.js';

export const OCCASION_PIECES = {
 stand: {model: 'Grandstand_1', width: 20, depth: 9, height: 8.6},
 scoreboard: {model: 'Scoreboard_1', width: 12, depth: 2, height: 7.6},
 tower: {model: 'TVTower_1', width: 4, depth: 4, height: 12},
 marquee: {model: 'Marquee_1', width: 10, depth: 10, height: 5.5},
};
// The crowd's share of its places, by the pin day.
export const CROWD_BY_DAY = {Thursday: .35, Friday: .5, Saturday: .75, Sunday: 1};
// The stand's rows, in its own frame (front, toward play, at local -z): six
// rows 1.5 m deep from 4.5 m in front of its middle, 1.2 m up and 0.9 m a row
// (tools/blender/architect_occasion.py ROWS).
export const STAND_ROWS = Array.from({length: 6}, (_, i) => ({z: -4.5 + i * 1.5 + .55, y: 1.2 + i * .9}));
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path']);

export function placeOccasion({holes, s, surface, nearest, height, buildings = []}) {
 const out = {buildings: [], ropes: [], crowd: []};
 if (s.archClub !== 'championship' || !holes.length) return out;
 const rnd = archStream(s.seed || 'EVERGREEN', 'arch', 'occasion', s.biome || '');
 const day = CROWD_BY_DAY[s.pinDay] ?? CROWD_BY_DAY.Thursday;
 const taken = [...buildings];
 const inBox = (b, x, z, pad) => { const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = x - b.x, dz = z - b.z; return Math.abs(dx * cs - dz * sn) <= b.width / 2 + pad && Math.abs(dx * sn + dz * cs) <= b.depth / 2 + pad; };
 // A footprint facing a point: its front (local -z) toward it. Clear when no
 // corner or middle is on a played surface, a path or water, nothing is built
 // there, and the ground under it falls under 3 m.
 const put = (kind, x, z, toward) => {
  const p = OCCASION_PIECES[kind], rot = Math.atan2(-(toward.x - x), -(toward.z - z));
  const cs = Math.cos(rot), sn = Math.sin(rot), at = (lx, lz) => ({x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs});
  const pts = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([u, v]) => at(u * p.width / 2, v * p.depth / 2));
  if (pts.some(q => PLAYED.has(surface(q.x, q.z))) || taken.some(b => pts.some(q => inBox(b, q.x, q.z, 3)))) return null;
  const ys = pts.map(q => height(q.x, q.z)), lo = Math.min(...ys);
  if (Math.max(...ys) - lo > 3) return null;
  const b = {kind, model: p.model, club: true, occasion: true, x, z, y: lo - .2, base: lo - .2, rotation: rot, width: p.width, depth: p.depth, height: p.height};
  out.buildings.push(b); taken.push(b); return b;
 };
 // Round a green: try out along a bearing, stepping back until clear.
 const round = (kind, h, bearing, from) => {
  const g = h.worldGreen ?? h.toWorld(h.green), base = (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + (s.fringe ?? 2) + (s.semiRough ?? 6) + OCCASION_PIECES[kind].depth / 2 + 8;
  for (let d = base + from; d < base + from + 60; d += 4) {
   const x = g.x + Math.sin(bearing) * d, z = g.z + Math.cos(bearing) * d, b = put(kind, x, z, g);
   if (b) return b;
  }
  return null;
 };
 const last = holes[holes.length - 1];
 const lineOf = h => { const g = h.toWorld(h.green), b = h.toWorld({x: h.center(h.length - 40), z: h.length - 40}); return Math.atan2(g.x - b.x, g.z - b.z); };
 // Behind the last green, then off each side of it.
 const play = lineOf(last);
 for (const [kind, off, from] of [['stand', 0, 0], ['stand', Math.PI / 2, 0], ['stand', -Math.PI / 2, 0], ['scoreboard', Math.PI * .3, 26], ['tower', Math.PI * .85, 20]]) {
  if (kind === 'stand' && out.buildings.filter(b => b.kind === 'stand').length >= 2) continue;
  round(kind, last, play + off, from);
 }
 // The signature par three: one with water, else the first.
 const threes = holes.filter(h => h.par === 3 && h !== last), sig = threes.find(h => h.ponds?.length) ?? threes[0];
 if (sig) {
  const p = lineOf(sig);
  round('stand', sig, p + (rnd() < .5 ? 1 : -1) * Math.PI / 2, 0) || round('stand', sig, p, 0);
  round('tower', sig, p + Math.PI * .75, 10);
 }
 // Hospitality beside the clubhouse.
 const club = buildings.find(b => b.kind === 'clubhouse');
 if (club) for (let k = 0, tries = 0; k < 3 && tries < 40; tries++) {
  const a = rnd() * Math.PI * 2, d = 35 + rnd() * 30, x = club.x + Math.sin(a) * d, z = club.z + Math.cos(a) * d;
  if (put('marquee', x, z, {x: club.x, z: club.z})) k++;
 }
 // Gallery ropes down the last two holes, landing zone to green, and the
 // crowd three metres behind them.
 for (const h of holes.slice(-2)) {
  const from = Math.max(h.fairwayStart ?? 40, (h.design?.zones?.average ?? h.length * .5) - 40), to = h.length - 10;
  for (const side of [-1, 1]) for (let z = from; z < to; z += 6) {
   const half = (side < 0 ? h.leftWidth(z) : h.rightWidth(z)) + (s.semiRough ?? 6) + 5;
   const c = h.center(z), p = h.toWorld({x: c + side * half, z: z + 3}), a = h.toWorld({x: h.center(z) + side * half, z}), b = h.toWorld({x: h.center(z + 6) + side * half, z: z + 6});
   if (PLAYED.has(surface(p.x, p.z)) || taken.some(o => inBox(o, p.x, p.z, 2))) continue;
   out.ropes.push({x: p.x, z: p.z, rot: Math.atan2(b.x - a.x, b.z - a.z)});
   // Iteration 4: five a section on Sunday (three read as a few strollers).
   const n = Math.round(day * 5 * (.6 + rnd() * .8));
   for (let i = 0; i < n; i++) {
    const back = 2.5 + rnd() * 3, along = (rnd() - .5) * 5.5, q = h.toWorld({x: c + side * (half + back), z: z + 3 + along});
    if (!PLAYED.has(surface(q.x, q.z))) { const f = h.toWorld({x: c, z: z + 3}); out.crowd.push({x: q.x, z: q.z, rot: 0, face: {x: f.x, z: f.z}}); }
   }
  }
 }
 // The stands' seats, filled by the day.
 for (const b of out.buildings.filter(o => o.kind === 'stand')) {
  const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation);
  for (const r of STAND_ROWS) for (let lx = -9.4; lx <= 9.4; lx += .9) {
   if (rnd() > day) continue;
   const x = b.x + lx * cs + r.z * sn, z = b.z - lx * sn + r.z * cs;
   out.crowd.push({x, z, y: b.y + .2 + r.y, rot: b.rotation + Math.PI, seated: true});
  }
 }
 // Every spectator on the ground faces the play it came to watch.
 for (const c of out.crowd) if (c.face) { c.rot = Math.atan2(c.face.x - c.x, c.face.z - c.z) + (rnd() - .5) * .5; delete c.face; }
 return out;
}
