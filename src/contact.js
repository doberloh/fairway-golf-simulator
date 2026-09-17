// The bounce, as something that takes TIME.
//
// Everywhere else in this project a bounce is one instant: the ball touches and
// leaves in the same calculation, with a restitution deciding how much speed
// comes back. That model cannot produce the thing a spun ball actually does --
// hop forward, then stand progressively straighter, then come back -- and this
// is not a tuning failure. Biber, Champneys and Szalai prove it
// (arXiv:2208.11685): with a rigid-body bounce carrying a coefficient of
// restitution, SLIP REVERSAL DURING CONTACT cannot happen, and the proof
// extends to adding normal compliance on its own. Adding linear tangential
// stiffness and damping is what enables it.
//
// Slip reversal is the whole mechanism. A ball arrives with its contact point
// tearing forwards across the turf; partway through the squash the turf catches
// that point and can shove it back the other way before the ball leaves. There
// is no "partway through" in an instantaneous bounce, which is why four separate
// attempts at tuning the old model each bought the hop sequence by destroying
// something else.
//
// So the turf here is a springy mat rather than a hard floor: a spring and a
// damper in parallel pressing up, another pair resisting sideways, and Coulomb
// friction capping what the sideways pair can hold before it lets go.
//
// WHAT IS ANCHORED AND WHAT IS NOT. The SHAPE is published and proven. The
// numbers are not, and the same authors say so plainly -- the golf industry
// measures firmness with a TruFirm or a Clegg hammer, both of which drop a mass
// and time its deceleration, and "behaviour of a ball on two turfs with similar
// measurements can be significantly different, thus suggesting that important
// properties are not captured by either of the tools". Fitting them is called an
// open problem. One number here is inherited from measurement: the normal
// damping is calibrated to reproduce the restitution fitted from 693 filmed
// bounces. The rest are chosen to reproduce behaviour we can check.

// A sphere carries 2/5 m R^2 of rotational inertia, so a force at the contact
// point changes the CONTACT POINT's velocity 7/2 times as fast as it changes the
// centre's, and the spin takes the other 5/2. Every rolling constant in
// physics.js (2/7, 5/7) is this same number wearing a different hat.
// How much of the tangential impulse becomes SPIN CHANGE rather than just
// slowing the ball down. This one number decides whether a golf ball can come
// back, and it was the whole of the fix.
//
// 5/2 is the RIGID SPHERE value, and it was wrong here because a golf ball is
// not a rigid sphere. Its cover deforms and the contact patch has real area, so
// the traction is spread across a patch whose parts slip in different directions
// rather than acting as a single force at one point, and the net torque is less
// than force x radius.
//
// WHY IT MATTERS SO MUCH. A bounce removes slip at (1 + spinGain) times the rate
// it removes forward speed. At 5/2 that is 3.5, which was just enough to drive
// every full shot all the way to ROLLING inside the half-millisecond of contact
// -- and rolling is topspin by definition. A wedge arriving with 7,000 rpm of
// backspin left the bounce at -1,416 rpm, which is exactly -vx/R. Nothing
// downstream can bring a topspun ball back, so no shot at any spin rate ever
// returned; the small reversals the model did produce came from PLOUGHING, which
// is why they showed up on soft ground instead of on the firm greens where tour
// players actually spin a ball back.
//
// Lower the gain and the ball stops short of rolling, keeps some backspin, and
// the roll phase -- which already models slip correctly and needs no changes --
// carries it backwards on its own.
//
// FITTED, and to behaviour rather than to a table. The published tour "total
// minus carry" figures were tried first and abandoned: they demand a 9,304 rpm
// wedge landing at 51 degrees release ten yards, which is not a shot that
// exists, and four separate fits against them stalled at 37-40% error with
// parameters railing to their bounds. This is fitted instead to what tour golf
// looks like -- driver releasing, mid irons checking, wedges coming back a few
// yards on a firm green. Best fit 1.475; 1.5 is used because the data cannot
// tell those apart (0.05 yd) and the extra digits would be invented precision.
export const SPIN_GAIN = 1.5;

// How finely the squash is integrated. Everything interesting -- the switch from
// sliding to gripping, and the reversal -- happens inside well under a
// millisecond, so this is resolution rather than accuracy in the usual sense:
// too few steps and the grip is simply stepped over.
const SUBSTEPS = 400;

// Normal spring rate, as a natural frequency: how stiff the turf is underneath.
// Sets how long the ball stays squashed -- higher is stiffer and briefer. 7400
// rad/s puts contact near half a millisecond, the figure quoted for a golf ball
// on turf.
export const NORMAL_RATE = 7400;
// Sideways spring rate. The paper requires this to be MUCH greater than the
// normal one; equal stiffness both ways describes a jelly, in which a ball would
// simply retrace its incoming path. Three times is the mildest reading of that.
export const TANGENT_RATE = NORMAL_RATE * 3;

// How long the squash lasts: half a period of the normal spring.
export const contactTime = (rate = NORMAL_RATE, damping = 0.52) =>
 Math.PI / (rate * Math.sqrt(Math.max(1e-6, 1 - damping * damping)));

