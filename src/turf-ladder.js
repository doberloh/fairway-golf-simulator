// ONE HUE FOR THE PLAYING TURF (the owner, 26 November 2026: "I want the
// playing surface grass (fairway, semi, approach, fringe, green) in each biome
// to not be different hues ... the thing that I'm noticing matters the most is
// the lightness slider. And im finding that i like what i see around 40-45. So
// please color grade each landscape to be same hue and then just different
// saturations and lightness.").
//
// The mown turf is one grass cut to different heights, so it is one hue: the
// fairway's, which carries the landscape's character. Each surface is a step
// of lightness and saturation off it -- the shorter the cut, the lighter and
// a touch greyer (more stem and thatch shows) -- the green lightest at 44%,
// in the owner's 40-45, the fairway at 34. The approach and the tee take the fairway's colour
// (ground.js). The rough is the landscape's own, untouched. Pure: biomes.js
// lays it on every landscape, seasons.js again on a season's fairway.
// All PLACED (RESEARCH, *One hue for the playing turf*).
import {hexToHsl, hslToHex} from './colour-lab.js';

// Every landscape's fairway at this lightness (HSL, the base colour before
// the turf grade, textures.js turfGrade).
// THE OWNER'S PICK, B (26 November 2026, from three photographed on all 15
// landscapes, docs/RESEARCH.md *One hue for the playing turf*): the green at
// 44, in the 40-45 the owner liked, 10 points over a fairway at 34 so it
// still stands out. A (green 44, fairway 38) lost the green into the
// fairway from the approach; C (green 51, fairway 42) was Claude's
// recommendation and was not taken.
export const FAIRWAY_LIGHT = 34;
// Each surface off the fairway: lightness and saturation, in HSL points.
export const TURF_LADDER = {semi: {l: -3, s: 0}, fairway: {l: 0, s: 0}, fringe: {l: 5, s: -2}, green: {l: 10, s: -3}};

// The four playing turf colours from a fairway colour: its hue and
// saturation for all, its lightness the ladder's foot. `light` sets the
// fairway's lightness first (a landscape's record); without it the fairway
// keeps its own (a season's).
export function turfLadder(fairway, {light = null} = {}) {
 const {h, s, l} = hexToHsl(fairway), foot = light ?? l;
 return Object.fromEntries(Object.entries(TURF_LADDER).map(([k, d]) => [k, hslToHex({h, s: s + d.s, l: foot + d.l})]));
}
