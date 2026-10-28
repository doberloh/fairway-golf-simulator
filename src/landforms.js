// EACH LANDSCAPE'S OWN COUNTRY BETWEEN THE HOLES (the cartoon overhaul, 25
// October 2026; docs/CARTOON_OVERHAUL.md, LANDSCAPE_RESEARCH *What lies
// between the holes*).
//
// Until the overhaul every landscape was one rolling function under three
// numbers (biomes.js `hills`), so a mountain was green hills and a desert the
// same hills painted tan. A biome now names a LANDFORM RECIPE, and the recipe
// adds two things on top of those hills:
//
//  RELIEF (`lift`): crags with stepped cliff bands on a mountainside, sandstone
//  mesas and dry washes in the desert, hummocky dunes on a links. Metres added
//  to the raw landform, which course.js `land` fades to nothing near the
//  playing corridors exactly as it fades the hills -- so the holes are never
//  touched, and the country rises between them.
//
//  GROUND (`raw`): two channels, A and B, of 0..1, each naming a ground type
//  (grounds.js) -- rock on the cliff faces and scree below them, a wash's
//  sand, marram on the dune faces -- plus an optional FLOOR, the type every
//  remaining rough becomes once far enough from the corridor (the desert's
//  hardpan). Baked once per course onto the ground atlas's own grid, as BYTES,
//  exactly as the Lakeshore blowouts are (blowouts.js): the ground shader reads
//  those bytes through the cover texture's linear filter (A in alpha, B in
//  blue) and `wildAt` here does the same arithmetic, so paint and lie read the
//  same numbers. Both then gate each channel by how far outside its hole's
//  corridor the point lies, and both switch the lie at exactly 0.5; the colour
//  alone fades softly across it (the owner: transitions need not be a line).
//
// PRIORITY: A, then B, then the floor. Only ground still rough at the end of
// the ordinary classification can take any of them (the beach, bunkers,
// water and every mown band decide first), and nothing within WILD_WATER of a
// pond, lake or creek (the shader's shore band would paint soil over it).
//
// Seeded from the course's seed with streams of its own: building a recipe
// draws nothing from any generator RNG, so nothing else on the course moves
// because of it -- the relief does move the ground, which is the point, and
// is why GENERATOR_VERSION went up with it.
//
// EVERY SHAPE AND NUMBER IN THE RECIPES IS PLACED (RESEARCH, *The overhaul's
// landforms*): the research says what lies between real holes, not how tall a
// cartoon mesa is. Pure: no three.js, no DOM.
import {ownerAtlasSize} from './owner-atlas.js';

// As BLOWOUT_WATER, and for the same reason.
export const WILD_WATER = 12;

// ---------------------------------------------------------------- noise
export function hash(i, j, salt) {
 let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ salt;
 h = Math.imul(h ^ (h >>> 13), 1274126177);
 return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);
