// THE COURSE AS relief.js NEEDS IT (moved out of main.js on 17 November 2026,
// the fairway-tour goal, so a computer golfer drops where a person may): what
// surface a spot is, whether it is out of bounds, and whether a trunk, a house,
// a clubhouse or a wall stands on it. Solids are indexed in ten-metre cells,
// built once per hole and kept with it. Pure.
import {outOfBounds, trunkRadius, R as BALL_R} from './physics.js';
import {localSurface} from './course.js';

const cache = new WeakMap();
export function reliefGround(course) {
 let solids = cache.get(course);
 if (!solids) {
  const cells = new Map(), add = (x, z, r) => { const k = Math.floor(x / 10) + ',' + Math.floor(z / 10); if (!cells.has(k)) cells.set(k, []); cells.get(k).push({x, z, r}); };
  const local = s => course.world ? course.toLocal(s) : s;
  for (const t of course.world?.trees || course.trees || []) { const r = trunkRadius(t); if (r > 0) { const p = local(t); add(p.x, p.z, r + BALL_R + .2); } }
  // A course's clubhouse too (clubhouse.js): no drop inside its walls; field
  // walls are kept clear like a building.
  for (const h of [...(course.world?.homes || course.homes || []), ...(course.world?.buildings || []), ...(course.world?.wallBoxes || [])]) { const p = local(h); add(p.x, p.z, Math.max(h.width, h.depth) / 2 + 1); }
  // The hole's own ground, for Local Rule E-5's "fairway of the hole being
  // played": its corridor runs up the z axis from the tee to beyond the green.
  const len = course.length || Math.hypot(course.pin.x, course.pin.z) + 60;
  solids = {cells, area: {minX: -180, maxX: 180, minZ: -40, maxZ: len + 40}};
  cache.set(course, solids);
 }
 const {cells, area} = solids;
 return {
  area,
  surface: (x, z) => course.surface(x, z),
  // What the hole itself calls fairway or fringe, before the landscape is
  // composed: Local Rule E-5 only counts the fairway of the hole being played.
  ownFairway: (x, z) => ['fairway', 'fringe'].includes(localSurface(course, x, z)),
  out: (x, z) => outOfBounds(course, x, z),
  blocked: (x, z) => { const cx = Math.floor(x / 10), cz = Math.floor(z / 10); for (let i = cx - 2; i <= cx + 2; i++) for (let j = cz - 2; j <= cz + 2; j++) for (const s of cells.get(i + ',' + j) || []) if (Math.hypot(x - s.x, z - s.z) < s.r) return true; return false; },
 };
}
