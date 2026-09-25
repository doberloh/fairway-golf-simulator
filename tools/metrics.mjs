import {greenApproaches, GREEN} from '../src/course.js';
import {GROUND_PLANTS} from '../src/species.js';
// What a generated course is measured on.
//
// EVERY METRIC IMPORTS ITS GEOMETRY FROM `src`. It never reimplements it.
//
// This is the whole discipline of the file. Four separate measurements in this
// project's history have lied, and every one of them lied because it computed
// the thing it was checking rather than calling it:
//
//   - pond clearance scaled a normalised oval distance by the MINOR axis, which
//     understates the real distance badly along the major one, and reported
//     eight breaches that had never happened
//   - the sightline ray was drawn straight through world space while the
//     generator drew it along the centreline; on a dogleg those are different
//     lines over different ground
//   - three beach measurements in a row disagreed with each other before a
//     mown-centreline metric settled it
//   - a lake-on-pond check consulted only the lakes placed in that pass
//
// A number that is wrong is worse than no number, because it is acted on. So
// `fairwayWidth`, `ovalRadius`, `sightline` and the rest come from the module
// under test, and a metric's job is only to sample and count.
import {ovalRadius, fairwayWidth, sightline, localSurface, teePad, teeBox,
 launchCorridors, blocksLaunch, teeFans, inTeeFan,
 TEE_PAD, TEE_APRON, TEE_APRON_SCALE, TEE_ROUND, TEE_EYE} from '../src/course.js';

const DEG = 180 / Math.PI;

// Surface normal of the finished terrain, as the shader would see it.
const normalAt = (w, x, z, e = 1.5) => {
 const gx = (w.height(x + e, z) - w.height(x - e, z)) / (2 * e);
 const gz = (w.height(x, z + e) - w.height(x, z - e)) / (2 * e);
 const l = Math.hypot(gx, gz, 1);
 return {x: -gx / l, y: 1 / l, z: -gz / l, slope: Math.hypot(gx, gz)};
};

// A body's real boundary in world coordinates, not an approximation of it.
const boundary = (h, p, n = 64) => Array.from({length: n}, (_, i) => {
 const e = ovalRadius(p, i * Math.PI * 2 / n);
 return h.toWorld({x: p.x + e.x, z: p.z + e.z});
});

