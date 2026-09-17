// Where a club actually puts the ball, drawn as a group rather than a number.
//
// A READ, NOT A MODEL. Nothing here invents a miss. It takes the shots that were
// hit, groups them by the club that hit them, and reports where they finished --
// so the circle is only as wide as the variation you actually produced. Hit the
// same club with the same numbers ten times and the sim, which has no
// strike-quality model by design, returns ten identical balls and the circle is
// a dot. That is the honest answer, not a bug to paper over.

// A group needs enough shots to be a group. Two balls define a line through
// their own midpoint and a radius that means nothing; drawing a confident circle
// round them would be a claim the data cannot support.
export const MIN_GROUP = 3;

// The group as an ELLIPSE THAT CONTAINS EVERY BALL, not a circle at one standard
// distance.
//
// A circle was the wrong shape twice over. Dispersion is not round -- long and
// short is a different miss from left and right, and for most clubs the group is
// half as wide as it is deep -- so a circle either swallowed the sides or spilled
// past the ends. And a standard distance is a statistic about two thirds of the
// group, which meant a third of the balls sat outside the mark drawn for them.
//
// Shape comes from the data's own covariance, so the ellipse lies along the way
// the club actually misses rather than along the aim line. Size comes from the
// requirement that every ball is inside it.
export function groupEllipse(points) {
 const n = points.length;
 if (!n) return null;
 const cx = points.reduce((a, p) => a + p.x, 0) / n;
 const cz = points.reduce((a, p) => a + p.z, 0) / n;
 const d = points.map(p => [p.x - cx, p.z - cz]);

 // Covariance, only to find the DIRECTION the group lies along. Its magnitude is
 // not used for the size -- that comes from the balls themselves below.
 const div = Math.max(1, n - 1);
 const sxx = d.reduce((a, [x]) => a + x * x, 0) / div;
 const szz = d.reduce((a, [, z]) => a + z * z, 0) / div;
 const sxz = d.reduce((a, [x, z]) => a + x * z, 0) / div;
 // Eigenvector angle of a symmetric 2x2. `atan2(0, 0)` is 0, which is the right
 // answer for a group with no spread at all.
 const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
 const ca = Math.cos(angle), sa = Math.sin(angle);

 // Along the major axis and across it.
 const uv = d.map(([x, z]) => [x * ca + z * sa, -x * sa + z * ca]);
 let long = Math.max(...uv.map(([u]) => Math.abs(u)));
 let wide = Math.max(...uv.map(([, v]) => Math.abs(v)));
 if (long < 1e-9 && wide < 1e-9) {
  // Every ball in the same place. The honest mark is a point, and inflating it
  // would be drawing a miss nobody hit.
  return {n, centre: {x: cx, z: cz}, angle: 0, long: 0, wide: 0, worst: 0, points};
 }
 // A perfectly straight line of finishes leaves one axis at zero, which would
 // divide by zero below and draw nothing. A sliver is the truthful picture of a
 // group with no width.
 const floor = Math.max(long, wide) * 0.04;
 long = Math.max(long, floor); wide = Math.max(wide, floor);

 // Touching the extremes on each axis is NOT the same as containing everything:
 // a ball out on the diagonal can be inside both bounds and still outside the
 // ellipse. This is the smallest scale factor that takes the last one in.
 let k = 1;
 for (const [u, v] of uv) k = Math.max(k, Math.hypot(u / long, v / wide));
 const worst = Math.max(...uv.map(([u, v]) => Math.hypot(u, v)));
 return {n, centre: {x: cx, z: cz}, angle, long: long * k, wide: wide * k, worst, points};
}

// One entry per club that has enough shots to say anything about. Ordered by the
// club's own mean distance from the mat, so the legend reads long to short the
// way a bag does rather than in the order clubs happened to be picked up.
export function dispersionByClub(shots, {minGroup = MIN_GROUP, origin = null} = {}) {
 const byClub = new Map();
 for (const s of shots) {
  if (!s?.end || !Number.isFinite(s.end.x) || !Number.isFinite(s.end.z)) continue;
  // `clubKey` is what it was hit WITH; `club` is where the numbers came from,
  // and those differ for a launch-monitor shot. Grouping on the source put a
  // driver and a 7 iron in one circle describing neither.
  const key = s.clubKey ?? s.club;
  if (!byClub.has(key)) byClub.set(key, []);
  byClub.get(key).push({x: s.end.x, z: s.end.z});
 }
 const out = [];
 for (const [club, points] of byClub) {
  if (points.length < minGroup) continue;
  const stat = groupEllipse(points);
  const from = origin ?? {x: 0, z: 0};
  out.push({club, ...stat,
   reach: Math.hypot(stat.centre.x - from.x, stat.centre.z - from.z)});
 }
 return out.sort((a, b) => b.reach - a.reach);
}

// A stable colour per club name. Hashed rather than assigned from a palette in
// order, so a club keeps its colour when another club joins the session -- a
// legend whose colours shuffle as you change clubs is worse than no legend.
export function clubHue(club) {
 let h = 0;
 for (let i = 0; i < club.length; i++) h = (h * 31 + club.charCodeAt(i)) % 360;
 return h;
}
export const clubColour = (club, alpha = 1) => `hsl(${clubHue(club)} 72% 62% / ${alpha})`;
