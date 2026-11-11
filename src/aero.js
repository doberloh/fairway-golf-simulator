// THE AIR. Everything a golf ball feels between leaving the club face and
// touching the ground: drag, lift from spin, the spin dying away, the density
// of the air and the wind, which is slower near the ground than aloft.
//
// Pure: no DOM, no three.js, no course. physics.js flies the ball with
// `airAcceleration` and `spinDecay`; tools/ball-bench.mjs and
// tools/flight-fit.mjs fly it with `flyBall` against launch-monitor data.
// docs/BALL_PHYSICS.md, *The air*, has the sources and the fit.
//
// SI units throughout: metres, seconds, kilograms, radians.

export const G = 9.80665, R = 0.021335, MASS = 0.04593, MPH = 0.44704, YARD = 0.9144;
const AREA = Math.PI * R * R;

// Air density, kg/m^3, from altitude (m) and temperature (deg C): the
// barometric formula for pressure and the ideal gas law for dry air.
export function airDensity(altitude = 0, temp = 18) {
 const t = temp + 273.15;
 return 101325 * Math.exp(-G * 0.0289644 * altitude / (8.31446 * t)) / (287.058 * t);
}
// Dynamic viscosity of air, Pa s (Sutherland's law). It moves the Reynolds
// number by about 5% between a cold morning and a hot afternoon.
export function airViscosity(temp = 18) {
 const t = temp + 273.15;
 return 1.458e-6 * Math.pow(t, 1.5) / (t + 110.4);
}

// LIFT AND DRAG, as functions of two numbers the ball itself carries:
//   S  = spin x radius / airspeed  (the spin ratio)
//   Re = density x airspeed x diameter / viscosity  (the Reynolds number)
// Nothing here knows which club was swung.
//
// THE SHAPES ARE THE WIND TUNNEL'S, THE NUMBERS ARE FITTED. Bearman and Harvey
// (1976), Smits and Smith (1994) and Lyu, Kensrud, Smith and Tosaya (2018) all
// measured the same picture on dimpled balls:
//   - lift rises steeply with spin ratio and then flattens, so it is written
//     as a saturating curve, CL = liftMax x S / (S + liftHalf). It is zero for
//     a ball that is not spinning, with no extra rule needed to make it so.
//   - drag is a floor plus a part that grows with spin ratio: slowly at a
//     drive's low ratio, quickly through an iron's, flattening at a wedge's
//     (CD = dragBase + dragRise x S^2 / (S^2 + dragHalf^2)). A straight line
//     cannot be right at both ends: fitted to irons it leaves every drive 4-6%
//     short, and Acushnet's wind-tunnel figures for a production ball (US
//     patent 6,913,550: CD 0.222 at a drive's speed and spin, about 0.31 at a
//     slow iron's) say the same.
//   - below the dimples' critical Reynolds number the boundary layer stops
//     tripping and drag climbs toward a smooth sphere's. That is a slow ball: a
//     chip, a pitch, or the last second of a high wedge.
// The numbers are fitted to flights (tools/flight-fit.mjs, 11 November 2026):
// TrackMan's normalised 6 iron in calm and in wind (carry within 0.6%, peak
// height 0.4%, landing angle 0.4 degrees), its 60-row driver chart (1.7%), the
// 2023 tour averages (2.7%, a raw table), and the owner's GC3 and R50 sessions
// (1.7% and 2.3%). They were not fitted to a wind tunnel, and came out on one:
// at a drive's speed and spin they give CD 0.219 and CL 0.153, where Acushnet
// measured 0.222 and 0.152 on a production ball.
export const AERO = {
 liftMax: 0.5386, liftHalf: 0.2148,
 dragBase: 0.1964, dragRise: 0.2402, dragHalf: 0.2633,
 dragLow: 0.0603, lowRe: 78070, lowReWidth: 12000,
 // Seconds for spin to fall by 1/e at 100 mph in sea-level air. The torque that
 // slows the spin grows with airspeed and density, so a drive sheds spin faster
 // than a wedge. Smits and Smith measured 23.8 s, Tavares et al. 18.9 s by radar.
 spinTau: 21.5,
 // Wind is given at `windHeight` metres and falls off toward the ground as a
 // power law of height (open, mown country): w(z) = w x (z / windHeight)^windShear.
 // 20 m is where a mid iron spends its flight, and is chosen so that a stated
 // wind does to a 6 iron what TrackMan's wind table says a wind of that speed
 // does (10 and 20 mph headwinds: -18 and -41 yd; here -18.0 and -41.8). At the
 // weather service's 10 m the same stated wind cost 48 yd.
 windHeight: 20, windShear: 0.16, windFloor: 0.5,
};
const SPIN_TAU_SPEED = 100 * MPH;

export function coefficients(speed, spin, rho = 1.225, mu = 1.81e-5) {
 const u = Math.max(speed, 0.1);
 const s = Math.abs(spin) * R / u, re = rho * u * 2 * R / mu;
 const sc = Math.min(s, 1.2);
 const cd = AERO.dragBase + AERO.dragRise * sc * sc / (sc * sc + AERO.dragHalf * AERO.dragHalf)
  + AERO.dragLow / (1 + Math.exp((re - AERO.lowRe) / AERO.lowReWidth));
 const cl = AERO.liftMax * sc / (sc + AERO.liftHalf);
 return {cd, cl, s, re};
}

