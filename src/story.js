// THE LAND'S STORY (architect-courses, phase 6; the study, workstream L;
// docs/ARCHITECT_COURSES.md, *Phase 6*): what the land held before the
// course, left where the architect found it.
//
//   walls       dry-stone field walls (Links, Autumn, Mountain), hedgerows
//               (Midwest, PNW), split-rail fences (Rockies, since the US
//               landscapes goal); a leaning wall is a kind any landscape may ask
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
import {worldOf} from './biomes.js';

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
 // Grand Haven's red pierhead light on its concrete pier end (tools/blender/
 // cartoon_drylake.py): Lake Dunes' landmark.
 // Drawn 24 m (the model's 17 at 1.4; spec 15-30, PLACED): at 17 it hid among
 // the dune woods' 20 m trees.
 pierlight: {model: 'PierLight_1', width: 8.4, depth: 16.8, height: 24},
 // The Heartland's red gambrel barn with its lean-to and silo, one model
 // (tools/blender/cartoon_heartland.py): its farmstead in place of barn and silo.
 redbarn: {model: 'RedBarn_1', width: 24, depth: 21, height: 18.4},
 church: {model: 'Church', width: 9, depth: 16, height: 24},
 // The plains pack's ranch landmarks (tools/blender/cartoon_plains.py), each
 // as wide and deep as its model is for its height (heights PLACED from the
 // pack's specs): a ranch windmill, a concrete grain elevator, an oil pump jack.
 windmill: {model: 'Windmill_1', width: 6.5, depth: 5.9, height: 10},
 grainelevator: {model: 'GrainElevator_1', width: 32.3, depth: 11, height: 30},
 pumpjack: {model: 'PumpJack_1', width: 7.7, depth: 2.8, height: 4.4},
 // Appalachia's log cabin with its fieldstone chimney (a ruin) and the
 // Bluegrass's black tobacco barn (a farm's barn); the Pine Barrens' Long
 // Island shingled windmill (a landmark). Heights PLACED from the packs'
 // specs, width and depth the models' own for them.
 stonecabin: {model: 'StoneCabin_1', width: 8.5, depth: 7, height: 6.1},
 tobaccobarn: {model: 'TobaccoBarn_1', width: 16.5, depth: 21.7, height: 11.5},
 shingledwindmill: {model: 'ShingledWindmill_1', width: 13.2, depth: 9.5, height: 14},
};
// Each landscape's story is its architect block's (biomes.js).
export const storySet = key => worldOf(key).story || {};
// Looked up by landscape through worldOf, never by the key in a table: the
// tables are the regions' (step 2 of the US landscapes goal moved them, and
// a lookup by landscape key found nothing for seven of the nine).
const AMOUNT = {none: 0, some: 1, lots: 2};
// Out of play: this far outside a hole's corridor (its raw half width) at least.
const CLEAR_WALL = 14, CLEAR_BUILDING = 38;
// The steepest ground a wall crosses: a 2 m section sits at the lower of its
// ends, so at 30% its high end is 0.6 m into the slope (PLACED).
const WALL_GRADE = .3;
const PLAYED = new Set(['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water', 'path']);

