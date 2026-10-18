// A TINY MODEL OF A WHOLE COURSE, FOR ITS CARD (round 14, the owner, 17 October
// 2026: "generate a tiny model of the full course ... low detail ... with trees
// and everything", "fit the tiny model into the box properly", "fill up the
// whole box").
//
// Low-poly ground with slopes, the holes laid on it as smooth shapes (a
// semi-rough ribbon, a fairway ribbon, a green with a ring of semi-rough,
// bunkers, a tee), one sheet of water at the water line so every pond and hollow
// gets its own shore, trees of the landscape's kind, a flag on every green, and
// the land and woods running on past the course so the box can always be full.
// Flat shading, the game's Cartoon look. The design is the mockup's (round 14,
// `buildMini`); the holes are the course's own.
//
// REAL: the holes -- every tee, centre line, green, bunker and pond comes from
// `layoutFor` (course-picture.js: generateCourse + routeHoles, the generator's
// own routing). PLACED (RESEARCH.md, *The tiny course models*): the ground is a
// cheap seeded relief, not the generated terrain, and the trees follow a
// simple per-landscape rule, not the real planting -- building the real
// landscape takes seconds, and a card has to show before that.
//
// `modelData` is pure (numbers in, typed arrays out; no three.js, no DOM), so
// the framing test can build every landscape in Node. `buildCourseModel` turns
// it into a three.js scene with whatever THREE it is handed.

const TAU = Math.PI * 2;

// The mockup's ground colours per landscape: rough, fairway, green, trees,
// water. Display values (sRGB), used as they are: the card's render target is
// read back without any colour conversion (model-cards.js).
export const MODEL_COLOURS = {
 midwest: ['#6f9a3e', '#9fd46a', '#c8f08e', '#3f6b2a', '#4aa3c9'],
 desert: ['#d8b46a', '#8fcf6a', '#b9ec8a', '#a77a3a', '#4aa3c9'],
 links: ['#b8a75a', '#a7cf72', '#cdeea0', '#7d7a3a', '#5aa0b8'],
 mountain: ['#5f8a44', '#93c96a', '#c0ea8e', '#2f5a32', '#4a9ac0'],
 haunted: ['#4a2f66', '#8a6ac0', '#8fd650', '#2a1a3a', '#2c5a40'],
 pnw: ['#4f7a44', '#8cc46a', '#bde88a', '#244a2a', '#4a94b8'],
 island: ['#e3d49a', '#8fd06a', '#bdf08e', '#3f7a3a', '#2fa6c8'],
 redwood: ['#4a5a34', '#86b85e', '#b4e084', '#2a2a1a', '#4a8aa8'],
 autumn: ['#8a7a3a', '#a8c86a', '#d0e894', '#b8622a', '#4a94b8'],
};
export const MODEL_TREES = {midwest: 'round', desert: 'cactus', links: 'round', mountain: 'cone', haunted: 'dead', pnw: 'cone', island: 'palm', redwood: 'cone', autumn: 'round'};
const RELIEF = {midwest: 5, desert: 6, links: 5.5, mountain: 13, haunted: 6, pnw: 8, island: 4, redwood: 8, autumn: 6};
const DENSITY = {midwest: 1, desert: .3, links: .35, mountain: 1.1, haunted: 1, pnw: 1.4, island: .6, redwood: 1.5, autumn: 1.1};
const TREE_PALETTE = {autumn: ['#c8642a', '#e0a030', '#a83a24', '#7c8f3a'], haunted: ['#6a5a74', '#7d6c86', '#58485f'], desert: ['#4f7a3e', '#5f8a4a']};

// The model's units: the course is scaled so it fits 200 x 120 (the mockup's
// plan), whatever its real size, so the features read at card size.
const PLAN_W = 200, PLAN_D = 120, N = 24;
// How far the land runs past the course on every side (the mockup's 480 x 350
// land round a 200 x 120 plan).
const LAND_X = 140, LAND_Z = 115, CELL = 3.75;

const hashSeed = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; };
const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const hexRGB = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const scale = (a, k) => a.map(v => Math.min(1, v * k));
const clamp01 = v => Math.max(0, Math.min(1, v));

