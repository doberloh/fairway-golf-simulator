// What tests/water-keep-out.test.mjs reads from each course, measured on the
// thread that built it (worlds.mjs `measured`). Each block is the loop its
// test ran over the worlds, answering in numbers instead of asserting.
import {ovalRadius, fairwayWidth} from '../../src/course.js';

export function measure(w) {
 const m = {};
 // No channel runs over a green.
 m.holes = 0; m.greenWorst = Infinity;
 for (const h of w.holes) {
  m.holes++;
  const g = h.worldGreen ?? h.worldPin, radius = h.greenSize * h.greenAspect;
  for (const st of w.streams.streams) for (const p of st.points)
   m.greenWorst = Math.min(m.greenWorst, Math.hypot(p.x - g.x, p.z - g.z) - p.width * .5 - radius);
 }
 // No channel crosses a playing corridor.
 m.inside = 0; m.channels = 0;
 for (const st of w.streams.streams) {
  m.channels++;
  for (const p of st.points) for (const h of w.holes) {
   const q = h.toLocal(p);
   if (q.z < 0 || q.z > h.length) continue;
   const off = q.x - h.center(q.z), half = fairwayWidth(h, q.z, 0, Math.sign(off) || 1);
   if (half && Math.abs(off) < half + p.width * .5) m.inside++;
  }
 }
 // No channel runs into standing water it did not create.
 m.pondWorst = Infinity; m.bodies = 0;
 for (const h of w.holes) for (const p of h.ponds) {
  if (p.sink) continue;
  m.bodies++;
  const edge = Array.from({length: 48}, (_, i) => {
   const e = ovalRadius(p, i * Math.PI / 24);
   return h.toWorld({x: p.x + e.x, z: p.z + e.z});
  });
  for (const st of w.streams.streams) for (const q of st.points) for (const v of edge)
   m.pondWorst = Math.min(m.pondWorst, Math.hypot(q.x - v.x, q.z - v.z) - q.width * .5);
 }
 // A pond bites into a fairway but never crosses one.
 m.crossed = 0; m.bit = 0; m.total = 0; m.deepest = 0;
 for (const h of w.holes) for (const p of h.ponds) {
  if (p.sink) continue;
  m.total++;
  let reach = -Infinity, far = false;
  for (let i = 0; i < 96; i++) {
   const e = ovalRadius(p, i * Math.PI / 48), x = p.x + e.x, z = p.z + e.z;
   if (z < 0 || z > h.length) continue;
   const off = x - h.center(z), side = Math.sign(off) || 1, half = fairwayWidth(h, z, 0, side);
   if (!half) continue;
   reach = Math.max(reach, half - Math.abs(off));
   if (Math.sign(off) !== Math.sign(p.x - h.center(z)) && Math.abs(off) > half * .5) far = true;
  }
  if (reach > 0) { m.bit++; m.deepest = Math.max(m.deepest, reach); }
  if (far) m.crossed++;
 }
 // A channel that ends in a hollow ends in a real pond: what each terminal
 // pond fails of an ordinary pond's checks, by name.
 const made = w.holes.flatMap(h => h.ponds.filter(p => p.sink).map(p => ({h, p})));
 m.made = made.length;
 m.sinks = w.streams.streams.filter(st => st.end === 'sink').length;
 m.terminalFaults = [];
 for (const {h, p} of made) {
  if (!(p.level !== undefined && p.shoreWidth > 0 && p.reachX > 0 && p.banks.length === 257)) m.terminalFaults.push('missing an ordinary pond\'s fit');
  const c = h.toWorld(p);
  if (w.surface(c.x, c.z) !== 'water') m.terminalFaults.push('a terminal pond must play as water');
  if (!(w.height(c.x, c.z) < p.level - .2)) m.terminalFaults.push('a terminal pond must have a basin under it');
  if (!(h.ponds.length <= 4)) m.terminalFaults.push('the per-hole atlas limit still holds');
 }
 return m;
}
