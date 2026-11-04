// A plant's seat in the ground, as arithmetic (tree-seat.js has the story and
// reads a tree's trunk foot off its model). No models here: course.js asks this
// for ground covers, and the generator's worker must not reach asset-meshes.js
// (plant-families.js).
import {FAMILY_OF} from './plant-families.js';
import {GROUND_PLANTS, SPREAD_SIZED, COVER_STEEPEST} from './species.js';

// The lean vegetation.js gives a model, at most, in radians.
export const SEAT_LEAN = .05;
// The steepest a ground cover is laid along, as a gradient: 40 degrees
// (round 2; at round 1's 25, ferns on Mountain's steep stand floors still
// hung up to 2.4 m over the slope below them). Round 3: past it the
// generator plants no cover at all (species.js COVER_STEEPEST).
export const COVER_TILT = COVER_STEEPEST;

export const isCover = t => GROUND_PLANTS.has(t.kind) || SPREAD_SIZED.has(FAMILY_OF[t.kind]);

// How far out under a ground cover its stems reach, in metres.
export const coverRadius = t => Math.max(.05, (t.r || .5) / 3);

// The slope a ground cover lies along: the ground's gradient over its spread,
// held to COVER_TILT. Trees stand upright: {gx: 0, gz: 0}.
export function plantTilt(t, height) {
 if (!isCover(t)) return {gx: 0, gz: 0};
 const d = Math.max(.5, (t.r || .5) * .6);
 let gx = (height(t.x + d, t.z) - height(t.x - d, t.z)) / (2 * d), gz = (height(t.x, t.z + d) - height(t.x, t.z - d)) / (2 * d);
 const s = Math.hypot(gx, gz);
 if (s > COVER_TILT) { gx *= COVER_TILT / s; gz *= COVER_TILT / s; }
 return {gx, gz};
}

// How far below the generator's `y` a plant is drawn, and the slope it lies
// along. The foot is a plane through (x, y, z) with the tilt's gradient; the
// seat is the most that plane stands above the ground on four rings of
// twenty-four points under the footprint (sixteen until a dip between them let a pine stand 12 cm proud), plus the lean's lift and 8 cm.
export function poseAt(t, height, R) {
 const tilt = plantTilt(t, height);
 let rise = 0;
 for (const r of [R, R * .75, R * .5, R * .25]) for (let k = 0; k < 24; k++) {
  const a = k * Math.PI / 12, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
  rise = Math.max(rise, t.y + tilt.gx * dx + tilt.gz * dz - height(t.x + dx, t.z + dz));
 }
 // A tenth over what the rings found, on a slope, for the dip between them
 // (the country plan's first round: a 59 m sugar pine stood 9 cm proud), and
 // 8 cm under (round 2's 5 cm, after round 1's 2 cm left trunks 4-8 cm
 // proud between the sixteen points; round 3 still found one at 5); a cover
 // never more than 75% of its height (at 60%, one fern on bumpy ground still
 // stood 12 cm proud at an edge; the cap binds only on such rare spots).
 let depth = rise * 1.1 + R * SEAT_LEAN + .08;
 if (isCover(t)) depth = Math.min(depth, (t.h || 1) * .75);
 return {depth, gx: tilt.gx, gz: tilt.gz};
}
// HOW FAR THE SEATED FOOT STANDS ABOVE THE GROUND at its worst, on points of
// its own (rings at 85% and 50% of the footprint, twelve each, turned off the
// seat's): the bench's `seated` metric (tools/metrics.mjs), which counts
// anything over 3 cm as a floating plant, and course.js, which refuses a
// cover that would be one (generator 81).
export function gapAt(t, height, R) {
 const pose = poseAt(t, height, R), base = t.y - pose.depth;
 let worst = -Infinity;
 for (const r of [R * .85, R * .5]) for (let k = 0; k < 12; k++) {
  const a = (k + .37) * Math.PI / 6, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
  worst = Math.max(worst, base + pose.gx * dx + pose.gz * dz + r * SEAT_LEAN - height(t.x + dx, t.z + dz));
 }
 return {worst, depth: pose.depth};
}
export const FLOAT_TOLERANCE = .03;