// The wind a ball at height `y` above the ground feels, given the wind at the
// reference height. Mutates and returns `out`.
export function windAt(wind, y, out = [0, 0, 0], uniform = false) {
 const f = uniform ? 1 : Math.pow(Math.max(y, AERO.windFloor) / AERO.windHeight, AERO.windShear);
 out[0] = wind[0] * f; out[1] = wind[1] * f; out[2] = wind[2] * f;
 return out;
}

// Acceleration of a ball in the air. `v` is its velocity, `w` its angular
// velocity as a vector (rad/s), `air` is {rho, mu, wind, ground} with `ground`
// the terrain height under the ball (for the wind's height). Writes into `out`.
const scratch = [0, 0, 0];
export function airAcceleration(v, w, air, height, out = [0, 0, 0]) {
 const wind = air.wind ? windAt(air.wind, height, scratch, air.uniform) : null;
 const ux = v[0] - (wind ? wind[0] : 0), uy = v[1] - (wind ? wind[1] : 0), uz = v[2] - (wind ? wind[2] : 0);
 const u = Math.hypot(ux, uy, uz);
 if (u < 0.01) { out[0] = 0; out[1] = -G; out[2] = 0; return out; }
 const spin = Math.hypot(w[0], w[1], w[2]);
 const {cd, cl} = coefficients(u, spin, air.rho, air.mu);
 const k = 0.5 * air.rho * AREA / MASS;
 // Magnus: along (spin axis) x (airspeed), which for backspin is upward.
 let lx = w[1] * uz - w[2] * uy, ly = w[2] * ux - w[0] * uz, lz = w[0] * uy - w[1] * ux;
 const ln = Math.hypot(lx, ly, lz);
 const lift = ln > 1e-9 ? k * cl * u * u / ln : 0;
 out[0] = -k * cd * u * ux + lift * lx;
 out[1] = -k * cd * u * uy + lift * ly - G;
 out[2] = -k * cd * u * uz + lift * lz;
 return out;
}
// The factor a spin vector is multiplied by over `dt` seconds at this airspeed.
export const spinDecay = (speed, dt, rho = 1.225) =>
 Math.exp(-dt * speed / SPIN_TAU_SPEED / AERO.spinTau * (rho / 1.225));

// `uniformWind` blows the same at every height: what TrackMan's wind tables
// assume, and so what they are compared under. The game's wind has a profile.
export const makeAir = ({altitude = 0, temperature = 18, wind = null, uniformWind = false} = {}) => ({
 uniform: !!uniformWind,
 rho: airDensity(altitude, temperature), mu: airViscosity(temperature),
 wind: wind && (wind[0] || wind[1] || wind[2]) ? wind : null,
});

// A ball flown over dead flat ground until it comes back down to launch height.
// For fitting and benches: launch-monitor conventions in, flight numbers out.
// `shot` is {speed (m/s), vla, hla, spin (rpm), spinAxis} in degrees; positive
// hla starts right, positive spinAxis curves right.
export function flyBall(shot, options = {}) {
 const dt = options.dt || 1 / 240, rad = Math.PI / 180;
 const air = makeAir(options);
 const yaw = -(shot.hla || 0) * rad, pitch = shot.vla * rad, axis = -(shot.spinAxis || 0) * rad;
 const v = [Math.sin(yaw) * Math.cos(pitch) * shot.speed, Math.sin(pitch) * shot.speed, Math.cos(yaw) * Math.cos(pitch) * shot.speed];
 const rate = shot.spin * Math.PI / 30;
 const w = [-Math.cos(yaw) * Math.cos(axis) * rate, Math.sin(axis) * rate, Math.sin(yaw) * Math.cos(axis) * rate];
 const p = [0, 0, 0], a = [0, 0, 0], am = [0, 0, 0], vm = [0, 0, 0];
 let t = 0, apex = 0;
 for (let i = 0; i < 20 / dt; i++) {
  airAcceleration(v, w, air, p[1], a);
  for (let j = 0; j < 3; j++) vm[j] = v[j] + a[j] * dt / 2;
  airAcceleration(vm, w, air, p[1] + vm[1] * dt / 2, am);
  const py = p[1];
  for (let j = 0; j < 3; j++) { p[j] += vm[j] * dt; v[j] += am[j] * dt; }
  const f = spinDecay(Math.hypot(v[0], v[1], v[2]), dt, air.rho);
  w[0] *= f; w[1] *= f; w[2] *= f;
  t += dt; apex = Math.max(apex, p[1]);
  if (p[1] <= 0 && v[1] < 0) {
   // Back to the instant it crossed launch height.
   const u = py / (py - p[1] || 1), back = (1 - u) * dt;
   for (let j = 0; j < 3; j++) p[j] -= vm[j] * back;
   t -= back;
   break;
  }
 }
 const speed = Math.hypot(v[0], v[1], v[2]);
 return {carry: Math.hypot(p[0], p[2]), side: -p[0], apex, hang: t, landingSpeed: speed,
  descent: Math.atan2(-v[1], Math.hypot(v[0], v[2])) / rad, spin: Math.hypot(w[0], w[1], w[2]) * 30 / Math.PI,
  v: [...v], w: [...w]};
}
