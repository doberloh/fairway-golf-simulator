// BACK AND FORTH BETWEEN 2D AND 3D (the owner, 1 November 2026: "Do the work
// to allow the user to go back and forth between 2d and 3d work. while
// keeping changes made in both directions"). Door 2 makes the course from its
// trace (real-course.js docFromLand) and the 3D editor works on that course;
// Back to 2D brings the editor's work home to the trace, so the next Open in
// the editor makes the course from both. What comes back, against the course
// as it was opened (`base`) and as the editor has it now (`now`, its toDoc):
//
// - Surfaces: a layer the editor changed (`changed`: kind -> its outlines,
//   editing.js `outlines`) becomes the trace's layer as those outlines
//   (shapes.js; since 24 November 2026 -- until then they were filled onto
//   the trace's grid); a layer the editor left alone stays exactly as the
//   trace had it.
// - The ground: the editor's shaping as a difference, height for height on
//   the same grid, kept apart from the survey (door 2's `landEdits`) and added
//   when the course is made -- so a green moved in 2D afterwards keeps a hill
//   raised in 3D where it was raised.
// - Holes: tees, aim points (the line's bends) and greens as the editor has
//   them; a par or index the editor changed is kept as set, one it did not is
//   left as door 2 had it (worked out, unless set there).
// - Trees: the editor's, sized as saved (Tree height baked in). One the
//   editor planted, moved or sized is marked `kept`, so the course keeps it
//   wherever it stands; one it left alone is judged by door 2's rules again
//   (none on turf, sand or water).
// - Houses, creeks and rocks (door 2 draws none of them; carried through to
//   the course), the name and the landscape.
// Pure: no DOM, no three.js (tests/round-trip.test.mjs).
import * as S from './shapes.js';

// The same, without leaving the editor: a door 2 draft `d` (draft.js) with the
// editor's work in it, as if Back to 2D had just been pressed. What a course
// file carries as its builder's section, so that it reopens with what the
// course has become, and what Back to 2D opens on a course from a file. `d`
// comes back unchanged; `base` is the course as the editor opened it.
export function withEditorWork(d, {base, now, changed, hidden}) {
 const got = fromEditor({base, now, grid: d.land, changed, holesBefore: d.holes, ownCreeks: d.creeks.length});
 const shapes = new Map(d.trace.shapes), holes = [...d.holes];
 for (const [kind, set] of got.shapes) { if (set.length) shapes.set(kind, set); else shapes.delete(kind); }
 holes.splice(0, got.holes.length, ...got.holes);
 const landEdits = got.landEdits && d.landEdits ? got.landEdits.map((v, k) => v + d.landEdits[k]) : got.landEdits ?? d.landEdits;
 return {...d, step: 5, holes, holesN: got.holes.length, name: got.name, landscape: got.landscape, creeks: got.creeks, rocks: got.rocks, landEdits, treePlan: now.treePlan ?? null, surround: now.surround ?? null, mowing: now.mowing ?? null, view: {...d.view, treeScale: 1},
  trace: {...d.trace, shapes, hidden: [...hidden], trees: got.trees, homes: got.homes}};
}

// A tree as a key: where it stands and its size, to the centimetre.
const treeKey = (x, z, h, crown) => [x, z, h, crown].map(v => Math.round(v * 100)).join(',');

// What door 2 takes back from the editor. `grid`: door 2's land {nx, nz,
// cell, halfX, halfZ} (its points at -halfX + i * cell). `changed`: Map kind
// -> rings for each layer the editor changed. `holesBefore`: door 2's holes
// ({tees, aims, green, par?, index?}). Returns {masks, landEdits, holes,
// trees, homes, creeks, rocks, name, landscape}; `landEdits` null when the ground
// was not shaped (under a millimetre everywhere).
// `ownCreeks`: how many of `base`'s creeks came through door 2 from before; those
// after them it drew itself (real-course.js creekLines), and keeps as its lines.
export function fromEditor({base, now, grid, changed = new Map(), holesBefore = [], ownCreeks = Infinity}) {
 const {nx, nz} = grid, N = nx * nz;
 const shapes = new Map();
 for (const [kind, rings] of changed) shapes.set(kind, S.fromRings(rings));
 let landEdits = null;
 const a = base.land.heights, b = now.land.heights;
 if (a.length === N && b.length === N) {
  const d = new Float32Array(N); let any = false;
  for (let k = 0; k < N; k++) { d[k] = b[k] - a[k]; if (Math.abs(d[k]) > 1e-3) any = true; }
  if (any) landEdits = d;
 }
 const holes = now.holes.map((h, i) => {
  const was = base.holes[i], before = holesBefore[i] ?? {};
  return {tees: h.tees.map(({x, z, set}) => ({x, z, set})), aims: h.line.slice(1, -1).map(([x, z]) => ({x, z})), green: {x: h.green.x, z: h.green.z},
   par: was && h.par !== was.par ? h.par : before.par ?? null, index: was && h.index !== was.index ? h.index : before.index ?? null};
 });
 const had = new Set();
 for (let k = 0; k + 6 < base.trees.length; k += 7) had.add(treeKey(base.trees[k], base.trees[k + 1], base.trees[k + 2], base.trees[k + 3]));
 const trees = [];
 for (let k = 0; k + 6 < now.trees.length; k += 7) {
  const [x, z, h, crown, trunk, role, ki] = now.trees.subarray(k, k + 7), kind = now.treeKinds?.[ki];
  // One left alone is judged by door 2's rules again, unless it was placed by hand
  // or named, which it must stay (tree-plan.js).
  trees.push(had.has(treeKey(x, z, h, crown)) && !(role & 32) && !kind ? {x, z, h, crown} : {x, z, h, crown, trunk, role, kept: true, ...(kind ? {kind} : {})});
 }
 return {shapes, landEdits, holes, trees, homes: structuredClone(now.homes ?? []), creeks: structuredClone((now.creeks ?? []).filter(c => !(base.creeks ?? []).slice(ownCreeks).some(d => d.points[0][0] === c.points[0][0] && d.points[0][1] === c.points[0][1]))), rocks: structuredClone(now.rocks ?? []), name: now.name, landscape: now.landscape};
}
