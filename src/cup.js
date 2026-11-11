// THE HOLE. A ball meeting the cup, as a rigid sphere meeting real shapes: the
// green round the hole, the sharp rim, the cylinder below it, the floor, and
// the flagstick when it is in.
//
// NOTHING HERE DECIDES WHETHER A PUTT DROPS. There is no capture speed, no
// lip-out rule and no scripted fall. The ball is stepped at a few thousand
// hertz under gravity; wherever it overlaps one of those shapes it is pushed
// out and given the impulse a collision gives (a bounce along the contact
// normal, friction against its slip, spin to match). A slow putt topples over
// the front edge and drops; a firm one crosses the opening falling, meets the
// back wall below its equator and stays in, or meets the back rim above it and
// hops out; one that catches the side rides the rim round and either falls or
// horseshoes. All of that is what the contacts produce, and tests/cup.test.mjs
// checks it against the published capture limits (Holmes 1991, Penner 2002).
//
// Pure: no DOM, no three.js, no course. physics.js hands a ball over with
// `cupSim` once it reaches the hole and takes it back when it leaves or rests.
// docs/BALL_PHYSICS.md, *The hole*.

const G = 9.80665;
export const CUP_RADIUS = 0.053975;   // 4.25 in across
export const BALL_RADIUS = 0.021335;
export const CUP_DEPTH = 0.1016;      // 4 in, the Rules' minimum
const R = BALL_RADIUS;

// What the hole is made of. Restitution is how much of the speed into a surface
// comes back out of it; friction is the grip available per unit of press.
//   rim    the cut edge of the turf, and the inch of soil above the liner
//   wall   the liner
//   floor  the bottom of the liner
//   pin    a fibreglass flagstick
// `settle` is the approach speed below which a contact no longer bounces.
export const CUP = {
 rimE: .30, rimMu: .40,
 wallE: .40, wallMu: .30,
 floorE: .30, floorMu: .40,
 pinE: .45, pinMu: .30,
 settle: .12,
 // The micro-step, seconds. 1/4000 s moves a 2 m/s ball half a millimetre.
 dt: 1 / 4000,
 // How far from the middle of the hole the ball is handed back to the course.
 zone: CUP_RADIUS + R + .035,
};

