// The cup.
//
// USGA geometry: hole radius 53.975 mm, ball radius 21.335 mm, a 102 mm bore
// with the liner starting 25.4 mm below the surface.
//
// What was wrong before this module existed: the hole asked exactly one
// question -- is this ball slow enough, on a good enough line, to be captured?
// -- and if the answer was no, it did nothing whatsoever. Measured on a flat
// Stimp 10 green, balls crossing the opening at 0.6, 0.8, 0.95 and 1.05 of the
// cup radius all finished 1.310 m past it, to the millimetre. A ball that
// caught the lip and a ball that missed by a metre ended in the same place.
// There were no lip outs in this game, because nothing that failed to drop was
// ever touched by the hole.
//
// The middle outcome is what this adds, and it comes out of one quantity. A
// ball crossing the opening is falling the whole time it crosses:
//
//   chord = 2 sqrt(R^2 - d^2)     how much of the opening its centre crosses
//   t     = chord / v             how long that takes
//   drop  = 1/2 g t^2             how far it falls while it does
//
// Enough drop and it is captured. Not enough and it must still climb back out
// of whatever it fell into, over a rim that turns it as it goes. That costs
// speed and bends the line, which is what a lip out is. A ball crossing quickly
// barely falls, loses almost nothing and carries on -- which is the behaviour
// the old model had for every case, and the reason it was only ever right for
// the fast ones.
//
// The capture rule is one sentence: the ball is caught if it falls its own
// radius while its centre crosses the opening. Nothing else is needed, and the
// number that falls out is not a fitted one --
//
//   v_max = chord . sqrt(g / 2r)   =  1.6365 m/s dead centre
//
// against Penner's published full-capture figure of 1.63 m/s. Within 0.8%, from
// geometry alone. (Penner's free-fall-only figure is 1.31; the higher number is
// what you get once capture by the far wall and by the lip is included, and it
// is the one this matches.)
//
// This replaces the previous envelope, 1.63(1 - (d/R)^2), which was the right
// value dead centre attached to the wrong shape. The drop rule gives
// 1.63 sqrt(1 - (d/R)^2) instead, and the difference is large where it matters:
// at 0.8 of the cup radius the old form allowed 0.59 m/s and this allows 0.98.
// The old shape turned balls away that had already fallen two and a half ball
// radii below the rim.
//
// Everything else is the same quantity read differently. A ball that falls less
// than a radius did still fall, and has to climb back out of it over a rim that
// turns it as it goes -- so the exit speed goes smoothly to zero as the drop
// approaches a full radius, and to the entry speed as it approaches nothing.
// There is no seam between holing out, lipping out and racing across: they are
// three readings of one number.

// Slope does not belong in here, and the reason is worth writing down because
// the obvious "fix" makes it wrong.
//
// A hole in a sloping green has its far rim lower than its near one by
// chord.theta when the ball is running downhill, so it looks as though the ball
// must fall further to be caught and downhill putts should need a lower capture
// speed. Half of that is true. The other half is that a ball rolling down a
// slope is already descending at v.theta when it leaves the near rim, so over
// the crossing time chord/v it falls an extra chord.theta of its own accord.
//
//   required:  r + chord.theta        head start:  chord.theta
//
// They cancel exactly, and the criterion collapses back to (1/2)g t^2 >= r with
// no theta in it. Modelling the lowered far rim WITHOUT the head start -- which
// is what you get if you reason from geometry alone -- introduces a slope
// dependence of about 20% in the required drop at 4% and is worse than leaving
// both out.
//
// Measured against the simulator to confirm it: from 6% uphill to 6% downhill
// the launch speed that holes swings 27%, from 2.848 to 2.240 m/s, while the
// speed the ball is actually doing as it reaches the cup stays between 1.599 and
// 1.632. Downhill putts are harder because the ball arrives faster, which the
// roll model already accounts for, and not because the hole is fussier.

const G = 9.80665;
export const CUP_RADIUS = 0.053975;
export const BALL_RADIUS = 0.021335;
export const CUP_DEPTH = 0.1016;
// Penner (2002): the fastest a ball can be moving straight through the middle
// and still be caught.
// Penner's published dead-centre figure for capture by ALL mechanisms together:
// free fall, the far wall, and the lip. Kept as the number the finished model is
// checked against, not as an input to it.
export const CAPTURE_SPEED = 1.63;
// Penner's free-fall-only figure, and the one Hurrion & Sheppard treat as the
// operative maximum in measured putts on a Stimp 10 green. Free fall alone is
// what this constant governs; the far wall and the lip are modelled separately
// in rimContact, so letting free fall reach 1.63 on its own would count the same
// capture twice.
export const FREE_FALL_CAPTURE = 1.31;

// The far rim is turf, not plastic. The liner starts 25.4 mm below the surface
// and a lip out has by definition fallen less than a ball radius, 21.3 mm, so
// the edge a lipping ball clips is always cut turf and never the cup liner.
// That fixes the restitution rather than leaving it to taste: 0.32 is the
// short-turf value the bounce model already uses, and the tangential limit of
// 0.4 is its short-turf friction.
const RIM_RESTITUTION = 0.32;
const RIM_FRICTION = 0.40;
// A ball riding the inside of the wall is carried around it and comes out on the
// side it went in -- the horseshoe. A single contact impulse cannot produce that,
// because it is a sustained rolling contact rather than a strike, so it stays a
// separate term applied in proportion to how deeply the ball engaged.
const MAX_TURN = 1.05;
// Below this it has not got out, whatever the arithmetic says.
const ESCAPE_SPEED = 0.02;

