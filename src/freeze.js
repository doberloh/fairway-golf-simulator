// FREEZING A GENERATED COURSE (the course builder, stage 1; docs/COURSE_BUILDER.md,
// *Freezing a generated course*).
//
// Door 1's *Take it over*: a generated world becomes a built document
// (course-doc.js), which the builder edits and the game plays from the file
// with no generator (built-world.js). The comparison of the two worlds --
// tests/freeze.test.mjs, tools/freeze-compare.mjs -- is the proof that a built
// world is the course it came from.
//
// WHAT IS TAKEN, AND HOW:
//  - The land: `height` (the ground the ball feels, every earthwork and blend
//    in it) on a grid at the ground mesh's own third (about 1 m), over the
//    whole ground the mesh covers; every green and tee again at 0.25 m.
//  - The surfaces the holes are made of, TRACED FROM THEIR OWN SHAPES, not
//    sampled: greens from `greenPoint`, bunkers and collection areas from
//    `ovalRadius`, tee pads and their collars from the pad boxes, the fairway
//    and semi-rough corridors from `fairwayWidth` as the map draws them, cart
//    paths from their lines and widths. Exact to the outline.
//  - Ponds and large lakes from their ovals, with their levels; creeks and
//    rivers as the generator's own stations.
//  - What has no shape -- the landscape's ground types, a coast's beach and
//    the dunes' blowouts -- from `surface` on a 1 m grid, traced into outlines
//    (contour.js), each ground type its own outlines.
//  - Every tree a ball can meet, with its trunk and crown, and its species.
//  - NOT TAKEN (the first version): houses, the clubhouse, boulders, the
//    walls, cart-path furniture, markings, life. Boulders were solid, so a
//    frozen course plays without them; said when an Architect course is
//    taken over.
import {greenPoint, greenRadius, ovalRadius, teePad, TEE_PAD, TEE_ROUND, TEE_APRON, TEE_APRON_SCALE, fairwayWidth} from './course.js';
import {trunkRadius} from './physics.js';
import {GROUND_PLANTS} from './species.js';
import {GROUND_KINDS} from './grounds.js';
import {maskRings, simplify} from './contour.js';
import {CREEK_FIELDS} from './course-doc.js';

export const FREEZE = {patch: .25, raster: 1, tol: .12, greenPoints: 128, ovalPoints: 64};
const TAU = Math.PI * 2;
const r2 = v => Math.round(v * 100) / 100;

function grid(sample, x0, z0, cell, nx, nz, cellZ = cell) {
 const heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = sample(x0 + i * cell, z0 + j * cellZ);
 return {x0, z0, cell, cellZ, nx, nz, heights};
}
// A rounded box in a tee pad's frame, as `teeBox` measures it, into the
// hole's frame and then the world.
function teeRing(h, t, p, hx, hz, r) {
 const pts = [];
 const corners = [[hx - r, hz - r, 0], [-(hx - r), hz - r, 1], [-(hx - r), -(hz - r), 2], [hx - r, -(hz - r), 3]];
 for (const [cx, cz, q] of corners) for (let k = 0; k <= 6; k++) {
  const a = q * Math.PI / 2 + k / 6 * Math.PI / 2, across = cx + Math.cos(a) * r, along = cz + Math.sin(a) * r;
  const dx = across * p.uz + along * p.ux, dz = -across * p.ux + along * p.uz;
  const w = h.toWorld({x: t.x + dx, z: p.z + dz});
  pts.push([r2(w.x), r2(w.z)]);
 }
 return pts;
}
const ovalRing = (h, o, n = FREEZE.ovalPoints, margin = 0) => Array.from({length: n}, (_, i) => {
 const v = ovalRadius(o, i / n * TAU, margin), w = h.toWorld({x: o.x + v.x, z: o.z + v.z});
 return [r2(w.x), r2(w.z)];
});
const greenRing = (h, extra = 0) => Array.from({length: FREEZE.greenPoints}, (_, i) => {
 const a = i / FREEZE.greenPoints * TAU, g = greenPoint(h, a, greenRadius(h, a) + extra), w = h.toWorld(g);
 return [r2(w.x), r2(w.z)];
});
// A corridor as the map draws it: the centre line plus and minus the
// fairway's width with `margin`, from `z0` to `z1`, every 2 m.
function corridor(h, margin, z0, z1) {
 if (!(z1 > z0 + 1)) return null;
 const n = Math.max(2, Math.ceil((z1 - z0) / 2)), left = [], right = [];
 for (let i = 0; i <= n; i++) {
  const z = z0 + (z1 - z0) * i / n, c = h.center(z);
  const wl = fairwayWidth(h, z, margin, -1), wr = fairwayWidth(h, z, margin, 1);
  if (!(wl > 0) && !(wr > 0)) continue;
  const a = h.toWorld({x: c - Math.max(0, wl), z}), b = h.toWorld({x: c + Math.max(0, wr), z});
  left.push([r2(a.x), r2(a.z)]); right.push([r2(b.x), r2(b.z)]);
 }
 return left.length >= 2 ? [[...left, ...right.reverse()]] : null;
}
function pathRing(path) {
 const pts = path.points, half = path.width / 2, left = [], right = [];
 for (let i = 0; i < pts.length; i++) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  left.push([r2(pts[i].x + nx * half), r2(pts[i].z + nz * half)]); right.push([r2(pts[i].x - nx * half), r2(pts[i].z - nz * half)]);
 }
 return left.length >= 2 ? [[...left, ...right.reverse()]] : null;
}
const roleOf = kind => GROUND_PLANTS.has(kind) ? 3 : ['pine', 'cedar', 'spruce', 'fir', 'hemlock', 'redcedar', 'redwood'].includes(kind) ? 1 : ['palm', 'hala'].includes(kind) ? 4 : 2;

