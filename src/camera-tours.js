import * as T from 'three';
// `fairwayMiddle` and `teeAim` live in course.js now: the tee PADS are squared
// to the same aim the markers are, and course.js cannot import this file --
// this file imports course.js. Re-exported so every existing caller is
// unaffected and there is still one definition of where a tee points.
import {fairwayWidth, fairwayMiddle, teeAim} from './course.js';
export {fairwayMiddle, teeAim};
export function fairwayAim(h,p,range){
 if(h.surface(p.x,p.z)==='green')return {...h.pin};
 let z=Math.max(0,p.z),remaining=Math.max(20,range),last={x:fairwayMiddle(h,z),z};
 while(z<h.length&&remaining>0){const nextZ=Math.min(h.length,z+2),next={x:fairwayMiddle(h,nextZ),z:nextZ};remaining-=Math.hypot(next.x-last.x,next.z-last.z);last=next;z=nextZ;}
 return z>=h.length?{...h.pin}:last;
}
export function cameraInsideTree(camera,t){const radius=t.r*1.9+1.5;return Math.hypot(camera.x-t.x,camera.z-t.z)<radius&&camera.y>t.y-.5&&camera.y<t.y+t.h*1.18+2;}
// The hole flyover.
//
// This is the main menu's camera, put over a hole you are playing: a wide slow
// circle of the whole thing, framed off the hole's own length exactly as the
// backdrop frames its showcase hole. It replaced a run up the fairway followed
// by a tight orbit of the green -- which showed the hole a piece at a time and
// never once showed its shape in the landscape around it.
//
// Same framing as the menu, at one and a half times its speed.
export const MENU_ORBIT_RATE = .075;
export const FLYOVER_RATE = MENU_ORBIT_RATE * 1.5;
// How far above whatever it is passing over the camera stays. A tree on this
// generator reaches 29 m, so this has to clear a canopy and not just the dirt --
// a flyover that skims through treetops reads as a bug even when the ground is
// technically below it.
const CLEARANCE = 34;
const RING = 96;

export function makeHoleTour(h) {
 const mid = {x: h.center(h.length * .5), z: h.length * .5};
 const centre = h.toWorld(mid), ground = h.height(mid.x, mid.z);
 const radius = Math.max(150, h.length * .85), lift = Math.max(55, h.length * .3);
 const at = a => ({x: centre.x + Math.sin(a) * radius, z: centre.z + Math.cos(a) * radius});
 // A hole cut into a hillside puts ground higher than the camera on one side of
 // the circle, so the orbit has to be lifted over it. Taking the clamp per frame
 // works but puts a corner in the path wherever the terrain crosses it, so the
 // whole ring is measured once and then smoothed: the camera rises to meet a
 // ridge before it arrives and settles again after it, which is what a
 // helicopter would do anyway.
 const terrain = h.world?.height ? (x, z) => h.world.height(x, z) : () => ground;
 // Each sample covers an arc, not a point: at this radius the steps are about
 // ten metres apart, and on steep ground the ridge between two samples is higher
 // than either of them. Measuring across the span is what keeps the clearance
 // honest -- sampling only the points let it fall to 19 m on mountain terrain.
 // Each sample covers ground, not a point. At this radius the steps are about
 // ten metres apart, so the ridge between two of them can be higher than either;
 // and a tree whose trunk stands a few metres off the flight line still puts its
 // canopy over it. Sampling along the arc AND a little to each side of it is what
 // keeps the clearance honest -- points alone let it fall to 19 m on mountains.
 const step = Math.PI * 2 / RING;
 let ring = Array.from({length: RING}, (_, i) => {
  let high = -Infinity;
  for (const along of [-.5, -.25, 0, .25, .5])
   for (const out of [-10, 0, 10]) {
    const a = (i + along) * step;
    const p = {x: centre.x + Math.sin(a) * (radius + out), z: centre.z + Math.cos(a) * (radius + out)};
    high = Math.max(high, terrain(p.x, p.z));
   }
  return Math.max(ground + lift, high + CLEARANCE);
 });
 for (let pass = 0; pass < 6; pass++)
  ring = ring.map((v, i) => {
   const before = ring[(i - 1 + RING) % RING], after = ring[(i + 1) % RING];
   // Smooth, but never below what the ground under this point demands.
   return Math.max(v, (before + v * 2 + after) / 4);
  });
 const heightAt = a => {
  const t = (a / (Math.PI * 2) % 1 + 1) % 1 * RING;
  const i = Math.floor(t), f = t - i;
  return ring[i % RING] * (1 - f) + ring[(i + 1) % RING] * f;
 };
 const duration = Math.PI * 2 / FLYOVER_RATE;
 function pose(seconds) {
  const a = FLYOVER_RATE * Math.min(seconds, duration), p = at(a);
  return {
   eye: new T.Vector3(p.x, heightAt(a), p.z),
   target: new T.Vector3(centre.x, ground + 8, centre.z),
   done: seconds >= duration,
  };
 }
 return {pose, duration, travel: 0, radius, centre, ground};
}