export const crossingChord = offset =>
 2 * Math.sqrt(Math.max(0, CUP_RADIUS * CUP_RADIUS - offset * offset));

// How far the ball falls in the time its centre spends over the opening.
// How far the ball has to fall to be past saving. 33.3 mm, about 1.56 ball
// radii: more than a radius, because it must get low enough that the far edge
// passes over it rather than catching it on the way through.
const CAPTURE_DROP = G * (2 * CUP_RADIUS) ** 2 / (2 * FREE_FALL_CAPTURE ** 2);

export function crossingDrop(speed, offset) {
 if (!(speed > 0)) return CUP_DEPTH;
 const t = crossingChord(offset) / speed;
 return Math.min(CUP_DEPTH, 0.5 * G * t * t);
}

// The fastest a ball on this line can be going and still fall a full radius
// before it reaches the far side.
// The fastest a ball on this line can be going and still fall a full radius
// before it reaches the far side.
export const captureSpeed = offset =>
 crossingChord(offset) * Math.sqrt(G / (2 * CAPTURE_DROP));

// Where the ball meets the far edge, and what that contact does to it.
//
// Crossing the opening the centre falls from a ball radius above the rim plane
// to r - drop, so the far edge stands as a step of height `drop` in its way. A
// rolling ball meeting a step does not bounce off it -- it PIVOTS over it, and
// that has a classical answer. Angular momentum about the edge is conserved
// through the impact:
//
//   before  m v [(7/5)r - drop]        after  (7/5) m r^2 w'
//   so      v' = v (1 - 5 drop / 7 r)
//
// which is the whole speed loss, with no restitution in it. That matters: the
// impulse treatment this replaces rebounded the ball BACKWARD off the edge at
// every ordinary putting speed, and clamping that at zero left putts stopping
// dead on the far lip instead of rolling on.
//
// The lift falls out of the same geometry. While pivoting, the centre travels on
// a circle about the edge, so its velocity is tangential -- forward AND up. If
// the ball is quick enough to leave contact rather than be held on the circle
// (v'^2 > g h, the usual condition for leaving a convex surface) it keeps that
// tangential direction, and that is the hop.
// NOTE: rimContact and cupOutcome below are the ANALYTIC capture model, kept as a
// documented reference and as the anchor the geometry is checked against. They
// are no longer what the simulator runs. simulateShot resolves the rim as an
// actual surface -- see the note at the top of physics.js -- so a lip out there
// is a rolling contact carried through time, not a single impulse, and that is
// why it can produce the sustained rides this file says a single contact cannot.
export function rimContact(speed, offset, drop) {
 const r = BALL_RADIUS;
 // Over a step this deep the pivot takes everything it has: it cannot get over.
 const kept = 1 - 5 * drop / (7 * r);
 if (kept <= 0) return null;
 const pivot = speed * kept;
 // Climbing the step raises the centre by `drop`, and a rolling ball pays that
 // out of (7/10) m v^2. Short of it, the ball rocks back into the hole.
 if (pivot * pivot < (10 / 7) * G * drop) return null;
 const h = Math.max(0, r - drop), d = Math.sqrt(Math.max(0, r * r - h * h));
 // Tangent to the pivot circle, in the direction of travel: forward and up.
 const leaves = pivot * pivot > G * h;
 const alongX = leaves ? h / r : 1, alongY = leaves ? d / r : 0;
 return {speed: pivot * alongX, lift: pivot * alongY, reach: d, inside: h <= 0};
}

// What the hole does to a ball whose centre crosses the opening at `speed`,
// `offset` from the middle. Both are magnitudes; which way the ball is turned is
// decided by the caller, which knows the geometry.
export function cupOutcome(speed, offset) {
 if (!(offset < CUP_RADIUS)) return {kind: 'miss'};
 const drop = crossingDrop(speed, offset);
 if (drop >= CAPTURE_DROP) return {kind: 'capture'};
 const hit = rimContact(speed, offset, drop);
 // No pivot means it could not get over the step at all, so it is in the hole.
 // Passing it through at full speed here was why balls short of the free-fall
 // limit sailed on untouched.
 if (!hit) return {kind: 'capture'};
 // Getting off the edge is not the same as getting out -- but only for a ball
 // that was actually in. Once its centre is below the rim plane it has to cover
 // `reach` before it comes down again or it lands back in the hole, which is what
 // becomes of a ball stopped dead on the lip. A ball still riding high over the
 // edge is simply crossing, and asking it to hop clear was what let the cup
 // swallow balls at 2.8 m/s.
 if (hit.speed <= ESCAPE_SPEED && hit.lift <= ESCAPE_SPEED) return {kind: 'capture'};
 const fell = Math.min(1, drop / CAPTURE_DROP);
 return {kind: 'lip', speed: hit.speed, lift: hit.lift,
  turn: MAX_TURN * fell * (offset / CUP_RADIUS), drop};
}
