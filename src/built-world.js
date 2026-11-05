// A WORLD FROM A BUILT COURSE (the course builder, stage 1;
// docs/COURSE_BUILDER.md, *The game: a world from a file*).
//
// `worldFromDoc` returns the object `generateWorld` returns -- the contract
// the renderer, the ball, the maps and the round all read -- from a built
// document (course-doc.js) instead of a seed. Nothing is generated: the land
// is the stored grid, every surface is the stored outlines, the holes are the
// stored records, the trees the stored list. So a built course plays the same
// whatever the generator does; only BUILT_VERSION moves it.
//
// THE SURFACES ARE ONE BAKED FIELD, read by the ground shader and by
// `surface` from the same bytes (the rule PROJECT_HANDOFF *THE SURFACE FIELD*
// and *BLOWOUTS ARE ONE BAKED FIELD* keep: paint and lie cannot disagree).
// Eight channels in two RGBA textures, each a signed distance to that
// surface's edge, as surface-field.js stores sand: 0.5 on the edge, above
// inside, FIELD_RANGE metres either side. The texel is as fine as the course's
// size allows (BUILT_FIELD). The order a point asks them in is `builtSurface`'s,
// and ground.js asks the same.
//
// THE HOLES are the game's hole object, in its own frame (routing.js
// placeHole: origin on the back tee, +z towards the green), with a centre
// line from the stored line and widths measured off the fairway outlines, so
// everything that reads a hole's skeleton -- cameras, aiming, the caddie,
// plays like, the maps' framing, scoring -- works unchanged. Their parametric
// shapes are empty (no bunkers, no ponds in the hazard slots) and the ground
// shader paints them from the field instead (the BUILT_COURSE branch).
//
// Pure: no DOM, no three; tested in Node (tests/built-world.test.mjs).
import {makeGroundGrid, groundHeight} from './terrain-grid.js';
import {biomeOf} from './biomes.js';
import {placeHole} from './routing.js';
import {DEFAULT_COURSE} from './settings-schema.js';
import {TREE_STRIDE, TREE_ROLES, CREEK_FIELDS} from './course-doc.js';
import {streamIndex} from './streams.js';
import {GROUND_PLANTS, TREE_SIZE, tallHeight, crownRadius} from './species.js';
import {GROUND_KINDS} from './grounds.js';
import {TEE_COLORS, rng} from './course-plan.js';
import {choosePin} from './course.js';

export const YARD = .9144;
// The field: the finest texel a course can have, and the widest side a
// texture may be (weak graphics cards stop at 4096; half that keeps two of
// them at 16 MB). PLACED: half a metre draws a 2.4 m path and a pot bunker's
// lip cleanly; an 18 of 2 x 1.7 km gets about one metre.
export const BUILT_FIELD = {range: 6, maxSide: 2048, minCell: .5};
// THE TWO TEXTURES. The first holds four turf channels (R sand, G green, B
// fairway, A tee); the second water (R), semi-rough (G), and the ground types
// as ONE layer: B the type's code (BUILT_GROUND_CODE: ground.js's own
// GROUND_CODE, and 10 for a cart path; never blended: the point takes the type
// with the most weight among the four texels round it, builtGroundAt) and A the signed distance to the edge of whichever
// type that is. One layer rather than a channel each because a landscape
// lays several types side by side across most of its ground (Desert's hardpan
// floor round its rock) and there are not channels or samplers for ten.
// ground.js reads them by these positions.
export const BUILT_CHANNELS = ['sand', 'green', 'fairway', 'tee', 'water', 'semi', 'groundCode', 'ground'];
// The ground types' codes in the field: ground.js GROUND_CODE (which
// groundPaint draws; tests/built-world.test.mjs holds the two the same), and
// a cart path, which a generated course draws as its own strips instead, and
// a road or parking lot (roads.js; the US landscapes goal, phase 4).
export const BUILT_GROUND_CODE = {rock: 1, coral: 2, scree: 3, hardpan: 4, waste: 5, pinestraw: 6, litter: 7, heather: 8, native: 9, path: 10, road: 11};
const GROUND_OF_CODE = Object.fromEntries(Object.entries(BUILT_GROUND_CODE).map(([k, c]) => [c, k]));
export const GRID_MARGIN = 150;
// How far the coarse ground mesh may miss the stored land in a cell before
// the cell is refined (PLACED: 6 cm, a little over a ball's diameter).
export const REFINE_ERROR = .06;

// ---------------------------------------------------------------- the land
export function gridSampler(g) {
 const {x0, z0, cell, nx, nz, heights} = g, cellZ = g.cellZ ?? cell;
 return (x, z) => {
  const u = Math.min(nx - 1, Math.max(0, (x - x0) / cell)), v = Math.min(nz - 1, Math.max(0, (z - z0) / cellZ));
  const i = Math.min(nx - 2, Math.floor(u)), j = Math.min(nz - 2, Math.floor(v)), fu = u - i, fv = v - j, k = j * nx + i;
  const a = heights[k] + (heights[k + 1] - heights[k]) * fu, b = heights[k + nx] + (heights[k + nx + 1] - heights[k + nx]) * fu;
  return a + (b - a) * fv;
 };
}
// Metres over which a green's or tee's finer patch fades into the land round
// it, so its edge is never a step. PLACED.
export const PATCH_BLEND = 1.5;
export function landSampler(doc) {
 const base = gridSampler(doc.land);
 const patches = (doc.patches || []).map(p => ({x0: p.x0, z0: p.z0, x1: p.x0 + (p.nx - 1) * p.cell, z1: p.z0 + (p.nz - 1) * (p.cellZ ?? p.cell), at: gridSampler(p)}));
 return (x, z) => {
  let h = base(x, z);
  for (const p of patches) {
   if (x <= p.x0 || x >= p.x1 || z <= p.z0 || z >= p.z1) continue;
   const edge = Math.min(x - p.x0, p.x1 - x, z - p.z0, p.z1 - z), w = Math.min(1, edge / PATCH_BLEND), s = w * w * (3 - 2 * w);
   h += (p.at(x, z) - h) * s;
  }
  return h;
 };
}