// The holes in model units, from a layout (course-picture.js courseLayout).
export function modelPlan(layout) {
 const b = layout.bounds, bw = Math.max(1, b.maxX - b.minX), bd = Math.max(1, b.maxZ - b.minZ);
 const k = Math.min(PLAN_W / bw, PLAN_D / bd), cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
 const to = p => [(p.x - cx) * k, (p.z - cz) * k];
 const holes = [], water = [], bunkers = [];
 for (const h of layout.holes) {
  const path = [];
  for (let i = 0; i <= N; i++) { const z = h.length * i / N; path.push(to(h.toWorld({x: h.center(z), z}))); }
  const tee = to(h.toWorld(h.tee ?? {x: h.center(0), z: 0})), green = to(h.toWorld(h.green ?? h.pin));
  const mow = (h.mowStart ?? h.fairwayStart ?? 22) / h.length;
  // Widths read at card size: never thinner than the mockup's.
  const fw = Math.max(5.6, 36 * k * 1.3), gr = Math.max(3.4, (h.greenSize ?? 17) * k * 1.3);
  holes.push({path, tee, green, mow: clamp01(mow), fw, gr});
  for (const p of h.ponds || []) { const c = to(h.toWorld(p)); water.push({x: c[0], z: c[1], r: Math.max(3, Math.sqrt((p.rx || 10) * (p.rz || 10)) * k)}); }
  for (const p of h.bunkers || []) { const c = to(h.toWorld(p)); bunkers.push({x: c[0], z: c[1], r: Math.max(1.1, Math.sqrt((p.rx || 4) * (p.rz || 4)) * k * 1.2)}); }
 }
 return {holes, water, bunkers, biome: layout.settings.biome, holeCount: layout.holes.length, seed: hashSeed(layout.settings.seed ?? 'EVERGREEN')};
}

