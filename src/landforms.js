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
//  to the raw landform. course.js `land` eases it, with the hills, into the
//  long shape of the country near the playing corridors (generator 85,
//  country.js) -- so the holes are never touched by a crag, and the ground
//  beside them rises and falls rather than only rising.
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

// A SCATTER OF ROUND FEATURES on a seeded grid of `o.cell` metre cells, one
// in each with chance `o.chance` (sinkholes, kettles, cinder cones, granite
// knobs): `near(x, z)` gives the nearest one's normalised distance d (0 at
// its centre, 1 at its rim, wobbled so none is a circle) and the feature
// {cx, cz, r, size}. `o.radius` and `o.size` are [min, max] metres.
// `o.stretch` (Desert Mountain's, the owner's "football shaped", 7 November
// 2026) draws each one long: `radius` is then the half-width and the length
// 0.65 to 1.35 times `stretch` times it, turned to a seeded heading within 50 degrees either side
// of the landscape's own, so the ridges roughly run together as a range does;
// `o.tip` below 2 points the ends (2 is an ellipse). None by default.
function scatter(o, seed, what) {
 const s = saltOf(seed, what), cell = o.cell, k = o.stretch || 1, tip = o.tip ?? 2;
 const span = k > 1 ? Math.max(1, Math.ceil(o.radius[1] * k * 1.35 * 1.15 / cell)) : 1, trend = hash(7, 11, s + 6) * Math.PI;
 const at = (ci, cj) => {
  if (hash(ci, cj, s) > o.chance) return null;
  const r = o.radius[0] + hash(ci, cj, s + 1) * (o.radius[1] - o.radius[0]);
  const size = o.size[0] + hash(ci, cj, s + 2) * (o.size[1] - o.size[0]);
  const m = {cx: (ci + .2 + .6 * hash(ci, cj, s + 3)) * cell, cz: (cj + .2 + .6 * hash(ci, cj, s + 4)) * cell, r, size};
  if (k > 1) { const a = trend + (hash(ci, cj, s + 5) - .5) * Math.PI * .55; m.ca = Math.cos(a); m.sa = Math.sin(a); m.k = k * (.65 + .7 * hash(ci, cj, s + 7)); }
  return m;
 };
 return (x, z) => {
  const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
  let best = null, bd = Infinity;
  for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
   const m = at(i, j);
   if (!m) continue;
   const wob = 1 + .18 * (fbm(x / 27, z / 27, s + 9, 2) - .5) * 2;
   let d;
   if (k > 1) {
    const dx = x - m.cx, dz = z - m.cz, u = Math.abs(dx * m.ca + dz * m.sa) / (m.r * m.k), v = (dz * m.ca - dx * m.sa) / m.r;
    d = Math.sqrt(Math.pow(u, tip) + v * v) / wob;
   } else d = Math.hypot(x - m.cx, z - m.cz) / (m.r * wob);
   if (d < bd) { bd = d; best = m; }
  }
  return bd < 1 ? {d: bd, m: best} : {d: bd, m: null};
 };
}

