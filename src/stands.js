// UNCLEARED STANDS (the cartoon overhaul, 25 October 2026; the owner's
// addendum: "parts of the course THICK brush or forest, like on the perimeter
// of courses where forest wasn't fully cleared").
//
// A course is cut out of the country it sits in. Until now every landscape
// planted one even scatter of trees over the whole property, thinning to
// nothing about 135 m from the holes -- an orchard on bare hills. A biome's
// `stands` record now says where the ground was never cleared:
//
//  THE RIM: everything more than `edge` metres outside the corridors (give or
//  take `wobble`, so the line wanders as a cleared edge does), rising over
//  `ramp` metres from scattered to closed.
//
//  PATCHES: woods left standing between the holes, where a broad noise field
//  passes `patch` (the share of the country they cover) -- never nearer the
//  corridors than `near`.
//
// Inside, trees are planted from a jittered grid every `spacing` metres, so a
// stand is dense and even the way a real one is, with crowns allowed to
// overlap more (`share`) than the open scatter's. `plants` names the stand's
// own mix where it differs from the biome's (a links' gorse thickets, a
// desert's mesquite bosque); otherwise it is the biome's trees.
//
// Seeded from the course's seed with salts of its own (landforms.js `saltOf`),
// drawing nothing from any generator stream, so nothing else on the course is
// decided differently because of it -- what the new trees themselves stand on
// or shade aside. EVERY NUMBER IN THE STAND RECORDS IS PLACED (RESEARCH, *The
// overhaul's stands*). Pure: no three.js, no DOM.
import {fbm, hash, saltOf} from './landforms.js';

const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

// The stand for a biome record, or null. `at(x, z, d)` is how much of a stand
// the point is in, 0..1, where `d` is nearest().d (signed metres outside the
// corridor envelope); a tree is planted where it is at least one half.
export function standsOf(bio, seed) {
 const o = bio.stands;
 if (!o) return null;
 const sEdge = saltOf(seed, 'stand-edge'), sPatch = saltOf(seed, 'stand-patch');
 const at = (x, z, d) => {
  const edge = o.edge + o.wobble * (fbm(x / 170, z / 170, sEdge) * 2 - 1);
  const rim = smooth(edge, edge + o.ramp, d);
  if (!o.patch || rim >= 1) return rim;
  // fbm sits near 0.5 with a spread of about +-0.2; the threshold below gives
  // roughly `patch` of the country, measured (RESEARCH).
  const cut = .5 + .42 * (.5 - o.patch), n = fbm(x / o.scale, z / o.scale, sPatch, 4);
  return Math.max(rim, smooth(cut - .03, cut + .03, n) * smooth(o.near, o.near + 25, d));
 };
 return {...o, at};
}

// The places a stand tree may grow: one per grid cell, jittered within it,
// with its own uniform numbers for the species, size and shade -- hashed, not
// drawn, so the sites are the seed's alone.
export function standSites(stands, halfX, halfZ, seed) {
 const s = stands.spacing, salt = saltOf(seed, 'stand-site'), out = [];
 const nx = Math.ceil(halfX * 2 / s), nz = Math.ceil(halfZ * 2 / s);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const u = k => hash(i, j, salt + k * 7919);
  const x = -halfX + (i + .1 + .8 * u(0)) * s, z = -halfZ + (j + .1 + .8 * u(1)) * s;
  if (x > halfX || z > halfZ) continue;  // the last row and column overhang the property
  out.push({x, z, pick: u(2), a: u(3), b: u(4), shade: u(5)});
 }
 return out;
}

// A weighted choice from `[[kind, weight, heightScale?], ...]` by a uniform
// number, as course.js `pick` chooses from a stream.
export function choose(plants, u) {
 const total = plants.reduce((n, [, f]) => n + f, 0);
 let r = u * total;
 for (const [k, f] of plants) { r -= f; if (r <= 0) return k; }
 return plants[plants.length - 1][0];
}
