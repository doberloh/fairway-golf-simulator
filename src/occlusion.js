// SOFT GROUND OCCLUSION (U1 in TODO): how much of the sky each patch of ground
// cannot see, baked once per course from the trees and boulders standing on it
// and read by the ground shader as a darkening.
//
// Why baked and not screen-space. A screen-space pass (SAO, GTAO) needs the
// scene drawn into a render target first, and routing the scene through one
// costs the canvas its MSAA -- the same reason the god rays avoid
// EffectComposer (PROJECT_HANDOFF). It would also darken everything, fairways
// included, by whatever the depth buffer happened to show. What the brief
// actually asked for is narrower: trunks and rocks that look set down ON the
// grass rather than IN it, and forest floors deeper than open rough. Every one
// of those is known exactly from world data, so it is a texture lookup rather
// than a full-screen pass, costs the same on every tier, and cannot shimmer.
//
// Two terms, combined the way independent occluders combine (each lets through
// a share of what the others let through):
//   contact  a tight ring at the foot of each trunk and round each boulder,
//            strongest at the bark and gone a couple of metres out;
//   canopy   a broad faint pool under each crown, so where crowns overlap --
//            a forest -- the floor goes deeper than under a lone tree.
// Kept free of three so it can be tested in Node.
import {GROUND_PLANTS, crownRadius} from './species.js';

// It rides in the red channel of the ground's `cover` texture, beside the
// straw, at the ownership atlas's size (1.75 m texels, coarser only on the
// largest courses) -- NOT in a texture of its own. The ground shader has one
// sampler of headroom against the 16 WebGL guarantees (graphics.js, on
// floodlight shadows), and a seventeenth sampler does not slow a program down,
// it stops it linking, and the ground disappears.

const smooth = (a, b, x) => {const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t);};

// One occluder: a falloff from `inner` (full `strength`) to `outer` (nothing).
// Splatted by multiplying what reaches the ground, so overlaps deepen without
// ever passing full dark.
function splat(open, Sx, Sz, ex, ez, x, z, inner, outer, strength) {
 const sx = Sx / (ex * 2), sz = Sz / (ez * 2);
 const i0 = Math.max(0, Math.floor((x - outer + ex) * sx)), i1 = Math.min(Sx - 1, Math.ceil((x + outer + ex) * sx));
 const j0 = Math.max(0, Math.floor((z - outer + ez) * sz)), j1 = Math.min(Sz - 1, Math.ceil((z + outer + ez) * sz));
 for (let j = j0; j <= j1; j++) {
  const tz = (j + .5) / sz - ez - z;
  for (let i = i0; i <= i1; i++) {
   const tx = (i + .5) / sx - ex - x, d = Math.hypot(tx, tz);
   if (d >= outer) continue;
   const k = j * Sx + i;
   open[k] *= 1 - strength * (1 - smooth(inner, outer, d));
  }
 }
}

// Per texel, 0 open sky to 1 fully occluded, on the ownership atlas's grid (rows
// run with z), so one uv serves both.
export function occlusionAtlas(world, ex, ez, Sx, Sz) {
 const open = new Float32Array(Sx * Sz).fill(1);
 for (const t of world.trees) {
  if (Math.abs(t.x) > ex + 12 || Math.abs(t.z) > ez + 12) continue;
  if (GROUND_PLANTS.has(t.kind)) {splat(open, Sx, Sz, ex, ez, t.x, t.z, 0, (t.r || 1) * .8 + .4, .22); continue;}
  // The same girth course.js pads the launch checks with: about 3% of the
  // height, capped. Treated as the trunk's radius at the ground.
  const girth = Math.min((t.h || 8) * .027, 3.6), crown = crownRadius(t) || t.r || 3;
  splat(open, Sx, Sz, ex, ez, t.x, t.z, girth * .5, girth * .5 + 2 + girth * .8, .7);
  splat(open, Sx, Sz, ex, ez, t.x, t.z, crown * .25, crown * 1.1, .22);
 }
 for (const r of world.rocks || []) {
  if (Math.abs(r.x) > ex + 12 || Math.abs(r.z) > ez + 12) continue;
  const reach = r.reach || r.scale || 1;
  splat(open, Sx, Sz, ex, ez, r.x, r.z, reach * .7, reach * 1.3 + 1.2, .6);
 }
 for (let k = 0; k < open.length; k++) open[k] = 1 - open[k];
 return open;
}