// One bounce, integrated.
//
// `vx` is speed along the ground in the direction of travel, `vy` speed into the
// ground (negative on arrival), `spin` is backspin in rad/s -- positive backspin
// drives the contact point FORWARD relative to the centre, which is why a spun
// ball tears at the turf instead of rolling on it.
//
// Returns the same three on the way out, plus what happened during the contact,
// because what happened is the point.
export function bounce({vx, vy, spin, radius}, {
 normalRate = NORMAL_RATE,
 tangentRate = TANGENT_RATE,
 normalDamping = 0.52,
 tangentDamping = 0.25,
 friction = 0.4,
 plough = 0,
 wall = 0,
 craterRelief = 1,
 spinGain = SPIN_GAIN,
} = {}) {
 if (vy >= 0 || radius <= 0) return {vx, vy, spin, slipReversed: false, gripped: false, steps: 0};

 const kN = normalRate * normalRate, cN = 2 * normalDamping * normalRate;
 const kT = tangentRate * tangentRate, cT = 2 * tangentDamping * tangentRate;
 const dt = contactTime(normalRate, normalDamping) / SUBSTEPS;

 let depth = 0;          // how far into the turf the ball has sunk, metres
 let y = vy;             // vertical velocity, negative while sinking
 let x = vx, w = spin;
 let stretch = 0;        // sideways deflection the turf is holding

 const slipNow = () => x + w * radius;
 const startedSlipping = Math.sign(slipNow()) || 1;
 let slipReversed = false, gripped = false, steps = 0, maxDepth = 0;

 // Everything below is per unit mass, so a spring rate reads as an acceleration
 // per metre of squash.
 while (steps < SUBSTEPS * 6) {
  steps++;
  // Upward push from the compressed turf. Clamped at zero because turf does not
  // pull a ball back down -- the ball simply leaves when the push runs out.
  const push = Math.max(0, kN * depth + cN * -y);
  const limit = friction * push;

  // Sideways. The contact patch is held by its own spring until the force it
  // would need exceeds what friction can supply, and then it lets go and slides.
  const slip = slipNow();
  let drag = -(kT * stretch + cT * slip);
  if (Math.abs(drag) > limit) {
   drag = -Math.sign(slip || startedSlipping) * limit;
   stretch = -drag / kT;             // released, held exactly at the limit
  } else {
   gripped = true;                   // the turf has hold of the contact point
   stretch += slip * dt;
  }

  // PLOUGHING, which is not friction and not the tilt.
  //
  // Penner's tilted plane bundles two separate things at a fixed ratio: the turf
  // ahead of the ball RESISTING being shoved out of the way, and the ball
  // CLIMBING the wall of the crater it is making. One knob, both effects, locked
  // together -- and soft turf does a great deal of the first and little of the
  // second. A ball sinks into it and stops; it is not launched. With only the
  // tilt available, the short roll a soft green needs could only be bought by
  // giving it the highest bounce of any surface, which is backwards.
  //
  // So the digging is separated out here. It opposes the CENTRE's travel rather
  // than the contact point's slip, and unlike friction it applies no torque: the
  // turf presses on the whole leading face of the ball, roughly through the
  // middle, so it takes speed away without spinning it and without lifting it.
  // THE CRATER IS NOT SYMMETRIC, and that asymmetry is the whole reason a real
  // ball comes back.
  //
  // Going FORWARD the ball is shoving into turf that has not been disturbed, and
  // the deeper it has already dug the more of it is pressed against that wall --
  // so the resistance grows with how buried it is. Going BACKWARD it is
  // retreating into the hole it has just made, where there is nothing left to
  // push against, so it is barely resisted at all.
  //
  // Symmetric ploughing can slow a ball but can never send it back, because
  // whatever reverses it gets resisted just as hard as what drove it forward.
  // The paper states the requirement directly: horizontal stiffness must
  // "increase when the ball is moving to the right, and decrease when the ball
  // reverses". Both parameters default to no asymmetry at all, so a caller that
  // does not ask for it gets exactly the old symmetric plough.
  const buried = depth / radius;
  const wallGain = x > 0 ? 1 + wall * buried : craterRelief;
  const dig = -Math.sign(x || 1) * plough * push * wallGain;

  y += push * dt;
  depth += -y * dt;
  if (depth > maxDepth) maxDepth = depth;
  x += (drag + dig) * dt;
  w += spinGain * drag * dt / radius;

  const after = slipNow();
  if (Math.sign(after) !== startedSlipping && Math.abs(after) > 1e-6) slipReversed = true;
  if (depth <= 0 && y > 0) break;    // out of the turf and climbing: contact over
 }
 return {vx: x, vy: y, spin: w, slipReversed, gripped, steps, maxDepth};
}

// What restitution this parameter set actually produces, measured rather than
// assumed: drop a ball straight down and see what fraction of the speed returns.
// The textbook exp(-pi d / sqrt(1-d^2)) does not survive clamping the push at
// zero, so the damping is calibrated against this instead of against the formula.
export function verticalRestitution(options = {}, speed = 19) {
 const out = bounce({vx: 0, vy: -speed, spin: 0, radius: 0.02135}, options);
 return out.vy / speed;
}

// The damping ratio that yields a wanted restitution, found by bisection because
// the closed form does not apply once the push is clamped.
export function dampingFor(restitution, options = {}, speed = 19) {
 // Up to very nearly critical damping. Capping at 0.95 put a floor under the
 // reachable restitution, and every request below that floor silently returned
 // the same bounce -- which looked like restitution having no effect at all.
 let lo = 0.01, hi = 0.999;
 for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2;
  if (verticalRestitution({...options, normalDamping: mid}, speed) > restitution) lo = mid;
  else hi = mid;
 }
 return (lo + hi) / 2;
}