function noise(x, z, salt) {
 const i = Math.floor(x), j = Math.floor(z), fx = fade(x - i), fz = fade(z - j);
 const a = hash(i, j, salt), b = hash(i + 1, j, salt), c = hash(i, j + 1, salt), d = hash(i + 1, j + 1, salt);
 return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm(x, z, salt, octaves = 3) {
 let sum = 0, amp = 1, norm = 0, f = 1;
 for (let o = 0; o < octaves; o++) { sum += amp * noise(x * f + o * 17.31, z * f - o * 9.73, salt + o * 7919); norm += amp; amp *= .5; f *= 2.03; }
 return sum / norm;
}
// Ridged: 1 on a crest line, falling away either side.
const ridged = (x, z, salt, octaves = 3) => { const r = 1 - Math.abs(2 * fbm(x, z, salt, octaves) - 1); return r * r; };
const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
export function saltOf(seed, what) {
 let h = 2166136261;
 for (const ch of String(seed) + ':landform:' + what) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
 return h | 0;
}
// A stepped profile: flat treads and steep risers, `steps` of them across
// 0..1. The riser is the last `riser` share of each step. Returns the height
// share and where in its step the point is (0 tread start, 1 riser top).
function terrace(t, steps, riser = .26) {
 const s = Math.max(0, Math.min(1, t)) * steps, k = Math.min(steps - 1, Math.floor(s)), f = s - k;
 return {h: (k + smooth(1 - riser, 1, f)) / steps, f};
}

// ---------------------------------------------------------------- recipes
//
// Each returns {lift, raw, treeKeep, needsHeight}. `lift(x, z)` metres;
// `raw(x, z, y)` -> [a, b], `y` the finished ground height (only asked for
// when `needsHeight`); `treeKeep(x, z)` the share of trees kept there (a
// massif is bare rock and thin forest).
const RECIPES = {
 // A MOUNTAINSIDE: crags on the crests of a ridged field, cut into stepped
 // cliff bands -- rock on every riser and the summit, scree on the tread at
 // each band's foot. The Banff picture: cliffs rising off a valley floor.
 crags(o, seed) {
  const s1 = saltOf(seed, 'crag'), s2 = saltOf(seed, 'scree'), s3 = saltOf(seed, 'cluster'), scale = o.scale, steps = o.steps;
  // A ridged field alone sits near its crest most of the time (measured: 70%
  // of points above 0.87), so crags gated on it covered a fifth of every
  // course. A broad mask, two and a half times the crag scale, gathers them
  // into clusters with open country between; `cluster` is where that mask
  // starts, so it sets how much of the course is crag.
  const massif = (x, z) => smooth(o.from ?? .42, o.to ?? .92, ridged(x / scale, z / scale, s1))
   * smooth(o.cluster ?? .45, (o.cluster ?? .45) + .16, fbm(x / (scale * 2.5), z / (scale * 2.5), s3, 2));
  // Round 2: the bands followed the noise's contours too faithfully and the
  // slopes came out banded like agate, so the terrace is read through a
  // little noise of its own and the risers wander.
  // THE POLISH GOAL'S CRAGS (`o.jag`, Mountain only; the owner: "our
  // mountains are very smooth"). A massif from one smooth ridged field is a
  // rounded knoll, and terraced it is a stack of rings. With `jag`, a sharper
  // ridged field at a third of the scale (ridged squared again, so its crests
  // are knife-edged: aretes and buttresses, the troughs between them
  // couloirs) bends the terrace bands, so the cliff bands break and wander
  // round spurs, and a fine jag roughens every face. Faded by the massif, so
  // open country stays as it was. PLACED.
  const s4 = saltOf(seed, 'arete'), jag = o.jag ?? 0;
  // Round 2 (`crag-r2`): round 1's faces stayed plain sloping planes -- the
  // spurs at a quarter of the scale (were a third), and the face's roughness
  // at two scales, 23 m and 9 m, five times as deep.
  const spur = (x, z) => { const r = ridged(x / (scale * .25), z / (scale * .25), s4, 2); return r * r; };
  const band = (x, z) => {
   const m = massif(x, z);
   const bend = jag ? jag * (spur(x, z) - .35) * smooth(.05, .5, m) : 0;
   return terrace(Math.max(0, Math.min(1, m + bend + .07 * (fbm(x / 47, z / 47, s2 + 9, 2) - .5) * 2)), steps);
  };
  const rough = (x, z) => jag ? jag * (.2 * (ridged(x / 23, z / 23, s4 + 5, 2) - .4) + .08 * (ridged(x / 9, z / 9, s4 + 6, 2) - .4)) * smooth(.1, .6, massif(x, z)) : 0;
  return {
   needsSlope: true,
   lift: (x, z) => o.height * (band(x, z).h + rough(x, z)),
   // ROCK IS WHERE THE GROUND IS ACTUALLY STEEP (round 2). Read off the
   // recipe's own bands alone, rock was painted wherever a cliff WOULD have
   // been -- including where the corridor fade had squashed the crag flat,
   // which left flat rock decals beside the fairways. `slope` is the
   // finished ground's gradient (rise over run), so a squashed crag is grass.
   raw: (x, z, y, slope = 0) => {
    const m = massif(x, z);
    if (m <= 0) return [0, 0];
    // THE POLISH GOAL'S BANDING (`o.jag`): rock read off each terrace step's
    // riser striped every slope -- rock, grass, rock, grass, a ring a step --
    // with straight edges between. Here rock is where the finished ground is
    // steep, its threshold wandering with two scales of noise, so it comes
    // through the turf in tongues and outcrops; a gentle tread keeps its
    // grass but carries rock patches; scree gathers on the moderate slopes at
    // the foot. PLACED.
    if (jag) {
     const n1 = fbm(x / 19, z / 19, s2 + 31, 2), n2 = fbm(x / 61, z / 61, s2 + 37, 2);
     const t = .34 + .18 * (n1 - .5) * 2 + .1 * (n2 - .5) * 2;
     const face = smooth(t, t + .2, slope) * smooth(.02, .14, m);
     const outcrop = smooth(.62, .74, n1 * .6 + n2 * .4) * smooth(.15, .45, m) * smooth(.12, .3, slope);
     const summit = smooth(.86, .97, m) * smooth(.2, .4, slope) * (o.summitRock ?? 1);
     const rock = Math.max(face, outcrop, summit);
     const scree = o.scree ? smooth(.16, .26, slope) * (1 - smooth(t - .02, t + .1, slope)) * smooth(.04, .25, m) * smooth(.35, .55, n2) : 0;
     return [rock, scree];
    }
    const {f} = band(x, z);
    const face = smooth(.55, .78, f) * smooth(.02, .12, m) * smooth(.42, .7, slope);
    const summit = smooth(.86, .97, m) * smooth(.2, .4, slope);
    const rock = Math.max(face, summit * (o.summitRock ?? 1));
    const patch = fbm(x / 31, z / 31, s2, 2);
    const scree = o.scree ? smooth(.12, .3, f) * (1 - smooth(.5, .62, f)) * smooth(.04, .2, m) * smooth(.18, .32, slope) * smooth(.3, .5, patch) : 0;
    return [rock, scree];
   },
   treeKeep: (x, z) => 1 - .85 * smooth(.25, .75, massif(x, z)),
  };
 },
 // THE DESERT: flat-topped sandstone mesas and buttes on a seeded grid of
 // cells, cliffs on their sides and a talus apron below; dry washes winding
 // between. Every remaining rough past the floor's gate is hardpan.
 mesas(o, seed) {
  const sm = saltOf(seed, 'mesa'), sw = saltOf(seed, 'wash'), cell = o.cell;
  const mesaAt = (ci, cj) => {
   if (hash(ci, cj, sm) > o.chance) return null;
   const r = o.radius[0] + hash(ci, cj, sm + 1) * (o.radius[1] - o.radius[0]);
   const h = o.height[0] + hash(ci, cj, sm + 2) * (o.height[1] - o.height[0]);
   const cx = (ci + .2 + .6 * hash(ci, cj, sm + 3)) * cell, cz = (cj + .2 + .6 * hash(ci, cj, sm + 4)) * cell;
   const a = hash(ci, cj, sm + 5) * Math.PI, e = .55 + .45 * hash(ci, cj, sm + 6);
   return {cx, cz, r, h, ca: Math.cos(a), sa: Math.sin(a), e};
  };
  // The nearest mesa's normalised distance (1 at the cliff's foot) and height.
  const nearest = (x, z) => {
   const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
   let best = null, bd = Infinity;
   for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    const m = mesaAt(i, j);
    if (!m) continue;
    const dx = x - m.cx, dz = z - m.cz, u = dx * m.ca + dz * m.sa, v = (-dx * m.sa + dz * m.ca) / m.e;
    // A ragged outline, so a mesa is not an ellipse.
    const wob = 1 + .14 * (fbm(x / 31, z / 31, sm + 9, 2) - .5) * 2;
    const d = Math.hypot(u, v) / (m.r * wob);
    if (d < bd) { bd = d; best = m; }
   }
   return {d: bd, m: best};
  };
  const washOf = (x, z) => {
   const wx = fbm(x / 400, z / 400, sw + 3, 2) - .5, wz = fbm(x / 400 + 9, z / 400 - 4, sw + 4, 2) - .5;
   const n = fbm(x / o.wash + wx * 1.4, z / o.wash + wz * 1.4, sw, 2);
   return 1 - smooth(o.washWidth * .5, o.washWidth, Math.abs(n - .5));
  };
  return {
   needsSlope: true,
   lift: (x, z) => {
    const {d, m} = nearest(x, z);
    let y = 0;
    if (m) {
     const top = 1 - smooth(.86, 1, d), talus = .22 * (1 - smooth(1, 1.7, d));
     y = m.h * Math.max(top * (.96 + .04 * fbm(x / 9, z / 9, sm + 11, 1)), talus);
    }
    return y - o.washDepth * washOf(x, z);
   },
   // The cliff is rock where the ground really stands steep (round 2: the
   // band alone painted flat rock wherever a mesa near a corridor had been
   // faded flat). The broken caprock along the rim went with it.
   raw: (x, z, y, slope = 0) => {
    const {d, m} = nearest(x, z);
    const cliff = m ? smooth(.7, .86, d) * (1 - smooth(1.05, 1.2, d)) * smooth(.45, .75, slope) : 0;
    return [cliff, washOf(x, z) * (m ? smooth(1.05, 1.2, d) : 1)];
   },
   treeKeep: (x, z) => { const {d} = nearest(x, z); return smooth(.95, 1.15, d); },
  };
 },
 // DUNES: hummocky ground on top of the hills, marram on the dune crests and
 // faces, heather in patches on the settled ground behind them.
 dunes(o, seed) {
  const sd = saltOf(seed, 'dune'), sh = saltOf(seed, 'heath');
  const crest = (x, z) => ridged(x / o.scale, z / (o.scale * .7), sd, 2);
  return {
   // The hummocks are a third of the dune height: rumpled ground, a metre or
   // two. At their full height (the first try) they stood a creek's narrow
   // head 8.7 m under a hummock it could not be carved through -- water
   // lying on a dune top (tests/course-living.test.mjs).
   lift: (x, z) => o.height * .35 * (fbm(x / o.hummock, z / o.hummock, sd + 5, 2) - .5) * 2 + o.height * .9 * crest(x, z),
   raw: (x, z) => [smooth(o.marram, o.marram + .2, crest(x, z) + .25 * (fbm(x / 19, z / 19, sd + 7, 2) - .5)),
    o.heather ? smooth(o.heather, o.heather + .22, fbm(x / 70, z / 70, sh, 3)) : 0],
   treeKeep: () => 1,
  };
 },
 // PRAIRIE: broad drifts of unmown native grass in the out-of-play ground.
 prairie(o, seed) {
  const sp = saltOf(seed, 'prairie');
  return {
   lift: (x, z) => o.swale * (fbm(x / 160, z / 160, sp + 3, 2) - .5),
   raw: (x, z) => [smooth(o.cover, o.cover + .2, fbm(x / 110, z / 110, sp, 3)), 0],
   treeKeep: (x, z) => 1 - .6 * smooth(o.cover, o.cover + .12, fbm(x / 110, z / 110, sp, 3)),
  };
 },
 // CORAL: ironshore along the island's coast -- the band just above the beach
 // -- broken into patches.
 coral(o, seed) {
  const sc = saltOf(seed, 'coral');
  return {
   needsHeight: true,
   lift: () => 0,
   raw: (x, z, y) => [y === undefined ? 0 : smooth(o.low, o.low + .4, y) * (1 - smooth(o.high - .8, o.high, y)) * smooth(.3, .42, fbm(x / 17, z / 17, sc, 2)), 0],
   treeKeep: () => 1,
  };
 },
 // A MOOR: dead heather in great dark drifts (Haunted Hollow).
 moor(o, seed) {
  const sm = saltOf(seed, 'moor');
  return {
   lift: (x, z) => o.tussock * (fbm(x / 24, z / 24, sm + 2, 2) - .5),
   raw: (x, z) => [smooth(o.cover, o.cover + .2, fbm(x / 80, z / 80, sm, 3)), 0],
   treeKeep: () => 1,
  };
 },
};

