// THE SHOT, FILMED THE WAY TELEVISION FILMS IT (10 October 2026).
//
// The follow camera this replaces for full shots rode along 24 m behind the
// ball and 11 m above it, 25 degrees off its line. From there the ball is a dot
// that sits still in the frame while the ground slides past, so the one thing a
// player watches a shot for -- its shape: how high, which way it curved -- never
// shows. The owner's words: "I can't get a good idea of the ball flight path."
//
// Broadcast golf films a shot in two shots, and so does this:
//
//  1. THE TEE CAMERA stays where the player stood to aim and turns to follow
//     the ball. The ball climbs and curves across a still frame with its tracer
//     behind it, which is what shape looks like. It holds until the ball is well
//     past its apex -- the owner's condition was that the player sees the shape
//     before any cut.
//  2. THE LANDING CAMERA is already standing beside where the ball will come
//     down. It can be, because the whole flight is simulated at the strike: the
//     landing point is known before the ball leaves the club. It watches the
//     descent, the bounce and the roll.
//
// A short shot -- a chip, a pitch -- lands where the tee camera can see it, so
// it keeps the one camera and never cuts. Putts keep their own camera
// (camera.js, *THE PUTT FOLLOW*).
//
// And once the ball stops, THE REVIEW: the camera flies up and back to frame the
// whole tracer, tee to rest, three-quarters side on so both the height and the
// curve read, and holds there before the game moves on.
//
// Every distance here is placed, chosen on screen, not measured from television.
import {canopyTop} from './camera-tours.js';

export const TV = {
 // Shorter than this (metres of carry), one camera and no cut.
 minCarry: 64,
 // How far down the descent the cut comes: 0 at the apex, 1 at touchdown.
 cutShare: .4,
 // Above the ground the landing camera stands at, in metres.
 landHeight: 7,
};

const lerp = (a, b, f) => a + (b - a) * f;

// The flight's point at time t, interpolated, in the flight's own frame.
export function pointAt(points, t) {
 if (!points?.length) return null;
 let i = 0;
 while (i < points.length - 2 && points[i + 1].t <= t) i++;
 const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
 const f = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
 return {x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), t};
}

// How badly something stands between `eye` and `at`, in world coordinates:
// ground across the line rules a spot out (Infinity), each tree crown across it
// counts one.
function blocked(eye, at, groundAt, trees) {
 let crowns = 0;
 for (let i = 1; i < 10; i++) {
  const f = i / 10, x = lerp(eye.x, at.x, f), y = lerp(eye.y, at.y, f), z = lerp(eye.z, at.z, f);
  if (groundAt(x, z) > y - .4) return Infinity;
  if (trees?.length && canopyTop(trees, x, z) > y) crowns++;
 }
 return crowns;
}

// Of a handful of places, the one with the clearest view of `at`. Standing in a
// crown costs a little (that tree is hidden while the camera is inside it, but
// the next one is not); every crown between the camera and the ball costs more.
function clearest(candidates, at, groundAt, trees) {
 let best = null;
 for (const c of candidates) {
  const y = groundAt(c.x, c.z) + c.lift, eye = {x: c.x, y, z: c.z};
  const score = blocked(eye, at, groundAt, trees) * 10 + (trees?.length && canopyTop(trees, c.x, c.z) > y ? 3 : 0) + (c.cost || 0);
  if (!best || score < best.score) best = {eye, score};
 }
 return best && Number.isFinite(best.score) ? best.eye : null;
}

// THE PLAN FOR ONE SHOT. `points` are the flight's own (hole-local, t in
// seconds), `toWorld` turns one into world coordinates, `groundAt` and `trees`
// are the world's. Returns when to cut and where the landing camera stands, in
// world coordinates, or no cut at all.
export function planShotCamera({points, hang, carry, toWorld, groundAt, trees}) {
 const none = {cutAt: Infinity, landEye: null};
 if (!(hang > 0) || !(carry >= TV.minCarry) || !points?.length) return none;
 let top = 0;
 for (let i = 1; i < points.length; i++) if (points[i].y > points[top].y) top = i;
 const apexT = points[top].t;
 const cutAt = apexT + (hang - apexT) * TV.cutShare;
 const land = pointAt(points, hang), before = pointAt(points, Math.max(0, hang - .6));
 // The way the ball is travelling as it comes down, across the ground.
 let dx = land.x - before.x, dz = land.z - before.z, l = Math.hypot(dx, dz);
 if (l < 1e-6) { dx = 0; dz = 1; l = 1; }
 dx /= l; dz /= l;
 const nx = dz, nz = -dx;
 // Short of the landing and off to one side, looking across the descent: the
 // fall reads as a fall and the bounce and roll run across the frame. Both
 // sides are tried at a few distances; nearer and less sideways costs least.
 const candidates = [];
 for (const side of [1, -1])
  for (const [back, out, cost] of [[30, 22, 0], [40, 28, .5], [22, 30, 1], [52, 18, 1.5]]) {
   const w = toWorld({x: land.x - dx * back + nx * out * side, z: land.z - dz * back + nz * out * side});
   candidates.push({x: w.x, z: w.z, lift: TV.landHeight, cost});
  }
 const landW = toWorld(land), at = {x: landW.x, y: groundAt(landW.x, landW.z) + 1, z: landW.z};
 const landEye = clearest(candidates, at, groundAt, trees);
 return landEye ? {cutAt, landEye, landing: at} : none;
}

// THE REVIEW: one place to see the whole shot from, tee to rest. `fov` is the
// vertical field of view in degrees and `aspect` width over height. The
// distance back is what fits the shot's length across the frame with a margin;
// the eye sits three-quarters side on and above the apex, looking at the middle
// of the shot a little below half its height.
export function planReview({points, toWorld, groundAt, trees, fov = 53, aspect = 16 / 9}) {
 if (!points?.length) return null;
 const a = points[0], b = points[points.length - 1];
 const length = Math.hypot(b.x - a.x, b.z - a.z);
 if (length < 8) return null;
 let apex = 0;
 for (const p of points) apex = Math.max(apex, p.y - a.y);
 const ux = (b.x - a.x) / length, uz = (b.z - a.z) / length, nx = uz, nz = -ux;
 const half = Math.atan(Math.tan(fov * Math.PI / 360) * aspect);
 // 1.6 times what would fit edge to edge: the panels sit over the sides of
 // the frame (the map on the right, the shot panel along the foot), and at 1.25
 // the tee end of a drive ran under the map in the first look at it.
 const reach = Math.max(30, length * .5 * 1.6 / Math.tan(half));
 const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
 const midW = toWorld(mid), ground = groundAt(midW.x, midW.z);
 const look = {x: midW.x, y: ground + apex * .4, z: midW.z};
 const candidates = [];
 for (const side of [1, -1]) {
  const w = toWorld({x: mid.x + nx * reach * .9 * side - ux * reach * .35, z: mid.z + nz * reach * .9 * side - uz * reach * .35});
  // Above the apex and a quarter of the way back up again, so the camera looks
  // down across the shot rather than along the turf.
  candidates.push({x: w.x, z: w.z, lift: Math.max(12, apex * 1.1 + reach * .25)});
 }
 const eye = clearest(candidates, look, groundAt, trees);
 return eye ? {eye, look} : null;
}
