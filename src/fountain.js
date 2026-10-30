// AN AERATING FOUNTAIN'S WATER, IN MOTION (the owner's review, 30 October
// 2026: "Fountains need to be animated ... it's probably not a Blender static
// model, right?"). It was: a frozen plume, tools/blender/architect_water.py.
// Now the renderer draws the water and this module says where every drop is
// at a time `t` -- no DOM, no three.js, so tests/fountain.test.mjs checks it.
//
// The shape is what a floating pond aerator throws: drops leave a nozzle at
// the surface nearly straight up, rise to about 4 m, open into a crown and
// fall back in a ring two or three metres out. Each drop flies a parabola
// under gravity and is born again at the nozzle when it lands, its phase
// spread so the plume is steady. Rings spread on the water where they land.
//
// Every size below is PLACED (a 1 to 2 hp aerator's display, read from
// makers' pictures, not measured): apex 3.0-4.2 m, landing 0.3-3.2 m out.

export const GRAVITY = 9.81;

// A small seeded generator, so a fountain is the same every time it is drawn.
function rng(seed) {
 let a = seed >>> 0;
 return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// `n` drops: launch speed up (`vy`) and out (`vr`), heading `a`, a phase in
// [0, 1) of its own flight, and a size in metres.
export function fountainDrops(n = 480, seed = 1) {
 const r = rng(seed), out = [];
 for (let k = 0; k < n; k++) {
  // A third form the core, fast and nearly straight up; the rest the crown.
  const core = k % 3 === 0;
  const apex = core ? 3.7 + r() * .5 : 3.0 + r() * .9;
  const vy = Math.sqrt(2 * GRAVITY * apex);
  const flight = 2 * vy / GRAVITY;
  // Iteration 2: the crown lands wider (1.6-3.2 m, was 1.2-2.8), so the
  // plume opens like a vase instead of standing as a column.
  const land = core ? .3 + r() * .6 : 1.6 + r() * 1.6;
  out.push({vy, vr: land / flight, a: (k * 2.39996 + r() * .4) % (Math.PI * 2), phase: r(), size: core ? .05 + r() * .025 : .04 + r() * .035});
 }
 return out;
}

// Where drop `d` is at time `t`, relative to the nozzle: {x, y, z, s} with
// `s` its drawn size -- full in the air, shrinking in the last tenth of its
// flight so it sinks into the water rather than vanishing -- and its
// velocity {vx, vy, vz}, along which the renderer stretches it into a streak
// (iteration 2: round drops read as popcorn).
export function dropAt(d, t) {
 const flight = 2 * d.vy / GRAVITY, u = ((t / flight + d.phase) % 1 + 1) % 1, f = u * flight;
 const y = d.vy * f - GRAVITY * f * f / 2, r = d.vr * f;
 return {x: Math.cos(d.a) * r, y, z: Math.sin(d.a) * r, s: d.size * (u > .9 ? (1 - u) / .1 : 1), vx: Math.cos(d.a) * d.vr, vy: d.vy - GRAVITY * f, vz: Math.sin(d.a) * d.vr};
}

// The rings on the water: `k` of `n`, spreading from 1 m to 4 m over
// `period` seconds and fading as they go. {r, o}: radius and opacity.
export function ringAt(k, n, t, period = 2.6) {
 const u = ((t / period + k / n) % 1 + 1) % 1;
 return {r: 1 + 3 * u, o: .55 * (1 - u) * Math.min(1, u * 6)};
}

// The jet's height: it breathes a little, as a real one does in the wind.
// Iteration 4: to the crown, 3.7 m (was 3.3, and a translucent veil round
// the plume, iteration 3, which read as a glass dome and was dropped).
export const jetAt = (t, phase = 0) => 3.7 + .18 * Math.sin(t * 1.7 + phase) + .08 * Math.sin(t * 4.3 + phase * 2);
