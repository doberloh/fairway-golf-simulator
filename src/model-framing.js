// FRAMING A TINY COURSE MODEL IN ITS BOX (round 14; the mockup's `frameMini`).
// The owner, 17 October 2026: "fit the tiny model into the box properly ...
// fill up the whole box".
//
// - Centred on the course (its tees, bends and greens), not on its land.
// - The tilt follows the box's shape: sin(elevation) = (course width / depth)
//   / box aspect, held between 0.6 and 0.82 (about 37 to 55 degrees), so a
//   wide box looks along a deep course and a tall one down on it.
// - The camera comes as close as it can with every tee, bend and green inside
//   the box, with 6 units of room, at either end of the sway.
// - Then, if the box would show the land's edge, it moves in until it doesn't:
//   the box is always full of ground.
//
// Pure: three.js is handed in, and a model is the plain data of
// course-model.js `modelData` (pts, hw, hd, land). Tested in Node
// (tests/model-framing.test.mjs) for five landscapes and four box shapes.

export const SWAY = 0.08;   // radians either way; the selected card only
export const FOV = 20;      // degrees, vertical
const ROOM = 6;

// `aspect` is the box's width / height; `boxFrac` is the share of the canvas
// the box takes across (1 for a card).
export function frameModel(T, m, aspect, boxFrac = 1) {
 const boxA = aspect * boxFrac;
 const sinE = Math.max(.6, Math.min(.82, (m.hw / m.hd) / boxA)), e = Math.asin(sinE);
 const cam = new T.PerspectiveCamera(FOV, aspect, 1, 8000);
 const dir = new T.Vector3(0, Math.sin(e), Math.cos(e)), tanH = Math.tan(FOV / 2 * Math.PI / 180);
 const pts = [];
 for (const a of [-SWAY, 0, SWAY]) for (const p of m.pts) for (const o of [[-ROOM, -ROOM], [ROOM, -ROOM], [ROOM, ROOM], [-ROOM, ROOM]]) {
  const x = p[0] + o[0], z = p[1] + o[1];
  pts.push(new T.Vector3(x * Math.cos(a) + z * Math.sin(a), 0, -x * Math.sin(a) + z * Math.cos(a)));
 }
 const tgt = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3(), v = new T.Vector3();
 let D = 500;
 const place = () => { cam.position.copy(tgt).addScaledVector(dir, D); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
 // Close in on the points: centre them, then size the distance to them.
 for (let k = 0; k < 10; k++) {
  place();
  let a1 = 1e9, a2 = -1e9, b1 = 1e9, b2 = -1e9;
  for (const p of pts) { v.copy(p).project(cam); a1 = Math.min(a1, v.x); a2 = Math.max(a2, v.x); b1 = Math.min(b1, v.y); b2 = Math.max(b2, v.y); }
  right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
  const hh = D * tanH;
  tgt.addScaledVector(right, (a1 + a2) / 2 * hh * aspect).addScaledVector(up, (b1 + b2) / 2 * hh); tgt.y = 0;
  D *= Math.max((a2 - a1) / 2 / boxFrac, (b2 - b1) / 2);
 }
 // Then in until the box shows no edge of the land.
 for (let k = 0; k < 40 && !boxCovered(T, m, cam, boxFrac, place); k++) D *= .95;
 place();
 return cam;
}

// Rays through the box's edge, at both ends of the sway, all land on the land.
export function boxCovered(T, m, cam, boxFrac = 1, place = null) {
 place?.();
 const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3(), at = new T.Vector2();
 for (let k = 0; k <= 8; k++) {
  const u = -1 + k / 4;
  for (const [x, y] of [[u * boxFrac, -1], [u * boxFrac, 1], [-boxFrac, u], [boxFrac, u]]) {
   ray.setFromCamera(at.set(x, y), cam);
   if (!ray.ray.intersectPlane(plane, hit)) return false;
   for (const a of [-SWAY, 0, SWAY]) {
    const px = hit.x * Math.cos(a) - hit.z * Math.sin(a), pz = hit.x * Math.sin(a) + hit.z * Math.cos(a);
    if (px < m.land[0] + 3 || px > m.land[1] - 3 || pz < m.land[2] + 3 || pz > m.land[3] - 3) return false;
   }
  }
 }
 return true;
}

// Every tee and green inside the box, at both ends of the sway (the test's
// question, and the debugging one). Returns the share in view, 0 to 1.
export function shareInView(T, m, cam, boxFrac = 1) {
 const v = new T.Vector3();
 let inside = 0, all = 0;
 for (const a of [-SWAY, SWAY]) for (const p of [...m.tees, ...m.greens]) {
  all++;
  v.set(p[0] * Math.cos(a) + p[1] * Math.sin(a), 0, -p[0] * Math.sin(a) + p[1] * Math.cos(a)).project(cam);
  if (Math.abs(v.x) <= boxFrac && Math.abs(v.y) <= 1) inside++;
 }
 return all ? inside / all : 1;
}
