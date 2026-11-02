// THE LAND'S STORY (architect-courses, phase 6; the study, workstream L;
// docs/ARCHITECT_COURSES.md, *Phase 6*): what the land held before the
// course, left where the architect found it.
//
//   walls       dry-stone field walls (Links, Autumn, Mountain), hedgerows
//               (Midwest, PNW); a leaning wall is a kind any landscape may ask
//               for (Haunted Hollow's moor had it until 2 November 2026)
//   buildings   a farmstead -- barn, silo, windpump (Midwest, Autumn); a
//               roofless chapel or cottage (Links, Lakeshore, Desert, PNW,
//               Redwood), a mine head (Mountain), a sugar-mill tower (Island)
//   landmarks   a lighthouse (Links, Lakeshore) or a church spire (Autumn)
//               beyond the course on the line of a hole, to aim at
//   props       the Dell's white aiming stone on its dune (never graves: the
//               owner)
//
// How much by The land's story: none, a little, a lot. Everything stands
// out of play, beyond the semi-rough, off paths, water and the clubhouse,
// except what a template puts in play (the Dell's stone). Walls and buildings
// are SOLID: a wall is a run of boxes and a building a box in the houses' grid
// (physics.js), never out of bounds. Props are decoration. All sizes and
// counts PLACED. Every generated course (Architect's until it was removed,
// 2 November 2026). Pure: tests/story.test.mjs.
import {worldStream} from './world-stream.js';
import {WORLD} from './biomes.js';

// Each landscape's remains. Sizes are footprints in metres (width across
// the front, depth, height to the ridge or top); the models
// (tools/blender/architect_story.py) are drawn to them.
export const STORY_PIECES = {
 barn: {model: 'Barn', width: 11, depth: 15, height: 10},
 silo: {model: 'Silo', width: 5, depth: 5, height: 15},
 windpump: {model: 'Windpump', width: 3.2, depth: 3.2, height: 11},
 chapel: {model: 'RuinChapel', width: 8, depth: 13, height: 8},
 cottage: {model: 'RuinCottage', width: 8, depth: 5.5, height: 5.5},
 minehead: {model: 'MineHead', width: 7, depth: 7, height: 13},
 sugarmill: {model: 'SugarMill', width: 7, depth: 7, height: 10},
 lighthouse: {model: 'Lighthouse', width: 6, depth: 6, height: 22},
 church: {model: 'Church', width: 9, depth: 16, height: 24},
};
// Each landscape's story is its architect block's (biomes.js).
export const STORY_SET = Object.fromEntries(Object.entries(WORLD).map(([k, a]) => [k, a.story]));
const AMOUNT = {none: 0, some: 1, lots: 2};
// Out of play: this far outside a hole's corridor (its raw half width) at least.
const CLEAR_WALL = 14, CLEAR_BUILDING = 38;
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path']);

