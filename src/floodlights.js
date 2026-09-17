// Course floodlighting for night play.
//
// Placement follows published sports-lighting practice rather than taste, and
// the figures and their sources are in RESEARCH.md. The three that decide
// everything here:
//
//   HEIGHT   Driving ranges and golf practice facilities run 30-60 ft poles;
//            baseball fields 70-100. This sits at 23 m, about 75 ft, which is
//            the bottom of the BALL FIELD band rather than the top of the golf
//            one. It started at 18 m and was raised on the look of it: a fairway
//            is a far wider target than a driving-range bay, and the lower mast
//            threw a pool that read as a street light rather than a lit hole.
//            Both bands are published practice, so this is a choice between
//            them and not a departure from either.
//   SPACING  Pole spacing should stay within THREE TIMES the mounting height
//            for acceptable uniformity. At 18 m that is 54 m between successive
//            poles, and they alternate sides, so each side carries one about
//            every 108 m.
//   REACH    A single high mast is quoted at 50-200 m of radius depending on
//            height, wattage and aiming. This stays near the low end, and scales
//            with the mast: a taller pole genuinely lights more ground, so
//            pinning reach while raising height would have left gaps between the
//            pools. The high end of that range would light a whole hole from two
//            poles and look nothing like a lit course.
import {fairwayWidth} from './course.js';

export const POLE_HEIGHT = 23;
export const POLE_SPACING = POLE_HEIGHT * 3;
export const POLE_REACH = 62;
// Clear of the semi-rough, plus room for the base. A pole is an obstacle and a
// ball that finishes against one is a bad hole, so this is a playability number
// rather than a lighting one -- the lighting would rather they were closer.
const YARD = 0.9144;
const SETBACK = 12 + 5 * YARD;
// Nothing lights the tee box from behind the player, so the run starts a little
// up the hole. It STOPS short of the green: a green is lit by its own ring
// below, and a fairway pole arriving in the middle of that ring is both
// redundant and in the way.
const START = 0.06;
// A green is lit from two directions, not one.
//
// This is the same reason a ball field carries four poles rather than one tall
// one: uniformity guidance asks for no more than 2:1 between the brightest and
// darkest part of the target, and a single direction cannot do it -- every
// contour, every bunker lip and the flag itself throws a shadow across the
// putting surface with nowhere for fill light to come from. A pair flanking the
// back at 45 degrees off the line of play covers it: their shadows fall in
// opposite directions across the surface and each fills the other's.
//
// Neither goes in FRONT of the green. A pole between the fairway and the putting
// surface is in the line of play and shines straight back at a player standing
// in it, which is the one place sports lighting never puts one either. Measured
// from the direction of play, so 45 degrees is behind and to the side.
const GREEN_BEARINGS = [Math.PI / 4, -Math.PI / 4];
// Clear of the whole green complex -- the mown surface, its fringe and the semi
// rough around it -- and then ten yards further. A greenside pole that sits in
// the collar is in play from a missed approach.
const GREEN_SETBACK = 10 * YARD;

// Where the poles stand on one hole, in hole-local coordinates.
//
// Alternating sides is the point: poles down one side light the far rough and
// leave a shadow along the near tree line, and on a curved hole they end up all
// on the inside of the dogleg. Alternating also halves how often a player looks
// straight into one.
export function polesFor(hole) {
 if (!hole?.length) return [];
 const poles = [];
 const greenReach = (hole.greenSize ?? 17) * (hole.greenAspect ?? 1.17);
 const first = hole.length * START;
 // Hand over to the green's own ring rather than running a pole into it.
 const last = hole.length - greenReach - GREEN_SETBACK;
 let side = 1;
 for (let z = first; z <= last; z += POLE_SPACING) {
  // Measured from the middle of the corridor at this point, not from the hole's
  // centre line: the two fairway edges vary independently, so a pole set off the
  // centre line sits in the fairway wherever that side runs wide.
  const centre = hole.center(z);
  const half = Math.max(fairwayWidth(hole, z, 0, side), hole.width?.(z) ?? 0);
  const reach = half + (hole.settings?.semiRough ?? 6) + SETBACK;
  poles.push({x: centre + side * reach, z, side, height: POLE_HEIGHT});
  side = -side;
 }
 // The green's pair. Measured from the centre of the green, which is not the
 // cup: the cup moves through the week and the poles do not follow it.
 const green = hole.green ?? hole.pin;
 if (green) {
  const collar = (hole.settings?.fringe ?? 2) + (hole.settings?.semiRough ?? 6);
  const radius = greenReach + collar + GREEN_SETBACK;
  for (const bearing of GREEN_BEARINGS)
   poles.push({
    x: green.x + Math.sin(bearing) * radius,
    z: green.z + Math.cos(bearing) * radius,
    side: Math.sin(bearing) >= 0 ? 1 : -1,
    height: POLE_HEIGHT,
    green: true,
   });
 }
 return poles;
}

// The poles worth giving a real light to.
//
// Every pole is geometry, but only a few are lights: a scene with sixty active
// spot lights re-renders its shadow maps sixty times and is unplayable, while
// the player can only see the pools thrown by the ones near them. Nearest-first
// against the point being looked at, not the camera, because a camera chasing a
// ball down a fairway is behind the action and would light the ground the ball
// has already left.
export function activePoles(poles, focus, limit = 4) {
 if (!poles.length || !focus) return [];
 return poles
  .map(p => ({pole: p, away: Math.hypot(p.x - focus.x, p.z - focus.z)}))
  // Out of reach is out of the running: a pole 200 m away contributes nothing a
  // player can see, and holding a light on it costs a shadow map either way.
  .filter(p => p.away < POLE_REACH * 2.5)
  .sort((a, b) => a.away - b.away)
  .slice(0, limit)
  .map(p => p.pole);
}

// THE ORDER LAMPS ARE HANDED OUT IN, and it decides which poles cast shadows.
//
// A shadow-casting light is an extra depth render of the whole scene every
// frame, so only a handful can ever cast. Which handful is not a matter of
// distance alone: the poles lighting the hole being PLAYED are the ones whose
// shadows a player can read, and a pole on the next fairway throwing a shadow
// across a tree line nobody is looking at costs exactly as much.
//
// So the current hole's poles are handed the first lamps -- and the first lamps
// are the ones that cast -- nearest the ball first. Everything else follows,
// also nearest first, and lights the course without casting.
//
// Ordering rather than switching `castShadow` is deliberate. The number of
// shadow-casting lights is part of the shader program key in three, so flipping
// the flag recompiles every lit material in the scene. The count stays fixed
// from birth and the POLES move between the lamps instead.
export function orderPoles(poles, hole, focus, limit = Infinity) {
 if (!poles.length) return [];
 const away = p => focus ? Math.hypot(p.x - focus.x, p.z - focus.z) : 0;
 const near = list => list.map(p => ({p, d: away(p)})).sort((a, b) => a.d - b.d).map(x => x.p);
 const mine = near(poles.filter(p => p.hole === hole));
 const rest = near(poles.filter(p => p.hole !== hole));
 return [...mine, ...rest].slice(0, limit === Infinity ? undefined : limit);
}