// ------------------------------------------------------------ the outlines
// Signed distance from a point to a polygon (rings, even-odd), negative
// inside: exact, any distance -- for the rules that ask further than the
// field reaches (a pin's room from the edge).
// EACH GREEN ON ITS OWN (BUILT_VERSION 2, 1 November 2026). A file stores a
// surface as sets of rings, and door 2 and the editor write ALL of a kind's
// rings as one set -- so a hole's "green" was every green on the course: its
// size the area of eighteen, and its cup cut wherever the search reached
// (Worthington's hole 3 on the practice green 50 m off, holed out never).
// Split here: each outer ring with the rings inside it (its islands).
export function greenParts(polys) {
 const out = [];
 for (const p of polys) {
  const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };
  const depth = r => p.filter(o => o !== r && inside(o, r[0][0], r[0][1])).length;
  for (const r of p) if (depth(r) % 2 === 0) out.push([r, ...p.filter(o => o !== r && depth(o) % 2 === 1 && inside(r, o[0][0], o[0][1]))]);
 }
 return out;
}

export function polygonDistance(poly, x, z) {
 let d = Infinity, inside = false;
 for (const ring of poly) {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
   const [ax, az] = ring[j], [bx, bz] = ring[i];
   if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) inside = !inside;
   const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
   d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
 }
 return inside ? -d : d;
}
export const polygonArea = poly => poly.reduce((s, ring, r) => {
 let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
 return s + (r === 0 ? 1 : -1) * Math.abs(a) / 2;
}, 0);

// The field's size for ground running `ex`, `ez` either side of the centre.
export function fieldSize(ex, ez) {
 const cell = Math.max(BUILT_FIELD.minCell, 2 * Math.max(ex, ez) / BUILT_FIELD.maxSide);
 return {Sx: Math.ceil(2 * ex / cell), Sz: Math.ceil(2 * ez / cell), cell};
}
const byteOf = d => Math.round(Math.max(0, Math.min(1, .5 - d / (2 * BUILT_FIELD.range))) * 255);

// One layer: the signed distance in metres to the union of `polys`, per
// texel, clamped to the field's range.
function bakeDistance(polys, Sx, Sz, ex, ez) {
 const R = BUILT_FIELD.range, dist = new Float32Array(Sx * Sz).fill(R), inside = new Uint8Array(Sx * Sz);
 const sx = Sx / (2 * ex), sz = Sz / (2 * ez);
 const ti = x => (x + ex) * sx - .5, tj = z => (z + ez) * sz - .5;
 const cx = i => ((i + .5) / sx) - ex, cz = j => ((j + .5) / sz) - ez;
 for (const poly of polys) {
  // Inside, by scanline: each texel row's centre crossings, filled in pairs.
  let zmin = Infinity, zmax = -Infinity;
  for (const ring of poly) for (const [, z] of ring) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
  const j0 = Math.max(0, Math.ceil(tj(zmin))), j1 = Math.min(Sz - 1, Math.floor(tj(zmax)));
  for (let j = j0; j <= j1; j++) {
   const z = cz(j), xs = [];
   for (const ring of poly) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [ax, az] = ring[b], [bx, bz] = ring[a];
    if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax));
   }
   xs.sort((p, q) => p - q);
   for (let k = 0; k + 1 < xs.length; k += 2) {
    const i0 = Math.max(0, Math.ceil(ti(xs[k]))), i1 = Math.min(Sx - 1, Math.floor(ti(xs[k + 1])));
    for (let i = i0; i <= i1; i++) inside[j * Sx + i] = 1;
   }
  }
  // The distance to the nearest edge, stamped segment by segment over the
  // texels within the field's range of it.
  for (const ring of poly) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
   const [ax, az] = ring[b], [bx, bz] = ring[a], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
   const i0 = Math.max(0, Math.floor(ti(Math.min(ax, bx) - R))), i1 = Math.min(Sx - 1, Math.ceil(ti(Math.max(ax, bx) + R)));
   const j0b = Math.max(0, Math.floor(tj(Math.min(az, bz) - R))), j1b = Math.min(Sz - 1, Math.ceil(tj(Math.max(az, bz) + R)));
   for (let j = j0b; j <= j1b; j++) {
    const z = cz(j);
    for (let i = i0; i <= i1; i++) {
     const x = cx(i), t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
     const d = Math.hypot(x - ax - dx * t, z - az - dz * t), k = j * Sx + i;
     if (d < dist[k]) dist[k] = d;
    }
   }
  }
 }
 for (let k = 0; k < dist.length; k++) if (inside[k]) dist[k] = -dist[k];
 return dist;
}