// Everything the model is made of, as plain arrays. Pure.
export function modelData(plan) {
 const b = MODEL_COLOURS[plan.biome] ? plan.biome : 'pnw', g = MODEL_COLOURS[b].map(hexRGB), rnd = rng(plan.seed);
 const ph = Array.from({length: 5}, () => rnd() * TAU), amp = RELIEF[b];
 const hRaw = (x, z) => amp * (Math.sin(x * .045 + ph[0]) * Math.cos(z * .06 + ph[1]) * .6 + Math.sin(x * .11 + z * .07 + ph[2]) * .22 + Math.sin(x * .023 - z * .031 + ph[3]) * .5);
 // Segments of every hole's line, for "how far from golf" (trees, slopes).
 const segs = [], greens = plan.holes.map(h => h.green), tees = plan.holes.map(h => h.tee);
 for (const h of plan.holes) for (let i = 0; i < N; i += 4) segs.push([...h.path[i], ...h.path[i + 4]]);
 const dSeg = (px, pz, q) => { const vx = q[2] - q[0], vz = q[3] - q[1], l2 = vx * vx + vz * vz, t = l2 ? clamp01(((px - q[0]) * vx + (pz - q[1]) * vz) / l2) : 0; return Math.hypot(px - q[0] - vx * t, pz - q[1] - vz * t); };
 const wE = (x, z) => { let m = 9; for (const w of plan.water) m = Math.min(m, Math.hypot(x - w.x, z - w.z) / w.r); return m; };
 const info = (x, z) => {
  let dm = 1e9, dg = 1e9;
  for (const s of segs) dm = Math.min(dm, dSeg(x, z, s));
  for (let i = 0; i < greens.length; i++) dg = Math.min(dg, Math.hypot(x - greens[i][0], z - greens[i][1]), Math.hypot(x - tees[i][0], z - tees[i][1]));
  const dry = clamp01(Math.min(dm - 6, dg - 8) / 6);
  return {dm, e: wE(x, z) + (1 - dry) * 3};
 };
 const WL = -amp * .7 - .6;
 // Gentle along the holes, dipping into a pond's bed, never under water where a hole runs.
 const hgt = (x, z, f = info(x, z)) => {
  let h = hRaw(x, z) * (.4 + .6 * clamp01((f.dm - 3) / 10));
  if (f.e < 1.6) { const q = Math.max(0, (f.e - 1) / .6); h = (WL - 1.4) + (h - (WL - 1.4)) * q; }
  if (f.dm < 8) h = Math.max(h, WL + .9);
  return h;
 };
 const cR = g[0], cSemi = mix(g[0], g[1], .4), cF = scale(g[1], .9), cG = scale(g[2], .92), cSand = hexRGB('#e2cf98'), cTee = mix(g[1], [1, 1, 1], .12), cBed = mix(g[0], hexRGB('#e8d8a8'), .55), cW = scale(g[4], .85);

 // The ground: a grid of flat-shaded triangles over the land.
 let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
 for (const p of [...tees, ...greens, ...plan.holes.map(h => h.path[N >> 1])]) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
 const ccx = (minX + maxX) / 2, ccz = (minZ + maxZ) / 2;
 const EXW = PLAN_W / 2 + LAND_X, EXD = PLAN_D / 2 + LAND_Z, NX = Math.round(2 * EXW / CELL), NZ = Math.round(2 * EXD / CELL), DX = 2 * EXW / NX, DZ = 2 * EXD / NZ;
 const H = new Float32Array((NX + 1) * (NZ + 1));
 let top = -1e9;
 for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const v = hgt(-EXW + i * DX, -EXD + j * DZ); H[j * (NX + 1) + i] = v; top = Math.max(top, v); }
 const ground = {pos: [], col: []}, over = {pos: [], col: []}, wat = {pos: [], col: []};
 const tri = (o, a, bb, c, colr) => { o.pos.push(...a, ...bb, ...c); for (let k = 0; k < 3; k++) o.col.push(...colr); };
 const P3 = (i, j) => [-EXW + i * DX, H[j * (NX + 1) + i], -EXD + j * DZ];
 for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const p00 = P3(i, j), p10 = P3(i + 1, j), p01 = P3(i, j + 1), p11 = P3(i + 1, j + 1);
  for (const t3 of [[p00, p01, p10], [p10, p01, p11]]) {
   const cx = (t3[0][0] + t3[1][0] + t3[2][0]) / 3, cy = (t3[0][1] + t3[1][1] + t3[2][1]) / 3, cz = (t3[0][2] + t3[1][2] + t3[2][2]) / 3;
   tri(ground, ...t3, cy < WL + .3 ? cBed : scale(cR, .92 + .14 * (.5 + .5 * Math.sin(cx * .21 + cz * .13 + ph[4]) * Math.cos(cz * .17 - cx * .09))));
  }
 }
 // The holes, laid on the ground: each shape's points take its height, lifted a touch.
 const on = (x, z, lift) => [x, hgt(x, z) + lift, z];
 const ribbon = (P, t0, t1, w, c, lift) => {
  const a = Math.round(t0 * N), bq = Math.round(t1 * N), rows = [];
  for (let k = a; k <= bq; k++) {
   const p = P[k], pp = P[Math.max(0, k - 1)], pn = P[Math.min(N, k + 1)], ex = pn[0] - pp[0], ez = pn[1] - pp[1], el = Math.hypot(ex, ez) || 1, nx = -ez / el * w / 2, nz = ex / el * w / 2;
   rows.push([on(p[0] + nx, p[1] + nz, lift), on(p[0], p[1], lift), on(p[0] - nx, p[1] - nz, lift)]);
  }
  for (let k = 0; k < rows.length - 1; k++) for (let q = 0; q < 2; q++) { tri(over, rows[k][q], rows[k + 1][q], rows[k][q + 1], c); tri(over, rows[k][q + 1], rows[k + 1][q], rows[k + 1][q + 1], c); }
  // Round ends.
  for (const [end, dir] of [[a, 1], [bq, -1]]) {
   const p = P[end], pn = P[Math.max(0, Math.min(N, end + dir))], base = Math.atan2(p[1] - pn[1], p[0] - pn[0]), cc = on(p[0], p[1], lift);
   for (let s = 0; s < 6; s++) { const a1 = base - Math.PI / 2 + s * Math.PI / 6, a2 = a1 + Math.PI / 6; tri(over, cc, on(p[0] + Math.cos(a2) * w / 2, p[1] + Math.sin(a2) * w / 2, lift), on(p[0] + Math.cos(a1) * w / 2, p[1] + Math.sin(a1) * w / 2, lift), c); }
  }
 };
 const disc = (cx, cz, rx, rz, c, lift, seg = 14) => { const cc = on(cx, cz, lift); for (let s = 0; s < seg; s++) { const a1 = s / seg * TAU, a2 = (s + 1) / seg * TAU; tri(over, cc, on(cx + Math.cos(a2) * rx, cz + Math.sin(a2) * rz, lift), on(cx + Math.cos(a1) * rx, cz + Math.sin(a1) * rz, lift), c); } };
 for (const h of plan.holes) ribbon(h.path, .02, 1, h.fw + 3.4, cSemi, .3);
 for (const h of plan.holes) ribbon(h.path, Math.max(.08, h.mow), .94, h.fw, cF, .42);
 for (const h of plan.holes) { disc(h.green[0], h.green[1], h.gr + .8, (h.gr + .8) * .9, cSemi, .46, 16); disc(h.green[0], h.green[1], h.gr, h.gr * .9, cG, .54, 16); }
 for (const h of plan.holes) disc(h.tee[0], h.tee[1], 1.7, 1.2, cTee, .5, 8);
 for (const bk of plan.bunkers) disc(bk.x, bk.z, bk.r, bk.r * .8, cSand, .62, 10);
 // Water: one flat sheet at the water line over all the land; the ground's own shape makes every shore.
 tri(wat, [-EXW, WL, -EXD], [-EXW, WL, EXD], [EXW, WL, -EXD], cW); tri(wat, [EXW, WL, -EXD], [-EXW, WL, EXD], [EXW, WL, EXD], cW);
 // Trees in the rough, in clumps, thicker beyond the course.
 const kind = MODEL_TREES[b], n = Math.round(DENSITY[b] * (plan.holeCount === 18 ? 340 : 220) * 4), trees = [];
 const pal = (TREE_PALETTE[b] || [MODEL_COLOURS[b][3]]).map(hexRGB);
 for (let tries = 0; tries < n * 8 && trees.length < n; tries++) {
  const x = -EXW + 2 + rnd() * (2 * EXW - 4), z = -EXD + 2 + rnd() * (2 * EXD - 4), f = info(x, z);
  if (f.dm < 7 || f.e < 1.3) continue;
  const outside = Math.abs(x) > PLAN_W / 2 || Math.abs(z) > PLAN_D / 2;
  if (!(outside && rnd() < .5) && Math.sin(x * .08 + ph[4]) * Math.cos(z * .09 + ph[0]) + Math.sin(x * .21 - z * .17) * .35 < -.15) continue;
  const r = rnd();
  trees.push({x, y: hgt(x, z, f), z, s: .75 + rnd() * .6, turn: r * TAU, col: scale(pal[Math.floor(r * pal.length) % pal.length], .85 + r * .3)});
 }
 const pumpkins = [];
 if (b === 'haunted') for (let t = 0; t < 600 && pumpkins.length < 60; t++) {
  const x = -110 + rnd() * 220, z = -70 + rnd() * 140, f = info(x, z);
  if (f.dm < 5.5 || f.dm > 14 || f.e < 1.3) continue;
  pumpkins.push({x, y: hgt(x, z, f) + .4, z, s: .7 + rnd() * .7, turn: rnd() * TAU});
 }
 const flags = greens.map(p => [p[0], hgt(p[0], p[1]) + .5, p[1]]);
 // What the camera must keep in view: every tee, green and mid-line, round the course's centre.
 const pts = [...tees, ...greens, ...plan.holes.map(h => h.path[N >> 1])].map(p => [p[0] - ccx, p[1] - ccz]);
 return {
  biome: b, kind, ground, over, water: wat, trees, pumpkins, flags, centre: [ccx, ccz], pts,
  hw: (maxX - minX) / 2 + 7, hd: (maxZ - minZ) / 2 + 7,
  land: [-EXW - ccx, EXW - ccx, -EXD - ccz, EXD - ccz], base: -amp - 6, top: top + 3,
  tees: tees.map(p => [p[0] - ccx, p[1] - ccz]), greens: greens.map(p => [p[0] - ccx, p[1] - ccz]),
 };
}

