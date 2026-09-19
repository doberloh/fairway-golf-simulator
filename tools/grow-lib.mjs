// A SMALL PLANT-GEOMETRY LIBRARY, WRITTEN FROM NOTHING.
//
// No imported models, no generator library, no textures. Everything here is
// triangles put together by hand, because the shapes a coast redwood grove
// needs -- a fluted column with a buttressed foot, a foliage plume rather
// than a crown, a sword fern's shuttlecock of arching fronds -- are not in any
// pack and are not what a general tree generator makes either.
//
// Measurements come from 315 reference photographs; see RESEARCH.md. The two
// that shaped this most:
//
//   A redwood's foliage is a NARROW VERTICAL PLUME along the upper trunk, with
//   sprouts and burls lower down. It is not a cone sitting on a pole, which is
//   what every previous attempt built.
//
//   A douglas fir is the opposite: dense, conical, in clear whorled tiers.
//   That difference is most of what makes two conifers read as two species.
//
// Everything is produced at UNIT HEIGHT, centred on x/z, sitting on y=0 --
// the same contract every model in vendor/ obeys.

// --------------------------------------------------------------- the canvas
export class Build {
 constructor() { this.parts = new Map(); }
 part(material) {
  if (!this.parts.has(material)) this.parts.set(material, {position: [], normal: [], index: []});
  return this.parts.get(material);
 }
 // A triangle fan/strip helper: push a vertex, get its index back.
 vert(m, x, y, z, nx, ny, nz) {
  const p = this.part(m), at = p.position.length / 3;
  p.position.push(x, y, z);
  p.normal.push(nx, ny, nz);
  return at;
 }
 tri(m, a, b, c) { this.part(m).index.push(a, b, c); }
 quad(m, a, b, c, d) { this.tri(m, a, b, c); this.tri(m, a, c, d); }
 // FOLIAGE IS BUILT FACING BOTH WAYS, sharing its vertices and therefore its
 // normals. Drawn once and rendered double-sided instead, the renderer flips
 // the normal on the back face -- so a spray whose normals point at the sky
 // has a back that points at the ground and comes out black, which is exactly
 // what the first passes showed. Twice the indices, no extra vertices, and
 // both faces light as one soft mass.
 tri2(m, a, b, c) { this.part(m).index.push(a, b, c, a, c, b); }
 quad2(m, a, b, c, d) { this.tri2(m, a, b, c); this.tri2(m, a, c, d); }

 bounds() {
  let lo = Infinity, hi = -Infinity, r = 0;
  for (const p of this.parts.values())
   for (let i = 0; i < p.position.length; i += 3) {
    lo = Math.min(lo, p.position[i + 1]); hi = Math.max(hi, p.position[i + 1]);
    r = Math.max(r, Math.hypot(p.position[i], p.position[i + 2]));
   }
  return {lo, hi, r};
 }
 // Unit height, standing on zero, centred on x/z.
 normalise() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const {lo, hi} = this.bounds();
  for (const p of this.parts.values())
   for (let i = 0; i < p.position.length; i += 3) {
    minX = Math.min(minX, p.position[i]); maxX = Math.max(maxX, p.position[i]);
    minZ = Math.min(minZ, p.position[i + 2]); maxZ = Math.max(maxZ, p.position[i + 2]);
   }
  const h = Math.max(hi - lo, 1e-6), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (const p of this.parts.values())
   for (let i = 0; i < p.position.length; i += 3) {
    p.position[i] = (p.position[i] - cx) / h;
    p.position[i + 1] = (p.position[i + 1] - lo) / h;
    p.position[i + 2] = (p.position[i + 2] - cz) / h;
   }
  return this;
 }
 verts() { let n = 0; for (const p of this.parts.values()) n += p.position.length / 3; return n; }
}