// The two textures' bytes for a document's outlines over ground running `ex`,
// `ez` either side of the centre: {Sx, Sz, ex, ez, cell, a, b}, RGBA each,
// BUILT_CHANNELS in order. Water is the stored bodies' outlines. Where two
// ground types meet, a texel takes the one it is deeper inside.
export function bakeBuiltField(doc, ex, ez) {
 const {Sx, Sz, cell} = fieldSize(ex, ez), N = Sx * Sz;
 const turf = ['sand', 'green', 'fairway', 'tee'].map(k => bakeDistance(doc.surfaces?.[k] || [], Sx, Sz, ex, ez));
 const water = bakeDistance((doc.water || []).map(w => w.rings), Sx, Sz, ex, ez);
 const semi = bakeDistance(doc.surfaces?.semi || [], Sx, Sz, ex, ez);
 const code = new Uint8Array(N), best = new Float32Array(N).fill(BUILT_FIELD.range);
 for (const kind of GROUND_KINDS) {
  const polys = doc.surfaces?.[kind] || [];
  if (!polys.length || !BUILT_GROUND_CODE[kind]) continue;
  const d = bakeDistance(polys, Sx, Sz, ex, ez);
  for (let k = 0; k < N; k++) if (d[k] < best[k]) { best[k] = d[k]; code[k] = BUILT_GROUND_CODE[kind]; }
 }
 const a = new Uint8Array(N * 4), b = new Uint8Array(N * 4);
 for (let k = 0; k < N; k++) {
  for (let c = 0; c < 4; c++) a[k * 4 + c] = byteOf(turf[c][k]);
  b[k * 4] = byteOf(water[k]); b[k * 4 + 1] = byteOf(semi[k]); b[k * 4 + 2] = best[k] < BUILT_FIELD.range ? code[k] : 0; b[k * 4 + 3] = byteOf(best[k]);
 }
 return {Sx, Sz, ex, ez, cell, a, b};
}

// One channel read the way a linear texture filter reads it (surface-field.js
// fieldAt), as a signed distance in metres (negative inside).
export function builtFieldAt(field, x, z, channel) {
 const {Sx, Sz, ex, ez} = field, data = channel < 4 ? field.a : field.b, c = channel & 3;
 const u = (x / ex + 1) * .5 * Sx - .5, v = (z / ez + 1) * .5 * Sz - .5;
 const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 const at = (p, q) => data[(Math.min(Sz - 1, Math.max(0, q)) * Sx + Math.min(Sx - 1, Math.max(0, p))) * 4 + c];
 const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu, bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
 return (.5 - (top + (bottom - top) * fv) / 255) * 2 * BUILT_FIELD.range;
}
// The ground type a point is in, or null: of the four texels round it, the
// type with the most weight as a linear filter would weigh them (ground.js does
// the same, in the same order, so paint and lie agree). The texel it fell in
// made a metre-wide staircase wherever two types met, which Skin from the land
// makes everywhere (seen on Chambers Bay, 3 November 2026).
export function builtGroundAt(field, x, z) {
 const {Sx, Sz, ex, ez, b} = field, u = (x / ex + 1) * .5 * Sx - .5, v = (z / ez + 1) * .5 * Sz - .5;
 const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 const at = (p, q) => b[(Math.min(Sz - 1, Math.max(0, q)) * Sx + Math.min(Sx - 1, Math.max(0, p))) * 4 + 2];
 const codes = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)], weigh = [(1 - fu) * (1 - fv), fu * (1 - fv), (1 - fu) * fv, fu * fv];
 let code = 0, best = 0;
 for (let k = 0; k < 4; k++) {
  if (!codes[k]) continue;
  let s = 0;
  for (let n = 0; n < 4; n++) if (codes[n] === codes[k]) s += weigh[n];
  if (s > best) { best = s; code = codes[k]; }
 }
 return GROUND_OF_CODE[code] ?? null;
}
const CH = Object.fromEntries(BUILT_CHANNELS.map((k, i) => [k, i]));
// What a ball lies on, from the field. The order is the paint's (ground.js,
// the built branch) and the generator's own: water, sand, the green and its
// fringe, a tee, a cart path (it crosses fairway and semi-rough), fairway,
// semi-rough, any other ground type, rough. `fringe` is the fringe width.
export function builtSurface(field, x, z, fringe = DEFAULT_COURSE.fringe) {
 if (Math.abs(x) >= field.ex || Math.abs(z) >= field.ez) return 'rough';
 if (builtFieldAt(field, x, z, CH.water) <= 0) return 'water';
 if (builtFieldAt(field, x, z, CH.sand) <= 0) return 'sand';
 const g = builtFieldAt(field, x, z, CH.green);
 if (g <= 0) return 'green';
 if (g <= fringe) return 'fringe';
 if (builtFieldAt(field, x, z, CH.tee) <= 0) return 'tee';
 const ground = builtFieldAt(field, x, z, CH.ground) <= 0 ? builtGroundAt(field, x, z) : null;
 if (ground === 'path') return 'path';
 if (builtFieldAt(field, x, z, CH.fairway) <= 0) return 'fairway';
 if (builtFieldAt(field, x, z, CH.semi) <= 0) return 'semi';
 return ground || 'rough';
}