const NONE = {lift: () => 0, raw: () => [0, 0], treeKeep: () => 1};

// The recipe for a biome record, or one that adds nothing.
export function landformOf(bio, seed) {
 const o = bio.landform;
 if (!o || !RECIPES[o.type]) return {...NONE, kinds: {}, gates: {}};
 return {...RECIPES[o.type](o, seed), kinds: o.kinds || {}, gates: o.gates || {}, reach: o.reach};
}

// ---------------------------------------------------------------- the field
//
// Baked on the ground atlas's grid (owner-atlas.js), one byte per texel and
// channel. `height(x, z)` is asked only by a recipe that needs it.
// A recipe that `needsSlope` is also handed the finished ground's gradient
// there, rise over run, from heights 1.5 m either side.
export function wildField(recipe, ex, ez, height) {
 const {Sx, Sz} = ownerAtlasSize(ex, ez), a = new Uint8Array(Sx * Sz), b = new Uint8Array(Sx * Sz);
 if (!recipe.kinds.a && !recipe.kinds.b) return null;
 const E = 1.5;
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  const slope = recipe.needsSlope ? Math.hypot(height(x + E, z) - height(x - E, z), height(x, z + E) - height(x, z - E)) / (2 * E) : 0;
  const [ra, rb] = recipe.raw(x, z, recipe.needsHeight ? height(x, z) : undefined, slope);
  a[j * Sx + i] = Math.round(Math.max(0, Math.min(1, ra)) * 255);
  b[j * Sx + i] = Math.round(Math.max(0, Math.min(1, rb)) * 255);
 }
 return {Sx, Sz, ex, ez, a, b};
}

