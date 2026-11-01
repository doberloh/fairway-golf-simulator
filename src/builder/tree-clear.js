// CLEAR TREES FROM TEES AND GREENS (the owner, 1 November 2026: "we need to
// make sure that we don't have trees encroaching massively over greens and
// tees. Lets add a function to 'clear trees from tees and greens' that will
// resize tree shapes"). A tree whose crown reaches over a green or a tee has
// its crown drawn in to stop `margin` metres short of the nearest edge, its
// height kept; one with too little room left for a crown (`minCrown`), or
// standing on the green or tee, is taken out. LIDAR finds a tree's crown
// where the laser met leaves, and a crown measured over a green is a branch
// the club would have cut back -- or a mistake; in the game a crown over the
// green blocks shots that clear it in life.
//
// margin 1.5 m: the green's collar and a little air (PLACED); minCrown 1.2 m:
// smaller reads as a pole, not a tree (PLACED). Pure: the trees and the grid
// are passed in (door 2's trace and the editor keep trees differently);
// tests/tree-clear.test.mjs.
import {distanceFrom} from '../lidar/trace.js';

export const CLEAR_MARGIN = 1.5, MIN_CROWN = 1.2;

// `grid`: {nx, nz, cell, x0, z0} with (x0, z0) the first cell's middle;
// `mask`: 1 on a green or tee cell. `get(t)` gives {x, z, crown}; `put(t,
// crown)` gives the tree with that crown. Returns {trees, shrunk, removed}.
export function clearTrees(trees, grid, mask, {margin = CLEAR_MARGIN, minCrown = MIN_CROWN, get = t => t, put = (t, crown) => ({...t, crown})} = {}) {
 const {nx, nz, cell, x0, z0} = grid, d = distanceFrom(mask, nx, nz, cell);
 const out = []; let shrunk = 0, removed = 0;
 for (const t of trees) {
  const {x, z, crown} = get(t), i = Math.round((x - x0) / cell), j = Math.round((z - z0) / cell);
  // From the trunk to the nearest green or tee cell's edge (half a cell
  // short of its middle); off the grid, nothing near.
  const k = i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i, room = k < 0 ? Infinity : mask[k] ? 0 : d[k] - cell / 2 - margin;
  if (crown <= room) { out.push(t); continue; }
  if (room < minCrown) { removed++; continue; }
  out.push(put(t, room)); shrunk++;
 }
 return {trees: out, shrunk, removed};
}