// Each metric returns named series (distributions, summarised by the harness)
// and named counts (summed). An `invariant` is a count that must stay at zero;
// the harness reports those separately because they are rules, not readings.
export const METRICS = {

 surrounds: {
  describe: 'planting density around tees and greens, against the course average -- NEEDS `--set trees=65`',
  run(w) {
   // WHY THIS IS A METRIC AND NOT A SCRIPT. It gets asked every time planting
   // or corridor width moves, across eight biomes and a width slider, and each
   // answer costs a course. `greenApproaches` comes from `src` rather than
   // being recomputed here, because four measurements in this project have
   // lied and every one recomputed what it was checking.
   //
   // ONE READING PER COURSE, POOLED OVER EVERY TEE. A first version measured
   // each tee's own 20 m circle and was useless: a circle that small holds a
   // handful of trees, so every reading was either zero or a spike and the
   // median came out at zero on a course that was planted perfectly well.
   //
   // Density is per hectare of ROUGH, not of ground. Mown turf can never hold a
   // tree, so counting it in the denominator understates how planted the rest
   // is and makes a surround look emptier than it is.
   const series = {teeSurround: [], greenBack: [], greenApproach: []};
   const counts = {holes: 0, tees: 0, greens: 0};
   const trunked = w.trees.filter(t => !GROUND_PLANTS.has(t.kind));
   // THE STANDARD FIXTURES BUILD COURSES WITH `trees: 0`, because every other
   // metric measures terrain and routing, where planting is irrelevant and
   // costs time. So this one reports NOTHING rather than a shelf of zeros that
   // reads as a clear-cut -- the first version did exactly that and tripped its
   // own invariant on courses that simply had no trees.
   //   node tools/bench.mjs surrounds --set trees=65
   if (trunked.filter(t => !t.feature).length < 50) return {series: {}, counts: {}, invariants: {}};
   // Deterministic: the same course must give the same reading twice.
   let seed = 20260923;
   const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

   let n = 0, rough = 0;
   for (let i = 0; i < 20000; i++) {
    const x = (rnd() - .5) * w.halfX * 2, z = (rnd() - .5) * w.halfZ * 2;
    n++; if (w.surface(x, z) === 'rough') rough++;
   }
   const roughHa = (w.halfX * 2) * (w.halfZ * 2) * (rough / n) / 1e4;
   const average = roughHa > 0 ? trunked.length / roughHa : 0;

   // Pooled density in a ring round a set of centres, as a multiple of average.
   const pooled = (centres, radius, pick) => {
    if (!centres.length || !average) return null;
    let roughHits = 0, samples = 0;
    for (const c of centres) for (let i = 0; i < 400; i++) {
     const a = rnd() * 6.283, r = Math.sqrt(rnd()) * radius;
     samples++;
     if (w.surface(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r) === 'rough') roughHits++;
    }
    const area = centres.length * Math.PI * radius * radius / 1e4 * (roughHits / samples);
    if (!area) return null;
    // Deduped: two tees of one complex share ground, and a tree between them is
    // one tree, not two.
    const seen = new Set();
    for (let i = 0; i < trunked.length; i++) {
     const t = trunked[i];
     for (const c of centres) {
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d < radius && (!pick || pick(t, c, d))) { seen.add(i); break; }
     }
    }
    return (seen.size / area) / average;
   };

   const tees = [];
   for (const h of w.holes) {
    counts.holes++;
    for (const tee of Object.values(h.tees || {})) { counts.tees++; tees.push(h.toWorld(tee)); }
   }
   const teeVal = pooled(tees, 20);
   if (teeVal !== null) series.teeSurround.push(teeVal);

   // Greens, split by the side the shot comes in from: the approach is meant to
   // stay open at every setting of `greenTrees`, the back and flanks are not.
   const guards = greenApproaches(w.holes);
   counts.greens = guards.length;
   const facing = (t, g) => {
    const lx = t.x - g.x, lz = t.z - g.z, d = Math.hypot(lx, lz);
    return d > 1e-6 && (lx * g.dx + lz * g.dz) / d >= Math.cos(GREEN.arc);
   };
   const back = pooled(guards, 45, (t, g) => !facing(t, g));
   const front = pooled(guards, 45, facing);
   if (back !== null) series.greenBack.push(back);
   if (front !== null) series.greenApproach.push(front);

   // A tee surround at a quarter of the course average is the clear-cut this
   // work removed; it must not come back at any fairway width.
   const invariants = {teeSurroundClearCut: teeVal !== null && teeVal < .25 ? 1 : 0};
   return {series, counts, invariants};
  },
 },


 tees: {
  describe: 'tee complex levelling, pad flatness and the ground around a pad',
  run(w) {
   const series = {step: [], padSpread: [], collarRelief: [], normalJump: [], groundSlope: [],
    siteSpread: [], slid: [], lift: [], lateral: []};
   const counts = {holes: 0, tees: 0, sited: 0, needsWork: 0, raised: 0};
   // What the generator decided, read back rather than inferred: how uneven
   // each chosen site was before anything was built, how far it had to move to
   // be found, and how much it was then raised.
   for (const t of w.teeSites || []) {
    series.siteSpread.push(t.spread); series.slid.push(t.slid); series.lift.push(t.lift);
    if (t.slid > 1) counts.sited++;
    if (t.spread > 1.5) counts.needsWork++;
    if (t.lift > .05) counts.raised++;
   }
   const invariants = {teeBelowTheOneInFront: 0, padOnGroundItMayNotUse: 0, markerOffItsPad: 0};
   for (const h of w.holes) {
    counts.holes++;
    // Object key order is back tee first.
    const ys = Object.values(h.tees).map(t => {const q = h.toWorld(t); return w.height(q.x, q.z);});
    for (let i = 0; i < ys.length - 1; i++) {
     series.step.push(ys[i] - ys[i + 1]);
     if (ys[i] < ys[i + 1] - 1e-6) invariants.teeBelowTheOneInFront++;
    }
    // Free to move, but not on to a green, into water, into sand, or on to
    // another hole. Checked round the collar, because half a pad on a green is
    // as wrong as all of it.
    const pads = Object.values(h.tees).map(t => ({t, p: teePad(t)})).filter(e => e.p);
    for (const {t, p} of pads) {
     // Round the collar's outline, corners included.
     for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, c = Math.cos(a), n = Math.sin(a);
      const hx = TEE_APRON.x, hz = p.rz * TEE_APRON_SCALE;
      const k = Math.min(Math.abs(c) > 1e-6 ? hx / Math.abs(c) : 1e9, Math.abs(n) > 1e-6 ? hz / Math.abs(n) : 1e9);
      const lx = t.x + c * k, lz = p.z + n * k;
      const surf = localSurface(h, lx, lz);
      if (surf === 'green' || surf === 'fringe' || surf === 'water' || surf === 'sand')
       invariants.padOnGroundItMayNotUse++;
     }
    }
    for (const t of Object.values(h.tees)) {
     counts.tees++;
     series.lateral.push(Math.abs(t.x - h.center(t.z)));
     // Every marker must stand on some pad, its own or a neighbour's.
     if (!pads.some(({t: o, p}) => teeBox(t.x - o.x, t.z - p.z, TEE_PAD.x, p.rz, TEE_ROUND) < 0))
      invariants.markerOffItsPad++;
     const pad = [], collar = [];
     for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      const p = h.toWorld({x: t.x + Math.cos(a) * TEE_PAD.x * .85, z: t.z + Math.sin(a) * TEE_PAD.z * .85});
      const c = h.toWorld({x: t.x + Math.cos(a) * TEE_APRON.x * .95, z: t.z + Math.sin(a) * TEE_APRON.z * .95});
      pad.push(w.height(p.x, p.z)); collar.push(w.height(c.x, c.z));
     }
     series.padSpread.push(Math.max(...pad) - Math.min(...pad));
     series.collarRelief.push(Math.max(...collar) - Math.min(...collar));
     // The crease a square plateau leaves under an oval of paint.
     let jump = 0, slope = 0;
     for (const scale of [1.05, 1.3, 1.8, 2.4]) {
      let prev = null;
      for (let i = 0; i <= 120; i++) {
       const a = i * Math.PI / 60;
       const q = h.toWorld({x: t.x + Math.cos(a) * TEE_PAD.x * scale, z: t.z + Math.sin(a) * TEE_PAD.z * scale});
       const n = normalAt(w, q.x, q.z);
       slope = Math.max(slope, n.slope);
       if (prev) jump = Math.max(jump, Math.acos(Math.min(1, n.x * prev.x + n.y * prev.y + n.z * prev.z)) * DEG);
       prev = n;
      }
     }
     series.normalJump.push(jump);
     series.groundSlope.push(Math.atan(slope) * DEG);
    }
   }
   return {series, counts, invariants};
  },
 },

 // WHAT IS ACTUALLY STANDING IN A TEE SHOT, counted on the finished world.
 //
 // The generator refuses to PLACE anything in a launch corridor, so this looks
 // like a metric that can only ever read zero. It is not, and that is the
 // point: it calls the same `blocksLaunch` against the world that was built,
 // which is the only thing that can catch a rule applied to one kind of body
 // and not another. Rocks were tested as a dimensionless POINT against a
 // ceiling that was not their height, and never consulted the tee fan at all,
 // so the generator's own answer was "nothing is in the way" while boulders
 // stood in the shot. Reported as blocked tee boxes in desert and mountain --
 // the two biomes with the most rocks, at twice the scale of anywhere else.
 //
 // Rocks are counted on the standard fixtures because `scatter.rocks` does not
 // depend on the trees setting. Trees need `--set trees=65`.
 teeclear: {
  describe: 'trees and rocks standing in a tee shot or in the view from the tees',
  run(w) {
   const launch = launchCorridors(w.holes, (x, z) => w.height(x, z));
   const fans = teeFans(w.holes);
   const counts = {rocks: 0, trees: 0, rocksChecked: 0, treesChecked: 0};
   // An invariant, not a reading: the generator's own placement rules say none
   // of this can happen, so any of it is a rule applied unevenly.
   const invariants = {rockInATeeShot: 0, rockInTheTeeView: 0,
    treeInATeeShot: 0, treeInTheTeeView: 0};
   for (const r of w.rocks || []) {
    // A FEATURE is placed in the fairway on purpose -- the lone cypress, the
    // boulder you play around -- and it obeys its own standoff rule rather than
    // this one. Counting it here would report the setting working as a fault,
    // which is how a metric starts lying about the thing it exists to watch.
    if (r.feature) continue;
    counts.rocksChecked++;
    // The stone's own crown and its own width, which is what a ball meets --
    // never `scale`, which is neither.
    if (blocksLaunch(launch, r.x, r.z, r.y, r.top, r.reach)) {counts.rocks++; invariants.rockInATeeShot++;}
    else if (inTeeFan(fans, r.x, r.z, r.reach)) invariants.rockInTheTeeView++;
   }
   for (const t of w.trees || []) {
    // Ground cover has no trunk and cannot block anything; a feature tree is
    // placed in the fairway ON PURPOSE and gets only the near stretch, which
    // `blocksLaunch` already knows about through its own standoff.
    if (GROUND_PLANTS.has(t.kind) || t.feature) continue;
    counts.treesChecked++;
    const girth = Math.min(t.h * .027, 3.6);
    if (blocksLaunch(launch, t.x, t.z, t.y, t.y + t.h, girth)) {counts.trees++; invariants.treeInATeeShot++;}
    else if (inTeeFan(fans, t.x, t.z, girth)) invariants.treeInTheTeeView++;
   }
   return {series: {}, counts, invariants};
  },
 },

 blind: {
  describe: 'how much ground stands between a tee and its landing area',
  run(w) {
   const series = {blue: [], white: [], red: []};
   const counts = {blockedOver1m: 0, blockedOver3m: 0, shots: 0};
   for (const h of w.holes) for (const [name, t] of Object.entries(h.tees)) {
    const q = h.toWorld(t);
    // The same call the generator makes, against the finished terrain.
    const {over} = sightline(h, t, w.height(q.x, q.z) + TEE_EYE, (x, z) => w.height(x, z));
    if (series[name]) series[name].push(over);
    counts.shots++;
    if (over > 1) counts.blockedOver1m++;
    if (over > 3) counts.blockedOver3m++;
   }
   return {series, counts, invariants: {}};
  },
 },

 channels: {
  describe: 'where rivers and creeks run, how far, and what they keep clear of',
  run(w) {
   const series = {length: [], turning: [], greenClearance: [], pondGap: []};
   const counts = {requested: 0, placed: 0, endEdge: 0, endSink: 0, endSea: 0,
    endTrimmed: 0, endConfluence: 0, endStall: 0};
   const invariants = {stationInsideAFairway: 0, stationOnAGreen: 0, waterInsideAnotherBody: 0};
   counts.requested += w.streams.requested;
   for (const st of w.streams.streams) {
    counts.placed++;
    const key = 'end' + st.end[0].toUpperCase() + st.end.slice(1);
    if (key in counts) counts[key]++;
    let run = 0, turn = 0;
    for (let i = 1; i < st.points.length; i++) {
     const a = st.points[i - 1], b = st.points[i];
     run += Math.hypot(b.x - a.x, b.z - a.z);
     if (i > 1) {
      const p = st.points[i - 2];
      const t = Math.atan2((a.x - p.x) * (b.z - a.z) - (a.z - p.z) * (b.x - a.x),
       (a.x - p.x) * (b.x - a.x) + (a.z - p.z) * (b.z - a.z));
      turn += Math.abs(t);
     }
    }
    series.length.push(run);
    series.turning.push(turn / (Math.PI * 2));
    for (const p of st.points) for (const h of w.holes) {
     const q = h.toLocal(p);
     if (q.z < 0 || q.z > h.length) continue;
     const off = q.x - h.center(q.z), half = fairwayWidth(h, q.z, 0, Math.sign(off) || 1);
     if (half && Math.abs(off) < half + p.width * .5) invariants.stationInsideAFairway++;
    }
   }
   for (const h of w.holes) {
    const g = h.worldGreen ?? h.worldPin, radius = h.greenSize * h.greenAspect;
    let near = Infinity;
    for (const st of w.streams.streams) for (const p of st.points)
     near = Math.min(near, Math.hypot(p.x - g.x, p.z - g.z) - p.width * .5 - radius);
    if (Number.isFinite(near)) {
     series.greenClearance.push(near);
     if (near < 0) invariants.stationOnAGreen++;
    }
    for (const p of h.ponds) {
     // A channel's own terminal pond is the one body it is supposed to reach.
     if (p.sink) continue;
     const edge = boundary(h, p, 48);
     let gap = Infinity;
     for (const st of w.streams.streams) for (const q of st.points) for (const v of edge)
      gap = Math.min(gap, Math.hypot(q.x - v.x, q.z - v.z) - q.width * .5);
     if (Number.isFinite(gap)) {
      series.pondGap.push(gap);
      if (gap < 0) invariants.waterInsideAnotherBody++;
     }
    }
   }
   return {series, counts, invariants};
  },
 },

 ponds: {
  describe: 'how far a pond reaches into play, and whether bodies overlap',
  run(w) {
   const series = {bite: []};
   const counts = {bodies: 0, bitingIn: 0, terminal: 0};
   const invariants = {pondCrossesAFairway: 0, overlappingBodies: 0};
   const all = [];
   for (const h of w.holes) for (const p of h.ponds) {
    counts.bodies++;
    if (p.sink) counts.terminal++;
    all.push({h, p});
    let reach = -Infinity, far = false;
    for (let i = 0; i < 96; i++) {
     const e = ovalRadius(p, i * Math.PI / 48), x = p.x + e.x, z = p.z + e.z;
     if (z < 0 || z > h.length) continue;
     const off = x - h.center(z), half = fairwayWidth(h, z, 0, Math.sign(off) || 1);
     if (!half) continue;
     reach = Math.max(reach, half - Math.abs(off));
     if (Math.sign(off) !== Math.sign(p.x - h.center(z)) && Math.abs(off) > half * .5) far = true;
    }
    if (reach > 0) {counts.bitingIn++; series.bite.push(reach);}
    if (far) invariants.pondCrossesAFairway++;
   }
   // Boundary against boundary, both ways, because one oval can sit inside
   // another without either's sampled rim landing in the other.
   const hits = (a, b) => boundary(a.h, a.p, 32).some(q => {
    const l = b.h.toLocal(q);
    return Math.hypot(l.x - b.p.x, l.z - b.p.z) < 1e-9 ||
     ovalContains(b.p, l.x, l.z);
   });
   for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    if (hits(all[i], all[j]) || hits(all[j], all[i])) invariants.overlappingBodies++;
   return {series, counts, invariants};
  },
 },
};

// Inside a body's own oval, by the same profile everything else reads.
function ovalContains(p, x, z) {
 const dz = z - p.z;
 if (Math.abs(dz) > p.rz) return false;
 let best = Infinity;
 for (let i = 0; i < 24; i++) {
  const e = ovalRadius(p, i * Math.PI / 12);
  best = Math.min(best, Math.hypot(x - (p.x + e.x), z - (p.z + e.z)));
 }
 // A point is inside when it is nearer the centre than the rim in its own
 // direction; the sampled rim gives that without needing the profile inverted.
 const a = Math.atan2(dz, x - p.x), e = ovalRadius(p, a);
 return Math.hypot(x - p.x, dz) < Math.hypot(e.x, e.z) && best > 0;
}

export const METRIC_NAMES = Object.keys(METRICS);
