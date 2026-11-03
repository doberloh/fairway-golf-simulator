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
// shader paints them from the field instead (`builtOn`).
//
// Pure: no DOM, no three; tested in Node (tests/built-world.test.mjs).
import {makeGroundGrid, groundHeight} from './terrain-grid.js';
import {biomeOf} from './biomes.js';
import {placeHole} from './routing.js';
import {DEFAULT_COURSE} from './settings-schema.js';
import {TREE_STRIDE, TREE_ROLES, CREEK_FIELDS} from './course-doc.js';
import {streamIndex} from './streams.js';
import {GROUND_PLANTS} from './species.js';
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
// GROUND_CODE, and 10 for a cart path; read texel by texel, never blended) and A the signed distance to the edge of whichever
// type that is. One layer rather than a channel each because a landscape
// lays several types side by side across most of its ground (Desert's hardpan
// floor round its rock) and there are not channels or samplers for ten.
// ground.js reads them by these positions.
export const BUILT_CHANNELS = ['sand', 'green', 'fairway', 'tee', 'water', 'semi', 'groundCode', 'ground'];
// The ground types' codes in the field: ground.js GROUND_CODE (which
// groundPaint draws; tests/built-world.test.mjs holds the two the same), and
// a cart path, which a generated course draws as its own strips instead.
export const BUILT_GROUND_CODE = {rock: 1, coral: 2, scree: 3, hardpan: 4, waste: 5, pinestraw: 6, litter: 7, heather: 8, native: 9, path: 10};
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
// The ground type a point is in, by the texel it falls in (the shader's
// texelFetch), or null.
export function builtGroundAt(field, x, z) {
 const i = Math.min(field.Sx - 1, Math.max(0, Math.floor((x / field.ex + 1) * .5 * field.Sx)));
 const j = Math.min(field.Sz - 1, Math.max(0, Math.floor((z / field.ez + 1) * .5 * field.Sz)));
 const code = field.b[(j * field.Sx + i) * 4 + 2];
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
// Which of the landscape's species draws a stored tree: by its role, and by
// its height among the kinds that fit, hashed from where it stands so the
// same file always draws the same wood. Drawing only: a tree's trunk and
// crown are stored and play the same in every landscape.
const CONIFERS = new Set(['pine', 'cedar', 'spruce', 'fir', 'hemlock', 'redcedar', 'redwood', 'lodgepole', 'bluespruce', 'whitepine', 'balsamfir']);
// Flowers are never a stored shrub (the Heartland pack: its shrubs drew as
// prairie flowers).
const FLOWERS = new Set(['columbine', 'lupine', 'prairieforbs', 'douglasiris']);
const PALMS = new Set(['palm', 'hala', 'royalpalm', 'travelerspalm']);
export function speciesFor(bio, role, h, x, z) {
 const kinds = bio.plants.map(p => p[0]);
 const tall = kinds.filter(k => !GROUND_PLANTS.has(k));
 const small = kinds.filter(k => GROUND_PLANTS.has(k) && !FLOWERS.has(k));
 const pick = list => list[Math.abs(Math.floor(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)) % list.length];
 if (role === 'shrub') return small.length ? pick(small) : 'shrub';
 const want = role === 'conifer' ? tall.filter(k => CONIFERS.has(k)) : role === 'palm' ? tall.filter(k => PALMS.has(k))
  : role === 'broadleaf' ? tall.filter(k => !CONIFERS.has(k) && !PALMS.has(k)) : tall;
 const list = want.length ? want : tall.length ? tall : ['oak'];
 return pick(list);
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
  const stored = doc.treeKinds?.[ki], r = TREE_ROLES[role & 7] || 'tree';
  // The stored species while the course wears the landscape it was grown in
  // (a stand's understory, bracken, is not in the landscape's plant list but
  // is its own), or wherever this landscape grows that species too.
  const kind = stored && (sameLandscape || bio.plants.some(p => p[0] === stored)) ? stored : speciesFor(bio, r, th, x, z);
  trees.push({x, z, y: height(x, z), h: th, r: crown, radius: trunk, shade: (Math.sin(x * 3.1 + z * 7.7) * .5 + .5), kind, hole: nearest(x, z).h.hole, built: true,
   ...(role & 8 ? {stand: true} : {}), ...(role & 16 ? {under: true} : {})});
 }
 const homes = builtHomes(doc, height, nearest);
 const world = {built: true, doc, builtField: field, teeSites: [], lakeOwner: () => null, largeLakes: [], homes, buildings: [], life: [], walls: [], wallBoxes: [],
  storyProps: [], mounds: [], earthworks: [], waterworks: [], rocks: [], props: [], paths: [], bridges: [], markers: [], wear: [], streams,
  footprint: null, groundGrid, groundCover: (x, z) => { const g = builtFieldAt(field, x, z, CH.ground) <= 0 ? builtGroundAt(field, x, z) : null; return g === 'pinestraw' || g === 'litter' ? 'straw' : bio.cover; }, straw: [], blowouts: null, wild: null, fallenField: null, surfaceField: null, landform: null,
  settings: s, bio, holes, halfX, halfZ, waterLevel: doc.sea?.level ?? 0, height, surface, trees, nearby: (x, z) => nearest(x, z).h, nearest,
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
