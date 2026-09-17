// Endless mode: one hole after another, forever.
//
// The main menu grows a single showcase hole every time it opens, and that is
// the nicest thing the generator does -- a whole landscape shaped around one
// hole rather than nine holes sharing a valley. Endless mode is that, made
// playable: hole out, and the next one grows.
//
// A run is ONE seed. Hole seven's landscape comes from that seed and the number
// seven, so resuming needs nothing stored but the seed and which hole you were
// on -- and the round already carries both. Storing the generated settings
// instead would mean pushing a one-hole course through settings validation,
// which only recognises nine and eighteen.

import {randomSettings, DEFAULT_COURSE} from './settings-schema.js';
import {turfConfig} from './turf.js';

function rng(seed) {
 let a = 2166136261;
 for (const c of String(seed)) { a ^= c.charCodeAt(0); a = Math.imul(a, 16777619); }
 return () => {
  a += 0x6D2B79F5;
  let t = Math.imul(a ^ a >>> 15, a | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
 };
}

const WORDS = ['DRIFT', 'LANTERN', 'BRAMBLE', 'COVE', 'FERNGLEN', 'SLATE', 'HARROW', 'MARROWOOD', 'PELICAN', 'WINDROW', 'CASTLE', 'ASHFORD'];

// Roughly the shape of a real nine: a couple of short holes, a couple of long
// ones, and mostly par fours in between. Yardages stay inside the bands that
// planCourse turns into that par, so the mix is what it says it is.
const SHAPES = [
 {par: 3, lo: 135, hi: 245, weight: 2},
 {par: 4, lo: 300, hi: 465, weight: 5},
 {par: 5, lo: 485, hi: 615, weight: 2},
];
const TOTAL_WEIGHT = SHAPES.reduce((a, s) => a + s.weight, 0);

export const newRunSeed = (random = Math.random) =>
 WORDS[Math.floor(random() * WORDS.length)] + '-' + Math.floor(1000 + random() * 9000);

export function pickShape(r) {
 let roll = r() * TOTAL_WEIGHT;
 for (const shape of SHAPES) { if (roll < shape.weight) return shape; roll -= shape.weight; }
 return SHAPES[SHAPES.length - 1];
}

// The look is deliberately the menu backdrop's: heavy planting, a pond's worth
// of water, and none of the things that only make sense across a whole property
// -- houses lining a street, a river running through several holes.
export function endlessHole(runSeed, index) {
 const r = rng(`${runSeed}#${index}`);
 const shape = pickShape(r);
 return {
  ...randomSettings(r),
  seed: `${runSeed}-${index + 1}`,
  holes: 1,
  courseYards: Math.round(shape.lo + r() * (shape.hi - shape.lo)),
  trees: 100,
  water: 55,
  homes: false,
  rivers: 0,
  creeks: 0,
  lakes: 0,
 };
}

// What loadCourse normalises a one-hole run's settings to.
//
// It lives here, and it is idempotent, because the main menu builds its world
// from this and loadCourse looks that world up by a key computed from the same
// fields. Normalise differently in the two places and the key misses, the world
// is thrown away, and the hole you were looking at when you chose Endless is
// replaced by a different one -- which is the whole thing this is here to stop.
export function endlessSettings(source) {
 const out = {...DEFAULT_COURSE, ...source, holes: 1};
 out.style = 'cartoon';
 out.turf = turfConfig(source.turf);
 return out;
}
