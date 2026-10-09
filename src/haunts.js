// HAUNTED HOLLOW'S MOVING AND GLOWING PARTS.
//
// Three things, all drawn here and none of them decided here:
//
//   Props     the giant pumpkins and toadstools. Generation places them
//             (course.js, `world.props`) because they are solid and physics
//             has to know where they are; this only draws what it was given,
//             with the model generation chose, so the cylinder a ball hits is
//             the shape on screen.
//   Lanterns  a carved face on the pumpkins generation marked `lantern`, dark
//             holes by day that light from inside as the sun goes down.
//             Decoration: the face is part of
//             the pumpkin's own cylinder, so it adds nothing to collide with.
//   Ghosts    sheet ghosts drifting round loops over the holes. Pure scenery,
//             seeded from the course so the same course haunts the same way,
//             and the ball passes straight through them -- they are ghosts.
//
// Any biome with `props` or `ghosts` gets them; today that is Haunted Hollow.
// Everything goes into view.group, so disposeCourse frees it with the course.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from './course.js';
import {instanceModels} from './mesh-assets.js';

const PUMPKIN = '#dc8424', STEM = '#4d5a2a', CAP_RED = '#b5352b', CAP_TAN = '#b39a72', STALK = '#ddd3bf';
// The carved face, unlit: near-black by day, candle-orange after dark.
const FACE_DARK = new T.Color('#2a150a'), FACE_LIT = new T.Color('#ffb040');

export function addHaunts(view) {
 const {world} = view, props = world.props || [], perHole = world.bio.ghosts || 0;
 if (!props.length && !perHole) return null;
 const group = new T.Group(); group.name = 'Haunts'; view.group.add(group);
 drawProps(group, props);
 const lanterns = drawLanterns(group, props.filter(p => p.lantern));
 const ghosts = drawGhosts(group, world, perHole);
 return {
  // `solar` is renderer.solar: lamplight runs 0 by day to 1 once the sun is
  // two degrees down, the same number the glow ball follows.
  update(dt, elapsed, solar, camera) {
   const lamp = solar?.lamplight ?? 0;
   lanterns?.update(elapsed, lamp);
   ghosts?.update(dt, elapsed, lamp, camera);
  },
 };
}

function propMatrix(p, dummy) {
 // Settled a little into the ground, as the forest floor is.
 dummy.position.set(p.x, p.y - p.h * .06, p.z);
 dummy.rotation.set(p.lean[0], p.yaw, p.lean[1]);
 dummy.scale.setScalar(p.h);
 dummy.updateMatrix();
 return dummy.matrix.clone();
}

function drawProps(group, props) {
 if (!props.length) return;
 const dummy = new T.Object3D(); dummy.rotation.order = 'YXZ';
 const pumpkin = new T.Color(PUMPKIN), stem = new T.Color(STEM), stalk = new T.Color(STALK);
 const red = new T.Color(CAP_RED), tan = new T.Color(CAP_TAN);
 const entries = props.map(p => {
  const s = p.shade - .5;
  const accent = p.kind === 'pumpkin' ? pumpkin.clone().offsetHSL(s * .03, s * .1, s * .12)
   : (p.model.includes('tan') ? tan : red).clone().offsetHSL(0, s * .1, s * .1);
  return {model: p.model, owner: null, matrix: propMatrix(p, dummy),
   color: {accent, leaf: stem, bark: stalk, stone: stalk, dirt: stem}};
 });
 const materials = new Map();
 instanceModels(group, entries, role => {
  if (!materials.has(role)) materials.set(role, new T.MeshToonMaterial({color: '#ffffff'}));
  return materials.get(role);
 });
}

// A JACK-O'-LANTERN FACE, in the pumpkin model's own unit space: unit height,
// centred on x/z, the face on +z. The body is 0.69 of its height across at the
// widest, between 0.15 and 0.65 up (measured off the model), and the face sits
// on that band. Each triangle is laid on a slightly larger ellipse than the
// body so it never sinks into a facet.
const RX = .67, RZ = .70;
function onBody(x, y) { return [x, y, RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)) + .012]; }
function faceGeometry() {
 const tris = [];
 const tri = (a, b, c) => tris.push(onBody(...a), onBody(...b), onBody(...c));
 // Eyes and nose: triangles, wound to face +z.
 tri([-.30, .50], [-.10, .50], [-.20, .64]);
 tri([.10, .50], [.30, .50], [.20, .64]);
 tri([-.05, .42], [.05, .42], [0, .49]);
 // The grin: a band curving up at the ends, with two teeth hanging from the
 // top edge where the band is cut short.
 const N = 12, W = .34;
 for (let i = 0; i < N; i++) {
  const x0 = -W + 2 * W * i / N, x1 = -W + 2 * W * (i + 1) / N;
  const top = x => .34 + .45 * x * x, bottom = x => .22 + .75 * x * x;
  const tooth = i === 3 || i === 8 ? .06 : 0;
  const a = [x0, bottom(x0)], b = [x1, bottom(x1)], c = [x1, top(x1) - tooth], d = [x0, top(x0) - tooth];
  tri(a, b, c); tri(a, c, d);
 }
 const g = new T.BufferGeometry();
 g.setAttribute('position', new T.Float32BufferAttribute(tris.flat(), 3));
 g.computeVertexNormals();
 return g;
}