// --------------------------------------------------------------- the houses
// A stored house (course-doc.js `homes`: where it stands, which way it faces,
// its footprint) as the generator's own (homes.js generateHomes): standing on
// its highest corner with a footing down to its lowest, and its form, roof,
// porch, garage, fence, garden and colours drawn from a hash of where it
// stands, so the same file always builds the same street. The forms are
// homes.js's FORMS.
const HOME_FORMS = ['gable', 'hip', 'saltbox', 'lshape'];
export function builtHomes(doc, height, nearest) {
 return (doc.homes || []).map(h => {
  let q = (Math.round(h.x * 10) * 73856093 ^ Math.round(h.z * 10) * 19349663) >>> 0 || 1;
  const rng = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
  const c = Math.cos(h.rotation), sn = Math.sin(h.rotation);
  const levels = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const lx = a * h.width / 2, lz = b * h.depth / 2; return height(h.x + lx * c + lz * sn, h.z - lx * sn + lz * c); });
  const base = Math.max(...levels);
  return {x: h.x, z: h.z, y: base, footing: base - Math.min(...levels) + .45, rotation: h.rotation, width: h.width, depth: h.depth, height: 7 + rng() * 4, shade: rng(),
   hole: nearest(h.x, h.z)?.h.hole ?? 0, form: HOME_FORMS[Math.floor(rng() * HOME_FORMS.length)], porch: rng() < .55, garage: rng() < .5, fence: rng() < .45, garden: rng() < .7,
   roofPitch: .8 + rng() * .9, trim: rng(), wing: .42 + rng() * .22, built: true};
 });
}