// A FLIGHT BETWEEN TWO CAMERA POSES.
//
// `setCamera` has always eased toward its target, but it snapped whenever the
// move was longer than sixty metres -- and every move worth watching is longer
// than sixty metres. Tee to green view, the menu's orbit to the tee, a flyover
// back to the ball: all of them cut. This builds the path those moves should
// take instead, and the renderer flies it.
//
// It is the flyover's arithmetic, shortened: sample the ground under the route,
// lift over what is there, smooth the result so the rise has no corner in it.
// How far above whatever it passes over the camera holds. The flyover uses 34
// because it never descends; a transition flight ends ON a player camera a metre
// and a half off the turf, so it clears what is actually in the way -- the
// ground, and the canopy standing on it -- rather than holding an altitude.
const GROUND_MARGIN = 4.5;
// The arc, as a fraction of how far the flight travels. This is the part that
// reads as flying rather than sliding: nothing demands it, and without it a move
// across open ground is a straight line at walking height.
const ARC_SHARE = .07, ARC_CAP = 42;
// Cruise. Long moves are capped by FLIGHT_MAX rather than run at this speed, so
// crossing a whole course takes a beat longer per metre than crossing a green.
const FLIGHT_SPEED = 135;
export const FLIGHT_MIN = .55, FLIGHT_MAX = 2.6;
// Below this a flight is not worth taking: it is an aim nudge or a step behind
// the ball, and the renderer's own damping already reads as movement.
export const FLIGHT_FLOOR = 22;
const SAMPLES = 40;

// How high the trees stand at a point, or -Infinity where there are none.
//
// Same reach `cameraInsideTree` uses, so "the camera is in a tree" and "the
// camera cleared the trees" cannot disagree about where a tree ends.
//
// DO NOT ASSUME A CANOPY HEIGHT. A comment in this file said trees reach 29 m
// and the arrival pose was built on it; redwoods top out at 111 m, and the test
// that walks real holes put the camera 40 m inside one. Ask the trees.
export function canopyTop(trees, x, z) {
 let top = -Infinity;
 for (const t of trees)
  if (Math.hypot(x - t.x, z - t.z) < t.r * 1.9 + 4) top = Math.max(top, t.y + t.h * 1.18);
 return top;
}

