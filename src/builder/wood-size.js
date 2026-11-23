// THE WOOD OUTSIDE THE COURSE, SIZED FROM THE SURVEY (the owner, 22 November
// 2026: Fill outside should "size the wood from LIDAR"). Fill outside it
// (trace-edit.js fillOutside) used to plant every tree between 10 and 22 m
// with a crown of 2.5 to 5 m, whatever stood there. Now, where the survey
// has a land under it, each tree it plants is sized from what the laser
// measured at its spot:
//   - under canopy: as tall as the canopy's highest point within REACH of it
//     (land.js `canopy`: the tops less the ground), its crown in the
//     proportion of the nearest tree the survey found (land.js findTrees)
//     within NEAR, or CROWN of its height where none is;
//   - on open ground (no canopy over MIN there): the size of one of the
//     survey's own trees, drawn at random, so a wood planted on a field is
//     as tall as the woods round it.
// A cell with building returns is not canopy (a roof is not a tree), and no
// tree is taller than TALLEST (a mast or a power line reads as canopy).
// Returns null where there is nothing to size from (no canopy and no trees:
// a course opened from a file, draft-from-doc.js) -- Fill outside then plants
// its old sizes. Pure; tests/wood-size.test.mjs.
//
// PLACED: REACH 4 m (about a crown's half width), NEAR 15 m, MIN 2 m (land.js
// findTrees' own least tree), CROWN 0.23 (the old sizes' middle, 3.75 m over
// 16 m), TALLEST 70 m.
export const WOOD = {reach: 4, near: 15, min: 2, crown: .23, tallest: 70};

// `land`: door 2's land ({nx, nz, cell, halfX, halfZ, canopy, building?});
// `trees`: the survey's trees ({x, z, h, crown}). Returns (x, z, rnd) =>
// {h, crown}, or null.
export function woodSizer(land, trees = []) {
 const {nx, nz, cell, halfX, halfZ, canopy, building} = land ?? {};
 if (!canopy?.length) return null;
 const own = trees.filter(t => t.h >= WOOD.min && t.h <= WOOD.tallest && t.crown > 0);
 const tall = k => building?.[k] ? 0 : canopy[k];
 let any = !!own.length;
 for (let k = 0; !any && k < canopy.length; k++) if (tall(k) >= WOOD.min) any = true;
 if (!any) return null;
 // The survey's trees by square, for the nearest.
 const S = WOOD.near, grid = new Map(), key = (i, j) => `${i},${j}`;
 for (const t of own) { const c = key(Math.floor(t.x / S), Math.floor(t.z / S)); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(t); }
 const nearest = (x, z) => {
  const i0 = Math.floor(x / S), j0 = Math.floor(z / S); let best = null, d0 = S;
  for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) for (const t of grid.get(key(i, j)) ?? []) { const d = Math.hypot(t.x - x, t.z - z); if (d < d0) { d0 = d; best = t; } }
  return best;
 };
 const r = Math.max(1, Math.round(WOOD.reach / cell));
 return (x, z, rnd = Math.random) => {
  const i0 = Math.round((x + halfX) / cell), j0 = Math.round((z + halfZ) / cell);
  let h = 0;
  for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
   if (i < 0 || j < 0 || i >= nx || j >= nz || (i - i0) ** 2 + (j - j0) ** 2 > r * r) continue;
   h = Math.max(h, tall(j * nx + i));
  }
  if (h >= WOOD.min) {
   h = Math.min(WOOD.tallest, h);
   const t = nearest(x, z), ratio = t ? t.crown / t.h : WOOD.crown;
   return {h, crown: Math.max(1, h * ratio)};
  }
  if (!own.length) return null;
  const t = own[Math.min(own.length - 1, Math.floor(rnd() * own.length))];
  return {h: t.h, crown: t.crown};
 };
}