// Read back as a linear texture filter reads it: texel centres at (i+.5)/S.
export function wildAt(field, channel, x, z) {
 const {Sx, Sz, ex, ez} = field, data = field[channel];
 const u = (x / ex + 1) * .5 * Sx - .5, v = (z / ez + 1) * .5 * Sz - .5;
 const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 const at = (p, q) => data[Math.min(Sz - 1, Math.max(0, q)) * Sx + Math.min(Sx - 1, Math.max(0, p))];
 const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu, bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
 return (top + (bottom - top) * fv) / 255;
}

// FALLEN NEEDLES AND LEAVES (biomes.js `fallen`), baked the same way from
// the planted patches (`inside(x, z)` true under a patch) -- the bytes the
// ground shader reads as the cover texture's green channel -- and played
// from those bytes at 0.5, so the lie is where the straw is drawn.
export function fallenBake(inside, ex, ez) {
 const {Sx, Sz} = ownerAtlasSize(ex, ez), data = new Uint8Array(Sx * Sz);
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  if (inside(x, z)) data[j * Sx + i] = 255;
 }
 return {Sx, Sz, ex, ez, g: data};
}
export const fallenAt = (field, x, z) => Math.abs(x) < field.ex && Math.abs(z) < field.ez && wildAt(field, 'g', x, z) >= .5;

// A smoothstep from `near` metres outside the corridor envelope over `ramp`,
// written as the shader writes it.
export function wildGate(d, gate) {
 if (!gate) return 0;
 const t = Math.max(0, Math.min(1, (d - gate.near) / gate.ramp));
 return t * t * (3 - 2 * t);
}

// The ground type at a rough point, or null. `d` is nearest().d, signed.
// Inside the field's own extent only, as the shader asks.
export function wildGround(field, recipe, x, z, d) {
 const {kinds, gates} = recipe;
 if (!field || Math.abs(x) >= field.ex || Math.abs(z) >= field.ez) return null;
 if (kinds.a && wildAt(field, 'a', x, z) * wildGate(d, gates.a) >= .5) return kinds.a;
 if (kinds.b && wildAt(field, 'b', x, z) * wildGate(d, gates.b) >= .5) return kinds.b;
 if (kinds.floor && wildGate(d, gates.floor) >= .5) return kinds.floor;
 return null;
}
