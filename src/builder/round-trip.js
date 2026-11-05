// BACK AND FORTH BETWEEN 2D AND 3D (the owner, 1 November 2026: "Do the work
// to allow the user to go back and forth between 2d and 3d work. while
// keeping changes made in both directions"). Door 2 makes the course from its
// trace (real-course.js docFromLand) and the 3D editor works on that course;
// Back to 2D brings the editor's work home to the trace, so the next Open in
// the editor makes the course from both. What comes back, against the course
// as it was opened (`base`) and as the editor has it now (`now`, its toDoc):
//
// - Surfaces: a layer the editor changed (`changed`: kind -> its outlines,
//   editing.js `outlines`) is filled onto the trace's grid, every grid point
//   inside its outlines; a layer the editor left alone stays exactly as the
//   trace had it (filling outlines back smooths a little each time, so only
//   what was touched goes through it).
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

// Every grid point inside `rings` (even-odd) set to 1 on `mask`. The grid's
// points are its cells' middles at x0 + (i + 0.5) * cell.
export function fillRings(rings, {nx, nz, cell, x0, z0}, mask) {
 let zmin = Infinity, zmax = -Infinity;
 for (const ring of rings) for (const [, z] of ring) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
 const j0 = Math.max(0, Math.ceil((zmin - z0) / cell - .5)), j1 = Math.min(nz - 1, Math.floor((zmax - z0) / cell - .5));
 for (let j = j0; j <= j1; j++) {
  const z = z0 + (j + .5) * cell, xs = [];
  for (const ring of rings) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
   const [ax, az] = ring[b], [bx, bz] = ring[a];
   if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax));
  }
  xs.sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k += 2) {
   const i0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - .5)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / cell - .5));
   if (i1 >= i0) mask.fill(1, j * nx + i0, j * nx + i1 + 1);
  }
 }
 return mask;
}

// A tree as a key: where it stands and its size, to the centimetre.
const treeKey = (x, z, h, crown) => [x, z, h, crown].map(v => Math.round(v * 100)).join(',');

// What door 2 takes back from the editor. `grid`: door 2's land {nx, nz,
// cell, halfX, halfZ} (its points at -halfX + i * cell). `changed`: Map kind
// -> rings for each layer the editor changed. `holesBefore`: door 2's holes
// ({tees, aims, green, par?, index?}). Returns {masks, landEdits, holes,
// trees, homes, creeks, rocks, name, landscape}; `landEdits` null when the ground
// was not shaped (under a millimetre everywhere).
export function fromEditor({base, now, grid, changed = new Map(), holesBefore = []}) {
 const {nx, nz, cell, halfX, halfZ} = grid, N = nx * nz;
 const at = {nx, nz, cell, x0: -halfX - cell / 2, z0: -halfZ - cell / 2};
 const masks = new Map();
 for (const [kind, rings] of changed) masks.set(kind, fillRings(rings, at, new Uint8Array(N)));
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
  trees.push(had.has(treeKey(x, z, h, crown)) ? {x, z, h, crown} : {x, z, h, crown, trunk, role, kept: true, ...(kind ? {kind} : {})});
 }
 return {masks, landEdits, holes, trees, homes: structuredClone(now.homes ?? []), creeks: structuredClone(now.creeks ?? []), rocks: structuredClone(now.rocks ?? []), name: now.name, landscape: now.landscape};
}
