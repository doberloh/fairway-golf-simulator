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
// which checks it on a denser, different set of points. The arithmetic is in
// seat-core.js, with no models behind it; this file is where a tree's trunk
// foot is read off its model.

import {FAMILY_OF, familyModels, modelParts} from './mesh-assets.js';
import {isCover, coverRadius, poseAt, gapAt} from './seat-core.js';
export {SEAT_LEAN, COVER_TILT, isCover, plantTilt, FLOAT_TOLERANCE} from './seat-core.js';

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

// How far out under a plant its foot reaches, in metres. A tree is drawn up
// to 1.14 x its height and 1.14 x as wide (lift and girth), hence 1.3.
export function footprintRadius(t) {
 if (isCover(t)) return coverRadius(t);
 return Math.min(2.5, Math.max(.06, footprintShare(t.kind) * (t.h || 4) * 1.3));
}

export const plantPose = (t, height) => poseAt(t, height, footprintRadius(t));
export const seatDepth = (t, height) => plantPose(t, height).depth;
export const seatGap = (t, height) => gapAt(t, height, footprintRadius(t));
