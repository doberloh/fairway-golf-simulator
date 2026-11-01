// OUTLINES FROM A GRID OF YES AND NO (the course builder: freezing a
// generated course's raster-only surfaces, stage 1; the auto trace's last
// step, stage 8; docs/COURSE_BUILDER.md).
//
// `maskRings` runs marching squares over a mask and links the edge pieces
// into closed rings, each a list of [x, z] in world metres. Every boundary of
// the mask comes out as a ring -- outer edges and the edges of holes alike --
// so the rings of one mask, taken together under the even-odd rule (which is
// how course-doc.js polygons and built-world.js's bake fill), ARE the mask:
// no winding or nesting to work out. `simplify` thins a ring with
// Douglas-Peucker to a tolerance in metres. Pure, tested in Node
// (tests/contour.test.mjs).

// `mask(i, j)` -> truthy for the cell centred at `x0 + i*cell`, `z0 + j*cell`,
// for 0 <= i < nx, 0 <= j < nz. Outside the grid counts as no, so every ring
// closes.
export function maskRings(mask, nx, nz, x0, z0, cell) {
 const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !!mask(i, j);
 // Edge midpoints are keyed on a doubled lattice so two pieces meeting at a
 // point find each other exactly: the midpoint of the corner-lattice edge
 // between corners (i, j) and (i+1, j) is (2i+1, 2j), and so on.
 const next = new Map();
 const key = (a, b) => a * 1048576 + b;
 const add = (ax, az, bx, bz) => next.set(key(ax, az), [bx, bz, key(bx, bz)]);
 // Corners of square (i, j) are the cell centres (i-1, j-1)..(i, j); the
 // lattice runs one past the grid on every side.
 for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
  const tl = at(i - 1, j - 1), tr = at(i, j - 1), br = at(i, j), bl = at(i - 1, j);
  const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
  if (c === 0 || c === 15) continue;
  // Edge midpoints of this square on the doubled lattice: top, right,
  // bottom, left. Pieces run with the inside on their left.
  const T = [2 * i, 2 * j - 1], R = [2 * i + 1, 2 * j], B = [2 * i, 2 * j + 1], L = [2 * i - 1, 2 * j];
  const seg = (p, q) => add(p[0], p[1], q[0], q[1]);
  switch (c) {
   case 1: seg(B, L); break; case 2: seg(R, B); break; case 3: seg(R, L); break;
   case 4: seg(T, R); break; case 5: seg(T, L); seg(B, R); break; case 6: seg(T, B); break;
   case 7: seg(T, L); break; case 8: seg(L, T); break; case 9: seg(B, T); break;
   case 10: seg(L, B); seg(R, T); break; case 11: seg(R, T); break; case 12: seg(L, R); break;
   case 13: seg(B, R); break; case 14: seg(L, B); break;
  }
 }
 const rings = [], seen = new Set();
 for (const [k0] of next) {
  if (seen.has(k0)) continue;
  const ring = [];
  let k = k0, guard = 0;
  while (!seen.has(k) && guard++ < 1e7) {
   seen.add(k);
   const [bx, bz, kb] = next.get(k);
   ring.push([x0 + (bx / 2 - .5) * cell, z0 + (bz / 2 - .5) * cell]);
   k = kb;
   if (!next.has(k)) break;
  }
  if (ring.length >= 3) rings.push(ring);
 }
 return rings;
}

// Douglas-Peucker on a closed ring; keeps at least four points.
export function simplify(ring, tol) {
 if (ring.length <= 4) return ring;
 // Split the closed ring at its two farthest-apart points, simplify each half.
 let a = 0, b = 0, far = -1;
 for (let i = 0; i < ring.length; i++) { const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2; if (d > far) { far = d; b = i; } }
 const half = (from, to) => {
  const pts = [];
  for (let i = from; ; i = (i + 1) % ring.length) { pts.push(ring[i]); if (i === to) break; }
  return dp(pts, tol);
 };
 const h1 = half(a, b), h2 = half(b, a);
 const out = [...h1.slice(0, -1), ...h2.slice(0, -1)];
 return out.length >= 4 ? out : ring;
}
function dp(pts, tol) {
 const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
 const stack = [[0, pts.length - 1]];
 while (stack.length) {
  const [s, e] = stack.pop();
  const [ax, az] = pts[s], [bx, bz] = pts[e], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
  let worst = -1, at = -1;
  for (let i = s + 1; i < e; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / len; if (d > worst) { worst = d; at = i; } }
  if (worst > tol) { keep[at] = 1; stack.push([s, at], [at, e]); }
 }
 return pts.filter((_, i) => keep[i]);
}

// A ring rounded (Chaikin's corner cutting, `times` passes): each edge keeps
// its middle half, so a corner becomes a curve and a grid's staircase a
// smooth line. Each pass doubles the points; the area shrinks a little at
// the corners.
export function smoothRing(ring, times = 2) {
 let r = ring;
 for (let t = 0; t < times; t++) {
  const out = [];
  for (let i = 0; i < r.length; i++) { const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length]; out.push([ax * .75 + bx * .25, az * .75 + bz * .25], [ax * .25 + bx * .75, az * .25 + bz * .75]); }
  r = out;
 }
 return r;
}

// The area a ring encloses, m² (positive whichever way it runs).
export const ringArea = ring => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return Math.abs(a) / 2; };