const cross = (a, b, o) => { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const tmp = [0, 0, 0], tmp2 = [0, 0, 0], nrm = [0, 0, 0];

// One collision, resolved. `n` is the unit normal out of the surface at the
// contact, `pen` how far the ball has sunk into it. Moves the ball out, bounces
// it, and applies Coulomb friction with a solid sphere's inertia (I = 2/5 m r^2:
// an impulse at the surface changes the contact point's velocity 7/2 times as
// fast as the centre's). Returns the normal impulse per unit mass, which is how
// hard the surface was pressed -- rolling resistance is charged against it.
function collide(p, v, w, n, pen, e, mu, settle) {
 p[0] += n[0] * pen; p[1] += n[1] * pen; p[2] += n[2] * pen;
 const vn = dot(v, n);
 if (vn >= 0) return 0;
 const jn = -(1 + (-vn > settle ? e : 0)) * vn;
 // Velocity of the point of the ball touching the surface.
 cross(w, n, tmp);
 const sx = v[0] - vn * n[0] - R * tmp[0], sy = v[1] - vn * n[1] - R * tmp[1], sz = v[2] - vn * n[2] - R * tmp[2];
 const slip = Math.hypot(sx, sy, sz);
 v[0] += jn * n[0]; v[1] += jn * n[1]; v[2] += jn * n[2];
 if (slip > 1e-9) {
  const jt = Math.min(slip / 3.5, mu * jn), ux = sx / slip, uy = sy / slip, uz = sz / slip;
  v[0] -= jt * ux; v[1] -= jt * uy; v[2] -= jt * uz;
  tmp2[0] = ux; tmp2[1] = uy; tmp2[2] = uz;
  cross(n, tmp2, tmp);
  const k = 2.5 * jt / R;
  w[0] += k * tmp[0]; w[1] += k * tmp[1]; w[2] += k * tmp[2];
 }
 return jn;
}

// A ball at the hole, stepped until it rests or leaves.
//
// `ball` is {p, v, w}: position, velocity and angular velocity (rad/s) as
// arrays, in the same frame as `hole`. They are advanced in place.
// `hole` is {x, z, y, gx, gz}: the middle of the hole, the height of the green
// there, and the green's slope (rise per metre along x and z) -- the lip
// follows the slope, as a cup cut straight down into a tilted green does.
// `env`: {roll: the green's rolling deceleration (m/s^2), slide: its sliding
// friction, e: its restitution for a slow bounce, pin: flagstick radius or 0,
// t: the clock on entry, sample: seconds between recorded points, maxTime}.
// Returns {holed, lipped, pinHits, rest, t, points, contacts}.
export function cupSim(ball, hole, env = {}) {
 const {p, v, w} = ball, dt = env.dt || CUP.dt;
 const roll = env.roll ?? .55, slide = env.slide ?? .3, greenE = env.e ?? .3, pin = env.pin || 0;
 const sample = env.sample ?? 1 / 240, maxTime = env.maxTime ?? 8;
 const points = [], contacts = [];
 let t = env.t || 0, next = t, lipped = false, pinHits = 0, holed = false, rest = false;
 const slopeLen = Math.hypot(hole.gx, 1, hole.gz);
 const N = [-hole.gx / slopeLen, 1 / slopeLen, -hole.gz / slopeLen];
 const floorY = hole.y - CUP_DEPTH;
 const rollMu = roll / G;
 let still = 0, lastTouch = null;
 const heard = (what, speed) => { if (speed > .25 && lastTouch !== what) contacts.push({t, what, speed, x: p[0], y: p[1], z: p[2]}); lastTouch = what; };
 const end = t + maxTime;
 while (t < end) {
  v[1] -= G * dt;
  p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
  t += dt;
  const dx = p[0] - hole.x, dz = p[2] - hole.z, rho = Math.hypot(dx, dz);
  let pressed = 0, touching = false;
  if (rho >= CUP_RADIUS) {
   // On the green beside the hole.
   const gap = (p[1] - (hole.y + hole.gx * dx + hole.gz * dz)) * N[1] - R;
   if (gap < 0) {
    const vn = dot(v, N);
    if (-vn > .6) heard('green', -vn);
    pressed = collide(p, v, w, N, -gap, greenE, slide, CUP.settle); touching = true;
    nrm[0] = N[0]; nrm[1] = N[1]; nrm[2] = N[2];
   }
  } else {
   const ux = rho > 1e-9 ? dx / rho : 1, uz = rho > 1e-9 ? dz / rho : 0;
   // The lip at this bearing: the green's own height at the rim.
   const lip = hole.y + (hole.gx * ux + hole.gz * uz) * CUP_RADIUS;
   const up = p[1] - lip;
   if (up >= 0) {
    // Above the lip: only the sharp edge can touch it.
    const out = CUP_RADIUS - rho, dist = Math.hypot(out, up);
    if (dist < R && dist > 1e-9) {
     nrm[0] = -ux * out / dist; nrm[1] = up / dist; nrm[2] = -uz * out / dist;
     const vn = dot(v, nrm);
     if (-vn > .3) heard('rim', -vn);
     pressed = collide(p, v, w, nrm, R - dist, CUP.rimE, CUP.rimMu, CUP.settle); touching = true; lipped = true;
    }
   } else if (rho > CUP_RADIUS - R) {
    // Below the lip: the wall.
    nrm[0] = -ux; nrm[1] = 0; nrm[2] = -uz;
    const vn = dot(v, nrm);
    if (-vn > .3) heard('cup', -vn);
    pressed = collide(p, v, w, nrm, rho - (CUP_RADIUS - R), CUP.wallE, CUP.wallMu, CUP.settle); touching = true; lipped = true;
   }
   if (p[1] - R < floorY) {
    nrm[0] = 0; nrm[1] = 1; nrm[2] = 0;
    const vn = v[1];
    if (-vn > .3) heard('cup', -vn);
    pressed += collide(p, v, w, nrm, floorY - (p[1] - R), CUP.floorE, CUP.floorMu, CUP.settle); touching = true;
   }
  }
  if (pin > 0 && rho < pin + R && rho > 1e-9 && p[1] - R < hole.y + 2.4) {
   nrm[0] = dx / rho; nrm[1] = 0; nrm[2] = dz / rho;
   const vn = dot(v, nrm);
   if (vn < -.05) { pinHits++; heard('flagstick', -vn); }
   collide(p, v, w, nrm, pin + R - rho, CUP.pinE, CUP.pinMu, CUP.settle);
  }
  // Rolling resistance: the turf's own, charged against how hard the ball is
  // pressed onto whatever it is rolling on. On the level green that press is
  // its weight and this is exactly the Stimp's deceleration; round the rim it
  // is weight plus the press of going round, so a fast rim ride is scrubbed
  // harder than a slow one.
  if (touching && pressed > 0) {
   const speed = Math.hypot(v[0], v[1], v[2]);
   if (speed > 1e-6) {
    const k = Math.max(0, 1 - rollMu * pressed / speed);
    v[0] *= k; v[1] *= k; v[2] *= k; w[0] *= k; w[1] *= k; w[2] *= k;
   }
  }
  if (t >= next) { points.push({x: p[0], y: p[1], z: p[2], t, v: Math.hypot(v[0], v[1], v[2]), w: Math.hypot(w[0], w[1], w[2]) * 30 / Math.PI}); next = t + sample; }
  const speed = Math.hypot(v[0], v[1], v[2]);
  const inside = rho < CUP_RADIUS && p[1] < hole.y - R * .5;
  // Down in the hole with no way to climb out: holed. It is still stepped
  // until it lies still, so what is drawn is the ball actually coming to rest.
  if (inside && !holed) {
   const climb = (hole.y + R) - p[1];
   if (.5 * speed * speed + .2 * R * R * dot(w, w) < G * climb * .9) holed = true;
  }
  if (touching && speed < .012) { still += dt; if (still > .05) { rest = true; break; } } else still = 0;
  if (holed && p[1] - R < floorY + .002 && speed < .06) { rest = true; break; }
  // Clear of the hole and going away: back to the course.
  if (!holed && rho > CUP.zone && dx * v[0] + dz * v[2] > 0) break;
  if (!holed && p[1] - hole.y > .6) break;
 }
 if (holed || rest) { v[0] = 0; v[1] = 0; v[2] = 0; w[0] = 0; w[1] = 0; w[2] = 0; }
 points.push({x: p[0], y: p[1], z: p[2], t, v: Math.hypot(v[0], v[1], v[2]), w: Math.hypot(w[0], w[1], w[2]) * 30 / Math.PI});
 return {holed, lipped: lipped && !holed, pinHits, rest: rest || holed, t, points, contacts};
}

// A putt rolled straight at a hole on a level green, for tests and benches:
// `speed` is how fast it is rolling as it reaches the front edge, `offset` how
// far off the middle its line runs (m). Returns cupSim's result.
export function rollAtCup(speed, offset = 0, env = {}) {
 const slope = env.slope || 0;   // rise per metre along the putt's line (+ uphill)
 const hole = {x: 0, z: 0, y: 0, gx: 0, gz: slope};
 const z0 = -CUP.zone;
 const p = [offset, slope * z0 + R * Math.hypot(1, slope), z0];
 const v = [0, slope * speed, speed], w = [speed / R, 0, 0];
 return cupSim({p, v, w}, hole, env);
}
// The fastest a ball can be rolling at the front edge and still be holed, at a
// given offset from the middle of the hole (m/s), by bisection.
export function captureSpeed(offset = 0, env = {}) {
 let lo = 0, hi = 4;
 for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (rollAtCup(mid, offset, env).holed) lo = mid; else hi = mid; }
 return (lo + hi) / 2;
}