export function placeStory({holes, s, surface, nearest, height, halfX, halfZ, buildings = [], blocked = () => false, earthworks = [], paths = []}) {
 const out = {walls: [], buildings: [], props: [], clearings: []};
 const amount = AMOUNT.some;
 const set = storySet(s.biome);
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
 // The farmstead: a barn, its silo beside it, the windpump in the yard. A
 // landscape may name its own barn (`farm: 'redbarn'`, the Heartland's,
 // whose model carries its silo), and that one has corn behind it.
 if (set.farm) {
  const kindOfBarn = typeof set.farm === 'string' ? set.farm : 'barn', barn = site(STORY_PIECES[kindOfBarn]);
  if (barn) {
   const b = build(kindOfBarn, barn), cs = Math.cos(b.rotation), sn = Math.sin(b.rotation);
   const off = (lx, lz) => ({x: b.x + lx * cs + lz * sn, z: b.z - lx * sn + lz * cs, rot: b.rotation});
   // The corn: patches of the model's 5 by 6.4 m in four columns and three
   // rows behind the barn, each only on open, out-of-play, near-level ground
   // (field size PLACED).
   if (kindOfBarn === 'redbarn') {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) {
     const at = off((c - 1.5) * 5.4, b.depth / 2 + 10 + r * 6.8), n = nearest(at.x, at.z);
     const y = [[2.5, 3.2], [-2.5, -3.2], [2.5, -3.2], [-2.5, 3.2]].map(([u, v]) => height(at.x + u, at.z + v));
     if (PLAYED.has(surface(at.x, at.z)) || (n?.d ?? 999) < CLEAR_WALL || blocked(at.x, at.z, 4) || !free(at.x, at.z, 4) || Math.max(...y) - Math.min(...y) > 1.2) continue;
     out.props.push({kind: 'corn', x: at.x, z: at.z, rot: at.rot, size: 1});
     out.clearings.push({x: at.x, z: at.z, r: 5});
    }
   }
   // A shelterbelt (the plains pack): a row of trees across the back of the
   // farmstead, 40 m behind it, where all its length is open and out of play
   // (the model's 21 m at 12 m tall; PLACED).
   if (set.shelterbelt) {
    const at = off(0, b.depth / 2 + 40), ends = [-10, -5, 0, 5, 10].map(u => off(u, b.depth / 2 + 40));
    const fits = ends.every(p => !PLAYED.has(surface(p.x, p.z)) && (nearest(p.x, p.z)?.d ?? 999) >= CLEAR_WALL && !blocked(p.x, p.z, 4) && free(p.x, p.z, 4));
    if (fits) { out.props.push({kind: 'shelterbelt', x: at.x, z: at.z, rot: at.rot, size: 1}); out.clearings.push({x: at.x, z: at.z, r: 12}); }
   }
   for (const [kind, lx, lz] of [['silo', b.width / 2 + 4.5, 2], ['windpump', -b.width / 2 - 9, -6]]) {
    if (kind === 'silo' && kindOfBarn === 'redbarn') continue;
    if (kind === 'windpump' && amount < 2) continue;
    const at = off(lx, lz), y = height(at.x, at.z);
    if (!PLAYED.has(surface(at.x, at.z)) && (nearest(at.x, at.z)?.d ?? 999) > CLEAR_WALL) build(kind, {...at, lo: y});
   }
  }
 }
 // Ruins: one a little, two a lot.
 const ruins = set.ruins || [];
 for (let i = 0; i < Math.min(ruins.length, amount); i++) { const at = site(STORY_PIECES[ruins[i]]); if (at) build(ruins[i], at); }
 // A landmark: beyond a green, on its hole's line, out past the course, so
 // the hole is played toward it. (A lot of story only, until Architect went
 // and the story was fixed at some: from then no course had one, found 2
 // November 2026; every course with a landmark has one now.)
 if (set.landmark) {
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
    // A lane kept clear of trees from past the green to it, and a clearing
    // round it (the dry-and-lake pack, 2 November 2026: the land let it be
    // seen, the dune woods hid it). Lane width PLACED.
    for (let d = 30; d < k; d += 15) out.clearings.push({x: g.x + dx / l * d, z: g.z + dz / l * d, r: 12});
    out.clearings.push({x, z, r: piece.width + 10});
    placed = true; break;
   }
   if (placed) break;
  }
 }
 // Walls: runs across the open ground between holes, broken wherever they
 // would reach play, a path, water, a building, bare rock or ground steeper
 // than WALL_GRADE (the mountain pack, 2 November 2026: a fence ran up a
 // cliff, half its panels sunk in the slope). Three lines a little, six a
 // lot; a run under 8 m is dropped.
 if (set.walls) {
  const steep = (x, z) => Math.hypot(height(x + 1, z) - height(x - 1, z), height(x, z + 1) - height(x, z - 1)) / 2;
  for (let line = 0; line < amount * 3; line++) {
   let x = (rnd() * 2 - 1) * halfX * .9, z = (rnd() * 2 - 1) * halfZ * .9, a = rnd() * Math.PI * 2;
   const len = 50 + rnd() * 110;
   let run = null;
   const close = () => { if (run && Math.hypot(run.bx - run.ax, run.bz - run.az) >= 8) out.walls.push(run); run = null; };
   // Straight runs, each checked every metre (a run that drifted could
   // cross a creek narrower than its step), turning a little between runs.
   for (let d = 0; d < len; d += 1) {
    const nx = x + Math.sin(a), nz = z + Math.cos(a);
    const ok = (nearest(nx, nz)?.d ?? 999) > CLEAR_WALL && !PLAYED.has(surface(nx, nz)) && surface(nx, nz) !== 'rock' && steep(nx, nz) <= WALL_GRADE && !taken.some(b => inBox(b, nx, nz, 6)) && Math.abs(nx) < halfX + 100 && Math.abs(nz) < halfZ + 100;
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
export const WALL_HEIGHT = {stone: 1.1, leaning: 1.2, hedge: 1.6, rail: 1.1, field: 1.05,
 // The plains pack's barbed wire on cedar posts (PLACED).
 wire: 1.2,
 // The Bluegrass's black four-board horse fence (PLACED).
 board: 1.4};
// How wide a wall's solid box is. A split-rail fence (the US landscapes goal's
// mountain pack) zig-zags 30 degrees either side of its run, so its rails
// reach about 0.6 m out each way. PLACED.
export const WALL_WIDTH = {rail: 1.3};
export function wallBoxes(walls, height) {
 return walls.map(w => {
  const x = (w.ax + w.bx) / 2, z = (w.az + w.bz) / 2, len = Math.hypot(w.bx - w.ax, w.bz - w.az);
  const y = Math.min(height(w.ax, w.az), height(w.bx, w.bz), height(x, z)) - .2;
  return {kind: 'wall', club: true, x, z, y, width: WALL_WIDTH[w.kind] ?? .7, depth: len, height: (WALL_HEIGHT[w.kind] ?? 1.1) + .2, rotation: Math.atan2(w.bx - w.ax, w.bz - w.az)};
 });
}
