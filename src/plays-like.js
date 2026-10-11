// HOW FAR A SHOT PLAYS, worked out by the game's own ball model.
//
// "Plays like" is the distance a shot to the hole would carry on the ground the
// bag's yardages are calibrated on -- level, still air, sea level -- once wind,
// rise or fall, altitude and temperature have had their say. The owner asked for
// it on 10 October 2026, after seeing Garmin's PlaysLike on its watches, which
// adjusts for elevation, wind and air density the same way.
//
// NOT A RULE OF THUMB. The usual app arithmetic -- a yard per three feet of rise,
// a percent per mph of wind -- is a second model of the ball that disagrees with
// the one the game flies, and a player would learn that it lies. So the answer
// comes from `simulateShot` itself.
//
// BY GEOMETRY, NOT BY POWER (the owner's call, 10 October 2026). The club in
// hand is flown at full swing TWICE, the same strike both times:
//
//  - today: in today's wind, altitude and temperature, and the point found where
//    the falling ball passes through the HOLE'S HEIGHT, measured along the line
//    to the hole;
//  - reference: in still air at sea level, and the point where it falls back
//    through the height it started at.
//
// The hole's distance is then scaled by the ratio: a shot that reaches the
// hole's level 5% short of its reference carry today makes the hole play 5%
// longer. REJECTED, first: searching for the ball speed that lands the shot at
// the hole and reporting that shot's level carry. It asks how a softer or
// harder swing would fly -- different speed with the same launch and spin,
// which no real swing produces -- and it took five to seventeen flights where
// this takes two.
//
// The ground both flights cross is made up, not the course: level for the
// first two metres and then far below, so the ball is never stopped by a tree,
// a house or a bank and the number is the conditions' alone. Uphill farther
// than the ball can climb has no crossing and gives no number.
import {simulateShot} from './physics.js';

// Placed numbers: two metres of tee under the ball, then a drop deep enough
// that the ball passes through any hole height a course has on the way down.
const TEE = 2, DROP = 120;
const openGround = {
 height: (x, z) => Math.hypot(x, z) < TEE ? 0 : -DROP,
 surface: () => 'fairway',
 bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5},
 trees: [],
};

// Where the falling ball passes height `level` above where it started, as a
// distance along `bearing`; null if it never comes down through it.
export function crossing(points, level, bearing) {
 if (!Array.isArray(points) || points.length < 2) return null;
 const s = Math.sin(bearing), c = Math.cos(bearing), y0 = points[0].y;
 const along = p => (p.x - points[0].x) * s + (p.z - points[0].z) * c;
 let top = 0;
 for (let i = 1; i < points.length; i++) if (points[i].y > points[top].y) top = i;
 for (let i = Math.max(1, top); i < points.length; i++) {
  const a = points[i - 1], b = points[i], ha = a.y - y0, hb = b.y - y0;
  if (ha >= level && hb < level) {
   const f = (ha - level) / ((ha - hb) || 1);
   return along(a) + (along(b) - along(a)) * f;
  }
 }
 return null;
}

// `distance` and `rise` in metres, the rise to the hole (negative downhill);
// `bearing` in radians in the hole's frame, `atan2(x, z)`; `wind` the hole-local
// vector main.js already hands the physics; `launch` the club in hand at full
// power ({speed, vla, spin, spinAxis}). Returns metres, or null when there is
// nothing sensible to say (no distance, a putt, a hole above the ball's reach).
export function playsLike({distance, rise = 0, bearing = 0, wind = [0, 0, 0], altitude = 0, temperature, launch}) {
 if (!(distance > 1) || !launch || !(launch.speed > 0) || !(launch.vla > 2)) return null;
 const shot = {...launch, hla: 0, spinAxis: 0, origin: {x: 0, z: 0}, aim: bearing * 180 / Math.PI};
 const today = crossing(simulateShot(shot, openGround, {wind, altitude, temperature}).points, rise, bearing);
 const reference = crossing(simulateShot(shot, openGround, {}).points, 0, bearing);
 if (!(today > 1) || !(reference > 1)) return null;
 return distance * reference / today;
}