// --------------------------------------------------------------- the trees
// WHERE A BUILT COURSE'S GROUND IS (the owner, 4 November 2026: "the clouds are
// INSIDE the ground on the bully pulpit course ... Maybe has something to do
// with course elevation?"). A generated course is built round height 0, and the
// game's clouds, haze, snow line and treeline were written for that. A survey
// stands at its real height: Bully Pulpit about 700 m, Breckenridge 2,830 m,
// where the 640 m clouds lay 2 km underground and a mountain landscape's ground
// was all snow. This is the height those measure from: the land's middle, or
// higher where the land rises so far above its middle that clouds would touch
// it (PLACED: 450 m under the top, as clouds' undersides start about 120 m below
// their level). Drawing only: no ball meets it, so no `BUILT_VERSION`.
export function skyBaseOf(heights) {
 const every = Math.max(1, Math.floor(heights.length / 40000)), list = [];
 for (let k = 0; k < heights.length; k += every) list.push(heights[k]);
 list.sort((a, b) => a - b);
 return Math.max(list[list.length >> 1], list.at(-1) - 450);
}
// A STONE PAINTED IN THE EDITOR (builder/cover.js; course-doc.js `rocks`) as
// the generator records one (course.js), so it draws and stops a ball the same
// way: `size` across, a shade less deep than wide and two-thirds as tall as
// that (PLACED, the middle of the generator's own proportions).
export function rockFrom([x, z, size, shape, turn], y) {
 const scale = size * .32, sx = size / 2, sy = size * .3, sz = size * .4, top = y + scale * .25 + sy;
 return {x, z, y, scale, shape, rot: [.5, turn, .5], sx, sy, sz, top, reach: Math.max(sx, sz)};
}
// Which of the landscape's species draws a stored tree: by its role, in the
// shares the landscape plants them, hashed from where it stands so the same
// file always draws the same wood. Drawing only: a tree's trunk and crown are
// stored and play the same in every landscape.
//
// A SURVEY SEES A SHAPE, NOT A SPECIES (the owner, 5 November 2026, of TPC
// Summerlin on Desert Palms: "There isn't a single palm tree in here"). A
// LIDAR tree's role is only conifer when narrow for its height and broadleaf
// otherwise (real-course.js `docFromLand`), and those two lists used to leave
// palms out, so no surveyed tree could ever draw as one: its 19,016 trees came
// out a third each smoke tree, desert willow and tamarisk, and 228 Aleppo
// pines. Nor does a wide reading mean a broadleaf: Sahalee, a fir forest, reads
// 25% narrow and Bully Pulpit 1.6% on a landscape 75% conifer. So only a narrow
// reading tells a pine from an oak at all, and a survey tree stored as narrow is
// not treated as one (`drawnSpecies`). 'broadleaf' takes anything tall the
// landscape grows, 'conifer' a conifer or a palm and 'palm' a palm: those two
// are for a tree picked by name and moved to a landscape that lacks its species,
// where the role is true. And the pick follows the landscape's shares rather
// than giving each species an even turn, so a wood is planted in the mix the
// landscape's generated courses have.
//
// WHAT A SURVEY DOES MEASURE IS HEIGHT, and a model is scaled to a tree's height
// with its own proportions kept, so a smoke tree standing 15 m is a bush the size
// of a house (`fitsHeight`; RESEARCH, *A survey sees a shape, not a species*).
export const CONIFERS = new Set(['pine', 'cedar', 'spruce', 'fir', 'hemlock', 'redcedar', 'redwood', 'youngredwood', 'lodgepole', 'bluespruce', 'whitepine', 'balsamfir', 'longleafpine', 'loblollypine', 'slashpine', 'baldcypress', 'ashejuniper', 'rmjuniper', 'aleppopine', 'afghanpine', 'alligatorjuniper', 'montereycypress', 'montereypine', 'torreypine', 'ponderosa', 'sugarpine', 'incensecedar', 'redfir', 'noblefir', 'westernlarch', 'westernjuniper', 'utahjuniper', 'pinyonpine', 'easternredcedar', 'shortleafpine', 'pitchpine', 'redpine', 'jackpine', 'tamarack', 'blackspruce', 'sitkaspruce', 'shorepine', 'cookpine']);
// Flowers are never a stored shrub (the Heartland pack: its shrubs drew as
// prairie flowers).
const FLOWERS = new Set(['columbine', 'lupine', 'prairieforbs', 'douglasiris']);
export const PALMS = new Set(['palm', 'hala', 'royalpalm', 'travelerspalm', 'cabbagepalm', 'fanpalm', 'datepalm']);
// The species in `list` a tree of height `h` can be: none it would tower over by
// more than a quarter of the species' tallest, and none under half its shortest
// (PLACED, both). The two ends differ on purpose. A tree too tall for its model
// is the wrong that shows (the generator's own stands reach a fifth over the
// listed top), and a young tree of any species is a real thing, as the
// generator's own 5.5 m saplings are:
// holding the low end to a quarter too let whichever species had the lowest
// floor take the wood, blue spruce going from 6% to 48% of Breckenridge. A tree
// short for all of them is any of them, in their shares; one too tall for all of
// them is the tallest.
const TALLER_THAN_TOP = 1.25, SHORTER_THAN_LOW = .5;
function fitsHeight(bio, list, h) {
 const low = p => tallHeight(bio, p[0], 0, p[2] ?? 1), top = p => tallHeight(bio, p[0], 1, p[2] ?? 1);
 const roomy = list.filter(p => h <= top(p) * TALLER_THAN_TOP);
 if (!roomy.length) { const tallest = Math.max(...list.map(top)); return list.filter(p => top(p) === tallest); }
 const fit = roomy.filter(p => h >= low(p) * SHORTER_THAN_LOW);
 return fit.length ? fit : roomy;
}
// `allow`: the species a course's `treePlan` asks for, or null for all of them; a
// stand's own species counts, at an even share. `h` null: no height to fit.
export function speciesFor(bio, role, h, x, z, allow = null) {
 const plain = bio.plants.filter(p => !GROUND_PLANTS.has(p[0]));
 const asked = allow?.map(k => bio.plants.find(p => p[0] === k) ?? bio.stands?.plants?.find(p => p[0] === k)).filter(p => p && !GROUND_PLANTS.has(p[0]));
 const tall = asked?.length ? asked : plain;
 const small = bio.plants.filter(p => GROUND_PLANTS.has(p[0]) && !FLOWERS.has(p[0]));
 const u = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
 const pick = list => {
  let at = u * list.reduce((sum, p) => sum + p[1], 0);
  for (const p of list) if ((at -= p[1]) < 0) return p[0];
  return list[list.length - 1][0];
 };
 if (role === 'shrub') return small.length ? pick(small) : 'shrub';
 const want = role === 'conifer' ? tall.filter(p => CONIFERS.has(p[0]) || PALMS.has(p[0])) : role === 'palm' ? tall.filter(p => PALMS.has(p[0])) : tall;
 const list = want.length ? want : tall.length ? tall : [['oak', 1]];
 return pick(h == null ? list : fitsHeight(bio, list, h));
}
// The species a stored tree draws as, the game's and the 3D editor's one
// answer: the stored species while the course wears the landscape it was grown
// in (a stand's understory, bracken, is not in the landscape's plant list but
// is its own), or wherever this landscape grows that species too, in its plant
// list or its stands (a tree picked by name, builder/cover.js); else by role,
// where a tree with no species of its own stored as a conifer is a survey's
// narrow reading, which says nothing (above), so it is any tall tree.
const ownSpecies = (bio, stored, sameLandscape) => !!stored && (sameLandscape || bio.plants.some(p => p[0] === stored) || bio.stands?.plants?.some(p => p[0] === stored));
export const drawnSpecies = (bio, stored, sameLandscape, role, h, x, z, allow = null) =>
 ownSpecies(bio, stored, sameLandscape) ? stored : speciesFor(bio, role === 'conifer' && !stored ? 'tree' : role, h, x, z, allow);