// The model as a three.js scene: `pivot` turns about the course's centre for the sway.
export function buildCourseModel(T, d, {hot = '#facc15'} = {}) {
 const lin = T.LinearSRGBColorSpace;
 const colour = rgb => new T.Color().setRGB(rgb[0], rgb[1], rgb[2], lin);
 const mesh = (o, mat) => {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(o.pos, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(o.col, 3));
  geo.computeVertexNormals();
  return new T.Mesh(geo, mat);
 };
 const group = new T.Group();
 group.add(mesh(d.ground, new T.MeshLambertMaterial({vertexColors: true})));
 group.add(mesh(d.over, new T.MeshLambertMaterial({vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4})));
 group.add(mesh(d.water, new T.MeshLambertMaterial({vertexColors: true, side: T.DoubleSide})));
 const kind = d.kind;
 const crownG = kind === 'cone' ? new T.ConeGeometry(1.6, 4.4, 6) : kind === 'palm' ? new T.ConeGeometry(2.3, .9, 7) : kind === 'cactus' ? new T.CylinderGeometry(.32, .36, 2.2, 6) : kind === 'dead' ? new T.ConeGeometry(.7, 3.8, 4) : new T.IcosahedronGeometry(1.9, 0);
 crownG.translate(0, kind === 'cone' ? 3.6 : kind === 'palm' ? 4.6 : kind === 'cactus' ? 1.1 : kind === 'dead' ? 2.6 : 3.1, 0);
 const trunkG = new T.CylinderGeometry(.22, .32, kind === 'palm' ? 4.6 : 2.2, 5);
 trunkG.translate(0, kind === 'palm' ? 2.3 : 1.1, 0);
 const n = Math.max(1, d.trees.length);
 const crowns = new T.InstancedMesh(crownG, new T.MeshLambertMaterial({color: 0xffffff, flatShading: true}), n);
 const trunks = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({color: colour(hexRGB('#5a3d24'))}), kind === 'cactus' ? 1 : n);
 const M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), V = new T.Vector3(), S = new T.Vector3();
 d.trees.forEach((t, k) => {
  M.compose(V.set(t.x, t.y - .2, t.z), Q.setFromAxisAngle(Y, t.turn), S.set(t.s, t.s * (kind === 'dead' ? 1.2 : 1), t.s));
  crowns.setMatrixAt(k, M); if (kind !== 'cactus') trunks.setMatrixAt(k, M);
  crowns.setColorAt(k, colour(t.col));
 });
 crowns.count = d.trees.length;
 if (kind === 'cactus') trunks.setMatrixAt(0, new T.Matrix4().makeScale(0, 0, 0));
 group.add(crowns, trunks);
 if (d.pumpkins.length) {
  const pk = new T.InstancedMesh(new T.IcosahedronGeometry(.9, 0), new T.MeshLambertMaterial({color: colour(hexRGB('#e8761e')), flatShading: true}), d.pumpkins.length);
  d.pumpkins.forEach((p, k) => { M.compose(V.set(p.x, p.y, p.z), Q.setFromAxisAngle(Y, p.turn), S.set(p.s, p.s * .75, p.s)); pk.setMatrixAt(k, M); });
  group.add(pk);
 }
 // A flag on every green, in the landscape's hot colour.
 const poleG = new T.CylinderGeometry(.1, .1, 4.2, 4); poleG.translate(0, 2.1, 0);
 const flagG = new T.BoxGeometry(1.7, 1, .08); flagG.translate(.85, 3.7, 0);
 const poleM = new T.MeshLambertMaterial({color: 0xffffff}), flagM = new T.MeshLambertMaterial({color: colour(hexRGB(/^#[0-9a-f]{6}$/i.test(hot) ? hot : '#facc15'))});
 for (const f of d.flags) { const p = new T.Mesh(poleG, poleM), fl = new T.Mesh(flagG, flagM); p.position.set(...f); fl.position.set(...f); group.add(p, fl); }
 group.position.set(-d.centre[0], 0, -d.centre[1]);
 const pivot = new T.Group(); pivot.add(group);
 const scene = new T.Scene(); scene.add(pivot);
 // Lit in display values (no colour conversion on the way out). Light is pi
 // times the mockup's (three r128 there; today's lights carry no hidden pi), so
 // flat ground in sun comes out about its own colour.
 scene.add(new T.HemisphereLight(0xffffff, 0x6a7258, .55 * Math.PI));
 const sun = new T.DirectionalLight(0xfff4e0, .75 * Math.PI); sun.position.set(-70, 120, 90); scene.add(sun);
 return {scene, pivot, dispose: () => scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); })};
}
