// HAUNTED HOLLOW'S MOVING AND GLOWING PARTS.
//
// Five things, all drawn here and none of them decided here:
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
//   Bats      flocks round the tallest trees from dusk (`bats`).
//   Wisps     will-o-the-wisps over the ponds and hollows after dark (`wisps`).
//
// Any biome with `props`, `ghosts`, `bats` or `wisps` gets them; today that is
// Haunted Hollow. The night ones are drawn with no instances by day rather than
// hidden, so their programs are built with everything else under the loading
// screen instead of in the first frame after sunset.
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
 if (!props.length && !perHole && !world.bio.bats && !world.bio.wisps) return null;
 const group = new T.Group(); group.name = 'Haunts'; view.group.add(group);
 drawProps(group, props);
 const lanterns = drawLanterns(group, props.filter(p => p.lantern));
 const ghosts = drawGhosts(group, world, perHole);
 const bats = drawBats(group, world, world.bio.bats || 0);
 const wisps = drawWisps(group, world, world.bio.wisps || 0);
 return {
  // `solar` is renderer.solar: lamplight runs 0 by day to 1 once the sun is
  // two degrees down, the same number the glow ball follows.
  update(dt, elapsed, solar, camera) {
   const lamp = solar?.lamplight ?? 0;
   lanterns?.update(elapsed, lamp);
   ghosts?.update(dt, elapsed, lamp, camera);
   bats?.update(dt, elapsed, lamp);
   wisps?.update(dt, elapsed, lamp);
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

// BATS: flocks wheeling round the tallest dead trees, out from dusk. Each bat
// is three instances -- a body and two wings hinged on it -- in three
// InstancedMeshes, re-posed every frame on the processor: about seventy bats
// on nine holes is two hundred small matrices a frame, which is nothing.
//
// Far bigger than life -- 2.6-4.4 m across the wings, against about 0.2 m for
// a pipistrelle and 1.5 m for the largest fruit bats -- because they are seen
// from a tee 50-150 m away, where anything smaller is a speck against the sky.
// It is a fantasy biome.
// Kept out of the instance cull (`noCull`): the cull trusts that an instance
// stays where it was built, and a bat never does.
function batShapes() {
 const body = new T.SphereGeometry(1, 8, 6); body.scale(.06, .05, .14);
 // One wing, from the shoulder at the origin out along +x: a leading edge,
 // a fingered trailing edge, fanned from the shoulder.
 const rim = [[0, .06], [.16, .1], [.34, .07], [.5, .01], [.42, -.04], [.36, -.1], [.27, -.05], [.19, -.11], [.11, -.05], [0, -.08]];
 const pos = [];
 for (let i = 0; i < rim.length - 1; i++) pos.push(0, 0, 0, rim[i][0], 0, rim[i][1], rim[i + 1][0], 0, rim[i + 1][1]);
 const wing = new T.BufferGeometry(); wing.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); wing.computeVertexNormals();
 return {body, wing};
}

function drawBats(group, world, perHole) {
 const flocks = Math.round(perHole * world.holes.length);
 if (!flocks) return null;
 const rng = random(world.seed + ':bats'), shapes = batShapes();
 const tall = world.trees.filter(t => t.h > 8).sort((a, b) => b.h - a.h);
 const bats = [];
 for (let f = 0; f < flocks; f++) {
  // Round one of the tall trees by this hole, or anywhere tall if it has none.
  const h = world.holes[f % world.holes.length];
  const mine = tall.filter(t => t.hole === h.hole);
  const pool = mine.length ? mine.slice(0, 12) : tall.slice(0, 40);
  if (!pool.length) continue;
  const tree = pool[Math.floor(rng() * pool.length)];
  const n = 6 + Math.floor(rng() * 6), height = tree.y + tree.h * (.75 + rng() * .4);
  for (let i = 0; i < n; i++) bats.push({
   cx: tree.x, cz: tree.z, y: height + (rng() - .5) * 6, r: 7 + rng() * 14, angle: rng() * 6.28,
   rate: (rng() < .5 ? -1 : 1) * (.5 + rng() * .5), flap: 9 + rng() * 5, phase: rng() * 6.28,
   scale: 2.6 + rng() * 1.8, wobble: rng() * 6.28,
  });
 }
 if (!bats.length) return null;
 const material = new T.MeshBasicMaterial({color: '#17111c', side: T.DoubleSide});
 const make = geometry => {
  const m = new T.InstancedMesh(geometry, material, bats.length);
  m.frustumCulled = false; m.userData.noCull = true; m.count = 0; m.name = 'Bats';
  group.add(m); return m;
 };
 const body = make(shapes.body), left = make(shapes.wing), right = make(shapes.wing);
 const o = new T.Object3D(), w = new T.Object3D(), m = new T.Matrix4(), flip = new T.Matrix4().makeScale(-1, 1, 1);
 o.rotation.order = 'YXZ';
 return {
  update(dt, elapsed, lamp) {
   // Out once the light starts to go; all of them, or none.
   const out = lamp > .05;
   body.count = left.count = right.count = out ? bats.length : 0;
   if (!out) return;
   bats.forEach((b, i) => {
    b.angle += b.rate * dt;
    // An erratic circle: the radius and height breathe at their own rates.
    const r = b.r * (1 + .25 * Math.sin(elapsed * .7 + b.wobble));
    o.position.set(b.cx + Math.cos(b.angle) * r, b.y + 1.5 * Math.sin(elapsed * 1.1 + b.phase) + .4 * Math.sin(elapsed * 5.3 + b.wobble), b.cz + Math.sin(b.angle) * r);
    // Nose along the circle (the tangent), banked into the turn.
    const tx = -Math.sin(b.angle) * Math.sign(b.rate), tz = Math.cos(b.angle) * Math.sign(b.rate);
    o.rotation.set(.15 * Math.sin(elapsed * 2.3 + b.phase), Math.atan2(tx, tz), -.45 * Math.sign(b.rate));
    // Grows in from nothing at dusk rather than popping on.
    o.scale.setScalar(b.scale * Math.min(1, (lamp - .05) * 6));
    o.updateMatrix();
    body.setMatrixAt(i, o.matrix);
    const beat = Math.sin(elapsed * b.flap + b.phase) * .85;
    w.rotation.set(0, 0, beat); w.updateMatrix();
    left.setMatrixAt(i, m.multiplyMatrices(o.matrix, w.matrix));
    w.rotation.set(0, 0, -beat); w.updateMatrix();
    right.setMatrixAt(i, m.multiplyMatrices(o.matrix, w.matrix).multiply(flip));
   });
   body.instanceMatrix.needsUpdate = left.instanceMatrix.needsUpdate = right.instanceMatrix.needsUpdate = true;
  },
 };
}

// WILL-O-THE-WISPS: small cold lights drifting over the ponds and settling in
// the hollows after dark. A bright core with a faint shell round it, both
// unlit and outside tone mapping so they read as light. The shell is ordinary
// transparency, not additive: an additive sprite is what drew dark squares
// round the lanterns (see drawLanterns).
function drawWisps(group, world, perHole) {
 const count = Math.round(perHole * world.holes.length);
 if (!count) return null;
 const rng = random(world.seed + ':wisps'), wisps = [];
 const waters = [];
 for (const h of world.holes) for (const p of h.ponds || []) waters.push({h, p});
 for (let i = 0; i < count; i++) {
  const h = world.holes[i % world.holes.length];
  let x, z, base;
  const mine = waters.filter(w => w.h === h);
  if (mine.length && rng() < .7) {
   // Out over the water near its bank.
   const {p} = mine[Math.floor(rng() * mine.length)], a = rng() * 6.28, k = .55 + rng() * .4;
   const at = h.toWorld({x: p.x + Math.cos(a) * p.rx * k, z: p.z + Math.sin(a) * p.rz * k});
   x = at.x; z = at.z; base = Math.max(world.height(x, z), p.level ?? world.waterLevel);
  } else {
   // The lowest of a few spots in the rough beside the hole: a hollow.
   let best = null;
   for (let k = 0; k < 8; k++) {
    const along = h.length * rng(), side = (rng() < .5 ? -1 : 1) * (h.width(along) + 10 + rng() * 40);
    const at = h.toWorld({x: h.center(along) + side, z: along}), y = world.height(at.x, at.z);
    if (world.surface(at.x, at.z) === 'rough' && (!best || y < best.y)) best = {x: at.x, z: at.z, y};
   }
   if (!best) continue;
   x = best.x; z = best.z; base = best.y;
  }
  wisps.push({x, z, base: base + .9 + rng() * .9, r: 1.2 + rng() * 2.8, rate: (rng() < .5 ? -1 : 1) * (.25 + rng() * .35),
   angle: rng() * 6.28, phase: rng() * 6.28, blink: 9 + rng() * 14, size: .16 + rng() * .1});
 }
 if (!wisps.length) return null;
 const core = new T.MeshBasicMaterial({color: '#d8ffd0', toneMapped: false});
 // The glow is a shell whose opacity falls away toward its rim as seen from the
 // camera -- strongest straight through the middle, nothing at the edge -- so
 // it reads as light round the core. A flat translucent sphere read as a green
 // target ring. Its own small shader: no lighting, no fog chunks, so neither the
 // cascades nor the mist patch touch it.
 const shell = new T.ShaderMaterial({
  transparent: true, depthWrite: false, toneMapped: false,
  uniforms: {glow: {value: new T.Color('#7dffa8')}, strength: {value: .55}},
  vertexShader: `varying vec3 vN, vV;
   void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.);
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
   }`,
  fragmentShader: `uniform vec3 glow; uniform float strength; varying vec3 vN, vV;
   void main() {
    float facing = max(dot(normalize(vN), normalize(vV)), 0.);
    gl_FragColor = vec4(glow, pow(facing, 3.) * strength);
   }`,
 });
 const make = (material, radius) => {
  const m = new T.InstancedMesh(new T.SphereGeometry(radius, 12, 8), material, wisps.length);
  m.frustumCulled = false; m.userData.noCull = true; m.count = 0; m.name = 'Wisps';
  group.add(m); return m;
 };
 const cores = make(core, 1), shells = make(shell, 2.6);
 const o = new T.Object3D(), lit = new T.Color('#d8ffd0'), dim = new T.Color('#0c1a10');
 return {
  update(dt, elapsed, lamp) {
   const out = lamp > .2;
   cores.count = shells.count = out ? wisps.length : 0;
   if (!out) return;
   wisps.forEach((w, i) => {
    w.angle += w.rate * dt;
    // Each one goes out now and then, for a second or two, at its own point
    // in the cycle -- a light you cannot quite catch.
    const cycle = (elapsed + w.phase * 3) % w.blink;
    const on = T.MathUtils.smoothstep(cycle, 0, .8) * (1 - T.MathUtils.smoothstep(cycle, w.blink - 2, w.blink - 1.2));
    const pulse = .8 + .2 * Math.sin(elapsed * 3.1 + w.phase);
    o.position.set(w.x + Math.cos(w.angle) * w.r, w.base + .35 * Math.sin(elapsed * .9 + w.phase), w.z + Math.sin(w.angle * 1.3) * w.r * .7);
    o.scale.setScalar(w.size * pulse * on * Math.min(1, (lamp - .2) * 4));
    o.updateMatrix();
    cores.setMatrixAt(i, o.matrix); shells.setMatrixAt(i, o.matrix);
   });
   cores.instanceMatrix.needsUpdate = shells.instanceMatrix.needsUpdate = true;
   core.color.copy(dim).lerp(lit, Math.min(1, lamp * 1.3)).multiplyScalar(1 + lamp);
  },
 };
}