export function placeStory({holes, s, surface, nearest, height, halfX, halfZ, buildings = [], blocked = () => false, earthworks = [], paths = []}) {
 const out = {walls: [], buildings: [], props: [], clearings: []};
 const amount = AMOUNT.some;
 const set = STORY_SET[s.biome] || {};
 const rnd = worldStream(s.seed || 'EVERGREEN', 'world', 'story', s.biome || '');
 // The Dell's aiming stone is the hole's, whatever the story.
 for (const e of earthworks) if (e.aim) {
  const mx = (e.ax + e.bx) / 2, mz = (e.az + e.bz) / 2;
  out.props.push({kind: 'aimstone', x: mx, z: mz, rot: rnd() * Math.PI, size: 1});
 }
 if (!amount) return out;
 const taken = [...buildings];
 const inBox = (b, x, z, pad) => { const cs = Math.cos(b.rotation), sn = Math.sin(b.rotation), dx = x - b.x, dz = z - b.z; return Math.abs(dx * cs - dz * sn) <= b.width / 2 + pad && Math.abs(dx * sn + dz * cs) <= b.depth / 2 + pad; };
 const free = (x, z, pad) => !taken.some(b => inBox(b, x, z, pad)) && !out.walls.some(w => segDist(w, x, z) < pad);
 // A site for a footprint: out of play, on open ground, near level, not in
 // front of a tee, nothing built there. Seen from play is better: a site
 // between 45 and 130 m from the nearest corridor scores best.
 const site = (piece, near = null) => {
  let best = null;
  for (let i = 0; i < 260; i++) {
   const x = near ? near.x + (rnd() - .5) * 40 : (rnd() * 2 - 1) * halfX * .95, z = near ? near.z + (rnd() - .5) * 40 : (rnd() * 2 - 1) * halfZ * .95;
   const n = nearest(x, z), d = n?.d ?? 999;
   if (d < CLEAR_BUILDING) continue;
   const rot = near ? near.rot : rnd() * Math.PI * 2, r = Math.hypot(piece.width, piece.depth) / 2;
   if (PLAYED.has(surface(x, z)) || !free(x, z, r + 8) || blocked(x, z, r)) continue;
   let lo = Infinity, hi = -Infinity, wet = false;
   for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = x + u * piece.width / 2, pz = z + v * piece.depth / 2, y = height(px, pz);
    lo = Math.min(lo, y); hi = Math.max(hi, y); if (PLAYED.has(surface(px, pz))) wet = true;
   }
   if (wet || hi - lo > 2.6) continue;
   const score = (d < 45 ? 0 : d < 130 ? 1 : .5) - (hi - lo) * .1 + rnd() * .3;
   if (!best || score > best.score) best = {x, z, rot, lo, hi, score};
   if (best.score > 1.1) break;
  }
  return best;
 };
 const build = (kind, at) => {
  const p = STORY_PIECES[kind], b = {kind, model: p.model, club: true, story: true, x: at.x, z: at.z, y: at.lo, base: at.lo, rotation: at.rot, width: p.width, depth: p.depth, height: p.height};
  out.buildings.push(b); taken.push(b); return b;
 };
 // The farmstead: a barn, its silo beside it, the windpump in the yard.
 if (set.farm) {
  const barn = site(STORY_PIECES.barn);
  if (barn) {
   const b = build('barn', barn), cs = Math.cos(b.rotation), sn = Math.sin(b.rotation);
   const off = (lx, lz) => ({x: b.x + lx * cs + lz * sn, z: b.z - lx * sn + lz * cs, rot: b.rotation});
   for (const [kind, lx, lz] of [['silo', b.width / 2 + 4.5, 2], ['windpump', -b.width / 2 - 9, -6]]) {
    if (kind === 'windpump' && amount < 2) continue;
    const at = off(lx, lz), y = height(at.x, at.z);
    if (!PLAYED.has(surface(at.x, at.z)) && (nearest(at.x, at.z)?.d ?? 999) > CLEAR_WALL) build(kind, {...at, lo: y});
   }
  }
 }
 // Ruins: one a little, two a lot.
 const ruins = set.ruins || [];
 for (let i = 0; i < Math.min(ruins.length, amount); i++) { const at = site(STORY_PIECES[ruins[i]]); if (at) build(ruins[i], at); }
 // A landmark, a lot of story only: beyond a green, on its hole's line, out
 // past the course, so the hole is played toward it.
 if (set.landmark && amount >= 2) {
  const order = holes.map((h, i) => i).sort(() => rnd() - .5);
  for (const i of order) {
   const h = holes[i], g = h.toWorld({x: h.center(h.length), z: h.length}), t = h.toWorld({x: h.center(h.length - 30), z: h.length - 30});
   const dx = g.x - t.x, dz = g.z - t.z, l = Math.hypot(dx, dz) || 1;
   let placed = false;
   // Iteration 4: 220 m out it was a speck from the fairway.
   for (const k of [150, 180, 130, 210]) {
    const x = g.x + dx / l * k, z = g.z + dz / l * k;
    if ((nearest(x, z)?.d ?? 999) < 60 || PLAYED.has(surface(x, z)) || !free(x, z, 14)) continue;
    // Seated on the lowest ground under it (iteration 5: on a dune it
    // floated over the slope), and only where its top half shows over the
    // land from 120 m short of the green (a dune hid the first one).
    const piece = STORY_PIECES[set.landmark], r = piece.width / 2 + .5;
    let y = Infinity;
    for (let k = 0; k < 8; k++) y = Math.min(y, height(x + Math.cos(k * Math.PI / 4) * r, z + Math.sin(k * Math.PI / 4) * r));
    const eye = h.toWorld({x: h.center(Math.max(0, h.length - 120)), z: Math.max(0, h.length - 120)}), ey = height(eye.x, eye.z) + 1.7, top = y - .4 + piece.height * .5;
    let seen = true;
    for (let u = .04; u < .97 && seen; u += .03) if (height(eye.x + (x - eye.x) * u, eye.z + (z - eye.z) * u) > ey + (top - ey) * u) seen = false;
    if (!seen) continue;
    build(set.landmark, {x, z, rot: Math.atan2(dx, dz), lo: y - .4}).hole = h.hole;
    placed = true; break;
   }
   if (placed) break;
  }
 }
 // Walls: runs across the open ground between holes, broken wherever they
 // would reach play, a path, water or a building. Three lines a little, six a
 // lot; a run under 8 m is dropped.
 if (set.walls) {
  for (let line = 0; line < amount * 3; line++) {
   let x = (rnd() * 2 - 1) * halfX * .9, z = (rnd() * 2 - 1) * halfZ * .9, a = rnd() * Math.PI * 2;
   const len = 50 + rnd() * 110;
   let run = null;
   const close = () => { if (run && Math.hypot(run.bx - run.ax, run.bz - run.az) >= 8) out.walls.push(run); run = null; };
   // Straight runs, each checked every metre (a run that drifted could
   // cross a creek narrower than its step), turning a little between runs.
   for (let d = 0; d < len; d += 1) {
    const nx = x + Math.sin(a), nz = z + Math.cos(a);
    const ok = (nearest(nx, nz)?.d ?? 999) > CLEAR_WALL && !PLAYED.has(surface(nx, nz)) && !taken.some(b => inBox(b, nx, nz, 6)) && Math.abs(nx) < halfX + 100 && Math.abs(nz) < halfZ + 100;
    // A run starts at the first point that passes, not the one before it.
    if (ok) { if (!run) run = {kind: set.walls, ax: nx, az: nz, bx: nx, bz: nz}; else { run.bx = nx; run.bz = nz; } }
    else close();
    // A wall runs straight; a new section starts where it turns.
    if (run && Math.hypot(run.bx - run.ax, run.bz - run.az) > 30) { close(); a += (rnd() - .5) * .5; }
    x = nx; z = nz;
   }
   close();
  }
 }
 return out;
}

// The distance from (x, z) to a wall's segment.
export function segDist(w, x, z) {
 const dx = w.bx - w.ax, dz = w.bz - w.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / l2));
 return Math.hypot(x - w.ax - dx * t, z - w.az - dz * t);
}
// A wall as the boxes physics stops a ball against: one per segment, 0.7 m
// thick, its height by kind (a hedge stands taller).
export const WALL_HEIGHT = {stone: 1.1, leaning: 1.2, hedge: 1.6};
export function wallBoxes(walls, height) {
 return walls.map(w => {
  const x = (w.ax + w.bx) / 2, z = (w.az + w.bz) / 2, len = Math.hypot(w.bx - w.ax, w.bz - w.az);
  const y = Math.min(height(w.ax, w.az), height(w.bx, w.bz), height(x, z)) - .2;
  return {kind: 'wall', club: true, x, z, y, width: .7, depth: len, height: (WALL_HEIGHT[w.kind] ?? 1.1) + .2, rotation: Math.atan2(w.bx - w.ax, w.bz - w.az)};
 });
}
