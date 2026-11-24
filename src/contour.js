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

// A traced ring relaxed: each point moved toward its two neighbours (1/4,
// 1/2, 1/4), `passes` times -- a grid's staircase becomes the line it
// stepped along before anything is thrown away, so simplifying leaves no
// stair corners to show as notches (the owner, 1 November 2026: "some sort
// of edge smoothing issue ... all over"). A curve moves in by about
// passes/2 x spacing^2 / its radius: centimetres on a green.
export function relaxRing(ring, passes) {
 let r = ring;
 for (let p = 0; p < passes; p++) r = r.map((q, i) => { const a = r[(i - 1 + r.length) % r.length], b = r[(i + 1) % r.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
 return r;
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

// A TRACED RING FITTED: straight where the cells ran straight, a corner where
// they turned a corner, curved where they curved (the owner, 23 November
// 2026: "jaggy edges on things like greens and tee boxes", and a Line laid
// with Auto curve off still came out rounded). Relaxing the staircase
// (`relaxRing`) could do neither: eight passes reach about two cells, so a
// side a few degrees off the grid -- steps ten or thirty cells apart -- kept
// its steps as a wobble (18 cm on half-metre land, 80 cm on 1 m land), while
// every corner was worn off (0.7 m and 1.4 m). RESEARCH, *Outlines fitted*.
//
// 1. From each point, how far a straight edge can run with every point it
//    passes within `tol` cells of it (a wedge of directions, narrowed point
//    by point). 2. The ring walked in the longest such edges, from its
//    sharpest turn. 3. Each edge laid along the line its points fit best
//    (least squares); a vertex where two such lines cross, kept within a
//    cell or so of where the cells put it. 4. Each vertex a CORNER, kept
//    sharp, when both its edges are at least `minCorner` cells long and it
//    turns `cornerAngle` degrees or more, or rounding it would pull the edge
//    more than `bend` cells off it; otherwise it is rounded (a quadratic
//    curve from a point half the shorter edge before it to as far after) --
//    which a circle's edges always are, as their fitted edges sag at most
//    `tol` from the arc. All four numbers PLACED. 5. With `area` (the cells'
//    own, `cellArea`), grown back to it.
// The walk starts somewhere, so a part of a layer traced on its own (the 3D
// editor's and the trace step's redraw after a stroke) can differ from the
// whole a little where a curve crosses into the part: within 5 cm for 95 in
// 100 points on 1 m land with 32 cells round the part, 27 cm at the very
// worst. What is saved is always traced whole. Fitting each point alone (the
// best line through the straight run centred on it) agreed exactly but left
// steps on a side 6 degrees off the grid and 14-29 degree kinks: rejected.
export function fitRing(ring, cell, {tol = .55, cornerAngle = 70, bend = 1, minCorner = 2, area = null} = {}) {
 const n = ring.length;
 if (n < 8) return smoothRing(ring, 2);
 const T = tol * cell, REACH = Math.min(n - 2, 6000), far = new Int32Array(n);
 for (let i = 0; i < n; i++) {
  const ax = ring[i][0], az = ring[i][1];
  let bx = 0, bz = 0, lo = -Infinity, hi = Infinity, k = 1;
  for (; k <= REACH; k++) {
   const p = ring[(i + k) % n], dx = p[0] - ax, dz = p[1] - az, d = Math.hypot(dx, dz);
   if (!bx && !bz) { if (d < 1e-9) continue; bx = dx / d; bz = dz / d; }
   const ang = Math.atan2(bx * dz - bz * dx, bx * dx + bz * dz);
   if (Math.abs(ang) > 1.2 || ang < lo || ang > hi) break;
   if (d > T) { const w = Math.asin(T / d); lo = Math.max(lo, ang - w); hi = Math.min(hi, ang + w); }
  }
  far[i] = Math.max(1, k - 1);
 }
 // From the sharpest turn, so a straight side is not split for nothing.
 let s = 0, best = -1;
 for (let i = 0; i < n; i++) {
  const a = ring[(i - 3 + n) % n], b = ring[i], c = ring[(i + 3) % n], ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1];
  const t = Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz)); if (t > best) { best = t; s = i; }
 }
 const V = [s];
 for (let cur = s, done = 0; done + far[cur] < n;) { done += far[cur]; cur = (cur + far[cur]) % n; V.push(cur); }
 const M = V.length;
 if (M < 3) return smoothRing(ring, 2);
 // Each edge's best line: through its points' middle, along their spread.
 const lines = V.map((a, m) => {
  const b = V[(m + 1) % M], cnt = (b - a + n) % n + 1;
  let sx = 0, sz = 0; for (let t = 0; t < cnt; t++) { const p = ring[(a + t) % n]; sx += p[0]; sz += p[1]; }
  const cx = sx / cnt, cz = sz / cnt; let xx = 0, xz = 0, zz = 0;
  for (let t = 0; t < cnt; t++) { const p = ring[(a + t) % n], dx = p[0] - cx, dz = p[1] - cz; xx += dx * dx; xz += dx * dz; zz += dz * dz; }
  const qx = ring[b][0] - ring[a][0], qz = ring[b][1] - ring[a][1], ql = Math.hypot(qx, qz) || 1;
  let ux = qx / ql, uz = qz / ql;
  if (cnt >= 4) { const ang = Math.atan2(2 * xz, xx - zz) / 2, fx = Math.cos(ang), fz = Math.sin(ang), sg = fx * ux + fz * uz < 0 ? -1 : 1; ux = fx * sg; uz = fz * sg; }
  return {cx, cz, ux, uz};
 });
 const P = V.map((vi, m) => {
  const L1 = lines[(m - 1 + M) % M], L2 = lines[m], ox = ring[vi][0], oz = ring[vi][1];
  const det = L1.ux * L2.uz - L1.uz * L2.ux;
  if (Math.abs(det) > .05) {
   const t = ((L2.cx - L1.cx) * L2.uz - (L2.cz - L1.cz) * L2.ux) / det, x = L1.cx + t * L1.ux, z = L1.cz + t * L1.uz;
   if (Math.hypot(x - ox, z - oz) <= 1.2 * cell) return [x, z];
  }
  const on = L => { const t = (ox - L.cx) * L.ux + (oz - L.cz) * L.uz; return [L.cx + t * L.ux, L.cz + t * L.uz]; };
  const p1 = on(L1), p2 = on(L2); return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
 });
 const out = [], push = q => { const l = out.at(-1); if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) out.push(q); };
 for (let m = 0; m < M; m++) {
  const A = P[(m - 1 + M) % M], B = P[m], C = P[(m + 1) % M];
  const ax = B[0] - A[0], az = B[1] - A[1], bx = C[0] - B[0], bz = C[1] - B[1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
  if (la < 1e-9 || lb < 1e-9) { push(B); continue; }
  const th = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)), c = Math.min(la, lb) / 2;
  if (Math.min(la, lb) >= minCorner * cell && (th >= cornerAngle * Math.PI / 180 || c * Math.sin(th / 2) / 2 > bend * cell)) { push(B); continue; }
  const s0 = [B[0] - ax / la * c, B[1] - az / la * c], s2 = [B[0] + bx / lb * c, B[1] + bz / lb * c], k = Math.max(2, Math.min(16, Math.ceil(th / (Math.PI / 18)) + 1));
  for (let q = 0; q <= k; q++) { const t = q / k, u = 1 - t; push([u * u * s0[0] + 2 * u * t * B[0] + t * t * s2[0], u * u * s0[1] + 2 * u * t * B[1] + t * t * s2[1]]); }
 }
 if (out.length > 1 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 1e-6) out.pop();
 if (out.length < 3) return smoothRing(ring, 2);
 return area == null ? out : grownTo(out, area, .5 * cell);
}