// ------------------------------------------------------------------- maths
export function rng(seed) {
 let x = (seed * 2654435761) >>> 0 || 1;
 return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export {norm, cross, add, mul};

// FOLIAGE NORMALS POINT MOSTLY UP, not out of the surface they sit on.
//
// A spray is a single sheet of triangles, so half of it faces away from every
// light and renders black -- which is what the first render showed, a tree
// with soot on one side of every frond. Real foliage is a volume of scattering
// needles and reads as a soft mass lit from above, so the normals are tilted
// hard toward the sky. This is the oldest trick in foliage rendering and it is
// the difference between a plant and a pile of cardboard.
const leafy = (n, up = .82) => norm([n[0] * (1 - up), n[1] * (1 - up) + up, n[2] * (1 - up)]);

// A frame perpendicular to `dir`, kept stable along a path.
function frame(dir, hintRef) {
 const d = norm(dir);
 let hint = hintRef || (Math.abs(d[1]) > .95 ? [1, 0, 0] : [0, 1, 0]);
 let u = norm(cross(hint, d));
 if (!isFinite(u[0]) || Math.hypot(...u) < 1e-6) u = norm(cross([1, 0, 0], d));
 const v = norm(cross(d, u));
 return [u, v];
}

// --------------------------------------------------------------- the tube
//
// The workhorse: a tapered tube swept along a path. `flutes` corrugates the
// cross-section, which is the single most recognisable thing about redwood
// bark -- long parallel ridges running the whole height of the trunk. Without
// it a trunk is a smooth cylinder and reads as a telegraph pole.
export function tube(build, material, path, opts = {}) {
 const sides = opts.sides || 9, flutes = opts.flutes || 0, fluteDepth = opts.fluteDepth || .12;
 const closeTop = opts.closeTop, closeBottom = opts.closeBottom !== false;
 const rings = [];
 let hint = null;
 for (let i = 0; i < path.length; i++) {
  const here = path[i].p;
  const dir = i === 0 ? norm([path[1].p[0] - here[0], path[1].p[1] - here[1], path[1].p[2] - here[2]])
   : i === path.length - 1 ? norm([here[0] - path[i - 1].p[0], here[1] - path[i - 1].p[1], here[2] - path[i - 1].p[2]])
   : norm([path[i + 1].p[0] - path[i - 1].p[0], path[i + 1].p[1] - path[i - 1].p[1], path[i + 1].p[2] - path[i - 1].p[2]]);
  const [u, v] = frame(dir, hint);
  hint = v;
  const ring = [];
  // Radius as a function of angle, so the normal can be taken from the CURVE
  // rather than from the axis. Without that the flutes exist in the silhouette
  // and are invisible everywhere else: the shading stays that of a smooth
  // cylinder, which is exactly how the first pass looked.
  const radiusAt = a => path[i].r
   * (flutes ? 1 - fluteDepth * (.5 - .5 * Math.cos(a * flutes)) : 1)
   * (path[i].squash ? (1 + path[i].squash * Math.cos(a * 2)) : 1);
  for (let s = 0; s < sides; s++) {
   const a = s / sides * Math.PI * 2, r = radiusAt(a);
   // dr/da by central difference, then the 2D outward normal of (r·cos a, r·sin a).
   const e = 1e-3, dr = (radiusAt(a + e) - radiusAt(a - e)) / (2 * e);
   let n2x = r * Math.cos(a) + dr * Math.sin(a);
   let n2y = r * Math.sin(a) - dr * Math.cos(a);
   const nl = Math.hypot(n2x, n2y) || 1;
   n2x /= nl; n2y /= nl;
   const nx = u[0] * n2x + v[0] * n2y, ny = u[1] * n2x + v[1] * n2y, nz = u[2] * n2x + v[2] * n2y;
   const px = u[0] * Math.cos(a) + v[0] * Math.sin(a);
   const py = u[1] * Math.cos(a) + v[1] * Math.sin(a);
   const pz = u[2] * Math.cos(a) + v[2] * Math.sin(a);
   ring.push(build.vert(material, here[0] + px * r, here[1] + py * r, here[2] + pz * r, nx, ny, nz));
  }
  rings.push(ring);
 }
 for (let i = 0; i + 1 < rings.length; i++)
  for (let s = 0; s < sides; s++) {
   const t = (s + 1) % sides;
   build.quad(material, rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
  }
 const capAt = (ring, point, ny) => {
  const c = build.vert(material, point[0], point[1], point[2], 0, ny, 0);
  for (let s = 0; s < sides; s++) {
   const t = (s + 1) % sides;
   if (ny > 0) build.tri(material, ring[s], ring[t], c); else build.tri(material, ring[t], ring[s], c);
  }
 };
 if (closeBottom) capAt(rings[0], path[0].p, -1);
 if (closeTop) capAt(rings[rings.length - 1], path[path.length - 1].p, 1);
 return rings;
}

// A straight vertical path with a taper curve and an optional buttressed foot.
//
// The foot matters: every published redwood diameter is quoted "above the
// swollen base", and in the photographs the bottom two or three metres flare
// out and break into root buttresses.
export function bolePath(h, baseR, topR, segments, o = {}) {
 const out = [];
 const lean = o.lean || 0, sway = o.sway || 0, flare = o.flare || 1, flareTo = o.flareTo || .06;
 const r = o.rng || (() => .5);
 for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  // Taper: redwoods hold their girth, so a power curve well above linear.
  let rad = baseR + (topR - baseR) * Math.pow(t, o.taperPower || .78);
  if (t < flareTo) {
   const k = 1 - t / flareTo;
   rad *= 1 + (flare - 1) * k * k;
  }
  const wob = sway * Math.sin(t * 5.2 + (o.phase || 0)) + (o.jitter || 0) * (r() - .5);
  out.push({p: [lean * t * t + wob, t * h, (o.lean2 || 0) * t * t + wob * .6], r: rad});
 }
 return out;
}

// ------------------------------------------------------------ foliage: spray
//
// Coast redwood foliage is FLAT SPRAYS -- a central rib with small needles in
// one plane, the whole thing drooping at the tip. Drawn as a tapered ribbon
// with a zig-zag edge, which at any distance you will see it from is the
// silhouette that matters, and costs about forty triangles.
// A whole flat spray: a central rib with side branchlets, all in one plane.
//
// One ribbon per branch end reads as a leaf, not as foliage -- that was the
// first pass's real failure. A redwood spray is a frond-shaped array of
// branchlets, and drawing five small ones off a rib costs five times as much
// and looks like a tree instead of like a flag.
export function sprayFan(build, material, origin, dir, up, length, width, o = {}) {
 const d = norm(dir), side = norm(cross(d, up)), n = norm(cross(side, d));
 spray(build, material, origin, d, up, length, width, o);
 const arms = o.arms ?? 3;
 for (let i = 1; i <= arms; i++) {
  const t = i / (arms + 1);
  const at = add(origin, mul(d, length * t * .85));
  const droop = (o.droop ?? .4) * 1.1;
  for (const s of [1, -1]) {
   const sweep = (o.sweep ?? .75) * (1 - t * .45);
   const dir2 = norm([d[0] + side[0] * s * sweep - n[0] * .12,
    d[1] + side[1] * s * sweep - n[1] * .12,
    d[2] + side[2] * s * sweep - n[2] * .12]);
   spray(build, material, at, dir2, up, length * (.55 - t * .3), width * (.8 - t * .3),
    {leaflets: o.subLeaflets ?? 3, droop});
  }
 }
}

export function spray(build, material, origin, dir, up, length, width, o = {}) {
 const leaflets = o.leaflets || 5, droop = o.droop ?? .35;
 const d = norm(dir), side = norm(cross(d, up));
 const n = norm(cross(side, d));
 // TWO VERTICES PER STEP, not three. The first version put a third down the
 // centre line to fold the spray slightly along its length -- a detail worth
 // nothing at the distance any of this is seen from, and a third of the
 // vertex count of the most numerous thing in the whole catalogue.
 let prevL = null, prevR = null;
 for (let i = 0; i <= leaflets; i++) {
  const t = i / leaflets;
  const sag = droop * t * t * length;
  const c = [origin[0] + d[0] * length * t + n[0] * -sag,
   origin[1] + d[1] * length * t + n[1] * -sag,
   origin[2] + d[2] * length * t + n[2] * -sag];
  const w = width * (1 - t * t * .85) * (o.taper ?? 1);
  const wob = (i % 2 ? 1 : -1) * w * .22;
  const ln = leafy(n);
  const l = build.vert(material, c[0] + side[0] * (w + wob), c[1] + side[1] * (w + wob), c[2] + side[2] * (w + wob), ln[0], ln[1], ln[2]);
  const rr = build.vert(material, c[0] - side[0] * (w - wob), c[1] - side[1] * (w - wob), c[2] - side[2] * (w - wob), ln[0], ln[1], ln[2]);
  if (prevL !== null) build.quad2(material, prevL, l, rr, prevR);
  prevL = l; prevR = rr;
 }
}

// ------------------------------------------------------------ foliage: frond
//
// A sword fern frond: once-pinnate, so a central rib with paired leaflets all
// the way down, arching over. Each leaflet is one triangle pair; a frond is
// about twenty of them, and a fern is eight to twenty fronds in a shuttlecock.
export function frond(build, material, origin, dir, up, length, o = {}) {
 const pairs = o.pairs || 11, arch = o.arch ?? .5, width = o.width ?? .12;
 const d = norm(dir), side0 = norm(cross(d, up)), n0raw = norm(cross(side0, d)), n0 = leafy(n0raw, .7);
 const ribW = length * .012;
 let prev = null;
 for (let i = 0; i <= pairs; i++) {
  const t = i / pairs;
  const sag = arch * t * t * length;
  const c = [origin[0] + d[0] * length * t - n0[0] * sag,
   origin[1] + d[1] * length * t - n0[1] * sag,
   origin[2] + d[2] * length * t - n0[2] * sag];
  const a = build.vert(material, c[0] + side0[0] * ribW, c[1] + side0[1] * ribW, c[2] + side0[2] * ribW, n0[0], n0[1], n0[2]);
  const b = build.vert(material, c[0] - side0[0] * ribW, c[1] - side0[1] * ribW, c[2] - side0[2] * ribW, n0[0], n0[1], n0[2]);
  if (prev) build.quad2(material, prev[0], a, b, prev[1]);
  prev = [a, b];
  if (i === pairs || i === 0) continue;
  // Leaflets: longest at a third of the way along, shortest at the tip.
  const lw = width * length * Math.sin(Math.PI * Math.pow(t, .7)) * (o.leafletScale ?? 1);
  const back = mul(d, -lw * .35);
  for (const s of [1, -1]) {
   const tipRaw = add(add(c, mul(side0, s * lw)), back);
   const tip = [tipRaw[0], tipRaw[1] - lw * .12, tipRaw[2]];
   const root = s > 0 ? a : b;
   const nx = n0[0], ny = n0[1], nz = n0[2];
   const p1 = build.vert(material, c[0] + side0[0] * s * ribW, c[1] + side0[1] * s * ribW, c[2] + side0[2] * s * ribW, nx, ny, nz);
   const p2 = build.vert(material, tip[0], tip[1], tip[2], nx, ny, nz);
   const fwd = add(c, mul(d, lw * .55));
   const p3 = build.vert(material, fwd[0] + side0[0] * s * ribW, fwd[1] + side0[1] * s * ribW, fwd[2] + side0[2] * s * ribW, nx, ny, nz);
   build.tri2(material, p1, p2, p3);
   void root;
  }
 }
}

// ------------------------------------------------------------- a leaf blade
export function blade(build, material, origin, dir, up, length, width, o = {}) {
 const d = norm(dir), side = norm(cross(d, up)), n = leafy(norm(cross(side, d)), .6);
 const steps = o.steps || 4, curl = o.curl ?? .2;
 let prev = null;
 for (let i = 0; i <= steps; i++) {
  const t = i / steps;
  const sag = curl * t * t * length;
  const c = [origin[0] + d[0] * length * t - n[0] * sag, origin[1] + d[1] * length * t - n[1] * sag,
   origin[2] + d[2] * length * t - n[2] * sag];
  const w = width * Math.sin(Math.PI * Math.pow(t, .65)) * length;
  const a = build.vert(material, c[0] + side[0] * w, c[1] + side[1] * w, c[2] + side[2] * w, n[0], n[1], n[2]);
  const b = build.vert(material, c[0] - side[0] * w, c[1] - side[1] * w, c[2] - side[2] * w, n[0], n[1], n[2]);
  if (prev) build.quad2(material, prev[0], a, b, prev[1]);
  prev = [a, b];
 }
}

// --------------------------------------------------------------- a lumpy dome
//
// Moss mounds, burls, root wads, boulders. An icosphere would be smoother than
// anything on a forest floor, so this is a low-band sphere pushed around by a
// couple of sine waves -- the same trick the ground scatter already uses for
// its boulders, written out again because nothing is imported here.
export function blob(build, material, centre, radius, o = {}) {
 const bands = o.bands || 5, sides = o.sides || 9, squash = o.squash ?? .55;
 const r = o.rng || (() => .5), rough = o.rough ?? .22;
 const rows = [];
 const f1 = 1.4 + r() * 2.4, f2 = 2.1 + r() * 2.2;
 for (let b = 0; b <= bands; b++) {
  const phi = (b / bands) * Math.PI * (o.half ? .5 : 1);
  const row = [];
  for (let s = 0; s < sides; s++) {
   const th = s / sides * Math.PI * 2;
   let x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
   const k = 1 + rough * Math.sin(x * f1 + z * f2) * Math.cos(y * f2 - x * f1);
   x *= k; y *= k; z *= k;
   const px = centre[0] + x * radius, py = centre[1] + (o.half ? (1 - y) * -radius * squash + radius * squash : y * radius * squash), pz = centre[2] + z * radius;
   row.push(build.vert(material, px, py, pz, x, y * squash, z));
  }
  rows.push(row);
 }
 for (let b = 0; b + 1 < rows.length; b++)
  for (let s = 0; s < sides; s++) {
   const t = (s + 1) % sides;
   build.quad(material, rows[b][s], rows[b][t], rows[b + 1][t], rows[b + 1][s]);
  }
}

// ------------------------------------------------------------------ writing
export function toObj(name, build, materials) {
 const lines = [`# ${name} -- grown by tools/grow.mjs. Geometry generated from scratch;`,
  '# no imported model and no texture. Do not edit by hand.', `mtllib ${name}.mtl`, `o ${name}`];
 const body = [];
 let base = 1;
 for (const [material, p] of build.parts) {
  if (!p.index.length) continue;
  const verts = p.position.length / 3;
  for (let i = 0; i < verts; i++)
   lines.push(`v ${p.position[i * 3].toFixed(5)} ${p.position[i * 3 + 1].toFixed(5)} ${p.position[i * 3 + 2].toFixed(5)}`);
  for (let i = 0; i < verts; i++)
   lines.push(`vn ${p.normal[i * 3].toFixed(4)} ${p.normal[i * 3 + 1].toFixed(4)} ${p.normal[i * 3 + 2].toFixed(4)}`);
  body.push(`usemtl ${material}`);
  for (let i = 0; i < p.index.length; i += 3)
   body.push(`f ${base + p.index[i]}//${base + p.index[i]} ${base + p.index[i + 1]}//${base + p.index[i + 1]} ${base + p.index[i + 2]}//${base + p.index[i + 2]}`);
  base += verts;
 }
 void materials;
 return lines.concat(body).join('\n') + '\n';
}

// MTL Kd is LINEAR; these are written as the colour you would pick.
const srgbToLinear = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const linear = hex => [1, 3, 5].map(i => +srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));

export function toMtl(build, palette) {
 // `two-faced` tells a reader every surface here is already built facing both
 // ways, so it must be drawn FRONT SIDE ONLY. Drawn double-sided as well, each
 // triangle gets a coincident twin with a flipped normal and the two z-fight
 // into a black mottle -- exactly what the first attempt at fixing black
 // backfaces produced.
 let out = '# two-faced\n'
  + '# Grown by tools/grow.mjs. Colours measured from 315 reference\n'
  + '# photographs of coast redwood forest -- see RESEARCH.md. The game repaints\n'
  + "# every surface from the biome palette by the material's NAME; these are for\n"
  + '# anything reading the model directly.\n';
 for (const material of build.parts.keys()) {
  if (!build.parts.get(material).index.length) continue;
  const hex = palette[material] || '#808080';
  out += `\nnewmtl ${material}\nKd ${linear(hex).map(v => v.toFixed(3)).join(' ')}\n`;
 }
 return out;
}