function drawLanterns(group, lanterns) {
 if (!lanterns.length) return null;
 const dummy = new T.Object3D(); dummy.rotation.order = 'YXZ';
 // Unlit, and outside tone mapping so a lit face reads as a light rather than
 // as orange paint -- and is what bloom picks up on the tiers that have it.
 const face = new T.MeshBasicMaterial({color: FACE_DARK.clone(), toneMapped: false});
 const mesh = new T.InstancedMesh(faceGeometry(), face, lanterns.length);
 mesh.name = 'Lantern faces';
 lanterns.forEach((p, i) => mesh.setMatrixAt(i, propMatrix(p, dummy)));
 mesh.instanceMatrix.needsUpdate = true;
 mesh.computeBoundingSphere();
 group.add(mesh);
 // NO HALO. An additive point sprite round each face was tried and drew a
 // dark square behind every lit face instead -- with the mist patch kept off
 // it, too, so the cause is further down the frame than this file. The lit
 // face reads on its own (compared side by side, 9 October); bloom adds the
 // glow on the tiers that have it.
 const lit = new T.Color();
 return {
  update(elapsed, lamp) {
   // A candle, not a bulb: two slow waves and a quick one, between 76% and
   // 100% of full.
   const flicker = .88 + .06 * Math.sin(elapsed * 7.3) + .04 * Math.sin(elapsed * 13.1 + 1.7) + .02 * Math.sin(elapsed * 29);
   const on = Math.min(1, lamp * 1.15);
   lit.copy(FACE_LIT).multiplyScalar(1 + 1.4 * on * flicker);
   face.color.copy(FACE_DARK).lerp(lit, on * flicker);
  },
 };
}

// A SHEET GHOST: a domed head running into a skirt that flares to a wavy hem,
// two stubby arms held forward, black eyes and a round mouth. Built once and
// shared; the skirt ripples in the vertex shader so no two ghosts move alike.
function ghostGeometry() {
 const profile = [];
 for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; profile.push(new T.Vector2(.42 * Math.sin(a) + 1e-3, .58 + .42 * Math.cos(a))); }
 profile.push(new T.Vector2(.44, .40), new T.Vector2(.47, .10), new T.Vector2(.50, -.20), new T.Vector2(.54, -.52));
 const body = new T.LatheGeometry(profile, 28);
 // The hem: the bottom ring dips and rises six times round.
 const pos = body.attributes.position;
 for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -.5) pos.setY(i, -.52 + .09 * Math.sin(6 * Math.atan2(pos.getX(i), pos.getZ(i))));
 const arm = side => {
  // Out to the side and a little forward. Pointed straight ahead they read as
  // two loose discs from anywhere but behind.
  const g = new T.CapsuleGeometry(.08, .24, 4, 8);
  g.rotateZ(side * (Math.PI / 2 - .55)); g.rotateY(-side * .35);
  g.translate(side * .50, .20, .08);
  return g;
 };
 const merged = mergeGeometries([body.toNonIndexed(), arm(1).toNonIndexed(), arm(-1).toNonIndexed()].map(g => { g.deleteAttribute('uv'); return g; }));
 merged.computeVertexNormals();
 const features = [[-.14, .70, .37, .07, .11], [.14, .70, .37, .07, .11], [0, .50, .41, .08, .10]].map(([x, y, z, rx, ry]) => {
  const g = new T.SphereGeometry(1, 12, 8); g.scale(rx, ry, .04); g.translate(x, y, z); g.deleteAttribute('uv'); return g;
 });
 return {body: merged, face: mergeGeometries(features)};
}