export const TREE_HAND = 32;
// WHAT A STORED TREE IS IN THE WORLD, the game's and the 3D editor's one answer,
// under the course's `treePlan` (the owner, 5 November 2026; builder/tree-plan.js).
// A tree with a species of its own, one placed or sized by hand, and a bush stay
// as stored. Any other takes its species from those the plan asks for, and with
// `sizes` 'landscape' its place and nothing else from the survey: the height for
// its species, hashed from where it stands so it is the same every time, and the
// crown and trunk that go with that. Nothing stored changes, so it can go back.
export function treeAt(bio, plan, sameLandscape, stored, role, h, crown, trunk, x, z) {
 const r = TREE_ROLES[role & 7] || 'tree', allow = plan?.species ?? null;
 const kept = ownSpecies(bio, stored, sameLandscape) || role & TREE_HAND || r === 'shrub' || plan?.sizes !== 'landscape';
 if (kept) return {kind: drawnSpecies(bio, stored, sameLandscape, r, h, x, z, allow), h, crown, trunk};
 const kind = speciesFor(bio, r === 'palm' ? r : 'tree', null, x, z, allow), plant = bio.plants.find(p => p[0] === kind) ?? bio.stands?.plants?.find(p => p[0] === kind);
 const u = k => { const v = Math.sin(x * 7.13 + z * 3.71 + k * 11.3) * 24634.6345; return v - Math.floor(v); }, size = TREE_SIZE[kind];
 const th = tallHeight(bio, kind, u(1), plant?.[2] ?? 1);
 return {kind, h: th, crown: crownRadius({kind, h: th, r: size ? size[2] + u(2) * (size[3] - size[2]) : th * .2}), trunk: Math.max(.14, Math.min(3.6, th * .027))};
}

// ---------------------------------------------------------------- the holes
const lerpLine = (pts, z) => {
 if (z <= pts[0].z) return pts[0].x;
 for (let i = 1; i < pts.length; i++) if (z <= pts[i].z) { const a = pts[i - 1], b = pts[i], t = (z - a.z) / (b.z - a.z || 1); return a.x + (b.x - a.x) * t; }
 return pts[pts.length - 1].x;
};
// A BUILT HOLE'S PLAYING LINE AND YARDS, as the game measures them (the
// builder's scorecard asks this too, so the card it shows is the card the
// game plays; the owner, 1 November 2026: "We need to add a scorecard section
// to the holes step"). The frame: the back tee (the tee farthest from the
// green) at the origin, +z towards the green, placeHole's turn. The line runs
// from the back tee through each bend to the green; a bend no farther on than
// the one before, or within a metre of the green, is skipped (`skipped`) --
// the centre must be a function of the distance down the hole. The three tee
// sets, blue, white and red, are the tees by distance, farthest first, spread
// over the three (one tee plays all three; two make white and red the
// nearer). A tee's yards are along the line from where it stands across it.
export function builtLine(rec) {
 const tees = [...rec.tees].sort((a, b) => Math.hypot(b.x - rec.green.x, b.z - rec.green.z) - Math.hypot(a.x - rec.green.x, a.z - rec.green.z));
 const back = tees[0], dir = Math.atan2(rec.green.x - back.x, rec.green.z - back.z), c = Math.cos(dir), sn = Math.sin(dir);
 const local = p => { const x = (p[0] ?? p.x) - back.x, z = (p[1] ?? p.z) - back.z; return {x: x * c - z * sn, z: x * sn + z * c}; };
 const green = local(rec.green), length = Math.max(20, green.z);
 const pts = [{x: 0, z: 0}]; let skipped = 0;
 for (const p of (rec.line ?? []).slice(1, -1).map(local)) { if (p.z > pts[pts.length - 1].z + 1 && p.z < length - 1) pts.push(p); else skipped++; }
 pts.push({x: green.x, z: length});
 const center = z => lerpLine(pts, z);
 const yardsFrom = t => { const z0 = Math.max(0, local(t).z); let d = 0, prev = {x: center(z0), z: z0}; for (let z = z0 + 1; z <= length; z += 1) { const q = {x: center(z), z}; d += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; } return d / YARD; };
 const names = Object.keys(TEE_COLORS);
 const sets = names.map((name, i) => tees[Math.min(tees.length - 1, Math.round(i * (tees.length - 1) / Math.max(1, names.length - 1)))]);
 return {tees, back, dir, local, green, length, pts, center, skipped, names, sets, yards: Object.fromEntries(names.map((name, i) => [name, yardsFrom(sets[i])]))};
}
// A built hole: the game's hole contract (range.js buildRange keeps the
// shortest list of it) from a stored record, measured against the field.
export function builtHole(rec, index, s, bio, field, greenPolys) {
 const line = builtLine(rec), {back, dir} = line;
 const h = {built: true, hole: index, number: rec.number, par: rec.par, index: rec.index, settings: s, bio, seed: s.seed,
  ponds: [], bunkers: [], collections: [], trees: [], phase: 0, doglegAngle: 0, greenWave2: 0, greenWave3: 0, greenWave5: 0, greenAspect: 1, greenTurn: 0};
 // placeHole reads the pin, green, tee and centre to cache their world
 // places; they are set for real below and the caches written again.
 Object.assign(h, {pin: {x: 0, z: 0}, tee: {x: 0, z: 0}, length: 0, center: () => 0});
 placeHole(h, {x: back.x, z: back.z}, dir);
 // The line in the hole's frame, kept running forward (builtLine): a bend
 // that turned back on itself would make the centre a function of nothing.
 const {local, green, length, center} = line;
 // The fairway's half-widths, measured off the field every 4 m along the
 // line out to 70 m each side; zero where there is no fairway (a par 3).
 const STEP = 4, n = Math.ceil(length / STEP) + 1, left = new Float32Array(n), right = new Float32Array(n);
 const fairway = (x, z) => { const w = h.toWorld({x, z}); return builtFieldAt(field, w.x, w.z, CH.fairway) <= 0; };
 for (let k = 0; k < n; k++) {
  const z = Math.min(length, k * STEP), c = center(z);
  for (const [arr, side] of [[left, -1], [right, 1]]) {
   let w = 0;
   if (fairway(c, z)) { while (w < 70 && fairway(c + side * (w + 1), z)) w += 1; }
   arr[k] = w;
  }
 }
 const widthAt = arr => z => { const u = Math.max(0, Math.min(n - 1, z / STEP)), i = Math.min(n - 2, Math.floor(u)), t = u - i; return n < 2 ? arr[0] : arr[i] + (arr[i + 1] - arr[i]) * t; };
 const leftWidth = widthAt(left), rightWidth = widthAt(right);
 let mowStart = length; for (let k = 0; k < n; k++) if (left[k] + right[k] > 0) { mowStart = k * STEP; break; }
 const gw = h.toWorld(green);
 const gpoly = greenPolys.find(p => polygonDistance(p, gw.x, gw.z) <= 0) || greenPolys.reduce((best, p) => !best || polygonDistance(p, gw.x, gw.z) < polygonDistance(best, gw.x, gw.z) ? p : best, null);
 const greenSize = gpoly ? Math.max(4, Math.sqrt(Math.abs(polygonArea(gpoly)) / Math.PI)) : 12;
 // Each tee set's yards along the playing line, as course-plan.js measures them.
 h.tees = Object.fromEntries(line.names.map((name, i) => { const q = local(line.sets[i]); return [name, {x: q.x, z: q.z, yards: line.yards[name]}]; }));
 Object.assign(h, {length, routeLength: length, yards: h.tees.blue.yards, center, width: z => Math.max(leftWidth(z), rightWidth(z)), leftWidth, rightWidth,
  fairwayStart: mowStart, mowStart, turnFraction: .5, greenSize, tee: {x: 0, z: 0}, green: {x: green.x, z: green.z}, pin: {x: green.x, z: green.z},
  bounds: {x: 80, minZ: -40, maxZ: length + 50}});
 // A green's distance is the outline's, exact (course.js greenDistance asks
 // a built hole this), so a pin's room from the edge is measured past the
 // field's reach. Local coordinates in, metres out, negative on the green.
 h.greenPoly = gpoly;
 h.greenDist = (x, z) => { const w = h.toWorld({x, z}); return gpoly ? polygonDistance(gpoly, w.x, w.z) : Math.hypot(x - green.x, z - green.z) - greenSize; };
 h.worldPin = h.toWorld(h.pin); h.worldGreen = h.toWorld(h.green); h.worldTee = h.toWorld(h.tee); h.cell = h.toWorld({x: center(length / 2), z: length / 2});
 return h;
}

