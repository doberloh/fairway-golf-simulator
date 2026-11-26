// SURFACES IN LAYERS (the owner, 1 November 2026: "the concept of layers so
// things can be easily painted in the trace step ... exposed in the editor as
// well in real time"; docs/COURSE_BUILDER.md *The amended goal*).
//
// Each surface or ground type is its own layer -- since 24 November 2026 a
// set of outlines (shapes.js, held by trace-edit.js); until then a mask of
// cells -- and a point shows the topmost layer that covers it. Painting a layer changes that layer
// only -- a fairway painted through a bunker leaves the bunker, and the
// fairway runs on unbroken under it. The order is the game's own: a built
// course's field is read water, sand, green, a painted fringe, tee, path,
// approach, fairway, semi, then a ground type (built-world.js), so overlapping outlines in a course file
// resolve exactly as the layers show them. Hiding a layer hides it from the
// view only; a course is made from every layer.
//
// Pure (no DOM): the order, and the layers a landscape offers; used by the
// trace step (trace-edit.js) and the editor (editing.js); tests/layers.test.mjs.
import {GROUND_KINDS} from '../grounds.js';

// Top first.
// The fringe (24 November 2026) just under the green, so a collar painted up
// to and over a green's edge leaves no gap; in the game it is a code in the
// ground layer that wins inside it (built-field.js).
// The approach (26 November 2026) just over the fairway: painted over a
// fairway's end it takes that ground, and a cart path still crosses it.
export const LAYER_ORDER = ['water', 'sand', 'green', 'fringe', 'tee', 'path', 'approach', 'fairway', 'semi', ...GROUND_KINDS.filter(k => k !== 'path')];

// The layers a landscape offers, top first, ending with rough (the owner, 1
// November 2026: "all types available to that biome ... i dont see rough,
// why?"): every turf, sand, water and path layer, the landscape's own ground
// types -- its landform's (biomes.js `landform.kinds`) and what falls under
// its trees (`fallen`) -- and rough, the bottom of the stack: no layer at all,
// so painting rough takes every layer off. A built course takes any ground
// type in any landscape; this only keeps the list to what the place has.
export function layersFor(biome) {
 // Road everywhere (the US landscapes goal, PLAN 4: "roads anywhere in the
 // builder"), as path is.
 const own = new Set(['path', 'road', ...Object.values(biome?.landform?.kinds ?? {}), biome?.fallen?.kind].filter(Boolean));
 return [...LAYER_ORDER.filter(k => !GROUND_KINDS.includes(k) || own.has(k)), 'rough'];
}
