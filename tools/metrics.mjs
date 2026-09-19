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