function ghostMaterial(phase, time) {
 const m = new T.MeshToonMaterial({color: '#eef2ff', emissive: '#a9bcff', emissiveIntensity: .15,
  transparent: true, opacity: .86, side: T.DoubleSide});
 m.onBeforeCompile = shader => {
  shader.uniforms.ghostTime = time; shader.uniforms.ghostPhase = {value: phase};
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float ghostTime; uniform float ghostPhase;')
   .replace('#include <begin_vertex>', `#include <begin_vertex>
  // The skirt ripples and trails; the head stays still. Nothing above the
  // shoulders moves, so the eyes stay on the face.
  float skirt = smoothstep(.25, -.55, position.y);
  transformed.x += sin(ghostTime * 3.1 + position.y * 6.0 + ghostPhase) * .06 * skirt;
  transformed.z += cos(ghostTime * 2.4 + position.y * 5.0 + ghostPhase) * .06 * skirt - .10 * skirt * skirt;`);
 };
 // One program for every ghost; only the uniforms differ.
 m.customProgramCacheKey = () => 'ghost-skirt';
 return m;
}

function drawGhosts(group, world, perHole) {
 const count = Math.round(perHole * world.holes.length);
 if (!count) return null;
 const rng = random(world.seed + ':ghosts'), shapes = ghostGeometry();
 const time = {value: 0};
 const ghosts = [];
 for (let i = 0; i < count; i++) {
  const h = world.holes[i % world.holes.length];
  // A loop beside the hole, and every third one wide enough to drift across
  // the fairway. Oriented down the hole so it patrols the corridor rather than
  // wandering off into the woods.
  const across = rng() < .34, side = rng() < .5 ? -1 : 1;
  const along = h.length * (.2 + rng() * .6);
  const off = across ? (rng() - .5) * 20 : side * (h.width(along) + 18 + rng() * 30);
  const centre = h.toWorld({x: h.center(along) + off, z: along});
  const ax = across ? h.width(along) + 25 + rng() * 25 : 10 + rng() * 22, az = 20 + rng() * 45;
  const bearing = h.rotation ?? 0, scale = 1.4 + rng() * 1.1;
  const speed = 1.8 + rng() * 2.4, dir = rng() < .5 ? -1 : 1;
  const material = ghostMaterial(rng() * 6.28, time);
  // Its own face material, so the eyes fade with the body instead of being
  // left hanging in the air when a ghost drifts into the camera.
  const faceMat = new T.MeshBasicMaterial({color: '#141018', transparent: true});
  const body = new T.Mesh(shapes.body, material), face = new T.Mesh(shapes.face, faceMat);
  const ghost = new T.Group(); ghost.add(body, face); ghost.scale.setScalar(scale);
  ghost.name = 'Ghost';
  group.add(ghost);
  ghosts.push({ghost, material, faceMat, centre, ax, az, bearing, scale,
   rate: dir * speed / ((ax + az) / 2), angle: rng() * 6.28,
   hover: 2.2 + rng() * 3.5, bob: rng() * 6.28, last: new T.Vector3()});
 }
 const local = new T.Vector3();
 const place = (g, a, out) => {
  // The loop in the hole's own frame, turned to the hole's bearing.
  const lx = Math.cos(a) * g.ax, lz = Math.sin(a) * g.az, c = Math.cos(g.bearing), s = Math.sin(g.bearing);
  out.set(g.centre.x + lx * c + lz * s, 0, g.centre.z - lx * s + lz * c);
  return out;
 };
 return {
  update(dt, elapsed, lamp, camera) {
   time.value = elapsed;
   for (const g of ghosts) {
    g.angle += g.rate * dt;
    place(g, g.angle, g.ghost.position);
    const p = g.ghost.position;
    p.y = world.height(p.x, p.z) + g.hover + .45 * Math.sin(elapsed * 1.3 + g.bob);
    // Faces where it is going, leaning into it a little.
    place(g, g.angle + Math.sign(g.rate) * .05, local);
    g.ghost.rotation.set(.12, Math.atan2(local.x - p.x, local.z - p.z), .06 * Math.sin(elapsed * .9 + g.bob), 'YXZ');
    // Fades out rather than filling the screen when it drifts into the camera.
    const near = camera ? p.distanceTo(camera.position) : 99;
    g.material.opacity = .86 * T.MathUtils.smoothstep(near, 3 * g.scale, 9 * g.scale);
    g.faceMat.opacity = g.material.opacity / .86;
    g.ghost.visible = g.material.opacity > .02;
    // A faint glow by day, a proper one after dark.
    g.material.emissiveIntensity = .15 + .85 * lamp;
   }
  },
 };
}