// A ring moved out (or in) along its normals so it encloses `area` m² -- by
// at most `most` metres. Rounding a curve takes it inside the cells (a fitted
// edge is a chord of the arc it fits), so a green came out 10 cm small all
// round on 1 m land; the cells' own area puts it back.
function grownTo(ring, area, most) {
 const n = ring.length, signed = ringSigned(ring); let len = 0;
 for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
 const d = Math.max(-most, Math.min(most, (area - Math.abs(signed)) / (len || 1))) * Math.sign(signed || 1);
 if (!d) return ring;
 // Each point along the mean of its two edges' right-hand normals (outward
 // for a ring running the positive way), mitred so a corner keeps its sides.
 return ring.map((q, i) => {
  const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
  let ux = q[0] - a[0], uz = q[1] - a[1], vx = b[0] - q[0], vz = b[1] - q[1]; const lu = Math.hypot(ux, uz) || 1, lv = Math.hypot(vx, vz) || 1;
  ux /= lu; uz /= lu; vx /= lv; vz /= lv;
  let nx = uz + vz, nz = -ux - vx; const ln = Math.hypot(nx, nz);
  if (ln < 1e-9) return q;
  nx /= ln; nz /= ln; const k = Math.max(.5, nx * uz - nz * ux);
  return [q[0] + nx * d / k, q[1] + nz * d / k];
 });
}
const ringSigned = ring => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return a / 2; };

// The area of the cells a traced ring (`maskRings`) goes round: its own,
// with each cut corner put back or taken off (an eighth of a cell each) --
// where the cells' edges run, not the line through their edges' middles.
// `x0`: the first cell's middle, as maskRings was given it.
export function cellArea(ring, x0, cell) {
 const n = ring.length, onCentre = x => Math.abs((x - x0) / cell - Math.round((x - x0) / cell)) < .25, stair = [];
 for (let i = 0; i < n; i++) {
  const p = ring[i], q = ring[(i + 1) % n]; stair.push(p);
  // A diagonal cuts a corner of the cells: of (p.x, q.z) and (q.x, p.z), the
  // one off the cells' middles -- put back into the ring.
  if (Math.abs(p[0] - q[0]) > 1e-9 && Math.abs(p[1] - q[1]) > 1e-9) stair.push(onCentre(p[0]) ? [q[0], p[1]] : [p[0], q[1]]);
 }
 return Math.abs(ringSigned(stair));
}

// The area a ring encloses, m² (positive whichever way it runs).
export const ringArea = ring => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return Math.abs(a) / 2; };
