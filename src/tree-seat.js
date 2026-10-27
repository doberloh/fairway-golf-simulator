// TREES SEATED IN THE GROUND (the polish goal, 26 October 2026). The owner:
// "Trees appear to be floating in some cases. Need to make sure the trunks are
// fully into the ground."
//
// A plant stood at the ground's height under its CENTRE (course.js `y`), on a
// flat-bottomed model leaned up to 0.05 rad -- so on a slope the downhill side
// of a trunk's foot hung over the falling ground, and the lean lifted one edge
// further. Each plant is now POSED by `plantPose`: drawn lower by its seat --
// the most the ground falls away anywhere under its footprint, plus what the
// lean can lift, plus 2 cm -- and, if it is ground cover, laid along the slope
// first. Drawing only: the generator's `y`, and so every collider and where a
// ball meets a trunk, stay where they were.
//
// ROUND 1 measured the footprint as the widest base of a family's models --
// which for a spruce or a cedar is the skirt of boughs sweeping the ground,
// 3.5 m out, and sank them metres deep on a slope. A trunk's footprint is its
// BARK now (the model's bark parts in the bottom 2% of its height); boughs
// that hang over a slope are what boughs do.
//
// GROUND COVER (species.js GROUND_PLANTS) has no trunk and is low and wide:
// seated by its full spread on a steep slope it sank out of sight, and capped
// it still hung over the downhill side. It now lies along the slope (up to
// 25 degrees, as boulders do) and is seated against that tilted plane by its
// stems, a third of its spread -- never by more than 40% of its height
// (PLACED).
//
// Shared by vegetation.js, which draws by it, and tools/metrics.mjs `seated`,
// which checks it on a denser, different set of points.

import {FAMILY_OF, familyModels, modelParts} from './mesh-assets.js';
import {GROUND_PLANTS, SPREAD_SIZED, COVER_STEEPEST} from './species.js';

const shares = new Map();
// The widest trunk foot among a family's models, as a share of the model's
// height: bark vertices in its bottom 2%. A family with no bark at its foot
// falls back to every part's.
export function footprintShare(kind) {
 const family = FAMILY_OF[kind];
 if (shares.has(family)) return shares.get(family);
 let worst = 0;
 for (const m of family ? familyModels(family) : []) {
  const parts = modelParts(m) || [];
  let top = 0;
  for (const p of parts) { const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) top = Math.max(top, a.getY(i)); }
  const foot = which => { let base = 0; for (const p of parts) { if (which && p.role !== which) continue; const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) < .02 * top) base = Math.max(base, Math.hypot(a.getX(i), a.getZ(i))); } return base; };
  worst = Math.max(worst, (foot('bark') || foot(null)) / (top || 1));
 }
 shares.set(family, worst || .05);
 return shares.get(family);
}

// The lean vegetation.js gives a model, at most, in radians.
export const SEAT_LEAN = .05;
// The steepest a ground cover is laid along, as a gradient: 40 degrees
// (round 2; at round 1's 25, ferns on Mountain's steep stand floors still
// hung up to 2.4 m over the slope below them). Round 3: past it the
// generator plants no cover at all (species.js COVER_STEEPEST).
export const COVER_TILT = COVER_STEEPEST;

export const isCover = t => GROUND_PLANTS.has(t.kind) || SPREAD_SIZED.has(FAMILY_OF[t.kind]);

// How far out under a plant its foot reaches, in metres. A tree is drawn up
// to 1.14 x its height and 1.14 x as wide (lift and girth), hence 1.3.
export function footprintRadius(t) {
 if (isCover(t)) return Math.max(.05, (t.r || .5) / 3);
 return Math.min(2.5, Math.max(.06, footprintShare(t.kind) * (t.h || 4) * 1.3));
}

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
export function plantPose(t, height) {
 const R = footprintRadius(t), tilt = plantTilt(t, height);
 let rise = 0;
 for (const r of [R, R * .75, R * .5, R * .25]) for (let k = 0; k < 24; k++) {
  const a = k * Math.PI / 12, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
  rise = Math.max(rise, t.y + tilt.gx * dx + tilt.gz * dz - height(t.x + dx, t.z + dz));
 }
 // 8 cm under (round 2's 5 cm, after round 1's 2 cm left trunks 4-8 cm
 // proud between the sixteen points; round 3 still found one at 5); a cover
 // never more than 75% of its height (at 60%, one fern on bumpy ground still
 // stood 12 cm proud at an edge; the cap binds only on such rare spots).
 let depth = rise + R * SEAT_LEAN + .08;
 if (isCover(t)) depth = Math.min(depth, (t.h || 1) * .75);
 return {depth, gx: tilt.gx, gz: tilt.gz};
}
export const seatDepth = (t, height) => plantPose(t, height).depth;