// A LANDSCAPE CUT BY ITS OWN DRAINAGE (the Badlands). A grid of `o.grid` cells
// across 2 * `o.tile` metres. Every cell the cluster mask calls prairie is an
// outlet; a shortest-path tree grown in from the outlets, over step costs with
// a heavy-tailed random part, is the drainage network: each cell's one parent
// is where its water goes, and the tree branches as real gullies do. A cell's
// area is every cell above it; its height is its parent's plus a slope that
// falls with area, S = slope * uplift * area ^ -concavity, the steady state of
// the stream-power law (RESEARCH): steep hillslopes on the divides, almost
// flat along the big channels. One pass, no iterations of erosion; a light
// blur takes the cell-to-cell jitter off the divides. Then the summits are
// drawn up above `peakFrom` metres into spires (`peak`), and where a broad
// field says so the land stops at a caprock, `cap` metres: a butte or table
// with a flat sod top. Pure and seeded.
function carve(o, seed, cluster, uplift) {
 const N = o.grid, W = N + 1, n = W * W, dx = 2 * o.tile / N, sn = saltOf(seed, 'badl-net'), sb = saltOf(seed, 'badl-cap');
 const cost = new Float32Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), done = new Uint8Array(n), order = new Int32Array(n), weight = new Float32Array(n);
 let cap = n * 4, hk = new Int32Array(cap), hc = new Float32Array(cap), size = 0;
 const push = (k, c) => {
  if (size === cap) { cap *= 2; const a = new Int32Array(cap), b = new Float32Array(cap); a.set(hk); b.set(hc); hk = a; hc = b; }
  let i = size++;
  while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= c) break; hk[i] = hk[p]; hc[i] = hc[p]; i = p; }
  hk[i] = k; hc[i] = c;
 };
 const pop = () => {
  const top = hk[0], k = hk[--size], c = hc[size];
  let i = 0;
  for (;;) {
   let m = 2 * i + 1;
   if (m >= size) break;
   if (m + 1 < size && hc[m + 1] < hc[m]) m++;
   if (hc[m] >= c) break;
   hk[i] = hk[m]; hc[i] = hc[m]; i = m;
  }
  hk[i] = k; hc[i] = c;
  return top;
 };
 for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i, r = hash(i, j, sn);
  weight[k] = 1 + o.wander * r * r * r * r;
  if (cluster(-o.tile + i * dx, -o.tile + j * dx) <= 0) { cost[k] = 0; push(k, 0); }
 }
 if (!size) { cost[0] = 0; push(0, 0); }
 const STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
 let c = 0;
 while (size) {
  const k = pop();
  if (done[k]) continue;
  done[k] = 1; order[c++] = k;
  const i = k % W, j = (k - i) / W;
  for (const [a, b, d] of STEP) {
   const u = i + a, v = j + b;
   if (u < 0 || v < 0 || u >= W || v >= W) continue;
   const q = v * W + u;
   if (done[q]) continue;
   const nc = cost[k] + d * weight[q];
   if (nc < cost[q]) { cost[q] = nc; parent[q] = k; push(q, nc); }
  }
 }
 const area = new Float32Array(n).fill(1);
 for (let e = c - 1; e >= 0; e--) { const k = order[e], p = parent[k]; if (p >= 0) area[p] += area[k]; }
 let h = new Float32Array(n);
 for (let e = 0; e < c; e++) {
  const k = order[e], p = parent[k];
  if (p < 0) continue;
  const i = k % W, j = (k - i) / W, pi = p % W, pj = (p - pi) / W;
  const s = o.slope * uplift(-o.tile + i * dx, -o.tile + j * dx) * Math.pow(area[k], -o.concavity);
  h[k] = h[p] + Math.hypot(i - pi, j - pj) * dx * s;
 }
 for (let pass = 0; pass < o.blur; pass++) {
  const b = new Float32Array(n);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
   const l = i ? i - 1 : i, r = i < N ? i + 1 : i, u = j ? j - 1 : j, d = j < N ? j + 1 : j;
   b[j * W + i] = (4 * h[j * W + i] + 2 * (h[j * W + l] + h[j * W + r] + h[u * W + i] + h[d * W + i]) + h[u * W + l] + h[u * W + r] + h[d * W + l] + h[d * W + r]) / 16;
  }
  h = b;
 }
 for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i;
  let t = h[k];
  if (t > o.peakFrom) t += (t - o.peakFrom) * (o.peak - 1);
  const open = smooth(o.capAt, o.capAt + .05, fbm((-o.tile + i * dx) / o.capScale, (-o.tile + j * dx) / o.capScale, sb, 2));
  h[k] = Math.min(t, o.cap * (1 - open) + 1e4 * open);
 }
 return {h, N, dx};
}

