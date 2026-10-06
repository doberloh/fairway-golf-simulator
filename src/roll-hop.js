// A ROLLING BALL THAT SKIPS, VERY SLIGHTLY (the owner, 6 October). Cosmetic only.
//
// A real ball rolling across mown grass is never perfectly glued to it: it rides
// over blades, divots, sand and the odd seam, and hops a few millimetres every
// so often -- more in rough, more on a fairway than a green, more when it is
// quick. This draws that. It changes nothing the physics decides: the path, the
// tracer, where the ball stops, what it hits and the readouts all come from the
// simulation, and this only lifts the ball MESH while it is rolling.
//
// NOT A PATTERN. Hops arrive at random -- the gap before each one is drawn from
// an exponential distribution, so there is no rhythm to pick out -- and each is
// a random height inside its surface's limit, flown as a real little parabola
// (rise and fall take the time gravity says that height takes). Quicker rolling
// means more often and higher; below a slow walk it stops.
//
// Seeded per shot, so a replay skips exactly as the shot did.
//
// TO TURN IT OFF: `ROLL_HOP.enabled = false` below, or `lab.rollHop(false)` in a
// running game.

export const ROLL_HOP = {
 enabled: true,
 // The highest a hop goes on each surface, in metres, at full rolling speed.
 // Placed by eye against the owner's brief: "more on fairways and rough, very
 // very little on greens". A ball is 42.7 mm across.
 height: {rough: .024, semi: .016, fairway: .01, tee: .008, fringe: .004, green: .0006, sand: 0},
 // Rolling speed (m/s) at which hops reach full height and frequency, and below
 // which there are none.
 fullSpeed: 6, minSpeed: .35,
 // Hops a second at full speed, on average. 3.2 was tried first and showed
 // about one hop in a whole fairway run-out: each lasts a tenth of a second.
 rate: 5,
};

const G = 9.80665;
// A small, fast, seedable generator (mulberry32): Math.random cannot be replayed.
function random(seed) {
 let a = seed >>> 0;
 return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One per shot. `step` is called each drawn frame with the frame's time step,
// the ball's rolling speed and the surface under it, and returns how far to lift
// the drawn ball (metres). Returns 0 when the feature is off or the ball is
// in the air.
export function createRollHop(seed) {
 const rnd = random(seed);
 let wait = 0, hop = null;
 const gap = rate => -Math.log(1 - rnd()) / Math.max(rate, 1e-6);
 return {
  step(dt, speed, surface, rolling) {
   if (!ROLL_HOP.enabled || !rolling || !(dt > 0)) { hop = null; return 0; }
   const k = Math.min(1, Math.max(0, (speed - ROLL_HOP.minSpeed) / (ROLL_HOP.fullSpeed - ROLL_HOP.minSpeed)));
   if (hop) {
    hop.t += dt;
    if (hop.t < hop.T) { const u = hop.t / hop.T; return 4 * hop.h * u * (1 - u); }
    hop = null; wait = gap(ROLL_HOP.rate * k);
   }
   if (k <= 0) return 0;
   wait -= dt;
   if (wait > 0) return 0;
   // Most hops are small and a few are not: the square of a uniform number
   // leans the heights toward the bottom of the range.
   const r = rnd(), h = (ROLL_HOP.height[surface] ?? ROLL_HOP.height.fairway) * k * (.15 + .85 * r * r);
   if (h <= 0) { wait = gap(ROLL_HOP.rate * k); return 0; }
   hop = {h, t: 0, T: 2 * Math.sqrt(2 * h / G)};
   return 0;
  },
 };
}

// A seed from the shot itself, so the same shot always skips the same way.
export function seedFor(result) {
 const e = result?.end ?? {x: 0, z: 0};
 return (Math.round(e.x * 1000) * 73856093) ^ (Math.round(e.z * 1000) * 19349663) ^ Math.round((result?.time ?? 0) * 1000);
}