// `onStep(what, fraction)`: progress, for the builder's wait.
export function freezeWorld(w, {name = 'Frozen course', onStep = () => {}} = {}) {
 const s = w.settings, ex = w.groundGrid.halfX, ez = w.groundGrid.halfZ;
 onStep('The land', 0);
 // The land at a third of the ground mesh's spacing each way, so every
 // coarse vertex of the mesh rebuilt from it lies on a stored sample (about
 // 1 m; built-world.js builds its mesh over the same extent at the same 3 m).
 const cell = w.groundGrid.dx / 3, cellZ = w.groundGrid.dz / 3;
 const land = grid(w.height, -ex, -ez, cell, w.groundGrid.nx * 3 + 1, w.groundGrid.nz * 3 + 1, cellZ);
 const patches = [];
 const patchAt = (cx, cz, half) => {
  const P = FREEZE.patch, n = Math.ceil(2 * half / P) + 1, x0 = Math.round((cx - half) / P) * P, z0 = Math.round((cz - half) / P) * P;
  patches.push(grid(w.height, x0, z0, P, n, n));
 };
 const surfaces = Object.fromEntries(['green', 'fairway', 'tee', 'sand', 'semi', ...GROUND_KINDS].map(k => [k, []]));
 const water = [], holes = [];
 onStep('The holes', .2);
 for (const h of w.holes) {
  surfaces.green.push([greenRing(h)]);
  const gw = h.worldGreen ?? h.toWorld(h.green ?? h.pin);
  patchAt(gw.x, gw.z, (h.greenSize ?? 15) * (h.greenAspect ?? 1) * 1.45 + s.fringe + 4);
  // The green's semi collar: the ground within fringe + semi-rough of it.
  surfaces.semi.push([greenRing(h, s.fringe + s.semiRough)]);
  const mow = h.mowStart ?? h.fairwayStart ?? 0;
  const fw = corridor(h, 0, mow, h.length + 8); if (fw) surfaces.fairway.push(fw);
  const sr = corridor(h, s.semiRough, mow - s.semiRough, h.length + 8 + s.semiRough); if (sr) surfaces.semi.push(sr);
  for (const t of Object.values(h.tees)) {
   const p = teePad(t); if (!p) continue;
   surfaces.tee.push([teeRing(h, t, p, TEE_PAD.x, p.rz, TEE_ROUND)]);
   surfaces.semi.push([teeRing(h, t, p, TEE_APRON.x, p.rz * TEE_APRON_SCALE, TEE_ROUND * TEE_APRON_SCALE)]);
   const tw = h.toWorld({x: t.x, z: p.z}); patchAt(tw.x, tw.z, Math.max(TEE_APRON.x, p.rz * TEE_APRON_SCALE) + 3);
  }
  // A bunker's lip and face are sharper than the 1 m land holds, so each gets
  // a 0.25 m patch too (the virtual golfer took about a stroke more per
  // bunker on a frozen Midwest before they had one).
  for (const b of h.bunkers) { surfaces.sand.push([ovalRing(h, b)]); const bw = h.toWorld(b); patchAt(bw.x, bw.z, Math.max(b.rx, b.rz) * 1.35 + 4); }
  for (const c of h.collections || []) surfaces.fairway.push([ovalRing(h, c)]);
  for (const p of h.ponds) water.push({rings: [ovalRing(h, p, 128)], level: p.level, kind: p.large ? 'lake' : 'pond'});
  const tees = Object.entries(h.tees).map(([set, t]) => { const q = h.toWorld(t); return {x: r2(q.x), z: r2(q.z), set: {blue: 'back', white: 'middle', red: 'front'}[set] || set}; });
  const line = [];
  for (let z = 0; z <= h.length; z += Math.max(5, h.length / 40)) { const q = h.toWorld({x: h.center(z), z}); line.push([r2(q.x), r2(q.z)]); }
  line.push([r2(gw.x), r2(gw.z)]);
  holes.push({number: h.hole + 1, par: h.par, index: h.index ?? h.hole + 1, tees, green: {x: r2(gw.x), z: r2(gw.z)}, line});
 }
 for (const l of w.largeLakes || []) water.push({rings: [ovalRing(l.h, l.p, 192)], level: l.p.level, kind: 'lake'});
 for (const p of w.paths || []) { const r = pathRing(p); if (r) surfaces.path.push(r); }
 const creeks = (w.streams?.streams || []).map(st => ({kind: st.kind, points: st.points.map(p => CREEK_FIELDS.map(k => p[k] ?? (k === 'miter' ? 1 : 0)))}));
 // What has no shape: the ground types, the beach and the blowouts, from the
 // lie itself on a 1 m grid. A bunker's own sand is excluded (it is traced
 // above); only sand the holes did not make is taken here.
 onStep('The landscape\'s ground', .4);
 const R = FREEZE.raster, rx = Math.ceil(2 * ex / R), rz = Math.ceil(2 * ez / R), x0 = -ex + R / 2, z0 = -ez + R / 2;
 const kinds = new Uint8Array(rx * rz), SAND = 255;
 for (let j = 0; j < rz; j++) {
  for (let i = 0; i < rx; i++) {
   const x = x0 + i * R, z = z0 + j * R, k = w.surface(x, z);
   const g = GROUND_KINDS.indexOf(k);
   if (g >= 0 && k !== 'path') kinds[j * rx + i] = g + 1;
   else if (k === 'sand') { const n = w.nearest(x, z); if (!n.h.bunkers.some(b => { const v = n.p; const d = Math.hypot((v.x - b.x) / (b.rx + 1.5), (v.z - b.z) / (b.rz + 1.5)); return d < 1.6; })) kinds[j * rx + i] = SAND; }
  }
  if (j % 64 === 0) onStep('The landscape\'s ground', .4 + .4 * j / rz);
 }
 for (const [code, into] of [...GROUND_KINDS.map((k, i) => [i + 1, k]), [SAND, 'sand']]) {
  if (!kinds.includes(code)) continue;
  const rings = maskRings((i, j) => kinds[j * rx + i] === code, rx, rz, x0, z0, R).map(r => simplify(r, R * .35)).filter(r => r.length >= 3);
  if (rings.length) surfaces[into].push(rings.map(r => r.map(([x, z]) => [r2(x), r2(z)])));
 }
 onStep('The trees', .85);
 const kindsOf = [], kindIndex = new Map(), trees = [];
 for (const t of w.trees) {
  if (!kindIndex.has(t.kind)) { kindIndex.set(t.kind, kindsOf.length); kindsOf.push(t.kind); }
  // The role's high bits carry what the drawing reads: a stand tree (8) and
  // understory (16), which Low and Medium thin (the quality's `understory`):
  // without them a frozen PNW drew every fern on Low, 25% more graphics time.
  trees.push(t.x, t.z, t.h, t.r, t.radius ?? trunkRadius(t), roleOf(t.kind) | (t.stand ? 8 : 0) | (t.under ? 16 : 0), kindIndex.get(t.kind));
 }
 onStep('Done', 1);
 return {type: 'built', name, landscape: s.biome, designer: 'classic', halfX: w.halfX, halfZ: w.halfZ,
  fringe: s.fringe, semiRough: s.semiRough, sea: w.bio.sea ? {level: w.waterLevel} : null,
  land, patches, surfaces, water, creeks, holes, trees: new Float32Array(trees), treeKinds: kindsOf,
  credits: [], source: {kind: 'generated'}, from: {seed: s.seed, settings: {...s}, generator: w.settings.generator ?? null}, picture: null};
}
