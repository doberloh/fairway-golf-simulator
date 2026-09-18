// One world per distinct set of settings, per test file.
//
// Building a 9-hole course takes three to five seconds, and the suite's wall
// time is not its total work -- the runner puts each FILE in its own process
// and runs them in parallel, so the wall is whatever the slowest single file
// takes. Measured, that was `water-terrain.test.mjs` at 326 seconds, almost all
// of it spent rebuilding terrain that an earlier test in the same file had
// already built.
//
// Generation is deterministic in its settings, so a second call with the same
// settings can only produce the same course. Caching it is free correctness.
//
// THE ONE RULE: a test must not mutate the world it is handed. Everything here
// reads -- heights, surfaces, hole geometry -- and a test that needs to change
// a course should call `generateWorld` directly and keep it to itself.
import {generateWorld} from '../src/course.js';

const cache = new Map();

export function world(settings) {
 // Key on sorted entries, so the same settings written in a different order
 // are the same course -- which they are.
 const key = JSON.stringify(Object.entries(settings).sort(([a], [b]) => a < b ? -1 : 1));
 if (!cache.has(key)) cache.set(key, generateWorld(settings));
 return cache.get(key);
}

// Several courses at once, deduplicated, for a test that sweeps seeds or biomes.
export function worlds(list) {
 return list.map(world);
}

export const cacheSize = () => cache.size;