// THE CARVED LAND AS A FIELD: `height(x, z)` metres, `cluster(x, z)` 0 on the
// prairie, and past the tile the same tile mirrored, which meets itself
// without a seam. Baked once a seed: the ground, the far ring and the workers
// each ask for it, and it is a quarter of a second.
const CARVED = new Map();
export function carvedField(o, seed, what) {
 const key = `${what}|${seed}`;
 const had = CARVED.get(key);
 if (had?.o === o) return had;
 const sc = saltOf(seed, what + '-cluster'), su = saltOf(seed, what + '-uplift'), T = o.tile, span = 4 * T;
 const fold = v => { const p = ((v + T) % span + span) % span; return (p < 2 * T ? p : span - p) - T; };
 const plain = (x, z) => smooth(o.from, o.to, fbm(x / o.scale, z / o.scale, sc, 2));
 const {h, N, dx} = carve(o, seed + what, plain, (x, z) => .55 + .9 * fbm(x / o.spine, z / o.spine, su, 2));
 const W = N + 1;
 const field = {o, cluster: (x, z) => plain(fold(x), fold(z)), height: (x, z) => {
  const fx = Math.min(N - 1e-6, (fold(x) + T) / dx), fz = Math.min(N - 1e-6, (fold(z) + T) / dx);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * W + i;
  return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + W] * (1 - tx) + h[k + W + 1] * tx) * tz;
 }};
 if (CARVED.size >= 6) CARVED.clear();
 CARVED.set(key, field);
 return field;
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
 // THE BADLANDS (the owner, 3 November 2026: "I would prefer the landscape to
 // generate the mountain, butte, spire like formations for badlands rather
 // than building a model. Other landscapes do this"). Carved, as the real ones
 // are, by a drainage network: a table of clay eaten back from its edges by
 // gullies that branch and branch again, and what is left standing between
 // the gullies is the ridges, pyramids and spires (`carvedField`, above).
 // RESEARCH *The Dakota Badlands* has the rounds that led here: a ridged field
 // reads as lumps at any height, and turned cones as gumdrops.
 //
 // SUNK, NOT SQUASHED (`sinks`, which course.js `land` honours): where every
 // other recipe's relief is multiplied down near a corridor, this one is
 // LOWERED into the prairie -- a share (1 - fade) taken off the top of the
 // height -- so what stands near a hole keeps its steep faces and only the
 // taller peaks reach the grass there. Squashed, the same ground was gentle
 // banks of rock paint beside the fairways, the look the owner turned down.
 // Bare clay faces are rock (A) where the finished ground is steep; hardpan
 // (B) is the shallower wash at their feet. Every number PLACED from the study's pictures
 // (subs/plains/plains.badlands.md, local).
 badlands(o, seed) {
  const sc = saltOf(seed, 'badl-cluster'), sf = saltOf(seed, 'badl-floor');
  const {height: carved, cluster} = carvedField(o, seed, 'near');
  // UP INTO THE BADLANDS (`upInto`, metres; the owner, 8 November 2026, a preview: "what it would look
  // like if the course actually went up into the mountains ... little to no extra room on the sides of
  // the fairway"): near a hole the ground is a smooth bench rising with the formations (their `cluster`
  // field's broad rise, up to `upInto` metres over several hundred) instead of the prairie, and the carving returns at full height over
  // the recipe's `reach` -- so a hole climbs onto the tables with the gullies and spires close beside.
  // Off by default. PLACED.
  const shape = (x, z, fade) => {
   let t = o.upInto ? o.upInto * smooth(.35, .65, fbm(x / 900, z / 900, sc + 7, 2)) * (1 - fade) + carved(x, z) * fade : carved(x, z) - (1 - fade) * o.sink;
   if (t <= 0) return 0;
   // The foot rounds into the grass over a couple of metres.
   t = t * t / (t + 2);
   // Ledges where a bed weathers back.
   return t * (1 - o.ledge) + Math.floor(t / o.ledges + .5) * o.ledges * o.ledge;
  };
  return {
   sinks: true,
   // Routed round (`formationShareOf`): course.js moves this field with the course's `shift`.
   routed: !!o.routed,
   needsSlope: true,
   needsHeight: true,
   lift: (x, z, fade = 1) => shape(x, z, fade) + o.swale * (fbm(x / 160, z / 160, sc + 3, 2) - .5) * fade,
   raw: (x, z, y, slope = 0, height = null) => {
    const m = cluster(x, z);
    if (m <= 0) return [0, 0];
    const n = fbm(x / 23, z / 23, sf, 2), t = .4 + .1 * (n - .5) * 2;
    // Broken ground or a plain bank: how far the ground bends over 12 m. The
    // prairie's own roll reaches 0.4 of slope near a hole with the formations
    // sunk out of it, an even bank that read bare as a slab beside the hole
    // (round 6, RESEARCH); it stays grass, unless it stands steep in its own right.
    const bend = height ? Math.abs(height(x + 12, z) + height(x - 12, z) - 2 * y) + Math.abs(height(x, z + 12) + height(x, z - 12) - 2 * y) : 9, own = smooth(1.2, 3, bend);
    const face = smooth(t, t + .14, slope) * Math.max(own, smooth(.55, .7, slope));
    // The wash: only the shallower clay at a face's foot. A slope, not a
    // mask: the sunk ground near a hole is grass, not a stain.
    return [face, smooth(.33, .4, slope) * (1 - face) * own];
   },
   treeKeep: (x, z) => 1 - .92 * smooth(.2, .6, cluster(x, z)),
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
   // `rugged` (Seaside Links, 8 November 2026; the owner: "the spaces between holes is very rugged.
   // Right now i think we are too smooth"): a second, sharper rumple every 17 m or so, that many
   // metres either way. None by default.
   lift: (x, z) => o.height * .35 * (fbm(x / o.hummock, z / o.hummock, sd + 5, 2) - .5) * 2 + o.height * .9 * crest(x, z) + (o.rugged ? o.rugged * (fbm(x / 17, z / 17, sd + 9, 2) - .5) * 2 + o.rugged * .6 * (ridged(x / 31, z / 31, sd + 11, 2) - .3) : 0),
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
 // ---------------------------------------------------------------- terrain true to place
 //
 // THE OWNER'S AMENDMENT OF 3 NOVEMBER 2026: "make sure that the terrain is
 // also lifelike to the regions where the courses are built". Until then
 // most landscapes shared their region's recipe -- the South and Texas the
 // prairie roll, the western mountains and Appalachia the Rockies' crags.
 // These recipes come from each region's geology (RESEARCH, *Terrain true
 // to place*); every shape and number in them is PLACED from those sources
 // and the study's pictures. Shared helpers first.
 //
 // A SCATTER OF ROUND FEATURES on a seeded grid of cells (sinkholes, kettles,
 // cinder cones, granite knobs): the nearest one's normalised distance d (0
 // at its centre, 1 at its rim), its size and its own two random numbers.
 // STEPPED HILLS: the Texas Hill Country's limestone, where marl beds weather
 // back under harder ones into a staircase of low ledges up every hillside
 // (Glen Rose Formation; the UT Austin field guide); and, with few broad
 // steps, Monterey's marine terraces -- level wave-cut platforms with low
 // bluffs between (USGS OFR 2016-1110).
 steps(o, seed) {
  const s1 = saltOf(seed, 'steps'), s2 = saltOf(seed, 'steps-wander');
  const hill = (x, z) => smooth(o.from ?? .35, o.to ?? .8, fbm(x / o.scale, z / o.scale, s1, 3));
  const at = (x, z) => terrace(Math.min(1, hill(x, z) + .05 * (fbm(x / 37, z / 37, s2, 2) - .5) * 2), o.steps, o.riser ?? .3);
  return {
   needsSlope: true,
   lift: (x, z) => o.height * at(x, z).h,
   // A ledge of bare limestone along each riser where it stands steep.
   raw: (x, z, y, slope = 0) => {
    const {f} = at(x, z);
    return [smooth(.6, .85, f) * smooth(o.ledge ?? .3, (o.ledge ?? .3) + .2, slope) * smooth(.02, .1, hill(x, z)), o.drift ? smooth(o.drift, o.drift + .2, fbm(x / 110, z / 110, s2 + 3, 2)) : 0];
   },
   treeKeep: () => 1,
  };
 },
 // KARST: the Inner Bluegrass -- a gently rolling upland, local relief under
 // about 50 m, pocked with shallow sinkholes, many too shallow to map, and
 // sparse outcrops (KGS RI-07-11; USGS PP 1151-H).
 karst(o, seed) {
  const s1 = saltOf(seed, 'karst'), s2 = saltOf(seed, 'karst-rock'), near = scatter(o, seed, 'sink');
  return {
   needsSlope: true,
   lift: (x, z) => {
    const roll = o.roll * (fbm(x / 240, z / 240, s1, 2) - .5) * 2;
    const {d, m} = near(x, z);
    const sink = m ? -m.size * Math.pow(Math.max(0, 1 - d * d), 2) : 0;
    return roll + sink;
   },
   // A little grey limestone where the ground breaks steep, as at a sink's lip.
   raw: (x, z, y, slope = 0) => [smooth(.35, .55, slope) * smooth(.55, .7, fbm(x / 29, z / 29, s2, 2)), 0],
   treeKeep: () => 1,
  };
 },
 // GLACIAL: the North Woods -- hummocky moraine, "hills and hollows", kettles
 // where stranded ice melted, poorly drained hollows of bog, a sinuous esker
 // tracing an old stream under the ice, boulders strewn (WGNHS; USDA ESD
 // 095X: local relief mainly about 8 m, moraines to 25-100 m).
 glacial(o, seed) {
  const s1 = saltOf(seed, 'glacial'), s2 = saltOf(seed, 'esker'), s3 = saltOf(seed, 'bog'), near = scatter(o, seed, 'kettle');
  const esker = (x, z) => {
   const wx = fbm(x / 500, z / 500, s2 + 1, 2) - .5;
   const n = fbm(x / o.esker + wx * 1.6, z / (o.esker * 3), s2, 2);
   return 1 - smooth(.004, .02, Math.abs(n - .5));
  };
  return {
   needsSlope: true,
   lift: (x, z) => {
    const hum = o.hummock * (fbm(x / (o.hummockX ?? 70), z / (o.hummockZ ?? 70), s1, 3) - .5) * 2;
    const {d, m} = near(x, z);
    const kettle = m ? -m.size * Math.pow(Math.max(0, 1 - d * d), 1.5) : 0;
    return hum + kettle + o.eskerHeight * esker(x, z);
   },
   // A: grey granite where the moraine breaks steep (erratics, outcrops);
   // B: the bog's native grass in the hollows.
   raw: (x, z, y, slope = 0) => {
    const {d, m} = near(x, z);
    return [smooth(.4, .6, slope) * smooth(.6, .75, fbm(x / 23, z / 23, s3 + 4, 2)), m ? 1 - smooth(.45, .7, d) : 0];
   },
   treeKeep: (x, z) => { const {d, m} = near(x, z); return m ? smooth(.4, .7, d) : 1; },
  };
 },
 // KNOBS: rounded granite knobs and domes standing out of a gentle floor.
 // The Mojave's pediments and inselbergs -- residual granite, rounded, on a
 // gentle floor crossed by shallow washes (USGS OF 2004-1007); the High
 // Sierra's exfoliation domes and whaleback slabs, glacier-polished (NPS
 // Yosemite); Desert Palms' fans at a mountain front. `profile` sets the
 // shape: below 1 a steep-sided knob, above 1 a broad dome. `boulders` (Desert
 // Mountain's, 7 November 2026) piles a knob's upper part with rounded granite
 // boulders `boulders` metres across, and half that again on them: each a
 // rounded cap, the clefts between them sharp, standing up to `rock` times
 // their width -- the granite boulder piles of Pinnacle Peak and Troon North.
 // Tried first, and turned down by the owner: ridged noise (sharp crests read
 // as fins, "it needs to be more rocky"), and before that plain noise (only
 // lumpy domes). None by default. `range` (Desert Mountain round 5, 7 November
 // 2026) lays continuous mountain ranges over the floor: a warped noise field
 // stretched `stretch` times along a seeded trend, the share of it above `from`
 // rising to full height by `to`, crests broken by ridged noise, boulders on
 // the upper part -- long, wide, joined mountains, the holes left in the draws
 // between them by the corridor fade. The owner turned down the scattered
 // football knobs ("the deliberate football shapes are a bit jarring. The
 // bigger mountains look much more natural") and ridges laid along each hole
 // ("in natural mountain formations ... placed after the holes").
 knobs(o, seed) {
  // (The ranges' field is `rangeShareOf`, below the recipes: routing.js reads it too.)
  const sw = saltOf(seed, 'knob-wash'), sb = saltOf(seed, 'boulder'), near = scatter(o, seed, 'knob');
  // The tallest of the round caps over (x, z) on a jittered grid `b` metres a cell; 0 to about .9.
  const caps = (x, z, b, salt) => {
   const ci = Math.floor(x / b), cj = Math.floor(z / b);
   let h = 0;
   for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    if (hash(i, j, salt) > .88) continue;
    const r = b * (.55 + .4 * hash(i, j, salt + 1));
    const dd = Math.hypot(x - (i + .25 + .5 * hash(i, j, salt + 2)) * b, z - (j + .25 + .5 * hash(i, j, salt + 3)) * b) / r;
    if (dd < 1) h = Math.max(h, r / b * Math.sqrt(1 - dd * dd));
   }
   return h;
  };
  const pile = (x, z) => o.boulders * (caps(x, z, o.boulders, sb) + .5 * caps(x + 7, z - 3, o.boulders * .5, sb + 11) - .55);
  // The ranges: their share of full height at (x, z), 0 on the floor.
  const sr = saltOf(seed, 'range'), R = o.range, rangeShare = rangeShareOf(o, seed);
  const rangeAt = R ? (x, z) => {
   const m = rangeShare(x, z);
   if (m <= 0) return 0;
   const crest = .5 + .5 * ridged(x / R.crest, z / R.crest, sr + 7, 2);
   const h = R.height * Math.pow(m, R.shape ?? .8) * crest;
   return Math.max(0, h + (o.boulders ? o.rock * smooth(.25, .6, m) * pile(x, z) : 0));
  } : () => 0;
  const washOf = (x, z) => {
   if (!o.wash) return 0;
   const wx = fbm(x / 400, z / 400, sw + 3, 2) - .5, wz = fbm(x / 400 + 9, z / 400 - 4, sw + 4, 2) - .5;
   const n = fbm(x / o.wash + wx * 1.4, z / o.wash + wz * 1.4, sw, 2);
   return 1 - smooth(o.washWidth * .5, o.washWidth, Math.abs(n - .5));
  };
  return {
   needsSlope: true,
   // The boulder piles alone, in metres about nothing, for a rock tee's outcrop (course.js).
   rocky: o.boulders ? (x, z) => o.rock * pile(x, z) : null,
   // The ranges stay out of the long shape a hole lies on (course.js `longLift`): holes keep the draws.
   longLift: R ? (x, z) => { const {d, m} = near(x, z); return (m ? m.size * Math.pow(Math.max(0, 1 - Math.pow(d, o.profile ?? 1.6)), o.round ?? .7) : 0) + o.floor * (fbm(x / 300, z / 300, sw + 9, 2) - .5) * 2 - (o.washDepth || 0) * washOf(x, z); } : undefined,
   lift: (x, z) => {
    const {d, m} = near(x, z);
    let knob = m ? m.size * Math.pow(Math.max(0, 1 - Math.pow(d, o.profile ?? 1.6)), o.round ?? .7) : 0;
    // Boulders on the upper part only: the foot of a knob stays a smooth apron of grus.
    if (o.boulders && knob > 0) knob = Math.max(0, knob + o.rock * smooth(.15, .5, knob / m.size) * pile(x, z));
    return Math.max(knob, rangeAt(x, z)) + o.floor * (fbm(x / 300, z / 300, sw + 9, 2) - .5) * 2 - (o.washDepth || 0) * washOf(x, z);
   },
   // A: bare granite on the knob where it is steep enough to shed its soil;
   // B: the washes' sand.
   raw: (x, z, y, slope = 0) => {
    const {d, m} = near(x, z);
    const onRange = R ? smooth(.05, .2, rangeShare(x, z)) : 0;
    return [Math.max(m ? (1 - smooth(.8, 1, d)) : 0, onRange) * smooth(o.bare ?? .25, (o.bare ?? .25) + .2, slope), washOf(x, z)];
   },
   // Saguaros and palo verde climb a range's lower slopes; its upper part is bare.
   treeKeep: (x, z) => { const {d, m} = near(x, z); return Math.min(m ? smooth(.7, 1, d) : 1, R ? 1 - smooth(.35, .7, rangeShare(x, z)) : 1); },
  };
 },
 // CHANNELS CUT INTO A TABLE: the Columbia Plateau's coulees -- dry flood
 // channels with basalt rimrock walls cut into flat-lying flows (the
 // Channeled Scablands); the Ozarks' hollows -- a dissected plateau, steep
 // valley walls and narrow bottoms, limestone bluffs (the Ozark Highlands);
 // the Piedmont's gullies -- red saprolite exposed and cut back in headcuts
 // (Georgia Encyclopedia; the Sumter National Forest paper). `wall` near 0
 // is a box canyon, near 1 a V.
 channels(o, seed) {
  const s1 = saltOf(seed, 'channel'), s2 = saltOf(seed, 'channel-warp'), s3 = saltOf(seed, 'channel-2');
  const cut = (x, z) => {
   const wx = fbm(x / 520, z / 520, s2, 2) - .5, wz = fbm(x / 520 + 7, z / 520 - 3, s2 + 1, 2) - .5;
   const a = Math.abs(fbm(x / o.scale + wx * 1.5, z / o.scale + wz * 1.5, s1, 2) - .5);
   // A finer second network, the side hollows feeding the main ones.
   const b = o.branches ? Math.abs(fbm(x / (o.scale * .45) + wz, z / (o.scale * .45) + wx, s3, 2) - .5) : 1;
   const w = o.width, inner = w * (o.wall ?? .4);
   return Math.max(1 - smooth(inner, w, a), o.branches ? (1 - smooth(inner * .6, w * .6, b)) * o.branches : 0);
  };
  return {
   needsSlope: true,
   lift: (x, z) => o.table * (fbm(x / 260, z / 260, s1 + 5, 2) - .5) * 2 - o.depth * cut(x, z),
   // A: the walls' rock (rimrock, bluff, red clay) where steep; B: the
   // bottom's ground (a coulee's sage, a hollow's gravel, a gully's clay).
   raw: (x, z, y, slope = 0) => {
    const c = cut(x, z);
    return [smooth(o.rim ?? .45, (o.rim ?? .45) + .25, slope) * smooth(.05, .3, c), o.floorKind ? smooth(.85, .97, c) : 0];
   },
   // Nothing on the walls (the bench's first run found plants floating off
   // the steep sides of SoCal's, the Piedmont's and the Ozarks' channels);
   // the bottoms keep `1 - bare` of theirs.
   // Looked for 4 m round the point too: a stand tree's footprint (2.5 m)
   // beside a narrow gully hung over its lip (the bench, round 2).
   treeKeep: (x, z) => {
    const c = Math.max(cut(x, z), cut(x + 4, z), cut(x - 4, z), cut(x, z + 4), cut(x, z - 4));
    return 1 - smooth(.01, .12, c) * (1 - smooth(.88, .97, cut(x, z)) * (1 - (o.bare ?? .5)));
   },
  };
 },
 // VOLCANIC: cinder cones and lava flows. The San Francisco volcanic field
 // round Flagstaff -- over 600 volcanoes, most of them basalt cinder cones
 // under 300 m, flows running for kilometres (USGS) -- and Hawaii's Kohala
 // coast, its courses carved from black lava fields (GolfPass). Cones are
 // truncated, a crater in the top; flows are broad lobes standing a metre or
 // three proud of the ground, a steep rough front at their edge.
 volcanic(o, seed) {
  const sf = saltOf(seed, 'flow'), near = scatter(o, seed, 'cone');
  const flow = (x, z) => smooth(o.flows, o.flows + .04, fbm(x / 260, z / 260, sf, 3) + .06 * (fbm(x / 23, z / 23, sf + 2, 2) - .5));
  return {
   needsSlope: true,
   lift: (x, z) => {
    const {d, m} = near(x, z);
    let cone = 0;
    if (m) {
     // Round 2 (the first capture read as a pit in the forest): a steeper
     // cone, a narrow crater in its top, its flanks bare cinder.
     cone = m.size * Math.pow(Math.max(0, 1 - Math.max(d, .14)) / .86, 1.15);
     cone -= m.size * .22 * (1 - smooth(.04, .14, d));
    }
    return cone + o.flowHeight * flow(x, z) + o.roll * (fbm(x / 300, z / 300, sf + 7, 2) - .5) * 2;
   },
   // A: the flows' black rock; B: the cones' cinder (hardpan, tinted).
   raw: (x, z) => {
    const {d, m} = near(x, z);
    return [flow(x, z), m ? 1 - smooth(.85, 1, d) : 0];
   },
   treeKeep: (x, z) => { const {d, m} = near(x, z); return (1 - .8 * flow(x, z)) * (m ? .05 + .95 * smooth(.85, 1.05, d) : 1); },
  };
 },
 // SAND RIDGES: the Fall Line sandhills -- gentle rounded hills of deep
 // quartz sand, old dunes and shorelines, bare sand on the dry ridge tops,
 // the moister swales between (Georgia Encyclopedia; the Carolina Sandhills
 // refuge).
 sandridges(o, seed) {
  const s1 = saltOf(seed, 'sandridge'), s2 = saltOf(seed, 'sandbare');
  const ridge = (x, z) => Math.sqrt(ridged(x / o.scale, z / (o.scale * 1.6), s1, 2));
  return {
   lift: (x, z) => o.height * ridge(x, z),
   raw: (x, z) => [smooth(o.bare, o.bare + .12, ridge(x, z) * .8 + .2 * fbm(x / 31, z / 31, s2, 2)), 0],
   treeKeep: () => 1,
  };
 },
 // LOWLAND: the Mississippi's alluvial plain and the Gulf and Florida flats
 // -- maximum local relief about 5 m, most of it far less; natural levees a
 // few metres high along the bayous, flat poorly drained backswamps between
 // (USDA MLRA 131A). Low ridges along sinuous channels of the field, broad
 // hollows of marsh grass behind them.
 lowland(o, seed) {
  const s1 = saltOf(seed, 'levee'), s2 = saltOf(seed, 'swamp');
  const bayou = (x, z) => {
   const wx = fbm(x / 600, z / 600, s1 + 2, 2) - .5;
   const n = fbm(x / o.scale + wx * 1.8, z / o.scale, s1, 2);
   return Math.abs(n - .5);
  };
  const swamp = (x, z) => smooth(o.swamp, o.swamp + .1, fbm(x / 180, z / 180, s2, 3));
  const out = {
   lift: (x, z) => {
    const b = bayou(x, z);
    const levee = o.levee * smooth(.03, .012, b) * smooth(0, .006, b);
    return levee - o.hollow * swamp(x, z) + .6 * (fbm(x / 40, z / 40, s2 + 3, 2) - .5);
   },
   raw: (x, z) => [swamp(x, z), 0],
   treeKeep: () => 1,
  };
  if (!o.tide) return out;
  // TIDAL CREEKS (the Lowcountry, generator 80): the salt marsh is a flat
  // platform at about mean high water, cut by meandering creeks that hold
  // water at every tide and join one another (USDA MLRA 153B, the Atlantic
  // coast flatwoods' tidal marshes; SC DNR's ACE Basin). The marsh drifts are
  // laid down to `tide.marsh` metres above the sea (course.js `level`, after
  // every other relief), and the creeks cut through them to `tide.bed`, below
  // the sea, so the sea plane fills them. Only in the marsh's core, so no
  // creek reaches upland or play. Heights, widths and spacing PLACED.
  const t = o.tide, s3 = saltOf(seed, 'tidecreek'), s4 = saltOf(seed, 'tidebranch');
  const core = (x, z) => smooth(o.swamp + .04, o.swamp + .16, fbm(x / 180, z / 180, s2, 3));
  const channel = (x, z, scale, half, salt) => {
   const wx = fbm(x / (scale * 2.2), z / (scale * 2.2), salt + 2, 2) - .5;
   const d = Math.abs(fbm(x / scale + wx * 2, z / scale, salt, 2) - .5);
   const w = half * (.7 + .6 * fbm(x / 500, z / 500, salt + 5, 2));
   return 1 - smooth(w * .45, w, d);
  };
  const creek = (x, z) => Math.max(channel(x, z, t.scale, t.width, s3), .85 * channel(x, z, t.scale * .42, t.width * .6, s4));
  out.level = (x, z, y, fade) => {
   const m = swamp(x, z) * fade;
   if (m <= 0) return y;
   const flat = y + (t.marsh + .3 * (fbm(x / 60, z / 60, s3 + 7, 2) - .5) - y) * m;
   const c = creek(x, z) * core(x, z) * fade;
   return c > 0 ? flat + (t.bed - flat) * c : flat;
  };
  // No trees on the marsh: cordgrass to the creeks, the live oaks on the
  // hammocks above it (the first pictures stood the creeks in woods).
  out.treeKeep = (x, z) => 1 - Math.max(creek(x, z), .9) * core(x, z);
  return out;
 },
 // PLAYAS: the Llano Estacado -- a tableland so flat the roll is a few
 // metres over a course, pocked by round shallow playa lakes, dry most of
 // the year, their floors bare clay (generator 81; Llano Estacado,
 // Wikipedia; Marfa Public Radio: about 17 acres on average; a Castro
 // County study: mostly 3.2-28.3 ha). The native drifts as the prairie's.
 playas(o, seed) {
  const sp = saltOf(seed, 'playa-grass'), sr = saltOf(seed, 'playa-roll'), near = scatter(o, seed, 'playa');
  // A flat floor and a short rim: a playa is a pan, not a bowl.
  const pan = (x, z) => { const {d, m} = near(x, z); return m ? {f: 1 - smooth(.62, 1, d), m} : {f: 0, m: null}; };
  return {
   lift: (x, z) => {
    const {f, m} = pan(x, z);
    return o.roll * (fbm(x / 300, z / 300, sr, 2) - .5) * 2 - (m ? m.size * f : 0);
   },
   raw: (x, z) => {
    const {f} = pan(x, z);
    return [smooth(o.cover, o.cover + .2, fbm(x / 110, z / 110, sp, 3)) * (1 - f), smooth(.55, .8, f)];
   },
   treeKeep: (x, z) => 1 - pan(x, z).f,
  };
 },
 // A MOOR: heather in great dark drifts (Haunted Hollow's until it was removed,
 // 2 November 2026; any heath may ask for it).
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
// there, rise over run, from heights 1.5 m either side, and the height function.
export function wildField(recipe, ex, ez, height) {
 const {Sx, Sz} = ownerAtlasSize(ex, ez), a = new Uint8Array(Sx * Sz), b = new Uint8Array(Sx * Sz);
 if (!recipe.kinds.a && !recipe.kinds.b) return null;
 const E = 1.5;
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  const slope = recipe.needsSlope ? Math.hypot(height(x + E, z) - height(x - E, z), height(x, z + E) - height(x, z - E)) / (2 * E) : 0;
  const [ra, rb] = recipe.raw(x, z, recipe.needsHeight ? height(x, z) : undefined, slope, height);
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
// THE BIG MOUNTAIN'S HEADING (`ringMassif`, Desert Mountain): the angle from the course's middle
// toward it, from the seed. landscape-edge.js stands the mountain there and course.js tilts the
// land up toward it (`tilt`), so the two must read the same number.
// THE RANGES' FIELD (`knobs` `range`): their share of full height at (x, z), 0 on the floor. Its own
// function because the routing reads it before any ground exists (routing.js, Desert Mountain round
// 6: holes routed along the floor between the ranges, so they wrap round them).
// THE BADLANDS' FORMATIONS FOR THE ROUTING (`routed`; the owner, 8 November 2026: "Let's do the same
// kind of desert routing work while still keeping the badlands look"): where the carving stands over
// 2 m, rising to 1 by 12 m, from the same field the landform draws (`carvedField` 'near'), so
// routing.js treats the formations as Desert Mountain's ranges -- no hole on them, most holes up
// against them. Null for a recipe without it. PLACED.
export function formationShareOf(o, seed) {
 if (o?.type !== 'badlands' || !o.routed) return null;
 const {height} = carvedField(o, seed, 'near');
 return (x, z) => smooth(2, 12, height(x, z));
}

export function rangeShareOf(o, seed) {
 const R = o?.range;
 if (!R) return null;
 const sr = saltOf(seed, 'range'), ra = hash(3, 5, sr) * Math.PI, rc = Math.cos(ra), rs = Math.sin(ra);
 // ON THE BIG MOUNTAIN'S SIDE ONLY (`side`, metres; the owner, 8 November 2026, a trial): the ranges
 // stop at a wavy line through the routing's start, square to the big mountain's heading
 // (`massifHeading`), fading over `side` metres; past it they stand thicker (their threshold
 // lowered by `sideBoost`), a mountain front -- so the holes, which keep off the ranges, gather on
 // the open side and run along its foot. PLACED.
 const ma = R.side ? massifHeading(seed) : 0, mx = Math.cos(ma), mz = Math.sin(ma), boost = R.sideBoost ?? .08;
 const sideOf = !R.side ? () => 1 : (x, z) => smooth(-R.side, R.side * .3, x * mx + z * mz + (fbm((z * mx - x * mz) / 700, 3.7, sr + 3, 2) - .5) * R.side * 2);
 return (x, z) => {
  const wx = (fbm(x / 900, z / 900, sr + 1, 2) - .5) * R.scale * .8, wz = (fbm(x / 900 + 4.1, z / 900 - 2.3, sr + 2, 2) - .5) * R.scale * .8;
  const px = x + wx, pz = z + wz, u = (px * rc + pz * rs) / (R.scale * R.stretch), v = (pz * rc - px * rs) / R.scale;
  if (!R.side) return smooth(R.from, R.to, fbm(u, v, sr, 3));
  const t = sideOf(x, z);
  return t <= 0 ? 0 : t * smooth(R.from - boost * t, R.to - boost * t, fbm(u, v, sr, 3));
 };
}

export function massifHeading(seed) {
 const s = saltOf(seed, 'massif'), v = Math.sin((s + 7919) * 12.9898) * 43758.5453;
 return (v - Math.floor(v)) * 6.2832;
}

export function wildGate(d, gate) {
 if (!gate) return 0;
 const t = Math.max(0, Math.min(1, (d - gate.near) / gate.ramp));
 return t * t * (3 - 2 * t);
}

// The ground type at a rough point, or null. `d` is nearest().d, signed.
// Inside the field's own extent only, as the shader asks. `open` (0 to 1) opens
// every gate that far whatever `d` says: a rock tee's outcrop (course.js,
// *Tees up on the rock*) is wild ground though it stands in the corridor.
export function wildGround(field, recipe, x, z, d, open = 0) {
 const {kinds, gates} = recipe;
 if (!field || Math.abs(x) >= field.ex || Math.abs(z) >= field.ez) return null;
 const g = q => Math.max(wildGate(d, q), q ? open : 0);
 if (kinds.a && wildAt(field, 'a', x, z) * g(gates.a) >= .5) return kinds.a;
 if (kinds.b && wildAt(field, 'b', x, z) * g(gates.b) >= .5) return kinds.b;
 if (kinds.floor && g(gates.floor) >= .5) return kinds.floor;
 return null;
}
