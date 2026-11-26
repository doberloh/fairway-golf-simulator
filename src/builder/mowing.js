// HOW THE COURSE IS MOWN (the owner, 26 November 2026: "let's make it a
// setting for the courses in the generator as well as the builder ... add
// settings for the mowing style for greens, approaches, and fairways"): the
// three choices both editors show beside the landscape, kept in the course
// file as `mowing` (course-doc.js). A course without them is mown as every
// course was before: fairway stripes, green and approach diamonds.
import {MOW_STYLES, MOW_NAMES, DEFAULT_COURSE} from '../settings-schema.js';

export const MOWN = [['fairway', 'Fairway mowing'], ['approach', 'Approach mowing'], ['green', 'Green mowing']];
export const MOW_DEFAULT = {fairway: DEFAULT_COURSE.mowFairway, green: DEFAULT_COURSE.mowGreen, approach: 'diamonds'};

// The choices as rows of a field: `el` the builder's element maker,
// `mowing` the course's (or null), `set(kind, style)` called on a change.
export function mowingControls(el, mowing, set) {
 return MOWN.flatMap(([kind, label]) => [el('small', {}, label),
  el('select', {class: `cb-mow-${kind}`, title: `How the ${kind === 'green' ? 'greens' : kind === 'approach' ? 'approaches' : 'fairways'} are cut in the game: stripes, a checkerboard or diamonds. Looks only.`, onchange: e => set(kind, e.target.value)},
   MOW_STYLES.map(k => el('option', {value: k, selected: k === (mowing?.[kind] ?? MOW_DEFAULT[kind])}, MOW_NAMES[k])))]);
}
