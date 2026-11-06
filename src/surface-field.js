// THE SURFACE FIELD (Architect courses, phase 3; the study's engine piece,
// docs/ARCHITECT_COURSES.md *The surface field*).
//
// A picture of the course's ground baked on the ground atlas's grid (the
// owner atlas, owner-atlas.js: square texels about 1.75 m across), one byte a
// channel, which the ground shader paints from and `surface` (course.js)
// plays from -- the same bytes read the same way, as the blowouts and the
// wild ground types already are, so the paint and the lie cannot disagree.
//
// WHY IT EXISTS. The ground shader draws a hole's hazards from the per-hole
// table: twelve slots, each an analytic oval with waves (ground.js
// HOLE_ATLAS, HAZARD_SLOTS here). A hole asked for more -- a signature waste
// area with its lobes, or bunkers added by hand in the studio -- had to be cut
// to twelve. Bunkers past the slots now go into the field instead, so the
// limit is what a hole should hold, not what the table can (Architect's
// HAZARD_CAP, 24, went with hand-tools.js on 2 November 2026; nothing
// generated fills the twelve slots since).
//
// THE CHANNELS. Each holds a signed distance to an edge, in metres, as
// 0.5 - d / (2 * FIELD_RANGE): 0.5 on the edge, above inside. A distance
// rather than a 0/1 mask, so a linear filter over a 1.75 m texel still draws a
// smooth edge a few centimetres wide where a mask would draw a staircase.
//   R  sand: the bunkers past the slots
//   G, B, A  free: room for the next layers the study lists (a hand-drawn
//      fairway or green outline, a native line, wear), which the sculpting
//      and real-courses studies need (docs/studies, local)
//
// ARCHITECT ONLY. A Classic hole holds at most twelve hazards, so it has no
// bunker past the slots, bakes no field and samples none (ground.js binds a
// one-texel stand-in and never reads it: `archGround`).
import {ownerAtlasSize} from './owner-atlas.js';

// The hazard slots in the per-hole table (ground.js HOLE_ATLAS.hazards).
export const HAZARD_SLOTS = 12;
// Metres either side of an edge a channel can tell apart: 8 m over 255 steps,
// about 3 cm a step. Past it a byte reads plainly in or plainly out. PLACED.
export const FIELD_RANGE = 4;

// Which of a hole's bunkers go to the field: the table's slots are filled in
// the order the shader paints them -- collection areas, bunkers, ponds
// (renderer.js) -- and the ponds and collection areas always have one, so the
// bunkers take what is left and the last ones laid (lobes, the hand's) go to
// the field. Marks them `field: true`; returns how many. A hole that fits the
// slots is untouched, which is every Classic hole.
export function markOverflow(h) {
 const fixed = (h.collections?.length || 0) + (h.ponds?.length || 0), room = Math.max(0, HAZARD_SLOTS - fixed);
 let n = 0;
 h.bunkers.forEach((b, i) => { if (i >= room) { b.field = true; n++; } else delete b.field; });
 return n;
}

// A bunker's signed distance at a hole-local point, metres (negative inside):
// the shader's own measure for its slots (ground.js, the hazard loop) -- the
// radius ratio against the wavy edge, scaled back to metres along the ray.
export function bunkerDistance(x, z, b) {
 const qx = (x - b.x) / b.rx, qz = (z - b.z) / b.rz, a = Math.atan2(qz, qx), q = Math.hypot(qx, qz);
 const edge = 1 + (b.wave2 ?? 0) * Math.sin(a * 2 + b.phase) + (b.wave3 ?? .07) * Math.sin(a * 3 + b.phase);
 return (q - edge) * Math.hypot(x - b.x, z - b.z) / Math.max(q, 1e-4);
}

// The field for a course whose ground runs `ex`, `ez` either side of its
// centre, or null when no hole has a bunker past its slots. `holes` carry
// toWorld/toLocal (course.js routing).
export function surfaceField(holes, ex, ez) {
 const over = holes.flatMap(h => h.bunkers.filter(b => b.field).map(b => ({h, b})));
 if (!over.length) return null;
 const {Sx, Sz} = ownerAtlasSize(ex, ez), data = new Uint8Array(Sx * Sz * 4);
 const byte = d => Math.round(Math.max(0, Math.min(1, .5 - d / (2 * FIELD_RANGE))) * 255);
 // Each bunker only touches the texels its box reaches, past its widest
 // wave by the range, so the bake costs the bunkers' area, not the course's.
 const best = new Float32Array(Sx * Sz).fill(FIELD_RANGE);
 for (const {h, b} of over) {
  const reach = Math.max(b.rx, b.rz) * (1 + Math.abs(b.wave2 ?? 0) + Math.abs(b.wave3 ?? .07)) + FIELD_RANGE + 2;
  const c = h.toWorld({x: b.x, z: b.z});
  const i0 = Math.max(0, Math.floor(((c.x - reach) / ex + 1) * .5 * Sx)), i1 = Math.min(Sx - 1, Math.ceil(((c.x + reach) / ex + 1) * .5 * Sx));
  const j0 = Math.max(0, Math.floor(((c.z - reach) / ez + 1) * .5 * Sz)), j1 = Math.min(Sz - 1, Math.ceil(((c.z + reach) / ez + 1) * .5 * Sz));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
   const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez, p = h.toLocal({x, z});
   const d = bunkerDistance(p.x, p.z, b), k = j * Sx + i;
   if (d < best[k]) best[k] = d;
  }
 }
 for (let k = 0; k < Sx * Sz; k++) data[k * 4] = byte(best[k]);
 return {Sx, Sz, ex, ez, data};
}

// One channel read back the way a linear texture filter reads it (texel
// centres at (i + 0.5) / S, clamped at the edges), 0..1.
export function fieldAt(field, x, z, channel = 0) {
 const {Sx, Sz, ex, ez, data} = field;
 const u = (x / ex + 1) * .5 * Sx - .5, v = (z / ez + 1) * .5 * Sz - .5;
 const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
 const at = (a, b) => data[(Math.min(Sz - 1, Math.max(0, b)) * Sx + Math.min(Sx - 1, Math.max(0, a))) * 4 + channel];
 const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu, bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
 return (top + (bottom - top) * fv) / 255;
}

// Is this world point field sand? Inside the field's own extent only, as the
// shader asks (a clamped read past it would stretch the edge texels outward).
export const isFieldSand = (field, x, z) => !!field && Math.abs(x) < field.ex && Math.abs(z) < field.ez
 && fieldAt(field, x, z, 0) >= .5;