// The stored channels as streams.js's object: {streams, segments, at}.
export function builtStreams(creeks) {
 const index = streamIndex(), streams = [];
 creeks.forEach((c, n) => {
  const points = c.points.map(q => Object.fromEntries(CREEK_FIELDS.map((k, i) => [k, q[i]])));
  const width = Math.max(...points.map(p => p.width));
  streams.push({kind: c.kind, points, end: null, sink: null});
  index.add(points, c.kind, n + 1, width);
 });
 return {streams, segments: index.segments, at: index.at};
}

// THE CUPS, CUT FOR A ROUND (stage 2). A built course stores no pins: the
// round's seed (Round.pinSeed, `settings.builtPins`) cuts every hole's cup by
// the same rule a generated course's are cut (course.js choosePin: the hole's
// band, front, middle or back; the pin day's slope and room from the edge),
// read off the stored green and its ground.
export function placeBuiltPins(world, seed) {
 world.holes.forEach((h, i) => {
  h.pin = choosePin(h, i, rng(`${seed}-pin-${i}`));
  h.worldPin = h.toWorld(h.pin);
 });
 world.pinSeed = seed;
}

// --------------------------------------------------------------- the world
// `settings`: the round's settings (biome forced to the document's landscape;
// fringe and semi-rough from the document). Returns the generator's contract.
export function worldFromDoc(doc, settings = {}) {
 const bio0 = biomeOf(doc.landscape);
 const bio = {...bio0, sea: !!doc.sea, inlandWater: true};
 const s = {...DEFAULT_COURSE, ...settings, biome: doc.landscape, holes: doc.holes.length, built: settings.built ?? null,
  fringe: doc.fringe ?? DEFAULT_COURSE.fringe, semiRough: doc.semiRough ?? DEFAULT_COURSE.semiRough, seed: settings.seed ?? `built:${doc.name}`};
 const halfX = doc.halfX, halfZ = doc.halfZ, ex = halfX + GRID_MARGIN, ez = halfZ + GRID_MARGIN;
 const field = bakeBuiltField(doc, ex, ez);
 const sample = landSampler(doc);
 const greenPolys = greenParts(doc.surfaces.green || []);
 const holes = [...doc.holes].sort((a, b) => a.number - b.number).map((rec, i) => builtHole(rec, i, s, bio, field, greenPolys));
 // Finer ground where the ball rolls and where edges meet: greens, tees,
 // sand and water within 3 m, as the generator refines its own.
 const near = (x, z, c) => Math.abs(builtFieldAt(field, x, z, c)) < 3 || builtFieldAt(field, x, z, c) < 0;
 const refine = (x, z) => Math.abs(x) < ex && Math.abs(z) < ez && (near(x, z, CH.green) || near(x, z, CH.tee) || near(x, z, CH.sand) || Math.abs(builtFieldAt(field, x, z, CH.water)) < 3);
 // Creeks and rivers: the generator's own channel lookup over the stored
 // stations, so the lie, the ground shader's banks and the drawn water are
 // the generator's (streams.js, the owner atlas's stream channel).
 const streams = builtStreams(doc.creeks || []);
 // AND WHEREVER THE COARSE MESH WOULD MISS THE LAND: a cell whose middle
 // stands more than REFINE_ERROR off the plane of its corners is refined, so
 // a hill shaped by hand (or real ground from LIDAR) is what the ball meets.
 // The generator refines by feature, because its land is smooth between them;
 // a built course's land need not be. (The first shaped hill, 9 m tall over
 // 12 m, played 0.41 m low on its top without this.) NOT on land frozen from
 // the generator outside what was shaped: there the stored land IS the
 // generator's coarse triangles, and refining a cell across a crag's crease
 // swapped those triangles for a smoother surface less like them (a frozen
 // Mountain's 99th percentile went from 1.1 cm to 14.5).
 const shaped = doc.source?.kind === 'generated' ? (x, z) => (doc.landEdits || []).some(([x0, x1, z0, z1]) => x >= x0 - 3 && x <= x1 + 3 && z >= z0 - 3 && z <= z1 + 3) : () => true;
 const refineAll = (x, z, a, b, c, d) => refine(x, z) || (streams.at(x, z)?.edge ?? 99) < 3
  || (a !== undefined && shaped(x, z) && Math.abs(sample(x, z) - (a + b + c + d) / 4) > REFINE_ERROR);
 const groundGrid = makeGroundGrid(sample, ex, ez, 3, refineAll);
 const height = (x, z) => groundHeight(groundGrid, x, z, sample);
 const seaLevel = doc.sea?.level ?? -Infinity;
 const surface = (x, z) => {
  if (height(x, z) < seaLevel) return 'water';
  if ((streams.at(x, z)?.edge ?? 1) <= 0) return 'water';
  return builtSurface(field, x, z, s.fringe);
 };
 // The nearest hole and the point in its frame, and how far outside its
 // corridor (signed, negative inside), as course.js `nearest` answers.
 const nearest = (x, z) => {
  let best = null;
  for (const h of holes) {
   const p = h.toLocal({x, z}), zc = Math.max(0, Math.min(h.length, p.z)), off = Math.abs(p.x - h.center(zc)) + Math.max(0, -p.z, p.z - h.length);
   const d = off - Math.max(h.leftWidth(zc), h.rightWidth(zc), 12);
   if (!best || d < best.d) best = {h, p, d};
  }
  return best;
 };
 const trees = [], sameLandscape = doc.from?.settings?.biome === doc.landscape;
 for (let k = 0; k < doc.trees.length; k += TREE_STRIDE) {
  const [x, z, th, crown, trunk, role, ki] = doc.trees.subarray(k, k + TREE_STRIDE);
  const shown = treeAt(bio, doc.treePlan, sameLandscape, doc.treeKinds?.[ki], role, th, crown, trunk, x, z), {kind} = shown;
  trees.push({x, z, y: height(x, z), h: shown.h, r: shown.crown, radius: shown.trunk, shade: (Math.sin(x * 3.1 + z * 7.7) * .5 + .5), kind, hole: nearest(x, z).h.hole, built: true,
   ...(role & 8 ? {stand: true} : {}), ...(role & 16 ? {under: true} : {})});
 }
 const homes = builtHomes(doc, height, nearest);
 const world = {built: true, doc, builtField: field, teeSites: [], lakeOwner: () => null, largeLakes: [], homes, buildings: [], life: [], walls: [], wallBoxes: [],
  storyProps: [], mounds: [], earthworks: [], waterworks: [], rocks: (doc.rocks || []).map(q => rockFrom(q, height(q[0], q[1]))), props: [], paths: [], bridges: [], markers: [], wear: [], streams,
  footprint: null, groundGrid, groundCover: (x, z) => { const g = builtFieldAt(field, x, z, CH.ground) <= 0 ? builtGroundAt(field, x, z) : null; return g === 'pinestraw' || g === 'litter' ? 'straw' : bio.cover; }, straw: [], blowouts: null, wild: null, fallenField: null, surfaceField: null, landform: null,
  settings: s, bio, holes, halfX, halfZ, waterLevel: doc.sea?.level ?? 0, skyBase: skyBaseOf(doc.land.heights), height, surface, trees, nearby: (x, z) => nearest(x, z).h, nearest,
  land: height, seed: s.seed, ecology: bio.plants.map(([kind]) => kind),
  builtWater: (doc.water || []).map(w => ({rings: w.rings, level: w.level, kind: w.kind})),
  builtOutlines: doc.surfaces};
 for (const h of holes) {
  h.world = world;
  h.height = (x, z) => { const p = h.toWorld({x, z}); return height(p.x, p.z); };
  h.surface = (x, z) => { const p = h.toWorld({x, z}); return surface(p.x, p.z); };
  h.trees = trees.filter(t => t.hole === h.hole).map(t => ({...t, ...h.toLocal(t)}));
 }
 if (s.builtPins) placeBuiltPins(world, s.builtPins);
 return world;
}
