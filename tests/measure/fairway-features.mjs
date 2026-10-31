// What tests/fairway-features.test.mjs reads from each course, measured on the
// thread that built it (worlds.mjs `measured`). Each block is its test's loop
// over one course, the assertions turned into the faults they would report.
import {FEATURE, LAUNCH, launchCorridors, fairwayWidth} from '../../src/course.js';

const featuresOf = w => [
 ...w.trees.filter(t => t.feature).map(t => ({...t, reach: t.r})),
 ...w.rocks.filter(r => r.feature),
];

export function measure(w, {biome, seed}) {
 const fs = featuresOf(w), m = {holes: w.holes.length, route: [], tee: [], green: [], solid: []};
 // The slider governs how often a hole gets one: HOLES touched, not objects
 // (a rock cluster is several stones).
 const hit = new Set();
 for (const f of fs) {
  const near = w.holes.map((h, i) => [i, h.toLocal(f)])
   .sort((p, q) => Math.abs(p[1].x) - Math.abs(q[1].x))[0];
  hit.add(near[0]);
 }
 m.marked = hit.size;
 // Every feature leaves a playable route past it.
 for (const f of fs) {
  const owner = w.holes
   .map(h => ({h, p: h.toLocal(f)}))
   .filter(({p, h}) => p.z > 0 && p.z < h.length)
   .sort((a, b) => Math.abs(a.p.x) - Math.abs(b.p.x))[0];
  if (!owner) continue;
  const {h, p} = owner;
  const half = fairwayWidth(h, p.z);
  if (half <= 0) continue;
  const centre = h.center(p.z);
  const left = (centre + half) - (p.x + f.reach);
  const right = (p.x - f.reach) - (centre - half);
  if (!(Math.max(left, right) >= FEATURE.gap - 1.5))
   m.route.push(`${biome}/${seed} hole ${h.hole + 1}: only ${Math.max(left, right).toFixed(1)} m of room either side ` +
    `(left ${left.toFixed(1)}, right ${right.toFixed(1)}, corridor half-width ${half.toFixed(1)})`);
 }
 // No feature stands where a tee shot cannot get past it.
 const APEX_PER = 30 / 210;
 const corr = launchCorridors(w.holes, w.height);
 for (const f of fs) {
  const top = f.top ?? (f.y + f.h);
  for (const c of corr) {
   const lx = f.x - c.x, lz = f.z - c.z;
   const along = lx * c.dx + lz * c.dz;
   if (along < 0 || along > Math.min(c.carry, FEATURE.standoff)) continue;
   const off = Math.abs(lx * c.dz - lz * c.dx);
   if (off > Math.max(LAUNCH.near, along * Math.tan(LAUNCH.angle)) + f.reach) continue;
   const t = along / c.carry;
   const ballY = c.groundY + 4 * (c.carry * APEX_PER) * t * (1 - t);
   if (!(ballY < f.y || ballY > top))
    m.tee.push(`${biome}/${seed}: a feature ${f.y.toFixed(0)}-${top.toFixed(0)} m tall stands ${along.toFixed(0)} m ` +
     `off a tee, ${off.toFixed(1)} m off the line, with the ball at ${ballY.toFixed(1)} m`);
  }
 }
 // No feature crowds the green (judged only on the hole it belongs to).
 for (const f of fs) for (const h of w.holes) {
  const g = h.worldGreen, d = Math.hypot(f.x - g.x, f.z - g.z);
  const p = h.toLocal(f);
  if (p.z < 0 || p.z > h.length || Math.abs(p.x) > 60) continue;
  if (!(d > FEATURE.greenKeep - 25)) m.green.push(`${biome}/${seed} hole ${h.hole + 1}: a feature sits ${d.toFixed(0)} m from the green`);
 }
 // Features are solid.
 m.features = fs.length;
 for (const f of fs) {
  if (!(f.reach > 0)) m.solid.push('a feature with no reach cannot be hit');
  if (!Number.isFinite(f.x + f.z + f.y)) m.solid.push('a feature has a non-finite coordinate');
 }
 m.featureTrees = w.trees.some(t => t.feature);
 return m;
}
