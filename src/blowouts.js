// BLOWOUTS: RAW SAND WHERE THE WIND HAS TORN THE GRASS OFF A DUNE
// (Lakeshore Dunes, 23 October 2026; RESEARCH, *Lakeshore Dunes, the tenth
// biome*).
//
// On a Lake Michigan dune the beachgrass holds the sand until wind breaks
// through it and scoops a bowl out of the face. A course among those dunes
// shows them as ragged patches of open sand in the rough, well away from the
// mown ground, and a ball that finds one plays out of sand.
//
// PAINT AND LIE READ THE SAME NUMBERS. This file is the whole of it: a smooth
// field, baked once per course onto the ground atlas's own grid (the same
// texel centres as owner-atlas.js) as BYTES, and read back bilinearly. The
// ground shader samples those bytes through the cover texture's linear filter
// (its blue channel); `blowoutAt` here does the same arithmetic on the same
// bytes, so the two can disagree only by the filter's own rounding -- well
// under a centimetre -- rather than by a texel. Both then gate the field by
// how far the point lies outside its hole's corridor (`blowoutGate`, the
// shader's holeDistance being course.js's `nearest().d`), so no blowout
// reaches the playing lines, and both call it sand at exactly 0.5.
//
// Only rough becomes sand: a mown surface, a tee, a hazard or the beach is
// decided before this is asked, in both places, and nothing near water
// (BLOWOUT_WATER).
//
// Seeded from the course's own seed with its own stream, so building the field
// draws nothing from any generator RNG and moves nothing else.
import {ownerAtlasSize} from './owner-atlas.js';

// How far outside the corridor envelope a blowout may start, and over how far
// it fades in. PLACED: the corridor envelope already runs well past the mown
// edge, so 6 m outside it is open dune, not the first cut of rough.
export const BLOWOUT_NEAR = 6, BLOWOUT_RAMP = 16;
// And how far clear of water. The ground shader paints a band of wet soil
// round every pond, lake and creek (a look only; the lie there stays rough),
// and sand under that band would be painted soil and played as sand. So
// within this of a pond's or lake's edge, or of a creek's edge inside its own
// valley, there are no blowouts at all -- in both places, by the same
// distances (ground.js waterNear and streamNear; course.js surface).
export const BLOWOUT_WATER = 12;
// The scale of a patch, in metres: a dune-face bowl is tens of metres, not a
// bunker. PLACED.
const CELL = 38;

function hash(i, j, salt) {
 let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ salt;
 h = Math.imul(h ^ (h >>> 13), 1274126177);
 return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);
function noise(x, z, salt) {
 const i = Math.floor(x), j = Math.floor(z), fx = fade(x - i), fz = fade(z - j);
 const a = hash(i, j, salt), b = hash(i + 1, j, salt), c = hash(i, j + 1, salt), d = hash(i + 1, j + 1, salt);
 return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function saltOf(seed) {
 let h = 2166136261;
 for (const ch of String(seed) + ':blowouts') h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
 return h | 0;
}

// The raw field at a point, 0..1, before baking: two octaves of value noise
// with the first warping the second, so a patch is ragged and elongated
// rather than a round spot. `amount` sets where the 0.5 contour falls -- the
// larger, the more of the open dune is sand.
export function blowoutValue(x, z, salt, amount) {
 const wx = noise(x / (CELL * 2.1), z / (CELL * 2.1), salt ^ 0x5bd1) - .5;
 const wz = noise(x / (CELL * 2.1) + 17.3, z / (CELL * 2.1) - 4.1, salt ^ 0x2c1b) - .5;
 const u = x / CELL + wx * 1.6, v = z / CELL + wz * 1.6;
 const n = .68 * noise(u, v, salt) + .32 * noise(u * 2.3 + 5.7, v * 2.3 - 9.2, salt ^ 0x7f4a);
 // Steepened round the contour so the baked bytes cross 0.5 cleanly.
 return Math.max(0, Math.min(1, .5 + (n - (1 - amount)) * 4));
}

// The baked field for a course whose ground extends `ex`, `ez` either side of
// the centre: one byte per texel of the ground atlas.
export function blowoutField(seed, ex, ez, amount) {
 const {Sx, Sz} = ownerAtlasSize(ex, ez), salt = saltOf(seed), data = new Uint8Array(Sx * Sz);
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  data[j * Sx + i] = Math.round(blowoutValue(x, z, salt, amount) * 255);
 }
 return {Sx, Sz, ex, ez, data};
}

// The baked field read back the way a linear texture filter reads it: texel
// centres at (i + 0.5) / S, clamped at the edges.
export function blowoutAt(field, x, z) {
 const {Sx, Sz, ex, ez, data} = field;
 const u = (x / ex + 1) * .5 * Sx - .5, v = (z / ez + 1) * .5 * Sz - .5;
 const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 const at = (a, b) => data[Math.min(Sz - 1, Math.max(0, b)) * Sx + Math.min(Sx - 1, Math.max(0, a))];
 const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu, bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
 return (top + (bottom - top) * fv) / 255;
}

// Nothing within BLOWOUT_NEAR of the corridor envelope, all of the field past
// BLOWOUT_NEAR + BLOWOUT_RAMP. A smoothstep, written out as the shader's is.
export function blowoutGate(d) {
 const t = Math.max(0, Math.min(1, (d - BLOWOUT_NEAR) / BLOWOUT_RAMP));
 return t * t * (3 - 2 * t);
}

// Is this rough point open sand? `d` is nearest().d, signed.
// Only inside the field's own extent, as the shader asks: beyond it a clamped
// read would stretch the edge texels outward (into streaks, on the distant
// landscape rings, which wear the ground material).
export const isBlowout = (field, x, z, d) => !!field && Math.abs(x) < field.ex && Math.abs(z) < field.ez
 && blowoutAt(field, x, z) * blowoutGate(d) >= .5;