export function makeCameraFlight(from, to, world, {hold = 0} = {}) {
 const dx = to.eye.x - from.eye.x, dy = to.eye.y - from.eye.y, dz = to.eye.z - from.eye.z;
 const span = Math.hypot(dx, dy, dz);
 // `hold` sits on the opening pose before the move starts, for an arrival that
 // shows you the hole first. It is part of the duration, so a caller that waits
 // for `done` waits for the whole thing rather than only the travel.
 const travel = Math.min(FLIGHT_MAX, Math.max(FLIGHT_MIN, span / FLIGHT_SPEED));
 const duration = hold + travel;
 const terrain = world?.height ? (x, z) => world.height(x, z) : () => 0;
 const at = t => ({x: from.eye.x + dx * t, z: from.eye.z + dz * t});
 // THE CANOPY IS THE OBSTACLE, NOT THE DIRT. Trees on this generator reach 29 m,
 // so a flight that clears only the ground flies through them. The whole tree
 // list is scanned once, down to the ones standing near this route -- one pass
 // over the array per flight, against forty samples that would each otherwise
 // have to ask the same question.
 const lo = {x: Math.min(from.eye.x, to.eye.x), z: Math.min(from.eye.z, to.eye.z)};
 const hi = {x: Math.max(from.eye.x, to.eye.x), z: Math.max(from.eye.z, to.eye.z)};
 const PAD = 26;
 const near = (world?.trees || []).filter(t =>
  t.x > lo.x - PAD && t.x < hi.x + PAD && t.z > lo.z - PAD && t.z < hi.z + PAD);
 const canopy = (x, z) => canopyTop(near, x, z);
 // The obstacle floor tapers to nothing at both ends. Without that, a flight
 // leaving a player camera -- which sits just off the turf by design -- would be
 // told it is metres too low and start by rocketing upward.
 let prof = Array.from({length: SAMPLES + 1}, (_, i) => {
  const t = i / SAMPLES, p = at(t), straight = from.eye.y + dy * t;
  const w = Math.min(1, Math.min(t, 1 - t) / .18);
  let high = -Infinity;
  for (const o of [-8, 0, 8]) high = Math.max(high, terrain(p.x + o, p.z), terrain(p.x, p.z + o));
  high = Math.max(high, canopy(p.x, p.z));
  // sin gives an arc that is already zero at both ends and steepest in the
  // middle, so it needs no taper of its own.
  const arc = Math.min(ARC_CAP, span * ARC_SHARE) * Math.sin(Math.PI * t);
  return Math.max(straight + arc, (high + GROUND_MARGIN) * w + straight * (1 - w));
 });
 // Clamping per sample clears the ground and still looks wrong: the path kinks
 // wherever the terrain crosses it. Smoothed, the camera rises to meet a ridge
 // before it arrives and settles after it, which is what a helicopter does.
 for (let pass = 0; pass < 4; pass++)
  prof = prof.map((v, i) => i === 0 || i === SAMPLES ? v : Math.max(v, (prof[i - 1] + v * 2 + prof[i + 1]) / 4));
 const heightAt = t => {
  const f = Math.max(0, Math.min(1, t)) * SAMPLES, i = Math.floor(f), g = f - i;
  return i >= SAMPLES ? prof[SAMPLES] : prof[i] * (1 - g) + prof[i + 1] * g;
 };
 // Smoothstep: the move starts and stops at rest, which is what makes it read as
 // a camera being flown rather than a cut with a slide on the end.
 const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
 const mix = (a, b, t) => a + (b - a) * t;
 function pose(seconds) {
  const t = ease(Math.max(0, seconds - hold) / travel), p = at(t);
  return {
   eye: new T.Vector3(p.x, heightAt(t), p.z),
   look: new T.Vector3(mix(from.look.x, to.look.x, t), mix(from.look.y, to.look.y, t), mix(from.look.z, to.look.z, t)),
   done: seconds >= duration,
  };
 }
 return {pose, duration, travel, hold, span};
}

// THE ARRIVAL AT A NEW HOLE.
//
// Where the camera stands to show you the hole you are about to play: behind and
// above the tee, looking down the length of it. Height comes off the hole's own
// length for the same reason the flyover's does -- a 130 yard par three framed
// from where a 600 yard par five is shows a lot of countryside and no hole.
//
// The lift is a floor, not the answer: what is GROWING behind the tee decides
// the rest, because a redwood is taller than any fixed number here would be.
const ARRIVE_BACK = 62, ARRIVE_LIFT = .26, ARRIVE_MIN_LIFT = 46;
// Held above whatever is standing at the pose, on top of the lift above ground.
const ARRIVE_CANOPY_CLEAR = 14;
// How long the camera holds up here before it comes down. Long enough to read
// the shape of the hole and where the trouble is, short enough that it is not
// in the way on the fiftieth hole of an endless run.
export const ARRIVE_HOLD = 2.6;

export function holeEstablishingPose(h) {
 const lift = Math.max(ARRIVE_MIN_LIFT, h.length * ARRIVE_LIFT);
 // Local coordinates: z runs from the tee at 0 to the green at h.length, and
 // `center` is the middle of the corridor at that distance. Standing at a
 // negative z puts the camera behind the tee, looking up the hole.
 const back = {x: h.center(0), z: -ARRIVE_BACK};
 const aim = {x: h.center(h.length * .5), z: h.length * .5};
 const eye = h.toWorld(back), look = h.toWorld(aim);
 // A redwood behind the tee is taller than the whole lift, so the pose is the
 // higher of "well above the ground" and "clear of what is growing here".
 const over = canopyTop(h.world?.trees || [], eye.x, eye.z);
 const y = Math.max(h.height(back.x, back.z) + lift, over + ARRIVE_CANOPY_CLEAR);
 return {
  eye: new T.Vector3(eye.x, y, eye.z),
  look: new T.Vector3(look.x, h.height(aim.x, aim.z) + 8, look.z),
 };
}
